// Annotation management for SAT Annotator

class AnnotationManager {
    constructor() {
        console.log('AnnotationManager: Starting constructor...');
        this.annotations = [];
        this.selectedAnnotation = null;
        this.currentImageId = null;
        this.currentLabel = 'building'; // Default label
        this.customLabels = []; // Store custom labels added by user
        
        console.log('AnnotationManager: Basic properties set');
        
        try {
            console.log('AnnotationManager: Setting up event listeners...');
            this.setupEventListeners();
            console.log('AnnotationManager: Event listeners setup complete');
        } catch (error) {
            console.error('AnnotationManager: Event listeners setup failed:', error);
        }
        
        try {
            console.log('AnnotationManager: Updating UI...');
            this.updateUI();
            console.log('AnnotationManager: UI update complete');
        } catch (error) {
            console.error('AnnotationManager: UI update failed:', error);
        }
        
        console.log('AnnotationManager: Constructor complete');
    }setupEventListeners() {
        // Set up label selection events with event delegation for dynamic buttons
        document.getElementById('labelList').addEventListener('click', (e) => {
            const btn = e.target.closest('.label-btn');
            if (btn && !e.target.classList.contains('remove-label')) {
                this.selectLabel(btn.dataset.label);
            }
        });

        // Custom label input
        document.getElementById('addCustomLabel').addEventListener('click', () => this.addCustomLabel());
        document.getElementById('customLabelInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.addCustomLabel();
            }
        });
        
        // Context menu events
        document.getElementById('deleteAnnotation').addEventListener('click', () => this.deleteSelectedAnnotation());
        document.getElementById('editAnnotation').addEventListener('click', () => this.editSelectedAnnotation());
        
        // Hide context menu when clicking elsewhere
        document.addEventListener('click', () => this.hideContextMenu());
    }    async setCurrentImage(imageId) {
        // Save any existing annotations for the current image before switching
        if (this.currentImageId && this.annotations.length > 0) {
            console.log(`Saving ${this.annotations.length} annotations for image ${this.currentImageId} before switching`);
            try {
                await Promise.all(
                    this.annotations.map(ann => this.saveAnnotation(ann.id))
                );
                console.log('All annotations saved successfully');
            } catch (error) {
                console.error('Failed to save some annotations before switching images:', error);
            }
        }
        
        this.currentImageId = imageId;
        this.annotations = [];
        this.selectedAnnotation = null;
        this.updateUI();
          // Load existing annotations for this image
        await this.loadAnnotations(imageId);
    }

    selectLabel(label) {
        this.currentLabel = label;
        
        // Update UI to show active label
        document.querySelectorAll('.label-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.querySelector(`[data-label="${label}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        // Update current label display
        document.getElementById('currentLabel').textContent = label;
    }

    addCustomLabel() {
        const input = document.getElementById('customLabelInput');
        const label = input.value.trim().toLowerCase();
        
        if (!label || label.length === 0) {
            return;
        }
        
        // Check if label already exists
        const existingBtn = document.querySelector(`[data-label="${label}"]`);
        if (existingBtn) {
            this.selectLabel(label);
            input.value = '';
            return;
        }
        
        // Add to custom labels
        this.customLabels.push(label);
        
        // Create button for custom label
        this.createCustomLabelButton(label);
        
        // Select the new label
        this.selectLabel(label);
        
        // Clear input
        input.value = '';
    }

    createCustomLabelButton(label) {
        const labelList = document.getElementById('labelList');
        
        const button = document.createElement('button');
        button.className = 'label-btn';
        button.dataset.label = label;
        
        button.innerHTML = `
            <i class="fas fa-tag"></i>
            <span>${label}</span>
            <i class="fas fa-times remove-label" onclick="event.stopPropagation(); annotationManager.removeCustomLabel('${label}')"></i>
        `;
        
        // Add click event
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!e.target.classList.contains('remove-label')) {
                this.selectLabel(label);
            }
        });
        
        labelList.appendChild(button);
    }

    removeCustomLabel(label) {
        // Remove from custom labels array
        this.customLabels = this.customLabels.filter(l => l !== label);
        
        // Remove button from UI
        const btn = document.querySelector(`[data-label="${label}"]`);
        if (btn && !btn.classList.contains('default-label')) {
            btn.remove();        }
        
        // If this was the current label, switch to default
        if (this.currentLabel === label) {
            this.selectLabel('building');
        }
    }    async loadAnnotations(imageId) {
        try {
            const annotations = await api.getAnnotations(imageId);
            console.log('Raw annotations from API:', annotations);
            
            this.annotations = annotations.map((ann, index) => {
                // Parse polygon from backend format
                let polygon = [];
                let label = 'Unlabeled';
                let type = 'unknown';
                
                console.log(`Processing annotation ${index}:`, ann);
                
                try {
                    if (ann.data && ann.data.features && ann.data.features.length > 0) {
                        const feature = ann.data.features[0];
                        console.log(`  Feature found:`, feature);
                        
                        // Extract label from properties
                        if (feature.properties) {
                            label = feature.properties.label || feature.properties.class_name || 'Unlabeled';
                            type = feature.properties.type || 'polygon';
                        }
                        
                        // Extract polygon coordinates from GeoJSON
                        if (feature.geometry && feature.geometry.type === 'Polygon') {
                            const coordinates = feature.geometry.coordinates[0]; // First ring of polygon
                            polygon = coordinates.map(coord => [coord[0], coord[1]]);
                            console.log(`  Parsed polygon for annotation ${ann.annotation_id}: ${polygon.length} points, sample:`, polygon.slice(0, 3));
                        } else {
                            console.log(`  No valid geometry found for annotation ${ann.annotation_id}:`, feature.geometry);
                        }
                    } else {
                        console.log(`  No valid data structure for annotation ${ann.annotation_id}:`, ann.data);
                    }
                } catch (parseError) {
                    console.error('Error parsing annotation data:', parseError, ann);
                }
                
                const result = {
                    id: ann.annotation_id || Utils.generateId(),
                    type: type,
                    polygon: polygon,
                    label: label,
                    created: ann.created_at || new Date().toISOString(),
                    source: ann.auto_generated ? 'ai' : 'manual',
                    canvasPolygon: [] // Will be calculated when drawing
                };
                
                console.log(`  Final annotation ${index}:`, result);
                return result;            });
            
            // Sort annotations by creation time to maintain consistent numbering
            this.annotations.sort((a, b) => new Date(a.created) - new Date(b.created));
            
            console.log(`Loaded ${this.annotations.length} annotations:`, this.annotations);
            this.updateUI();
        } catch (error) {
            console.error('Failed to load annotations:', error);
        }
    }    addAnnotation(annotation = {}) {
        // Ensure annotation has an ID
        if (!annotation.id) {
            annotation.id = Utils.generateId();
        }
        
        // Set default values if not present
        annotation.type = annotation.type || 'polygon';
        annotation.label = annotation.label || 'Unlabeled';
        annotation.polygon = annotation.polygon || [];
        annotation.created = annotation.created || new Date().toISOString();
        annotation.source = annotation.source || 'manual';
        
        this.annotations.push(annotation);
        this.updateUI();
        
        // Auto-save the annotation to backend
        if (this.currentImageId) {
            this.saveAnnotation(annotation.id).catch(error => {
                console.error('Failed to auto-save annotation:', error);
                Utils.showToast('Warning: Annotation not saved to backend', 'warning');
            });
        }
        
        // Enable export button
        document.getElementById('exportBtn').disabled = false;
        document.getElementById('clearAnnotations').disabled = false;
    }

    removeAnnotation(id) {
        this.annotations = this.annotations.filter(ann => ann.id !== id);
        if (this.selectedAnnotation === id) {
            this.selectedAnnotation = null;
        }
        this.updateUI();
        
        // Disable buttons if no annotations
        if (this.annotations.length === 0) {
            document.getElementById('exportBtn').disabled = true;
            document.getElementById('clearAnnotations').disabled = true;
        }
    }

    updateAnnotation(id, updates) {
        const annotation = this.annotations.find(ann => ann.id === id);
        if (annotation) {
            Object.assign(annotation, updates);
            this.updateUI();
        }
    }    selectAnnotation(id) {
        this.selectedAnnotation = id;
        this.updateUI();
        
        // Update restore button visibility
        this.updateRestoreButton();
        
        // Scroll annotation into view
        const element = document.querySelector(`[data-annotation-id="${id}"]`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    getSelectedAnnotation() {
        if (this.selectedAnnotation) {
            return this.annotations.find(ann => ann.id === this.selectedAnnotation);
        }
        return null;
    }clearSelection() {
        this.selectedAnnotation = null;
        this.updateUI();
        this.updateRestoreButton();
    }

    updateRestoreButton() {
        const restoreBtn = document.getElementById('restoreOriginal');
        if (!restoreBtn) return;
        
        const selectedAnnotation = this.annotations.find(ann => ann.id === this.selectedAnnotation);
        const hasOriginal = selectedAnnotation && selectedAnnotation.originalPolygon && selectedAnnotation.simplified;
        
        restoreBtn.disabled = !hasOriginal;
        if (hasOriginal) {
            restoreBtn.title = `Restore original polygon with ${selectedAnnotation.originalPolygon.length} points`;
        } else {
            restoreBtn.title = 'No original polygon available';
        }
    }

    getAnnotationAtPoint(point) {
        // Check if point is inside any annotation polygon
        for (const annotation of this.annotations) {
            if (annotation.canvasPolygon && annotation.canvasPolygon.length > 2) {
                if (Utils.pointInPolygon(point, annotation.canvasPolygon)) {
                    return annotation;
                }
            }
        }
        return null;
    }

    updateUI() {
        this.updateAnnotationsList();
        this.updateAnnotationCounts();
    }

    updateAnnotationsList() {
        const container = document.getElementById('annotationsList');
        
        if (this.annotations.length === 0) {
            container.innerHTML = `
                <div class="no-annotations">
                    <i class="fas fa-shapes"></i>
                    <p>No annotations yet</p>
                </div>
            `;
            return;
        }        container.innerHTML = this.annotations.map((annotation, index) => {
            const isEditing = window.canvasManager && window.canvasManager.isEditingPolygon && window.canvasManager.editingAnnotationId === annotation.id;
            return `
                <div class="annotation-item ${this.selectedAnnotation === annotation.id ? 'selected' : ''} ${isEditing ? 'editing' : ''}" 
                     data-annotation-id="${annotation.id}">
                    <div class="annotation-number">${index + 1}</div>
                    <div class="annotation-info">
                        <h4>${annotation.label}</h4>
                        <p>${annotation.source === 'ai' ? 'AI Generated' : 'Manual'} • ${annotation.polygon.length} points${annotation.simplified ? ' (simplified)' : ''}</p>
                    </div>
                    <div class="annotation-actions">
                        <button class="action-btn" onclick="annotationManager.editPolygon('${annotation.id}')" title="Edit polygon">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${annotation.originalPolygon ? `<button class="action-btn" onclick="annotationManager.resimplifyPolygon('${annotation.id}')" title="Re-simplify with current settings">
                            <i class="fas fa-compress"></i>
                        </button>` : ''}
                        <button class="action-btn" onclick="annotationManager.editAnnotation('${annotation.id}')" title="Edit label">
                            <i class="fas fa-tag"></i>
                        </button>
                        <button class="action-btn" onclick="annotationManager.deleteAnnotation('${annotation.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        // Add click handlers for selection
        container.querySelectorAll('.annotation-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.annotation-actions')) {
                    const id = item.dataset.annotationId;
                    this.selectAnnotation(id);
                    window.canvasManager.redraw();
                }
            });
            
            // Context menu
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const id = item.dataset.annotationId;
                this.selectAnnotation(id);
                this.showContextMenu(e.clientX, e.clientY);
            });
        });
    }

    updateAnnotationCounts() {
        const total = this.annotations.length;
        const aiGenerated = this.annotations.filter(ann => ann.source === 'ai').length;
        const manual = this.annotations.filter(ann => ann.source === 'manual').length;
        
        // Update header or status somewhere if needed
        // Could add a status bar showing these counts
    }    editAnnotation(id) {
        const annotation = this.annotations.find(ann => ann.id === id);
        if (!annotation) return;
        
        // Simple prompt for now - could be enhanced with inline editing later
        const newLabel = prompt('Enter new label:', annotation.label);
        if (newLabel && newLabel.trim() !== annotation.label) {
            this.updateAnnotation(id, { label: newLabel.trim() });
            this.saveAnnotation(id);
        }
    }    editPolygon(id) {
        // Switch to select tool for editing
        window.canvasManager.setTool('select');
        window.canvasManager.updateToolButtons();
        
        // Select the annotation
        this.selectAnnotation(id);
        
        // Enable persistent edit mode
        window.canvasManager.editModeActive = true;
        window.canvasManager.startPolygonEditing(id);
        window.canvasManager.updateEditToggleButton();
        
        // Show editing instructions
        Utils.showNotification(
            'Edit Mode ON: ' +
            'Click and drag vertices to move them • ' +
            'Click on edge to add new vertex • ' +
            'Right-click vertex to delete • ' +
            'Use Edit Mode button to toggle off',
            5000
        );
    }

    resimplifyPolygon(id) {
        const annotation = this.annotations.find(ann => ann.id === id);
        if (!annotation || !annotation.originalPolygon) {
            Utils.showToast('No original polygon available for re-simplification', 'warning');
            return;
        }

        // Get current settings
        const settings = window.app ? window.app.getSimplificationSettings() : {
            maxPoints: 20,
            minTolerance: 0.005,
            maxTolerance: 0.02
        };

        // Re-simplify using current settings
        const newSimplified = Utils.adaptiveSimplifyPolygon(
            annotation.originalPolygon,
            settings.maxPoints,
            settings.minTolerance,
            settings.maxTolerance
        );

        // Update annotation
        annotation.polygon = newSimplified;
        annotation.simplified = annotation.originalPolygon.length !== newSimplified.length;
        annotation.canvasPolygon = null; // Force recalculation

        // Update UI
        this.updateUI();
        window.canvasManager.redraw();

        // Save changes
        this.saveAnnotation(id);

        Utils.showToast(`Re-simplified polygon: ${annotation.originalPolygon.length} → ${newSimplified.length} points`, 'success');
    }

    async saveAnnotation(annotationId) {
        const annotation = this.annotations.find(ann => ann.id === annotationId);
        if (!annotation || !this.currentImageId) return;
        
        try {
            await api.saveAnnotation(this.currentImageId, {
                id: annotation.id,
                type: annotation.type,
                polygon: annotation.polygon,
                label: annotation.label,
                source: annotation.source
            });        } catch (error) {
            console.error('Failed to save annotation:', error);
        }
    }    async deleteAnnotation(id) {
        console.log('Attempting to delete annotation with ID:', id);
        if (confirm('Are you sure you want to delete this annotation?')) {
            try {
                // Delete from backend first
                console.log('Calling API to delete annotation:', id);
                await api.deleteAnnotation(id);
                console.log('Backend deletion successful for:', id);
                
                // Only remove from frontend if backend deletion succeeds
                this.removeAnnotation(id);
                window.canvasManager.redraw();
                console.log('Frontend cleanup completed for:', id);
            } catch (error) {
                // If backend deletion fails, show error but don't remove from frontend
                console.error('Failed to delete annotation from backend:', error);
                Utils.showToast(`Failed to delete annotation: ${error.message}`, 'error');
            }
        }
    }async deleteAnnotationFromBackend(id) {
        try {
            // Delete from backend first
            await api.deleteAnnotation(id);
            
            // Only remove from frontend if backend deletion succeeds
            this.removeAnnotation(id);
            window.canvasManager.redraw();
        } catch (error) {
            // If backend deletion fails, show error but don't remove from frontend
            console.error('Failed to delete annotation from backend:', error);
            Utils.showToast(`Failed to delete annotation: ${error.message}`, 'error');
        }
    }

    deleteSelectedAnnotation() {
        if (this.selectedAnnotation) {
            this.deleteAnnotation(this.selectedAnnotation);
        }
        this.hideContextMenu();
    }

    editSelectedAnnotation() {
        if (this.selectedAnnotation) {
            this.editAnnotation(this.selectedAnnotation);
        }
        this.hideContextMenu();
    }

    showContextMenu(x, y) {
        const menu = document.getElementById('contextMenu');
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.hidden = false;
    }

    hideContextMenu() {
        document.getElementById('contextMenu').hidden = true;
    }

    clearAll() {
        if (this.annotations.length === 0) return;
        
        if (confirm(`Are you sure you want to delete all ${this.annotations.length} annotations?`)) {
            this.annotations = [];
            this.selectedAnnotation = null;
            this.updateUI();
            window.canvasManager.redraw();
            
            document.getElementById('exportBtn').disabled = true;
            document.getElementById('clearAnnotations').disabled = true;
            
            Utils.showToast('All annotations cleared', 'success');
        }
    }    async exportAnnotations() {
        // Check if there are multiple images
        const hasMultipleImages = window.satAnnotator && window.satAnnotator.images && window.satAnnotator.images.length > 1;
        
        if (hasMultipleImages) {
            // Show dialog to choose export scope
            const exportAll = confirm(
                `You have ${window.satAnnotator.images.length} images loaded.\n\n` +
                'Click "OK" to export annotations from ALL images\n' +
                'Click "Cancel" to export only the current image\'s annotations'
            );
            
            if (exportAll) {
                await this.exportAllImages();
                return;
            }
        }
        
        // Export current image only
        await this.exportCurrentImage();
    }

    async exportCurrentImage() {
        if (this.annotations.length === 0) {
            Utils.showToast('No annotations to export for current image', 'warning');
            return;
        }
        
        const exportData = {
            image: {
                id: this.currentImageId,
                filename: window.canvasManager.currentImage?.file_name || 'unknown',
                resolution: window.canvasManager.currentImage?.resolution || 'unknown',
                width: window.canvasManager.imageElement?.naturalWidth || 0,
                height: window.canvasManager.imageElement?.naturalHeight || 0
            },            annotations: this.annotations.map((ann, index) => ({
                number: index + 1,
                id: ann.id,
                type: ann.type,
                label: ann.label,
                polygon: ann.polygon,
                source: ann.source,
                created: ann.created,
                points_count: ann.polygon.length
            })),
            export_info: {
                format: 'json',
                exported_at: new Date().toISOString(),
                tool: 'SAT Annotator',
                version: '1.0.0',
                scope: 'single_image'
            },
            statistics: {
                total_annotations: this.annotations.length,
                ai_generated: this.annotations.filter(ann => ann.source === 'ai').length,
                manual: this.annotations.filter(ann => ann.source === 'manual').length,
                unique_labels: [...new Set(this.annotations.map(ann => ann.label))].length
            }
        };

        this.downloadJSON(exportData, `annotations_${this.currentImageId}.json`);
        Utils.showToast(`Exported ${this.annotations.length} annotations for current image`, 'success');
    }

    async exportAllImages() {
        if (!window.satAnnotator || !window.satAnnotator.images || window.satAnnotator.images.length === 0) {
            Utils.showToast('No images available', 'warning');
            return;
        }

        Utils.showLoading('Collecting annotations from all images...');
        
        try {
            // Save current image's annotations first
            if (this.currentImageId && this.annotations.length > 0) {
                await Promise.all(
                    this.annotations.map(ann => this.saveAnnotation(ann.id))
                );
            }

            const allAnnotations = [];
            const imageData = [];
            let totalAnnotations = 0;

            // Collect annotations from all images
            for (const image of window.satAnnotator.images) {
                const annotations = await api.getAnnotations(image.image_id);
                
                if (annotations.length > 0) {
                    // Process annotations for this image
                    const processedAnnotations = annotations.map((ann, index) => {
                        let polygon = [];
                        let label = 'Unlabeled';
                        let type = 'unknown';
                        let source = 'unknown';
                        let created = new Date().toISOString();
                        let annotationId = ann.annotation_id;

                        if (ann.data && ann.data.features && ann.data.features.length > 0) {
                            const feature = ann.data.features[0];
                            
                            if (feature.properties) {
                                label = feature.properties.label || feature.properties.class_name || 'Unlabeled';
                                type = feature.properties.type || 'polygon';
                                source = feature.properties.source || 'unknown';
                                created = feature.properties.created || created;
                            }

                            if (feature.geometry && feature.geometry.coordinates && feature.geometry.coordinates.length > 0) {
                                polygon = feature.geometry.coordinates[0];
                            }
                        }

                        return {
                            id: annotationId,
                            image_id: image.image_id,
                            image_filename: image.file_name,
                            type,
                            label,
                            polygon,
                            source,
                            created,
                            points_count: polygon.length
                        };
                    });

                    allAnnotations.push(...processedAnnotations);
                    totalAnnotations += processedAnnotations.length;

                    imageData.push({
                        id: image.image_id,
                        filename: image.file_name,
                        annotations_count: processedAnnotations.length
                    });
                }
            }

            Utils.hideLoading();

            if (totalAnnotations === 0) {
                Utils.showToast('No annotations found across all images', 'warning');
                return;
            }            const exportData = {
                images: imageData,
                annotations: allAnnotations.map((ann, index) => ({
                    number: index + 1,
                    ...ann
                })),
                export_info: {
                    format: 'json',
                    exported_at: new Date().toISOString(),
                    tool: 'SAT Annotator',
                    version: '1.0.0',
                    scope: 'all_images',
                    total_images: window.satAnnotator.images.length,
                    images_with_annotations: imageData.length
                },
                statistics: {
                    total_images: window.satAnnotator.images.length,
                    images_with_annotations: imageData.length,
                    total_annotations: totalAnnotations,
                    ai_generated: allAnnotations.filter(ann => ann.source === 'ai').length,
                    manual: allAnnotations.filter(ann => ann.source === 'manual').length,
                    unique_labels: [...new Set(allAnnotations.map(ann => ann.label))].length,
                    annotations_per_image: imageData.map(img => ({
                        image: img.filename,
                        count: img.annotations_count
                    }))
                }
            };

            this.downloadJSON(exportData, `annotations_all_images_${new Date().toISOString().split('T')[0]}.json`);
            Utils.showToast(`Exported ${totalAnnotations} annotations from ${imageData.length} images`, 'success');

        } catch (error) {
            Utils.hideLoading();
            console.error('Failed to export all annotations:', error);
            Utils.showToast('Failed to export all annotations: ' + error.message, 'error');
        }
    }    downloadJSON(data, filename) {
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
    }
    
    drawAnnotations(ctx, scale, offsetX, offsetY) {
        console.log(`drawAnnotations called with ${this.annotations.length} annotations, scale: ${scale.toFixed(3)}, offset: ${offsetX.toFixed(1)},${offsetY.toFixed(1)}`);
        
        // Note: Canvas context is already DPR-scaled by canvas manager
        // so we should NOT divide by DPR again
        
        this.annotations.forEach((annotation, index) => {
            if (!annotation.polygon || annotation.polygon.length < 3) {
                console.log(`Annotation ${index} skipped: invalid polygon`);
                return;
            }
              console.log(`Drawing annotation ${index}: ${annotation.polygon.length} points, source: ${annotation.source}`);
            
            // Quick validation that polygon coordinates are in normalized range (0-1)
            const isNormalized = annotation.polygon.slice(0, 3).every(point => 
                point[0] >= 0 && point[0] <= 1 && point[1] >= 0 && point[1] <= 1
            );
            
            if (!isNormalized) {
                console.warn(`Annotation ${index} has non-normalized coordinates`);
            }            // Convert image coordinates to canvas coordinates
            const canvasPolygon = annotation.polygon.map(point => 
                Utils.imageToCanvasCoords(
                    point[0], point[1],
                    window.canvasManager.imageElement.naturalWidth,
                    window.canvasManager.imageElement.naturalHeight,
                    scale,
                    offsetX,
                    offsetY
                )
            );
            
            // Quick bounds and visibility check
            const bounds = {
                minX: Math.min(...canvasPolygon.map(p => p.x)),
                maxX: Math.max(...canvasPolygon.map(p => p.x)),
                minY: Math.min(...canvasPolygon.map(p => p.y)),
                maxY: Math.max(...canvasPolygon.map(p => p.y))
            };
            
            const canvasBounds = window.canvasManager.getDisplayDimensions();
            const isVisible = bounds.maxX >= 0 && bounds.minX <= canvasBounds.width && 
                             bounds.maxY >= 0 && bounds.minY <= canvasBounds.height;
            
            console.log(`Annotation ${index}: ${isVisible ? 'VISIBLE' : 'OUTSIDE'} (${bounds.minX.toFixed(0)}-${bounds.maxX.toFixed(0)}, ${bounds.minY.toFixed(0)}-${bounds.maxY.toFixed(0)})`);
              // Only update canvas polygon if it has actually changed and we're not dragging
            if (!annotation.isDragging && 
                (!annotation.canvasPolygon || 
                annotation.lastScale !== scale || 
                annotation.lastOffsetX !== offsetX || 
                annotation.lastOffsetY !== offsetY)) {
                annotation.canvasPolygon = canvasPolygon;
                annotation.lastScale = scale;
                annotation.lastOffsetX = offsetX;
                annotation.lastOffsetY = offsetY;
            } else if (!annotation.isDragging && !annotation.canvasPolygon) {
                // Ensure we have a canvas polygon even if not dragging
                annotation.canvasPolygon = canvasPolygon;
            }
              // Determine colors based on selection and source
            let strokeColor = annotation.source === 'ai' ? '#10b981' : '#3b82f6';
            let fillColor = annotation.source === 'ai' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)';
            let lineWidth = 2;
            let dashPattern = [];
            
            // Selected annotation styling
            if (this.selectedAnnotation === annotation.id) {
                strokeColor = '#ef4444';
                fillColor = 'rgba(239, 68, 68, 0.3)';
                
                // Special styling for annotations in edit mode
                if (window.canvasManager && 
                    window.canvasManager.isEditingPolygon && 
                    window.canvasManager.editingAnnotationId === annotation.id) {
                    strokeColor = '#f59e0b'; // Orange for editing
                    fillColor = 'rgba(245, 158, 11, 0.2)';
                    lineWidth = 3;
                    dashPattern = [5, 5]; // Dashed line for edit mode
                }
            }// Draw polygon fill (temporary fix - no DPR division)
            ctx.save();
            ctx.fillStyle = fillColor;
            ctx.beginPath();
            console.log(`Drawing annotation ${index}: fill at first point (${canvasPolygon[0].x}, ${canvasPolygon[0].y}) with color ${fillColor}`);
            canvasPolygon.forEach((point, index) => {
                if (index === 0) {
                    ctx.moveTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            });
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            console.log(`Fill completed for annotation ${index}`);
              // Draw polygon outline (temporary fix - no DPR division)
            ctx.save();
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = lineWidth;
            
            // Apply dash pattern if provided
            if (dashPattern.length > 0) {
                ctx.setLineDash(dashPattern);
            }
            
            ctx.beginPath();
            console.log(`Drawing annotation ${index}: stroke with color ${strokeColor}`);
            canvasPolygon.forEach((point, index) => {
                if (index === 0) {
                    ctx.moveTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            });
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
            console.log(`Stroke completed for annotation ${index}`);
              // Draw vertices
            canvasPolygon.forEach(point => {
                ctx.save();
                ctx.fillStyle = strokeColor;
                ctx.beginPath();
                ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
                ctx.fill();
                ctx.restore();
            });              // Draw annotation number and label
            if (canvasPolygon.length > 0) {
                const centerX = canvasPolygon.reduce((sum, p) => sum + p.x, 0) / canvasPolygon.length;
                const centerY = canvasPolygon.reduce((sum, p) => sum + p.y, 0) / canvasPolygon.length;
                
                // Position number above the polygon using bounds
                const annotationNumber = index + 1;
                const numberY = bounds.minY - 15; // Position above the polygon
                
                // Draw simple number text (no circle background)
                ctx.save();
                ctx.fillStyle = strokeColor;
                ctx.font = 'bold 12px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                // Add text background for better visibility
                const textMetrics = ctx.measureText(annotationNumber.toString());
                const padding = 3;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.fillRect(
                    centerX - textMetrics.width / 2 - padding,
                    numberY - 8,
                    textMetrics.width + padding * 2,
                    16
                );
                
                ctx.fillStyle = strokeColor;
                ctx.fillText(annotationNumber.toString(), centerX, numberY);
                ctx.restore();
                
                // Draw label below the number
                ctx.save();
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.font = '12px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                const labelMetrics = ctx.measureText(annotation.label);
                const labelPadding = 4;
                
                ctx.fillRect(
                    centerX - labelMetrics.width / 2 - labelPadding,
                    centerY + 5,
                    labelMetrics.width + labelPadding * 2,
                    16
                );
                
                ctx.fillStyle = 'white';
                ctx.fillText(annotation.label, centerX, centerY + 13);
                ctx.restore();
            }
                  // Draw editing border around the polygon to indicate edit mode
        if (window.canvasManager && window.canvasManager.isEditingPolygon && 
            window.canvasManager.editingAnnotationId === annotation.id) {
            ctx.save();
            ctx.strokeStyle = '#fbbf24'; // Yellow border for editing mode
            ctx.lineWidth = 3;
            ctx.setLineDash([10, 5]);
            ctx.shadowColor = 'rgba(251, 191, 36, 0.3)';
            ctx.shadowBlur = 3;
            ctx.beginPath();
            canvasPolygon.forEach((point, index) => {
                if (index === 0) {
                    ctx.moveTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            });
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
        }
        });
    }

    // Get summary statistics
    getStatistics() {
        return {
            total: this.annotations.length,
            ai_generated: this.annotations.filter(ann => ann.source === 'ai').length,
            manual: this.annotations.filter(ann => ann.source === 'manual').length,
            labels: [...new Set(this.annotations.map(ann => ann.label))],
            avg_points: this.annotations.length > 0 ? 
                Math.round(this.annotations.reduce((sum, ann) => sum + ann.polygon.length, 0) / this.annotations.length) : 0
        };
    }
}

// Export for global use
window.AnnotationManager = AnnotationManager;
