import os
import uuid
from pathlib import Path
from fastapi import UploadFile
from PIL import Image

# Create upload directory with absolute path
UPLOAD_DIR = Path("/app/uploads")
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
    
    return {
        "filename": unique_filename,
        "original_filename": file.filename,
        "size": file_size,
        "content_type": file.content_type,
        "path": str(file_path),
        "resolution": resolution
    }

def validate_image_file(file: UploadFile) -> bool:
    """Validate if the file is a supported image format."""
    content_type = file.content_type
    valid_types = ["image/jpeg", "image/png", "image/tiff", "image/geotiff"]
    return content_type in valid_types