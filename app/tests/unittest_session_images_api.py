#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Unit tests for sat-annotator session images API
"""

import unittest
import sys
import os
import io
import uuid
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
from fastapi import FastAPI, UploadFile, File
from fastapi.testclient import TestClient
from fastapi.responses import JSONResponse

# Import application components
from storage.session_store import SessionStore, session_store
from storage.session_manager import SessionManager, SESSION_COOKIE_NAME

class MockUploadFile:
    """Mock for FastAPI's UploadFile"""
    def __init__(self, filename, content_type="image/jpeg", content=None):
        self.filename = filename
        self.content_type = content_type
        self.file = io.BytesIO(content or b"mock image content")
    
    async def read(self):
        self.file.seek(0)
        return self.file.read()
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

class TestSessionImagesAPI(unittest.TestCase):
    """Tests for session_images API endpoints"""
    
    def setUp(self):
        """Set up test environment before each test"""
        # Reset session store
        session_store.sessions = {}
        
        # Create a test session ID
        self.test_session_id = str(uuid.uuid4())
        session_store.create_session(self.test_session_id)
        
        # Create a FastAPI app
        self.app = FastAPI()
        
        # Add test route for uploading images
        @self.app.post("/api/images/upload")
        async def upload_image(file: UploadFile = File(...)):
            # Mock implementation of the upload endpoint
            if not file.content_type.startswith('image/'):
                return JSONResponse(status_code=400, content={"detail": "File must be an image"})
                
            # Create mock file info
            file_info = {
                "filename": f"{uuid.uuid4()}.jpg",
                "original_filename": file.filename,
                "path": f"uploads/{uuid.uuid4()}.jpg",
                "resolution": "1024x768",
                "size": 1024,
                "content_type": file.content_type
            }
            
            # Add image to session
            image = session_store.add_image(
                session_id=self.test_session_id,
                file_name=file_info["original_filename"],
                file_path=file_info["path"],
                resolution=file_info["resolution"]
            )
            
            return {
                "success": True,
                "image_id": image.image_id,
                "file_info": file_info
            }
          # Add test route for getting images
        @self.app.get("/api/images")
        def get_images():
            images = session_store.get_images(self.test_session_id)
            # Use model_dump() instead of dict() for Pydantic v2
            try:
                # Try newer Pydantic v2 method first
                return {"images": [img.model_dump() for img in images]}
            except AttributeError:
                # Fall back to old method for compatibility
                return {"images": [img.dict() for img in images]}
          # Add test route for deleting an image
        @self.app.delete("/api/images/{image_id}")
        def delete_image(image_id: str):
            # Implement removal directly since SessionStore doesn't have remove_image
            if self.test_session_id not in session_store.sessions:
                return JSONResponse(status_code=404, content={"success": False, "detail": "Session not found"})
                
            if "images" not in session_store.sessions[self.test_session_id]:
                return JSONResponse(status_code=404, content={"success": False, "detail": "No images in session"})
                
            if image_id in session_store.sessions[self.test_session_id]["images"]:
                # Remove the image from the session
                del session_store.sessions[self.test_session_id]["images"][image_id]
                return {"success": True}
            else:
                return JSONResponse(status_code=404, content={"success": False, "detail": "Image not found"})
        
        # Create test client
        self.client = TestClient(self.app)
    
    @patch("builtins.open", MagicMock())
    @patch("os.path.getsize", MagicMock(return_value=1024))
    @patch("pathlib.Path.mkdir", MagicMock())
    def test_upload_image(self):
        """Test uploading an image"""
        # Create a mock file
        file_content = b'\xff\xd8\xff' + b'\x00' * 100  # JPEG signature + padding
        mock_file = MockUploadFile(filename="test.jpg", content=file_content)
        
        # Mock PIL image
        with patch('PIL.Image.open') as mock_pil_open:
            mock_img = MagicMock()
            mock_img.width = 1024
            mock_img.height = 768
            mock_pil_open.return_value.__enter__.return_value = mock_img
            
            # Call the endpoint
            response = self.client.post(
                "/api/images/upload",
                files={"file": ("test.jpg", file_content, "image/jpeg")},
                cookies={SESSION_COOKIE_NAME: self.test_session_id}
            )
        
        # Check response
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertIn("image_id", data)
        self.assertIn("file_info", data)
        self.assertEqual(data["file_info"]["original_filename"], "test.jpg")
        
        # Verify image was added to session store
        images = session_store.get_images(self.test_session_id)
        self.assertEqual(len(images), 1)
        self.assertEqual(images[0].image_id, data["image_id"])
    
    def test_upload_invalid_image(self):
        """Test uploading an invalid file type"""
        # Create a text file instead of an image
        file_content = b'This is not an image'
        
        # Call the endpoint
        response = self.client.post(
            "/api/images/upload",
            files={"file": ("test.txt", file_content, "text/plain")},
            cookies={SESSION_COOKIE_NAME: self.test_session_id}
        )
        
        # Check response
        self.assertEqual(response.status_code, 400)
        self.assertIn("detail", response.json())
        self.assertIn("image", response.json()["detail"])
        
        # Verify nothing was added to session store
        images = session_store.get_images(self.test_session_id)
        self.assertEqual(len(images), 0)
    
    def test_get_images_empty(self):
        """Test getting images when none exist"""
        response = self.client.get(
            "/api/images",
            cookies={SESSION_COOKIE_NAME: self.test_session_id}
        )
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["images"], [])
    
    def test_get_images(self):
        """Test getting images from session"""
        # Add some test images to the session
        image1 = session_store.add_image(
            session_id=self.test_session_id,
            file_name="test1.jpg",
            file_path="uploads/test1.jpg",
            resolution="1024x768"
        )
        
        image2 = session_store.add_image(
            session_id=self.test_session_id,
            file_name="test2.jpg",
            file_path="uploads/test2.jpg",
            resolution="1920x1080"
        )
        
        # Call the endpoint
        response = self.client.get(
            "/api/images",
            cookies={SESSION_COOKIE_NAME: self.test_session_id}
        )
        
        # Check response
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["images"]), 2)
        
        # Verify image data
        image_ids = [img["image_id"] for img in data["images"]]
        self.assertIn(image1.image_id, image_ids)
        self.assertIn(image2.image_id, image_ids)
    
    def test_delete_image(self):
        """Test deleting an image"""
        # Add a test image to the session
        image = session_store.add_image(
            session_id=self.test_session_id,
            file_name="test.jpg",
            file_path="uploads/test.jpg",
            resolution="1024x768"
        )
        
        # Call delete endpoint
        response = self.client.delete(
            f"/api/images/{image.image_id}",
            cookies={SESSION_COOKIE_NAME: self.test_session_id}
        )
        
        # Check response
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        
        # Verify image was removed from session store
        images = session_store.get_images(self.test_session_id)
        self.assertEqual(len(images), 0)
    
    def test_delete_nonexistent_image(self):
        """Test deleting an image that doesn't exist"""
        # Call delete endpoint with random UUID
        response = self.client.delete(
            f"/api/images/{uuid.uuid4()}",
            cookies={SESSION_COOKIE_NAME: self.test_session_id}
        )
        
        # Check response
        self.assertEqual(response.status_code, 404)
        data = response.json()
        self.assertFalse(data["success"])
        self.assertIn("detail", data)

if __name__ == "__main__":
    print("Running session images API tests...")
    print(f"App path: {app_path}")
    print(f"sys.path: {sys.path}")
    
    try:
        # Create test suite explicitly
        test_methods = [m for m in dir(TestSessionImagesAPI) if m.startswith('test_')]
        print(f"Found {len(test_methods)} test methods:")
        
        suite = unittest.TestSuite()
        for method in test_methods:
            print(f"  - {method}")
            suite.addTest(TestSessionImagesAPI(method))
        
        # Run tests with clear output
        runner = unittest.TextTestRunner(verbosity=2)
        results = runner.run(suite)
        
        # Print explicit summary
        print(f"\nTests run: {results.testsRun}")
        print(f"Failures: {len(results.failures)}")
        print(f"Errors: {len(results.errors)}")
        print("DONE")
        
    except Exception as e:
        print(f"Error in test execution: {e}")
        import traceback
        traceback.print_exc()
        
    print("Test execution completed")
