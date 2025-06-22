// Main application controller for SAT Annotator

// Add global error handler to suppress browser extension related errors
window.addEventListener('error', (event) => {
    // Filter out Chrome extension message port errors
    if (event.message && event.message.includes('message port closed')) {
        event.preventDefault();
        return true;
    }
    // Let other errors proceed normally
    return false;
});

// Also handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    // Filter out Chrome extension related promise rejections
    if (event.reason && event.reason.message && 
        event.reason.message.includes('message port closed')) {
        event.preventDefault();
        return true;
    }
    // Let other promise rejections proceed normally
    return false;
});

class SATAnnotator {    constructor() {
        this.images = [];
        this.currentImageId = null;
        // Track if user has unsaved work for page protection
        this.hasUnsavedWork = false;
    }async initialize() {        console.log('SAT Annotator Initialization Started');
        
        try {
            // Show loading immediately
            Utils.showLoading('Initializing...');
            console.log('Loading overlay shown');
              // Clear any existing session to ensure fresh start
            await api.clearSession();
            console.log('Session cleared, starting fresh initialization');              // Reset application state
            this.images = [];
            this.currentImageId = null;
            this.hasUnsavedWork = false;
            console.log('Application state reset');
            
            // Initialize managers with error handling
            console.log('Initializing Canvas Manager...');
            try {
                window.canvasManager = new CanvasManager();
            console.log('Application started successfully');
            console.log('Canvas Manager initialized successfully');
            } catch (error) {
                console.error('Canvas Manager failed:', error);
                throw new Error('Canvas Manager initialization failed: ' + error.message);
            }
              console.log('Initializing Annotation Manager...');
            try {
                window.annotationManager = new AnnotationManager();
                console.log('Annotation Manager initialized successfully');
            } catch (error) {
                console.error('Annotation Manager failed:', error);
                throw new Error('Annotation Manager initialization failed: ' + error.message);
            }            // Reset UI to initial state
            console.log('Resetting UI to initial state...');
            this.resetUI();
            console.log('UI reset completed');
            
            // Setup event listeners            console.log('Setting up event listeners...');
            try {
                this.setupEventListeners();
                console.log('Event listeners configured successfully');
            } catch (error) {
                console.error('Event listeners setup failed:', error);
                throw new Error('Event listeners setup failed: ' + error.message);
            }
              // Check server status
            console.log('Checking server status...');
            try {
                await this.checkServerStatus();
                console.log('Server connectivity verified');
            } catch (error) {
                console.error('Server status check failed:', error);
                throw new Error('Server status check failed: ' + error.message);
            }
            
            // Load existing images
            console.log('Loading images...');
            try {
                await this.loadImages();
                console.log('Image data loaded successfully');
            } catch (error) {
                console.error('Images loading failed:', error);
                throw new Error('Images loading failed: ' + error.message);
            }
              // Hide loading and show success
            Utils.hideLoading();
            console.log('Loading overlay hidden');
              // Force hide after a small delay to ensure it's really hidden
            setTimeout(() => {
                const overlay = document.getElementById('loadingOverlay');
                if (overlay) {
                    overlay.style.display = 'none';
                    overlay.hidden = true;
                    console.log('Force hidden loading overlay');
                }
            }, 100);
              Utils.showToast('SAT Annotator ready!', 'success');
            console.log('SAT Annotator initialization completed successfully');
              } catch (error) {
            console.error('Application initialization failed');
            console.error('Error details:', error.message);
            console.error('Stack trace:', error.stack);
            
            // Make sure loading is hidden even on error
            Utils.hideLoading();
            Utils.showToast('Failed to initialize application: ' + error.message, 'error');
        }
    }    resetUI() {
        // Reset images list to show no images
        const imagesList = document.getElementById('imagesList');
        if (imagesList) {
            imagesList.innerHTML = `
                <div class="no-images">
                    <i class="fas fa-image"></i>
                    <p>No images uploaded yet</p>
                </div>
            `;
        }

        // Reset annotations list
        const annotationsList = document.getElementById('annotationsList');
        if (annotationsList) {
            annotationsList.innerHTML = `
                <div class="no-annotations">
                    <i class="fas fa-shapes"></i>
                    <p>No annotations yet</p>
                </div>
            `;
        }

        // Don't touch canvas elements - let canvas manager handle its own state

        // Disable buttons that require images
        const exportBtn = document.getElementById('exportBtn');
        const clearBtn = document.getElementById('clearAnnotations');
        if (exportBtn) exportBtn.disabled = true;
        if (clearBtn) clearBtn.disabled = true;
    }    setupEventListeners() {        // Page reload/close protection - warn if there are uploaded images or annotations
        const beforeUnloadHandler = (e) => {
            console.log('beforeunload triggered');
            console.log('this.images:', this.images);
            console.log('this.hasUnsavedWork:', this.hasUnsavedWork);
            console.log('window.annotationManager:', window.annotationManager);
            
            const hasImages = this.images && this.images.length > 0;
            const hasAnnotations = window.annotationManager && window.annotationManager.annotations && window.annotationManager.annotations.length > 0;
            
            // Also check DOM for uploaded images as backup
            const imageListItems = document.querySelectorAll('#imageList .image-item');
            const hasImagesInDOM = imageListItems.length > 0;
            
            console.log('hasImages:', hasImages);
            console.log('hasAnnotations:', hasAnnotations);
            console.log('hasImagesInDOM:', hasImagesInDOM);
            
            // Check multiple conditions
            const shouldWarn = this.hasUnsavedWork || hasImages || hasAnnotations || hasImagesInDOM;
            
            if (shouldWarn) {
                console.log('Preventing page unload - user has unsaved work');
                const message = 'You have unsaved work (uploaded images or annotations). Are you sure you want to leave?';
                e.preventDefault();
                e.returnValue = message;
                return message;
            } else {
                console.log('No unsaved work detected, allowing page unload');
            }
        };
        
        window.addEventListener('beforeunload', beforeUnloadHandler);
        console.log('Page unload protection configured successfully');

        // Clear all images button
        const clearAllBtn = document.getElementById('clearAllImages');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', async () => {
                await this.clearAllImages();
            });
        }

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
        
        // Edit mode toggle button
        document.getElementById('editToggle').addEventListener('click', () => {
            if (window.canvasManager) {
                window.canvasManager.toggleEditMode();
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
        
        // AI Segmentation Settings
        this.setupAISettings();
    }

    setupAISettings() {        // Initialize AI segmentation settings
        this.aiSettings = {
            maxPoints: 10,
            quality: 'medium',
            toleranceMap: {
                'high': { min: 0.001, max: 0.01 },
                'medium': { min: 0.005, max: 0.02 },
                'low': { min: 0.01, max: 0.05 }
            }
        };

        // Max points slider
        const maxPointsSlider = document.getElementById('maxPoints');
        const maxPointsValue = document.getElementById('maxPointsValue');
        
        maxPointsSlider.addEventListener('input', (e) => {
            this.aiSettings.maxPoints = parseInt(e.target.value);
            maxPointsValue.textContent = e.target.value;
        });

        // Quality selector
        const qualitySelect = document.getElementById('simplificationQuality');
        qualitySelect.addEventListener('change', (e) => {
            this.aiSettings.quality = e.target.value;
        });

        // Restore original button
        const restoreBtn = document.getElementById('restoreOriginal');
        restoreBtn.addEventListener('click', () => this.restoreOriginalPolygon());
    }

    getSimplificationSettings() {
        const tolerances = this.aiSettings.toleranceMap[this.aiSettings.quality];
        return {
            maxPoints: this.aiSettings.maxPoints,
            minTolerance: tolerances.min,
            maxTolerance: tolerances.max
        };
    }

    restoreOriginalPolygon() {
        const selectedAnnotation = window.annotationManager.annotations.find(
            ann => ann.id === window.annotationManager.selectedAnnotation
        );
        
        if (!selectedAnnotation || !selectedAnnotation.originalPolygon) {
            Utils.showToast('No original polygon available', 'warning');
            return;
        }

        // Restore original polygon
        selectedAnnotation.polygon = [...selectedAnnotation.originalPolygon];
        selectedAnnotation.simplified = false;
        
        // Clear canvas polygon to force recalculation
        selectedAnnotation.canvasPolygon = null;
        
        // Update UI and redraw
        window.annotationManager.updateUI();
        window.canvasManager.redraw();
        
        Utils.showToast(`Restored original polygon with ${selectedAnnotation.polygon.length} points`, 'success');
        
        // Save the change
        window.annotationManager.saveAnnotation(selectedAnnotation.id);
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
                break;            case 'Delete':
                e.preventDefault();
                if (window.annotationManager.selectedAnnotation) {
                    window.annotationManager.deleteSelectedAnnotation();
                }
                break;
            case 'e':
            case 'E':
                e.preventDefault();
                if (window.canvasManager) {
                    window.canvasManager.toggleEditMode();
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
    }    async handleFileSelect(files) {
        if (!files || files.length === 0) return;
        
        // Handle multiple files
        const validFiles = [];
        const invalidFiles = [];
        
        // Validate all files first
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            if (!Utils.isValidImageFile(file)) {
                invalidFiles.push(file.name);
                continue;
            }
            
            if (file.size > 100 * 1024 * 1024) { // 100MB limit per file
                invalidFiles.push(`${file.name} (too large)`);
                continue;
            }
            
            validFiles.push(file);
        }
        
        // Show errors for invalid files
        if (invalidFiles.length > 0) {
            Utils.showToast(`Invalid files: ${invalidFiles.join(', ')}. Please select valid image files (JPG, PNG, TIFF, GeoTIFF) smaller than 100MB.`, 'error');
        }
          if (validFiles.length === 0) {
            return;
        }

        // Determine if this is single or multi-upload for different handling
        const isSingleUpload = validFiles.length === 1;
        console.log(`${isSingleUpload ? 'Single' : 'Multi'} upload detected: ${validFiles.length} file(s)`);
          
        // Upload all valid files sequentially to preserve order
        const successfulUploads = [];
        
        try {
            // Show loading for multiple uploads
            Utils.showLoading(`Uploading ${validFiles.length} image${validFiles.length > 1 ? 's' : ''}...`);// Upload files one by one to preserve selection order
            for (let i = 0; i < validFiles.length; i++) {
                const file = validFiles[i];
                try {
                    console.log(`Starting file upload ${i + 1}/${validFiles.length} for:`, file.name);
                    
                    // Start with progress bar for upload
                    Utils.showProgressBar(0, `Uploading ${file.name}...`);
                    
                    const imageData = await api.uploadImage(file, (progress) => {
                        // Show upload progress (0-90% to leave room for transition)
                        const uploadProgress = Math.min(progress * 0.9, 90);
                        Utils.showProgressBar(uploadProgress, `Uploading ${file.name}... ${Math.round(progress)}%`);
                        console.log(`Upload progress for ${file.name}: ${progress.toFixed(1)}%`);
                    }, false); // Don't show individual loading for multiple uploads
                    
                    console.log(`Upload ${i + 1}/${validFiles.length} completed:`, imageData);
                    
                    // Show upload completed
                    Utils.showProgressBar(95, `Upload complete, segmenting image...`);                    // Add to images list
                    this.images.push(imageData);
                    // Mark as having unsaved work
                    this.hasUnsavedWork = true;
                    successfulUploads.push(imageData);

                    if (isSingleUpload) {
                        // SINGLE UPLOAD: Immediate preprocessing for instant first-click segmentation
                        Utils.showProgressBar(100, 'Upload complete - processing image...');
                        
                        try {
                            // Call preprocessing immediately for instant segmentation
                            await api.preprocessImage(imageData.image_id);
                            Utils.showProgressBar(100, 'Ready for annotation! ✓');
                            setTimeout(() => {
                                Utils.hideProgressBar();
                            }, 1000);
                            Utils.showToast('Image ready for annotation', 'success');
                        } catch (preprocessError) {
                            console.warn('Preprocessing failed, but image is available for manual annotation:', preprocessError);
                            Utils.showProgressBar(100, 'Upload complete');
                            setTimeout(() => {
                                Utils.hideProgressBar();
                            }, 2000);
                            Utils.showToast('Image uploaded successfully', 'info');
                        }
                    } else {
                        // MULTI-UPLOAD: Only show completion message, don't preprocess yet
                        // We'll preprocess only the selected image after all uploads complete
                        Utils.showProgressBar(100, 'Upload complete ✓');
                        setTimeout(() => {
                            Utils.hideProgressBar();
                        }, 500);
                    }
                    
                } catch (error) {
                    console.error(`Upload failed for ${file.name}:`, error);
                    Utils.showProgressBar(0, `Upload failed: ${error.message}`);
                    setTimeout(() => {
                        Utils.hideProgressBar();
                    }, 3000);
                    Utils.showToast(`Upload failed for ${file.name}: ${error.message}`, 'error');
                }
            }
            // Do not hide the progress bar here; it will be hidden after segmentation is complete.
            // Reload images from server to get updated list
            await this.loadImages();            // Show success message
            if (successfulUploads.length > 0) {
                Utils.showToast(`Successfully uploaded ${successfulUploads.length} image${successfulUploads.length > 1 ? 's' : ''}`, 'success');
                // Select the first image from the newly uploaded ones
                // Since images are now sorted by creation time, the first uploaded image will be first
                if (this.images.length > 0) {
                    const uploadedImageIds = successfulUploads.map(img => img.image_id);
                    const firstUploadedImage = this.images.find(img => uploadedImageIds.includes(img.image_id));
                    if (firstUploadedImage) {
                        console.log('Selecting first uploaded image with ID:', firstUploadedImage.image_id);
                        await this.selectImage(firstUploadedImage.image_id);
                        
                        // CRITICAL: For multi-upload ONLY, preprocess the selected image for instant segmentation
                        // Single uploads already have preprocessing done above
                        if (!isSingleUpload) {                            // Multi-upload complete - preprocessing selected image for instant segmentation
                            Utils.showLoading('Preparing image for annotation...');                            try {
                                await api.preprocessImage(firstUploadedImage.image_id);
                                Utils.showToast('Ready for instant annotation!', 'success');
                                console.log('Selected image preprocessed - first click will be instant');
                            } catch (preprocessError) {
                                console.warn('Preprocessing failed for selected image:', preprocessError);
                                Utils.showToast('Image ready for manual annotation', 'info');
                            } finally {
                                Utils.hideLoading();
                            }
                        }
                    }
                }            }
            
        } catch (error) {
            Utils.hideLoading();
            console.error('Multiple upload process failed:', error);
            Utils.showToast('Upload process failed: ' + error.message, 'error');
        }
    }    async loadImages() {
        try {
            console.log('Loading images from server...');
            
            // Validate session before trying to load images
            const sessionId = await api.getValidSessionId();
            if (!sessionId) {
                console.warn('No valid session available');
                this.images = [];
                this.updateImagesList();
                return;
            }
            
            // Don't show loading here since main initialization already shows it
            this.images = await api.getImages();
            
            // Sort images by creation time (oldest first) to maintain upload order
            this.images.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            
            console.log('Images loaded and sorted by creation time:', this.images);
            
            this.updateImagesList();
            console.log('Images list updated');
            
            if (this.images.length > 0) {
                console.log(`Found ${this.images.length} images`);
            } else {
                console.log('No images found (fresh session)');
            }
        } catch (error) {
            console.error('Error occurred:', error);
            throw error; // Re-throw so main initialization can handle it
        }
    }updateImagesList() {
        const container = document.getElementById('imagesList');
        const clearAllBtn = document.getElementById('clearAllImages');
        
        if (this.images.length === 0) {
            container.innerHTML = `
                <div class="no-images">
                    <i class="fas fa-image"></i>
                    <p>No images uploaded yet</p>
                </div>
            `;
            
            // Disable clear all button when no images
            if (clearAllBtn) {
                clearAllBtn.disabled = true;
            }
            return;
        }          container.innerHTML = this.images.map((image, index) => `
            <div class="image-item ${this.currentImageId === image.image_id ? 'active' : ''}" 
                 data-image-id="${image.image_id}">
                <div class="image-number-left">${index + 1}</div>
                <div class="image-content">
                    <div class="image-actions">
                        <button class="delete-image-btn" data-image-id="${image.image_id}" title="Remove Image">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <img class="image-thumbnail" 
                         src="${api.getImageUrl(image.file_path)}" 
                         alt="${image.file_name}"
                         onerror="this.style.display='none'">
                    <div class="image-info">
                        <h4>${image.file_name}</h4>
                        <p>${image.resolution} • ${Utils.formatDate(image.created_at)}</p>
                    </div>
                </div>
            </div>
        `).join('');// Add click handlers for images
        container.querySelectorAll('.image-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                // Don't trigger image selection if clicking on delete button
                if (e.target.closest('.delete-image-btn')) {
                    return;
                }
                
                const imageId = item.dataset.imageId;
                await this.selectImage(imageId);
            });
        });
          // Add delete button handlers
        container.querySelectorAll('.delete-image-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent image selection
                const imageId = btn.dataset.imageId;
                await this.removeImage(imageId);
            });
        });
        
        // Enable clear all button when there are images
        if (clearAllBtn) {
            clearAllBtn.disabled = false;
        }
    }    async selectImage(imageId) {
        // Find image data
        const imageData = this.images.find(img => img.image_id == imageId);
        if (!imageData) {
            Utils.showToast('Image not found', 'error');
            return;
        }
        
        this.currentImageId = imageId;
        
        // Update UI
        this.updateImagesList();
          // CRITICAL: Set annotation manager's current image BEFORE loading canvas image
        // This prevents the canvas image mismatch warning during redraw
        await window.annotationManager.setCurrentImage(imageId);
        
        // Load image in canvas (this will trigger redraw with correct annotation context)
        // Always treat as single upload - no special multi-upload handling
        window.canvasManager.loadImage(imageData, false);
          // IMPORTANT: Ensure preprocessing is done for instant segmentation when switching images
        try {
            await api.preprocessImage(imageId);
            console.log(`Image ${imageId} preprocessed for instant segmentation`);
        } catch (preprocessError) {
            console.warn(`Preprocessing failed for image ${imageId}:`, preprocessError);
        }
        
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
    }    async removeImage(imageId) {
        const image = this.images.find(img => img.image_id === imageId);
        if (!image) {
            Utils.showToast('Image not found', 'error');
            return;
        }
        
        // Confirm before deletion
        if (!confirm(`Are you sure you want to delete the image "${image.file_name}"? This will also remove any annotations on this image.`)) {
            return;
        }
        
        try {
            Utils.showLoading('Deleting image...');
            
            // Delete from backend
            const response = await api.deleteImage(imageId);
            
            // If successful, remove from local images array
            this.images = this.images.filter(img => img.image_id !== imageId);
            
            // If this was the current image, reset it
            if (this.currentImageId === imageId) {
                this.currentImageId = null;
                
                // Clear canvas
                if (window.canvasManager) {
                    window.canvasManager.clearImage();
                }
                
                // Clear annotations
                if (window.annotationManager) {
                    window.annotationManager.annotations = [];
                    window.annotationManager.updateUI();
                }
                
                // Load another image if available
                if (this.images.length > 0) {
                    await this.selectImage(this.images[0].image_id);
                }
            }
            
            // Update UI
            this.updateImagesList();
            
            Utils.hideLoading();
            Utils.showToast('Image deleted successfully', 'success');
            
        } catch (error) {            Utils.hideLoading();
            console.error('Failed to delete image:', error);
            Utils.showToast('Failed to delete image: ' + error.message, 'error');
        }
    }

    async clearAllImages() {
        if (this.images.length === 0) {
            Utils.showToast('No images to clear', 'info');
            return;
        }
        
        // Confirm before clearing all
        const imageCount = this.images.length;
        if (!confirm(`Are you sure you want to remove all ${imageCount} image${imageCount > 1 ? 's' : ''}? This will also remove all annotations.`)) {
            return;
        }
        
        try {
            Utils.showLoading('Clearing all images...');
            
            // Clear session data on the backend
            await api.clearSession();
            
            // Clear local data
            this.images = [];
            this.currentImageId = null;
            this.hasUnsavedWork = false;
            
            // Clear canvas
            if (window.canvasManager) {
                window.canvasManager.clearImage();
            }
            
            // Clear annotations
            if (window.annotationManager) {
                window.annotationManager.annotations = [];
                window.annotationManager.updateUI();
            }
            
            // Reset UI
            this.resetUI();
            
            Utils.hideLoading();
            Utils.showToast(`Cleared ${imageCount} image${imageCount > 1 ? 's' : ''} and all annotations`, 'success');
            
        } catch (error) {
            Utils.hideLoading();
            console.error('Failed to clear all images:', error);
            Utils.showToast('Failed to clear all images: ' + error.message, 'error');
        }
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('DOM ready, initializing SAT Annotator...');
        window.satAnnotator = new SATAnnotator();
        window.app = window.satAnnotator; // Alias for easier access
        await window.satAnnotator.initialize();
        console.log('SAT Annotator application ready for use');
    } catch (error) {
        console.error('Failed to start SAT Annotator:', error);
        Utils.hideLoading();
        Utils.showToast('Failed to start application: ' + error.message, 'error');
    }
});

// Add some debug functions for development
window.debugInfo = () => {
    console.log('SAT Annotator Debug Info');
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
SAT Annotator - Keyboard Shortcuts:
• 1 - Select tool
• 2 - AI Point tool  
• 3 - Polygon tool
• 4 - Pan tool
• ESC - Cancel drawing / Clear selection
• DELETE - Delete selected annotation
• + - Zoom in
• - - Zoom out  
• 0 - Fit to screen

Debug commands:
• debugInfo() - Show debug information
• exportSession() - Export session data
• clearSession() - Clear all data
`);
