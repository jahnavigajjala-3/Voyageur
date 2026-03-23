from fastapi import FastAPI

from app.db.session import engine
from app.db.base import Base
from app.models import user  # IMPORTANT: ensures model is registered

app = FastAPI()

# Create tables
Base.metadata.create_all(bind=engine)

@app.get("/")
def home():
    return {"message": "API is working"}

@app.get("/users")
def get_users():
    return [
        {"id": 1, "name": "Jahnavi"},
        {"id": 2, "name": "Meshery Dev"}
    ]