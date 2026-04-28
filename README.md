# Voyageur — AI Travel Safety Companion

A full-stack travel safety app that gives real-time crime risk analysis, hospital lookup, route planning, and an AI chat assistant — all in one dashboard.

---

## What's Been Built

### Backend (FastAPI + Python)

**Auth System**
- JWT-based auth with access tokens (30 min) and refresh tokens (7 days)
- `POST /api/v1/signup` — register and get tokens
- `POST /api/v1/login` — login and get tokens
- `POST /api/v1/refresh` — refresh access token
- `POST /api/v1/logout` — stateless logout
- `GET /api/v1/me` — get current user info
- Full CRUD for users (`/api/v1/users`)

**Trip Management**
- Authenticated CRUD for trips tied to the logged-in user
- `POST /api/v1/trips` — create trip
- `GET /api/v1/trips` — get all trips for current user
- `GET /api/v1/trips/{id}` — get specific trip
- `PUT /api/v1/trips/{id}` — update trip
- `DELETE /api/v1/trips/{id}` — delete trip

**AI Chat**
- `POST /api/v1/ai/chat` — conversational AI powered by Google Gemini
- Automatically detects Indian state from message context and injects crime safety data
- Falls back across multiple Gemini models (`gemini-2.5-flash`, `2.0-flash`, `1.5-flash`)
- Chat message persistence: `POST/GET /api/v1/ai/chat-messages`
- `GET /api/v1/ai/crime-warning/{state}` — AI-generated safety warning for a state

**Travel & Crime Risk**
- `GET /api/v1/travel/crime-risk?lat=&lng=` — crime risk for GPS coordinates
- `GET /api/v1/travel/districts-in-state?lat=&lng=` — all districts in detected state with risk data
- `GET /api/v1/travel/districts` — all districts risk data
- `GET /api/v1/travel/hospitals?lat=&lng=&radius=&limit=` — nearby hospitals via haversine distance

**Data & Services**
- Crime data loaded from `processed_crime_data.csv` with normalized risk scores (1–10 scale)
- Handles Telangana/Andhra Pradesh historical dataset split
- Reverse geocoding via Nominatim with coordinate-based fallback using `district_centroids.json`
- Hospital data from `processed_hospital_directory.csv` with coordinate parsing
- AI notebooks for crime and hospital data analysis (`ai_notebooks/`)

**Database**
- PostgreSQL via Supabase, SQLAlchemy ORM
- Models: `User`, `Trip`, `ChatMessage`

---

### Frontend (React + Vite + Tailwind)

**Pages**
- `/` — Home/landing page with login/signup navigation
- `/login` — Animated login form with framer-motion
- `/signup` — Animated signup form
- `/dashboard` — Main dashboard (protected)
- `/chat` — Full-page AI chat (protected)

**Dashboard Features**
- Dark glassmorphism UI with purple/blue gradient theme
- Live interactive map (Leaflet + OpenStreetMap) showing your current location
- Crime risk circle overlay around your position (color-coded: red/yellow/green)
- Click anywhere on the map to get crime risk for that location
- Route planner with From/To inputs, map pin picker, and "Current Location" shortcut
- Turn-by-turn directions panel powered by OSRM routing API
- Estimated travel time and distance summary
- Nearby hospitals toggle with green markers and 30km radius overlay
- Risk panel sidebar showing live location risk + clicked location risk
- Floating AI chat bubble (bottom-right) with full conversation history

**AI Chat Page**
- Full-screen chat interface with message history
- Sends user's GPS coordinates as trip context to the AI
- Typing indicator animation
- Back-to-dashboard navigation

**Auth & State**
- `AuthContext` with login, signup, logout, and token persistence in localStorage
- `axiosInstance` with automatic token refresh interceptor (queues failed requests during refresh)
- `ProtectedRoute` component redirects unauthenticated users to `/login`
- `useLocation` hook for real-time GPS via browser Geolocation API

**Deployment**
- Frontend deployed on Vercel (`voyageur-sable.vercel.app`)
- Backend deployed on Render (`voyageur-1i0h.onrender.com`)

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Leaflet, framer-motion, Axios |
| Backend | FastAPI, SQLAlchemy, Pydantic, bcrypt, python-jose |
| AI | Google Gemini API (`google-genai`) |
| Database | PostgreSQL (Supabase) |
| Routing | OSRM (open-source routing) |
| Geocoding | Nominatim (OpenStreetMap) |
| Data | Pandas, custom crime + hospital CSVs |

---

## Running Locally

### Backend

```bash
cd Backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

Create `Backend/.env`:
```
DATABASE_URL=your_supabase_postgres_url
SECRET_KEY=your_jwt_secret
GEMINI_API_KEY=your_google_gemini_key
```

```bash
uvicorn app.main:app --reload
```

API runs at `http://localhost:8000`. Docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd Frontend/client
npm install
```

Create `Frontend/client/.env.local`:
```
VITE_API_URL=http://localhost:8000
```

```bash
npm run dev
```

App runs at `http://localhost:5173`.
