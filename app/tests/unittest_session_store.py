#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Unit tests for sat-annotator backend using Python's unittest framework
"""

import unittest
import sys
import os
from pathlib import Path
import uuid
from datetime import datetime

# Add app directory to path
app_path = Path(__file__).parent.parent
if str(app_path) not in sys.path:
    sys.path.insert(0, str(app_path))

# Set test mode environment variable
os.environ["SAT_ANNOTATOR_TEST_MODE"] = "1"

# Import application code
from storage.session_store import SessionStore, SessionImage, SessionAnnotation


class TestSessionStore(unittest.TestCase):
    """Tests for SessionStore functionality"""

    def setUp(self):
        """Set up before each test"""
        self.store = SessionStore()
        self.session_id = str(uuid.uuid4())

    def test_session_creation(self):
        """Test creating a session"""
        self.store.create_session(self.session_id)
        self.assertIn(self.session_id, self.store.sessions)
        self.assertIn("images", self.store.sessions[self.session_id])
        self.assertIn("annotations", self.store.sessions[self.session_id])

    def test_add_image(self):
        """Test adding an image to a session"""
        image = self.store.add_image(
            session_id=self.session_id,
            file_name="test.jpg",
            file_path="uploads/test.jpg",
            resolution="1024x768",
        )

        self.assertIn(self.session_id, self.store.sessions)
        self.assertIn(image.image_id, self.store.sessions[self.session_id]["images"])

        # Test getting images
        images = self.store.get_images(self.session_id)
        self.assertEqual(len(images), 1)
        self.assertEqual(images[0].file_name, "test.jpg")

    def test_add_annotation(self):
        """Test adding an annotation to a session"""
        # Add an image first
        image = self.store.add_image(
            session_id=self.session_id,
            file_name="test.jpg",
            file_path="uploads/test.jpg",
        )

        # Add an annotation
        annotation = self.store.add_annotation(
            session_id=self.session_id,
            image_id=image.image_id,
            file_path="annotations/test.json",
        )

        self.assertIsNotNone(annotation)
        self.assertIn(
            annotation.annotation_id,
            self.store.sessions[self.session_id]["annotations"],
        )

        # Test getting annotations
        annotations = self.store.get_annotations(self.session_id)
        self.assertEqual(len(annotations), 1)
        self.assertEqual(annotations[0].file_path, "annotations/test.json")


if __name__ == "__main__":
    print("Running tests...")
    print(f"App path: {app_path}")
    print(f"sys.path: {sys.path}")
    unittest.main(argv=["first-arg", "-v"])
