from sqlalchemy import (
    Column,
    Integer,
    Text,
    DateTime,
    func,
    ForeignKey,
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

class Decision(Base):
    __tablename__ = "decisions"

    id = Column(Integer, primary_key=True)
    name = Column(Text, nullable=False)
    data = Column(Text, nullable=False) # Stores the full JSON of the questionnaire
    created_at = Column(DateTime, default=func.now())

    sessions = relationship("Session", back_populates="decision", cascade="all, delete")

class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True)
    decision_id = Column(Integer, ForeignKey("decisions.id", ondelete="CASCADE"), nullable=False)
    answers = Column(Text, nullable=False) # Stores the full JSON of the answers/weights
    created_at = Column(DateTime, default=func.now())

    decision = relationship("Decision", back_populates="sessions")