<p align="center">
  <img src="docs/logo.png" alt="SAT-Annotator Logo" width="300"/>
</p>

# Satellite Image Annotation Tool

An AI-powered tool for automated and assisted annotation of satellite imagery.

## Project Overview

The Satellite Image Annotation Tool (SAT-Annotator) is designed to streamline the process of annotating satellite images using artificial intelligence. This tool helps researchers, GIS specialists, and remote sensing analysts to quickly identify, label, and extract features from satellite imagery.

## Sponsorship

This project is sponsored by the Egyptian Space Agency (EgSA).

## Features

**Current:**
- RESTful API built with FastAPI
- Session-based in-memory storage for image metadata (no database required)
- File upload endpoint for satellite imagery
- Image retrieval endpoint
- Docker containerization for easy deployment
- Local development support without Docker
- Automatic image metadata extraction (resolution)
- AI-powered segmentation using Segment Anything Model (SAM)
- Point-prompt based segmentation
- Automatic polygon generation from segmentation masks
- JSON export format support
- Smart caching system for repeated segmentation operations

**Planned:**
- Multiple prompt types (box, points, text)
- Manual annotation tools with intuitive UI
- Export annotations in additional formats (Shapefile)
- Model training on custom datasets

## Technology Stack

- **Backend**: Python, FastAPI
- **Storage**: Session-based in-memory storage
- **AI Models**: 
  - Segment Anything Model (SAM)
  - PyTorch with CUDA support
- **Image Processing**: 
  - OpenCV
  - Pillow (PIL)
- **Containerization**: Docker (optional)
- **Data Processing**: NumPy
- **Frontend**: Vanilla HTML5/CSS3/JavaScript (no frameworks)
- **API**: Pure RESTful API architecture for efficient data handling
- **Optimization**: Smart caching and instant preprocessing for maximum performance

## Installation & Setup

### Prerequisites

- Git
- Python 3.10+ (Python 3.11+ recommended)
- Docker and Docker Compose (optional, for containerized deployment)
- CUDA-capable GPU (optional, for faster AI segmentation)

### Quick Start with Docker (Recommended)

1. Clone the repository:
```bash
git clone https://github.com/yourusername/sat-annotator.git
cd sat-annotator
```

2. Build and run with Docker:
```bash
docker-compose up --build
```
   *Note: The SAM model will be automatically downloaded during the Docker build process.*

3. Access the application at `http://localhost:8000`

### Local Development Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/sat-annotator.git
cd sat-annotator
```

2. Download the SAM model (required for local development):
   - Download the SAM model checkpoint: [sam_vit_h_4b8939.pth](https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth)
   - Create a `models/` directory in the project root if it doesn't exist
   - Place the downloaded file in the `models/` directory

3. Set up Python environment:
```bash
# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install backend dependencies
pip install -r app/requirements.txt
pip install git+https://github.com/facebookresearch/segment-anything.git
```

   **Note on PyTorch versions:**
   - `requirements.txt`: Contains CUDA version of PyTorch for local development with GPU acceleration
   - `requirements-ci.txt`: Contains CPU version of PyTorch for CI/testing environments
   - If you don't have CUDA support, install PyTorch CPU version first:
     ```bash
     pip install torch==2.5.1+cpu torchvision==0.20.1+cpu --index-url https://download.pytorch.org/whl/cpu
     ```

4. Run the application:
```bash
uvicorn app.main:app --reload
```

5. Access the application at `http://localhost:8000`

### Note: Frontend is Integrated

The frontend is served directly by the FastAPI backend as static files. No separate Node.js setup is required.

**Docker vs Local Development:**
- **Docker**: SAM model downloads automatically during build process
- **Local Development**: Manual model download required (as shown above)

## Project Structure

```
sat-annotator/
├── .github/                      # CI/CD workflows
│   └── ci.yml                    # GitHub Actions pipeline
├── app/                          # Backend application
│   ├── main.py                   # FastAPI application entry point
│   ├── requirements.txt          # Python dependencies (CUDA version for local dev)
│   ├── requirements-ci.txt       # Python dependencies (CPU version for CI/testing)
│   ├── routers/                  # API route handlers
│   │   ├── session_images.py     # Image upload, retrieval, management
│   │   └── session_segmentation.py # AI segmentation and annotations
│   ├── storage/                  # Session management
│   │   ├── session_store.py      # In-memory session storage
│   │   └── session_manager.py    # Session cookie management
│   ├── utils/                    # Utility modules
│   │   ├── image_processing.py   # Image handling and validation
│   │   └── sam_model.py          # SAM model integration
│   ├── schemas/                  # Pydantic data models
│   │   └── session_schemas.py    # Request/response models
│   ├── tests/                    # Unit tests
│   │   ├── README.md             # Testing documentation
│   │   ├── run_unittests.py      # Test runner
│   │   ├── mocks.py              # Mock objects for testing
│   │   ├── test_requirements.txt # Testing dependencies
│   │   ├── generate_test_requirements.py # Dependency generator
│   │   └── unittest_*.py         # Individual test files
│   └── logs/                     # Application logs (created at runtime)
├── web/                          # Frontend application
│   ├── index.html                # Main application interface
│   ├── styles.css                # Application styling
│   └── js/                       # JavaScript modules
│       ├── app.js                # Main application logic
│       ├── api.js                # API communication
│       ├── canvas.js             # Canvas drawing and interaction
│       ├── annotations.js        # Annotation management
│       └── utils.js              # Utility functions
├── models/                       # AI model files
│   └── sam_vit_h_4b8939.pth     # SAM model (downloaded/mounted)
├── uploads/                      # User uploaded images (created at runtime)
├── annotations/                  # Generated annotation files (created at runtime)
├── logs/                         # Application logs (created at runtime)
├── data/                         # Sample/test data (optional)
├── docs/                         # Project documentation
├── venv/                         # Python virtual environment (optional)
├── .gitignore                    # Git ignore rules
├── docker-compose.yml            # Docker orchestration
├── Dockerfile.app                # Backend container definition
├── Dockerfile.web                # Frontend container definition
├── LICENSE                       # MIT License
└── README.md                     # This file
```

### Runtime Directories

These directories are created automatically by the application:

- **`uploads/`**: Stores user-uploaded satellite images
- **`annotations/`**: Stores AI-generated and manual annotation JSON files  
- **`logs/`** & **`app/logs/`**: Application log files for debugging
- **`models/`**: Contains the SAM AI model (auto-downloaded in Docker)

### Development Notes

- Runtime directories are ignored by Git (see `.gitignore`)
- The application creates necessary directories on startup
- Session data is stored in memory and cleared on restart
- Console logs (for debugging) are embedded in JavaScript source files

## Usage

### Web Interface

1. Start the application (Docker or local)
2. Open `http://localhost:8000` in your browser
3. Upload satellite images via drag & drop or file picker
4. Use AI segmentation tools or manual annotation
5. Export annotations in JSON format

### API Reference

The application provides a comprehensive REST API for programmatic access:

#### Health Check
```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy"
}
```

#### Session Management

##### Get Session Information
```bash
curl http://localhost:8000/api/session-info/
```

##### Clear Session Data
```bash
curl -X DELETE http://localhost:8000/api/session/
```

##### Export Session Data
```bash
curl -X POST http://localhost:8000/api/export-session/
```

#### Image Management

##### Upload an Image
```bash
curl -X POST http://localhost:8000/api/upload-image/ \
  -H "Content-Type: multipart/form-data" \
  -F "file=@./data/satellite-image.tif"
```

Expected response:
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "image": {
    "image_id": "uuid-string",
    "file_name": "satellite-image.tif",
    "file_path": "uploads/uuid-filename.tif",
    "resolution": "1024x768",
    "source": "user_upload",
    "capture_date": "2025-06-11T10:30:00.000Z",
    "created_at": "2025-06-11T10:30:00.000Z"
  }
}
```

##### Retrieve All Images
```bash
curl http://localhost:8000/api/images/
```

##### Get Specific Image
```bash
curl http://localhost:8000/api/images/{image_id}/
```

##### Delete Image and Annotations
```bash
curl -X DELETE http://localhost:8000/api/images/{image_id}
```

#### AI Segmentation

##### Preprocess Image for Segmentation
```bash
curl -X POST http://localhost:8000/api/preprocess/ \
  -H "Content-Type: application/json" \
  -d '{"image_id": "your-image-id"}'
```

##### Generate Point-Based Segmentation
```bash
curl -X POST http://localhost:8000/api/segment/ \
  -H "Content-Type: application/json" \
  -d '{
    "image_id": "your-image-id",
    "x": 0.5,
    "y": 0.3,
    "label": "Building"
  }'
```

Expected response:
```json
{
  "success": true,
  "polygon": [[0.1, 0.2], [0.3, 0.2], [0.3, 0.4], [0.1, 0.4]],
  "annotation_id": "annotation-uuid",
  "label": "Building",
  "confidence": 0.92
}
```

#### Annotation Management

##### Create Manual Annotation
```bash
curl -X POST http://localhost:8000/api/annotations/ \
  -H "Content-Type: application/json" \
  -d '{
    "image_id": "your-image-id",
    "polygon": [[0.1, 0.2], [0.3, 0.2], [0.3, 0.4], [0.1, 0.4]],
    "label": "Water",
    "annotation_type": "manual"
  }'
```

##### Update Annotation
```bash
curl -X PUT http://localhost:8000/api/annotations/{annotation_id} \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Updated Label",
    "polygon": [[0.1, 0.2], [0.3, 0.2], [0.3, 0.4], [0.1, 0.4]]
  }'
```

##### Delete Annotation
```bash
curl -X DELETE http://localhost:8000/api/annotations/{annotation_id}
```

##### Get Image Annotations
```bash
curl http://localhost:8000/api/annotations/{image_id}
```

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

For comprehensive API examples, see the **API Reference** section above.

## API Documentation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check for container orchestration |
| `/api/upload-image/` | POST | Upload satellite imagery (TIFF, PNG, JPG) |
| `/api/images/` | GET | Retrieve all uploaded images |
| `/api/images/{id}/` | GET | Get specific image by ID |
| `/api/images/{id}` | DELETE | Delete image and associated annotations |
| `/api/preprocess/` | POST | Prepare image for AI segmentation |
| `/api/segment/` | POST | Generate AI segmentation from point |
| `/api/annotations/` | POST | Create manual annotation |
| `/api/annotations/{id}` | PUT | Update existing annotation |
| `/api/annotations/{id}` | DELETE | Delete annotation |
| `/api/annotations/{image_id}` | GET | Get all annotations for image |
| `/api/session-info/` | GET | Get current session information |
| `/api/session/` | DELETE | Clear all session data |
| `/api/export-session/` | POST | Export session data as JSON |

**Interactive Documentation:**
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Session Management

The application uses session-based in-memory storage for temporary data management:

- **Image Storage**: Uploaded images are stored in the uploads directory
- **Session Data**: Image metadata and annotations are kept in memory during the session
- **Annotations**: Generated polygons from SAM segmentation are stored as JSON
- **Temporary Files**: Session data is cleared when the application restarts

Benefits:
- No database setup required for quick deployment
- Simplified development and testing
- Stateless application design
- Easy horizontal scaling

## Development Roadmap

- [x] Project setup with FastAPI
- [x] Docker containerization
- [x] Session-based storage architecture
- [x] Image upload functionality
- [x] Image metadata extraction
- [x] SAM model integration
- [x] Point-prompt segmentation
- [x] JSON export
- [x] Vanilla HTML/CSS/JavaScript frontend
- [x] Professional codebase cleanup and optimization
- [ ] Multiple prompt types support
- [ ] Manual annotation interface
- [ ] Additional export formats

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Author

Created by ...

---

*Note: This project is under active development. Features and API endpoints are subject to change.*