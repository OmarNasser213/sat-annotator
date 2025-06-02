// Canvas management for image display and interaction

class CanvasManager {
    constructor() {
        console.log('CanvasManager: Starting constructor...');
        
        try {
            console.log('CanvasManager: Getting DOM elements...');
            this.canvas = document.getElementById('mainCanvas');
            this.ctx = this.canvas.getContext('2d');
            this.canvasWrapper = document.getElementById('canvasWrapper');
            this.placeholder = this.canvasWrapper.querySelector('.canvas-placeholder');
            console.log('CanvasManager: DOM elements obtained');
        } catch (error) {
            console.error('CanvasManager: Failed to get DOM elements:', error);
            throw error;
        }
        
        // Canvas state
        console.log('CanvasManager: Setting up state variables...');
        this.currentImage = null;
        this.imageElement = null;
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isDragging = false;
        this.lastMousePos = { x: 0, y: 0 };
          // Drawing state
        this.isDrawing = false;
        this.currentTool = 'select';
        this.currentPolygon = [];
        this.tempPolygon = [];
        
        // Redraw control
        this.redrawPending = false;
        this.lastRedrawTime = 0;
        this.redrawThrottle = 16; // ~60fps max
        
        console.log('CanvasManager: State variables set');
        
        // Initialize
        try {
            console.log('CanvasManager: Setting up canvas...');
            this.setupCanvas();        console.log('CanvasManager: Canvas setup complete');
        } catch (error) {
            console.error('CanvasManager: Canvas setup failed:', error);
            throw error;
        }
        
        try {
            console.log('CanvasManager: Binding events...');
            this.bindEvents();
            console.log('CanvasManager: Events bound');
        } catch (error) {
            console.error('CanvasManager: Event binding failed:', error);
            throw error;
        }
        
        try {
            console.log('CanvasManager: Updating zoom display...');
            this.updateZoomDisplay();
            console.log('CanvasManager: Zoom display updated');
        } catch (error) {
            console.error('CanvasManager: Zoom display update failed:', error);
            throw error;
        }
        
        console.log('CanvasManager: Constructor complete');
    }    setupCanvas() {
        // Set canvas size to fill container
        this.resizeCanvas();
        
        // Add flag to prevent resize loops
        this.isResizing = false;
        
        // Handle window resize
        window.addEventListener('resize', Utils.debounce(() => {
            if (this.isResizing) return;
            this.isResizing = true;
            
            console.log('Window resize event triggered');
            this.resizeCanvas();
            if (this.imageElement) {
                console.log('Calling fitToScreen after resize');
                this.fitToScreen();
            } else {
                this.redraw();
            }
            
            setTimeout(() => {
                this.isResizing = false;
            }, 100);
        }, 250));
    }resizeCanvas() {
        const rect = this.canvasWrapper.getBoundingClientRect();
        console.log('Resizing canvas - wrapper dimensions:', rect.width, 'x', rect.height);
        
        // Set high DPI support
        const dpr = window.devicePixelRatio || 1;
        const displayWidth = rect.width;
        const displayHeight = rect.height;
        
        console.log('Device pixel ratio:', dpr);
        console.log('Display dimensions:', displayWidth, 'x', displayHeight);
        
        this.canvas.width = displayWidth * dpr;
        this.canvas.height = displayHeight * dpr;
        this.canvas.style.width = displayWidth + 'px';
        this.canvas.style.height = displayHeight + 'px';
        
        console.log('Canvas actual dimensions:', this.canvas.width, 'x', this.canvas.height);
        console.log('Canvas style dimensions:', this.canvas.style.width, 'x', this.canvas.style.height);
        
        // Reset transform to avoid accumulation
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        // Scale context for high DPI
        this.ctx.scale(dpr, dpr);
        console.log('Context scaled by:', dpr);
    }

    getDisplayDimensions() {
        const rect = this.canvasWrapper.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
    }

    bindEvents() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
        this.canvas.addEventListener('contextmenu', this.handleContextMenu.bind(this));
        
        // Touch events for mobile
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
        
        // Prevent default touch behaviors
        this.canvas.addEventListener('touchstart', (e) => e.preventDefault());
        this.canvas.addEventListener('touchmove', (e) => e.preventDefault());
        
        // Tool buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setTool(btn.dataset.tool);
                this.updateToolButtons();
            });
        });
        
        // Zoom controls
        document.getElementById('zoomIn').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOut').addEventListener('click', () => this.zoomOut());
        document.getElementById('fitToScreen').addEventListener('click', () => this.fitToScreen());
    }

    setTool(tool) {
        this.currentTool = tool;
        this.canvas.style.cursor = this.getCursor(tool);
        
        // Cancel current drawing if switching tools
        if (this.isDrawing && tool !== 'polygon') {
            this.cancelCurrentPolygon();
        }
    }

    getCursor(tool) {
        switch (tool) {
            case 'select': return 'default';
            case 'point': return 'crosshair';
            case 'polygon': return 'crosshair';
            case 'pan': return 'grab';
            default: return 'default';
        }
    }

    updateToolButtons() {
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === this.currentTool);
        });
    }

    handleMouseDown(e) {
        const pos = Utils.getMousePos(this.canvas, e);
        this.lastMousePos = pos;
        
        if (e.button === 0) { // Left click
            this.handlePrimaryAction(pos, e);
        } else if (e.button === 2) { // Right click
            this.handleSecondaryAction(pos, e);
        }
    }

    handleMouseMove(e) {
        const pos = Utils.getMousePos(this.canvas, e);
        this.updateMouseCoordinates(pos);
        
        if (this.isDragging && this.currentTool === 'pan') {
            this.handlePan(pos);
        } else if (this.isDrawing && this.currentTool === 'polygon') {
            this.updatePolygonPreview(pos);
        }
        
        this.lastMousePos = pos;
    }

    handleMouseUp(e) {
        this.isDragging = false;
        this.canvas.style.cursor = this.getCursor(this.currentTool);
    }

    handleWheel(e) {
        e.preventDefault();
        const pos = Utils.getMousePos(this.canvas, e);
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoomAt(pos.x, pos.y, delta);
    }

    handleContextMenu(e) {
        e.preventDefault();
        // Show context menu for annotations if hovering over one
        // Implementation would go here
    }

    handleTouchStart(e) {
        const touch = e.touches[0];
        const pos = Utils.getTouchPos(this.canvas, e);
        this.lastMousePos = pos;
        this.handlePrimaryAction(pos, e);
    }

    handleTouchMove(e) {
        const touch = e.touches[0];
        const pos = Utils.getTouchPos(this.canvas, e);
        this.updateMouseCoordinates(pos);
        
        if (this.isDragging && this.currentTool === 'pan') {
            this.handlePan(pos);
        }
        
        this.lastMousePos = pos;
    }

    handleTouchEnd(e) {
        this.isDragging = false;
    }

    handlePrimaryAction(pos, e) {
        switch (this.currentTool) {
            case 'select':
                this.handleSelect(pos);
                break;
            case 'point':
                this.handlePointClick(pos);
                break;
            case 'polygon':
                this.handlePolygonClick(pos, e);
                break;
            case 'pan':
                this.isDragging = true;
                this.canvas.style.cursor = 'grabbing';
                break;
        }
    }

    handleSecondaryAction(pos, e) {
        if (this.currentTool === 'polygon' && this.isDrawing) {
            this.finishPolygon();
        }
    }

    handleSelect(pos) {
        // Check if clicking on an annotation
        const annotation = window.annotationManager.getAnnotationAtPoint(pos);
        if (annotation) {
            window.annotationManager.selectAnnotation(annotation.id);
        } else {
            window.annotationManager.clearSelection();
        }
    }    async handlePointClick(pos) {
        if (!this.currentImage) return;
        
        console.log('Click position (canvas coords):', pos);
        console.log('Image dimensions:', this.imageElement.naturalWidth, 'x', this.imageElement.naturalHeight);
        console.log('Canvas dimensions:', this.canvas.width, 'x', this.canvas.height);
        console.log('Transform:', { scale: this.scale, offsetX: this.offsetX, offsetY: this.offsetY });
        
        // Convert canvas coordinates to normalized image coordinates (0-1)
        const imageCoords = Utils.canvasToImageCoords(
            pos.x, pos.y,
            this.imageElement.naturalWidth,
            this.imageElement.naturalHeight,
            this.canvas.width,
            this.canvas.height,
            this.scale,
            this.offsetX,
            this.offsetY
        );
        
        console.log('Converted to normalized image coords:', imageCoords);
        
        // Validate that coordinates are in 0-1 range
        if (imageCoords.x < 0 || imageCoords.x > 1 || imageCoords.y < 0 || imageCoords.y > 1) {
            console.warn('Click coordinates are outside image bounds:', imageCoords);
            return;
        }
          try {
            const result = await api.segment(this.currentImage.image_id, imageCoords.x, imageCoords.y);
            
            console.log('AI segmentation result:', result);
              if (result.polygon && result.polygon.length > 0) {
                console.log('AI polygon received:', result.polygon.length, 'points');
                console.log('AI polygon sample points (normalized 0-1):', result.polygon.slice(0, 3));
                
                // Validate that coordinates are in normalized range (0-1)
                const isNormalized = result.polygon.every(point => 
                    point[0] >= 0 && point[0] <= 1 && point[1] >= 0 && point[1] <= 1
                );
                
                if (!isNormalized) {
                    console.warn('AI polygon coordinates are not normalized (0-1 range):', result.polygon.slice(0, 3));
                }
                
                // Create annotation - polygon should be in normalized coordinates (0-1)
                // The drawAnnotations method will convert to canvas coordinates when needed
                const annotation = {
                    id: Utils.generateId(),
                    type: 'ai_segment',
                    polygon: result.polygon, // Keep in normalized coordinates (0-1)
                    label: window.annotationManager.currentLabel,
                    created: new Date().toISOString(),
                    source: 'ai'
                };
                
                console.log('AI annotation created with normalized polygon:', annotation);
                
                window.annotationManager.addAnnotation(annotation);
                this.redraw();
                
                console.log('AI annotation added and canvas redrawn');
                
                // The label is automatically applied from currentLabel, no modal needed
            } else {
                console.warn('AI segmentation returned no polygon or empty polygon');
            }
        } catch (error) {
            console.error('Segmentation failed:', error);
        }
    }

    handlePolygonClick(pos, e) {
        if (e.detail === 2) { // Double click
            this.finishPolygon();
            return;
        }
        
        if (!this.isDrawing) {
            // Start new polygon
            this.isDrawing = true;
            this.currentPolygon = [pos];
            this.tempPolygon = [];
        } else {
            // Add point to current polygon
            this.currentPolygon.push(pos);
        }
        
        this.redraw();
    }

    updatePolygonPreview(pos) {
        if (this.isDrawing && this.currentPolygon.length > 0) {
            this.tempPolygon = [...this.currentPolygon, pos];
            this.redraw();
        }
    }

    finishPolygon() {
        if (this.currentPolygon.length >= 3) {
            // Convert canvas coordinates to image coordinates
            const imagePolygon = this.currentPolygon.map(point => {
                const imageCoords = Utils.canvasToImageCoords(
                    point.x, point.y,
                    this.imageElement.naturalWidth,
                    this.imageElement.naturalHeight,
                    this.canvas.width,
                    this.canvas.height,
                    this.scale,
                    this.offsetX,
                    this.offsetY
                );
                return [imageCoords.x, imageCoords.y];
            });
              // Create annotation
            const annotation = {
                id: Utils.generateId(),
                type: 'manual_polygon',
                polygon: imagePolygon,
                canvasPolygon: [...this.currentPolygon],
                label: window.annotationManager.currentLabel,
                created: new Date().toISOString(),
                source: 'manual'
            };
            
            window.annotationManager.addAnnotation(annotation);
        }
        
        this.cancelCurrentPolygon();
    }

    cancelCurrentPolygon() {
        this.isDrawing = false;
        this.currentPolygon = [];
        this.tempPolygon = [];
        this.redraw();
    }

    handlePan(pos) {
        const dx = pos.x - this.lastMousePos.x;
        const dy = pos.y - this.lastMousePos.y;
        
        this.offsetX += dx;
        this.offsetY += dy;        
        this.redraw();
    }    loadImage(imageData) {
        console.log('CanvasManager.loadImage called with:', imageData);
        this.currentImage = imageData;
        
        const img = new Image();
        img.onload = () => {
            console.log('Image loaded successfully:', img.naturalWidth, 'x', img.naturalHeight);            this.imageElement = img;
            this.placeholder.hidden = true;
            console.log('Placeholder hidden, image ready');
            console.log('Canvas context available:', !!this.ctx);
            console.log('Canvas context properties:', {
                fillStyle: this.ctx.fillStyle,
                strokeStyle: this.ctx.strokeStyle,
                globalAlpha: this.ctx.globalAlpha
            });
            this.fitToScreen();
            this.redraw();
            console.log('Image display complete');
        };
        
        img.onerror = (error) => {
            console.error('Image load error:', error);
            console.error('Failed to load image from URL:', img.src);
            Utils.showToast('Failed to load image', 'error');
        };
        
        const imageUrl = api.getImageUrl(imageData.file_path);
        console.log('Loading image from URL:', imageUrl);
        img.crossOrigin = 'anonymous'; // Add CORS support for images
        img.src = imageUrl;
    }    fitToScreen() {
        if (!this.imageElement || this.isResizing) return;
        
        const { width: canvasWidth, height: canvasHeight } = this.getDisplayDimensions();
        const imageWidth = this.imageElement.naturalWidth;
        const imageHeight = this.imageElement.naturalHeight;
        
        console.log('fitToScreen - Canvas display dimensions:', canvasWidth, 'x', canvasHeight);
        console.log('fitToScreen - Image natural dimensions:', imageWidth, 'x', imageHeight);
        
        // Calculate scale to fit image in canvas
        const scaleX = canvasWidth / imageWidth;
        const scaleY = canvasHeight / imageHeight;
        const newScale = Math.min(scaleX, scaleY) * 0.9; // 90% to add some padding
        
        // Only update if values have changed significantly
        const scaleChanged = Math.abs(newScale - this.scale) > 0.001;
        const newOffsetX = (canvasWidth - imageWidth * newScale) / 2;
        const newOffsetY = (canvasHeight - imageHeight * newScale) / 2;
        const offsetChanged = Math.abs(newOffsetX - this.offsetX) > 1 || Math.abs(newOffsetY - this.offsetY) > 1;
        
        if (scaleChanged || offsetChanged) {
            this.scale = newScale;
            this.offsetX = newOffsetX;
            this.offsetY = newOffsetY;
            
            console.log('fitToScreen - Updated scale:', this.scale);
            console.log('fitToScreen - Updated offsets:', this.offsetX, this.offsetY);
            
            this.updateZoomDisplay();
            this.redraw();
        } else {
            console.log('fitToScreen - No significant changes, skipping redraw');
        }
    }zoomIn() {
        const { width, height } = this.getDisplayDimensions();
        this.zoomAt(width / 2, height / 2, 1.2);
    }

    zoomOut() {
        const { width, height } = this.getDisplayDimensions();
        this.zoomAt(width / 2, height / 2, 0.8);
    }

    zoomAt(x, y, factor) {
        const newScale = Utils.clamp(this.scale * factor, 0.1, 10);
        
        if (newScale !== this.scale) {
            // Zoom towards the cursor position
            this.offsetX = x - (x - this.offsetX) * (newScale / this.scale);
            this.offsetY = y - (y - this.offsetY) * (newScale / this.scale);
            this.scale = newScale;
            
            this.updateZoomDisplay();
            this.redraw();
        }
    }

    updateZoomDisplay() {
        const zoomPercent = Math.round(this.scale * 100);
        document.getElementById('zoomLevel').textContent = `${zoomPercent}%`;
    }    updateMouseCoordinates(pos) {
        // Only update coordinates, don't log excessively
        if (this.currentImage && this.imageElement) {
            const imageCoords = Utils.canvasToImageCoords(
                pos.x, pos.y,
                this.imageElement.naturalWidth,
                this.imageElement.naturalHeight,
                this.canvas.width,
                this.canvas.height,
                this.scale,
                this.offsetX,
                this.offsetY
            );
            
            document.getElementById('mouseCoords').textContent = 
                `x: ${Math.round(imageCoords.x * this.imageElement.naturalWidth)}, y: ${Math.round(imageCoords.y * this.imageElement.naturalHeight)}`;
        } else {
            document.getElementById('mouseCoords').textContent = `x: ${Math.round(pos.x)}, y: ${Math.round(pos.y)}`;
        }
    }redraw() {
        const now = Date.now();
        
        // Throttle redraw calls to prevent excessive rendering
        if (this.redrawPending) return;
        
        if (now - this.lastRedrawTime < this.redrawThrottle) {
            this.redrawPending = true;
            requestAnimationFrame(() => {
                this.redrawPending = false;
                this._performRedraw();
            });
            return;
        }
        
        this._performRedraw();
    }
      _performRedraw() {
        this.lastRedrawTime = Date.now();
        console.log('_performRedraw() called - zoom:', Math.round(this.scale * 100) + '%', 'offset:', Math.round(this.offsetX), Math.round(this.offsetY));
        
        // Clear canvas - use display dimensions since context is scaled by DPR
        const { width, height } = this.getDisplayDimensions();
        this.ctx.clearRect(0, 0, width, height);
        
        if (!this.imageElement) {
            console.log('No image element, skipping draw');
            return;
        }
          // Draw image - simplified approach
        console.log('Drawing image...');
        
        // Ensure we have a clean context state
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        // Reapply DPR scaling
        const dpr = window.devicePixelRatio || 1;
        this.ctx.scale(dpr, dpr);
        
        // Draw the image
        this.ctx.drawImage(
            this.imageElement,
            this.offsetX,
            this.offsetY,
            this.imageElement.naturalWidth * this.scale,
            this.imageElement.naturalHeight * this.scale
        );
        
        // Don't restore context yet - keep DPR scaling for annotations
        console.log('Image drawn successfully');
        
        // Draw annotations with DPR-scaled context
        if (window.annotationManager) {
            console.log('About to draw annotations...');
            window.annotationManager.drawAnnotations(this.ctx, this.scale, this.offsetX, this.offsetY);
            console.log('Annotations drawing complete');
        } else {
            console.log('No annotation manager available');
        }
        
        // Draw current polygon being drawn
        if (this.isDrawing && this.tempPolygon.length > 1) {
            this.drawPolygon(this.tempPolygon, '#3b82f6', 2, true);
        }
        
        // Now restore the context
        this.ctx.restore();
    }

    drawPolygon(points, color = '#3b82f6', lineWidth = 2, isDashed = false) {
        if (points.length < 2) return;
        
        this.ctx.save();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        
        if (isDashed) {
            this.ctx.setLineDash([5, 5]);
        }
        
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        
        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i].x, points[i].y);
        }
        
        if (!isDashed) {
            this.ctx.closePath();
        }
        
        this.ctx.stroke();
        this.ctx.restore();
        
        // Draw points
        points.forEach((point, index) => {
            this.ctx.save();
            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
            this.ctx.fill();
            this.ctx.restore();
        });
    }

    clear() {
        this.currentImage = null;
        this.imageElement = null;
        this.canvas.hidden = true;
        this.placeholder.hidden = false;
        this.cancelCurrentPolygon();
    }
    
    // Debug function to test coordinate transformations
    debugCoordinateTransform() {
        if (!this.imageElement) {
            console.log('No image loaded for coordinate testing');
            return;
        }
        
        console.log('=== Coordinate Transform Debug ===');
        console.log('Image natural dimensions:', this.imageElement.naturalWidth, 'x', this.imageElement.naturalHeight);
        console.log('Current scale:', this.scale);
        console.log('Current offset:', this.offsetX, this.offsetY);
        console.log('Canvas display size:', this.getDisplayDimensions());
        
        // Test corner coordinates (normalized 0-1)
        const testPoints = [
            [0, 0],     // top-left
            [1, 0],     // top-right
            [1, 1],     // bottom-right
            [0, 1],     // bottom-left
            [0.5, 0.5], // center
        ];
        
        console.log('Testing normalized coordinate transformations:');
        testPoints.forEach((point, i) => {
            const canvas = Utils.imageToCanvasCoords(
                point[0], point[1],
                this.imageElement.naturalWidth,
                this.imageElement.naturalHeight,
                this.scale,
                this.offsetX,
                this.offsetY
            );
            console.log(`Point ${i} [${point[0]}, ${point[1]}] -> Canvas [${canvas.x.toFixed(1)}, ${canvas.y.toFixed(1)}]`);
        });
        console.log('=== End Debug ===');
    }
}

// Export for global use
window.CanvasManager = CanvasManager;

// Add debug function to global scope
window.debugCoords = function() {
    if (window.canvasManager) {
        window.canvasManager.debugCoordinateTransform();
    } else {
        console.log('Canvas manager not available');
    }
};
