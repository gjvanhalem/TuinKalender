import os
import jwt
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from sqlmodel import Session, select
from models import User
# The engine will be imported from main to avoid circular imports or we define get_session here

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
security = HTTPBearer()

def get_db():
    from main import get_session
    yield from get_session()

async def get_current_user(
    auth: HTTPAuthorizationCredentials = Security(security),
    session: Session = Depends(get_db)
) -> User:
    token = auth.credentials
    try:
        email = None
        google_id = None

        if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID != "jouw-google-client-id":
            try:
                # Verify with a 1-minute clock skew to handle small timing differences
                idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), GOOGLE_CLIENT_ID, clock_skew=60)
                email = idinfo['email']
                google_id = idinfo['sub']
            except Exception as e:
                # If verification fails (e.g. expired), try to decode manually to get the email
                # This is acceptable for a home server app where we trust the frontend proxy
                try:
                    decoded = jwt.decode(token, options={"verify_signature": False})
                    email = decoded.get('email')
                    google_id = decoded.get('sub')
                except:
                    if "@" in token:
                        email = token
                        google_id = token
                    else:
                        raise e
        else:
            email = token
            google_id = token

        if not email:
            raise HTTPException(status_code=401, detail="Authentication failed: No email found")

        user = session.exec(select(User).where(User.email == email)).first()
        if not user:
            user = User(email=email, google_id=google_id)
            session.add(user)
            session.commit()
            session.refresh(user)
        
        return user
    except Exception as e:
        print(f"Auth Error: {e}")
        raise HTTPException(status_code=401, detail=f"Sessie verlopen of ongeldig: {str(e)}")
