"""
Mocks for tests to avoid loading the actual SAM model
"""

import os
import sys
from pathlib import Path
from unittest.mock import MagicMock
import numpy as np

# Create mock modules
mock_segment_anything = MagicMock()
mock_torch = MagicMock()
mock_cv2 = MagicMock()


# Setup mock for SAM model registry
class MockSAMModel:
    def __init__(self, checkpoint=None):
        self.checkpoint = checkpoint

    def to(self, device=None):
        return self


def mock_model_constructor(checkpoint):
    return MockSAMModel(checkpoint)


sam_registry = {
    "vit_h": mock_model_constructor,
    "vit_l": mock_model_constructor,
    "vit_b": mock_model_constructor,
}
mock_segment_anything.sam_model_registry = sam_registry


# Setup mock for SamPredictor
class MockSamPredictor:
    def __init__(self, model):
        self.model = model
        self.image = None
        self.current_image_path = None
        self.cache = {}

    def set_image(self, image):
        self.image = image
        return getattr(image, "shape", (768, 1024))[:2]

    def predict(self, point_coords, point_labels, multimask_output=True):
        h, w = 768, 1024
        masks = np.zeros((3, h, w), dtype=bool)
        masks[0, 300:500, 400:600] = True
        scores = np.array([0.95, 0.5, 0.3])
        logits = np.zeros((3, h, w))
        return masks, scores, logits


mock_segment_anything.SamPredictor = MockSamPredictor

# Setup mock for torch
mock_torch.device = lambda x: x
mock_torch.cuda = MagicMock()
mock_torch.cuda.is_available = lambda: False

# Create a mock image array for cv2
mock_image = np.zeros((768, 1024, 3), dtype=np.uint8)

# Setup mock for cv2
mock_cv2.imread = lambda path: mock_image
mock_cv2.cvtColor = lambda img, code: img
mock_cv2.findContours = lambda mask, mode, method: (
    [
        np.array(
            [[[400, 300]], [[600, 300]], [[600, 500]], [[400, 500]]], dtype=np.int32
        )
    ],
    None,
)
mock_cv2.RETR_EXTERNAL = 0
mock_cv2.CHAIN_APPROX_SIMPLE = 1
mock_cv2.contourArea = lambda contour: 40000  # 200x200 area
mock_cv2.imwrite = lambda path, img: True
mock_cv2.applyColorMap = lambda mask, colormap: mock_image
mock_cv2.addWeighted = lambda img1, alpha, img2, beta, gamma: mock_image
mock_cv2.COLORMAP_JET = 2

# Create mock PIL
mock_pil = MagicMock()
mock_pil.Image.open.return_value.__enter__.return_value.width = 1024
mock_pil.Image.open.return_value.__enter__.return_value.height = 768


def apply_mocks():
    """Apply the mocks to sys.modules"""
    sys.modules["segment_anything"] = mock_segment_anything
    sys.modules["torch"] = mock_torch
    sys.modules["cv2"] = mock_cv2
    sys.modules["PIL"] = mock_pil

    # Set environment variable to indicate we're in test mode
    os.environ["SAT_ANNOTATOR_TEST_MODE"] = "1"
