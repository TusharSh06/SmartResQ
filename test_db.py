from config import Config
from pymongo import MongoClient
import sys

def test_connection():
    uri = Config.MONGO_URI
    if not uri:
        print("❌ Error: MONGO_URI is not set in your environment/.env file.")
        return

    print(f"🔍 Attempting to connect to MongoDB...")
    # Hide credentials for display
    safe_uri = uri.split('@')[-1] if '@' in uri else uri
    print(f"🌐 Target: {safe_uri}")

    try:
        # 5 second timeout for connection
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        # The 'admin' database is always there, we try a command to trigger connection
        client.admin.command('ping')
        print("✅ Connection Successful!")
        
        db = client["smartresq"]
        collections = db.list_collection_names()
        print(f"📦 Database: 'smartresq'")
        print(f"📋 Collections found: {collections}")
        
        # Test specific collections we need
        needed = ['users', 'cameras', 'settings', 'video_analysis']
        missing = [c for c in needed if c not in collections]
        if missing:
            print(f"⚠️  Note: Some collections are currently empty/missing: {missing}")
        else:
            print(f"✨ All core collections are present.")

    except Exception as e:
        print(f"❌ Connection Failed!")
        print(f"🔴 Error Detail: {e}")

if __name__ == "__main__":
    test_connection()
