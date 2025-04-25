# Backend Unit Tests

This directory contains unit tests for the sat-annotator backend application.

## Test Structure

The tests are organized using Python's standard unittest framework:

- `unittest_session_store.py`: Tests for the in-memory session store
- `unittest_session_manager.py`: Tests for the session management functionality
- `unittest_image_processing.py`: Tests for image processing utilities
- `unittest_main_api.py`: Tests for the main API endpoints
- `unittest_sam_segmenter.py`: Tests for the SAM segmentation model
- `unittest_session_images_api.py`: Tests for the image upload and management API
- `unittest_segmentation_api.py`: Tests for the segmentation API endpoints

## Running the Tests

### Installing Test Dependencies

Install the required testing packages:

```bash
pip install -r app/tests/test_requirements.txt
```

To generate an updated requirements file for tests:

```bash
python app/tests/generate_test_requirements.py
```

### Running the Tests

You can run all tests using the provided script:

```bash
python app/tests/run_unittests.py
```

This script will run all test files and provide a summary of the results.

You can also run individual test files directly:

```bash
python app/tests/unittest_session_store.py
python app/tests/unittest_session_manager.py
python app/tests/unittest_image_processing.py
python app/tests/unittest_main_api.py
python app/tests/unittest_sam_segmenter.py
python app/tests/unittest_session_images_api.py
python app/tests/unittest_segmentation_api.py
```

These tests are designed to run without any additional configuration and work reliably across different environments.

## Test Mocks

The tests use mock objects to avoid loading heavy dependencies:

- `mocks.py`: Contains mock implementations for external libraries like torch, cv2, and segment_anything

## Testing in CI/CD

For CI/CD, a GitHub Actions workflow is set up in `.github/workflows/tests.yml` that will run all unittest tests on each push to the main branch.
