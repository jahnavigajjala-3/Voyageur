import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.session import engine
from app.db.base import Base
from app.models import user
from app.api.v1.routes import user as user_routes, trip as trip_routes
from app.api.v1.routes import ai as ai_routes
from app.api.v1.routes import travel as travel_routes
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# 🌍 PRODUCTION CORS SETTINGS
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    os.getenv("FRONTEND_URL", "https://voyageur-frontend.vercel.app"), # REPLACE with your actual deployed URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

API_PREFIX = "/api/v1"

# Route Registration
app.include_router(user_routes.router, prefix=API_PREFIX)
app.include_router(trip_routes.router, prefix=API_PREFIX)
app.include_router(ai_routes.router, prefix=API_PREFIX + "/ai")
app.include_router(travel_routes.router, prefix=API_PREFIX + "/travel")

@app.get("/")
def home():
    return {"message": "Voyageur API is Live 🚀"}

# Placeholder Auth (if not in user_routes)
@app.post(f"{API_PREFIX}/login")
async def login(data: dict):
    return {"message": "Login successful", "user": data.get("email")}

@app.post(f"{API_PREFIX}/signup")
async def signup(data: dict):
    return {"message": "Signup successful", "user": data.get("email")}