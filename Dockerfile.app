FROM python:3.11-alpine

WORKDIR /app

# Install system dependencies for OpenCV and PyTorch
RUN apk update && apk add --no-cache \
    libgl \
    mesa-gl \
    glib \
    git \
    wget \
    curl \
    build-base \
    musl-dev \
    linux-headers \
    openblas-dev \
    freetype-dev \
    ffmpeg-dev \
    libjpeg-turbo-dev \
    libpng-dev \
    libffi-dev \
    jpeg-dev \
    gcc \
    g++ \
    make \
    cmake

# Copy requirements first for better caching
COPY app/requirements.txt .

# Set environment variables for pip
ENV PIP_DEFAULT_TIMEOUT=100 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

# Install Python dependencies with special handling for problematic packages
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt && \
    # Install the Segment Anything library
    pip install 'git+https://github.com/facebookresearch/segment-anything.git'

# Download the SAM model checkpoint
RUN mkdir -p /app/models \
    && wget https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth -P /app/models/

# Create directories for annotations and uploads
RUN mkdir -p /app/annotations
RUN mkdir -p /app/uploads

# Copy the rest of the application
COPY . .

# Command to run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]