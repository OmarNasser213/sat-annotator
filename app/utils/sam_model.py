import numpy as np
import torch
from segment_anything import sam_model_registry, SamPredictor
import cv2
from pathlib import Path
import os
import threading
import logging
from typing import Dict, Tuple, List, Optional

# Set up logging for SAM model
logger = logging.getLogger(__name__)


class SAMSegmenter:
    def __init__(self):  # Enhanced GPU detection and setup
        if torch.cuda.is_available():
            self.device = torch.device("cuda")
            logger.info(f"CUDA available! Using GPU: {torch.cuda.get_device_name(0)}")
            logger.info(
                f"CUDA memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB"
            )
            # Set optimal GPU settings for SAM real-time performance
            torch.backends.cudnn.benchmark = True
            torch.backends.cuda.matmul.allow_tf32 = True
            torch.backends.cudnn.deterministic = False  # For better performance
            # Enable memory optimization
            torch.cuda.empty_cache()
        else:
            self.device = torch.device("cpu")
            logger.warning("CUDA not available, using CPU (will be slower)")
            # CPU optimizations
            torch.set_num_threads(4)  # Limit CPU threads for better responsiveness

        logger.info(f"SAM Model will run on: {self.device}")
        # Check if running in Docker or locally
        in_docker = os.path.exists("/.dockerenv")
        base_path = Path("/app") if in_docker else Path(".")

        self.sam_checkpoint = str(base_path / "models/sam_vit_h_4b8939.pth")
        self.model_type = "vit_h"
        if not Path(self.sam_checkpoint).exists():
            raise FileNotFoundError(
                f"SAM checkpoint not found at {self.sam_checkpoint}. Please download it from https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth"
            )

        logger.info(f"Loading SAM model from: {self.sam_checkpoint}")
        self.sam = sam_model_registry[self.model_type](checkpoint=self.sam_checkpoint)

        # Move to device and optimize for inference
        self.sam.to(device=self.device)
        # Note: Removed half-precision to avoid dtype mismatch issues        # if self.device.type == 'cuda':
        #     self.sam = self.sam.half()
        #     logger.info("Using half-precision (FP16) for faster GPU inference")

        self.predictor = SamPredictor(self.sam)
        logger.info("SAM model loaded successfully")

        # Cache for storing image embeddings and masks
        self.cache: Dict[str, Dict] = {}
        self.current_image_path = (
            None  # Add thread lock to prevent concurrent access issues
        )
        self._lock = threading.Lock()
        logger.info("Thread synchronization enabled for multi-image processing")

    def set_image(self, image_path):
        """Set the image for segmentation and cache its embedding with thread safety"""
        with self._lock:
            # Always load the image from disk to ensure we have the correct data
            image = cv2.imread(image_path)
            if image is None:
                raise ValueError(f"Could not load image from {image_path}")
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

            # Check if we have cached embeddings for this image
            if image_path in self.cache:
                logger.debug(f"Found cached embeddings for {Path(image_path).name}")

                # Only re-set the image if it's different from the current one
                if self.current_image_path != image_path:
                    logger.debug(
                        f"Re-setting predictor to cached image: {Path(image_path).name}"
                    )
                    with torch.no_grad():
                        self.predictor.set_image(image)
                    self.current_image_path = image_path
                    self._last_set_image = image_path
                else:
                    logger.debug(
                        f"Image already loaded in predictor - embeddings cached"
                    )

                return self.cache[image_path]["image_size"]

            logger.info(f"Loading and processing new image: {Path(image_path).name}")
            logger.debug(f"Image size: {image.shape[1]}x{image.shape[0]} pixels")
            # Generate embeddings on GPU (this is the heavy computation)
            with torch.no_grad():  # Disable gradients for faster inference
                self.predictor.set_image(image)

            logger.debug(f"Image embeddings generated on {self.device}")

            # Store in cache
            self.cache[image_path] = {
                "image_size": image.shape[:2],  # (height, width)
                "masks": {},  # Will store generated masks
                "embeddings": None,  # This is implicitly stored in the predictor
            }
            self.current_image_path = image_path
            self._last_set_image = image_path

            return image.shape[:2]  # Return height, width

    def preprocess_image(self, image_path):
        """Pre-generate embeddings for an image without requiring immediate segmentation"""
        with self._lock:
            # Check if we've already processed this image
            if image_path in self.cache:
                logger.debug(
                    f"Image {Path(image_path).name} already has cached embeddings"
                )
                return True

            try:
                logger.info(
                    f"Pre-processing image for faster segmentation: {Path(image_path).name}"
                )

                # Load and process the image
                image = cv2.imread(image_path)
                if image is None:
                    raise ValueError(f"Could not load image from {image_path}")

                image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

                # Generate embeddings on GPU using the main predictor
                with torch.no_grad():
                    self.predictor.set_image(
                        image
                    )  # Store in cache and set as current image
                self.cache[image_path] = {
                    "image_size": image.shape[:2],  # (height, width)
                    "masks": {},  # Will store generated masks
                    "embeddings": None,  # This is implicitly stored in the predictor
                }
                self.current_image_path = image_path
                self._last_set_image = image_path
                logger.info(f"Pre-processing complete for {Path(image_path).name}")
                return True

            except Exception as e:
                logger.error(f"Error pre-processing image {Path(image_path).name}: {e}")
                return False

    def predict_from_point(self, point_coords, point_labels=None):
        """Generate mask from a point prompt, using cache if available with thread safety"""
        # First check cache without lock for performance
        point_key = tuple(point_coords)
        if (
            self.current_image_path
            and self.current_image_path in self.cache
            and point_key in self.cache[self.current_image_path]["masks"]
        ):
            return self.cache[self.current_image_path]["masks"][point_key]

        with self._lock:
            if self.current_image_path is None:
                raise ValueError(
                    "No image set for segmentation. Call set_image() first."
                )

            # Ensure we have the correct image set in the predictor
            if self.current_image_path not in self.cache:
                raise ValueError(
                    f"Image {self.current_image_path} not found in cache. Call set_image() first."
                )

            # Re-set the image if it's not the current one (safety check)
            # This ensures the predictor has the correct embeddings
            if (
                hasattr(self, "_last_set_image")
                and self._last_set_image != self.current_image_path
            ):
                logger.debug(
                    f"Re-setting image in predictor for thread safety: {Path(self.current_image_path).name}"
                )
                image = cv2.imread(self.current_image_path)
                image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                with torch.no_grad():
                    self.predictor.set_image(image)

            self._last_set_image = self.current_image_path
            # Double-check cache (in case another thread added it)
            if point_key in self.cache[self.current_image_path]["masks"]:
                logger.debug(
                    f"Using cached mask for point {point_coords} (added by another thread)"
                )
                return self.cache[self.current_image_path]["masks"][point_key]

            logger.debug(
                f"Generating new mask for point {point_coords} on {self.device}"
            )

            try:
                # Generate new mask with performance optimizations
                point_coords_array = np.array([point_coords])
                if point_labels is None:
                    point_labels = np.array([1])  # 1 indicates a foreground point

                # Ensure inputs are the right data type for GPU
                point_coords_array = point_coords_array.astype(np.float32)
                point_labels = point_labels.astype(np.int32)

                # Use GPU optimization if available
                with torch.no_grad():  # Disable gradient computation for faster inference
                    masks, scores, _ = self.predictor.predict(
                        point_coords=point_coords_array,
                        point_labels=point_labels,
                        multimask_output=True,
                    )

                best_mask_idx = np.argmax(scores)
                mask = (
                    masks[best_mask_idx].astype(np.uint8) * 255
                )  # Convert to 8-bit mask

                logger.debug(
                    f"Mask generated successfully (confidence: {scores[best_mask_idx]:.3f})"
                )

                # Cache the result
                self.cache[self.current_image_path]["masks"][point_key] = mask

                return mask

            except Exception as e:
                logger.error(f"Error generating mask: {e}")
                # Clear CUDA cache if error occurs
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                raise

    def mask_to_polygon(self, mask):
        """Convert binary mask to polygon coordinates (normalized 0-1)"""
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None

        largest_contour = max(contours, key=cv2.contourArea)
        polygon = largest_contour.squeeze().tolist()

        if not isinstance(polygon[0], list):
            polygon = [polygon]

        # Get image dimensions for normalization
        if self.current_image_path and self.current_image_path in self.cache:
            height, width = self.cache[self.current_image_path]["image_size"]

            # Normalize coordinates to 0-1 range
            normalized_polygon = []
            for point in polygon:
                if len(point) == 2:  # [x, y]
                    normalized_x = point[0] / width
                    normalized_y = point[1] / height
                    normalized_polygon.append([normalized_x, normalized_y])

            return normalized_polygon

        return polygon

    def clear_cache(self, image_path=None):
        """Clear the cache for a specific image or all images"""
        if image_path:
            if image_path in self.cache:
                del self.cache[image_path]
                if self.current_image_path == image_path:
                    self.current_image_path = None
        else:
            self.cache = {}
            self.current_image_path = None
