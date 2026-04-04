import os
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, Session, create_engine, select
from models import Garden, Plant, Task, User
from trefle_api import search_plants, get_plant_details, extract_tasks_from_trefle_data, download_image
from ai_service import get_plant_suggestions_ai
from auth import get_current_user
from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles
import shutil

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session

app = FastAPI(title="TuinKalender API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    os.makedirs("images", exist_ok=True)

@app.get("/")
def read_root():
    return {"message": "Welcome to TuinKalender API"}

app.mount("/images", StaticFiles(directory="images"), name="images")

# User Endpoints
@app.get("/users/me", response_model=User)
def read_user_me(current_user: User = Depends(get_current_user)):
    return current_user

@app.put("/users/me", response_model=User)
def update_user_me(user_data: User, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # Re-fetch user in the current session to avoid "already attached" errors
    db_user = session.get(User, current_user.id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    db_user.trefle_token = user_data.trefle_token
    db_user.openrouter_key = user_data.openrouter_key
    db_user.openrouter_model = user_data.openrouter_model
    
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user

# Garden Endpoints
@app.post("/gardens/", response_model=Garden)
def create_garden(garden: Garden, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    garden.user_id = current_user.id
    session.add(garden)
    session.commit()
    session.refresh(garden)
    return garden

@app.get("/gardens/", response_model=List[dict])
def read_gardens(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    gardens = session.exec(select(Garden).where(Garden.user_id == current_user.id)).all()
    result = []
    for garden in gardens:
        garden_dict = garden.model_dump()
        plants = session.exec(select(Plant).where(Plant.garden_id == garden.id)).all()
        garden_dict["plant_count"] = len(plants)
        # Create a summary of the first few plants
        plant_names = [p.common_name for p in plants if p.common_name]
        if not plant_names:
            plant_names = [p.scientific_name for p in plants if p.scientific_name]
            
        summary = ", ".join(plant_names[:3])
        if len(plant_names) > 3:
            summary += "..."
        garden_dict["plant_summary"] = summary
        result.append(garden_dict)
    return result

@app.put("/gardens/{garden_id}", response_model=Garden)
def update_garden(garden_id: int, garden_data: Garden, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    db_garden = session.get(Garden, garden_id)
    if not db_garden or db_garden.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Garden not found")
    garden_data_dict = garden_data.model_dump(exclude_unset=True)
    for key, value in garden_data_dict.items():
        if key != "user_id":
            setattr(db_garden, key, value)
    session.add(db_garden)
    session.commit()
    session.refresh(db_garden)
    return db_garden

@app.delete("/gardens/{garden_id}")
def delete_garden(garden_id: int, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    db_garden = session.get(Garden, garden_id)
    if not db_garden or db_garden.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Garden not found")
    session.delete(db_garden)
    session.commit()
    return {"message": "Garden deleted"}

# Plant Endpoints
@app.post("/plants/", response_model=Plant)
def create_plant(plant: Plant, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # Verify garden ownership
    garden = session.get(Garden, plant.garden_id)
    if not garden or garden.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized for this garden")

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

            session.add(plant)
            session.commit()
            session.refresh(plant)
            
            # Download and save image if it exists
            if plant.image_url:
                local_path = download_image(plant.image_url, plant.id)
                if local_path:
                    plant.image_path = local_path
                    session.add(plant)
                    session.commit()
            
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
            session.commit()
            return plant
    
    # Manual creation or Trefle fetch failed
    session.add(plant)
    session.commit()
    session.refresh(plant)

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
    session.commit()
            
    return plant

@app.put("/plants/{plant_id}", response_model=Plant)
def update_plant(plant_id: int, plant_data: Plant, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    db_plant = session.get(Plant, plant_id)
    if not db_plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    
    # Verify ownership through garden
    garden = session.get(Garden, db_plant.garden_id)
    if not garden or garden.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    plant_data_dict = plant_data.model_dump(exclude_unset=True)
    
    # If garden_id is changing, verify ownership of the NEW garden
    if "garden_id" in plant_data_dict and plant_data_dict["garden_id"] != db_plant.garden_id:
        target_garden = session.get(Garden, plant_data_dict["garden_id"])
        if not target_garden or target_garden.user_id != current_user.id:
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
    if not garden or garden.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    session.delete(db_plant)
    session.commit()
    return {"message": "Plant deleted"}

@app.get("/plants/", response_model=List[Plant])
def read_plants(garden_id: Optional[int] = None, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    query = select(Plant).join(Garden)
    query = query.where(Garden.user_id == current_user.id)
    if garden_id:
        query = query.where(Plant.garden_id == garden_id)
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
def get_ai_suggestions(common_name: str, scientific_name: str, current_user: User = Depends(get_current_user)):
    if not current_user.openrouter_key:
        raise HTTPException(status_code=400, detail="OpenRouter API key not configured in settings")
    model = current_user.openrouter_model or "openrouter/auto"
    return get_plant_suggestions_ai(common_name, scientific_name, current_user.openrouter_key, model)

def sync_plant_tasks(plant: Plant, session: Session):
    """
    Ensure Task records match the flowering_months and pruning_months strings.
    """
    # Delete existing auto-generated tasks
    existing_tasks = session.exec(select(Task).where(Task.plant_id == plant.id, Task.is_user_override == False)).all()
    for t in existing_tasks:
        session.delete(t)
    
    def parse_months(m_str):
        if not m_str: return []
        # Clean potential AI artifacts like [ ] or { }
        clean_str = str(m_str).replace("[", "").replace("]", "").replace("{", "").replace("}", "")
        # Use set to avoid internal duplicates
        return sorted(list(set(m.strip() for m in clean_str.split(",") if m.strip())))

    # Add new flowering tasks
    for m in parse_months(plant.flowering_months):
        if m.isdigit():
            session.add(Task(month=int(m), category="Bloei", description=f"Bloeiperiode voor {plant.common_name}", plant_id=plant.id))
    
    # Add new pruning tasks
    for m in parse_months(plant.pruning_months):
        if m.isdigit():
            session.add(Task(month=int(m), category="Snoeien", description=f"Snoeien aanbevolen voor {plant.common_name}", plant_id=plant.id))
    
    session.commit()

# Task Endpoints (Calendar)
@app.get("/tasks/")
def read_tasks(month: Optional[int] = None, garden_id: Optional[int] = None, current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # Sync all plants first to ensure calendar is accurate
    user_plants = session.exec(select(Plant).join(Garden).where(Garden.user_id == current_user.id)).all()
    for plant in user_plants:
        task_count = session.exec(select(Task).where(Task.plant_id == plant.id)).all()
        if not task_count and (plant.flowering_months or plant.pruning_months):
            sync_plant_tasks(plant, session)

    # For the table view, we often want ALL plants of the user, even those without tasks
    if not month:
        result = []
        # Filter plants by garden if requested
        query = select(Plant).join(Garden).where(Garden.user_id == current_user.id)
        if garden_id:
            query = query.where(Plant.garden_id == garden_id)
        plants = session.exec(query).all()
        
        for plant in plants:
            plant_dict = plant.model_dump()
            garden = session.get(Garden, plant.garden_id)
            if garden:
                plant_dict["garden_name"] = garden.name
                
            # Get tasks for this plant
            tasks = session.exec(select(Task).where(Task.plant_id == plant.id)).all()
            
            # If no tasks but we have flowering/pruning strings, they should have been synced above
            # but let's just use them as a fallback for the view if needed
            
            # Format to a structure the frontend table expects:
            # We can just return the plant with a 'tasks' list
            result.append({
                "plant": plant_dict,
                "tasks": [t.model_dump() for t in tasks],
                "plant_id": plant.id
            })
        return result

    # Monthly view (list mode)
    query = select(Task, Plant).join(Plant).join(Garden)
    query = query.where(Garden.user_id == current_user.id)
    if month:
        query = query.where(Task.month == month)
    if garden_id:
        query = query.where(Plant.garden_id == garden_id)
    results = session.exec(query).all()
    
    # Group by plant for monthly list view
    grouped_results = {}
    for task, plant in results:
        if plant.id not in grouped_results:
            plant_dict = plant.model_dump()
            garden = session.get(Garden, plant.garden_id)
            if garden:
                plant_dict["garden_name"] = garden.name
            
            grouped_results[plant.id] = {
                "plant": plant_dict,
                "categories": [task.category],
                "descriptions": [task.description],
                "id": task.id,
                "plant_id": plant.id
            }
        else:
            if task.category not in grouped_results[plant.id]["categories"]:
                grouped_results[plant.id]["categories"].append(task.category)
            if task.description not in grouped_results[plant.id]["descriptions"]:
                grouped_results[plant.id]["descriptions"].append(task.description)

    formatted_tasks = []
    for plant_id, data in grouped_results.items():
        formatted_tasks.append({
            "id": data["id"],
            "plant_id": data["plant_id"],
            "category": ", ".join(data["categories"]),
            "description": " • ".join(data["descriptions"]),
            "plant": data["plant"]
        })
        
    return formatted_tasks

# Image Upload
@app.post("/plants/{plant_id}/image/")
async def upload_plant_image(plant_id: int, file: UploadFile = File(...), current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    plant = session.get(Plant, plant_id)
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
        
    garden = session.get(Garden, plant.garden_id)
    if not garden or garden.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    os.makedirs("images", exist_ok=True)
    file_path = f"images/{plant_id}_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    plant.image_path = file_path
    session.add(plant)
    session.commit()
    session.refresh(plant)
    return {"image_path": file_path}
