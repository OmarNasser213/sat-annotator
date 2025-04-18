from fastapi import APIRouter, HTTPException, Depends, status
from app.storage.session_manager import get_session_manager, SessionManager
from app.storage.session_store import session_store
from app.utils.sam_model import SAMSegmenter
from pydantic import BaseModel
from typing import List, Optional
import json
from pathlib import Path
import os
import logging
from datetime import datetime

# Set up logging
log_dir = Path("app/logs")
log_dir.mkdir(exist_ok=True)
log_filename = f"debug_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_dir / log_filename),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("segmentation_router")

router = APIRouter()
segmenter = SAMSegmenter()

class PointPrompt(BaseModel):
    image_id: str  # Now using UUID string instead of int
    x: float  # Normalized coordinate (0-1)
    y: float  # Normalized coordinate (0-1)

class SegmentationResponse(BaseModel):
    success: bool
    polygon: List[List[float]]  # List of [x,y] coordinates
    annotation_id: Optional[str] = None  # Now using UUID string instead of int
    cached: bool = False  # Indicates whether this result was from cache

@router.post("/segment/", response_model=SegmentationResponse)
async def segment_from_point(
    prompt: PointPrompt,
    session_manager: SessionManager = Depends(get_session_manager)
):
    """Generate segmentation from a point click, with caching for subsequent clicks on the same image."""
    session_id = session_manager.session_id
    image = session_store.get_image(session_id, prompt.image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    try:
        # Get the image path from the session store
        stored_path = image.file_path
        
        # Handle paths for both local development and Docker environments
        in_docker = os.path.exists('/.dockerenv')
        
        if in_docker:
            # In Docker environment
            if stored_path.startswith("uploads/"):
                image_path = "/app/" + stored_path
            else:
                image_path = "/app/uploads/" + os.path.basename(stored_path)
        else:
            # In local development environment
            if stored_path.startswith("uploads/"):
                # Convert relative path to absolute path in the local environment
                base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                image_path = os.path.join(base_dir, stored_path)
            else:
                # Handle any other format (like full paths)
                image_path = stored_path
        
        # Check if file exists
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found at {image_path}")
        
        # Check if this is a new image or one we've already processed
        is_cached = image_path == segmenter.current_image_path and image_path in segmenter.cache
        
        logger.debug(f"Processing image: {image_path}, cached: {is_cached}")
        
        # Set the image in the segmenter (this will use cache if available)
        height, width = segmenter.set_image(image_path)
        pixel_x = int(prompt.x * width)
        pixel_y = int(prompt.y * height)
        
        logger.debug(f"Click at coordinates: ({pixel_x}, {pixel_y}) for image size: {width}x{height}")
        
        # Get mask from point (either new or cached)
        mask = segmenter.predict_from_point([pixel_x, pixel_y])
        polygon = segmenter.mask_to_polygon(mask)
        
        if not polygon:
            raise HTTPException(status_code=400, detail="Could not generate polygon from mask")
        
        # Handle annotations directory path for both Docker and local environments
        if in_docker:
            annotation_dir = Path("/app/annotations")  # Docker path
        else:
            # For local development, use a path relative to the project root
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            annotation_dir = Path(os.path.join(base_dir, "annotations"))
            
        annotation_dir.mkdir(exist_ok=True)
        
        # Include session ID in the annotation filename to avoid conflicts
        annotation_path = annotation_dir / f"annotation_{session_id}_{image.image_id}_{len(polygon)}.json"
        with open(annotation_path, "w") as f:
            json.dump({
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [polygon]
                },
                "properties": {
                    "cached": is_cached
                }
            }, f)
        
        # Add annotation to session store
        annotation = session_store.add_annotation(
            session_id=session_id,
            image_id=image.image_id,
            file_path=str(annotation_path),
            auto_generated=True
        )
        
        logger.debug(f"Generated segmentation with {len(polygon)} points, cached: {is_cached}")
        
        return SegmentationResponse(
            success=True,
            polygon=polygon,
            annotation_id=annotation.annotation_id if annotation else None,
            cached=is_cached
        )
        
    except Exception as e:
        logger.error(f"Error in segmentation: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating segmentation: {str(e)}"
        )

@router.get("/annotations/{image_id}")
async def get_image_annotations(
    image_id: str,
    session_manager: SessionManager = Depends(get_session_manager)
):
    """Get all annotations for a specific image"""
    session_id = session_manager.session_id
    
    # Check if image exists
    image = session_store.get_image(session_id, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Get annotations for this image
    annotations = session_store.get_annotations(session_id, image_id)
    
    # Load actual annotation data from files
    result = []
    for ann in annotations:
        try:
            file_path = ann.file_path
            if os.path.exists(file_path):
                with open(file_path, 'r') as f:
                    geojson = json.load(f)
                
                result.append({
                    "annotation_id": ann.annotation_id,
                    "created_at": ann.created_at,
                    "auto_generated": ann.auto_generated,
                    "data": geojson
                })
        except Exception as e:
            # Skip annotations with errors
            continue
    
    return result

@router.post("/clear-cache/{image_id}")
async def clear_image_cache(
    image_id: str,
    session_manager: SessionManager = Depends(get_session_manager)
):
    """Clear the segmentation cache for a specific image"""
    session_id = session_manager.session_id
    image = session_store.get_image(session_id, image_id)
    
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Get the absolute image path
    stored_path = image.file_path
    in_docker = os.path.exists('/.dockerenv')
    
    if in_docker:
        if stored_path.startswith("uploads/"):
            image_path = "/app/" + stored_path
        else:
            image_path = "/app/uploads/" + os.path.basename(stored_path)
    else:
        if stored_path.startswith("uploads/"):
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            image_path = os.path.join(base_dir, stored_path)
        else:
            image_path = stored_path
    
    # Clear the cache for this image
    segmenter.clear_cache(image_path)
    
    return {"success": True, "message": f"Cache cleared for image {image_id}"}
