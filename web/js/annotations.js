// Annotation management for SAT Annotator

class AnnotationManager {    constructor() {
        this.annotations = [];
        this.selectedAnnotation = null;
        this.currentImageId = null;
        this.currentLabel = 'building'; // Default label
        this.customLabels = []; // Store custom labels added by user
        this.currentEditingAnnotationId = null; // Track which annotation is being edited
        
        try {
            this.setupEventListeners();
            this.updateUI();
        } catch (error) {
            console.error('AnnotationManager: Initialization failed:', error);
        }
    }    setupEventListeners() {
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
        document.addEventListener('click', () => this.hideContextMenu());        // Export Modal Events
        const closeExportModal = document.getElementById('closeExportModal');
        const cancelExport = document.getElementById('cancelExport');
        const confirmExport = document.getElementById('confirmExport');
        
        if (closeExportModal) {
            closeExportModal.addEventListener('click', () => this.closeExportModal());
        }
        if (cancelExport) {
            cancelExport.addEventListener('click', () => this.closeExportModal());
        }
        if (confirmExport) {
            confirmExport.addEventListener('click', () => this.performExport());
        }
        
        // Export option selection handlers will be added dynamically in showExportModal

        // Edit Label Modal Events
        document.getElementById('closeEditModal').addEventListener('click', () => this.closeEditLabelModal());
        document.getElementById('cancelEditLabel').addEventListener('click', () => this.closeEditLabelModal());
        document.getElementById('saveEditLabel').addEventListener('click', () => this.saveEditedLabel());
        
        // Handle dropdown selection change
        document.getElementById('labelSelect').addEventListener('change', (e) => {
            const customInput = document.getElementById('customLabelEdit');
            if (e.target.value === '__new__') {
                customInput.focus();
            } else {
                customInput.value = '';
            }
        });
        
        // Handle adding new label from modal
        document.getElementById('addNewLabelBtn').addEventListener('click', () => {
            const input = document.getElementById('customLabelEdit');
            const label = input.value.trim().toLowerCase();
            if (label) {
                document.getElementById('labelSelect').value = '__new__';
            }
        });
        
        // Handle Enter key in custom label input
        document.getElementById('customLabelEdit').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.saveEditedLabel();
            }
        });          // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const editModal = document.getElementById('editLabelModal');
                const exportModal = document.getElementById('exportModal');
                
                // Check if export modal is visible and open
                if (exportModal && exportModal.classList.contains('show')) {
                    e.preventDefault();
                    this.closeExportModal();
                    return;
                }
                
                // Check if edit modal is visible and open
                if (editModal && editModal.classList.contains('show')) {
                    e.preventDefault();
                    this.closeEditLabelModal();
                    return;
                }
            }
        });
    }    async setCurrentImage(imageId) {
        console.log(`setCurrentImage called with: ${imageId}`);
        console.log(`Previous currentImageId: ${this.currentImageId}`);
        
        // Save any existing annotations for the current image before switching
        if (this.currentImageId && this.annotations.length > 0) {
            try {
                await Promise.all(
                    this.annotations.map(ann => this.saveAnnotation(ann.id))
                );
            } catch (error) {
                console.error('Failed to save some annotations before switching images:', error);
            }
        }
        
        this.currentImageId = imageId;
        console.log(`currentImageId set to: ${this.currentImageId}`);
        this.annotations = [];
        this.selectedAnnotation = null;
        this.updateUI();
          // Load existing annotations for this image
        await this.loadAnnotations(imageId);
          // Clear any cached canvas polygons to force recalculation for new image
        this.annotations.forEach(annotation => {
            annotation.canvasPolygon = null;
            annotation.lastScale = null;
            annotation.lastOffsetX = null;
            annotation.lastOffsetY = null;
            annotation.lastImageId = null;
        });
        
        // Force a redraw to ensure annotations are visible immediately
        if (window.canvasManager && window.canvasManager.imageElement) {
            // Multiple redraws with short delays to ensure annotations appear
            setTimeout(() => window.canvasManager.redraw(), 10);
            setTimeout(() => window.canvasManager.redraw(), 100);
            setTimeout(() => window.canvasManager.redraw(), 200);
        }
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
            <i class="fas fa-times remove-label" onclick="event.stopPropagation(); window.annotationManager.removeCustomLabel('${label}')"></i>
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
            
            this.annotations = annotations.map((ann, index) => {
                // Parse polygon from backend format
                let polygon = [];
                let label = 'Unlabeled';
                let type = 'unknown';
                
                try {
                    if (ann.data && ann.data.features && ann.data.features.length > 0) {
                        const feature = ann.data.features[0];
                        
                        // Extract label from properties
                        if (feature.properties) {
                            label = feature.properties.label || feature.properties.class_name || 'Unlabeled';
                            type = feature.properties.type || 'polygon';                        }
                        
                        // Extract polygon coordinates from JSON
                        if (feature.geometry && feature.geometry.type === 'Polygon') {
                            const coordinates = feature.geometry.coordinates[0]; // First ring of polygon
                            polygon = coordinates.map(coord => [coord[0], coord[1]]);
                        }
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
                    <div class="annotation-actions">                        <button class="action-btn" onclick="window.annotationManager.editPolygon('${annotation.id}')" title="Edit polygon">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${annotation.originalPolygon ? `<button class="action-btn" onclick="window.annotationManager.resimplifyPolygon('${annotation.id}')" title="Re-simplify with current settings">
                            <i class="fas fa-compress"></i>
                        </button>` : ''}
                        <button class="action-btn" onclick="window.annotationManager.editAnnotation('${annotation.id}')" title="Edit label">
                            <i class="fas fa-tag"></i>
                        </button>
                        <button class="action-btn" onclick="window.annotationManager.deleteAnnotation('${annotation.id}')" title="Delete">
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
        console.log('editAnnotation called with ID:', id);
        const annotation = this.annotations.find(ann => ann.id === id);
        if (!annotation) {
            console.error('Annotation not found with ID:', id);
            return;
        }
        
        console.log('Found annotation:', annotation);
        this.currentEditingAnnotationId = id;
        this.showEditLabelModal(annotation.label);
    }

    editPolygon(id) {
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
    }    showEditLabelModal(currentLabel) {
        console.log('showEditLabelModal called with label:', currentLabel);
        const modal = document.getElementById('editLabelModal');
        const labelSelect = document.getElementById('labelSelect');
        const customLabelInput = document.getElementById('customLabelEdit');
        
        if (!modal) {
            console.error('Modal element not found!');
            return;
        }
        
        if (!labelSelect) {
            console.error('Label select element not found!');
            return;
        }
        
        if (!customLabelInput) {
            console.error('Custom label input element not found!');
            return;
        }
        
        console.log('Modal element found, proceeding...');
        
        // Clear previous content
        labelSelect.innerHTML = '';
        customLabelInput.value = '';
        
        // Populate dropdown with all available labels
        this.populateLabelDropdown(labelSelect, currentLabel);
          // Show modal
        console.log('Adding show class to modal');
        modal.classList.add('show');
        console.log('Modal should now be visible');
    }

    populateLabelDropdown(selectElement, currentLabel) {
        // Get all available labels (default + custom)
        const defaultLabels = ['building', 'road', 'vegetation', 'water', 'parking'];
        const allLabels = [...new Set([...defaultLabels, ...this.customLabels])];
        
        // Add options to select
        allLabels.forEach(label => {
            const option = document.createElement('option');
            option.value = label;
            option.textContent = label.charAt(0).toUpperCase() + label.slice(1);
            
            if (label === currentLabel) {
                option.selected = true;
            }
            
            selectElement.appendChild(option);
        });
        
        // Add option for creating new label
        const newOption = document.createElement('option');
        newOption.value = '__new__';
        newOption.textContent = '+ Add new label...';
        selectElement.appendChild(newOption);
    }

    populateSuggestedLabels(container, currentLabel) {
        // Get unique labels from existing annotations
        const existingLabels = [...new Set(this.annotations.map(ann => ann.label))]
            .filter(label => label !== currentLabel)
            .slice(0, 6); // Limit to 6 suggestions
        
        existingLabels.forEach(label => {
            const suggestion = document.createElement('div');
            suggestion.className = 'label-suggestion';
            suggestion.textContent = label;
            suggestion.addEventListener('click', () => {
                document.getElementById('labelSelect').value = label;
            });
            container.appendChild(suggestion);
        });
    }    closeEditLabelModal() {
        const modal = document.getElementById('editLabelModal');
        modal.classList.remove('show');
        this.currentEditingAnnotationId = null;
    }

    saveEditedLabel() {
        const labelSelect = document.getElementById('labelSelect');
        const customLabelInput = document.getElementById('customLabelEdit');
        
        let newLabel = '';
        
        if (labelSelect.value === '__new__') {
            // User selected "Add new label"
            newLabel = customLabelInput.value.trim().toLowerCase();
            if (!newLabel) {
                Utils.showToast('Please enter a label name', 'warning');
                customLabelInput.focus();
                return;
            }
        } else {
            newLabel = labelSelect.value;
        }
        
        if (!newLabel) {
            Utils.showToast('Please select or enter a label', 'warning');
            return;
        }
        
        // Add to custom labels if it's new
        if (!this.customLabels.includes(newLabel) && 
            !['building', 'road', 'vegetation', 'water', 'parking'].includes(newLabel)) {
            this.customLabels.push(newLabel);
            this.createCustomLabelButton(newLabel);
        }
          // Update annotation
        const annotation = this.annotations.find(ann => ann.id === this.currentEditingAnnotationId);
        if (annotation && annotation.label !== newLabel) {
            this.updateAnnotation(this.currentEditingAnnotationId, { label: newLabel });
            this.saveAnnotation(this.currentEditingAnnotationId);
            
            // Redraw canvas to update label display immediately
            if (window.canvasManager) {
                window.canvasManager.redraw();
            }
            
            Utils.showToast(`Label changed to "${newLabel}"`, 'success');
        }
        
        this.closeEditLabelModal();
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
                console.log('Annotation deleted from backend:', id);
                
                // Only remove from frontend if backend deletion succeeds
                this.removeAnnotation(id);
                window.canvasManager.redraw();
                console.log('Annotation cleanup completed for ID:', id);
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
        // Show the export modal instead of directly exporting
        this.showExportModal();
    }    showExportModal() {
        const modal = document.getElementById('exportModal');
        if (!modal) {
            console.error('Export modal not found!');
            return;
        }
        
        // Remove any existing event listeners to prevent duplicates
        const existingScopeOptions = modal.querySelectorAll('.export-scope-option');
        const existingFormatOptions = modal.querySelectorAll('.export-format-option');
        
        // Clone and replace scope options to remove old listeners
        existingScopeOptions.forEach(option => {
            const newOption = option.cloneNode(true);
            option.parentNode.replaceChild(newOption, option);
        });
        
        // Clone and replace format options to remove old listeners
        existingFormatOptions.forEach(option => {
            const newOption = option.cloneNode(true);
            option.parentNode.replaceChild(newOption, option);
        });
        
        // Add fresh click listeners to export scope options
        const scopeOptions = modal.querySelectorAll('.export-scope-option');
        scopeOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                const radio = option.querySelector('input[type="radio"]');
                if (radio) {
                    radio.checked = true;
                    this.updateExportScopeSelection();
                }
            });
        });
        
        // Add fresh click listeners to export format options
        const formatOptions = modal.querySelectorAll('.export-format-option');
        formatOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                const radio = option.querySelector('input[type="radio"]');
                if (radio) {
                    radio.checked = true;
                    this.updateExportFormatSelection();
                }
            });
        });
        
        // Add change listeners to radio buttons
        const radioButtons = modal.querySelectorAll('input[type="radio"]');
        radioButtons.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.name === 'exportScope') {
                    this.updateExportScopeSelection();
                } else if (radio.name === 'exportFormat') {
                    this.updateExportFormatSelection();
                }
            });
        });
        
        // Update selection visual state
        this.updateExportScopeSelection();
        this.updateExportFormatSelection();        // Show modal
        modal.classList.add('show');
        modal.removeAttribute('hidden');
        
        // Focus on the modal for keyboard accessibility and ESC key handling
        modal.setAttribute('tabindex', '-1');
        modal.focus();
        
        // Add dedicated ESC key handler for this modal
        const handleModalKeydown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.closeExportModal();
                modal.removeEventListener('keydown', handleModalKeydown);
            }
        };
        modal.addEventListener('keydown', handleModalKeydown);
    }closeExportModal() {
        const modal = document.getElementById('exportModal');
        if (modal) {
            modal.classList.remove('show');
            modal.setAttribute('hidden', 'true');
        }
    }updateExportScopeSelection() {
        // Update visual selection for scope options
        const scopeOptions = document.querySelectorAll('#exportModal .export-scope-option');
        scopeOptions.forEach(option => {
            const radio = option.querySelector('input[type="radio"]');
            if (radio) {
                if (radio.checked) {
                    option.classList.add('selected');
                } else {
                    option.classList.remove('selected');
                }
            }
        });
    }

    updateExportFormatSelection() {
        // Update visual selection for format options
        const formatOptions = document.querySelectorAll('#exportModal .export-format-option');
        formatOptions.forEach(option => {
            const radio = option.querySelector('input[type="radio"]');
            if (radio) {
                if (radio.checked) {
                    option.classList.add('selected');
                } else {
                    option.classList.remove('selected');
                }
            }
        });
    }

    async performExport() {
        const scopeRadio = document.querySelector('input[name="exportScope"]:checked');
        const formatRadio = document.querySelector('input[name="exportFormat"]:checked');
        
        if (!scopeRadio || !formatRadio) {
            Utils.showToast('Please select export options', 'warning');
            return;
        }

        const scope = scopeRadio.value; // 'current' or 'all'
        const format = formatRadio.value; // 'json' or 'csv'

        this.closeExportModal();

        if (scope === 'all') {
            await this.exportAllImages(format);
        } else {
            await this.exportCurrentImage(format);
        }
    }

    async exportCurrentImage(format = 'json') {
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
            },
            annotations: this.annotations.map((ann, index) => ({
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
                format: format,
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

        if (format === 'csv') {
            this.downloadCSV(exportData, `annotations_${this.currentImageId}.csv`);
        } else {
            this.downloadJSON(exportData, `annotations_${this.currentImageId}.json`);
        }
        
        Utils.showToast(`Exported ${this.annotations.length} annotations for current image as ${format.toUpperCase()}`, 'success');
    }

    async exportAllImages(format = 'json') {
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
            }

            const exportData = {
                images: imageData,
                annotations: allAnnotations.map((ann, index) => ({
                    number: index + 1,
                    ...ann
                })),
                export_info: {
                    format: format,
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

            const filename = `annotations_all_images_${new Date().toISOString().split('T')[0]}`;
            
            if (format === 'csv') {
                this.downloadCSV(exportData, `${filename}.csv`);
            } else {
                this.downloadJSON(exportData, `${filename}.json`);
            }
            
            Utils.showToast(`Exported ${totalAnnotations} annotations from ${imageData.length} images as ${format.toUpperCase()}`, 'success');

        } catch (error) {
            Utils.hideLoading();
            console.error('Failed to export all annotations:', error);
            Utils.showToast('Failed to export all annotations: ' + error.message, 'error');
        }
    }

    downloadCSV(data, filename) {
        let csvContent = '';
        
        if (data.export_info.scope === 'all_images') {
            // CSV headers for all images export
            csvContent = 'Number,ID,Image ID,Image Filename,Type,Label,Source,Created,Points Count,Polygon Coordinates\n';
            
            // Add data rows
            data.annotations.forEach(ann => {
                const polygonStr = ann.polygon.map(point => `${point[0]},${point[1]}`).join(';');
                csvContent += `${ann.number},"${ann.id}","${ann.image_id}","${ann.image_filename}","${ann.type}","${ann.label}","${ann.source}","${ann.created}",${ann.points_count},"${polygonStr}"\n`;
            });
        } else {
            // CSV headers for single image export
            csvContent = 'Number,ID,Type,Label,Source,Created,Points Count,Polygon Coordinates\n';
            
            // Add data rows
            data.annotations.forEach(ann => {
                const polygonStr = ann.polygon.map(point => `${point[0]},${point[1]}`).join(';');
                csvContent += `${ann.number},"${ann.id}","${ann.type}","${ann.label}","${ann.source}","${ann.created}",${ann.points_count},"${polygonStr}"\n`;
            });
        }
        
        // Add metadata as comments (if desired)
        const metadata = `# Exported from SAT Annotator on ${data.export_info.exported_at}\n` +
                        `# Total annotations: ${data.statistics.total_annotations}\n` +
                        `# AI generated: ${data.statistics.ai_generated}\n` +
                        `# Manual: ${data.statistics.manual}\n` +
                        `# Unique labels: ${data.statistics.unique_labels}\n\n`;
        
        csvContent = metadata + csvContent;
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
    }downloadJSON(data, filename) {
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
        // Removed excessive logging for performance
        
        // Note: Canvas context is already DPR-scaled by canvas manager
        // so we should NOT divide by DPR again
          this.annotations.forEach((annotation, index) => {
            if (!annotation.polygon || annotation.polygon.length < 3) {
                return;
            }
            
            // Safety check: ensure we have the correct image loaded
            if (!window.canvasManager.imageElement || !window.canvasManager.currentImage) {
                return;
            }            // Critical fix: ensure annotations are only drawn for the current image
            console.log(`Checking image match - currentImageId: ${this.currentImageId}, canvas image: ${window.canvasManager.currentImage?.image_id}`);
            if (window.canvasManager.currentImage.image_id !== this.currentImageId) {
                console.warn(`Canvas image mismatch: expected ${this.currentImageId}, got ${window.canvasManager.currentImage.image_id}. Synchronizing...`);
                // CRITICAL FIX: Prevent infinite sync loops - only sync once
                if (this.currentImageId !== null && !this._syncInProgress) {
                    this._syncInProgress = true;
                    setTimeout(() => {
                        this.setCurrentImage(window.canvasManager.currentImage.image_id);
                        this._syncInProgress = false;
                    }, 0);
                    return;                } else {
                    // If currentImageId is null or sync in progress, just set it without reloading annotations
                    console.log('Setting currentImageId without reloading annotations');
                    this.currentImageId = window.canvasManager.currentImage.image_id;
                }
            }
              // Convert image coordinates to canvas coordinates
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
            
            // Quick visibility check to skip offscreen annotations
            const bounds = {
                minX: Math.min(...canvasPolygon.map(p => p.x)),
                maxX: Math.max(...canvasPolygon.map(p => p.x)),
                minY: Math.min(...canvasPolygon.map(p => p.y)),
                maxY: Math.max(...canvasPolygon.map(p => p.y))
            };
            
            const canvasBounds = window.canvasManager.getDisplayDimensions();
            const isVisible = bounds.maxX >= -50 && bounds.minX <= canvasBounds.width + 50 && 
                             bounds.maxY >= -50 && bounds.minY <= canvasBounds.height + 50;
            
            if (!isVisible) return; // Skip offscreen annotations            // Only update canvas polygon if it has actually changed and we're not dragging
            // Force recalculation if canvasPolygon is null (e.g., after image switch)
            // Also recalculate if the current image has changed
            const imageId = window.canvasManager.currentImage ? window.canvasManager.currentImage.image_id : null;
            const imageChanged = annotation.lastImageId !== imageId;
            
            if (!annotation.isDragging && 
                (!annotation.canvasPolygon || 
                annotation.lastScale !== scale || 
                annotation.lastOffsetX !== offsetX || 
                annotation.lastOffsetY !== offsetY ||
                imageChanged)) {
                annotation.canvasPolygon = canvasPolygon;
                annotation.lastScale = scale;
                annotation.lastOffsetX = offsetX;
                annotation.lastOffsetY = offsetY;
                annotation.lastImageId = imageId;
            } else if (!annotation.isDragging && !annotation.canvasPolygon) {
                // Ensure we have a canvas polygon even if not dragging
                annotation.canvasPolygon = canvasPolygon;
                annotation.lastScale = scale;
                annotation.lastOffsetX = offsetX;
                annotation.lastOffsetY = offsetY;
                annotation.lastImageId = imageId;
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
            }// Draw polygon fill (optimized - no excessive logging)
            ctx.save();
            ctx.fillStyle = fillColor;
            ctx.beginPath();
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
              // Draw polygon outline (optimized - no excessive logging)
            ctx.save();
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = lineWidth;
            
            // Apply dash pattern if provided
            if (dashPattern.length > 0) {
                ctx.setLineDash(dashPattern);
            }
            
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
