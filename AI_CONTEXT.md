# Project: church-website-pwa

> Paste this file (along with GLOBAL_CONTEXT.md and PROGRESS.md) at the start of any AI session.

---

## Purpose

<!-- One paragraph: what does this project do and why does it exist? -->

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Python x.xx |
| Framework | <!-- e.g. FastAPI, Flask, none --> |
| Key Libraries | <!-- e.g. OpenCV, SQLite, Requests --> |
| Environment | uv + .venv |
| Runs on | Windows 11 / WSL (delete as applicable) |

---

## Project Structure

```
project-root\
├── src\            ← all source code
├── tests\          ← tests mirror src structure
├── docs\           ← specs, diagrams, notes
├── .venv\          ← managed by uv (do not edit)
├── pyproject.toml  ← dependencies (managed by uv)
├── uv.lock         ← exact locked versions (do not edit)
├── .env            ← secrets and config (never commit)
└── README.md
```

---

## Key Files

| File | Purpose |
|---|---|
| `src/main.py` | <!-- entry point description --> |
| <!-- add more --> | |

---

## Architecture / Design Decisions

<!-- Explain key decisions already made so AI does not suggest alternatives -->
<!-- Example: "Using SQLite not PostgreSQL because this runs offline" -->

- 

---

## Current Goal

<!-- What are you actively trying to build RIGHT NOW in this session? -->

---

## Constraints & Rules

<!-- Things the AI must NOT change or suggest changing -->

- Do not change the folder structure without asking
- Do not switch package manager away from uv
- <!-- add project-specific constraints -->

---

## Environment Variables (.env)

<!-- List keys but NOT values -->

```
# Example:
# API_KEY=
# DB_PATH=
# MODEL_NAME=
```

---

## How to Run

```powershell
# From project root in PowerShell:
cd D:\coding\projects\church-website-pwa
uv sync
uv run python src/main.py
```
