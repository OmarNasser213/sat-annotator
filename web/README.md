# SAT Annotator Frontend

A responsive web frontend for the Satellite Image Annotation Tool built with vanilla HTML, CSS, and JavaScript.

## Features

- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Image Upload**: Drag & drop or click to upload satellite images (JPG, PNG, TIFF, GeoTIFF)
- **AI-Powered Segmentation**: Click on image to generate AI segmentation using SAM model
- **Manual Annotation**: Draw polygons manually for precise annotation
- **Smart Label System**: Select from predefined labels or add custom labels
- **Annotation Management**: Edit labels, delete annotations, view annotation list
- **Export Functionality**: Export annotations in JSON format
- **Zoom and Pan**: Interactive canvas with zoom and pan controls
- **Keyboard Shortcuts**: Efficient workflow with keyboard shortcuts
- **Session Management**: Manages uploaded images and annotations in session

## Tools

1. **Select Tool (1)**: Select and manipulate existing annotations
2. **AI Point Tool (2)**: Click to generate AI segmentation at point
3. **Polygon Tool (3)**: Draw manual polygon annotations
4. **Pan Tool (4)**: Pan around the image

## Label System

The application includes a smart label system with:
- **Predefined Labels**: Building, Road, Vegetation, Water, Parking
- **Current Label Display**: Shows which label will be applied to new annotations
- **Custom Labels**: Add your own labels and remove them when not needed
- **Automatic Assignment**: New annotations automatically get the currently selected label
- **Easy Editing**: Click edit on any annotation to change its label

## Keyboard Shortcuts

- `1` - Select tool
- `2` - AI Point tool  
- `3` - Polygon tool
- `4` - Pan tool
- `ESC` - Cancel drawing / Clear selection
- `DELETE` - Delete selected annotation
- `+` - Zoom in
- `-` - Zoom out  
- `0` - Fit to screen

## Usage

1. **Upload Image**: Drag and drop or click the upload area to add satellite images
2. **Select Label**: Choose the label you want to apply to new annotations from the Labels section
3. **Select Tool**: Choose appropriate tool from the toolbar
4. **Annotate**: 
   - For AI segmentation: Select AI Point tool and click on features
   - For manual annotation: Select Polygon tool and click to draw points
   - All new annotations will automatically use the currently selected label
5. **Manage Labels**: 
   - Click any label button to make it active
   - Add custom labels using the input field
   - Remove custom labels by clicking the X button (default labels cannot be removed)
6. **Edit Existing**: Right-click any annotation to edit its label or delete it
7. **Export**: Click Export JSON to download annotations in JSON format

## File Structure

```
web/
├── index.html          # Main HTML file
├── styles.css          # All CSS styles
├── js/
│   ├── app.js          # Main application controller
│   ├── api.js          # API communication layer
│   ├── canvas.js       # Canvas management
│   ├── annotations.js  # Annotation management
│   └── utils.js        # Utility functions
└── package.json        # Project metadata
```

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Development

To run locally:

```bash
cd web
python -m http.server 8080
```

Then visit `http://localhost:8080`

## JSON Export Format

Annotations are exported in the following JSON structure:

```json
{
  "image": {
    "id": "image_id",
    "filename": "image.tif",
    "resolution": "1024x768",
    "width": 1024,
    "height": 768
  },
  "annotations": [
    {
      "id": "annotation_id",
      "type": "ai_segment|manual_polygon",
      "label": "building",
      "polygon": [[x1,y1], [x2,y2], ...],
      "source": "ai|manual",
      "created": "2025-06-02T...",
      "points_count": 5
    }
  ],
  "export_info": {
    "format": "json",
    "exported_at": "2025-06-02T...",
    "tool": "SAT Annotator",
    "version": "1.0.0"
  },
  "statistics": {
    "total_annotations": 10,
    "ai_generated": 7,
    "manual": 3,
    "unique_labels": 4
  }
}
```

## Responsive Design

The interface adapts to different screen sizes:

- **Desktop**: Full sidebar and canvas layout
- **Tablet**: Optimized for touch interaction
- **Mobile**: Collapsible sidebar, touch-friendly controls

## Performance

- Optimized canvas rendering with device pixel ratio support
- Efficient polygon hit testing for annotation selection
- Debounced resize and scroll events
- Progressive image loading
