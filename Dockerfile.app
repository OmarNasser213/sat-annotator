FROM python:alpine

WORKDIR /app

# Install system dependencies for OpenCV and PyTorch
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    git \
    wget \
    curl \
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

# Create directories for annotations and uploads
RUN mkdir -p /app/annotations
RUN mkdir -p /app/uploads

# Copy the rest of the application
COPY . .

# Command to run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]