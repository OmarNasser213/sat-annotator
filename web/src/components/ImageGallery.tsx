import { useState, useEffect } from 'react';
import { api, Image } from '../services/api';

// Set the backend URL for image serving
const BACKEND_URL = 'http://localhost:8000';

interface ImageGalleryProps {
  onSelectImage: (imageId: number) => void;
}

export const ImageGallery = ({ onSelectImage }: ImageGalleryProps) => {
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        setLoading(true);
        const imageData = await api.getImages();
        setImages(imageData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, []);

  if (loading) {
    return <div className="p-4 text-center">Loading images...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-600">Error: {error}</div>;
  }

  if (images.length === 0) {
    return (
      <div className="p-4 text-center">
        No images found. Please upload images through the API first.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {images.map((image) => {
        // Extract filename from file_path - handle both absolute and relative paths
        const filename = image.file_path.split('/').pop();
        const imageUrl = `${BACKEND_URL}/uploads/${filename}`;
        
        return (
          <div 
            key={image.image_id} 
            className="border rounded overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => onSelectImage(image.image_id)}
          >
            <div className="h-40 bg-gray-100 flex items-center justify-center overflow-hidden">
              <img 
                src={imageUrl}
                alt={image.file_name}
                className="object-cover w-full h-full"
                onError={(e) => {
                  // If image fails to load, show a placeholder
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300x200?text=Image+Not+Available';
                }}
              />
            </div>
            <div className="p-3">
              <h3 className="font-semibold truncate">{image.file_name}</h3>
              <p className="text-sm text-gray-500">ID: {image.image_id}</p>
              {image.resolution && (
                <p className="text-xs text-gray-400">{image.resolution}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};