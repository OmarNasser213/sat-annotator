// API communication layer for SAT Annotator

class API {    
    constructor() {
        // Check if we're in development mode and redirect to backend
        const isDevelopment = window.location.port === '8080' || window.location.port === '3000';
        this.baseURL = isDevelopment ? 'http://localhost:8000' : window.location.origin;
        this.sessionId = null;
    }

    // Generic request method
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const requestOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers,
            },
        };

        try {
            const response = await fetch(url, requestOptions);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return response;
            }
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }    

    // Clear current session and start fresh
    async clearSession() {
        try {
            // Call backend to clear session data
            await this.delete('/api/session/');
            console.log('Backend session cleared');
            
            // Also clear the frontend session cookie
            document.cookie = `sat_annotator_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            console.log('Frontend session cookie cleared');
            
            // Reset session ID
            this.sessionId = null;
        } catch (error) {
            console.warn('Could not clear session:', error);
            // Even if backend call fails, clear the cookie
            document.cookie = `sat_annotator_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            this.sessionId = null;
        }
    }

    // GET request
    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    // POST request
    async post(endpoint, data = {}) {
        return this.request(endpoint, { 
            method: 'POST', 
            body: JSON.stringify(data) 
        });
    }

    // DELETE request
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    // Upload file
    async uploadFile(endpoint, file, onProgress = null) {
        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        
        return new Promise((resolve, reject) => {
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && onProgress) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    onProgress(percentComplete);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (error) {
                        resolve(xhr.responseText);
                    }
                } else {
                    try {
                        const errorData = JSON.parse(xhr.responseText);
                        reject(new Error(errorData.detail || `HTTP error! status: ${xhr.status}`));
                    } catch (error) {
                        reject(new Error(`HTTP error! status: ${xhr.status}`));
                    }
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Upload failed'));
            });

            xhr.open('POST', `${this.baseURL}${endpoint}`);
            xhr.send(formData);
        });
    }

    // Health check
    async healthCheck() {
        try {
            const response = await this.get('/health');
            return response.status === 'healthy';
        } catch (error) {
            console.error('Health check failed:', error);
            return false;
        }
    }    

    // Upload image
    async uploadImage(file, onProgress = null, showLoading = true) {
        try {
            if (showLoading) {
                Utils.showLoading('Uploading image...');
            }
            const response = await this.uploadFile('/api/upload-image/', file, onProgress);
            if (showLoading) {
                Utils.hideLoading();
            }
            
            if (response.success) {
                if (showLoading) {
                    Utils.showToast('Image uploaded successfully!', 'success');
                }
                return response.image;
            } else {
                throw new Error(response.message || 'Upload failed');
            }
        } catch (error) {
            if (showLoading) {
                Utils.hideLoading();
                Utils.showToast(`Upload failed: ${error.message}`, 'error');
            }
            throw error;
        }
    }

    // Get all images
    async getImages() {
        try {
            console.log('API: Starting getImages call...');
            const images = await this.get('/api/images/');
            console.log('API: getImages response:', images);
            return Array.isArray(images) ? images : [];
        } catch (error) {
            console.error('API: Failed to fetch images:', error);
            Utils.showToast(`Failed to load images: ${error.message}`, 'error');
            return [];
        }
    }

    // Get image by ID
    async getImage(imageId) {
        try {
            return await this.get(`/api/images/${imageId}`);
        } catch (error) {
            console.error('Failed to fetch image:', error);
            throw error;
        }
    }    // Delete an image from the server
    async deleteImage(imageId) {
        try {
            console.log(`Deleting image with ID: ${imageId}`);
            const response = await this.delete(`/api/images/${imageId}`);
            
            if (!response || !response.success) {
                const errorMsg = response?.message || 'Unknown error';
                console.error(`Image deletion failed: ${errorMsg}`);
                throw new Error(errorMsg);
            }
            
            console.log('Image deletion successful:', response);
            return response;
        } catch (error) {
            console.error('Failed to delete image:', error);
            throw error;
        }
    }

    // Perform AI segmentation
    async segment(imageId, x, y) {
        try {
            Utils.showLoading('Generating AI segmentation...');
            const response = await this.post('/api/segment/', {
                image_id: imageId,
                x: x,
                y: y
            });
            Utils.hideLoading();

            if (response.success) {
                Utils.showToast('AI segmentation generated!', 'success');
                return {
                    polygon: response.polygon,
                    annotationId: response.annotation_id,
                    cached: response.cached || false
                };
            } else {
                throw new Error('Segmentation failed');
            }
        } catch (error) {
            Utils.hideLoading();
            Utils.showToast(`AI segmentation failed: ${error.message}`, 'error');
            throw error;
        }
    }

    // Get image URL for display
    getImageUrl(imagePath) {
        if (imagePath.startsWith('http')) {
            return imagePath;
        }
        return `${this.baseURL}/${imagePath}`;
    }

    // Download annotations
    async downloadAnnotations(imageId, format = 'json') {
        try {
            const response = await this.get(`/api/annotations/${imageId}/export?format=${format}`);
            return response;
        } catch (error) {
            console.error('Failed to download annotations:', error);
            throw error;
        }
    }

    // Save manual annotation
    async saveAnnotation(imageId, annotation) {
        try {
            const response = await this.post('/api/annotations/', {
                image_id: imageId,
                ...annotation
            });
            
            if (response.success) {
                Utils.showToast('Annotation saved!', 'success');
                return response;
            } else {
                throw new Error(response.message || 'Failed to save annotation');
            }
        } catch (error) {
            Utils.showToast(`Failed to save annotation: ${error.message}`, 'error');
            throw error;
        }
    }

    // Delete annotation
    async deleteAnnotation(annotationId) {
        try {
            const response = await this.request(`/api/annotations/${annotationId}`, {
                method: 'DELETE'
            });
            
            Utils.showToast('Annotation deleted!', 'success');
            return response;
        } catch (error) {
            Utils.showToast(`Failed to delete annotation: ${error.message}`, 'error');
            throw error;
        }
    }

    // Update annotation
    async updateAnnotation(annotationId, updates) {
        try {
            const response = await this.request(`/api/annotations/${annotationId}`, {
                method: 'PUT',
                body: JSON.stringify(updates)
            });
            
            Utils.showToast('Annotation updated!', 'success');
            return response;
        } catch (error) {
            Utils.showToast(`Failed to update annotation: ${error.message}`, 'error');
            throw error;
        }
    }

    // Get annotations for image
    async getAnnotations(imageId) {
        try {
            const annotations = await this.get(`/api/annotations/${imageId}`);
            return Array.isArray(annotations) ? annotations : [];
        } catch (error) {
            console.error('Failed to fetch annotations:', error);
            return [];
        }
    }    

    // Check server status
    async checkStatus() {
        try {
            const response = await this.get('/');
            return response.message.includes('Satellite Image Annotation Tool');
        } catch (error) {
            console.error('Server status check failed:', error);
            return false;
        }
    }
}

// Create global API instance
window.api = new API();
