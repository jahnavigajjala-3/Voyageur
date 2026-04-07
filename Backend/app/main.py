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


origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
    "https://voyageur-sable.vercel.app",
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
