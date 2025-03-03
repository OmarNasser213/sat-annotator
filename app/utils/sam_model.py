import numpy as np
import torch
from segment_anything import sam_model_registry, SamPredictor
import cv2
from pathlib import Path

class SAMSegmenter:
    def __init__(self):
        # Use the smaller mobile SAM model for better performance
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.sam_checkpoint = "sam_vit_h_4b8939.pth"
        self.model_type = "vit_h"
        
        # Download the model if it doesn't exist
        if not Path(self.sam_checkpoint).exists():
            self._download_sam_model()
        
        # Initialize SAM
        self.sam = sam_model_registry[self.model_type](checkpoint=self.sam_checkpoint)
        self.sam.to(device=self.device)
        self.predictor = SamPredictor(self.sam)

    def _download_sam_model(self):
        """Download the SAM model checkpoint"""
        import urllib.request
        url = "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth"
        urllib.request.urlretrieve(url, self.sam_checkpoint)

    def set_image(self, image_path):
        """Set the image for segmentation"""
        image = cv2.imread(image_path)
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        self.predictor.set_image(image)
        return image.shape[:2]  # Return height, width

    def predict_from_point(self, point_coords, point_labels=None):
        """Generate mask from a point prompt"""
        # Convert coordinates to numpy array
        point_coords = np.array([point_coords])
        if point_labels is None:
            point_labels = np.array([1])  # 1 indicates a foreground point
        
        # Generate mask prediction
        masks, scores, _ = self.predictor.predict(
            point_coords=point_coords,
            point_labels=point_labels,
            multimask_output=True
        )
        
        # Return the mask with highest score
        best_mask_idx = np.argmax(scores)
        return masks[best_mask_idx].astype(np.uint8) * 255  # Convert to 8-bit mask

    def mask_to_polygon(self, mask):
        """Convert binary mask to polygon coordinates"""
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None
        
        # Get the largest contour
        largest_contour = max(contours, key=cv2.contourArea)
        # Convert to list of [x,y] coordinates
        polygon = largest_contour.squeeze().tolist()
        
        # Handle case where contour is a single point or line
        if not isinstance(polygon[0], list):
            polygon = [polygon]
            
        return polygon