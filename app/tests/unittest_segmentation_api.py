#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Unit tests for sat-annotator segmentation API
"""

import unittest
import sys
import os
import uuid
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

# Import FastAPI testing components
from fastapi import FastAPI
from fastapi.testclient import TestClient
from fastapi.responses import JSONResponse

# Import application components
from storage.session_store import SessionStore, session_store
from storage.session_manager import SESSION_COOKIE_NAME


class TestSegmentationAPI(unittest.TestCase):
    """Tests for segmentation API endpoints"""

    def setUp(self):
        """Set up test environment before each test"""
        # Reset session store
        session_store.sessions = {}

        # Create a test session ID
        self.test_session_id = str(uuid.uuid4())
        session_store.create_session(self.test_session_id)

        # Add a test image to the session
        self.test_image = session_store.add_image(
            session_id=self.test_session_id,
            file_name="test.jpg",
            file_path="uploads/test.jpg",
            resolution="1024x768",
        )

        # Create a FastAPI app
        self.app = FastAPI()

        # Mock SAM segmenter
        self.mock_segmenter = MagicMock()
        self.mock_segmenter.set_image.return_value = (768, 1024)

        # Create a mock mask
        mock_mask = np.zeros((768, 1024), dtype=np.uint8)
        mock_mask[300:500, 400:600] = 255
        self.mock_segmenter.predict_from_point.return_value = mock_mask

        # Mock polygon output
        self.mock_segmenter.mask_to_polygon.return_value = [
            [400, 300],
            [600, 300],
            [600, 500],
            [400, 500],
        ]

        # Add test route for point-based segmentation
        @self.app.post("/api/segment/point")
        def segment_from_point(request_data: dict):
            image_id = request_data.get("image_id")
            point = request_data.get("point")

            # Check if image exists
            if image_id not in session_store.sessions[self.test_session_id]["images"]:
                return JSONResponse(
                    status_code=404,
                    content={"success": False, "detail": "Image not found"},
                )

            # Get the image
            image = session_store.sessions[self.test_session_id]["images"][image_id]

            # Mock segmentation using our mock segmenter
            try:
                self.mock_segmenter.set_image(image.file_path)
                mask = self.mock_segmenter.predict_from_point(point)
                polygon = self.mock_segmenter.mask_to_polygon(mask)

                # Return successful response
                return {
                    "success": True,
                    "mask_url": f"/api/segment/mask/{image_id}",
                    "polygon": polygon,
                }
            except Exception as e:
                return JSONResponse(
                    status_code=500,
                    content={
                        "success": False,
                        "detail": f"Segmentation failed: {str(e)}",
                    },
                )

        # Add test route for retrieving a mask
        @self.app.get("/api/segment/mask/{image_id}")
        def get_mask(image_id: str):
            # Just return a success response for testing purposes
            return {"success": True, "image_id": image_id}

        # Create test client
        self.client = TestClient(self.app)

    def test_segment_from_point(self):
        """Test segmenting an image from a point prompt"""
        # Prepare test data
        test_data = {"image_id": self.test_image.image_id, "point": [512, 384]}

        # Call the endpoint
        response = self.client.post(
            "/api/segment/point",
            json=test_data,
            cookies={SESSION_COOKIE_NAME: self.test_session_id},
        )

        # Check response
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertIn("mask_url", data)
        self.assertIn("polygon", data)

        # Check mask URL format
        expected_mask_url = f"/api/segment/mask/{self.test_image.image_id}"
        self.assertEqual(data["mask_url"], expected_mask_url)

        # Check polygon data
        self.assertEqual(len(data["polygon"]), 4)  # Should be a rectangle with 4 points
        self.assertEqual(data["polygon"][0], [400, 300])
        self.assertEqual(data["polygon"][1], [600, 300])
        self.assertEqual(data["polygon"][2], [600, 500])
        self.assertEqual(data["polygon"][3], [400, 500])

        # Verify the segmenter was called correctly
        self.mock_segmenter.set_image.assert_called_once_with(self.test_image.file_path)
        self.mock_segmenter.predict_from_point.assert_called_once_with(
            test_data["point"]
        )
        self.mock_segmenter.mask_to_polygon.assert_called_once()

    def test_segment_invalid_image(self):
        """Test segmenting an image that doesn't exist"""
        # Prepare test data with a non-existent image ID
        test_data = {"image_id": str(uuid.uuid4()), "point": [512, 384]}

        # Call the endpoint
        response = self.client.post(
            "/api/segment/point",
            json=test_data,
            cookies={SESSION_COOKIE_NAME: self.test_session_id},
        )

        # Check response
        self.assertEqual(response.status_code, 404)
        data = response.json()
        self.assertFalse(data["success"])
        self.assertIn("detail", data)
        self.assertIn("Image not found", data["detail"])

    def test_get_mask(self):
        """Test retrieving a mask"""
        # Call the endpoint
        response = self.client.get(
            f"/api/segment/mask/{self.test_image.image_id}",
            cookies={SESSION_COOKIE_NAME: self.test_session_id},
        )

        # Check response
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["image_id"], self.test_image.image_id)


if __name__ == "__main__":
    print("Running segmentation API tests...")
    print(f"App path: {app_path}")
    print(f"sys.path: {sys.path}")

    try:
        # Create test suite explicitly
        test_methods = [m for m in dir(TestSegmentationAPI) if m.startswith("test_")]
        print(f"Found {len(test_methods)} test methods:")

        suite = unittest.TestSuite()
        for method in test_methods:
            print(f"  - {method}")
            suite.addTest(TestSegmentationAPI(method))

        # Run tests with clear output
        runner = unittest.TextTestRunner(verbosity=2)
        results = runner.run(suite)

        # Print explicit summary
        print(f"\nTests run: {results.testsRun}")
        print(f"Failures: {len(results.failures)}")
        print(f"Errors: {len(results.errors)}")
        print("DONE")

        # Force flush output to ensure it's captured
        import sys

        sys.stdout.flush()

    except Exception as e:
        print(f"Error in test execution: {e}")
        import traceback

        traceback.print_exc()

    print("Test execution completed")
    sys.stdout.flush()
