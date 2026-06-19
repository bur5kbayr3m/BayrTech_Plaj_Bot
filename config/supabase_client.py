from supabase import create_client, Client
from config.settings import Config

def get_supabase_client() -> Client:
    url: str = Config.SUPABASE_URL
    key: str = Config.SUPABASE_KEY
    if not url or not key:
        print("Warning: Supabase URL or Key is missing in environment variables.")
    return create_client(url, key) if url and key else None

supabase: Client = get_supabase_client()
