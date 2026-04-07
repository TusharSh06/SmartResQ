# pyre-ignore-all-errors
#!/usr/bin/env python3
"""
Smart Resq Archive System (MongoDB + GridFS Integration)
Handles storage and retrieval of video analysis history and accident records.
"""

import json
import os
import time
from datetime import datetime
from typing import Any, Dict, List, Optional
import cv2
import numpy as np
from bson import ObjectId
from pymongo import MongoClient
import gridfs

try:
    from config import Config
    MONGO_URI = Config.MONGO_URI
except ImportError:
    import os
    MONGO_URI = os.getenv("MONGO_URI")

class ArchiveSystem:
    def __init__(self, base_dir="archives"):
        self.base_dir = base_dir
        self.client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        self.db = self.client["smartresq"]
        self.fs = gridfs.GridFS(self.db)
        
        self.video_analysis = self.db.video_analysis
        self.accidents = self.db.accidents
        self.settings = self.db.archive_settings
        
        self.init_database()
        
    def init_database(self):
        """Initialize settings if empty"""
        try:
            if self.settings.count_documents({}) == 0:
                self.settings.insert_one({
                    'max_archive_days': 30,
                    'max_storage_mb': 2000,
                    'auto_cleanup': True,
                    'updated_at': datetime.now().isoformat()
                })
        except Exception as e:
            print(f"⚠ MongoDB Connection Error: {e}")
            
    def _convert_id(self, mongo_id):
        return str(mongo_id) if mongo_id else None

    def start_video_analysis(self, video_file, total_frames=0, fps=0, duration=0):
        timestamp_slug = datetime.now().strftime("%Y%m%d_%H%M%S")
        analysis_dir_name = f"analysis_{timestamp_slug}"
        output_dir = f"{self.base_dir}/{analysis_dir_name}"
        
        # Kept for compatibility if other modules depend on it
        os.makedirs(f"{output_dir}/accidents", exist_ok=True)
        os.makedirs(f"{output_dir}/plates", exist_ok=True)
        
        start_time = datetime.now().isoformat()
        
        doc = {
            'video_file': video_file,
            'total_frames': total_frames,
            'fps': fps,
            'duration': duration,
            'processed_frames': 0,
            'accidents_detected': 0,
            'start_time': start_time,
            'end_time': None,
            'status': 'processing',
            'output_dir': output_dir,
            'created_at': datetime.now()
        }
        
        res = self.video_analysis.insert_one(doc)
        analysis_id = str(res.inserted_id)
        
        print(f"📁 MongoDB Archive started: ID {analysis_id}")
        return analysis_id, output_dir
        
    def record_accident(self, analysis_id, frame_number, confidence, frame, location="Point A-7"):
        if not analysis_id:
            return None, None
            
        timestamp = datetime.now().isoformat()
        
        if hasattr(confidence, 'item'):
            confidence = confidence.item()
            
        # Instead of saving locally, save to MongoDB GridFS
        ret, buffer = cv2.imencode('.jpg', frame)
        if hasattr(buffer, 'tobytes'):
            img_bytes = buffer.tobytes()
        else:
            img_bytes = buffer.tostring()
            
        photo_filename = f"accident_f{frame_number}_{int(time.time())}.jpg"
        file_id = self.fs.put(img_bytes, filename=photo_filename, content_type="image/jpeg", analysis_id=analysis_id)
        
        # The URL that the frontend/backend will use
        photo_path = f"/api/archives/image/{str(file_id)}"
        
        doc = {
            'analysis_id': analysis_id, # String ref
            'frame_number': frame_number,
            'confidence': float(confidence),
            'timestamp': timestamp,
            'photo_path': photo_path,
            'image_file_id': file_id, # Mongo ObjectId
            'license_plate_detected': False,
            'license_plate_text': None,
            'license_plate_path': None,
            'location': location,
            'notes': None,
            'created_at': datetime.now()
        }
        
        res = self.accidents.insert_one(doc)
        accident_id = str(res.inserted_id)
        
        return accident_id, photo_path
        
    def update_accident_license_plate(self, accident_id, plate_text, plate_img_path):
        if not accident_id:
            return
            
        self.accidents.update_one(
            {'_id': ObjectId(accident_id)},
            {'$set': {
                'license_plate_detected': True,
                'license_plate_text': plate_text,
                'license_plate_path': plate_img_path
            }}
        )
        
    def complete_analysis(self, analysis_id, processed_frames, accidents_detected):
        if not analysis_id:
            return
            
        self.video_analysis.update_one(
            {'_id': ObjectId(analysis_id)},
            {'$set': {
                'processed_frames': processed_frames,
                'accidents_detected': accidents_detected,
                'end_time': datetime.now().isoformat(),
                'status': 'completed'
            }}
        )
        print(f"✅ MongoDB Archive finalized: ID {analysis_id}")
        
    def get_analysis_history(self, limit=50):
        docs = self.video_analysis.find().sort('created_at', -1).limit(limit)
        history = []
        for r in docs:
            history.append({
                'id': str(r['_id']),
                'title': r.get('video_file', 'Untitled'),
                'timestamp': r.get('start_time'),
                'total_frames': r.get('total_frames', 0),
                'processed_frames': r.get('processed_frames', 0),
                'accident_count': r.get('accidents_detected', 0),
                'fps': r.get('fps', 0),
                'duration_seconds': r.get('duration', 0),
                'status': r.get('status', 'unknown'),
                'output_dir': r.get('output_dir'),
            })
        return history
        
    def get_analysis_details(self, analysis_id):
        try:
            analysis = self.video_analysis.find_one({'_id': ObjectId(analysis_id)})
        except:
            return None
            
        if not analysis:
            return None
            
        acc_docs = self.accidents.find({'analysis_id': str(analysis_id)}).sort('frame_number', 1)
        
        result = {
            'id': str(analysis['_id']),
            'video_file': analysis.get('video_file'),
            'title': analysis.get('video_file', 'Untitled'),
            'total_frames': analysis.get('total_frames', 0),
            'processed_frames': analysis.get('processed_frames', 0),
            'accident_count': analysis.get('accidents_detected', 0),
            'fps': analysis.get('fps', 0),
            'duration_seconds': analysis.get('duration', 0),
            'status': analysis.get('status', 'unknown'),
            'output_dir': analysis.get('output_dir'),
            'start_time': analysis.get('start_time'),
            'end_time': analysis.get('end_time'),
            'created_at': analysis.get('created_at').isoformat() if analysis.get('created_at') else None,
        }
        
        result['accidents'] = []
        for acc in acc_docs:
            result['accidents'].append({
                'id': str(acc['_id']),
                'frame_number': acc.get('frame_number'),
                'confidence': acc.get('confidence'),
                'timestamp_sec': None,
                'photo_path': acc.get('photo_path'),
                'license_plate': acc.get('license_plate_text'),
                'location': acc.get('location', 'Point A-7'),
            })
            
        return result

    def get_total_stats(self):
        total_sessions = self.video_analysis.count_documents({})
        pipeline = [{'$match': {'status': 'completed'}}, {'$group': {'_id': None, 'total': {'$sum': '$accidents_detected'}}}]
        
        total_accidents = 0
        res = list(self.video_analysis.aggregate(pipeline))
        if res:
            total_accidents = res[0]['total']
            
        total_plates = self.accidents.count_documents({'license_plate_detected': True})
        
        return {
            'total_sessions': total_sessions,
            'total_accidents': total_accidents,
            'total_plates': total_plates
        }

    def get_image(self, file_id):
        """Retrieve image from GridFS by its object ID"""
        try:
            file_data = self.fs.get(ObjectId(file_id))
            return file_data.read(), file_data.content_type
        except Exception as e:
            return None, None

    def delete_analysis(self, analysis_id):
        """Full cleanup: Metadata, Accidents, and GridFS Images"""
        try:
            # 1. Find all accidents to get image file IDs
            acc_docs = self.accidents.find({'analysis_id': str(analysis_id)})
            for acc in acc_docs:
                # 2. Delete associated images from GridFS
                if 'image_file_id' in acc:
                    try:
                        self.fs.delete(acc['image_file_id'])
                    except:
                        pass
                
                # Also check for license plate images if stored in GridFS (currently not explicitly tracked in fs in this class, but good to be thorough)
            
            # 3. Delete accident records
            self.accidents.delete_many({'analysis_id': str(analysis_id)})
            
            # 4. Delete the analysis session itself
            res = self.video_analysis.delete_one({'_id': ObjectId(analysis_id)})
            
            return True if res.deleted_count > 0 else False
        except Exception as e:
            print(f"Error during analysis deletion: {e}")
            return False

if __name__ == "__main__":
    arch = ArchiveSystem()
    print("MongoDB Archive System Initialized")
    print(f"Total Stats: {arch.get_total_stats()}")
