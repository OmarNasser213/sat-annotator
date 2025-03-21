import { useState } from 'react'
import './App.css'
import { ImageGallery } from './components/ImageGallery'
import { ImageViewer } from './components/ImageViewer'

function App() {
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
  
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-4">Satellite Image Annotator</h1>
        <p className="text-gray-600">
          Select an image to view and segment using AI-powered tools
        </p>
      </header>
      
      {selectedImageId ? (
        <div className="mb-8">
          <button
            onClick={() => setSelectedImageId(null)}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4"
          >
            ← Back to Gallery
          </button>
          
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4">Image Viewer</h2>
            <ImageViewer imageId={selectedImageId} />
          </div>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-bold mb-4">Image Gallery</h2>
          <ImageGallery onSelectImage={setSelectedImageId} />
        </div>
      )}
      
      <footer className="mt-8 text-center text-gray-500 text-sm">
        <p>Click on an image to select it for segmentation</p>
        <p className="mt-2">
          © 2025 Satellite Image Annotation Tool - Powered by Segment Anything Model
        </p>
      </footer>
    </div>
  )
}

export default App
