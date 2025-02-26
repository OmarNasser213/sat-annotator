from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import Image as ImageModel
from app.utils.image_processing import save_upload_file, validate_image_file
from app.schemas.images import UploadResponse, Image, ImageCreate
from typing import List

router = APIRouter()

@router.post("/upload-image/", response_model=UploadResponse)
async def upload_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload a satellite image file for annotation.
    
    Supports JPG, PNG, TIFF and GeoTIFF formats.
    """
    # Validate file type
    if not file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file provided"
        )
        
    if not validate_image_file(file):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="File type not supported. Please upload JPG, PNG, TIFF or GeoTIFF"
        )
    
    # Process and save the file
    try:
        file_info = await save_upload_file(file)
        
        # Save to database
        db_image = ImageModel(
            file_name=file_info["original_filename"],
            file_path=file_info["path"],
            resolution=file_info["resolution"],
            source="user_upload"
        )
        
        db.add(db_image)
        db.commit()
        db.refresh(db_image)
        
        return UploadResponse(
            success=True,
            message="File uploaded successfully",
            image=Image.from_orm(db_image)
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error uploading file: {str(e)}"
        )

@router.get("/images/", response_model=List[Image])
def get_images(
    skip: int = 0, 
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get list of uploaded images"""
    images = db.query(ImageModel).offset(skip).limit(limit).all()
    return images