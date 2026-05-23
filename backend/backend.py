from __future__ import annotations

import json
from typing import Any, List, Dict, Union

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── FastAPI app ─────────────────────────────────────────────────────────────

app = FastAPI(title="Decision Maker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Hardcoded questionnaire data ────────────────────────────────────────────

TAIWAN_PARTY_QUESTIONNAIRE = {
    "id": 1,
    "name": "2026 台灣政黨傾向問卷",
    "data": {
        "options": [
            {"id": "tpp", "label": "民眾黨"},
            {"id": "dpp", "label": "民進黨"},
            {"id": "kmt", "label": "國民黨"}
        ],
        "categories": [
            {
                "id": "cross_strait_security",
                "name": "兩岸／國家安全",
                "color": "#2563eb",
                "icon": "shield",
                "questions": [
                    {
                        "id": "q1",
                        "text": "你認為台灣目前最重要的兩岸策略應該是？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q1_a", "label": "維持對等務實交流", "optionScores": {"tpp": 5}},
                            {"id": "q1_b", "label": "強化民主同盟與國際合作", "optionScores": {"dpp": 5}},
                            {"id": "q1_c", "label": "恢復九二共識與深化交流", "optionScores": {"kmt": 5}}
                        ]
                    },
                    {
                        "id": "q2",
                        "text": "你是否支持增加兩岸民間交流？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q2_a", "label": "應大幅開放陸客與陸生", "optionScores": {"kmt": 5}},
                            {"id": "q2_b", "label": "可逐步恢復交流", "optionScores": {"tpp": 5}},
                            {"id": "q2_c", "label": "應謹慎控管", "optionScores": {"dpp": 5}}
                        ]
                    },
                    {
                        "id": "q3",
                        "text": "面對中國威脅，台灣應優先？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q3_a", "label": "提升國際聯盟與嚇阻能力", "optionScores": {"dpp": 5}},
                            {"id": "q3_b", "label": "降低衝突風險與增加對話", "optionScores": {"kmt": 5}},
                            {"id": "q3_c", "label": "備戰但維持溝通", "optionScores": {"tpp": 5}}
                        ]
                    }
                ]
            },
            {
                "id": "defense_diplomacy",
                "name": "國防／外交",
                "color": "#7c3aed",
                "icon": "globe",
                "questions": [
                    {
                        "id": "q4",
                        "text": "對於國防預算，你的看法是？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q4_a", "label": "支持提升至 GDP 3% 左右", "optionScores": {"tpp": 5}},
                            {"id": "q4_b", "label": "支持提升軍力但避免刺激衝突", "optionScores": {"kmt": 5}},
                            {"id": "q4_c", "label": "支持強化國防與供應鏈安全", "optionScores": {"dpp": 5}}
                        ]
                    },
                    {
                        "id": "q5",
                        "text": "台灣外交應該偏向？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q5_a", "label": "以經貿與和平為優先", "optionScores": {"kmt": 5}},
                            {"id": "q5_b", "label": "民主國家合作聯盟", "optionScores": {"dpp": 5}},
                            {"id": "q5_c", "label": "務實多邊平衡外交", "optionScores": {"tpp": 5}}
                        ]
                    },
                    {
                        "id": "q6",
                        "text": "你認為台灣應該優先加入哪些國際合作？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q6_a", "label": "多邊區域合作", "optionScores": {"tpp": 5}},
                            {"id": "q6_b", "label": "以經貿整合為優先", "optionScores": {"kmt": 5}},
                            {"id": "q6_c", "label": "民主與印太聯盟", "optionScores": {"dpp": 5}}
                        ]
                    }
                ]
            },
            {
                "id": "energy_environment",
                "name": "能源／環境",
                "color": "#16a34a",
                "icon": "leaf",
                "questions": [
                    {
                        "id": "q7",
                        "text": "你認為核能應該？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q7_a", "label": "逐步減少依賴", "optionScores": {"dpp": 5}},
                            {"id": "q7_b", "label": "延役並重新啟用核電", "optionScores": {"kmt": 5}},
                            {"id": "q7_c", "label": "作為過渡能源", "optionScores": {"tpp": 5}}
                        ]
                    },
                    {
                        "id": "q8",
                        "text": "政府應如何推動淨零轉型？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q8_a", "label": "核能與低碳並行", "optionScores": {"kmt": 5}},
                            {"id": "q8_b", "label": "碳定價與能源多元化", "optionScores": {"tpp": 5}},
                            {"id": "q8_c", "label": "綠能與產業轉型", "optionScores": {"dpp": 5}}
                        ]
                    },
                    {
                        "id": "q9",
                        "text": "你是否支持碳費／碳定價？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q9_a", "label": "支持但應平衡產業負擔", "optionScores": {"tpp": 5}},
                            {"id": "q9_b", "label": "強烈支持", "optionScores": {"dpp": 5}},
                            {"id": "q9_c", "label": "不應增加企業負擔", "optionScores": {"kmt": 5}}
                        ]
                    },
                    {
                        "id": "q10",
                        "text": "台灣能源政策應優先考量？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q10_a", "label": "電價與供電安全", "optionScores": {"kmt": 5}},
                            {"id": "q10_b", "label": "減碳與綠能發展", "optionScores": {"dpp": 5}},
                            {"id": "q10_c", "label": "能源穩定與多元配置", "optionScores": {"tpp": 5}}
                        ]
                    }
                ]
            },
            {
                "id": "housing_justice",
                "name": "居住正義",
                "color": "#ea580c",
                "icon": "home",
                "questions": [
                    {
                        "id": "q11",
                        "text": "你認為解決高房價最有效的方法是？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q11_a", "label": "青年低利貸款", "optionScores": {"kmt": 5}},
                            {"id": "q11_b", "label": "稅制改革與社宅並行", "optionScores": {"tpp": 5}},
                            {"id": "q11_c", "label": "社宅與租金補貼", "optionScores": {"dpp": 5}}
                        ]
                    },
                    {
                        "id": "q12",
                        "text": "政府住宅政策應優先？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q12_a", "label": "擴大租屋保障", "optionScores": {"dpp": 5}},
                            {"id": "q12_b", "label": "協助青年買房", "optionScores": {"kmt": 5}},
                            {"id": "q12_c", "label": "提供多元居住補助", "optionScores": {"tpp": 5}}
                        ]
                    }
                ]
            },
            {
                "id": "education",
                "name": "教育",
                "color": "#0891b2",
                "icon": "book",
                "questions": [
                    {
                        "id": "q13",
                        "text": "教育改革應優先推動？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q13_a", "label": "AI 與雙語教育", "optionScores": {"tpp": 5}},
                            {"id": "q13_b", "label": "檢討 108 課綱與教育補助", "optionScores": {"kmt": 5}},
                            {"id": "q13_c", "label": "高教國際化與技職", "optionScores": {"dpp": 5}}
                        ]
                    },
                    {
                        "id": "q14",
                        "text": "你是否支持延長義務教育？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q14_a", "label": "應先改善現行制度", "optionScores": {"kmt": 5}},
                            {"id": "q14_b", "label": "支持 13 年一貫教育", "optionScores": {"tpp": 5}},
                            {"id": "q14_c", "label": "應提升教育品質為主", "optionScores": {"dpp": 5}}
                        ]
                    },
                    {
                        "id": "q15",
                        "text": "政府應如何提升學生競爭力？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q15_a", "label": "強化國際化與創新能力", "optionScores": {"dpp": 5}},
                            {"id": "q15_b", "label": "增加教育資源與補助", "optionScores": {"kmt": 5}},
                            {"id": "q15_c", "label": "導入 AI 與智慧教育", "optionScores": {"tpp": 5}}
                        ]
                    }
                ]
            },
            {
                "id": "welfare_health_aging",
                "name": "社會福利／醫療／高齡化",
                "color": "#dc2626",
                "icon": "heart",
                "questions": [
                    {
                        "id": "q16",
                        "text": "少子化政策應優先？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q16_a", "label": "提高生育與育兒補助", "optionScores": {"tpp": 5}},
                            {"id": "q16_b", "label": "擴大公共托育", "optionScores": {"dpp": 5}},
                            {"id": "q16_c", "label": "提供家庭購屋支持", "optionScores": {"kmt": 5}}
                        ]
                    },
                    {
                        "id": "q17",
                        "text": "你認為長照政策應該？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q17_a", "label": "針對高齡者直接補助", "optionScores": {"kmt": 5}},
                            {"id": "q17_b", "label": "成立專責保險制度", "optionScores": {"tpp": 5}},
                            {"id": "q17_c", "label": "擴大社會照護網", "optionScores": {"dpp": 5}}
                        ]
                    },
                    {
                        "id": "q18",
                        "text": "健保與醫療政策應優先？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q18_a", "label": "提升醫療支出與市場彈性", "optionScores": {"tpp": 5}},
                            {"id": "q18_b", "label": "增加老人福利與癌症補助", "optionScores": {"kmt": 5}},
                            {"id": "q18_c", "label": "強化醫護環境與健保永續", "optionScores": {"dpp": 5}}
                        ]
                    },
                    {
                        "id": "q19",
                        "text": "政府應如何改善高齡社會問題？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q19_a", "label": "強化照護與社福系統", "optionScores": {"dpp": 5}},
                            {"id": "q19_b", "label": "發展高齡經濟產業", "optionScores": {"tpp": 5}},
                            {"id": "q19_c", "label": "增加長者補助與福利", "optionScores": {"kmt": 5}}
                        ]
                    }
                ]
            },
            {
                "id": "economy_labor_tech",
                "name": "經濟／勞工／科技",
                "color": "#4f46e5",
                "icon": "cpu",
                "questions": [
                    {
                        "id": "q20",
                        "text": "政府應如何促進經濟發展？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q20_a", "label": "減稅鼓勵企業投資", "optionScores": {"kmt": 5}},
                            {"id": "q20_b", "label": "發展高科技與數位轉型", "optionScores": {"dpp": 5}},
                            {"id": "q20_c", "label": "鬆綁法規刺激產業", "optionScores": {"tpp": 5}}
                        ]
                    },
                    {
                        "id": "q21",
                        "text": "你認為勞工政策應偏向？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q21_a", "label": "強化勞權與最低工資", "optionScores": {"dpp": 5}},
                            {"id": "q21_b", "label": "增加薪資誘因與休假", "optionScores": {"kmt": 5}},
                            {"id": "q21_c", "label": "平衡勞資與產業活化", "optionScores": {"tpp": 5}}
                        ]
                    },
                    {
                        "id": "q22",
                        "text": "AI 與科技政策應該？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q22_a", "label": "發展戰略 AI 產業", "optionScores": {"kmt": 5}},
                            {"id": "q22_b", "label": "建立智慧城市與 AI 校園", "optionScores": {"tpp": 5}},
                            {"id": "q22_c", "label": "推動 AI 產業化", "optionScores": {"dpp": 5}}
                        ]
                    },
                    {
                        "id": "q23",
                        "text": "你認為政府應如何協助企業？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q23_a", "label": "鬆綁法規與活化市場", "optionScores": {"tpp": 5}},
                            {"id": "q23_b", "label": "提供減稅與投資誘因", "optionScores": {"kmt": 5}},
                            {"id": "q23_c", "label": "協助產業轉型", "optionScores": {"dpp": 5}}
                        ]
                    }
                ]
            },
            {
                "id": "diversity_culture_ethnicity",
                "name": "多元／文化／族群",
                "color": "#db2777",
                "icon": "users",
                "questions": [
                    {
                        "id": "q24",
                        "text": "政府應如何推動性別與多元政策？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q24_a", "label": "著重族群制度保障", "optionScores": {"kmt": 5}},
                            {"id": "q24_b", "label": "強化性平與同志權益", "optionScores": {"dpp": 5}},
                            {"id": "q24_c", "label": "去標籤化與多元共融", "optionScores": {"tpp": 5}}
                        ]
                    },
                    {
                        "id": "q25",
                        "text": "文化政策應優先？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q25_a", "label": "推動世代共融文化", "optionScores": {"tpp": 5}},
                            {"id": "q25_b", "label": "補助青年與地方藝文", "optionScores": {"kmt": 5}},
                            {"id": "q25_c", "label": "發展台灣文化產業", "optionScores": {"dpp": 5}}
                        ]
                    },
                    {
                        "id": "q26",
                        "text": "政府應如何推動族群政策？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q26_a", "label": "建立多元共榮社會", "optionScores": {"dpp": 5}},
                            {"id": "q26_b", "label": "強化原民與客家制度保障", "optionScores": {"kmt": 5}},
                            {"id": "q26_c", "label": "推動族群平等與正名", "optionScores": {"tpp": 5}}
                        ]
                    }
                ]
            },
            {
                "id": "governance_security_local",
                "name": "政府治理／治安／地方治理",
                "color": "#64748b",
                "icon": "building",
                "questions": [
                    {
                        "id": "q27",
                        "text": "你認為政府應優先改善？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q27_a", "label": "政治制度改革與監督", "optionScores": {"tpp": 5}},
                            {"id": "q27_b", "label": "打詐與掃黑犯罪", "optionScores": {"kmt": 5}},
                            {"id": "q27_c", "label": "社會安全網與制度透明", "optionScores": {"dpp": 5}}
                        ]
                    },
                    {
                        "id": "q28",
                        "text": "你支持哪種政府治理方向？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q28_a", "label": "強化執法與行政效率", "optionScores": {"kmt": 5}},
                            {"id": "q28_b", "label": "公開透明與公民參與", "optionScores": {"dpp": 5}},
                            {"id": "q28_c", "label": "憲政改革與權力制衡", "optionScores": {"tpp": 5}}
                        ]
                    },
                    {
                        "id": "q29",
                        "text": "你認為地方治理應優先？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q29_a", "label": "地方財政自主", "optionScores": {"tpp": 5}},
                            {"id": "q29_b", "label": "區域均衡與地方創生", "optionScores": {"dpp": 5}},
                            {"id": "q29_c", "label": "中央整合與資源分配", "optionScores": {"kmt": 5}}
                        ]
                    }
                ]
            },
            {
                "id": "core_values",
                "name": "核心價值總結",
                "color": "#111827",
                "icon": "flag",
                "questions": [
                    {
                        "id": "q30",
                        "text": "你認為台灣未來最重要的核心價值是？",
                        "type": "multiple_choice",
                        "choices": [
                            {"id": "q30_a", "label": "穩定和平與經濟發展", "optionScores": {"kmt": 5}},
                            {"id": "q30_b", "label": "務實治理與制度改革", "optionScores": {"tpp": 5}},
                            {"id": "q30_c", "label": "民主與國際連結", "optionScores": {"dpp": 5}}
                        ]
                    }
                ]
            }
        ]
    }
}

# ── Pydantic schemas ────────────────────────────────────────────────────────

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

# ── Routes ──────────────────────────────────────────────────────────────────

@app.get("/")
async def health_check():
    return {"status": "ok"}

@app.get("/decisions")
async def list_decisions():
    return [{"id": 1, "name": TAIWAN_PARTY_QUESTIONNAIRE["name"]}]

@app.get("/decisions/{decision_id}")
async def get_decision(decision_id: int):
    if decision_id != 1:
        raise HTTPException(404, "Decision not found")
    return TAIWAN_PARTY_QUESTIONNAIRE

@app.post("/submit")
async def submit_answers(body: SubmitAnswersIn):
    if body.decision_id != 1:
        raise HTTPException(404, "Decision not found")

    q_data = TAIWAN_PARTY_QUESTIONNAIRE["data"]
    answers_dict = [a.model_dump() for a in body.answers]
    weights_dict = [w.model_dump() for w in body.weights]

    result = compute_scores(q_data, answers_dict, weights_dict)

    return {
        "session_id": None,
        "result": result
    }