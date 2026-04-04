# 🌿 TuinKalender

TuinKalender is een moderne, containerized webapplicatie waarmee je jouw tuin en planten moeiteloos kunt beheren. Met integraties van Trefle.io voor plantgegevens en OpenRouter voor slimme AI-tuinadviezen, heb je altijd een persoonlijk jaaroverzicht van wat er in jouw tuin moet gebeuren.

![TuinKalender Hero](frontend/public/hero-preview.png) *(Voeg hier later een screenshot toe)*

## ✨ Kenmerken

-   **Multi-user Support**: Log veilig in met je Google-account. Elke gebruiker heeft zijn eigen tuinen en planten.
-   **Interactieve Tuinbeheer**: Maak meerdere tuinen aan en bepaal de locatie via een interactieve Google Maps kiezer of je huidige GPS-locatie.
-   **Trefle.io Integratie**: Zoek in de wereldwijde database van Trefle naar officiële plantgegevens, wetenschappelijke namen en foto's.
-   **AI Tuinadvies (OpenRouter)**: Laat AI automatisch de bloeimaanden, snoeimaanden en verzorgingstips voor je planten invullen.
-   **Flexibele Weergave**: Kies tussen een visuele **Kaartweergave** (grid) met grote foto's of een compacte **Tabelweergave** voor grote collecties.
-   **Slimme Kalender**: 
    -   Maandoverzicht met iconen voor specifieke taken (Snoeien, Bloei, Planten).
    -   Interactief **Jaaroverzicht** (tabel) voor al je planten in één oogopslag.
    -   Filteren op specifieke tuinen.
-   **Persistentie**: Al je gegevens en geüploade foto's worden veilig opgeslagen op je eigen server via Docker volumes.

## 🚀 Snel aan de slag

### 1. Vereisten
-   [Docker](https://www.docker.com/) en Docker Compose geïnstalleerd.
-   [Google Cloud Console](https://console.cloud.google.com/) OAuth 2.0 Client ID (voor login).
-   [Trefle.io API Token](https://trefle.io/) (gratis).
-   *(Optioneel)* [OpenRouter API Key](https://openrouter.ai/) (voor AI suggesties).
-   *(Optioneel)* [Google Maps API Key](https://console.cloud.google.com/) (voor de locatiekiezer).

### 2. Installatie
Kloon de repository:
```bash
git clone https://github.com/jouwgebruikersnaam/TuinKalender.git
cd TuinKalender
```

Maak een `.env` bestand aan op basis van het voorbeeld:
```bash
cp .env.example .env
```
Vul de benodigde API keys en secrets in het `.env` bestand in.

### 3. Starten
Start de applicatie met Docker Compose:
```bash
docker-compose up -d --build
```

De applicatie is nu bereikbaar op:
-   **Frontend**: `http://localhost:3000`
-   **Backend API**: `http://localhost:8000` (Docs op `/docs`)

## ⚙️ Configuratie (.env)

| Variabele | Omschrijving |
| :--- | :--- |
| `GOOGLE_CLIENT_ID` | OAuth Client ID van Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth Client Secret van Google Cloud Console |
| `NEXTAUTH_SECRET` | Willekeurige string voor sessiebeveiliging |
| `TREFLE_API_TOKEN` | Je persoonlijke token van Trefle.io |
| `OPENROUTER_API_KEY` | *(Optioneel)* Key voor AI-integratie |
| `GOOGLE_MAPS_API_KEY` | *(Optioneel)* Systeem-key voor kaartfuncties |

## 🏗️ Tech Stack

-   **Frontend**: [Next.js](https://nextjs.org/) (React), Tailwind CSS, Lucide Icons.
-   **Backend**: [FastAPI](https://fastapi.tiangolo.com/) (Python), SQLModel (SQLAlchemy).
-   **Database**: [PostgreSQL](https://www.postgresql.org/).
-   **Containerisatie**: [Docker](https://www.docker.com/).

## 📱 Homeserver Deployment

Voor gebruik op een homeserver (bijv. Synology, Unraid of een Raspberry Pi):
1.  Zorg dat `NEXTAUTH_URL` en `NEXT_PUBLIC_API_URL` in je `.env` wijzen naar het IP-adres of domein van je server.
2.  Voeg deze URL's toe aan de "Authorized Redirect URIs" in je Google Cloud Console.
3.  Gebruik een reverse proxy (zoals Nginx Proxy Manager) voor SSL/HTTPS ondersteuning.

---

*Gemaakt met passie voor de tuin. Aangedreven door [Trefle.io](https://trefle.io/).*
