import numpy as np
import torch
from segment_anything import sam_model_registry, SamPredictor
import cv2
from pathlib import Path
import os
from typing import Dict, Tuple, List, Optional

class SAMSegmenter:
    def __init__(self):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Check if running in Docker or locally
        in_docker = os.path.exists('/.dockerenv')
        base_path = Path("/app") if in_docker else Path(".")
        
        self.sam_checkpoint = str(base_path / "models/sam_vit_h_4b8939.pth")
        self.model_type = "vit_h"
        
        if not Path(self.sam_checkpoint).exists():
            raise FileNotFoundError(f"SAM checkpoint not found at {self.sam_checkpoint}. Please download it from https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth")
        
        self.sam = sam_model_registry[self.model_type](checkpoint=self.sam_checkpoint)
        self.sam.to(device=self.device)
        self.predictor = SamPredictor(self.sam)
        
        # Cache for storing image embeddings and masks
        self.cache: Dict[str, Dict] = {}
        self.current_image_path = None

    def set_image(self, image_path):
        """Set the image for segmentation and cache its embedding"""
        # Check if we've already processed this image
        if image_path in self.cache:
            self.current_image_path = image_path
            return self.cache[image_path]['image_size']
        
        # Load and process the new image
        image = cv2.imread(image_path)
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        self.predictor.set_image(image)
        
        # Store in cache
        self.cache[image_path] = {
            'image_size': image.shape[:2],  # (height, width)
            'masks': {},  # Will store generated masks
            'embeddings': None  # This is implicitly stored in the predictor
        }
        self.current_image_path = image_path
        
        return image.shape[:2]  # Return height, width

    def predict_from_point(self, point_coords, point_labels=None):
        """Generate mask from a point prompt, using cache if available"""
        if self.current_image_path is None:
            raise ValueError("No image set for segmentation. Call set_image() first.")
        
        # Convert to tuple for cache key
        point_key = tuple(point_coords)
        
        # Check if we already have a mask for this point
        if point_key in self.cache[self.current_image_path]['masks']:
            return self.cache[self.current_image_path]['masks'][point_key]
        
        # Generate new mask
        point_coords_array = np.array([point_coords])
        if point_labels is None:
            point_labels = np.array([1])  # 1 indicates a foreground point
        
        masks, scores, _ = self.predictor.predict(
            point_coords=point_coords_array,
            point_labels=point_labels,
            multimask_output=True
        )
        
        best_mask_idx = np.argmax(scores)
        mask = masks[best_mask_idx].astype(np.uint8) * 255  # Convert to 8-bit mask
        
        # Cache the result
        self.cache[self.current_image_path]['masks'][point_key] = mask
        
        return mask

    def mask_to_polygon(self, mask):
        """Convert binary mask to polygon coordinates"""
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None
        
        largest_contour = max(contours, key=cv2.contourArea)
        polygon = largest_contour.squeeze().tolist()
        
        if not isinstance(polygon[0], list):
            polygon = [polygon]
            
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
