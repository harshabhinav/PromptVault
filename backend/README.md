# PromptVault — Version, Compare, Improve AI Prompts

PromptVault is a production-quality SaaS-style prompt ops platform designed to version control prompt blueprints, define test inputs variables, execute side-by-side prompt output comparisons concurrently, and analyze output latency/token variations using a Git-style prompt visualizer.

## Tech Stack

- **Frontend**: React, Vite, TypeScript, Tailwind CSS, TanStack Query, Axios, Framer Motion, Lucide Icons, Monaco Editor.
- **Backend**: FastAPI, SQLModel, SQLite, Python-dotenv, Anthropic Python SDK, HTTPX.

---

## Getting Started

### 1. Repository Layout

Ensure the workspace has the following structure:
```
promptvault/
├── backend/       # FastAPI project structure
└── frontend/      # React client project structure
```

### 2. Backend Setup

1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows (Powershell):
   .\venv\Scripts\activate
   ```
3. Install all dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` configuration file inside `backend/`:
   ```env
   DATABASE_URL=sqlite:///./promptvault.db
   PORT=8000
   HOST=127.0.0.1
   # Optional: Add your actual Anthropic API Key to trigger live Claude runs
   # ANTHROPIC_API_KEY=your-api-key-here
   ```
   > [!NOTE]
   > If no `ANTHROPIC_API_KEY` is supplied, the system automatically defaults to **Sandbox Mode**, simulating prompt completions and behavioral summaries locally.

5. Start the backend uvicorn dev server:
   ```bash
   python -m uvicorn app.main:app --port 8000 --reload
   ```
   *The SQLite database is initialized and seeded with mock blueprints, version nodes, and test inputs automatically on first run.*

---

### 3. Frontend Setup

1. Navigate to the frontend folder:
   ```bash
   cd ../frontend
   ```
2. Install the required Node packages:
   ```bash
   npm install
   ```
3. Start the Vite client dev server:
   ```bash
   npm run dev
   ```
4. Open the application in your browser:
   [http://localhost:3000](http://localhost:3000)

---

## Comparative Engine Operations (Under-the-Hood)

- **Concurrency**: Triggering `/api/compare` fires concurrent completion generations for all registered test inputs against both prompts using python `asyncio.gather()`.
- **Database Tracking**: All completions outputs, token counts, and latencies are recorded as `TestRun` records linked to their parent versions and inputs.
- **Behavioral Summary**: A final summary request compares version parameters and output sets, returning a 1-2 sentence overview of the structural differences.
- **Git-Style Diff**: Shows modifications, line additions (`+` in green), and line deletions (`-` in red) side-by-side inside the comparison visualizer.

---

## Keyboard Shortcuts

- **Ctrl/Cmd + S**: Save/Commit Version Node (Editor page)
- **Ctrl/Cmd + Enter**: Run Prompt Comparison (Compare page)
