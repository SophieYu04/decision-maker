from __future__ import annotations

import os
import json
from contextlib import asynccontextmanager
from typing import Any, List, Dict, Union

import asyncpg
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from sqlalchemy import create_engine
from schema import Base

# ── Database ────────────────────────────────────────────────────────────────

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://user:password@localhost/decision_maker",
)

engine = create_engine(DATABASE_URL)
Base.metadata.create_all(engine)

pool: asyncpg.Pool | None = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global pool
    pool = await asyncpg.create_pool(
        DATABASE_URL,
        min_size=1,
        max_size=10,
    )
    try:
        yield
    finally:
        if pool is not None:
            await pool.close()

def get_pool() -> asyncpg.Pool:
    if pool is None:
        raise HTTPException(500, "Database pool is not initialized")
    return pool

# ── FastAPI app ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="Decision Maker API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic schemas ────────────────────────────────────────────────────────

class DecisionCreateIn(BaseModel):
    name: str
    data: dict

class AnswerIn(BaseModel):
    questionId: str
    value: Union[str, float, int]

class WeightIn(BaseModel):
    categoryId: str
    weight: float

class SubmitAnswersIn(BaseModel):
    decision_id: int
    answers: List[AnswerIn]
    weights: List[WeightIn]

# ── Score logic ─────────────────────────────────────────────────────────────

def get_slider_scores(mapping: dict, value: float) -> dict:
    t = (value - 1) / 9
    left_score = round((1 - t) * 10, 2)
    right_score = round(t * 10, 2)
    res = {mapping["leftOptionId"]: left_score}
    if mapping.get("rightOptionId") != mapping["leftOptionId"]:
        res[mapping["rightOptionId"]] = right_score
    return res

def get_question_option_scores(question: dict, answer: dict) -> dict:
    if question.get("type") == "multiple_choice":
        choices = question.get("choices", [])
        for c in choices:
            if c["id"] == answer["value"]:
                return c.get("optionScores", {})
        return {}
    
    val = float(answer["value"])
    mapping = question.get("sliderMapping")
    if mapping:
        return get_slider_scores(mapping, val)
    return {}

def compute_scores(q: dict, answers: List[dict], weights: List[dict]) -> dict:
    answer_breakdowns = []
    
    # Pre-calculate answer breakdowns
    for cat in q.get("categories", []):
        for question in cat.get("questions", []):
            ans = next((a for a in answers if a["questionId"] == question["id"]), None)
            if not ans:
                continue
                
            ans_val = ans["value"]
            if question.get("type") == "multiple_choice":
                choices = question.get("choices", [])
                choice = next((c for c in choices if c["id"] == ans_val), None)
                answer_label = choice["label"] if choice else str(ans_val)
            else:
                answer_label = f"Slider → {float(ans_val):.1f}/10"
                
            answer_breakdowns.append({
                "questionId": question["id"],
                "questionText": question.get("text", ""),
                "type": question.get("type", ""),
                "categoryId": cat["id"],
                "categoryName": cat.get("name", ""),
                "categoryColor": cat.get("color", ""),
                "optionScores": get_question_option_scores(question, ans),
                "answerLabel": answer_label,
            })
            
    raw_scores = []
    for opt in q.get("options", []):
        total_weighted_score = 0.0
        total_used_weight = 0.0
        contributions = []
        
        for cat in q.get("categories", []):
            uw = next((w for w in weights if w["categoryId"] == cat["id"]), None)
            weight = float(uw["weight"]) if uw else 0.0
            
            if weight == 0 or len(cat.get("questions", [])) == 0:
                continue
                
            cat_total = 0.0
            answered = 0
            for q_item in cat.get("questions", []):
                bd = next((a for a in answer_breakdowns if a["questionId"] == q_item["id"]), None)
                if bd:
                    cat_total += bd["optionScores"].get(opt["id"], 0.0)
                    answered += 1
                    
            if answered == 0:
                continue
                
            avg_score = cat_total / answered
            weighted_score = (weight / 100.0) * avg_score
            total_weighted_score += weighted_score
            total_used_weight += weight
            
            contributions.append({
                "categoryId": cat["id"],
                "name": cat.get("name", ""),
                "color": cat.get("color", ""),
                "icon": cat.get("icon", ""),
                "weight": weight,
                "avgScore": avg_score,
                "weightedScore": weighted_score,
                "shareOfTotal": 0.0
            })
            
        final_score = (total_weighted_score / (total_used_weight / 100.0)) if total_used_weight > 0 else 0.0
        for c in contributions:
            c["shareOfTotal"] = (c["weightedScore"] / total_weighted_score * 100.0) if total_weighted_score > 0 else 0.0
            
        raw_scores.append({
            "option": opt,
            "finalScore": final_score,
            "contributions": contributions,
            "rank": 0
        })
        
    raw_scores.sort(key=lambda x: x["finalScore"], reverse=True)
    for i, s in enumerate(raw_scores):
        s["rank"] = i + 1
        
    return {
        "scores": raw_scores,
        "answerBreakdowns": answer_breakdowns
    }

# ── Routes ─────────────────────────────────────────────────────────────────

@app.get("/")
async def health_check():
    return {"status": "ok"}

@app.get("/decisions")
async def list_decisions():
    db = get_pool()
    rows = await db.fetch(
        """
        SELECT id, name, created_at
        FROM decisions
        ORDER BY created_at DESC
        """
    )
    return [dict(row) for row in rows]

@app.get("/decisions/{decision_id}")
async def get_decision(decision_id: int):
    db = get_pool()
    decision = await db.fetchrow(
        """
        SELECT id, name, data, created_at
        FROM decisions
        WHERE id = $1
        """,
        decision_id,
    )
    if not decision:
        raise HTTPException(404, "Decision not found")
        
    return {
        "id": decision["id"],
        "name": decision["name"],
        "data": json.loads(decision["data"]),
        "created_at": decision["created_at"]
    }

@app.post("/decisions", status_code=201)
async def create_decision(body: DecisionCreateIn):
    db = get_pool()
    data_json = json.dumps(body.data)
    
    decision_id = await db.fetchval(
        """
        INSERT INTO decisions (name, data)
        VALUES ($1, $2)
        RETURNING id
        """,
        body.name,
        data_json,
    )
    return {"decision_id": decision_id}

@app.post("/submit")
async def submit_answers(body: SubmitAnswersIn):
    db = get_pool()
    
    decision = await db.fetchrow(
        "SELECT data FROM decisions WHERE id = $1",
        body.decision_id
    )
    
    if not decision:
        raise HTTPException(404, "Decision not found")
        
    q_data = json.loads(decision["data"])
    answers_dict = [a.model_dump() for a in body.answers]
    weights_dict = [w.model_dump() for w in body.weights]
    
    # Store session
    session_data = json.dumps({
        "answers": answers_dict,
        "weights": weights_dict
    })
    
    session_id = await db.fetchval(
        """
        INSERT INTO sessions (decision_id, answers)
        VALUES ($1, $2)
        RETURNING id
        """,
        body.decision_id,
        session_data
    )
    
    # Compute scores
    result = compute_scores(q_data, answers_dict, weights_dict)
    
    return {
        "session_id": session_id,
        "result": result
    }
