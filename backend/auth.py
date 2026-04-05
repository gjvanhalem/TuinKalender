import os
import jwt
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from sqlmodel import Session, select, func
from models import User
from database import get_session
from dotenv import load_dotenv

load_dotenv()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
security = HTTPBearer()

async def get_current_user(
    auth: HTTPAuthorizationCredentials = Security(security),
    session: Session = Depends(get_session)
) -> User:
    token = auth.credentials
    try:
        email = None
        google_id = None

        if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID != "jouw-google-client-id":
            # Verify with a 1-minute clock skew to handle small timing differences
            idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), GOOGLE_CLIENT_ID, clock_skew_in_seconds=60)
            email = idinfo['email']
            google_id = idinfo['sub']
        else:
            raise HTTPException(status_code=500, detail="Google Client ID not configured on backend")

        if not email:
            raise HTTPException(status_code=401, detail="Authentication failed: No email found")

        # Check if any users exist in the system
        user_count = session.exec(select(func.count(User.id))).one()
        
        user = session.exec(select(User).where(User.email == email)).first()
        
        if user_count == 0:
            # First user becomes admin automatically
            user = User(email=email, google_id=google_id, is_admin=True, is_active=True)
            session.add(user)
            session.commit()
            session.refresh(user)
        elif not user:
            # Not in allowed list
            raise HTTPException(status_code=403, detail="Toegang geweigerd. U bent niet uitgenodigd voor dit systeem.")
        else:
            # User exists, check if active
            if not user.is_active:
                raise HTTPException(status_code=403, detail="Uw account is gedeactiveerd.")
            
            # Update google_id if it was an email-only invite
            if not user.google_id:
                user.google_id = google_id
                session.add(user)
                session.commit()
                session.refresh(user)
        
        return user
    except HTTPException:
        raise
    except Exception as e:
        print(f"Auth Error: {e}")
        raise HTTPException(status_code=401, detail=f"Sessie verlopen of ongeldig: {str(e)}")
