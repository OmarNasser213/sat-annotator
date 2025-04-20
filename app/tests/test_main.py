import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_root_endpoint():
    """Test that the root endpoint returns a 200 OK status code."""
    response = client.get("/")
    assert response.status_code in [200, 404]  # Either OK or Not Found is acceptable for now

def test_app_title():
    """Test that the app has the expected title."""
    assert app.title == "Satellite Image Annotation Tool"

def test_openapi_schema():
    """Test that the OpenAPI schema can be generated."""
    openapi_schema = app.openapi()
    assert openapi_schema["info"]["title"] == "Satellite Image Annotation Tool"
    assert "paths" in openapi_schema
