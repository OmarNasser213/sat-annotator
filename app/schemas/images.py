from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ImageBase(BaseModel):
    file_name: str
    file_path: str
    resolution: Optional[str] = None
    source: Optional[str] = None

class ImageCreate(ImageBase):
    pass

class Image(ImageBase):
    image_id: int
    capture_date: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True  # For SQLAlchemy models (formerly orm_mode)

class UploadResponse(BaseModel):
    success: bool
    message: str
    image: Optional[Image] = None