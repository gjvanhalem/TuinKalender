# 🌿 Plan-te

Plan-te is a modern, containerized web application that helps you manage your garden and plants effortlessly. With integrations from Trefle.io for plant data, OpenWeatherMap for local climate insights, and OpenRouter for smart AI gardening advice, you'll always have a personalized yearly overview of what needs to happen in your garden.

![Plan-te Hero](frontend/public/hero-preview.png) *(Screenshot coming soon)*

## ✨ Features

-   **Multi-user Support**: Secure login with your Google account. Each user manages their own gardens and plants.
-   **Interactive Garden Management**: Create multiple gardens and set their location via an interactive Google Maps picker or your current GPS location.
-   **Trefle.io Integration**: Search the global Trefle database for official plant data, scientific names, and photos.
-   **AI Gardening Advice (OpenRouter/OpenAI)**: 
    -   Automatically fill in flowering months, pruning months, and care tips for your plants.
    -   Get dynamic, weather-aware garden advice based on your current plant collection and local forecast.
-   **Weather Integration**: Real-time weather data and 5-day forecasts via OpenWeatherMap to help you plan your gardening activities.
-   **Multi-language Support**: Fully localized interface available in **English**, **Dutch**, and **French**.
-   **Flexible Views**: Switch between a visual **Gallery View** (grid) with large photos or a compact **Table View** for large collections.
-   **Smart Calendar**: 
    -   Monthly overview with icons for specific tasks (Pruning, Flowering, Planting).
    -   Interactive **Yearly Overview** (table) for all your plants at a glance.
    -   Filter by specific gardens.
-   **Persistence**: All your data and uploaded photos are securely stored on your own server via Docker volumes.

## 🚀 Quick Start

### 1. Prerequisites
-   [Docker](https://www.docker.com/) and Docker Compose installed.
-   [Google Cloud Console](https://console.cloud.google.com/) OAuth 2.0 Client ID (for login).
-   [Trefle.io API Token](https://trefle.io/) (free).
-   *(Optional)* [OpenRouter API Key](https://openrouter.ai/) or OpenAI Key (for AI suggestions).
-   *(Optional)* [OpenWeatherMap API Key](https://openweathermap.org/api) (for weather features).
-   *(Optional)* [Google Maps API Key](https://console.cloud.google.com/) (for the location picker).

### 2. Installation
Clone the repository:
```bash
git clone https://github.com/yourusername/TuinKalender.git
cd TuinKalender
```

Create a `.env` file based on the example:
```bash
cp .env.example .env
```
Fill in the required API keys and secrets in the `.env` file.

### 3. Launch
Start the application with Docker Compose:
```bash
docker-compose up -d --build
```

The application is now accessible at:
-   **Frontend**: `http://localhost:3000` (or the port specified by `FRONTEND_PORT` in `.env`)
-   **Backend API**: `http://localhost:8000` (Docs at `/docs`)

### 🛠️ Database Migrations (Alembic)
This project uses Alembic for database schema management. Migrations are automatically applied when the backend container starts.

**For existing installations:**
If you already have a database running (without Alembic), run the following command once in the backend container to mark the current state as 'up-to-date':
```bash
docker exec -it tuinkalender-backend-1 alembic stamp head
```

### 💾 Backups
A `backup.sh` script is available in the root of the project. This script creates copies of:
1. The PostgreSQL database (via `pg_dump`).
2. The SQLite database (if present).
3. Uploaded plant photos.

Run the script manually or set up a cron job:
```bash
chmod +x backup.sh
./backup.sh
```

## ⚙️ Configuration (.env)

| Variable | Description |
| :--- | :--- |
| `GOOGLE_CLIENT_ID` | OAuth Client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth Client Secret from Google Cloud Console |
| `NEXTAUTH_SECRET` | Random string for session security |
| `TREFLE_API_TOKEN` | Your personal token from Trefle.io |
| `OPENROUTER_API_KEY` | *(Optional)* Key for AI integration |
| `OPENWEATHER_API_KEY` | *(Optional)* Key for weather data |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | *(Optional)* System key for map features |

## 🏗️ Tech Stack

-   **Frontend**: [Next.js 14](https://nextjs.org/) (React), Tailwind CSS, Lucide Icons, `next-intl`.
-   **Backend**: [FastAPI](https://fastapi.tiangolo.com/) (Python), SQLModel (SQLAlchemy).
-   **Database**: [PostgreSQL](https://www.postgresql.org/).
-   **Containerization**: [Docker](https://www.docker.com/).

## 📱 Homeserver Deployment

For use on a homeserver (e.g., Synology, Unraid, or Raspberry Pi):
1.  Ensure `NEXTAUTH_URL` and `NEXT_PUBLIC_API_URL` in your `.env` point to the IP address or domain of your server.
2.  Add these URLs to the "Authorized Redirect URIs" in your Google Cloud Console.
3.  Use a reverse proxy (like Nginx Proxy Manager) for SSL/HTTPS support.

---

*Created with passion for gardening. Powered by [Trefle.io](https://trefle.io/).*
