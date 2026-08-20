import os
from dotenv import load_dotenv
load_dotenv()

from datetime import datetime
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from app.database.connection import init_db, engine
from app.models.blueprint import Blueprint
from app.models.version import Version
from app.models.test_case import TestCase
from app.routes.blueprints import router as blueprints_router
from app.routes.versions import router as versions_router
from app.routes.test_cases import router as test_cases_router
from app.routes.test_runs import router as test_runs_router
from app.routes.compare import router as compare_router
from app.routes.dashboard import router as dashboard_router
from app.routes.playground import router as playground_router
from app.routes.settings import router as settings_router
from app.routes.auth import router as auth_router
from app.routes.extension import router as extension_router

app = FastAPI(
    title="PromptVault REST API",
    description="Backend services for Versioning, Comparing, and Improving AI Prompts.",
    version="1.0.0"
)

# CORS Configuration
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
)

@app.on_event("startup")
def on_startup():
    print("Initializing Database...")
    init_db()
    
    # Check if Gemini key is loaded
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        print("Startup Check: [PromptVault] GEMINI_API_KEY loaded successfully.")
    else:
        print("Startup Check: [PromptVault] WARNING: GEMINI_API_KEY is not set in environment/dotenv.")

# Register API routers
app.include_router(auth_router)
app.include_router(auth_router, prefix="/api")
app.include_router(blueprints_router)
app.include_router(blueprints_router, prefix="/api")
app.include_router(versions_router, prefix="/api")
app.include_router(test_cases_router, prefix="/api")
app.include_router(test_runs_router, prefix="/api")
app.include_router(compare_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(playground_router, prefix="/api")
app.include_router(extension_router, prefix="/api")
app.include_router(extension_router)

from app.routes.extension import quick_save_prompt, QuickSaveResponse
app.post("/quick-save", response_model=QuickSaveResponse, status_code=status.HTTP_201_CREATED)(quick_save_prompt)
app.post("/api/quick-save", response_model=QuickSaveResponse, status_code=status.HTTP_201_CREATED)(quick_save_prompt)

def seed_demo_data(session: Session):
    # Customer Support Assistant
    bp1 = Blueprint(name="Customer Support Assistant", description="Classifies customer billing tickets and replies empathetically.")
    session.add(bp1)
    session.commit()
    session.refresh(bp1)
    
    v1_1 = Version(
        blueprint_id=bp1.id,
        system_prompt="You are a customer support agent. Answer questions about orders.",
        user_prompt="Explain why my shipment for order {{order_id}} is late. Context: {{context}}",
        parameters_json='{"model": "claude-3-5-sonnet", "temperature": 0.3}'
    )
    v1_2 = Version(
        blueprint_id=bp1.id,
        system_prompt="You are an empathetic customer support agent. Always apologize first and use warm tones.",
        user_prompt="Order {{order_id}} shipment delay issue.\nContext: {{context}}\n\nExplain why it is late and provide a coupon.",
        parameters_json='{"model": "claude-3-5-sonnet", "temperature": 0.4}'
    )
    session.add(v1_1)
    session.add(v1_2)
    session.commit()
    session.refresh(v1_1)
    session.refresh(v1_2)
    
    tc1_1 = TestCase(
        blueprint_id=bp1.id,
        name="Winter Storm Delay",
        input_text='{"order_id": "PV-103", "context": "Order was delayed due to winter storms in Chicago."}',
        expected_behavior="Politely explain the order delay caused by the Chicago winter storm.",
        last_status="pass",
        last_latency=1.12,
        last_run_at=datetime.utcnow()
    )
    tc1_2 = TestCase(
        blueprint_id=bp1.id,
        name="Lost Package Refund",
        input_text='{"order_id": "PV-205", "context": "Package lost by delivery carrier. Refunding user."}',
        expected_behavior="Apologize, inform them of the package loss, and process the refund.",
        last_status="fail",
        last_latency=1.45,
        last_run_at=datetime.utcnow()
    )
    session.add(tc1_1)
    session.add(tc1_2)

    # Coding Assistant
    bp2 = Blueprint(name="Coding Assistant", description="Assists users with coding, explaining code, and fixing errors.")
    session.add(bp2)
    session.commit()
    session.refresh(bp2)

    v2_1 = Version(
        blueprint_id=bp2.id,
        system_prompt="You are a senior python developer.",
        user_prompt="Explain what a decorator does in python with an example code.",
        parameters_json='{"model": "gpt-4o", "temperature": 0.2}'
    )
    v2_2 = Version(
        blueprint_id=bp2.id,
        system_prompt="You are a python teacher. Use simple language and metaphors.",
        user_prompt="Explain what a decorator does in python using a metaphor first, then code.",
        parameters_json='{"model": "gpt-4o", "temperature": 0.4}'
    )
    session.add(v2_1)
    session.add(v2_2)
    session.commit()
    session.refresh(v2_1)
    session.refresh(v2_2)
    
    tc2_1 = TestCase(
        blueprint_id=bp2.id,
        name="Decorator Metaphor",
        input_text='{}',
        expected_behavior="Explain Python decorators using a metaphor followed by a short example code snippet.",
        last_status="changed",
        last_latency=1.28,
        last_run_at=datetime.utcnow()
    )
    session.add(tc2_1)

    # Marketing Copywriter
    bp3 = Blueprint(name="Marketing Copywriter", description="Generates creative marketing emails and ad copies.")
    session.add(bp3)
    session.commit()
    session.refresh(bp3)

    v3_1 = Version(
        blueprint_id=bp3.id,
        system_prompt="You are a conversion marketing copywriter.",
        user_prompt="Write a launch email for product {{product}} targeting developers. Features: {{features}}",
        parameters_json='{"model": "gpt-4o-mini", "temperature": 0.7}'
    )
    v3_2 = Version(
        blueprint_id=bp3.id,
        system_prompt="You are a tech copywriter. Keep it direct, witty, and under 150 words.",
        user_prompt="Launch announcement email: {{product}}.\nAudience: Developers.\nFeatures: {{features}}\n\nKeep it short.",
        parameters_json='{"model": "gpt-4o-mini", "temperature": 0.8}'
    )
    session.add(v3_1)
    session.add(v3_2)
    session.commit()
    session.refresh(v3_1)
    session.refresh(v3_2)
    
    tc3_1 = TestCase(
        blueprint_id=bp3.id,
        name="Product Launch",
        input_text='{"product": "PromptVault", "features": "Versioning, concurrent visual diffs, testing"}',
        expected_behavior="Draft a compelling product launch email focusing on developers.",
        last_status="pass",
        last_latency=0.98,
        last_run_at=datetime.utcnow()
    )
    session.add(tc3_1)
    
    # Seed initial activities
    from app.models.activity import Activity
    act1 = Activity(event_type="Blueprint Created", description="Created blueprint 'Customer Support Assistant'", blueprint_id=bp1.id)
    act2 = Activity(event_type="Version Saved", description="Saved prompt version 'v1.0.0' for blueprint 'Customer Support Assistant'", blueprint_id=bp1.id, version_id=v1_1.id)
    act3 = Activity(event_type="Version Saved", description="Saved prompt version 'v1.1.0' for blueprint 'Customer Support Assistant'", blueprint_id=bp1.id, version_id=v1_2.id)
    act4 = Activity(event_type="Test Case Added", description="Added test case 'Refund Policy' to blueprint 'Customer Support Assistant'", blueprint_id=bp1.id)
    act5 = Activity(event_type="Test Case Added", description="Added test case 'Cancel Order' to blueprint 'Customer Support Assistant'", blueprint_id=bp1.id)
    session.add(act1)
    session.add(act2)
    session.add(act3)
    session.add(act4)
    session.add(act5)
    
    session.commit()
    print("Database seeded successfully with demo blueprints.")

@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy", "service": "PromptVault Backend Core"}
