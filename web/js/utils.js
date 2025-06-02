// Utility functions for the SAT Annotator

class Utils {
    // Generate unique ID
    static generateId() {
        return 'id_' + Math.random().toString(36).substr(2, 9);
    }

    // Format file size
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Format date
    static formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString();
    }

    // Debounce function
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Throttle function
    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    }

    // Get mouse position relative to element
    static getMousePos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
        };
    }

    // Get touch position relative to element
    static getTouchPos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: evt.touches[0].clientX - rect.left,
            y: evt.touches[0].clientY - rect.top
        };
    }    // Convert canvas coordinates to image coordinates
    static canvasToImageCoords(canvasX, canvasY, imageWidth, imageHeight, canvasWidth, canvasHeight, scale, offsetX, offsetY) {
        // Validate inputs to prevent infinite loops
        if (!isFinite(canvasX) || !isFinite(canvasY) || !isFinite(scale) || !isFinite(offsetX) || !isFinite(offsetY) || scale <= 0) {
            console.warn('Invalid coordinates in canvasToImageCoords:', { canvasX, canvasY, scale, offsetX, offsetY });
            return { x: 0, y: 0 };
        }
        
        // Convert canvas coordinates to normalized image coordinates (0-1)
        // 1. Subtract the image offset within the canvas
        // 2. Scale down by the displayed image size to get normalized coordinates
        const x = (canvasX - offsetX) / (imageWidth * scale);
        const y = (canvasY - offsetY) / (imageHeight * scale);
        
        // Clamp to 0-1 range to ensure valid normalized coordinates
        return {
            x: Math.max(0, Math.min(1, x)),
            y: Math.max(0, Math.min(1, y))
        };
    }// Convert image coordinates to canvas coordinates
    static imageToCanvasCoords(imageX, imageY, imageWidth, imageHeight, scale, offsetX, offsetY) {
        // Validate inputs to prevent infinite loops
        if (!isFinite(imageX) || !isFinite(imageY) || !isFinite(scale) || !isFinite(offsetX) || !isFinite(offsetY) || scale <= 0) {
            console.warn('Invalid coordinates in imageToCanvasCoords:', { imageX, imageY, scale, offsetX, offsetY });
            return { x: 0, y: 0 };
        }
        
        // Convert normalized coordinates (0-1) to canvas coordinates
        // imageX and imageY are already normalized (0-1), so we need to:
        // 1. Scale them by the displayed image size
        // 2. Add the image offset within the canvas
        const x = (imageX * imageWidth * scale) + offsetX;
        const y = (imageY * imageHeight * scale) + offsetY;
        
        // Debug first few coordinate transformations
        if (Math.random() < 0.01) { // Log 1% of transformations to avoid spam
            console.log('Coordinate transform:', {
                input: { imageX, imageY },
                imageSize: { imageWidth, imageHeight },
                transform: { scale, offsetX, offsetY },
                output: { x, y }
            });
        }
        
        return { x, y };
    }

    // Calculate distance between two points
    static distance(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    // Check if point is inside polygon
    static pointInPolygon(point, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            if (((polygon[i].y > point.y) !== (polygon[j].y > point.y)) &&
                (point.x < (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
                inside = !inside;
            }
        }
        return inside;
    }

    // Deep clone object
    static deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    // Validate image file
    static isValidImageFile(file) {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/tif'];
        return validTypes.includes(file.type) || 
               file.name.toLowerCase().endsWith('.tiff') || 
               file.name.toLowerCase().endsWith('.tif') ||
               file.name.toLowerCase().endsWith('.geotiff');
    }

    // Download file
    static downloadFile(data, filename, type = 'application/json') {
        const blob = new Blob([data], { type });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }    // Show loading
    static showLoading(message = 'Processing...') {
        console.log('Utils.showLoading called with message:', message);
        const overlay = document.getElementById('loadingOverlay');
        const text = document.getElementById('loadingText');
        
        if (!overlay) {
            console.error('Loading overlay element not found!');
            return;
        }
        if (!text) {
            console.error('Loading text element not found!');
            return;
        }
        
        text.textContent = message;
        overlay.style.display = 'flex';
        overlay.hidden = false;
        console.log('Loading overlay shown successfully');
    }    // Hide loading
    static hideLoading() {
        console.log('Utils.hideLoading called');
        const overlay = document.getElementById('loadingOverlay');
        
        if (!overlay) {
            console.error('Loading overlay element not found when trying to hide!');
            return;
        }
        
        // Try multiple methods to ensure it's hidden
        overlay.style.display = 'none';
        overlay.style.visibility = 'hidden';
        overlay.style.opacity = '0';
        overlay.hidden = true;
        overlay.classList.add('hidden');
        
        // Debug: Check if it's actually hidden
        const computedStyle = window.getComputedStyle(overlay);
        console.log('Loading overlay hidden successfully');
        console.log('Overlay display style:', overlay.style.display);
        console.log('Overlay hidden attribute:', overlay.hidden);
        console.log('Computed display:', computedStyle.display);
        console.log('Computed visibility:', computedStyle.visibility);
        console.log('Computed opacity:', computedStyle.opacity);
    }

    // Show toast notification
    static showToast(message, type = 'success', duration = 3000) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => {
                if (container.contains(toast)) {
                    container.removeChild(toast);
                }
            }, 300);
        }, duration);
    }

    // Clamp value between min and max
    static clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    // Linear interpolation
    static lerp(start, end, factor) {
        return start + (end - start) * factor;
    }

    // Get file extension
    static getFileExtension(filename) {
        return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
    }

    // Create element with attributes
    static createElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);
        
        Object.keys(attributes).forEach(key => {
            if (key === 'className') {
                element.className = attributes[key];
            } else if (key === 'innerHTML') {
                element.innerHTML = attributes[key];
            } else {
                element.setAttribute(key, attributes[key]);
            }
        });
        
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else {
                element.appendChild(child);
            }
        });
        
        return element;
    }

    // Wait for condition
    static async waitFor(condition, timeout = 5000, interval = 100) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const check = () => {
                if (condition()) {
                    resolve();
                } else if (Date.now() - startTime >= timeout) {
                    reject(new Error('Timeout waiting for condition'));
                } else {
                    setTimeout(check, interval);
                }
            };
            
            check();
        });
    }
}

// Add CSS for slideOut animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Export for use in other modules
window.Utils = Utils;
