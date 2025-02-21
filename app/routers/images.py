from fastapi import APIRouter, UploadFile, File

router = APIRouter()

@router.post("/upload-image/")
async def upload_image(file: UploadFile = File(...)):
    return {"filename": file.filename}