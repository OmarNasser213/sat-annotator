#!/usr/bin/env python3
# A utility script to update image paths in the database to use absolute paths

import os
from pathlib import Path
from sqlalchemy.orm import Session
from app.db.database import get_db, engine
from app.db.models import Base, Image
import sys

def migrate_image_paths():
    """Update relative image paths to absolute paths in the database."""
    print("Starting database image path migration...")
    
    # Initialize the database session
    db = next(get_db())
    try:
        # Get all images from the database
        images = db.query(Image).all()
        updated_count = 0
        
        for image in images:
            # Check if path is already absolute
            if os.path.isabs(image.file_path):
                print(f"Image {image.image_id}: Path already absolute: {image.file_path}")
                continue
            
            # Convert relative path to absolute
            old_path = image.file_path
            if old_path.startswith("uploads/"):
                new_path = "/app/" + old_path
            else:
                new_path = "/app/uploads/" + os.path.basename(old_path)
            
            # Update the database record
            image.file_path = new_path
            updated_count += 1
            print(f"Image {image.image_id}: Updated path from {old_path} to {new_path}")
        
        # Commit changes if any updates were made
        if updated_count > 0:
            db.commit()
            print(f"Migration completed successfully: {updated_count} image paths updated.")
        else:
            print("No image paths needed updating.")
    
    except Exception as e:
        db.rollback()
        print(f"Error during migration: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    migrate_image_paths()