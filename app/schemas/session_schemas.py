from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class ImageBase(BaseModel):
    file_name: str
    file_path: str
    resolution: Optional[str] = None
    source: Optional[str] = None


class ImageCreate(ImageBase):
    pass


class Image(ImageBase):
    image_id: str  # Now using UUID string instead of int
    capture_date: datetime
    created_at: datetime


class UploadResponse(BaseModel):
    success: bool
    message: str
    image: Optional[Image] = None


class AnnotationBase(BaseModel):
    file_path: str
    auto_generated: bool = False


class AnnotationCreate(AnnotationBase):
    image_id: str


class Annotation(AnnotationBase):
    annotation_id: str
    image_id: str
    created_at: datetime


class SessionInfo(BaseModel):
    session_id: str
    image_count: int
    annotation_count: int
    created_at: datetime


# Manual annotation schemas for frontend requests
class ManualAnnotationCreate(BaseModel):
    image_id: str
    id: str  # Annotation ID from frontend
    type: str = "polygon"
    polygon: List[List[float]]  # List of [x, y] coordinate pairs (normalized 0-1)
    label: str
    source: str = "manual"


class ManualAnnotationUpdate(BaseModel):
    polygon: Optional[List[List[float]]] = None
    label: Optional[str] = None


class AnnotationResponse(BaseModel):
    success: bool
    message: str
    annotation_id: Optional[str] = None
