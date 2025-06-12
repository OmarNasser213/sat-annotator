// Canvas management for image display and interaction

class CanvasManager {
    constructor() {
        try {
            this.canvas = document.getElementById('mainCanvas');
            this.ctx = this.canvas.getContext('2d');
            this.canvasWrapper = document.getElementById('canvasWrapper');
            this.placeholder = this.canvasWrapper.querySelector('.canvas-placeholder');
        } catch (error) {
            console.error('CanvasManager: Failed to get DOM elements:', error);
            throw error;
        }
        
        // Canvas state
        this.currentImage = null;
        this.imageElement = null;
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isDragging = false;
        this.lastMousePos = { x: 0, y: 0 };        // Drawing state
        this.isDrawing = false;
        this.currentTool = 'select';
        this.previousTool = 'select'; // Track previous tool for pan toggle
        this.currentPolygon = [];
        this.tempPolygon = [];
          // Polygon editing state
        this.isEditingPolygon = false;        this.editingAnnotationId = null;
        this.editModeActive = false; // New: separate edit mode toggle state
        this.autoExitEditTimer = null; // Timer for auto-exiting edit mode
        this.draggingVertex = null;
        this.hoveredVertex = null;
        this.hoveredEdge = null;this.vertexSize = 10; // Size of vertex handles (increased for easier grabbing)
        this.edgeClickThreshold = 15; // Distance threshold for edge clicking (increased)
        
        // Redraw control - optimized for smooth performance
        this.redrawPending = false;
        this.lastRedrawTime = 0;
        this.lastCoordUpdate = 0;
        
        // Initialize
        try {
            this.setupCanvas();
            this.bindEvents();
            this.updateZoomDisplay();
        } catch (error) {
            console.error('CanvasManager: Initialization failed:', error);
            throw error;        }
    }
    
    // Polygon editing methods
    startPolygonEditing(annotationId) {
        // Clear any pending auto-exit timer
        if (this.autoExitEditTimer) {
            clearTimeout(this.autoExitEditTimer);
            this.autoExitEditTimer = null;
        }
        
        // Only enter editing mode if edit mode is active
        if (!this.editModeActive) {
            this.editModeActive = true;
            this.updateEditToggleButton();
        }
        
        this.isEditingPolygon = true;
        this.editingAnnotationId = annotationId;
        this.canvas.style.cursor = 'pointer';
        this.redraw();
        
        // Update annotation UI to show editing state
        if (window.annotationManager) {
            window.annotationManager.updateUI();
        }
          // Add a visual status message
        Utils.showNotification('Edit mode active - Drag points to edit polygon');
    }
    
    stopPolygonEditing() {
        this.isEditingPolygon = false;
        this.editingAnnotationId = null;
        this.draggingVertex = null;
        this.hoveredVertex = null;
        this.hoveredEdge = null;
        
        this.canvas.style.cursor = this.getCursor(this.currentTool);
        this.redraw();
          // Update annotation UI
        if (window.annotationManager) {
            window.annotationManager.updateUI();
        }
          // Update toggle button
        this.updateEditToggleButton();
    }

    getVertexAtPoint(pos, annotation) {
        if (!annotation.canvasPolygon) return null;
          // Use a very generous hit area for better user experience
        const hitRadius = Math.max(this.vertexSize + 8, 15); // At least 15px hit area
        
        for (let i = 0; i < annotation.canvasPolygon.length; i++) {
            const vertex = annotation.canvasPolygon[i];
            const distance = Utils.distance(pos, vertex);
            if (distance <= hitRadius) {
                return { annotationId: annotation.id, vertexIndex: i, position: vertex };
            }        }
        return null;
    }

    getEdgeAtPoint(pos, annotation) {
        if (!annotation.canvasPolygon || annotation.canvasPolygon.length < 2) return null;
        
        for (let i = 0; i < annotation.canvasPolygon.length; i++) {
            const start = annotation.canvasPolygon[i];
            const end = annotation.canvasPolygon[(i + 1) % annotation.canvasPolygon.length];
            
            const distance = this.pointToLineDistance(pos, start, end);
            if (distance <= this.edgeClickThreshold) {
                return { annotationId: annotation.id, edgeIndex: i, start, end };
            }        }
        return null;
    }

    pointToLineDistance(point, lineStart, lineEnd) {
        const A = point.x - lineStart.x;
        const B = point.y - lineStart.y;
        const C = lineEnd.x - lineStart.x;
        const D = lineEnd.y - lineStart.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        if (lenSq === 0) return Utils.distance(point, lineStart);

        const param = dot / lenSq;
        
        let xx, yy;
        if (param < 0) {
            xx = lineStart.x;
            yy = lineStart.y;
        } else if (param > 1) {
            xx = lineEnd.x;
            yy = lineEnd.y;
        } else {
            xx = lineStart.x + param * C;            yy = lineStart.y + param * D;
        }
        
        return Utils.distance(point, { x: xx, y: yy });
    }    startVertexDrag(vertexInfo) {
        const annotation = window.annotationManager.annotations.find(ann => ann.id === vertexInfo.annotationId);
        if (annotation) {
            // Mark as dragging to prevent canvas polygon recalculation
            annotation.isDragging = true;
        } else {
            console.error('No annotation found for vertex drag!');
            return;
        }
          this.draggingVertex = vertexInfo;
        this.canvas.style.cursor = 'grabbing';
        
        // Prepare coordinate conversion cache for smooth dragging
        this.dragConversionCache = {
            imageWidth: this.imageElement.naturalWidth,
            imageHeight: this.imageElement.naturalHeight,
            canvasWidth: this.canvas.width,
            canvasHeight: this.canvas.height,
            scale: this.scale,            offsetX: this.offsetX,
            offsetY: this.offsetY
        };
    }
    
    updateVertexPosition(pos) {
        if (!this.draggingVertex) return;
        
        const annotation = window.annotationManager.annotations.find(ann => ann.id === this.draggingVertex.annotationId);
        if (!annotation) return;
          // Update canvas polygon immediately for visual feedback
        annotation.canvasPolygon[this.draggingVertex.vertexIndex] = { x: pos.x, y: pos.y };
        
        // Cache coordinate conversion parameters to avoid recalculation
        if (!this.dragConversionCache) {
            this.dragConversionCache = {
                imageWidth: this.imageElement.naturalWidth,
                imageHeight: this.imageElement.naturalHeight,
                canvasWidth: this.canvas.width,
                canvasHeight: this.canvas.height,
                scale: this.scale,
                offsetX: this.offsetX,
                offsetY: this.offsetY
            };
        }
        
        // Convert back to image coordinates using cached values
        const imageCoords = Utils.canvasToImageCoords(
            pos.x, pos.y,
            this.dragConversionCache.imageWidth,
            this.dragConversionCache.imageHeight,
            this.dragConversionCache.canvasWidth,
            this.dragConversionCache.canvasHeight,
            this.dragConversionCache.scale,
            this.dragConversionCache.offsetX,
            this.dragConversionCache.offsetY
        );
        
        // Update image polygon
        annotation.polygon[this.draggingVertex.vertexIndex] = [imageCoords.x, imageCoords.y];
        
        // Mark that we're in the middle of dragging to prevent canvas polygon recalculation
        annotation.isDragging = true;
        
        // Use optimized redraw scheduling for smooth dragging
        this.throttledRedraw();
    }    finishVertexDrag() {
        if (this.draggingVertex) {
            // Clear drag conversion cache
            this.dragConversionCache = null;
            
            // Save changes to backend if needed
            const annotation = window.annotationManager.annotations.find(ann => ann.id === this.draggingVertex.annotationId);
            if (annotation) {
                // Keep the canvas polygon coordinates we've been dragging
                // Don't clear isDragging yet to prevent recalculation
                
                // Save the annotation with updated coordinates
                window.annotationManager.saveAnnotation(this.draggingVertex.annotationId);
                  // Small delay before allowing recalculation to ensure smooth transition
                setTimeout(() => {
                    if (annotation) {
                        annotation.isDragging = false;
                        // Force recalculation flags
                        annotation.lastScale = null;
                        annotation.lastOffsetX = null;
                        annotation.lastOffsetY = null;
                        // Refresh editing state to ensure handles stay visible
                        this.refreshEditingState();
                    }
                }, 30); // Reduced delay for more responsive feel
            }
            
            // Clear dragging vertex but keep editing state
            this.draggingVertex = null;
            
            // Update cursor for editing mode
            this.canvas.style.cursor = 'pointer';
            
            // Immediate redraw to show editing handles
            this.redraw();
        }
    }

    addVertexAtEdge(edgeInfo, pos) {
        const annotation = window.annotationManager.annotations.find(ann => ann.id === edgeInfo.annotationId);
        if (!annotation) return;
        
        // Convert to image coordinates
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
          // Insert new vertex after the edge start
        const insertIndex = edgeInfo.edgeIndex + 1;
        annotation.polygon.splice(insertIndex, 0, [imageCoords.x, imageCoords.y]);
        annotation.canvasPolygon.splice(insertIndex, 0, { x: pos.x, y: pos.y });
        
        // Save changes
        window.annotationManager.saveAnnotation(annotation.id);
        window.annotationManager.updateUI();
        this.redraw();
    }

    removeVertex(vertexInfo) {
        const annotation = window.annotationManager.annotations.find(ann => ann.id === vertexInfo.annotationId);
        if (!annotation || annotation.polygon.length <= 3) return; // Keep at least 3 vertices
          // Remove vertex from both polygons
        annotation.polygon.splice(vertexInfo.vertexIndex, 1);
        annotation.canvasPolygon.splice(vertexInfo.vertexIndex, 1);
        
        // Save changes
        window.annotationManager.saveAnnotation(annotation.id);
        window.annotationManager.updateUI();
        this.redraw();
    }
    
    updateEditingHover(pos) {
        if (!this.isEditingPolygon) return;
        
        const annotation = window.annotationManager.annotations.find(ann => ann.id === this.editingAnnotationId);
        if (!annotation) return;
        
        // Check for vertex hover
        const vertexInfo = this.getVertexAtPoint(pos, annotation);
        if (vertexInfo) {
            if (!this.hoveredVertex || this.hoveredVertex.vertexIndex !== vertexInfo.vertexIndex) {
                this.hoveredVertex = vertexInfo;
                this.hoveredEdge = null;
                this.canvas.style.cursor = 'grab';
                this.scheduleHoverRedraw();
            }
        } else {
            // Check for edge hover
            const edgeInfo = this.getEdgeAtPoint(pos, annotation);
            if (edgeInfo) {
                if (!this.hoveredEdge || this.hoveredEdge.edgeIndex !== edgeInfo.edgeIndex) {
                    this.hoveredVertex = null;
                    this.hoveredEdge = edgeInfo;
                    this.canvas.style.cursor = 'crosshair';
                    this.scheduleHoverRedraw();
                }
            } else {
                // No hover
                if (this.hoveredVertex || this.hoveredEdge) {
                    this.hoveredVertex = null;
                    this.hoveredEdge = null;
                    this.canvas.style.cursor = 'pointer';
                    this.scheduleHoverRedraw();
                }            }
        }
    }
    
    // Throttled redraw for hover effects to prevent lag
    scheduleHoverRedraw() {
        if (this.hoverRedrawScheduled) return;
        
        this.hoverRedrawScheduled = true;
        requestAnimationFrame(() => {
            this.redraw();
            this.hoverRedrawScheduled = false;
        });
    }

    // Optimized throttled redraw for smooth operations
    throttledRedraw() {
        if (this.redrawScheduled) return;
        
        this.redrawScheduled = true;
        requestAnimationFrame(() => {
            this.redraw();
            this.redrawScheduled = false;
        });
    }

    setupCanvas() {
        // Set canvas size to fill container
        this.resizeCanvas();
          // Add flag to prevent resize loops
        this.isResizing = false;
        
        // Handle window resize with optimized debouncing
        window.addEventListener('resize', Utils.debounce(() => {
            if (this.isResizing) return;
            this.isResizing = true;
            
            this.resizeCanvas();
            
            // Always redraw after resize, whether we have an image or not
            this.redraw();
            
            setTimeout(() => {
                this.isResizing = false;
            }, 100);
        }, 100)); // Further reduced debounce time for more responsive resizing

        // Add ResizeObserver to handle container size changes (e.g., dev tools, inspect mode)
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(Utils.debounce((entries) => {
                for (const entry of entries) {
                    if (entry.target === this.canvasWrapper) {
                        if (!this.isResizing) {
                            this.isResizing = true;
                            this.resizeCanvas();
                            this.redraw();
                            setTimeout(() => {
                                this.isResizing = false;
                            }, 100);
                        }
                        break;
                    }
                }
            }, 50)); // Reduced debounce for container changes
              this.resizeObserver.observe(this.canvasWrapper);
        }
    }
    
    resizeCanvas() {
        const rect = this.canvasWrapper.getBoundingClientRect();
        
        // Set high DPI support
        const dpr = window.devicePixelRatio || 1;
        const displayWidth = rect.width;
        const displayHeight = rect.height;
        
        this.canvas.width = displayWidth * dpr;
        this.canvas.height = displayHeight * dpr;
        this.canvas.style.width = displayWidth + 'px';
        this.canvas.style.height = displayHeight + 'px';
        
        // Reset transform to avoid accumulation
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        // Scale context for high DPI
        this.ctx.scale(dpr, dpr);
        
        // Force redraw after resize to restore image and annotations
        this.redraw();
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
                const requestedTool = btn.dataset.tool;
                
                // Special handling for pan tool - if already active, switch to previous tool
                if (requestedTool === 'pan' && this.currentTool === 'pan') {
                    this.setTool(this.previousTool);
                } else {
                    this.setTool(requestedTool);
                }
                
                this.updateToolButtons();
            });
        });
        
        // Zoom controls
        document.getElementById('zoomIn').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOut').addEventListener('click', () => this.zoomOut());
        document.getElementById('fitToScreen').addEventListener('click', () => this.fitToScreen());
          // Keyboard events for polygon editing
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }
    
    setTool(tool) {
        // Track previous tool (but not if switching from pan)
        if (this.currentTool !== 'pan') {
            this.previousTool = this.currentTool;
        }
        
        this.currentTool = tool;
        this.canvas.style.cursor = this.getCursor(tool);
        
        // Cancel current drawing if switching tools
        if (this.isDrawing && tool !== 'polygon') {
            this.cancelCurrentPolygon();
        }
        
        // Stop polygon editing if switching away from select tool
        if (this.isEditingPolygon && tool !== 'select') {
            this.stopPolygonEditing();
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

    updateToolButtons() {        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === this.currentTool);
        });
    }
      handleMouseDown(e) {
        const pos = Utils.getMousePos(this.canvas, e);
        this.lastMousePos = pos;

        // --- FIX: Always check for vertex under mouse in edit mode ---
        if (
            e.button === 0 &&
            this.editModeActive &&
            this.isEditingPolygon &&
            this.editingAnnotationId
        ) {
            const annotation = window.annotationManager.annotations.find(ann => ann.id === this.editingAnnotationId);
            if (annotation) {
                const vertexInfo = this.getVertexAtPoint(pos, annotation);
                if (vertexInfo) {
                    this.startVertexDrag(vertexInfo);
                    return; // Don't proceed with normal action
                }
            }
        }

        if (e.button === 0) { // Left click
            this.handlePrimaryAction(pos, e);        } else if (e.button === 2) { // Right click
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
        } else if (this.draggingVertex) {
            // Optimized vertex dragging - no logging during movement
            this.updateVertexPosition(pos);
        } else if (this.isEditingPolygon && this.currentTool === 'select') {
            // Optimized hover updates - throttle to reduce computations
            if (!this.lastHoverPos || Utils.distance(pos, this.lastHoverPos) > 3) {
                this.updateEditingHover(pos);
                this.lastHoverPos = { x: pos.x, y: pos.y };
            }
        }        
        this.lastMousePos = pos;
    }
    
    handleMouseUp(e) {
        if (this.draggingVertex) {
            this.finishVertexDrag();
        }
        
        this.isDragging = false;
        
        // Set cursor based on current state
        if (this.isEditingPolygon) {
            this.canvas.style.cursor = 'pointer';
        } else {
            this.canvas.style.cursor = this.getCursor(this.currentTool);
        }
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
        // During multi-upload, the first click is handled differently
        // to prevent simultaneous segmentation processes
        // See handlePointClick for implementation
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
                this.canvas.style.cursor = 'grabbing';                break;
        }
    }
    
    handleSecondaryAction(pos, e) {
        if (this.currentTool === 'polygon' && this.isDrawing) {
            this.finishPolygon();
        } else if (this.isEditingPolygon) {
            // Right-click on vertex to delete it
            const annotation = window.annotationManager.annotations.find(ann => ann.id === this.editingAnnotationId);
            if (annotation) {
                const vertexInfo = this.getVertexAtPoint(pos, annotation);
                if (vertexInfo && annotation.polygon.length > 3) { // Keep at least 3 vertices
                    this.removeVertex(vertexInfo);
                }            }
        }
    }
      handleSelect(pos) {
        // Check if clicking on an annotation
        const annotation = window.annotationManager.getAnnotationAtPoint(pos);
        
        if (annotation) {
            // FIRST: If edit mode is active and we're editing this annotation, check for interactions BEFORE selection
            if (this.editModeActive && this.isEditingPolygon && this.editingAnnotationId === annotation.id) {
                // Check for vertex interaction
                const vertexInfo = this.getVertexAtPoint(pos, annotation);
                if (vertexInfo) {
                    this.startVertexDrag(vertexInfo);
                    return; // Don't proceed with selection
                }
                
                // Check for edge interaction to add new vertex
                const edgeInfo = this.getEdgeAtPoint(pos, annotation);
                if (edgeInfo) {
                    this.addVertexAtEdge(edgeInfo, pos);
                    return; // Don't proceed with selection
                }
            }
            
            // SECOND: Select the annotation (only if we didn't start dragging/editing)
            window.annotationManager.selectAnnotation(annotation.id);
            
            if (this.editModeActive && (!this.isEditingPolygon || this.editingAnnotationId !== annotation.id)) {
                // Edit mode is active but we're selecting a different annotation
                this.startPolygonEditing(annotation.id);
            }
            // If edit mode is not active, just select the annotation without editing} else {
            // Clear selection
            window.annotationManager.clearSelection();
            // In persistent edit mode, just stop editing current polygon but keep edit mode active
            if (this.isEditingPolygon) {
                this.stopPolygonEditing();            }
        }
    }    async handlePointClick(pos) {
        if (!this.currentImage) return;
        
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
        
        // Validate that coordinates are in 0-1 range
        if (imageCoords.x < 0 || imageCoords.x > 1 || imageCoords.y < 0 || imageCoords.y > 1) {
            console.warn('Click coordinates are outside image bounds:', imageCoords);
            return;        }
        
        try {
            const result = await api.segment(this.currentImage.image_id, imageCoords.x, imageCoords.y);
            
            console.log('AI segmentation result:', result);              if (result.polygon && result.polygon.length > 0) {
                console.log('AI polygon received:', result.polygon.length, 'points');
                console.log('AI polygon sample points (normalized 0-1):', result.polygon.slice(0, 3));
                
                // Validate that coordinates are in normalized range (0-1)
                const isNormalized = result.polygon.every(point => 
                    point[0] >= 0 && point[0] <= 1 && point[1] >= 0 && point[1] <= 1
                );
                
                if (!isNormalized) {
                    console.warn('AI polygon coordinates are not normalized (0-1 range):', result.polygon.slice(0, 3));
                }                  // Simplify the polygon to make it easier to edit
                let simplifiedPolygon = result.polygon;
                if (result.polygon.length > 10) { // Simplify if more than 10 points
                    console.log('Simplifying polygon from', result.polygon.length, 'points');
                      // Get settings from app
                    const settings = window.app ? window.app.getSimplificationSettings() : {
                        maxPoints: 10,
                        minTolerance: 0.005,
                        maxTolerance: 0.02
                    };
                      console.log('Simplification settings:', settings);
                    console.log('Original polygon sample:', result.polygon.slice(0, 3));
                      simplifiedPolygon = Utils.adaptiveSimplifyPolygon(
                        result.polygon, 
                        settings.maxPoints,
                        settings.minTolerance,
                        settings.maxTolerance
                    );
                      console.log('Simplified polygon length:', simplifiedPolygon.length);
                    console.log('Simplified polygon sample:', simplifiedPolygon.slice(0, 3));
                    
                    // Show feedback to user
                    if (result.polygon.length !== simplifiedPolygon.length) {
                        Utils.showToast(`AI polygon simplified from ${result.polygon.length} to ${simplifiedPolygon.length} points for easier editing`, 'info', 3000);
                    }                }                
                // Create annotation - polygon should be in normalized coordinates (0-1)
                // The drawAnnotations method will convert to canvas coordinates when needed
                const annotation = {
                    id: result.annotationId || Utils.generateId(), // Use backend annotation ID if available
                    type: 'ai_segment',
                    polygon: simplifiedPolygon, // Use simplified polygon
                    originalPolygon: result.polygon, // Keep original for reference
                    label: window.annotationManager.currentLabel,
                    created: new Date().toISOString(),
                    source: 'ai',
                    simplified: result.polygon.length !== simplifiedPolygon.length
                };
                  console.log('Creating annotation with polygon length:', annotation.polygon.length);
                console.log('Annotation polygon sample:', annotation.polygon.slice(0, 3));
                
                window.annotationManager.addAnnotation(annotation);
                this.redraw();
                
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
                return [imageCoords.x, imageCoords.y];            });
            
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
        this.currentPolygon = [];        this.tempPolygon = [];
        this.redraw();
    }
    
    handlePan(pos) {
        const dx = pos.x - this.lastMousePos.x;
        const dy = pos.y - this.lastMousePos.y;        
        this.offsetX += dx;
        this.offsetY += dy;
        
        // Use throttled redraw for smoother panning
        this.throttledRedraw();
    }    loadImage(imageData) {
        this.currentImage = imageData;
        
        const img = new Image();        img.onload = () => {
            this.imageElement = img;
            
            // Ensure canvas is visible and placeholder is hidden
            this.canvas.style.display = 'block';
            this.placeholder.style.display = 'none';
            this.placeholder.hidden = true;
            
            this.fitToScreen();
            this.redraw();
            
            // Notify annotation manager that image is ready and force annotation redraw
            if (window.annotationManager) {                // Clear cached annotation canvas polygons to force recalculation
                window.annotationManager.annotations.forEach(annotation => {
                    annotation.canvasPolygon = null;
                    annotation.lastScale = null;
                    annotation.lastOffsetX = null;
                    annotation.lastOffsetY = null;
                    annotation.lastImageId = null;
                });
                
                // Force redraw after a small delay to ensure image is fully processed
                setTimeout(() => {
                    this.redraw();
                }, 100);
            }
        };
        img.onerror = (error) => {
            console.error('Image load error:', error);
            Utils.showToast('Failed to load image', 'error');
        };
        
        const imageUrl = api.getImageUrl(imageData.file_path);
        img.crossOrigin = 'anonymous'; // Add CORS support for images
        img.src = imageUrl;
    }
      fitToScreen() {
        if (!this.imageElement || this.isResizing) return;
        
        const { width: canvasWidth, height: canvasHeight } = this.getDisplayDimensions();
        const imageWidth = this.imageElement.naturalWidth;
        const imageHeight = this.imageElement.naturalHeight;
        
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
            
            this.updateZoomDisplay();
            this.redraw();
        }
    }
    
    zoomIn() {
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
        // Throttle coordinate updates to improve performance
        if (this.lastCoordUpdate && Date.now() - this.lastCoordUpdate < 16) return; // ~60fps max
        this.lastCoordUpdate = Date.now();
        
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
            
            const coordElement = document.getElementById('mouseCoords');
            if (coordElement) {
                coordElement.textContent = 
                    `x: ${Math.round(imageCoords.x * this.imageElement.naturalWidth)}, y: ${Math.round(imageCoords.y * this.imageElement.naturalHeight)}`;
            }
        } else {
            const coordElement = document.getElementById('mouseCoords');
            if (coordElement) {
                coordElement.textContent = `x: ${Math.round(pos.x)}, y: ${Math.round(pos.y)}`;            }
        }
    }
    
    redraw() {
        // Improved throttling with better frame rate control
        if (this.redrawPending) return;
        
        this.redrawPending = true;
        requestAnimationFrame(() => {
            this.redrawPending = false;            this._performRedraw();
        });
    }
    
    _performRedraw() {
        this.lastRedrawTime = Date.now();
        // Removed excessive logging for performance
        
        // Clear canvas - use display dimensions since context is scaled by DPR
        const { width, height } = this.getDisplayDimensions();
        this.ctx.clearRect(0, 0, width, height);
          if (!this.imageElement) {
            return;
        }
        
        // Draw image - simplified approach
        
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
        
        // Draw annotations with DPR-scaled context
        if (window.annotationManager) {
            window.annotationManager.drawAnnotations(this.ctx, this.scale, this.offsetX, this.offsetY);
        }
        
        // Draw current polygon being drawn
        if (this.isDrawing && this.tempPolygon.length > 1) {
            this.drawPolygon(this.tempPolygon, '#3b82f6', 2, true);
        }
        
        // Draw editing feedback for polygon being edited
        if (this.isEditingPolygon && this.editingAnnotationId) {
            this.drawEditingFeedback();
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
            this.ctx.fill();            this.ctx.restore();
        });
    }
    
    drawEditingFeedback() {
        const annotation = window.annotationManager.annotations.find(ann => ann.id === this.editingAnnotationId);        if (!annotation || !annotation.canvasPolygon) return;
        
        // Draw larger, more prominent vertices for editing
        annotation.canvasPolygon.forEach((vertex, index) => {
            this.ctx.save();
            
            // Highlight hovered or dragged vertex with different styles
            if (this.draggingVertex && this.draggingVertex.vertexIndex === index) {
                // Dragged vertex - extra large and bright red
                this.ctx.fillStyle = '#dc2626'; // Bright red for dragging
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 4;
                this.ctx.shadowColor = 'rgba(220, 38, 38, 0.5)';
                this.ctx.shadowBlur = 6;
                this.ctx.beginPath();
                this.ctx.arc(vertex.x, vertex.y, this.vertexSize + 5, 0, 2 * Math.PI);
                this.ctx.fill();
                this.ctx.stroke();
            } else if (this.hoveredVertex && this.hoveredVertex.vertexIndex === index) {
                // Hovered vertex - larger and orange
                this.ctx.fillStyle = '#f59e0b'; // Orange for hover
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 3;
                this.ctx.shadowColor = 'rgba(245, 158, 11, 0.4)';
                this.ctx.shadowBlur = 4;
                this.ctx.beginPath();
                this.ctx.arc(vertex.x, vertex.y, this.vertexSize + 3, 0, 2 * Math.PI);
                this.ctx.fill();
                this.ctx.stroke();
            } else {
                // Normal vertex - blue with white border
                this.ctx.fillStyle = '#3b82f6'; // Blue for normal
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 2;
                this.ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
                this.ctx.shadowBlur = 2;
                this.ctx.beginPath();
                this.ctx.arc(vertex.x, vertex.y, this.vertexSize, 0, 2 * Math.PI);
                this.ctx.fill();
                this.ctx.stroke();
            }            
            this.ctx.restore();
        });
        
        // Draw edge hover feedback with better visibility
        if (this.hoveredEdge) {
            const start = this.hoveredEdge.start;
            const end = this.hoveredEdge.end;
            
            // Draw highlighted edge
            this.ctx.save();
            this.ctx.strokeStyle = '#10b981'; // Green for edge
            this.ctx.lineWidth = 4;
            this.ctx.setLineDash([8, 4]);
            this.ctx.shadowColor = 'rgba(16, 185, 129, 0.3)';
            this.ctx.shadowBlur = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(start.x, start.y);
            this.ctx.lineTo(end.x, end.y);
            this.ctx.stroke();
            this.ctx.restore();
            
            // Draw insertion point indicator at midpoint
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;
            
            this.ctx.save();
            this.ctx.fillStyle = '#10b981'; // Green
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            this.ctx.shadowBlur = 3;
            
            // Plus icon to indicate insertion
            const size = 12;
            
            // Circle background
            this.ctx.beginPath();
            this.ctx.arc(midX, midY, size, 0, 2 * Math.PI);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Plus symbol
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(midX - size/2 + 3, midY);
            this.ctx.lineTo(midX + size/2 - 3, midY);
            this.ctx.moveTo(midX, midY - size/2 + 3);
            this.ctx.lineTo(midX, midY + size/2 - 3);            this.ctx.stroke();
            
            this.ctx.restore();
            this.ctx.stroke();
            this.ctx.restore();
        }
    }

    // Efficient method to redraw just the editing handles without full canvas redraw

    handleKeyDown(e) {        // Only handle keys when editing polygons
        if (!this.isEditingPolygon) return;
        
        switch (e.key) {
            case 'Escape':
                // In persistent edit mode, just clear selection but keep edit mode active
                if (this.editModeActive) {
                    window.annotationManager.clearSelection();
                    if (this.isEditingPolygon) {
                        this.stopPolygonEditing();
                    }
                } else {
                    // Exit editing mode only if not in persistent mode
                    this.stopPolygonEditing();
                    window.annotationManager.clearSelection();
                }
                break;
            case 'Delete':
            case 'Backspace':
                // Delete hovered vertex
                if (this.hoveredVertex) {
                    const annotation = window.annotationManager.annotations.find(ann => ann.id === this.hoveredVertex.annotationId);
                    if (annotation && annotation.polygon.length > 3) {
                        this.removeVertex(this.hoveredVertex);                    }
                }
                break;
            case 'Enter':
                // Finish editing current polygon
                if (this.editModeActive) {
                    // In persistent edit mode, stop editing current polygon and give feedback
                    this.stopPolygonEditing();
                    window.annotationManager.clearSelection();
                    
                    // Show clear instructions
                    Utils.showNotification(
                        'Editing finished! Click another annotation to edit it, or click the Edit button to exit edit mode.',
                        4000
                    );
                    
                    // Auto-exit edit mode after 10 seconds if no new annotation is selected
                    this.autoExitEditTimer = setTimeout(() => {
                        if (this.editModeActive && !this.isEditingPolygon) {
                            this.editModeActive = false;
                            this.updateEditToggleButton();
                            Utils.showNotification('Edit mode automatically disabled', 2000);
                        }
                    }, 10000);
                } else {
                    // If not in edit mode, just stop editing
                    this.stopPolygonEditing();
                    Utils.showToast('Polygon editing complete', 'success');
                }                break;
        }
    }
    
    clear() {
        this.currentImage = null;
        this.imageElement = null;
        this.canvas.hidden = true;
        this.placeholder.hidden = false;
        this.cancelCurrentPolygon();
        this.stopPolygonEditing();
    }
    
    clearImage() {
        // Clear canvas
        this.currentImage = null;
        this.imageElement = null;
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        
        // Reset canvas
        if (this.canvas && this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Show placeholder
        if (this.placeholder) {
            this.placeholder.style.display = 'flex';
        }
        
        // Hide canvas
        if (this.canvas) {
            this.canvas.style.display = 'none';
        }        
        console.log('CanvasManager: Image cleared');
    }
    
    refreshEditingState() {
        if (!this.isEditingPolygon || !this.editingAnnotationId) {
            return;
        }
        
        // Ensure annotation still exists
        const annotation = window.annotationManager.annotations.find(ann => ann.id === this.editingAnnotationId);
        if (!annotation) {
            this.stopPolygonEditing();
            return;
        }
        
        // Ensure editing cursor is set
        this.canvas.style.cursor = 'pointer';        
        // Force a redraw to show editing handles
        this.redraw();
    }
    
    toggleEditMode() {
        this.editModeActive = !this.editModeActive;
        
        if (this.editModeActive) {
            // Entering edit mode - switch to select tool
            this.setTool('select');
            
            const selectedAnnotation = window.annotationManager.getSelectedAnnotation();
            if (selectedAnnotation) {
                this.startPolygonEditing(selectedAnnotation.id);
                
                // Show help message
                Utils.showNotification(
                    'Edit Mode ON: ' +
                    'Click and drag vertices to move them • ' +
                    'Click on edge to add new vertex • ' +
                    'Right-click vertex to delete',
                    5000
                );
            } else {
                // No annotation selected, turn off edit mode
                this.editModeActive = false;
                this.updateEditToggleButton();                Utils.showNotification('Select an annotation first before entering edit mode', 3000);
                return;
            }
        } else {
            // Exiting edit mode - clear any pending auto-exit timer
            if (this.autoExitEditTimer) {
                clearTimeout(this.autoExitEditTimer);
                this.autoExitEditTimer = null;
            }
            this.stopPolygonEditing();
            Utils.showNotification('Edit Mode OFF', 2000);        }
        
        this.updateEditToggleButton();
    }
    
    updateEditToggleButton() {
        const editToggle = document.getElementById('editToggle');
        if (editToggle) {
            if (this.editModeActive) {
                editToggle.classList.add('active');
            } else {
                editToggle.classList.remove('active');
            }
        }
    }

    // Cleanup method for proper resource management
    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
    }
}

// Export for global use
window.CanvasManager = CanvasManager;
