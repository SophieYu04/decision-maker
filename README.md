# DecideIQ — Quantifying Your Preferences

> **Personalized decision scoring — your weights, your results.**

A structured decision-making framework that helps people evaluate choices rationally by quantifying personal preferences across user-defined categories. Built with a 2024 Taiwan presidential election case study.

🔗 **Live demo:** [decision-maker-puce.vercel.app](https://decision-maker-puce.vercel.app)

---

## How It Works

The app has two roles: **Creator** and **Respondent**.

### Creator side

1. **Define categories** — Create thematic groupings for comparison (e.g. foreign policy, economic growth, social welfare).
2. **Design questions** — Write MCQ or 1–10 spectrum questions within each category, and map each answer to a score for each option.

### Respondent side

3. **Answer questions** — Respond to MCQ or slider-based questions.
4. **Assign weights** — Drag a pie chart or use sliders to prioritize how much each category matters to you.
5. **View results** — Options are ranked by weighted score based on your answers and priorities.

Creators receive a shareable questionnaire ID so anyone can take their custom questionnaire.

---

## Architecture

```
Browser
  └── Vercel
        └── React (TypeScript) — Frontend SPA
              │ HTTP / JSON
        └── Render
              └── FastAPI (Python) — Backend
                    │ SQLAlchemy
              └── PostgreSQL — Database
```

- **Frontend:** Figma → React (TypeScript), deployed on Vercel
- **Backend:** Python + FastAPI, deployed on Render
- **Database:** PostgreSQL via SQLAlchemy ORM

---

## Project Structure

```
decision-maker/
├── frontend/       # React + TypeScript SPA
└── backend/        # Python FastAPI server
```
---

## Tech Stack

| Layer    | Technology               |
|----------|--------------------------|
| Frontend | React, TypeScript        |
| Backend  | Python, FastAPI          |
| ORM      | SQLAlchemy               |
| Database | PostgreSQL               |
| Hosting  | Vercel (FE), Render (BE) |

---

## Test Data

Election bulletin questionnaire data (https://bulletin.cec.gov.tw/01選舉公報/01總統副總統/113年第16任總統副總統.pdf) collected by 黃旭辰.
