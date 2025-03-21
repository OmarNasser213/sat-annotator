from fastapi import FastAPI
from app.routers import images, segmentation
from app.db.database import engine
from app.db.models import Base
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

# Create tables
Base.metadata.create_all(bind=engine)

# Ensure uploads directory exists
uploads_dir = Path("/app/uploads")
uploads_dir.mkdir(exist_ok=True)

app = FastAPI(title="Satellite Image Annotation Tool")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins - adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(images.router, prefix="/api", tags=["images"])
app.include_router(segmentation.router, prefix="/api", tags=["segmentation"])

# Mount the uploads directory for static file serving
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

@app.get("/")
def read_root():
    return {"message": "Welcome to the Satellite Image Annotation Tool"}