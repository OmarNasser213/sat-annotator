FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OpenCV, PyTorch, and PostgreSQL
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libpq-dev \
    git \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY app/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install the Segment Anything library
RUN pip install 'git+https://github.com/facebookresearch/segment-anything.git'

# Download the SAM model checkpoint
RUN mkdir -p /app/models \
    && wget https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth -P /app/models/

# Create annotations directory (outside /app/app to avoid volume overwrite)
RUN mkdir -p /app/annotations

# Copy the rest of the application
COPY . .

# Command to run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]