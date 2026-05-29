import uuid
import bcrypt
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, EmailStr

from db.connection import get_pool
from auth.jwt_utils import create_token, decode_token

router = APIRouter()


class RegisterBody(BaseModel):
    email: str
    password: str


class LoginBody(BaseModel):
    email: str
    password: str


def get_current_user(authorization: str = Header(None)) -> dict | None:
    """Decode JWT from Authorization header. Returns None if missing/invalid."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    try:
        return decode_token(token)
    except Exception:
        return None


@router.post("/register")
async def register(body: RegisterBody):
    pool = get_pool()
    # Hash password
    password_hash = bcrypt.hashpw(body.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    async with pool.acquire() as conn:
        existing = await conn.fetchrow("SELECT id FROM agentos_users WHERE email=$1", body.email.lower())
        if existing:
            raise HTTPException(400, "Email already registered")
        row = await conn.fetchrow(
            "INSERT INTO agentos_users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
            body.email.lower(),
            password_hash,
        )
    user_id = str(row["id"])
    token = create_token(user_id, row["email"])
    return {"token": token, "user_id": user_id, "email": row["email"]}


@router.post("/login")
async def login(body: LoginBody):
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, email, password_hash FROM agentos_users WHERE email=$1",
            body.email.lower(),
        )
    if not row:
        raise HTTPException(401, "Invalid credentials")
    if not bcrypt.checkpw(body.password.encode("utf-8"), row["password_hash"].encode("utf-8")):
        raise HTTPException(401, "Invalid credentials")
    user_id = str(row["id"])
    token = create_token(user_id, row["email"])
    return {"token": token, "user_id": user_id, "email": row["email"]}


@router.get("/me")
async def me(authorization: str = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(401, "Not authenticated")
    return {"user_id": user["sub"], "email": user.get("email")}
