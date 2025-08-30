# /api/index.py
import os
import datetime
from fastapi import FastAPI, Request, HTTPException, Security
from fastapi.security import APIKeyHeader
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.params import Depends
import asyncpg
from vercel_blob import put
import pytz

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Security Setup ---
API_KEY = os.environ.get("API_SECRET_KEY")
API_KEY_NAME = "x-api-key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=True)

async def verify_api_key(key: str = Security(api_key_header)):
    """Dependency to verify the API key in the request header."""
    if key != API_KEY:
        raise HTTPException(status_code=403, detail="Could not validate credentials")
    return key

# --- Database Setup ---
DATABASE_URL = os.environ.get('POSTGRES_URL')

CREATE_TABLE_QUERY = """
CREATE TABLE IF NOT EXISTS motion_images (
    id SERIAL PRIMARY KEY,
    image_url TEXT NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS camera_control (
    id INT PRIMARY KEY,
    trigger_capture BOOLEAN NOT NULL DEFAULT FALSE
);
INSERT INTO camera_control (id, trigger_capture) VALUES (1, FALSE) ON CONFLICT (id) DO NOTHING;
"""

async def get_db_connection():
    try:
        conn = await asyncpg.connect(DATABASE_URL)
        await conn.execute(CREATE_TABLE_QUERY)
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        raise HTTPException(status_code=500, detail="Could not connect to the database.")

# --- API Endpoints (Now Secured) ---

@app.post("/api/trigger-capture", dependencies=[Depends(verify_api_key)])
async def trigger_capture():
    """Endpoint for the frontend to request a manual capture."""
    conn = await get_db_connection()
    await conn.execute("UPDATE camera_control SET trigger_capture = TRUE WHERE id = 1")
    await conn.close()
    return JSONResponse(content={"message": "Capture triggered successfully."}, status_code=200)

@app.get("/api/check-trigger", dependencies=[Depends(verify_api_key)])
async def check_trigger():
    """Endpoint for the ESP32 to poll for a manual capture command."""
    conn = await get_db_connection()
    record = await conn.fetchrow("SELECT trigger_capture FROM camera_control WHERE id = 1")
    trigger_status = record['trigger_capture'] if record else False

    if trigger_status:
        await conn.execute("UPDATE camera_control SET trigger_capture = FALSE WHERE id = 1")

    await conn.close()
    return JSONResponse(content={"trigger": trigger_status})

@app.post("/api/upload", dependencies=[Depends(verify_api_key)])
async def upload_image(request: Request):
    try:
        image_bytes = await request.body()
        if not image_bytes:
            raise HTTPException(status_code=400, detail="No image data received.")

        utc_now = datetime.datetime.now(pytz.utc)
        filename = f"motion-capture-{utc_now.strftime('%Y%m%d_%H%M%S_%f')}.jpg"

        blob_result = put(filename, image_bytes, options={'access': 'public'})
        image_url = blob_result['url']

        conn = await get_db_connection()
        await conn.execute(
            "INSERT INTO motion_images (image_url, captured_at) VALUES ($1, $2)",
            image_url,
            utc_now
        )
        await conn.close()

        return JSONResponse(content={"message": "Image uploaded successfully", "url": image_url}, status_code=201)
    except Exception as e:
        print(f"An error occurred during upload: {e}")
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/api/images", dependencies=[Depends(verify_api_key)])
async def get_images():
    try:
        conn = await get_db_connection()
        records = await conn.fetch("SELECT image_url, captured_at FROM motion_images ORDER BY captured_at DESC")
        await conn.close()

        images = [
            {"url": record["image_url"], "timestamp": record["captured_at"].isoformat()}
            for record in records
        ]
        return JSONResponse(content={"images": images})
    except Exception as e:
        print(f"An error occurred while fetching images: {e}")
        return JSONResponse(content={"error": str(e)}, status_code=500)