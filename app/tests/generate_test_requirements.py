#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Script to create a test requirements file for sat-annotator backend.
"""

import os
import sys
from pathlib import Path

REQUIREMENTS = [
    # Testing frameworks
    "httpx==0.28.1",
    "coverage==7.8.0",
    # FastAPI related
    "fastapi>=0.115.8",
    "starlette>=0.45.3",
    "uvicorn>=0.27.0",
    "python-multipart>=0.0.7",
    # Image processing
    "pillow==11.2.1",
]


def main():
    """Generate requirements file."""
    # Get the directory of this script
    script_dir = Path(__file__).resolve().parent
    requirements_path = script_dir / "test_requirements.txt"

    with open(requirements_path, "w") as f:
        f.write("# Test requirements for sat-annotator backend\n")
        for req in REQUIREMENTS:
            f.write(f"{req}\n")

    print(f"Created {requirements_path}")


if __name__ == "__main__":
    main()
