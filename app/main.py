from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import os
import sys
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add the app directory to the path to handle imports
app_dir = os.path.dirname(os.path.abspath(__file__))
if app_dir not in sys.path:
    sys.path.insert(0, app_dir)

# Try different import strategies
try:
    # For uvicorn from root directory
    from app.routers import session_images, session_segmentation
    print("Using app.routers imports")
except ImportError:
    try:
        # For running directly from app directory
        from routers import session_images, session_segmentation
        print("Using direct routers imports")
    except ImportError as e:
        print(f"Import error: {e}")
        # Final fallback - try with explicit path manipulation
        sys.path.insert(0, os.path.dirname(app_dir))
        from app.routers import session_images, session_segmentation
        print("Using fallback app.routers imports")

try:
    from app.utils.test_utils import is_test_mode
    test_mode = is_test_mode()
except ImportError:
    try:
        from utils.test_utils import is_test_mode
        test_mode = is_test_mode()
    except ImportError:
        test_mode = False

# Determine if we're running in Docker or locally
in_docker = os.path.exists('/.dockerenv') and not test_mode

# Set paths based on environment
base_path = Path("/app") if in_docker else Path(".")

# Ensure uploads directory exists
uploads_dir = base_path / "uploads"
uploads_dir.mkdir(exist_ok=True)

# Ensure annotations directory exists
annotations_dir = base_path / "annotations"
annotations_dir.mkdir(exist_ok=True)

# Define frontend directory for static files (if available)
frontend_dir = base_path / "web"

app = FastAPI(title="Satellite Image Annotation Tool")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins - adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint for Docker container orchestration
@app.get("/health")
def health_check():
    return {"status": "healthy"}

# Include session-based routers
app.include_router(session_images.router, prefix="/api", tags=["images"])
app.include_router(session_segmentation.router, prefix="/api", tags=["segmentation"])

# Mount the uploads directory for static file serving
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

# Mount frontend if the web directory exists
if frontend_dir.exists() and (frontend_dir / "index.html").exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
else:
    @app.get("/")
    def read_root():
        return {"message": "Welcome to the Satellite Image Annotation Tool (API Only Mode)"}
        
    @app.get("/frontend-status")
    def frontend_status():
        return {"status": "not_mounted", "message": "Frontend not found. Make sure the web directory contains index.html."}