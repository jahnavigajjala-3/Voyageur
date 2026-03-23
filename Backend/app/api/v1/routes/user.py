from fastapi import APIRouter
from app.db.session import SessionLocal
from app.models.user import User

router = APIRouter()

@router.post("/")
def create_user(name: str):
    db = SessionLocal()
    user = User(name=name)
    db.add(user)
    db.commit()
    return {"message": "User created"}