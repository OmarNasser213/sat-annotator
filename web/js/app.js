// Main application controller for SAT Annotator

class SATAnnotator {
    constructor() {
        this.images = [];
        this.currentImageId = null;
    }    async initialize() {
        console.log('=== SAT Annotator Initialization Started ===');
        
        try {
            // Show loading immediately
            Utils.showLoading('Initializing...');
            console.log('Step 1: Loading overlay shown');
            
            // Initialize managers with error handling
            console.log('Step 2: Initializing Canvas Manager...');
            try {
                window.canvasManager = new CanvasManager();
                console.log('Step 2: Canvas Manager initialized successfully');
            } catch (error) {
                console.error('Step 2: Canvas Manager failed:', error);
                throw new Error('Canvas Manager initialization failed: ' + error.message);
            }
            
            console.log('Step 3: Initializing Annotation Manager...');
            try {
                window.annotationManager = new AnnotationManager();
                console.log('Step 3: Annotation Manager initialized successfully');
            } catch (error) {
                console.error('Step 3: Annotation Manager failed:', error);
                throw new Error('Annotation Manager initialization failed: ' + error.message);
            }
            
            // Setup event listeners
            console.log('Step 4: Setting up event listeners...');
            try {
                this.setupEventListeners();
                console.log('Step 4: Event listeners setup complete');
            } catch (error) {
                console.error('Step 4: Event listeners setup failed:', error);
                throw new Error('Event listeners setup failed: ' + error.message);
            }
            
            // Check server status
            console.log('Step 5: Checking server status...');
            try {
                await this.checkServerStatus();
                console.log('Step 5: Server status check complete');
            } catch (error) {
                console.error('Step 5: Server status check failed:', error);
                throw new Error('Server status check failed: ' + error.message);
            }
            
            // Load existing images
            console.log('Step 6: Loading images...');
            try {
                await this.loadImages();
                console.log('Step 6: Images loading complete');
            } catch (error) {
                console.error('Step 6: Images loading failed:', error);
                throw new Error('Images loading failed: ' + error.message);
            }
              // Hide loading and show success
            Utils.hideLoading();
            console.log('Step 7: Loading overlay hidden');
            
            // Force hide after a small delay to ensure it's really hidden
            setTimeout(() => {
                const overlay = document.getElementById('loadingOverlay');
                if (overlay) {
                    overlay.style.display = 'none';
                    overlay.hidden = true;
                    console.log('Step 7b: Force hidden loading overlay');
                }
            }, 100);
            
            Utils.showToast('SAT Annotator ready!', 'success');
            console.log('=== SAT Annotator Initialization Complete ===');
            
        } catch (error) {
            console.error('!!! INITIALIZATION FAILED !!!');
            console.error('Error:', error);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            
            // Make sure loading is hidden even on error
            Utils.hideLoading();
            Utils.showToast('Failed to initialize application: ' + error.message, 'error');
        }
    }

    setupEventListeners() {
        // Mobile menu
        document.getElementById('mobileMenuBtn').addEventListener('click', () => this.toggleMobileMenu());
        document.getElementById('sidebarOverlay').addEventListener('click', () => this.closeMobileMenu());
        
        // File upload
        const fileInput = document.getElementById('fileInput');
        const uploadArea = document.getElementById('uploadArea');
        
        uploadArea.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files));
        
        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            this.handleFileSelect(e.dataTransfer.files);
        });
        
        // Export and clear buttons
        document.getElementById('exportBtn').addEventListener('click', () => {
            window.annotationManager.exportAnnotations();
        });
        
        document.getElementById('clearAnnotations').addEventListener('click', () => {
            window.annotationManager.clearAll();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
        
        // Window events
        window.addEventListener('beforeunload', (e) => {
            if (window.annotationManager.annotations.length > 0) {
                const message = 'You have unsaved annotations. Are you sure you want to leave?';
                e.returnValue = message;
                return message;
            }        });
    }

    toggleMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        
        if (sidebar.classList.contains('open')) {
            this.closeMobileMenu();
        } else {
            sidebar.classList.add('open');
            overlay.classList.add('active');
        }
    }

    closeMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    }

    handleKeyboardShortcuts(e) {
        // Only handle shortcuts when not typing in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        switch (e.key) {
            case '1':
                e.preventDefault();
                window.canvasManager.setTool('select');
                window.canvasManager.updateToolButtons();
                break;
            case '2':
                e.preventDefault();
                window.canvasManager.setTool('point');
                window.canvasManager.updateToolButtons();
                break;
            case '3':
                e.preventDefault();
                window.canvasManager.setTool('polygon');
                window.canvasManager.updateToolButtons();
                break;
            case '4':
                e.preventDefault();
                window.canvasManager.setTool('pan');
                window.canvasManager.updateToolButtons();
                break;
            case 'Escape':
                e.preventDefault();
                if (window.canvasManager.isDrawing) {
                    window.canvasManager.cancelCurrentPolygon();
                }
                window.annotationManager.clearSelection();
                window.canvasManager.redraw();
                break;
            case 'Delete':
                e.preventDefault();
                if (window.annotationManager.selectedAnnotation) {
                    window.annotationManager.deleteSelectedAnnotation();
                }
                break;
            case '+':
            case '=':
                e.preventDefault();
                window.canvasManager.zoomIn();
                break;
            case '-':
                e.preventDefault();
                window.canvasManager.zoomOut();
                break;
            case '0':
                e.preventDefault();
                window.canvasManager.fitToScreen();
                break;
        }
    }

    async handleFileSelect(files) {
        if (!files || files.length === 0) return;
        
        const file = files[0];
        
        if (!Utils.isValidImageFile(file)) {
            Utils.showToast('Please select a valid image file (JPG, PNG, TIFF, GeoTIFF)', 'error');
            return;
        }
        
        if (file.size > 100 * 1024 * 1024) { // 100MB limit
            Utils.showToast('File is too large. Please select a file smaller than 100MB.', 'error');
            return;
        }
          try {
            console.log('Starting file upload for:', file.name);
            const imageData = await api.uploadImage(file, (progress) => {
                // Could show upload progress here
                console.log(`Upload progress: ${progress.toFixed(1)}%`);
            });
            
            console.log('Upload completed, received imageData:', imageData);
            
            // Add to images list
            this.images.push(imageData);
            this.updateImagesList();
            
            // Load the image automatically
            console.log('Selecting uploaded image with ID:', imageData.image_id);
            this.selectImage(imageData.image_id);
            
        } catch (error) {
            console.error('Upload failed:', error);
            Utils.showToast('Upload failed: ' + error.message, 'error');
        }
    }    async loadImages() {
        try {
            console.log('loadImages: Starting to load images...');
            // Don't show loading here since main initialization already shows it
            
            this.images = await api.getImages();
            console.log('loadImages: Images loaded:', this.images);
            
            this.updateImagesList();
            console.log('loadImages: Images list updated');
            
            if (this.images.length > 0) {
                console.log(`loadImages: Found ${this.images.length} images`);
            } else {
                console.log('loadImages: No images found (normal for first run)');
            }
        } catch (error) {
            console.error('loadImages: Error occurred:', error);
            throw error; // Re-throw so main initialization can handle it
        }
    }

    updateImagesList() {
        const container = document.getElementById('imagesList');
        
        if (this.images.length === 0) {
            container.innerHTML = `
                <div class="no-images">
                    <i class="fas fa-image"></i>
                    <p>No images uploaded yet</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.images.map(image => `
            <div class="image-item ${this.currentImageId === image.image_id ? 'active' : ''}" 
                 data-image-id="${image.image_id}">
                <img class="image-thumbnail" 
                     src="${api.getImageUrl(image.file_path)}" 
                     alt="${image.file_name}"
                     onerror="this.style.display='none'">
                <div class="image-info">
                    <h4>${image.file_name}</h4>
                    <p>${image.resolution} • ${Utils.formatDate(image.created_at)}</p>
                </div>
            </div>
        `).join('');
        
        // Add click handlers
        container.querySelectorAll('.image-item').forEach(item => {
            item.addEventListener('click', () => {
                const imageId = item.dataset.imageId;
                this.selectImage(imageId);
            });
        });
    }

    selectImage(imageId) {
        // Find image data
        const imageData = this.images.find(img => img.image_id == imageId);
        if (!imageData) {
            Utils.showToast('Image not found', 'error');
            return;
        }
        
        this.currentImageId = imageId;
        
        // Update UI
        this.updateImagesList();
        
        // Load image in canvas
        window.canvasManager.loadImage(imageData);
        
        // Load annotations for this image
        window.annotationManager.setCurrentImage(imageId);
        
        Utils.showToast(`Loaded: ${imageData.file_name}`, 'success');
    }

    async checkServerStatus() {
        try {
            const isHealthy = await api.healthCheck();
            if (!isHealthy) {
                Utils.showToast('Server connection issues detected', 'warning');
            }
        } catch (error) {
            Utils.showToast('Failed to connect to server', 'error');
        }
    }

    // Get application statistics
    getStatistics() {
        const annotationStats = window.annotationManager ? window.annotationManager.getStatistics() : {};
        
        return {
            images: {
                total: this.images.length,
                current: this.currentImageId
            },
            annotations: annotationStats,
            session: {
                started: new Date().toISOString(),
                current_tool: window.canvasManager ? window.canvasManager.currentTool : 'select'
            }
        };
    }

    // Export session data
    exportSession() {
        const sessionData = {
            session_info: {
                exported_at: new Date().toISOString(),
                tool: 'SAT Annotator',
                version: '1.0.0'
            },
            images: this.images,
            current_image: this.currentImageId,
            annotations: window.annotationManager ? window.annotationManager.annotations : [],
            statistics: this.getStatistics()
        };
        
        const filename = `sat_session_${new Date().toISOString().split('T')[0]}.json`;
        Utils.downloadFile(JSON.stringify(sessionData, null, 2), filename, 'application/json');
        
        Utils.showToast('Session exported successfully', 'success');
    }

    // Clear all data
    clearSession() {
        if (this.images.length === 0 && (!window.annotationManager || window.annotationManager.annotations.length === 0)) {
            Utils.showToast('Nothing to clear', 'warning');
            return;
        }
        
        const totalItems = this.images.length + (window.annotationManager ? window.annotationManager.annotations.length : 0);
        
        if (confirm(`Are you sure you want to clear all data? This will remove ${this.images.length} images and ${window.annotationManager ? window.annotationManager.annotations.length : 0} annotations.`)) {
            // Clear images
            this.images = [];
            this.currentImageId = null;
            this.updateImagesList();
            
            // Clear canvas
            window.canvasManager.clear();
            
            // Clear annotations
            if (window.annotationManager) {
                window.annotationManager.annotations = [];
                window.annotationManager.selectedAnnotation = null;
                window.annotationManager.updateUI();
            }
            
            // Disable buttons
            document.getElementById('exportBtn').disabled = true;
            document.getElementById('clearAnnotations').disabled = true;
            
            Utils.showToast(`Cleared ${totalItems} items`, 'success');
        }
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('DOM loaded, starting SAT Annotator...');
        window.satAnnotator = new SATAnnotator();
        await window.satAnnotator.initialize();
        console.log('SAT Annotator fully initialized');
    } catch (error) {
        console.error('Failed to start SAT Annotator:', error);
        Utils.hideLoading();
        Utils.showToast('Failed to start application: ' + error.message, 'error');
    }
});

// Add some debug functions for development
window.debugInfo = () => {
    console.log('=== SAT Annotator Debug Info ===');
    console.log('Images:', window.satAnnotator?.images || []);
    console.log('Current Image:', window.satAnnotator?.currentImageId || null);
    console.log('Annotations:', window.annotationManager?.annotations || []);
    console.log('Selected Annotation:', window.annotationManager?.selectedAnnotation || null);
    console.log('Current Tool:', window.canvasManager?.currentTool || null);
    console.log('Canvas State:', {
        scale: window.canvasManager?.scale || 0,
        offsetX: window.canvasManager?.offsetX || 0,
        offsetY: window.canvasManager?.offsetY || 0
    });
    console.log('Statistics:', window.satAnnotator?.getStatistics() || {});
};

// Expose some functions globally for development
window.exportSession = () => window.satAnnotator?.exportSession();
window.clearSession = () => window.satAnnotator?.clearSession();

// Show keyboard shortcuts in console
console.log(`
🛰️ SAT Annotator - Keyboard Shortcuts:
• 1 - Select tool
• 2 - AI Point tool  
• 3 - Polygon tool
• 4 - Pan tool
• ESC - Cancel drawing / Clear selection
• DELETE - Delete selected annotation
• + - Zoom in
• - - Zoom out  
• 0 - Fit to screen

💻 Debug commands:
• debugInfo() - Show debug information
• exportSession() - Export session data
• clearSession() - Clear all data
`);
