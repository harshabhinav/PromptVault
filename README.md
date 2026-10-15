# PromptVault — Save, Version & Compare AI Prompts Anywhere

**Capture prompts from your AI agents. Organize, version, and improve them in one workspace.**

PromptVault is a prompt management platform that brings version control to AI prompts. Create reusable prompt blueprints, track revisions, compare outputs, inspect Git-style diffs, and save prompts directly from supported AI websites using the PromptVault browser extension.

## ✨ Features

- **Browser Extension:** Save prompts from supported AI websites and use Quick Save to store them in a dedicated blueprint.
- **Blueprint Management:** Organize prompts, add descriptions, pin favorites, search, and fork existing blueprints.
- **Version Control:** Save revisions as V1, V2, V3, and review previous versions with optional commit messages.
- **Side-by-Side Comparison:** Compare prompt versions using consistent test inputs and inspect their outputs.
- **Git-Style Diff:** Identify added and removed lines between prompt revisions.
- **Testing & Evaluation:** Create test cases, evaluate prompts, and review available execution metrics.
- **AI-Assisted Workflows:** Generate, improve, and evaluate prompts through configured AI providers.
- **Dashboard & Activity:** Track versions, comparisons, evaluation scores, regression warnings, and recent activity.
- **Authentication:** Backend-managed accounts, email verification, and user-specific data access.

*AI features and browser integration depend on the configured providers, backend, and installed extension version.*

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS |
| Data Fetching | TanStack Query, Axios |
| Backend | Python, FastAPI |
| Database & ORM | PostgreSQL, SQLModel, SQLAlchemy |
| Migrations | Alembic |
| AI Integration | Anthropic SDK, where configured |
| Authentication | Password hashing, JWT |
| Browser Extension | Chrome Extension APIs |

## 🏗️ Project Structure

```text
PromptVault/
├── frontend/       # React application and dashboard
├── backend/        # FastAPI, authentication and database
└── extension/      # Browser-based prompt capture
```

## 🚀 Getting Started

### Prerequisites

- Python 3.11 or a compatible version
- Node.js and npm
- PostgreSQL

### 1. Clone the repository

```bash
git clone https://github.com/harshabhinav/PromptVault.git
cd PromptVault
```

### 2. Set up the backend

```bash
cd backend
python -m venv venv
```

Activate the virtual environment, then install dependencies:

```bash
# Windows PowerShell
.\venv\Scripts\Activate.ps1

pip install -r requirements.txt
```

Create a `backend/.env` file using the environment variable names supported by the project. For example:

```env
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE
JWT_SECRET=your-secure-secret
FRONTEND_URL=http://localhost:3000
```

Add AI provider and email configuration if required by your setup. Never commit secrets or `.env` files.

### 3. Apply database migrations

From the directory containing `alembic.ini`:

```bash
alembic upgrade head
```

Ensure PostgreSQL is running and `DATABASE_URL` points to the correct database.

### 4. Start the backend

From `backend/`:

```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

API documentation: `http://127.0.0.1:8000/docs`

### 5. Start the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL displayed by Vite. If configured for port 3000, visit `http://localhost:3000`.

## 🧪 Testing

Run the available backend tests:

```bash
pytest
```

Build the frontend:

```bash
cd frontend
npm run build
```

For complete validation, test database migrations, authentication, version saving, prompt comparisons, user data isolation, and browser extension saving.

## 🗺️ Roadmap

- Additional AI provider integrations
- Advanced evaluation and regression analysis
- Prompt export and import
- Team workspaces and collaboration

## 🤝 Contributing

Contributions, bug reports, and feature suggestions are welcome. Fork the repository, create a feature branch, test your changes, and submit a pull request.

## 👨‍💻 Author

**Harsh Abhinav**

- GitHub: [@harshabhinav](https://github.com/harshabhinav)
- Repository: [PromptVault](https://github.com/harshabhinav/PromptVault)

---

**PromptVault — Save anywhere. Version every change. Compare with confidence.**
