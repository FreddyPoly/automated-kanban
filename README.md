# Automated Kanban (demo project)

A deliberately small kanban board — Angular frontend, FastAPI backend,
in-memory storage, no auth — used only to prove out an overnight automated
implementation pipeline before running it against a real project.

## Run locally

Backend:
```
cd backend
python3 -m venv venv
./venv/bin/python -m pip install -r requirements.txt
./venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

Frontend:
```
cd frontend
npm install
npm start   # serves on http://localhost:4200, expects the API on :8000
```

## What this is for

This repo is the test bed for a 5-skill development pipeline
(`interview` → `doc-to-issues` → `implement-issue` → `review-issue` → `qc`),
two of which (`implement-issue`, `review-issue`) get automated variants
that run unattended overnight. See `OVERNIGHT_WORKFLOW_SPEC.md` and the
skills under `.claude/skills/` once added.
