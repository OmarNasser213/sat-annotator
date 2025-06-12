import os
import uuid
import logging
from pathlib import Path
from fastapi import UploadFile
from PIL import Image

# Set up logging
logger = logging.getLogger(__name__)

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
    """Save an uploaded file to the upload directory and convert TIFF to PNG if needed."""
    # Generate unique filename
    file_extension = os.path.splitext(file.filename)[1].lower()
    temp_filename = f"{uuid.uuid4()}{file_extension}"
    
    # Create temporary file path
    temp_file_path = UPLOAD_DIR / temp_filename
    
    # Save the original file temporarily
    contents = await file.read()
    with open(temp_file_path, "wb") as f:
        f.write(contents)
    
    # Check if we need to convert TIFF to PNG for browser compatibility
    final_file_path = temp_file_path
    final_filename = temp_filename
    
    if file_extension in ['.tif', '.tiff']:
        # Convert TIFF to PNG for browser compatibility
        png_filename = f"{uuid.uuid4()}.png"
        png_file_path = UPLOAD_DIR / png_filename
        
        try:
            with Image.open(temp_file_path) as img:
                # Convert to RGB if necessary (some TIFFs might be in different color modes)
                if img.mode not in ('RGB', 'RGBA'):
                    img = img.convert('RGB')
                # Save as PNG
                img.save(png_file_path, 'PNG')
                
                # Remove the temporary TIFF file
                os.remove(temp_file_path)
                  # Use the PNG file as the final file
                final_file_path = png_file_path
                final_filename = png_filename
        except Exception as e:
            # If conversion fails, keep the original TIFF file
            logger.warning(f"Failed to convert TIFF to PNG: {e}")
    
    # Get image dimensions and resolution
    resolution = None
    try:
        with Image.open(final_file_path) as img:
            resolution = f"{img.width}x{img.height}"
    except Exception:
        # Not a valid image or PIL cannot read it
        pass    
    # Get file size
    file_size = os.path.getsize(final_file_path)
    
    # Store only the filename for the path to make it work in both Docker and local environments
    # This will be served from the /uploads/ route
    return {
        "filename": final_filename,
        "original_filename": file.filename,
        "size": file_size,
        "content_type": file.content_type,
        "path": f"uploads/{final_filename}",  # Use relative path for consistent access
        "resolution": resolution
    }

def validate_image_file(file: UploadFile) -> bool:
    """Validate if the file is a supported image format."""
    content_type = file.content_type
    valid_types = ["image/jpeg", "image/png", "image/tiff", "image/geotiff"]
    return content_type in valid_types