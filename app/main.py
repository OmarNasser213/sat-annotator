from fastapi import FastAPI
from app.routers import images, segmentation
from app.db.database import engine
from app.db.models import Base

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Satellite Image Annotation Tool")

# Include routers
app.include_router(images.router, prefix="/api", tags=["images"])
app.include_router(segmentation.router, prefix="/api", tags=["segmentation"])

@app.get("/")
def read_root():
    return {"message": "Welcome to the Satellite Image Annotation Tool"}