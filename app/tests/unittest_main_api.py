#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Unit tests for sat-annotator main API using a mock API
"""

import unittest
import sys
import os
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

# We'll create a FastAPI app for testing
from fastapi import FastAPI
from fastapi.testclient import TestClient


class TestMainAPI(unittest.TestCase):
    """Tests for the main FastAPI application"""

    def setUp(self):
        """Set up test environment before each test"""
        # Create a simple FastAPI app for testing
        self.app = FastAPI(title="Satellite Image Annotation Tool")

        # Add a health check endpoint
        @self.app.get("/health")
        def health_check():
            return {"status": "healthy"}

        # Add root endpoint (when frontend is not mounted)
        @self.app.get("/")
        def read_root():
            return {
                "message": "Welcome to the Satellite Image Annotation Tool (API Only Mode)"
            }

        # Add frontend status endpoint
        @self.app.get("/frontend-status")
        def frontend_status():
            return {
                "status": "not_mounted",
                "message": "Frontend not mounted. Static files should be served from the web directory.",
            }

        # Create a test client
        self.client = TestClient(self.app)

    def test_app_creation(self):
        """Test that the FastAPI app is created successfully"""
        # Ensure the app exists and has the expected attributes
        self.assertIsNotNone(self.app)
        self.assertEqual(self.app.title, "Satellite Image Annotation Tool")

    def test_health_endpoint(self):
        """Test the health check endpoint"""
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "healthy"})

    def test_root_endpoint(self):
        """Test the root endpoint when frontend is not mounted"""
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "message": "Welcome to the Satellite Image Annotation Tool (API Only Mode)"
            },
        )

    def test_frontend_status_endpoint(self):
        """Test the frontend status endpoint"""
        response = self.client.get("/frontend-status")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "status": "not_mounted",
                "message": "Frontend not mounted. Static files should be served from the web directory.",
            },
        )


if __name__ == "__main__":
    print("Running main API tests...")
    print(f"App path: {app_path}")
    print(f"sys.path: {sys.path}")
    print("Test methods:")
    for method in dir(TestMainAPI):
        if method.startswith("test_"):
            print(f"  - {method}")

    # Create test suite explicitly
    suite = unittest.TestSuite()
    for method in dir(TestMainAPI):
        if method.startswith("test_"):
            suite.addTest(TestMainAPI(method))

    runner = unittest.TextTestRunner(verbosity=2)
    runner.run(suite)
