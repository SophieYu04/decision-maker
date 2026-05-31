import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session as DBSession

from database import get_db, create_tables, DecisionModel, SessionModel
from schemas import (
    CreateDecisionRequest, CreateDecisionResponse,
    SubmitRequest, SubmitResponse,
    Questionnaire,
)
from scoring import compute_scores


# ─── Startup ───────────────────────────────────────────────────────────────
# lifespan replaces the deprecated @app.on_event("startup")

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    yield

app = FastAPI(title="Decision Maker API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health check ──────────────────────────────────────────────────────────

@app.get("/")
def health_check():
    return {"status": "ok"}


# ─── POST /decisions ───────────────────────────────────────────────────────
# Frontend calls this when a creator publishes a questionnaire.
# Saves the full Questionnaire JSON and returns a decision_id.

@app.post("/decisions", response_model=CreateDecisionResponse)
def create_decision(body: CreateDecisionRequest, db: DBSession = Depends(get_db)):
    decision = DecisionModel(
        name=body.name,
        data=body.data.model_dump_json(),
    )
    db.add(decision)
    db.commit()
    db.refresh(decision)
    return CreateDecisionResponse(decision_id=decision.id)


# ─── GET /decisions ────────────────────────────────────────────────────────
# Returns a list of all saved decisions (id + name).

@app.get("/decisions")
def list_decisions(db: DBSession = Depends(get_db)):
    decisions = db.query(DecisionModel).all()
    return [{"id": d.id, "name": d.name} for d in decisions]


# ─── GET /decisions/{decision_id} ─────────────────────────────────────────
# Frontend calls this when a user opens a shared link (?decision_id=42).
# Returns the Questionnaire JSON.

@app.get("/decisions/{decision_id}")
def get_decision(decision_id: int, db: DBSession = Depends(get_db)):
    decision = db.query(DecisionModel).filter(DecisionModel.id == decision_id).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
    return {"data": json.loads(decision.data)}


# ─── POST /submit ──────────────────────────────────────────────────────────
# Frontend calls this when a user finishes answering.
# Runs compute_scores() in Python, saves the session, returns the result.

@app.post("/submit", response_model=SubmitResponse)
def submit_answers(body: SubmitRequest, db: DBSession = Depends(get_db)):
    decision = db.query(DecisionModel).filter(DecisionModel.id == body.decision_id).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")

    questionnaire = Questionnaire(**json.loads(decision.data))

    # ── Run scoring logic ──────────────────────────────────────────────────
    # compute_scores() is the single source of truth for all scoring.
    # It lives in scoring.py and is shared with nothing else.
    result = compute_scores(questionnaire, body.answers, body.weights)

    # ── Persist session ────────────────────────────────────────────────────
    session = SessionModel(
        decision_id=body.decision_id,
        answers=json.dumps([a.model_dump() for a in body.answers]),
        weights=json.dumps([w.model_dump() for w in body.weights]),
        result=result.model_dump_json(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return SubmitResponse(session_id=session.id, result=result)


# ─── GET /sessions/{session_id} ───────────────────────────────────────────
# Retrieve a previously saved session result by id.

@app.get("/sessions/{session_id}", response_model=SubmitResponse)
def get_session(session_id: int, db: DBSession = Depends(get_db)):
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return SubmitResponse(
        session_id=session.id,
        result=json.loads(session.result),
    )
