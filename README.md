# church-website-pwa

<!-- One sentence description of what this project does -->

---

## What It Does

<!-- 2-3 sentences. What problem does it solve? Who is it for? -->

---

## Getting Started

### Prerequisites

- Windows 11
- Python (via uv)
- uv installed: `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`

### Setup

```powershell
cd D:\coding\projects\church-website-pwa
uv sync
copy .env.example .env
# Edit .env with your values
```

### Run

```powershell
uv run python src/main.py
```

---

## Project Structure

```
church-website-pwa\
├── src\            ← source code
├── tests\          ← tests
├── docs\           ← documentation
└── README.md       ← you are here
```

---

## Notes

<!-- Anything else worth knowing -->
