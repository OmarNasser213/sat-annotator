# Satellite Image Annotation Tool

An AI-powered tool for automated and assisted annotation of satellite imagery.

## Project Overview

The Satellite Image Annotation Tool (SAT-Annotator) is designed to streamline the process of annotating satellite images using artificial intelligence. This tool helps researchers, GIS specialists, and remote sensing analysts to quickly identify, label, and extract features from satellite imagery.

## Features

**Current:**
- RESTful API built with FastAPI
- PostgreSQL database for image metadata storage
- File upload endpoint for satellite imagery
- Image retrieval endpoint
- Docker containerization for easy deployment
- Automatic image metadata extraction (resolution)

**Planned:**
- AI-assisted annotation for common features (buildings, roads, vegetation)
- Manual annotation tools with intuitive UI
- Export annotations in common formats (GeoJSON, Shapefile)
- Model training on custom datasets

## Technology Stack

- **Backend**: Python, FastAPI
- **Database**: PostgreSQL 16
- **ORM**: SQLAlchemy
- **Machine Learning**: TensorFlow
- **Image Processing**: Pillow
- **Containerization**: Docker
- **Data Processing**: NumPy

## Installation & Setup

### Prerequisites

- Docker and Docker Compose
- Git

### Quick Start

1. Clone the repository:
```bash
git clone https://github.com/yourusername/sat-annotator.git
cd sat-annotator
```

2. Build and run with Docker:
```bash
docker-compose up --build
```

3. Access the API at `http://localhost:8000`

## Usage

### Testing the API

#### Root Endpoint
```bash
curl http://localhost:8000/
```

Expected response:
```json
{
  "message": "Welcome to the Satellite Image Annotation Tool"
}
```

#### Upload an Image
```bash
curl -X POST http://localhost:8000/api/upload-image/ \
  -H "Content-Type: multipart/form-data" \
  -F "file=@./data/test_image.jpg"
```

Expected response:
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "image": {
    "file_name": "test_image.jpg",
    "file_path": "uploads/b1030d37-9fa8-4823-b5ad-43ee4cd22e5c.jpg",
    "resolution": "540x360",
    "source": "user_upload",
    "image_id": 1,
    "capture_date": "2025-02-26T19:43:14.121927",
    "created_at": "2025-02-26T19:43:14.121927"
  }
}
```

#### Retrieve All Images
```bash
curl http://localhost:8000/api/images/
```

Expected response:
```json
[
  {
    "file_name": "test_image.jpg",
    "file_path": "uploads/b1030d37-9fa8-4823-b5ad-43ee4cd22e5c.jpg",
    "resolution": "540x360",
    "source": "user_upload",
    "image_id": 1,
    "capture_date": "2025-02-26T19:43:14.121927",
    "created_at": "2025-02-26T19:43:14.121927"
  },
  {
    "file_name": "test_image.jpg",
    "file_path": "uploads/d8defaa1-f5c9-400f-86e7-f2ffc4ce0d3c.jpg",
    "resolution": "540x360", 
    "source": "user_upload",
    "image_id": 2,
    "capture_date": "2025-02-26T20:42:35.066164",
    "created_at": "2025-02-26T20:42:35.066164"
  }
]
```


#### API Documentation
- Interactive API docs: http://localhost:8000/docs
- Alternative API docs: http://localhost:8000/redoc

## API Documentation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check, returns welcome message |
| `/api/upload-image/` | POST | Upload satellite imagery |
| `/api/images/` | GET | Retrieve list of all uploaded images |

## Database Schema

The application uses PostgreSQL with the following structure:

- **images**: Stores metadata about uploaded satellite images
- **labels**: Contains annotation categories (building, road, etc.)
- **ai_models**: Tracks machine learning models used for annotation
- **annotation_files**: Records annotation data associated with images

Relationships:
- An image can have multiple annotation files
- Annotation files can be linked to AI models that generated them

## Development Roadmap

- [x] Project setup with FastAPI
- [x] Docker containerization
- [x] Database integration with PostgreSQL
- [x] Image upload functionality
- [x] Image metadata extraction
- [ ] Basic image visualization
- [ ] AI model integration for automatic feature detection
- [ ] Manual annotation interface
- [ ] Export functionality
- [ ] User authentication

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Author

Created by ...

---

*Note: This project is under active development. Features and API endpoints are subject to change.*