#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Unit tests for sat-annotator session manager using unittest framework
"""

import unittest
import sys
import os
from pathlib import Path
import uuid

# Add app directory to path
app_path = Path(__file__).parent.parent
if str(app_path) not in sys.path:
    sys.path.insert(0, str(app_path))

# Set test mode environment variable
os.environ["SAT_ANNOTATOR_TEST_MODE"] = "1"

# Import application code
from storage.session_manager import (
    SessionManager,
    generate_session_id,
    get_session_id,
    set_session_cookie,
    SESSION_COOKIE_NAME,
)


# Mock classes for FastAPI request/response
class MockRequest:
    def __init__(self, cookies=None):
        self.cookies = cookies or {}


class MockResponse:
    def __init__(self):
        self.cookies = {}
        self._deleted_cookies = {}

    def set_cookie(
        self, key, value, expires=None, httponly=False, samesite=None, path=None
    ):
        self.cookies[key] = {
            "key": key,
            "value": value,
            "expires": expires,
            "httponly": httponly,
            "samesite": samesite,
            "path": path,
        }

    def delete_cookie(self, key, httponly=False, path=None):
        self._deleted_cookies[key] = {"key": key, "httponly": httponly, "path": path}


class TestSessionManager(unittest.TestCase):
    """Tests for SessionManager functionality"""

    def test_generate_session_id(self):
        """Test generating a session ID produces a valid UUID"""
        session_id = generate_session_id()
        # Try to parse it as UUID to validate
        try:
            uuid_obj = uuid.UUID(session_id)
            self.assertEqual(str(uuid_obj), session_id)
        except ValueError:
            self.fail("generate_session_id did not produce a valid UUID")

    async def test_get_session_id_existing(self):
        """Test retrieving an existing session ID from cookies"""
        test_session_id = str(uuid.uuid4())
        request = MockRequest(cookies={SESSION_COOKIE_NAME: test_session_id})

        result = await get_session_id(request)
        self.assertEqual(result, test_session_id)

    async def test_get_session_id_new(self):
        """Test that a new session ID is generated if none exists"""
        request = MockRequest()

        result = await get_session_id(request)
        # Verify it's a valid UUID
        try:
            uuid_obj = uuid.UUID(result)
            self.assertEqual(str(uuid_obj), result)
        except ValueError:
            self.fail("get_session_id did not produce a valid UUID")

    def test_set_session_cookie(self):
        """Test that session cookie is properly set in response"""
        response = MockResponse()
        test_session_id = str(uuid.uuid4())

        # Call the function
        set_session_cookie(response, test_session_id)
        # Verify cookie was set
        self.assertIn(SESSION_COOKIE_NAME, response.cookies)
        self.assertEqual(
            response.cookies[SESSION_COOKIE_NAME]["value"], test_session_id
        )
        self.assertTrue(
            response.cookies[SESSION_COOKIE_NAME]["httponly"]
        )  # True to prevent JavaScript access for enhanced security against XSS
        self.assertEqual(response.cookies[SESSION_COOKIE_NAME]["samesite"], "lax")
        self.assertEqual(response.cookies[SESSION_COOKIE_NAME]["path"], "/")

    def test_session_manager(self):
        """Test SessionManager gets or generates a session ID"""
        # Test with existing session
        test_session_id = str(uuid.uuid4())
        request = MockRequest(cookies={SESSION_COOKIE_NAME: test_session_id})
        response = MockResponse()

        manager = SessionManager(request, response)
        self.assertEqual(manager.session_id, test_session_id)

        # Test with new session
        request = MockRequest()
        response = MockResponse()

        manager = SessionManager(request, response)
        session_id = manager.session_id

        # Verify ID was generated and cookie was set
        self.assertIsNotNone(session_id)
        try:
            uuid_obj = uuid.UUID(session_id)
            self.assertEqual(str(uuid_obj), session_id)
        except ValueError:
            self.fail("SessionManager did not produce a valid UUID")

        self.assertIn(SESSION_COOKIE_NAME, response.cookies)
        self.assertEqual(response.cookies[SESSION_COOKIE_NAME]["value"], session_id)

    def test_session_manager_clear_session(self):
        """Test that SessionManager.clear_session removes the cookie"""
        request = MockRequest()
        response = MockResponse()

        manager = SessionManager(request, response)
        manager.clear_session()

        # Verify cookie was deleted
        self.assertIn(SESSION_COOKIE_NAME, response._deleted_cookies)
        self.assertTrue(
            response._deleted_cookies[SESSION_COOKIE_NAME]["httponly"]
        )  # True to match set_session_cookie
        self.assertEqual(response._deleted_cookies[SESSION_COOKIE_NAME]["path"], "/")


if __name__ == "__main__":
    import asyncio

    print("Running tests for session_manager.py")
    print(f"App path: {app_path}")
    print(f"sys.path: {sys.path}")

    # Create a test suite with only synchronous tests
    sync_suite = unittest.TestSuite()
    sync_methods = [
        m
        for m in dir(TestSessionManager)
        if m.startswith("test_") and not m.startswith("test_get_session_id")
    ]
    for method in sync_methods:
        print(f"Adding test method: {method}")
        sync_suite.addTest(TestSessionManager(method))

    # Run synchronous tests
    print("Running synchronous tests...")
    runner = unittest.TextTestRunner(verbosity=2)
    runner.run(sync_suite)

    # Run async tests manually
    print("\nRunning asynchronous tests...")
    test_case = TestSessionManager()

    # Run test_get_session_id_existing
    print("\ntest_get_session_id_existing:")
    try:
        asyncio.run(test_case.test_get_session_id_existing())
        print("OK")
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback

        traceback.print_exc()

    # Run test_get_session_id_new
    print("\ntest_get_session_id_new:")
    try:
        asyncio.run(test_case.test_get_session_id_new())
        print("OK")
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback

        traceback.print_exc()
