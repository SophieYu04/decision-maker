from schemas import (
    Questionnaire, Answer, UserWeight,
    SliderMapping, Question,
    ScoringResult, OptionScore, CategoryContribution, AnswerBreakdown,
)


# ─── Slider scoring ────────────────────────────────────────────────────────

def get_slider_scores(mapping: SliderMapping, value: float) -> dict[str, float]:
    """
    value 1–10:
      left option  → scores 10 at value=1, 0 at value=10
      right option → scores 0 at value=1, 10 at value=10
      middle option (optional) → inverted-V curve, peaks at centre of middleRange
    """
    t = (value - 1) / 9          # 0.0 → 1.0
    left_score  = round((1 - t) * 10, 2)
    right_score = round(t * 10, 2)

    result: dict[str, float] = {}
    result[mapping.leftOptionId] = left_score
    if mapping.rightOptionId != mapping.leftOptionId:
        result[mapping.rightOptionId] = right_score

    if mapping.middleOptionId and mapping.middleRange:
        lo, hi   = mapping.middleRange
        mid      = (lo + hi) / 2
        max_dist = max(mid - 1, 10 - mid)
        dist     = abs(value - mid)
        middle_score = round(max(0.0, (1 - dist / max_dist) * 10), 2)
        result[mapping.middleOptionId] = middle_score

    return result


# ─── Per-question scores ───────────────────────────────────────────────────

def get_question_option_scores(question: Question, answer: Answer) -> dict[str, float]:
    """Return {optionId: score} for one answered question."""
    if question.type == "multiple_choice":
        choice = next((c for c in question.choices if c.id == answer.value), None)
        return dict(choice.optionScores) if choice else {}

    # Slider
    raw_val = answer.value
    value = float(raw_val) if not isinstance(raw_val, float) else raw_val
    if question.sliderMapping:
        return get_slider_scores(question.sliderMapping, value)
    return {}


# ─── Main scoring function ─────────────────────────────────────────────────

def compute_scores(
    questionnaire: Questionnaire,
    answers: list[Answer],
    weights: list[UserWeight],
) -> ScoringResult:
    """
    Mirrors computeScores() in QuestionnaireContext.tsx.

    Steps:
    1. Build answer_breakdowns: one entry per answered question
       showing which options got how many points.
    2. For each option, loop over categories:
       - category score = average raw score across answered questions
       - weighted score = (category_weight / 100) * avg_score
    3. final_score = total_weighted / (total_used_weight / 100)
    4. Sort options by final_score descending, assign ranks.
    """

    # ── Step 1: answer breakdowns ──────────────────────────────────────────
    answer_map = {a.questionId: a for a in answers}

    answer_breakdowns: list[AnswerBreakdown] = []
    for cat in questionnaire.categories:
        for question in cat.questions:
            ans = answer_map.get(question.id)
            if ans is None:
                continue

            # Human-readable label
            if question.type == "multiple_choice":
                choice = next((c for c in question.choices if c.id == ans.value), None)
                answer_label = choice.label if choice else str(ans.value)
            else:
                val = float(ans.value)
                answer_label = f"Slider → {val:.1f}/10"

            answer_breakdowns.append(AnswerBreakdown(
                questionId=question.id,
                questionText=question.text,
                type=question.type,
                categoryId=cat.id,
                categoryName=cat.name,
                categoryColor=cat.color,
                optionScores=get_question_option_scores(question, ans),
                answerLabel=answer_label,
            ))

    breakdown_map = {bd.questionId: bd for bd in answer_breakdowns}

    # ── Step 2 & 3: score each option ─────────────────────────────────────
    weight_map = {w.categoryId: w.weight for w in weights}

    raw_scores: list[OptionScore] = []
    for opt in questionnaire.options:
        total_weighted_score = 0.0
        total_used_weight    = 0.0
        contributions: list[CategoryContribution] = []

        for cat in questionnaire.categories:
            weight = weight_map.get(cat.id, 0.0)
            if weight == 0 or len(cat.questions) == 0:
                continue

            cat_total = 0.0
            answered  = 0
            for q_item in cat.questions:
                bd = breakdown_map.get(q_item.id)
                if bd:
                    cat_total += bd.optionScores.get(opt.id, 0.0)
                    answered  += 1

            if answered == 0:
                continue

            avg_score      = cat_total / answered
            weighted_score = (weight / 100) * avg_score
            total_weighted_score += weighted_score
            total_used_weight    += weight

            contributions.append(CategoryContribution(
                categoryId=cat.id,
                name=cat.name,
                color=cat.color,
                icon=cat.icon,
                weight=weight,
                avgScore=avg_score,
                weightedScore=weighted_score,
                shareOfTotal=0.0,  # filled in below
            ))

        # final score normalised back to 0–10 scale
        final_score = (
            total_weighted_score / (total_used_weight / 100)
            if total_used_weight > 0 else 0.0
        )

        # share of total for each category contribution
        for c in contributions:
            c.shareOfTotal = (
                (c.weightedScore / total_weighted_score) * 100
                if total_weighted_score > 0 else 0.0
            )

        raw_scores.append(OptionScore(
            option=opt,
            finalScore=final_score,
            contributions=contributions,
            rank=0,  # assigned below
        ))

    # ── Step 4: sort and rank ──────────────────────────────────────────────
    raw_scores.sort(key=lambda s: s.finalScore, reverse=True)
    for i, s in enumerate(raw_scores):
        s.rank = i + 1

    return ScoringResult(scores=raw_scores, answerBreakdowns=answer_breakdowns)
