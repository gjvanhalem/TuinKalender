from dotenv import load_dotenv
load_dotenv()

from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, Session, select
from database import engine, create_db_and_tables, get_session
from sqlalchemy import func
from models import Garden, Plant, Task, User, GardenAccess, PlantPhoto, GardenPhoto
from trefle_api import search_plants, get_plant_details, extract_tasks_from_trefle_data, download_image
from ai_service import get_plant_suggestions_ai, get_garden_advice_ai, identify_plant_from_image, analyze_plant_health, analyze_garden_photo
from weather_service import get_weather_data, get_forecast_data
from auth import get_current_user
from auth_check import router as auth_check_router
from fastapi.staticfiles import StaticFiles
import shutil
import os
import json
import asyncio
from datetime import datetime, timedelta

app = FastAPI(title="Plan-te API")

@app.get("/health")
def health_check():
    return {"status": "ok"}

app.include_router(auth_check_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    # Schema updates are now handled by Alembic migrations.
    # We just ensure the images directory exists.
    os.makedirs("images", exist_ok=True)
    # Start the background task
    asyncio.create_task(update_weather_loop())

async def update_weather_loop():
    """
    Background task to update weather and advice for all gardens once per day.
    """
    while True:
        try:
            print("Background Task: Starting daily weather/advice update check...")
            with Session(engine) as session:
                update_all_gardens_weather_and_advice(session)
        except Exception as e:
            print(f"Background Task Error: {e}")
        # Check every hour
        await asyncio.sleep(3600)

def update_all_gardens_weather_and_advice(session: Session):
    now = datetime.now()
    gardens = session.exec(select(Garden)).all()
    
    for garden in gardens:
        # Check if we already updated today (or ever)
        if garden.last_weather_update and garden.last_weather_update.date() == now.date():
            continue
            
        update_garden_weather_and_advice(session, garden)

def update_garden_weather_and_advice(session: Session, garden: Garden):
    """
    Helper to update weather and advice for a single garden.
    Returns (bool, str) - (success, error_message)
    """
    now = datetime.now()
    # Get owner user for API keys
    user = session.get(User, garden.user_id)
    if not user:
        return False, "Owner user not found"
    
    if not user.openweathermap_key:
        return False, "OpenWeatherMap API key is missing. Set it in Settings."
        
    if not garden.location:
        return False, "Garden location is missing. Set it in Garden Settings."
        
    try:
        # 1. Fetch Forecast
        forecast = get_forecast_data(garden.location, user.openweathermap_key)
        if not forecast:
            return False, f"Could not fetch weather for '{garden.location}'. Check the location name."
        
        # 2. Get AI Advice based on this forecast
        plants = session.exec(select(Plant).where(Plant.garden_id == garden.id)).all()
        plant_names = [p.common_name or p.scientific_name for p in plants]
        plants_summary = ", ".join(filter(None, plant_names[:10]))
        
        provider = user.ai_provider or "openrouter"
        if provider == "openai":
            api_key = user.openai_key
            model = user.openai_model or "gpt-4o-mini"
        else:
            api_key = user.openrouter_key
            model = user.openrouter_model or "openrouter/auto"
        
        advice = None
        if api_key and plants_summary:
            weather_context = {"forecast": forecast}
            advice = get_garden_advice_ai(plants_summary, weather_context, api_key, model, provider, user.preferred_language)
            
        # 3. Update Garden
        garden.weather_forecast = forecast
        if advice:
            garden.smart_advice = advice
        garden.last_weather_update = now
        session.add(garden)
        session.commit()
        session.refresh(garden)
        print(f"Update: Successfully updated garden {garden.id}")
        return True, ""
    except Exception as e:
        print(f"Update: Error updating garden {garden.id}: {e}")
        return False, str(e)

@app.get("/")
def read_root():
    return {"message": "Welcome to Plan-te API"}

app.mount("/images", StaticFiles(directory="images"), name="images")

# User Endpoints
@app.get("/users/me", response_model=User)
def read_user_me(current_user: User = Depends(get_current_user)):
    return current_user

@app.put("/users/me", response_model=User)
def update_user_me(user_data: dict, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # Re-fetch user in the current session to avoid "already attached" errors
    db_user = session.get(User, current_user.id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if "name" in user_data: db_user.name = user_data["name"]
    if "trefle_token" in user_data: db_user.trefle_token = user_data["trefle_token"]
    if "openrouter_key" in user_data: db_user.openrouter_key = user_data["openrouter_key"]
    if "openrouter_model" in user_data: db_user.openrouter_model = user_data["openrouter_model"]
    if "openai_key" in user_data: db_user.openai_key = user_data["openai_key"]
    if "openai_model" in user_data: db_user.openai_model = user_data["openai_model"]
    if "openweathermap_key" in user_data: db_user.openweathermap_key = user_data["openweathermap_key"]
    if "ai_provider" in user_data: db_user.ai_provider = user_data["ai_provider"]
    if "preferred_language" in user_data: db_user.preferred_language = user_data["preferred_language"]
    if "has_onboarded" in user_data: db_user.has_onboarded = user_data["has_onboarded"]
    
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user

# Admin Endpoints
@app.get("/admin/users", response_model=List[dict])
def admin_get_users(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Alleen voor administrators")
    
    users = session.exec(select(User)).all()
    result = []
    for u in users:
        # Calculate stats for this user
        g_count = session.exec(select(func.count(Garden.id)).where(Garden.user_id == u.id)).one()
        p_count = session.exec(select(func.count(Plant.id)).join(Garden).where(Garden.user_id == u.id)).one()
        
        u_data = u.model_dump()
        u_data["garden_count"] = g_count
        u_data["plant_count"] = p_count
        result.append(u_data)
    return result

@app.post("/admin/users/invite")
def admin_invite_user(user_data: dict, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only for administrators")
    
    email = user_data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email address is required")
    
    # Check if user already exists
    existing = session.exec(select(User).where(User.email == email)).first()
    if existing:
        return {"message": "User already exists"}
    
    new_user = User(email=email, is_active=True, is_admin=False)
    session.add(new_user)
    session.commit()
    return {"message": f"User {email} added to the access list."}

@app.patch("/admin/users/{user_id}")
def admin_update_user(user_id: int, data: dict, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only for administrators")
        
    db_user = session.get(User, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if "is_active" in data:
        db_user.is_active = data["is_active"]
    if "is_admin" in data:
        db_user.is_admin = data["is_admin"]
        
    session.add(db_user)
    session.commit()
    return {"message": "User updated"}

@app.delete("/admin/users/{user_id}")
def admin_delete_user(user_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only for administrators")
        
    db_user = session.get(User, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Prevent deleting yourself
    if db_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own administrator account")
        
    session.delete(db_user)
    session.commit()
    return {"message": "User and all associated data deleted"}

# Garden Endpoints
@app.post("/gardens/", response_model=Garden)
def create_garden(garden: Garden, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    garden.user_id = current_user.id
    session.add(garden)
    session.commit()
    session.refresh(garden)
    return garden

@app.put("/gardens/{garden_id}", response_model=Garden)
def update_garden(garden_id: int, garden_data: Garden, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    db_garden = session.get(Garden, garden_id)
    if not db_garden:
        raise HTTPException(status_code=404, detail="Garden not found")
    if db_garden.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    garden_data_dict = garden_data.model_dump(exclude_unset=True)
    for key, value in garden_data_dict.items():
        if key != "user_id": # Don't allow changing owner
            setattr(db_garden, key, value)
            
    session.add(db_garden)
    session.commit()
    session.refresh(db_garden)
    return db_garden

@app.post("/gardens/{garden_id}/image/")
async def upload_garden_image(garden_id: int, file: UploadFile = File(...), current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    garden = session.get(Garden, garden_id)
    if not garden:
        raise HTTPException(status_code=404, detail="Garden not found")
    if garden.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    os.makedirs("images", exist_ok=True)
    # Sanitize filename to prevent path traversal
    safe_filename = os.path.basename(file.filename)
    file_path = f"images/garden_{garden_id}_{safe_filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    garden.image_path = file_path
    session.add(garden)
    session.commit()
    session.refresh(garden)
    return {"image_path": file_path}

@app.get("/gardens/", response_model=List[dict])
def read_gardens(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # Find gardens owned by user OR shared with user
    from sqlalchemy.orm import selectinload
    
    # Gardens owned - eager load user to get email
    owned_query = select(Garden).where(Garden.user_id == current_user.id).options(selectinload(Garden.user))
    owned_gardens = session.exec(owned_query).all()
    
    # Gardens shared - eager load user
    shared_query = select(Garden).join(GardenAccess).where(GardenAccess.user_id == current_user.id).options(selectinload(Garden.user))
    shared_gardens = session.exec(shared_query).all()
    
    all_gardens = list(owned_gardens) + [g for g in shared_gardens if g.id not in [og.id for og in owned_gardens]]
    
    result = []
    for garden in all_gardens:
        garden_dict = garden.model_dump()
        plants = session.exec(select(Plant).where(Plant.garden_id == garden.id)).all()
        garden_dict["plant_count"] = len(plants)
        garden_dict["is_owner"] = garden.user_id == current_user.id
        garden_dict["owner_email"] = garden.user.email if garden.user else "Unknown"
        
        # Create a summary
        plant_names = [p.common_name for p in plants if p.common_name]
        if not plant_names:
            plant_names = [p.scientific_name for p in plants if p.scientific_name]
        summary = ", ".join(plant_names[:3])
        if len(plant_names) > 3:
            summary += "..."
        garden_dict["plant_summary"] = summary
        result.append(garden_dict)
    return result

@app.get("/gardens/{garden_id}/access", response_model=List[dict])
def get_garden_access(garden_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    garden = session.get(Garden, garden_id)
    if not garden or garden.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner can manage access")
    
    return [{"id": u.id, "email": u.email} for u in garden.shared_users]

@app.post("/gardens/{garden_id}/share")
def share_garden(garden_id: int, share_data: dict, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    garden = session.get(Garden, garden_id)
    if not garden or garden.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner can share the garden")
    
    email = share_data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    target_user = session.exec(select(User).where(User.email == email)).first()
    if not target_user:
        # Create a placeholder user so they can log in later
        target_user = User(email=email, is_active=True, is_admin=False)
        session.add(target_user)
        session.commit()
        session.refresh(target_user)
    
    if target_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot share the garden with yourself")
        
    existing = session.exec(select(GardenAccess).where(GardenAccess.garden_id == garden_id, GardenAccess.user_id == target_user.id)).first()
    if not existing:
        access = GardenAccess(garden_id=garden_id, user_id=target_user.id)
        session.add(access)
        session.commit()
        
    return {"message": f"Garden shared with {email}"}

@app.delete("/gardens/{garden_id}/share/{user_id}")
def unshare_garden(garden_id: int, user_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    garden = session.get(Garden, garden_id)
    if not garden or garden.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner can revoke access")
    
    access = session.exec(select(GardenAccess).where(GardenAccess.garden_id == garden_id, GardenAccess.user_id == user_id)).first()
    if access:
        session.delete(access)
        session.commit()
        
    return {"message": "Access revoked"}

@app.delete("/gardens/{garden_id}")
def delete_garden(garden_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    db_garden = session.get(Garden, garden_id)
    if not db_garden or db_garden.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner can delete the garden")
    session.delete(db_garden)
    session.commit()
    return {"message": "Garden deleted"}

@app.get("/gardens/{garden_id}/weather")
def get_garden_weather(garden_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    garden = session.get(Garden, garden_id)
    # Check access (owner or shared)
    has_shared_access = session.exec(select(GardenAccess).where(GardenAccess.garden_id == garden_id, GardenAccess.user_id == current_user.id)).first()
    
    if not garden or (garden.user_id != current_user.id and not has_shared_access):
        raise HTTPException(status_code=404, detail="Garden not found or no access")
    
    # If no stored weather, or it's from a previous day, and we have a key, try to update it once
    now = datetime.now()
    if (not garden.weather_forecast or not garden.last_weather_update or garden.last_weather_update.date() < now.date()):
        # Try to update it using the helper
        update_garden_weather_and_advice(session, garden)
    
    return {
        "current": None, # User asked to remove current weather in favor of weekly forecast
        "forecast": garden.weather_forecast
    }

@app.get("/gardens/{garden_id}/advice")
def get_garden_advice(garden_id: int, locale: str = "en", current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    garden = session.get(Garden, garden_id)
    # Check access
    has_shared_access = session.exec(select(GardenAccess).where(GardenAccess.garden_id == garden_id, GardenAccess.user_id == current_user.id)).first()
    
    if not garden or (garden.user_id != current_user.id and not has_shared_access):
        raise HTTPException(status_code=404, detail="Garden not found or no access")
    
    # If we have stored advice from today, return it
    now = datetime.now()
    if garden.smart_advice and garden.last_weather_update and garden.last_weather_update.date() == now.date():
        return {"advice": garden.smart_advice}
        
    # Otherwise, check if we have weather to generate advice
    if garden.weather_forecast and garden.last_weather_update and garden.last_weather_update.date() == now.date():
        # Generate advice
        plants = session.exec(select(Plant).where(Plant.garden_id == garden.id)).all()
        plant_names = [p.common_name or p.scientific_name for p in plants]
        plants_summary = ", ".join(filter(None, plant_names[:10]))
        
        provider = current_user.ai_provider or "openrouter"
        if provider == "openai":
            api_key = current_user.openai_key
            model = current_user.openai_model or "gpt-4o-mini"
        else:
            api_key = current_user.openrouter_key
            model = current_user.openrouter_model or "openrouter/auto"
            
        if api_key and plants_summary:
            weather_context = {"forecast": garden.weather_forecast}
            advice = get_garden_advice_ai(plants_summary, weather_context, api_key, model, provider, locale)
            garden.smart_advice = advice
            session.add(garden)
            session.commit()
            return {"advice": advice}
            
    # Fallback to current advice if still exists, or empty
    return {"advice": garden.smart_advice or "No advice available yet. It will be updated soon."}

@app.post("/gardens/{garden_id}/refresh")
def refresh_garden_weather(garden_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    garden = session.get(Garden, garden_id)
    # Check access (owner or shared)
    has_shared_access = session.exec(select(GardenAccess).where(GardenAccess.garden_id == garden_id, GardenAccess.user_id == current_user.id)).first()
    
    if not garden or (garden.user_id != current_user.id and not has_shared_access):
        raise HTTPException(status_code=404, detail="Garden not found or no access")
        
    success, error_msg = update_garden_weather_and_advice(session, garden)
    if not success:
        raise HTTPException(status_code=400, detail=error_msg)
        
    return {
        "weather": garden.weather_forecast,
        "advice": garden.smart_advice
    }

# Plant Endpoints
@app.post("/plants/", response_model=Plant)
def create_plant(plant: Plant, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # Verify garden ownership OR shared access
    garden = session.get(Garden, plant.garden_id)
    has_shared_access = session.exec(select(GardenAccess).where(GardenAccess.garden_id == plant.garden_id, GardenAccess.user_id == current_user.id)).first()
    
    if not garden or (garden.user_id != current_user.id and not has_shared_access):
        raise HTTPException(status_code=403, detail="Not authorized for this garden")

    # Ensure plant is in the session and has an ID for potential image downloads
    session.add(plant)
    session.commit()
    session.refresh(plant)

    if not current_user.trefle_token:
         # Continue but might not fetch data
         pass

    # If trefle_id is provided, automatically fetch and suggest tasks
    if plant.trefle_id and current_user.trefle_token:
        trefle_data = get_plant_details(plant.trefle_id, current_user.trefle_token)
        if trefle_data:
            plant.raw_data = trefle_data
            plant.image_url = trefle_data.get("image_url")
            
            # Use Trefle common name if not provided
            if not plant.common_name:
                plant.common_name = trefle_data.get("common_name")
            if not plant.scientific_name:
                plant.scientific_name = trefle_data.get("scientific_name")

            # Download and save image if it exists
            if plant.image_url:
                local_path = download_image(plant.image_url, plant.id)
                if local_path:
                    plant.image_path = local_path
            
            # Suggest tasks from Trefle data
            suggested_tasks = extract_tasks_from_trefle_data(trefle_data)
            
            # Pre-populate the new manual fields from Trefle data
            f_months = [str(t["month"]) for t in suggested_tasks if t["category"] == "Bloei"]
            p_months = [str(t["month"]) for t in suggested_tasks if t["category"] == "Snoeien"]
            if f_months:
                plant.flowering_months = ",".join(f_months)
            if p_months:
                plant.pruning_months = ",".join(p_months)
            
            for task_data in suggested_tasks:
                task = Task(
                    month=task_data["month"],
                    category=task_data["category"],
                    description=task_data["description"],
                    plant_id=plant.id
                )
                session.add(task)
            session.add(plant)
            session.commit()
            session.refresh(plant)
            return plant
    
    # Sync manual months to Tasks for manual entries
    if plant.flowering_months:
        months = [m.strip() for m in plant.flowering_months.split(",")]
        for m in months:
            if m.isdigit():
                session.add(Task(month=int(m), category="Bloei", description=f"Bloeiperiode voor {plant.common_name}", plant_id=plant.id))
    if plant.pruning_months:
        months = [m.strip() for m in plant.pruning_months.split(",")]
        for m in months:
            if m.isdigit():
                session.add(Task(month=int(m), category="Snoeien", description=f"Snoeien aanbevolen voor {plant.common_name}", plant_id=plant.id))
    session.add(plant)
    session.commit()
    session.refresh(plant)
            
    return plant

@app.put("/plants/{plant_id}", response_model=Plant)
def update_plant(plant_id: int, plant_data: Plant, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    db_plant = session.get(Plant, plant_id)
    if not db_plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    
    # Verify ownership OR shared access through garden
    garden = session.get(Garden, db_plant.garden_id)
    has_shared_access = session.exec(select(GardenAccess).where(GardenAccess.garden_id == db_plant.garden_id, GardenAccess.user_id == current_user.id)).first()
    
    if not garden or (garden.user_id != current_user.id and not has_shared_access):
        raise HTTPException(status_code=403, detail="Not authorized")

    plant_data_dict = plant_data.model_dump(exclude_unset=True)
    
    # If garden_id is changing, verify ownership/access of the NEW garden
    if "garden_id" in plant_data_dict and plant_data_dict["garden_id"] != db_plant.garden_id:
        target_garden = session.get(Garden, plant_data_dict["garden_id"])
        target_has_access = session.exec(select(GardenAccess).where(GardenAccess.garden_id == plant_data_dict["garden_id"], GardenAccess.user_id == current_user.id)).first()
        if not target_garden or (target_garden.user_id != current_user.id and not target_has_access):
            raise HTTPException(status_code=403, detail="Not authorized for target garden")

    # Check if months have changed to sync with Tasks
    sync_tasks = False
    if "flowering_months" in plant_data_dict or "pruning_months" in plant_data_dict:
        sync_tasks = True

    for key, value in plant_data_dict.items():
        setattr(db_plant, key, value)
    
    session.add(db_plant)
    session.commit()
    session.refresh(db_plant)

    if sync_tasks:
        sync_plant_tasks(db_plant, session)

    return db_plant

@app.delete("/plants/{plant_id}")
def delete_plant(plant_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    db_plant = session.get(Plant, plant_id)
    if not db_plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    
    garden = session.get(Garden, db_plant.garden_id)
    has_shared_access = session.exec(select(GardenAccess).where(GardenAccess.garden_id == db_plant.garden_id, GardenAccess.user_id == current_user.id)).first()
    
    if not garden or (garden.user_id != current_user.id and not has_shared_access):
        raise HTTPException(status_code=403, detail="Not authorized")

    session.delete(db_plant)
    session.commit()
    return {"message": "Plant deleted"}

@app.get("/plants/{plant_id}", response_model=Plant)
def read_plant_detail(plant_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    db_plant = session.get(Plant, plant_id)
    if not db_plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    
    accessible_ids = get_accessible_garden_ids(current_user.id, session)
    if db_plant.garden_id not in accessible_ids:
        raise HTTPException(status_code=403, detail="Not authorized")

    db_plant.tasks = session.exec(select(Task).where(Task.plant_id == plant_id)).all()
    return db_plant

def get_accessible_garden_ids(user_id: int, session: Session) -> List[int]:
    from models import GardenAccess
    owned_ids = session.exec(select(Garden.id).where(Garden.user_id == user_id)).all()
    shared_ids = session.exec(select(GardenAccess.garden_id).where(GardenAccess.user_id == user_id)).all()
    return list(set(owned_ids + shared_ids))

@app.get("/plants/", response_model=List[Plant])
def read_plants(garden_id: Optional[int] = None, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    accessible_ids = get_accessible_garden_ids(current_user.id, session)
    
    # Ensure we get fresh data from the database
    session.expire_all()
    
    if garden_id:
        if garden_id not in accessible_ids:
            raise HTTPException(status_code=403, detail="No access to this garden")
        query = select(Plant).where(Plant.garden_id == garden_id)
    else:
        query = select(Plant).where(Plant.garden_id.in_(accessible_ids))
        
    plants = session.exec(query).all()
    
    # Manually attach tasks for the frontend view
    for plant in plants:
        plant.tasks = session.exec(select(Task).where(Task.plant_id == plant.id)).all()
        
    return plants

# Trefle Search Endpoint
@app.get("/search-plants/")
def search_trefle_plants(query: str, current_user: User = Depends(get_current_user)):
    if not current_user.trefle_token:
        raise HTTPException(status_code=400, detail="Trefle API token not configured in settings")
    return search_plants(query, current_user.trefle_token)

@app.get("/ai-suggest/")
def get_ai_suggestions(common_name: str, scientific_name: str, locale: str = "en", current_user: User = Depends(get_current_user)):
    provider = current_user.ai_provider or "openrouter"
    
    if provider == "openai":
        if not current_user.openai_key:
            raise HTTPException(status_code=400, detail="OpenAI API key not configured in settings")
        api_key = current_user.openai_key
        model = current_user.openai_model or "gpt-4o-mini"
    else:
        if not current_user.openrouter_key:
            raise HTTPException(status_code=400, detail="OpenRouter API key not configured in settings")
        api_key = current_user.openrouter_key
        model = current_user.openrouter_model or "openrouter/auto"
        
    return get_plant_suggestions_ai(common_name, scientific_name, api_key, model, provider, locale)

# ── Plant Photo / Vision Endpoints ────────────────────────────────────────────

def _get_ai_config(user: User):
    """Return (api_key, model, provider) for the user's AI setup."""
    provider = user.ai_provider or "openrouter"
    if provider == "openai":
        if not user.openai_key:
            raise HTTPException(status_code=400, detail="OpenAI API key not configured in settings")
        return user.openai_key, user.openai_model or "gpt-4o", provider
    else:
        if not user.openrouter_key:
            raise HTTPException(status_code=400, detail="OpenRouter API key not configured in settings")
        return user.openrouter_key, user.openrouter_model or "openrouter/auto", provider


@app.post("/plants/identify/")
async def identify_plant_photo(
    file: UploadFile = File(...),
    locale: str = "en",
    current_user: User = Depends(get_current_user),
):
    """Upload a photo and get AI plant identification to pre-fill the plant form."""
    api_key, model, provider = _get_ai_config(current_user)
    image_bytes = await file.read()
    result = identify_plant_from_image(image_bytes, api_key, model, provider, locale)
    if not result:
        raise HTTPException(status_code=502, detail="AI could not identify the plant. Try a clearer photo.")
    
    # Try to find a matching Trefle ID for better task suggestions later
    if current_user.trefle_token and result.get("scientific_name"):
        trefle_results = search_plants(result["scientific_name"], current_user.trefle_token)
        if trefle_results:
            # Pick the first match
            result["trefle_id"] = trefle_results[0].get("id")
            # If AI didn't give us a common name but Trefle did, use it
            if not result.get("common_name"):
                result["common_name"] = trefle_results[0].get("common_name")

    return result


@app.post("/plants/{plant_id}/photos/")
async def upload_plant_photo(
    plant_id: int,
    file: UploadFile = File(...),
    notes: Optional[str] = Form(None),
    locale: str = "en",
    analyze: bool = True,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Upload a timestamped photo for a plant. Optionally triggers AI health analysis."""
    plant = session.get(Plant, plant_id)
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    # Check garden access
    garden = session.get(Garden, plant.garden_id)
    accessible = get_accessible_garden_ids(current_user.id, session)
    if plant.garden_id not in accessible:
        raise HTTPException(status_code=403, detail="Not authorized")

    os.makedirs("images", exist_ok=True)
    safe_filename = os.path.basename(file.filename or "photo.jpg")
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    file_path = f"images/plant_photo_{plant_id}_{timestamp}_{safe_filename}"

    image_bytes = await file.read()
    with open(file_path, "wb") as f:
        f.write(image_bytes)

    # Optionally run AI health analysis
    ai_analysis = None
    if analyze:
        try:
            api_key, model, provider = _get_ai_config(current_user)
            plant_name = plant.common_name or plant.scientific_name or "Unknown plant"
            result = analyze_plant_health(image_bytes, plant_name, api_key, model, provider, locale)
            if result:
                ai_analysis = json.dumps(result)
        except HTTPException:
            pass  # No AI key configured — still save the photo
        except Exception as e:
            print(f"Health analysis error: {e}")

    photo = PlantPhoto(
        plant_id=plant_id,
        file_path=file_path,
        notes=notes,
        ai_analysis=ai_analysis,
    )
    session.add(photo)
    session.commit()
    session.refresh(photo)

    photo_dict = photo.model_dump()
    if ai_analysis:
        try:
            photo_dict["ai_analysis"] = json.loads(ai_analysis)
        except Exception:
            pass
    return photo_dict


@app.get("/plants/{plant_id}/photos/")
def get_plant_photos(
    plant_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Return all photos for a plant, newest first."""
    plant = session.get(Plant, plant_id)
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    accessible = get_accessible_garden_ids(current_user.id, session)
    if plant.garden_id not in accessible:
        raise HTTPException(status_code=403, detail="Not authorized")

    photos = session.exec(
        select(PlantPhoto).where(PlantPhoto.plant_id == plant_id).order_by(PlantPhoto.taken_at.desc())
    ).all()

    result = []
    for p in photos:
        d = p.model_dump()
        if p.ai_analysis:
            try:
                d["ai_analysis"] = json.loads(p.ai_analysis)
            except Exception:
                pass
        result.append(d)
    return result


@app.delete("/plants/{plant_id}/photos/{photo_id}")
def delete_plant_photo(
    plant_id: int,
    photo_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    photo = session.get(PlantPhoto, photo_id)
    if not photo or photo.plant_id != plant_id:
        raise HTTPException(status_code=404, detail="Photo not found")

    plant = session.get(Plant, plant_id)
    accessible = get_accessible_garden_ids(current_user.id, session)
    if plant.garden_id not in accessible:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Remove file from disk
    if photo.file_path and os.path.exists(photo.file_path):
        os.remove(photo.file_path)

    session.delete(photo)
    session.commit()
    return {"message": "Photo deleted"}


@app.post("/gardens/{garden_id}/photos/")
async def upload_garden_photo(
    garden_id: int,
    file: UploadFile = File(...),
    notes: Optional[str] = Form(None),
    locale: str = "en",
    analyze: bool = True,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Upload a timestamped garden photo and optionally run AI analysis."""
    garden = session.get(Garden, garden_id)
    if not garden:
        raise HTTPException(status_code=404, detail="Garden not found")

    accessible = get_accessible_garden_ids(current_user.id, session)
    if garden_id not in accessible:
        raise HTTPException(status_code=403, detail="Not authorized")

    os.makedirs("images", exist_ok=True)
    safe_filename = os.path.basename(file.filename or "photo.jpg")
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    file_path = f"images/garden_photo_{garden_id}_{timestamp}_{safe_filename}"

    image_bytes = await file.read()
    with open(file_path, "wb") as f:
        f.write(image_bytes)

    ai_analysis = None
    if analyze:
        try:
            api_key, model, provider = _get_ai_config(current_user)
            result = analyze_garden_photo(image_bytes, api_key, model, provider, locale)
            if result:
                ai_analysis = json.dumps(result)
        except HTTPException:
            pass
        except Exception as e:
            print(f"Garden photo analysis error: {e}")

    photo = GardenPhoto(
        garden_id=garden_id,
        file_path=file_path,
        notes=notes,
        ai_analysis=ai_analysis,
    )
    session.add(photo)
    session.commit()
    session.refresh(photo)

    photo_dict = photo.model_dump()
    if ai_analysis:
        try:
            photo_dict["ai_analysis"] = json.loads(ai_analysis)
        except Exception:
            pass
    return photo_dict


@app.get("/gardens/{garden_id}/photos/")
def get_garden_photos(
    garden_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Return all photos for a garden, newest first."""
    garden = session.get(Garden, garden_id)
    if not garden:
        raise HTTPException(status_code=404, detail="Garden not found")

    accessible = get_accessible_garden_ids(current_user.id, session)
    if garden_id not in accessible:
        raise HTTPException(status_code=403, detail="Not authorized")

    photos = session.exec(
        select(GardenPhoto).where(GardenPhoto.garden_id == garden_id).order_by(GardenPhoto.taken_at.desc())
    ).all()

    result = []
    for p in photos:
        d = p.model_dump()
        if p.ai_analysis:
            try:
                d["ai_analysis"] = json.loads(p.ai_analysis)
            except Exception:
                pass
        result.append(d)
    return result


@app.delete("/gardens/{garden_id}/photos/{photo_id}")
def delete_garden_photo(
    garden_id: int,
    photo_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    photo = session.get(GardenPhoto, photo_id)
    if not photo or photo.garden_id != garden_id:
        raise HTTPException(status_code=404, detail="Photo not found")

    garden = session.get(Garden, garden_id)
    if not garden or garden.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if photo.file_path and os.path.exists(photo.file_path):
        os.remove(photo.file_path)

    session.delete(photo)
    session.commit()
    return {"message": "Photo deleted"}


def sync_plant_tasks(plant: Plant, session: Session):
    """
    Ensure Task records match the flowering_months and pruning_months strings.
    """
    # Delete ALL existing auto-generated tasks for this plant to start fresh
    existing_tasks = session.exec(select(Task).where(Task.plant_id == plant.id, Task.is_user_override == False)).all()
    for t in existing_tasks:
        session.delete(t)
    
    # Flush deletions before adding new ones to avoid unique constraint issues if any
    session.flush()
    
    def parse_months(m_str):
        if not m_str: return []
        # Clean potential AI artifacts like [ ] or { }
        clean_str = str(m_str).replace("[", "").replace("]", "").replace("{", "").replace("}", "")
        # Use set to avoid internal duplicates
        return sorted(list(set(m.strip() for m in clean_str.split(",") if m.strip())))

    # Add new flowering tasks
    for m in parse_months(plant.flowering_months):
        if m.isdigit():
            session.add(Task(month=int(m), category="Bloei", description=f"Blooming period for {plant.common_name}", plant_id=plant.id))
    
    # Add new pruning tasks
    for m in parse_months(plant.pruning_months):
        if m.isdigit():
            session.add(Task(month=int(m), category="Snoeien", description=f"Pruning recommended for {plant.common_name}", plant_id=plant.id))
    
    # Do not commit here, let the caller handle it or use session.flush()
    session.flush()

# Task Endpoints (Calendar)
@app.get("/tasks/")
def read_tasks(month: Optional[int] = None, garden_id: Optional[int] = None, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    accessible_ids = get_accessible_garden_ids(current_user.id, session)

    # Sync all plants first to ensure calendar is accurate
    user_plants = session.exec(select(Plant).where(Plant.garden_id.in_(accessible_ids))).all()
    synced = False
    for plant in user_plants:
        task_count = session.exec(select(Task).where(Task.plant_id == plant.id)).all()
        if not task_count and (plant.flowering_months or plant.pruning_months):
            sync_plant_tasks(plant, session)
            synced = True
    
    if synced:
        session.commit()

    # For the table view, we often want ALL plants of the user, even those without tasks
    if not month:
        result = []
        # Filter plants by garden if requested
        if garden_id:
            if garden_id not in accessible_ids:
                 raise HTTPException(status_code=403, detail="No access")
            query = select(Plant).where(Plant.garden_id == garden_id)
        else:
            query = select(Plant).where(Plant.garden_id.in_(accessible_ids))
            
        plants = session.exec(query).all()
        
        for plant in plants:
            plant_dict = plant.model_dump()
            garden = session.get(Garden, plant.garden_id)
            if garden:
                plant_dict["garden_name"] = garden.name
                
            # Get tasks for this plant
            tasks = session.exec(select(Task).where(Task.plant_id == plant.id)).all()
            
            # Format to a structure the frontend table expects
            result.append({
                "plant": plant_dict,
                "tasks": [t.model_dump() for t in tasks],
                "plant_id": plant.id
            })
        return result

    # Monthly view (list mode)
    # Use a cleaner join and selection
    from sqlalchemy.orm import joinedload
    query = select(Task).options(joinedload(Task.plant)).join(Plant)
    query = query.where(Plant.garden_id.in_(accessible_ids))
    
    if month:
        query = query.where(Task.month == month)
    if garden_id:
        query = query.where(Plant.garden_id == garden_id)
    
    tasks_db = session.exec(query).all()
    
    # Group by plant
    grouped = {}
    for task in tasks_db:
        if not task.plant:
            continue
            
        p_id = task.plant_id
        if p_id not in grouped:
            plant_dict = task.plant.model_dump()
            garden = session.get(Garden, task.plant.garden_id)
            if garden:
                plant_dict["garden_name"] = garden.name
                
            grouped[p_id] = {
                "plant": plant_dict,
                "plant_id": p_id,
                "tasks": []
            }
        
        # Deduplicate tasks within the same plant group
        task_data = task.model_dump()
        is_duplicate = any(
            t["category"] == task_data["category"] and 
            t["month"] == task_data["month"] and
            t["description"] == task_data["description"]
            for t in grouped[p_id]["tasks"]
        )
        if not is_duplicate:
            grouped[p_id]["tasks"].append(task_data)
        
    return list(grouped.values())

@app.post("/tasks/")
def create_custom_task(task: Task, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # Verify access to the plant
    plant = session.get(Plant, task.plant_id)
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
        
    accessible_ids = get_accessible_garden_ids(current_user.id, session)
    if plant.garden_id not in accessible_ids:
        raise HTTPException(status_code=403, detail="Geen toegang tot deze tuin")
        
    task.is_user_override = True # Mark as manually added
    session.add(task)
    session.commit()
    session.refresh(task)
    return task

@app.patch("/tasks/{task_id}/toggle")
def toggle_task(task_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    # Check access via plant and garden
    plant = session.get(Plant, task.plant_id)
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
        
    accessible_ids = get_accessible_garden_ids(current_user.id, session)
    if plant.garden_id not in accessible_ids:
        raise HTTPException(status_code=403, detail="Geen toegang tot deze tuin")
        
    task.is_completed = not task.is_completed
    from datetime import datetime
    task.completion_date = datetime.now().isoformat() if task.is_completed else None
    
    session.add(task)
    session.commit()
    session.refresh(task)
    return task

@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    plant = session.get(Plant, task.plant_id)
    accessible_ids = get_accessible_garden_ids(current_user.id, session)
    if plant.garden_id not in accessible_ids:
        raise HTTPException(status_code=403, detail="Geen toegang")
        
    session.delete(task)
    session.commit()
    return {"message": "Task deleted"}

# Image Upload
@app.post("/plants/{plant_id}/image/")
async def upload_plant_image(
    plant_id: int, 
    file: UploadFile = File(...), 
    current_user: User = Depends(get_current_user), 
    session: Session = Depends(get_session)
):
    plant = session.get(Plant, plant_id)
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
        
    garden = session.get(Garden, plant.garden_id)
    has_shared_access = session.exec(select(GardenAccess).where(GardenAccess.garden_id == plant.garden_id, GardenAccess.user_id == current_user.id)).first()
    
    if not garden or (garden.user_id != current_user.id and not has_shared_access):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # Ensure images directory exists with an absolute path check to be safe
    abs_images_dir = os.path.join(os.getcwd(), "images")
    os.makedirs(abs_images_dir, exist_ok=True)
    
    # Sanitize filename
    safe_filename = os.path.basename(file.filename or "photo.jpg").replace(" ", "_")
    if not safe_filename:
        safe_filename = "photo.jpg"
    
    # Create a timestamped unique filename to avoid caching issues
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    file_path = f"images/{plant_id}_{timestamp}_{safe_filename}"
    full_path = os.path.join(os.getcwd(), file_path)
    
    image_bytes = await file.read()
    with open(full_path, "wb") as buffer:
        buffer.write(image_bytes)
        
    plant.image_path = file_path

    # NEW: Also add to the photo gallery (PlantPhoto) and run health analysis
    # This ensures photos taken during identification show up in the timeline too
    ai_analysis = None
    try:
        api_key, model, provider = _get_ai_config(current_user)
        plant_name = plant.common_name or plant.scientific_name or "Unknown plant"
        result = analyze_plant_health(image_bytes, plant_name, api_key, model, provider, current_user.preferred_language or "en")
        if result:
            ai_analysis = json.dumps(result)
    except Exception as e:
        print(f"Auto-analysis error during initial upload: {e}")

    photo = PlantPhoto(
        plant_id=plant_id,
        file_path=file_path,
        notes="Gevonden via identificatie" if current_user.preferred_language == "nl" else "Identified photo",
        ai_analysis=ai_analysis,
    )
    session.add(photo)
    
    session.add(plant)
    session.commit()
    session.refresh(plant)
    return {"image_path": file_path, "photo_id": photo.id}
