import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY")
    META_VERIFY_TOKEN = os.getenv("META_VERIFY_TOKEN")
    META_ACCESS_TOKEN = os.getenv("META_ACCESS_TOKEN")
