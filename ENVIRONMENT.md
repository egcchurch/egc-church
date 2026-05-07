# Environment: church-website-pwa

> Everything needed to set up or recreate this project's environment from scratch.

---

## Python

| Item | Detail |
|---|---|
| Python version | <!-- e.g. 3.11.x --> |
| Package manager | uv |
| Virtual env location | `.venv\` (inside project root) |

---

## Setup From Scratch

```powershell
# 1. Clone or navigate to project
cd D:\coding\projects\church-website-pwa

# 2. Install dependencies (creates .venv automatically)
uv sync

# 3. Copy env file and fill in values
copy .env.example .env
# Edit .env with your values

# 4. Run the project
uv run python src/main.py
```

---

## Dependencies

> Managed by uv — do not edit pyproject.toml manually for adding packages.

```powershell
uv add package-name        # add a runtime dependency
uv add --dev package-name  # add a dev-only dependency
uv remove package-name     # remove a dependency
```

**Current key dependencies:**
<!-- List the main ones here for quick reference, full list is in pyproject.toml -->

| Package | Version | Purpose |
|---|---|---|
| <!-- package --> | <!-- version --> | <!-- what it does --> |

---

## VSCode Setup

When you open this project in VSCode:
1. Open the folder: `File > Open Folder > D:\coding\projects\church-website-pwa`
2. Select Python interpreter: `Ctrl+Shift+P` → "Python: Select Interpreter" → choose `.venv\Scripts\python.exe`
3. Settings are saved in `.vscode\settings.json`

---

## Environment Variables

Create a `.env` file in the project root (never commit this):

```env
# Copy this to .env and fill in values
# API_KEY=your_key_here
# DB_PATH=./data/database.db
# MODEL_NAME=codellama
```

---

## WSL Notes

<!-- Only fill in if this project interacts with WSL services -->

| Service | URL | Notes |
|---|---|---|
| Open WebUI | http://localhost:3000 | Start with: `docker start open-webui` |
| Ollama API | http://localhost:11434 | Start with: `sudo systemctl start ollama` |

---

## Known Issues / Quirks

<!-- Document anything weird about this environment -->

- 
