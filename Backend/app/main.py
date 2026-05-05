import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.session import engine
from app.db.base import Base
from app.models import user, chat_message
from app.api.v1.routes import user as user_routes, trip as trip_routes
from app.api.v1.routes import ai as ai_routes
from app.api.v1.routes import travel as travel_routes
from app.api.v1.routes import weather
from app.api.v1.routes import auth as auth_routes
from app.core.logging import configure_logging, get_logger
from dotenv import load_dotenv

load_dotenv()

# Configure structured logging before anything else
configure_logging(level=os.getenv("LOG_LEVEL", "INFO"))
logger = get_logger(__name__)

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
app.include_router(ai_routes.router,   prefix=API_PREFIX + "/ai")
app.include_router(travel_routes.router, prefix=API_PREFIX + "/travel")
app.include_router(weather.router,     prefix=API_PREFIX)
app.include_router(auth_routes.router, prefix=API_PREFIX)  # Google OAuth

@app.get("/")
def home():
    logger.info("Health check endpoint called")
    return {"message": "Voyageur API is Live 🚀"}