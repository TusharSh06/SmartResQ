import os
from pymongo import MongoClient
import sys

def test_connection():
    # Attempt manually reading line from .env
    uri = None
    try:
        with open(".env", "r") as f:
            for line in f:
                if line.startswith("MONGO_URI="):
                    uri = line.split("=", 1)[1].strip()
                    break
    except:
        pass

    if not uri:
        print("❌ Could not find MONGO_URI in .env file directly.")
        return

    print(f"🔍 URI found in .env: {uri.split('@')[-1] if '@' in uri else 'Generic'}")

    try:
        # Very short timeout for DNS/Resolution
        client = MongoClient(uri, serverSelectionTimeoutMS=2000, connectTimeoutMS=2000)
        client.admin.command('ping')
        print("✅ PING SUCCESSFUL!")
        
        db_names = client.list_database_names()
        print(f"📦 Databases visible: {db_names}")
    except Exception as e:
        print(f"❌ CONNECTION FAILED: {str(e)}")

if __name__ == "__main__":
    test_connection()
