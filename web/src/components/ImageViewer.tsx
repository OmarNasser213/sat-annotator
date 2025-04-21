import { useState, useRef, useEffect } from 'react';
import { api, SegmentationResponse, API_BASE_URL } from '../services/api';
import type { Image } from '../services/api';

interface ImageViewerProps {
  imageId: string;  // Changed from number to string for UUID-based IDs
}

export const ImageViewer = ({ imageId }: ImageViewerProps) => {
  const [image, setImage] = useState<Image | null>(null);
  const [segmentation, setSegmentation] = useState<SegmentationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [hasSegmented, setHasSegmented] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  
  // Load the image data
  useEffect(() => {
    const fetchImage = async () => {
      try {
        setLoading(true);
        setError(null);
        const imageData = await api.getImage(imageId);
        setImage(imageData);
        // Reset segmentation state for new image
        setSegmentation(null);
        setHasSegmented(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };
    
    fetchImage();
  }, [imageId]);
  
  // Handle canvas click for segmentation
  const handleCanvasClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !image) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate normalized coordinates (0 to 1)
    const x = (e.clientX - rect.left) / canvas.width;
    const y = (e.clientY - rect.top) / canvas.height;
    
    try {
      setLoading(true);
      setError(null);
      setStatusMessage(hasSegmented ? 
        'Getting segmentation from cache...' : 
        'Processing image (first click takes longer)...'
      );
      
      const segResponse = await api.segmentFromPoint({
        image_id: imageId,
        x,
        y
      });
      
      setSegmentation(segResponse);
      
      // Update message based on whether result was from cache
      if (segResponse.cached) {
        setStatusMessage('Retrieved segmentation from cache');
      } else {
        setStatusMessage('Image segmented successfully');
        setHasSegmented(true);  // Mark that we've segmented this image once
      }
      
      // Clear status message after 3 seconds
      setTimeout(() => {
        setStatusMessage(null);
      }, 3000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };
  
  // Draw the image and segmentation on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !image) return;
    
    // Create a new image element
    const img = new Image();
    imageRef.current = img;
    
    img.onload = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Set canvas dimensions to match image
      if (img.width > 0 && img.height > 0) {
        canvas.width = img.width;
        canvas.height = img.height;
      }
      
      // Draw the image
      ctx.drawImage(img, 0, 0);
      
      // Draw segmentation polygon if available
      if (segmentation && segmentation.polygon.length > 0) {
        ctx.beginPath();
        const start = segmentation.polygon[0];
        ctx.moveTo(start[0], start[1]);
        
        for (let i = 1; i < segmentation.polygon.length; i++) {
          const point = segmentation.polygon[i];
          ctx.lineTo(point[0], point[1]);
        }
        
        ctx.closePath();
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Fill with semi-transparent color
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.fill();
      }
    };
      // Extract filename from file_path - handle both absolute and relative paths
    const filename = image.file_path.split('/').pop();
    // Use relative URL instead of hardcoded localhost
    img.src = `/api/uploads/${filename}`;
    img.crossOrigin = "Anonymous"; // Needed for CORS if your API is on a different domain
    
    img.onerror = () => {
      setError("Failed to load image. Make sure the backend is running and serving images correctly.");
      console.error("Image failed to load:", img.src);
    };
    
  }, [image, segmentation]);
  
  if (loading && !image) return <div className="text-center p-4">Loading image...</div>;
  
  if (error) {
    return (
      <div className="text-center p-4 text-red-600">
        Error: {error}
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative border border-gray-300 rounded">
        <canvas 
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="cursor-crosshair"
          style={{ maxWidth: '100%', minHeight: '400px' }}
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
            <div className="text-white">{hasSegmented ? 'Processing...' : 'Segmenting image (first click may take longer)...'}</div>
          </div>
        )}
      </div>
      
      {statusMessage && (
        <div className={`text-sm ${segmentation?.cached ? 'text-green-600' : 'text-blue-600'} font-medium`}>
          {statusMessage}
        </div>
      )}
      
      <div className="text-sm text-gray-600">
        Click anywhere on the image to generate segmentation
        {hasSegmented && (
          <span className="ml-1 text-green-600">(subsequent clicks will use cached results)</span>
        )}
      </div>
      
      {segmentation && (
        <div className="bg-gray-100 p-4 rounded w-full max-w-xl">
          <h3 className="font-bold mb-2">Segmentation Results:</h3>
          <div className="text-sm">
            <p>Annotation ID: {segmentation.annotation_id}</p>
            <p>Polygon points: {segmentation.polygon.length}</p>
            {segmentation.cached && (
              <p className="text-green-600 font-medium">Result retrieved from cache</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};