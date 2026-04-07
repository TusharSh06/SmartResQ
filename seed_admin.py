import sys
import os
from pymongo import MongoClient
from werkzeug.security import generate_password_hash
from config import Config

def main():
    print("🔗 Connecting to MongoDB...")
    client = MongoClient(Config.MONGO_URI)
    users_col = client["smartresq"].users

    admin_username = "tsharmak10@gmail.com"
    admin_password = "Tushar@123"

    try:
        users_col.create_index("username", unique=True)
    except Exception:
        pass
    
    # Check if user already exists
    existing_admin = users_col.find_one({"username": admin_username})
    password_hash = generate_password_hash(admin_password)

    if existing_admin:
        print(f"⚠️  Admin account '{admin_username}' already exists. Updating password and details...")
        users_col.update_one({"username": admin_username}, {"$set": {
            "password_hash": password_hash,
            "first_name": "Tushar",
            "last_name": "Sharma",
            "age": 21,
            "role": "admin",
            "account_status": "approved"
        }})
        print("✅  Admin user updated successfully!")
    else:
        print(f"Adding new admin account for '{admin_username}'...")
        users_col.insert_one({
            "username": admin_username,
            "password_hash": password_hash,
            "first_name": "Tushar",
            "last_name": "Sharma",
            "age": 21,
            "role": "admin",
            "account_status": "approved",
            "token": None
        })
        print("✅  Admin user created successfully!")

    print("Details:")
    print(f"  Name: Tushar Sharma")
    print(f"  Email: {admin_username}")
    print(f"  Age: 21")
    print(f"  Password: {admin_password}")
    
    client.close()

if __name__ == "__main__":
    main()
