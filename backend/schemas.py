from pydantic import BaseModel
from typing import Optional, Union


# ─── Questionnaire structure (mirrors TypeScript interfaces) ───────────────

class Choice(BaseModel):
    id: str
    label: str
    optionScores: dict[str, float]  # optionId → score 0–10


class SliderMapping(BaseModel):
    leftOptionId: str
    rightOptionId: str
    leftLabel: str
    rightLabel: str
    middleOptionId: Optional[str] = None
    middleRange: Optional[list[float]] = None  # e.g. [4, 6]


class Question(BaseModel):
    id: str
    categoryId: str
    text: str
    type: str  # 'multiple_choice' | 'slider'
    choices: list[Choice]
    sliderMapping: Optional[SliderMapping] = None


class Category(BaseModel):
    id: str
    name: str
    color: str
    icon: str
    questions: list[Question]


class QOption(BaseModel):
    id: str
    name: str
    color: str
    initials: str


class UserWeight(BaseModel):
    categoryId: str
    weight: float


class Questionnaire(BaseModel):
    title: str
    description: str
    purpose: str
    options: list[QOption]
    categories: list[Category]
    defaultWeights: list[UserWeight]


# ─── API request / response bodies ────────────────────────────────────────

class Answer(BaseModel):
    questionId: str
    value: Union[str, float]  # choiceId (MC) or 1–10 (slider)


class CreateDecisionRequest(BaseModel):
    name: str
    data: Questionnaire


class CreateDecisionResponse(BaseModel):
    decision_id: int


class SubmitRequest(BaseModel):
    decision_id: int
    answers: list[Answer]
    weights: list[UserWeight]


# ─── Scoring result (mirrors TypeScript ScoringResult) ────────────────────

class CategoryContribution(BaseModel):
    categoryId: str
    name: str
    color: str
    icon: str
    weight: float
    avgScore: float
    weightedScore: float
    shareOfTotal: float


class AnswerBreakdown(BaseModel):
    questionId: str
    questionText: str
    type: str
    categoryId: str
    categoryName: str
    categoryColor: str
    optionScores: dict[str, float]
    answerLabel: str


class OptionScore(BaseModel):
    option: QOption
    finalScore: float
    contributions: list[CategoryContribution]
    rank: int


class ScoringResult(BaseModel):
    scores: list[OptionScore]
    answerBreakdowns: list[AnswerBreakdown]


class SubmitResponse(BaseModel):
    session_id: int
    result: ScoringResult
