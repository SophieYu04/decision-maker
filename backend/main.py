import json
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session as DBSession

from database import get_db, create_tables, Decision, Session
from schemas import (
    CreateDecisionRequest, CreateDecisionResponse,
    SubmitRequest, SubmitResponse,
    Questionnaire,
)
from scoring import compute_scores

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    create_tables()


@app.post("/admin/init-db")
def init_db():
    """Manually trigger table creation — call once if tables are missing."""
    create_tables()
    return {"status": "tables created"}


# ─── POST /decisions ───────────────────────────────────────────────────────
# Front end calls this when a creator publishes a questionnaire.
# Saves the full Questionnaire JSON and returns a decision_id.

@app.post("/decisions", response_model=CreateDecisionResponse)
def create_decision(body: CreateDecisionRequest, db: DBSession = Depends(get_db)):
    decision = Decision(
        name=body.name,
        data=body.data.model_dump_json(),
    )
    db.add(decision)
    db.commit()
    db.refresh(decision)
    return CreateDecisionResponse(decision_id=decision.id)


# ─── GET /decisions/{decision_id} ─────────────────────────────────────────
# Front end calls this when a user opens a shared link (?decision_id=42).
# Returns the Questionnaire JSON.

@app.get("/decisions/{decision_id}")
def get_decision(decision_id: int, db: DBSession = Depends(get_db)):
    decision = db.query(Decision).filter(Decision.id == decision_id).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
    return {"data": json.loads(decision.data)}


# ─── POST /submit ──────────────────────────────────────────────────────────
# Front end calls this when a user finishes answering.
# Runs compute_scores() in Python, saves the result, returns it.

@app.post("/submit", response_model=SubmitResponse)
def submit_answers(body: SubmitRequest, db: DBSession = Depends(get_db)):
    # Load questionnaire
    decision = db.query(Decision).filter(Decision.id == body.decision_id).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")

    questionnaire = Questionnaire(**json.loads(decision.data))

    # ── Run scoring logic (Python) ──
    result = compute_scores(questionnaire, body.answers, body.weights)

    # Save session
    session = Session(
        decision_id=body.decision_id,
        answers=json.dumps([a.model_dump() for a in body.answers]),
        weights=json.dumps([w.model_dump() for w in body.weights]),
        result=result.model_dump_json(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return SubmitResponse(session_id=session.id, result=result)
