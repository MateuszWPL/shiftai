"""Security utilities for authentication."""
import hashlib
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from app.core.config import settings


def _pre_hash_password(password: str) -> bytes:
    """Pre-hash password with SHA256 to handle bcrypt's 72-byte limit."""
    # Bcrypt has a 72-byte limit, so we pre-hash with SHA256
    # This is a common pattern and is secure
    return hashlib.sha256(password.encode('utf-8')).digest()  # Returns bytes, not hex string


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    try:
        # Pre-hash the password before verification
        pre_hashed = _pre_hash_password(plain_password)
        # Convert hashed_password string to bytes if needed
        if isinstance(hashed_password, str):
            hashed_password_bytes = hashed_password.encode('utf-8')
        else:
            hashed_password_bytes = hashed_password
        return bcrypt.checkpw(pre_hashed, hashed_password_bytes)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Hash a password."""
    # Pre-hash the password to handle bcrypt's 72-byte limit
    pre_hashed = _pre_hash_password(password)
    # Generate salt and hash
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pre_hashed, salt)
    # Return as string
    return hashed.decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    
    # SECRET_KEY should always have a default value from config
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and verify a JWT access token."""
    if not settings.SECRET_KEY:
        return None
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None

