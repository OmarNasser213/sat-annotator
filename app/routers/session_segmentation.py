from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import FileResponse
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
import cv2
from app.schemas.session_schemas import (
    ManualAnnotationCreate,
    ManualAnnotationUpdate,
    AnnotationResponse,
)

# Set up logging
log_dir = Path("logs")
log_dir.mkdir(exist_ok=True)
log_filename = f"debug_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
logging.basicConfig(
    level=logging.INFO,  # Changed from DEBUG to INFO
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler(log_dir / log_filename), logging.StreamHandler()],
)
logger = logging.getLogger("segmentation_router")

router = APIRouter()
segmenter = SAMSegmenter()


def construct_image_path(stored_path):
    """Construct consistent image path for both preprocessing and segmentation"""
    # Determine if running in Docker
    in_docker = os.path.exists("/.dockerenv")

    if not os.path.isabs(stored_path):
        if in_docker:
            # Docker environment
            if stored_path.startswith("uploads/"):
                image_path = "/app/" + stored_path
            else:
                image_path = "/app/uploads/" + os.path.basename(stored_path)
        else:
            # Local environment
            if stored_path.startswith("uploads/"):
                base_dir = os.path.dirname(
                    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                )
                image_path = os.path.join(base_dir, stored_path)
            else:
                image_path = stored_path
    else:
        image_path = stored_path

    return image_path


class PointPrompt(BaseModel):
    image_id: str
    x: float
    y: float


class SegmentationResponse(BaseModel):
    success: bool
    polygon: List[List[float]]
    annotation_id: Optional[str] = None
    cached: bool = False
    processing_time: Optional[float] = None


class PreprocessRequest(BaseModel):
    image_id: str


class PreprocessResponse(BaseModel):
    success: bool
    message: str


@router.post("/segment/", response_model=SegmentationResponse)
async def segment_from_point(
    prompt: PointPrompt, session_manager: SessionManager = Depends(get_session_manager)
):
    """Generate segmentation from a point click with timeout handling"""
    import asyncio
    import concurrent.futures

    session_id = session_manager.session_id

    # Debug: log the received coordinates
    logger.debug(
        f"Received segmentation request: image_id={prompt.image_id}, x={prompt.x}, y={prompt.y}"
    )

    image = session_store.get_image(session_id, prompt.image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    try:
        import time

        timings = {}
        op_start = time.time()

        # Determine if running in Docker
        in_docker = os.path.exists("/.dockerenv")
        timings["env_check"] = time.time() - op_start

        # Define annotation directory
        t0 = time.time()
        if in_docker:
            annotation_dir = Path("/app/annotations")
        else:
            base_dir = os.path.dirname(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            )
            annotation_dir = Path(os.path.join(base_dir, "annotations"))
        annotation_dir.mkdir(exist_ok=True)
        timings["annotation_dir"] = time.time() - t0

        # Get the image path from the session store
        t1 = time.time()
        stored_path = image.file_path
        image_path = construct_image_path(stored_path)
        timings["construct_image_path"] = time.time() - t1

        # Check if file exists
        t2 = time.time()
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found at {image_path}")
        timings["file_exists"] = time.time() - t2

        # Check if this is a new image or one we've already processed
        t3 = time.time()
        is_cached = (
            image_path == segmenter.current_image_path and image_path in segmenter.cache
        )
        timings["cache_check"] = time.time() - t3

        logger.info(
            f"Processing image: {image_path}, cached: {is_cached}, current: {segmenter.current_image_path}"
        )

        def run_segmentation():
            op_times = {}
            op_times["start"] = time.time()
            # OPTIMIZED: Only set image if it's not already the current image
            if segmenter.current_image_path != image_path:
                logger.info(f"Setting new image in SAM: {image_path}")
                t_set = time.time()
                height, width = segmenter.set_image(image_path)
                op_times["set_image"] = time.time() - t_set
            else:
                logger.info(f"Using already-set image (instant segmentation!)")
                t_cache = time.time()
                if image_path in segmenter.cache:
                    height, width = segmenter.cache[image_path]["image_size"]
                else:
                    logger.warning(f"Image not in cache, falling back to set_image")
                    height, width = segmenter.set_image(image_path)
                op_times["cache_lookup"] = time.time() - t_cache

            pixel_x = int(prompt.x * width)
            pixel_y = int(prompt.y * height)
            logger.info(
                f"Click at coordinates: ({pixel_x}, {pixel_y}) for image size: {width}x{height}"
            )

            # Get mask from point (GPU accelerated)
            t_mask = time.time()
            mask = segmenter.predict_from_point([pixel_x, pixel_y])
            op_times["mask_generation"] = time.time() - t_mask
            logger.info(f"Mask generation time: {op_times['mask_generation']:.3f}s")

            # Convert mask to polygon immediately
            t_poly = time.time()
            polygon = segmenter.mask_to_polygon(mask)
            op_times["polygon_conversion"] = time.time() - t_poly
            logger.info(
                f"Polygon conversion time: {op_times['polygon_conversion']:.3f}s"
            )

            if not polygon:
                raise ValueError("Could not generate polygon from mask")

            op_times["total"] = time.time() - op_times["start"]
            logger.info(f"Segmentation operation timings: {op_times}")
            # Find the slowest step (excluding 'start' and 'total')
            slowest_step = None
            slowest_time = 0.0
            for k, v in op_times.items():
                if k not in ("start", "total") and v > slowest_time:
                    slowest_step = k
                    slowest_time = v
            if slowest_step:
                logger.info(f"SLOWEST STEP: {slowest_step} took {slowest_time:.3f}s")
            return polygon, is_cached, op_times

        # Execute with timeout (30 seconds)
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(run_segmentation)
            try:
                polygon, is_cached, seg_timings = await asyncio.wait_for(
                    asyncio.wrap_future(future), timeout=30.0
                )
            except asyncio.TimeoutError:
                raise HTTPException(
                    status_code=408,
                    detail="Segmentation timeout - image may still be processing...",
                )

        # Save JSON
        t_save = time.time()
        annotation_path = (
            annotation_dir
            / f"annotation_{session_id}_{image.image_id}_{len(polygon)}.json"
        )
        with open(annotation_path, "w") as f:
            json.dump(
                {
                    "type": "Feature",
                    "geometry": {"type": "Polygon", "coordinates": [polygon]},
                    "properties": {"cached": is_cached},
                },
                f,
            )
        timings["save_json"] = time.time() - t_save

        # Add annotation to session store
        t_ann = time.time()
        annotation = session_store.add_annotation(
            session_id=session_id,
            image_id=image.image_id,
            file_path=str(annotation_path),
            auto_generated=True,
        )
        timings["add_annotation"] = time.time() - t_ann

        logger.info(
            f"Generated segmentation with {len(polygon)} points, cached: {is_cached}"
        )
        total_processing_time = time.time() - op_start
        logger.info(f"Total segmentation processing time: {total_processing_time:.3f}s")
        logger.info(f"Step timings: {timings}")

        # Optionally, include detailed timings in the response for debugging
        return SegmentationResponse(
            success=True,
            polygon=polygon,
            annotation_id=annotation.annotation_id if annotation else None,
            cached=is_cached,
            processing_time=total_processing_time,
            timings={**timings, **seg_timings},
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in segmentation: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating segmentation: {str(e)}",
        )


@router.get("/masks/{session_id}/{image_id}/{mask_type}")
async def get_mask_image(session_id: str, image_id: str, mask_type: str):
    """Serve mask or overlay image for download or display."""
    if mask_type not in ["mask", "overlay"]:
        raise HTTPException(
            status_code=400, detail="Invalid mask_type. Use 'mask' or 'overlay'."
        )
    mask_path = Path(f"/app/annotations/{mask_type}_{session_id}_{image_id}.png")
    if not mask_path.exists():
        raise HTTPException(status_code=404, detail=f"{mask_type} image not found")
    return FileResponse(
        mask_path,
        media_type="image/png",
        filename=f"{mask_type}_{session_id}_{image_id}.png",
    )


@router.get("/annotations/{image_id}")
async def get_image_annotations(
    image_id: str, session_manager: SessionManager = Depends(get_session_manager)
):
    """Get all annotations for a specific image"""
    session_id = session_manager.session_id
    image = session_store.get_image(session_id, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    annotations = session_store.get_annotations(session_id, image_id)

    result = []
    for ann in annotations:
        try:
            file_path = ann.file_path
            if os.path.exists(file_path):
                with open(file_path, "r") as f:
                    json_data = json.load(f)  # DEBUG: Log what we're loading
                if json_data.get("features") and len(json_data["features"]) > 0:
                    feature = json_data["features"][0]
                    if feature.get("geometry", {}).get("coordinates"):
                        coords = feature["geometry"]["coordinates"]

                result.append(
                    {
                        "annotation_id": ann.annotation_id,
                        "created_at": ann.created_at,
                        "auto_generated": ann.auto_generated,
                        "data": json_data,
                    }
                )
        except Exception as e:
            logger.error(f"Error loading annotation {ann.annotation_id}: {e}")
            continue

    return result


@router.post("/clear-cache/{image_id}")
async def clear_image_cache(
    image_id: str, session_manager: SessionManager = Depends(get_session_manager)
):
    """Clear the segmentation cache for a specific image"""
    session_id = session_manager.session_id
    image = session_store.get_image(session_id, image_id)

    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    # Use unified path construction
    image_path = construct_image_path(image.file_path)

    segmenter.clear_cache(image_path)

    return {"success": True, "message": f"Cache cleared for image {image_id}"}


@router.post("/annotations/", response_model=AnnotationResponse)
async def save_manual_annotation(
    annotation_data: ManualAnnotationCreate,
    session_manager: SessionManager = Depends(get_session_manager),
):
    """Save a manual annotation"""
    session_id = session_manager.session_id

    # Verify the image exists
    image = session_store.get_image(session_id, annotation_data.image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    try:
        # Define annotation directory
        in_docker = os.path.exists("/.dockerenv")
        if in_docker:
            annotation_dir = Path("/app/annotations")
        else:
            base_dir = os.path.dirname(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            )
            annotation_dir = Path(os.path.join(base_dir, "annotations"))
        annotation_dir.mkdir(exist_ok=True)

        # Create JSON format for the annotation
        json_data = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {
                        "label": annotation_data.label,
                        "type": annotation_data.type,
                        "source": annotation_data.source,
                        "created": datetime.now().isoformat(),
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [
                            annotation_data.polygon
                        ],  # Fix: Direct polygon array, not nested
                    },
                }
            ],
        }
        # Save annotation file
        annotation_path = (
            annotation_dir
            / f"manual_{session_id}_{annotation_data.image_id}_{annotation_data.id}.json"
        )
        with open(annotation_path, "w") as f:
            json.dump(json_data, f, indent=2)

        # Add annotation to session store
        annotation = session_store.add_annotation(
            session_id,
            annotation_data.image_id,
            annotation_id=annotation_data.id,
            file_path=str(annotation_path),
            auto_generated=False,
        )

        return AnnotationResponse(
            success=True,
            message="Annotation saved successfully",
            annotation_id=(
                annotation.annotation_id if annotation else annotation_data.id
            ),
        )

    except Exception as e:
        logger.error(f"Error saving annotation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error saving annotation: {str(e)}",
        )


@router.put("/annotations/{annotation_id}", response_model=AnnotationResponse)
async def update_annotation(
    annotation_id: str,
    update_data: ManualAnnotationUpdate,
    session_manager: SessionManager = Depends(get_session_manager),
):
    """Update an existing annotation"""
    session_id = session_manager.session_id

    # Get the annotation from session store
    annotation = session_store.get_annotation(session_id, annotation_id)
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")

    try:  # Load existing annotation data
        if not os.path.exists(annotation.file_path):
            raise HTTPException(status_code=404, detail="Annotation file not found")

        with open(annotation.file_path, "r") as f:
            json_data = json.load(f)

        # Update the data
        if json_data.get("features"):
            feature = json_data["features"][0]

            if update_data.polygon:
                feature["geometry"]["coordinates"] = [
                    [[point[0], point[1]] for point in update_data.polygon]
                ]

            if update_data.label:
                feature["properties"]["label"] = update_data.label

            # Update modified timestamp
            feature["properties"]["modified"] = datetime.now().isoformat()
        # Save updated annotation
        with open(annotation.file_path, "w") as f:
            json.dump(json_data, f, indent=2)

        return AnnotationResponse(
            success=True,
            message="Annotation updated successfully",
            annotation_id=annotation_id,
        )

    except Exception as e:
        logger.error(f"Error updating annotation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating annotation: {str(e)}",
        )


@router.delete("/annotations/{annotation_id}", response_model=AnnotationResponse)
async def delete_annotation(
    annotation_id: str, session_manager: SessionManager = Depends(get_session_manager)
):
    """Delete an annotation"""
    session_id = session_manager.session_id

    logger.info(
        f"Attempting to delete annotation {annotation_id} from session {session_id}"
    )

    # List all annotations in session for debugging
    all_annotations = session_store.get_annotations(session_id)
    logger.info(
        f"Available annotations in session: {[ann.annotation_id for ann in all_annotations]}"
    )

    # Get the annotation from session store
    annotation = session_store.get_annotation(session_id, annotation_id)
    if not annotation:
        logger.error(f"Annotation {annotation_id} not found in session {session_id}")
        raise HTTPException(status_code=404, detail="Annotation not found")

    logger.info(f"Found annotation to delete: {annotation.annotation_id}")

    try:
        # Delete the annotation file if it exists
        if os.path.exists(annotation.file_path):
            os.remove(annotation.file_path)
            logger.info(f"Deleted annotation file: {annotation.file_path}")

        # Remove from session store
        success = session_store.remove_annotation(session_id, annotation_id)
        logger.info(f"Removed annotation from session store: {success}")

        return AnnotationResponse(
            success=True,
            message="Annotation deleted successfully",
            annotation_id=annotation_id,
        )

    except Exception as e:
        logger.error(f"Error deleting annotation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting annotation: {str(e)}",
        )


@router.post("/preprocess/", response_model=PreprocessResponse)
async def preprocess_image(
    request: PreprocessRequest,
    session_manager: SessionManager = Depends(get_session_manager),
):
    """Pre-generate embeddings for faster segmentation"""
    try:
        # Check if session exists
        session_data = session_store.get_session(session_manager.session_id)
        if not session_data:
            raise HTTPException(
                status_code=404,
                detail=f"Session {session_manager.session_id} not found. Please refresh the page to create a new session.",
            )

        # Get image from session
        image = session_store.get_image(session_manager.session_id, request.image_id)
        if not image:
            raise HTTPException(
                status_code=404,
                detail=f"Image {request.image_id} not found in session {session_manager.session_id}",
            )  # Handle both absolute and relative paths for image_path
        image_path = construct_image_path(image.file_path)

        # Check if file exists
        if not os.path.exists(image_path):
            logger.error(f"File does not exist at: {image_path}")
            raise FileNotFoundError(f"Image file not found at {image_path}")

        success = segmenter.preprocess_image(image_path)

        if success:
            logger.info(f"Successfully preprocessed image {request.image_id}")
            return PreprocessResponse(
                success=True, message="Image preprocessed successfully"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to preprocess image",
            )

    except Exception as e:
        logger.error(f"Error preprocessing image {request.image_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error preprocessing image: {str(e)}",
        )
