import os
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime

DATABASE_URL = os.environ.get("DATABASE_URL", "")

# Render gives a postgres:// URL — SQLAlchemy needs postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ─── Tables ────────────────────────────────────────────────────────────────

class DecisionModel(Base):
    """Stores a published questionnaire."""
    __tablename__ = "decisions"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String, nullable=False)
    data       = Column(Text, nullable=False)   # Questionnaire JSON
    created_at = Column(DateTime, default=datetime.utcnow)


class SessionModel(Base):
    """Stores one user's answers + scoring result for a decision."""
    __tablename__ = "sessions"

    id          = Column(Integer, primary_key=True, index=True)
    decision_id = Column(Integer, nullable=False)
    answers     = Column(Text, nullable=False)   # answers JSON
    weights     = Column(Text, nullable=False)   # weights JSON
    result      = Column(Text, nullable=False)   # ScoringResult JSON
    created_at  = Column(DateTime, default=datetime.utcnow)


def create_tables():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
