from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import Image as ImageModel, AnnotationFile
from app.utils.sam_model import SAMSegmenter
from pydantic import BaseModel
from typing import List, Optional
import json
from pathlib import Path
import os

router = APIRouter()
segmenter = SAMSegmenter()

class PointPrompt(BaseModel):
    image_id: int
    x: float  # Normalized coordinate (0-1)
    y: float  # Normalized coordinate (0-1)

class SegmentationResponse(BaseModel):
    success: bool
    polygon: List[List[float]]  # List of [x,y] coordinates
    annotation_id: Optional[int] = None

@router.post("/segment/", response_model=SegmentationResponse)
async def segment_from_point(
    prompt: PointPrompt,
    db: Session = Depends(get_db)
):
    """Generate segmentation from a point click"""
    image = db.query(ImageModel).filter(ImageModel.image_id == prompt.image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    try:
        # Handle both absolute and relative paths for image_path
        image_path = image.file_path
        if not os.path.isabs(image_path):
            # If it's a relative path, convert to absolute path within the container
            if image_path.startswith("uploads/"):
                image_path = "/app/" + image_path
            else:
                image_path = "/app/uploads/" + os.path.basename(image_path)
        
        # Check if file exists
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found at {image_path}")
            
        height, width = segmenter.set_image(image_path)
        
        pixel_x = int(prompt.x * width)
        pixel_y = int(prompt.y * height)
        
        mask = segmenter.predict_from_point([pixel_x, pixel_y])
        
        polygon = segmenter.mask_to_polygon(mask)
        if not polygon:
            raise HTTPException(status_code=400, detail="Could not generate polygon from mask")
        
        annotation_dir = Path("/app/annotations")  # Fixed path in container
        annotation_dir.mkdir(exist_ok=True)
        
        annotation_path = annotation_dir / f"annotation_{image.image_id}_{len(polygon)}.json"
        with open(annotation_path, "w") as f:
            json.dump({
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [polygon]
                }
            }, f)
        
        annotation = AnnotationFile(
            image_id=image.image_id,
            file_path=str(annotation_path),
            auto_generated=True
        )
        db.add(annotation)
        db.commit()
        db.refresh(annotation)
        
        return SegmentationResponse(
            success=True,
            polygon=polygon,
            annotation_id=annotation.annotation_id
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating segmentation: {str(e)}"
        )