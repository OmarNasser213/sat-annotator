#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Unit tests for the SAM (Segment Anything Model) wrapper
"""

import unittest
import sys
import os
import numpy as np
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add app directory to path
app_path = Path(__file__).parent.parent
if str(app_path) not in sys.path:
    sys.path.insert(0, str(app_path))

# Set test mode environment variable
os.environ["SAT_ANNOTATOR_TEST_MODE"] = "1"

# Import mocks before importing any app code
from mocks import apply_mocks
apply_mocks()

# Now import the segmenter code
from utils.sam_model import SAMSegmenter

class TestSAMSegmenter(unittest.TestCase):
    """Tests for SAM segmentation model wrapper"""
    
    def setUp(self):
        """Set up the test environment"""
        # Create a mock segmenter instance
        self.segmenter = SAMSegmenter()
        
        # Create test data
        self.test_image_path = "/fake/path/image.jpg"
        self.test_point = [500, 400]
    
    def test_segmenter_initialization(self):
        """Test that the segmenter is initialized correctly"""
        self.assertIsNotNone(self.segmenter)
        self.assertEqual(self.segmenter.cache, {})
        self.assertIsNone(self.segmenter.current_image_path)
        
    @patch("cv2.imread")
    @patch("cv2.cvtColor")
    def test_set_image(self, mock_cvtcolor, mock_imread):
        """Test setting an image for segmentation"""
        # Set up mock image
        mock_img = np.zeros((768, 1024, 3), dtype=np.uint8)
        mock_imread.return_value = mock_img
        mock_cvtcolor.return_value = mock_img
        
        # Call the method
        result = self.segmenter.set_image(self.test_image_path)
        
        # Check the results
        self.assertEqual(result, (768, 1024))
        self.assertEqual(self.segmenter.current_image_path, self.test_image_path)
        self.assertIn(self.test_image_path, self.segmenter.cache)
        self.assertEqual(self.segmenter.cache[self.test_image_path]['image_size'], (768, 1024))
    
    @patch("cv2.imread")
    @patch("cv2.cvtColor")
    def test_predict_from_point(self, mock_cvtcolor, mock_imread):
        """Test predicting a mask from a point prompt"""
        # Set up mocks
        mock_img = np.zeros((768, 1024, 3), dtype=np.uint8)
        mock_imread.return_value = mock_img
        mock_cvtcolor.return_value = mock_img
        
        # Set up the predictor mock
        self.segmenter.predictor.predict = MagicMock()
        
        # Create a mock mask
        mock_mask = np.zeros((768, 1024), dtype=bool)
        mock_mask[300:500, 400:600] = True  # Add a rectangle
        
        # Set up the predict return value
        masks = np.array([mock_mask, np.zeros_like(mock_mask), np.zeros_like(mock_mask)])
        scores = np.array([0.95, 0.5, 0.3])
        self.segmenter.predictor.predict.return_value = (masks, scores, None)
        
        # Set the image first
        self.segmenter.set_image(self.test_image_path)
        
        # Call the method
        result = self.segmenter.predict_from_point(self.test_point)
        
        # Check the results
        self.assertEqual(result.shape, (768, 1024))
        self.assertTrue(np.array_equal(result[300:500, 400:600], np.ones((200, 200), dtype=np.uint8) * 255))
        self.assertTrue(np.array_equal(result[0:300, 0:400], np.zeros((300, 400), dtype=np.uint8)))
        
        # Check that the result was cached
        point_key = tuple(self.test_point)
        self.assertIn(point_key, self.segmenter.cache[self.test_image_path]['masks'])
    
    @patch("cv2.findContours")
    def test_mask_to_polygon(self, mock_findcontours):
        """Test converting a mask to polygon coordinates"""
        # Create a test mask
        mask = np.zeros((768, 1024), dtype=np.uint8)
        mask[300:500, 400:600] = 255
        
        # Create a mock contour
        contours = [np.array([[[400, 300]], [[600, 300]], [[600, 500]], [[400, 500]]])]
        mock_findcontours.return_value = (contours, None)
        
        # Call the method
        result = self.segmenter.mask_to_polygon(mask)
        
        # Check the result
        self.assertEqual(len(result), 4)  # Should have 4 points for a rectangle
        self.assertEqual(result[0], [400, 300])
        self.assertEqual(result[1], [600, 300])
        self.assertEqual(result[2], [600, 500])
        self.assertEqual(result[3], [400, 500])
    
    def test_clear_cache(self):
        """Test clearing the segmenter cache"""
        # Set up test data in the cache
        self.segmenter.cache = {
            "image1.jpg": {"image_size": (100, 100), "masks": {}},
            "image2.jpg": {"image_size": (200, 200), "masks": {}}
        }
        self.segmenter.current_image_path = "image1.jpg"
        
        # Clear one specific image
        self.segmenter.clear_cache("image1.jpg")
        
        # Check the result
        self.assertNotIn("image1.jpg", self.segmenter.cache)
        self.assertIn("image2.jpg", self.segmenter.cache)
        self.assertIsNone(self.segmenter.current_image_path)
        
        # Clear all cache
        self.segmenter.clear_cache()
        
        # Check the result
        self.assertEqual(self.segmenter.cache, {})

if __name__ == "__main__":
    print("Running SAM segmenter tests...")
    print(f"App path: {app_path}")
    print(f"sys.path: {sys.path}")
    
    try:
        # Create test suite explicitly
        suite = unittest.TestSuite()
        for method in dir(TestSAMSegmenter):
            if method.startswith('test_'):
                print(f"Adding test method: {method}")
                suite.addTest(TestSAMSegmenter(method))
        
        # Run tests with a time limit
        runner = unittest.TextTestRunner(verbosity=2)
        runner.run(suite)
        
    except Exception as e:
        print(f"Error in test execution: {e}")
        import traceback
        traceback.print_exc()
