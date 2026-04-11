from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func
from database import get_session
from models import User

router = APIRouter(prefix="/auth", tags=["auth"])

@router.get("/check-invite")
def check_invite(email: str, session: Session = Depends(get_session)):
    # Normalize email to lowercase
    email_lower = email.lower()
    
    user_count = session.exec(select(func.count(User.id))).one()
    print(f"Checking invite for: {email_lower} (Total users in DB: {user_count})")
    
    if user_count == 0:
        print(f"First user detected, allowing: {email_lower}")
        return {"allowed": True, "reason": "first_user"}
    
    # Check if user exists (case-insensitive)
    user = session.exec(select(User).where(func.lower(User.email) == email_lower)).first()
    if user:
        if user.is_active:
            print(f"User found and active: {email_lower}")
            return {"allowed": True}
        else:
            print(f"User found but deactivated: {email_lower}")
            return {"allowed": False, "reason": "deactivated"}
    
    print(f"User not found in allowed list: {email_lower}")
    return {"allowed": False, "reason": "not_invited"}
