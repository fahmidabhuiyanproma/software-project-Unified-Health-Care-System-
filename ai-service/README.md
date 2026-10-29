# SynCura AI Service

Internal Flask microservice powering the Patient Portal's "AI Consultation"
page. Not browser-facing — the Laravel backend proxies
`/api/patient/ai-consultation/*` to this service server-to-server
(see `backend/app/Http/Controllers/Patient/AIConsultationController.php`).

Ported from a standalone disease-prediction chatbot project: five
scikit-learn/XGBoost classifiers trained at startup on `Data/Training.csv`,
driving a multi-step symptom-extraction and follow-up-question flow.

## Setup (first time)

```
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt      # Windows
.venv/bin/pip install -r requirements.txt           # macOS/Linux
```

## Run

```
.venv\Scripts\python app.py      # Windows
.venv/bin/python app.py           # macOS/Linux
```

Listens on `http://127.0.0.1:5000`. `run.bat` at the project root starts
this automatically alongside MySQL, the Laravel backend, and the React
frontend.

## Endpoints

- `GET /health` — readiness check
- `GET /api/models` — train/test accuracy for all 5 models
- `POST /api/chat` — drives the `welcome` -> `symptoms` -> `refinement`* -> `complete` conversation

Model training data, disclaimers, and dataset limitations are documented
in the original project this was ported from — this is a decision-support
demo, not a validated clinical tool.
