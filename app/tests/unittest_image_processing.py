#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Unit tests for sat-annotator image processing utilities
"""

import unittest
import sys
import os
import io
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add app directory to path
app_path = Path(__file__).parent.parent
if str(app_path) not in sys.path:
    sys.path.insert(0, str(app_path))

# Set test mode environment variable
os.environ["SAT_ANNOTATOR_TEST_MODE"] = "1"

# Mock PIL before importing our app code
sys.modules["PIL"] = MagicMock()

# Import application code
from utils.image_processing import validate_image_file


class MockUploadFile:
    """Mock class for FastAPI's UploadFile"""

    def __init__(self, filename, content_type, content=None):
        self.filename = filename
        self.content_type = content_type
        self.file = io.BytesIO(content or b"mock content")

    async def read(self):
        self.file.seek(0)
        return self.file.read()


class TestImageProcessing(unittest.TestCase):
    """Tests for image processing utilities"""

    def test_validate_image_file(self):
        """Test validating image file types"""
        # Test valid image types
        valid_types = ["image/jpeg", "image/png", "image/tiff", "image/geotiff"]

        for content_type in valid_types:
            mock_file = MockUploadFile("test.jpg", content_type)
            self.assertTrue(
                validate_image_file(mock_file),
                f"validate_image_file should return True for {content_type}",
            )

        # Test invalid image types
        invalid_types = ["application/pdf", "text/plain", "application/octet-stream"]

        for content_type in invalid_types:
            mock_file = MockUploadFile("test.pdf", content_type)
            self.assertFalse(
                validate_image_file(mock_file),
                f"validate_image_file should return False for {content_type}",
            )

    @patch("builtins.open", MagicMock())
    @patch("os.path.getsize", MagicMock(return_value=1024))
    @patch("pathlib.Path.mkdir", MagicMock())
    @patch("PIL.Image.open")
    async def test_save_upload_file(self, mock_pil_open):
        """Test saving an uploaded file"""
        # Import here to avoid circular import issues with the mocks
        from utils.image_processing import save_upload_file

        # Mock PIL image dimensions
        mock_img = MagicMock()
        mock_img.width = 1024
        mock_img.height = 768
        mock_pil_open.return_value.__enter__.return_value = mock_img

        # Create a mock file
        mock_file = MockUploadFile(
            "test.jpg",
            "image/jpeg",
            content=b"\xff\xd8\xff\xe0JFIF",  # JPEG file signature
        )

        # Call the function
        file_info = await save_upload_file(mock_file)

        # Verify the result
        self.assertIn("filename", file_info)
        self.assertIn("original_filename", file_info)
        self.assertIn("path", file_info)
        self.assertEqual(file_info["original_filename"], "test.jpg")
        self.assertTrue(file_info["path"].startswith("uploads/"))
        self.assertEqual(file_info["resolution"], "1024x768")
        self.assertEqual(file_info["size"], 1024)
        self.assertEqual(file_info["content_type"], "image/jpeg")


if __name__ == "__main__":
    # Run synchronous tests directly
    print("Running image processing tests...")
    print(f"App path: {app_path}")
    print(f"sys.path: {sys.path}")

    sync_suite = unittest.TestSuite()
    sync_methods = [
        m
        for m in dir(TestImageProcessing)
        if m.startswith("test_") and not m.startswith("test_save")
    ]

    for method in sync_methods:
        print(f"Adding test method: {method}")
        sync_suite.addTest(TestImageProcessing(method))

    print("Running synchronous tests...")
    runner = unittest.TextTestRunner(verbosity=2)
    runner.run(sync_suite)

    # Run async tests manually
    print("\nRunning asynchronous tests...")
    import asyncio

    test_case = TestImageProcessing()

    # Run test_save_upload_file
    print("\ntest_save_upload_file:")
    try:
        asyncio.run(test_case.test_save_upload_file())
        print("OK")
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback

        traceback.print_exc()
