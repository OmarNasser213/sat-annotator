CREATE TABLE images (
    image_id SERIAL PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    resolution VARCHAR(50),  -- e.g., "1920x1080"
    capture_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(100), -- e.g., "Sentinel-2, Landsat-8"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE labels (
    label_id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE ai_models (
    model_id SERIAL PRIMARY KEY,
    model_name VARCHAR(255) NOT NULL,
    version VARCHAR(50),
    trained_on TEXT,
    accuracy FLOAT CHECK (accuracy BETWEEN 0 AND 1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE annotation_files (
    annotation_id SERIAL PRIMARY KEY,
    image_id INT REFERENCES images(image_id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,  -- Path to the CSV file
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    auto_generated BOOLEAN DEFAULT FALSE,
    model_id INT REFERENCES ai_models(model_id) ON DELETE SET NULL
);

-- Insert some default labels
INSERT INTO labels (name, description) VALUES 
('building', 'Man-made structures'),
('road', 'Transportation routes'),
('vegetation', 'Trees, grass, and other plant life'),
('water', 'Lakes, rivers, ponds, and oceans');