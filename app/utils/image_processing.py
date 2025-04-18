import os
import uuid
from pathlib import Path
from fastapi import UploadFile
from PIL import Image

# Determine if we're running in Docker or locally
in_docker = os.path.exists('/.dockerenv')

# Create upload directory with the appropriate path
if in_docker:
    UPLOAD_DIR = Path("/app/uploads")
else:
    # For local development, use a path relative to the project root
    UPLOAD_DIR = Path(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads"))

UPLOAD_DIR.mkdir(exist_ok=True)

async def save_upload_file(file: UploadFile) -> dict:
    """Save an uploaded file to the upload directory."""
    # Generate unique filename
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
      # Create full path
    file_path = UPLOAD_DIR / unique_filename
    
    # Save the file
    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)
    
    # Get image dimensions if possible
    resolution = None
    try:
        with Image.open(file_path) as img:
            resolution = f"{img.width}x{img.height}"
    except Exception:
        # Not a valid image or PIL cannot read it
        pass
    
    # Get file size
    file_size = os.path.getsize(file_path)
    
    # Store only the filename for the path to make it work in both Docker and local environments
    # This will be served from the /uploads/ route
    return {
        "filename": unique_filename,
        "original_filename": file.filename,
        "size": file_size,
        "content_type": file.content_type,
        "path": f"uploads/{unique_filename}",  # Use relative path for consistent access
        "resolution": resolution
    }

def validate_image_file(file: UploadFile) -> bool:
    """Validate if the file is a supported image format."""
    content_type = file.content_type
    valid_types = ["image/jpeg", "image/png", "image/tiff", "image/geotiff"]
    return content_type in valid_types