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
    }

    setCurrentImage(imageId) {
        this.currentImageId = imageId;
        this.annotations = [];
        this.selectedAnnotation = null;
        this.updateUI();
          // Load existing annotations for this image
        this.loadAnnotations(imageId);
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
                return result;
            });
            
            console.log(`Loaded ${this.annotations.length} annotations:`, this.annotations);
            this.updateUI();
        } catch (error) {
            console.error('Failed to load annotations:', error);
        }
    }

    addAnnotation(annotation) {
        this.annotations.push(annotation);
        this.updateUI();
        
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
    }

    selectAnnotation(id) {
        this.selectedAnnotation = id;
        this.updateUI();
        
        // Scroll annotation into view
        const element = document.querySelector(`[data-annotation-id="${id}"]`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    clearSelection() {
        this.selectedAnnotation = null;
        this.updateUI();
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
        }
        
        container.innerHTML = this.annotations.map(annotation => `
            <div class="annotation-item ${this.selectedAnnotation === annotation.id ? 'selected' : ''}" 
                 data-annotation-id="${annotation.id}">
                <div class="annotation-info">
                    <h4>${annotation.label}</h4>
                    <p>${annotation.source === 'ai' ? 'AI Generated' : 'Manual'} • ${annotation.polygon.length} points</p>
                </div>
                <div class="annotation-actions">
                    <button class="action-btn" onclick="annotationManager.editAnnotation('${annotation.id}')" title="Edit label">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn" onclick="annotationManager.deleteAnnotation('${annotation.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
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
            });
        } catch (error) {
            console.error('Failed to save annotation:', error);
        }
    }

    editAnnotation(id) {
        this.selectAnnotation(id);
        this.showLabelModal(id);
    }

    deleteAnnotation(id) {
        if (confirm('Are you sure you want to delete this annotation?')) {
            this.removeAnnotation(id);
            window.canvasManager.redraw();
            
            // Delete from backend if available
            this.deleteAnnotationFromBackend(id);
        }
    }

    async deleteAnnotationFromBackend(id) {
        try {
            await api.deleteAnnotation(id);
        } catch (error) {
            console.error('Failed to delete annotation from backend:', error);
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
    }

    exportAnnotations() {
        if (this.annotations.length === 0) {
            Utils.showToast('No annotations to export', 'warning');
            return;
        }
        
        const exportData = {
            image: {
                id: this.currentImageId,
                filename: window.canvasManager.currentImage?.file_name || 'unknown',
                resolution: window.canvasManager.currentImage?.resolution || 'unknown',
                width: window.canvasManager.imageElement?.naturalWidth || 0,
                height: window.canvasManager.imageElement?.naturalHeight || 0
            },
            annotations: this.annotations.map(ann => ({
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
                version: '1.0.0'
            },
            statistics: {
                total_annotations: this.annotations.length,
                ai_generated: this.annotations.filter(ann => ann.source === 'ai').length,
                manual: this.annotations.filter(ann => ann.source === 'manual').length,
                unique_labels: [...new Set(this.annotations.map(ann => ann.label))].length
            }
        };
        
        const filename = `annotations_${this.currentImageId}_${new Date().toISOString().split('T')[0]}.json`;
        Utils.downloadFile(JSON.stringify(exportData, null, 2), filename, 'application/json');
        
        Utils.showToast(`Exported ${this.annotations.length} annotations`, 'success');
    }    drawAnnotations(ctx, scale, offsetX, offsetY) {
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
            
            // Only update canvas polygon if it has actually changed to prevent unnecessary updates
            if (!annotation.canvasPolygon || 
                annotation.lastScale !== scale || 
                annotation.lastOffsetX !== offsetX || 
                annotation.lastOffsetY !== offsetY) {
                annotation.canvasPolygon = canvasPolygon;
                annotation.lastScale = scale;
                annotation.lastOffsetX = offsetX;
                annotation.lastOffsetY = offsetY;
            }
            
            // Determine colors based on selection and source
            let strokeColor = annotation.source === 'ai' ? '#10b981' : '#3b82f6';
            let fillColor = annotation.source === 'ai' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)';
            
            if (this.selectedAnnotation === annotation.id) {
                strokeColor = '#ef4444';
                fillColor = 'rgba(239, 68, 68, 0.3)';
            }            // Draw polygon fill (temporary fix - no DPR division)
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
            ctx.lineWidth = 2;            ctx.beginPath();
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
            });
              // Draw label
            if (canvasPolygon.length > 0) {
                const centerX = canvasPolygon.reduce((sum, p) => sum + p.x, 0) / canvasPolygon.length;
                const centerY = canvasPolygon.reduce((sum, p) => sum + p.y, 0) / canvasPolygon.length;
                
                ctx.save();
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.font = '12px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                const textMetrics = ctx.measureText(annotation.label);
                const padding = 4;
                
                ctx.fillRect(
                    centerX - textMetrics.width / 2 - padding,
                    centerY - 8,
                    textMetrics.width + padding * 2,
                    16
                );
                
                ctx.fillStyle = 'white';
                ctx.fillText(annotation.label, centerX, centerY);
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
