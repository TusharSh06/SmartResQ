"""
Configuration file for Smart Resq
Centralizes all configuration settings
"""
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    """Application configuration"""
    
    # Model Configuration
    MODEL_JSON_PATH = "models/model.json"
    MODEL_WEIGHTS_PATH = "models/model_weights.keras"
    MODEL_INPUT_SIZE = (250, 250)
    
    # Probability threshold for accident detection
    try:
        ACCIDENT_THRESHOLD = float(os.getenv("ACCIDENT_THRESHOLD", "99.0"))
    except ValueError:
        ACCIDENT_THRESHOLD = 99.0
        print("Warning: Invalid ACCIDENT_THRESHOLD in .env, using default 99.0")
    
    # Video/Camera Configuration
    VIDEO_SOURCE = os.getenv("VIDEO_SOURCE", "0")  # 0 for webcam, or path to video file
    USE_LIVE_CAMERA = os.getenv("USE_LIVE_CAMERA", "true").lower() == "true"
    FRAME_SKIP = int(os.getenv("FRAME_SKIP", "5"))  # Process every Nth frame
    
    # Twilio Configuration
    TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
    TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
    TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")
    DESTINATION_PHONE_NUMBER = os.getenv("DESTINATION_PHONE_NUMBER")
    TWILIO_TWIML_URL = os.getenv("TWILIO_TWIML_URL", "https://handler.twilio.com/twiml/EHcbc30d7e5fb03b07f5c7116e0dacceaf")
    
    # Fast2SMS Configuration
    FAST2SMS_API_KEY = os.getenv("FAST2SMS_API_KEY")
    
    # MongoDB Configuration
    MONGO_URI = os.getenv("MONGO_URI")

    # Email / SMTP Configuration (for OTP)
    SMTP_HOST     = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER     = os.getenv("SMTP_USER", "")   # your Gmail address
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")  # Gmail App Password
    OTP_EXPIRE_SECONDS = int(os.getenv("OTP_EXPIRE_SECONDS", "600"))  # 10 min
    
    # Directory Configuration
    ACCIDENT_PHOTOS_DIR = "accident_photos"
    PLATE_DETECTION_FRAMES_DIR = "plate_detection_frames"
    VEHICLE_PLATES_DIR = "vehicle_no_plates"
    
    # OCR Configuration
    OCR_ENGINE = os.getenv("OCR_ENGINE", "easyocr")  # 'easyocr' or 'tesseract'
    OCR_LANGUAGES = ['en']
    
    # Web Dashboard Configuration
    FLASK_HOST = os.getenv("FLASK_HOST", "0.0.0.0")
    FLASK_PORT = int(os.getenv("FLASK_PORT", "5000"))
    FLASK_DEBUG = os.getenv("FLASK_DEBUG", "true").lower() == "true"
    SECRET_KEY = os.getenv("SECRET_KEY", "smart-resq-secret-key-change-in-production")
    
    # Alert Configuration
    ALERT_SOUND_FREQUENCY = 3000
    ALERT_SOUND_DURATION = 1000
    AUTO_CALL_DELAY = 10  # Seconds before auto-calling ambulance
    
    @classmethod
    def ensure_directories(cls):
        """Create necessary directories if they don't exist"""
        directories = [
            cls.ACCIDENT_PHOTOS_DIR,
            cls.PLATE_DETECTION_FRAMES_DIR,
            cls.VEHICLE_PLATES_DIR
        ]
        for directory in directories:
            os.makedirs(directory, exist_ok=True)
