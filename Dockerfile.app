# Build stage
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    wget \
    git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create a virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy and install requirements
COPY app/requirements.txt .

# Install specific PyTorch CPU-only version to save space
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir torch==2.2.0+cpu torchvision==0.17.0+cpu -f https://download.pytorch.org/whl/torch_stable.html && \
    pip install --no-cache-dir opencv-python-headless pillow fastapi uvicorn python-multipart && \
    pip install --no-cache-dir supervision python-jose[cryptography] && \
    pip install --no-cache-dir 'git+https://github.com/facebookresearch/segment-anything.git'

# Final stage
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    wget \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy the virtual environment from the builder stage
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Create necessary directories
RUN mkdir -p /app/models /app/annotations /app/uploads

# Download the SAM model checkpoint (only in the final stage)
RUN wget --no-verbose https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth -P /app/models/

# Copy the application
COPY . .

# Command to run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]