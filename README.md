Amigo – Travel Planning Backend API

This project is a backend system for a travel planning application built using FastAPI.
It allows users to create and manage trips. 
The backend is connected to a PostgreSQL database (Supabase) using SQLAlchemy ORM and is designed to be scalable for future features like itinerary generation and AI-based recommendations.

1) Current Features
- User creation and retrieval
- Trip creation and retrieval
- Database integration with PostgreSQL
- REST API endpoints using FastAPI
- Input and output validation using Pydantic schemas

2) Planned Features
- AI-based travel itinerary generation
- User preferences and recommendations
- Trip history and analytics
- Integration with frontend (React)
- Authentication and authorization

3) Planned Features
- AI-based travel itinerary generation
- User preferences and recommendations
- Trip history and analytics
- Integration with frontend (React)
- Authentication and authorization

4) Dependencies
- fastapi  
- uvicorn  
- sqlalchemy  
- psycopg2-binary  
- python-dotenv  

5) How to Run
git clone <your-repo-link>
cd Backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

Create a .env file:

DATABASE_URL=your_supabase_database_url

Run server:

uvicorn app.main:app --reload

6) API Endpoints
POST /users → Create user
GET /users → Get all users
POST /trips → Create trip
GET /trips → Get all trips
