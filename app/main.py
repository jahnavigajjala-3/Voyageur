from fastapi import FastAPI

from app.db.session import engine
from app.db.base import Base
from app.models import user  
from app.api.v1.routes import user as user_routes, trip as trip_routes

app = FastAPI()


Base.metadata.create_all(bind=engine)

app.include_router(user_routes.router)
app.include_router(trip_routes.router)

@app.get("/")
def home():
    return {"message": "API is working"}
