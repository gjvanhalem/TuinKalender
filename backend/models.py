import os
from typing import Optional, List, Any
from sqlmodel import Field, SQLModel, Relationship, JSON

DEFAULT_MODEL = os.getenv("DEFAULT_OPENROUTER_MODEL", "google/gemini-2.0-flash-lite-preview-02-05:free")

class GardenAccess(SQLModel, table=True):
    garden_id: int = Field(foreign_key="garden.id", primary_key=True)
    user_id: int = Field(foreign_key="user.id", primary_key=True)

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    name: Optional[str] = None
    google_id: Optional[str] = Field(default=None, index=True, unique=True)
    is_active: bool = Field(default=True)
    is_admin: bool = Field(default=False)
    trefle_token: Optional[str] = None
    openrouter_key: Optional[str] = None
    openrouter_model: Optional[str] = Field(default=DEFAULT_MODEL)
    openai_key: Optional[str] = None
    openai_model: Optional[str] = Field(default="gpt-4o-mini")
    ai_provider: str = Field(default="openrouter") # "openrouter" or "openai"
    
    gardens: List["Garden"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    shared_gardens: List["Garden"] = Relationship(back_populates="shared_users", link_model=GardenAccess)

class Garden(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    location: Optional[str] = None
    image_path: Optional[str] = None
    
    user_id: int = Field(foreign_key="user.id")
    user: User = Relationship(back_populates="gardens")
    plants: List["Plant"] = Relationship(back_populates="garden", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    
    shared_users: List[User] = Relationship(back_populates="shared_gardens", link_model=GardenAccess)

class Plant(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    common_name: Optional[str] = None
    scientific_name: Optional[str] = None
    trefle_id: Optional[int] = None
    location_in_garden: Optional[str] = None
    image_path: Optional[str] = None
    image_url: Optional[str] = None # Original Trefle URL
    remarks: Optional[str] = None # Opmerkingen
    flowering_months: Optional[str] = None # e.g. "4,5,6"
    pruning_months: Optional[str] = None # e.g. "3,10"
    raw_data: Optional[dict] = Field(default=None, sa_type=JSON) # Store all Trefle data
    
    garden_id: int = Field(foreign_key="garden.id")
    garden: Garden = Relationship(back_populates="plants")
    tasks: List["Task"] = Relationship(back_populates="plant", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class Task(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    month: int # 1-12
    category: str # Pruning, Flowering, Planting, etc.
    description: str
    is_user_override: bool = Field(default=False)
    
    plant_id: int = Field(foreign_key="plant.id")
    plant: Plant = Relationship(back_populates="tasks")
