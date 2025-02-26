# Satellite Image Annotation Tool

An AI-powered tool for automated and assisted annotation of satellite imagery.

## Project Overview

The Satellite Image Annotation Tool (SAT-Annotator) is designed to streamline the process of annotating satellite images using artificial intelligence. This tool helps researchers, GIS specialists, and remote sensing analysts to quickly identify, label, and extract features from satellite imagery.

## Features

**Current:**
- RESTful API built with FastAPI
- Docker containerization for easy deployment
- Basic health check endpoint

**Planned:**
- Image upload and management
- AI-assisted annotation for common features (buildings, roads, vegetation)
- Manual annotation tools with intuitive UI
- Export annotations in common formats (GeoJSON, Shapefile)
- Model training on custom datasets

## Technology Stack

- **Backend**: Python, FastAPI
- **Machine Learning**: TensorFlow, Keras
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

#### API Documentation
- Interactive API docs: http://localhost:8000/docs
- Alternative API docs: http://localhost:8000/redoc

## API Documentation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check, returns welcome message |
| `/upload-image/` | POST | Upload satellite imagery (in development) |

## Development Roadmap

- [x] Project setup with FastAPI
- [x] Docker containerization
- [ ] Image upload functionality
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