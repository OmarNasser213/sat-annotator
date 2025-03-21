// Types
export interface Image {
  image_id: number;
  file_name: string;
  file_path: string;
  resolution?: string;
  source?: string;
  capture_date: string;
  created_at: string;
}

export interface SegmentationRequest {
  image_id: number;
  x: number;
  y: number;
}

export interface SegmentationResponse {
  success: boolean;
  polygon: number[][];
  annotation_id?: number;
}

// API URL configuration
const API_URL = 'http://localhost:8000/api';

// API methods
export const api = {
  // Fetch all images
  async getImages(): Promise<Image[]> {
    const response = await fetch(`${API_URL}/images/`);
    if (!response.ok) {
      throw new Error(`Error fetching images: ${response.statusText}`);
    }
    return response.json();
  },

  // Fetch a single image by ID
  async getImage(id: number): Promise<Image> {
    const response = await fetch(`${API_URL}/images/${id}/`);
    if (!response.ok) {
      throw new Error(`Error fetching image ${id}: ${response.statusText}`);
    }
    return response.json();
  },

  // Create segmentation from a point
  async segmentFromPoint(request: SegmentationRequest): Promise<SegmentationResponse> {
    const response = await fetch(`${API_URL}/segment/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `Error creating segmentation: ${response.statusText}`);
    }
    
    return response.json();
  }
};