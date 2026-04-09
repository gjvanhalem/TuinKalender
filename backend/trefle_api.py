import os
import requests
import socket
import ipaddress
from urllib.parse import urlparse
from typing import List, Dict, Optional, Any
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "https://trefle.io/api/v1"

def search_plants(query: str, token: str) -> List[Dict]:
    """
    Search for plants using the Trefle API.
    """
    if not token:
        return []
        
    url = f"{BASE_URL}/plants/search"
    params = {
        "token": token,
        "q": query
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        return data.get("data", [])
    except Exception as e:
        print(f"Error searching Trefle: {e}")
        return []

def get_plant_details(trefle_id: int, token: str) -> Optional[Dict]:
    """
    Fetch detailed information about a specific plant.
    """
    if not token:
        return None
        
    url = f"{BASE_URL}/plants/{trefle_id}"
    params = {
        "token": token
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        return data.get("data", None)
    except Exception as e:
        print(f"Error fetching Trefle plant details: {e}")
        return None

def extract_tasks_from_trefle_data(plant_data: Dict) -> List[Dict]:
    """
    Extract tasks like pruning, flowering, planting from Trefle data.
    """
    tasks = []
    
    # Pruning information
    main_species = plant_data.get("main_species", {}) or {}
    specifications = main_species.get("specifications", {}) or {}
    if pruning_month := specifications.get("pruning_month"):
        months = pruning_month if isinstance(pruning_month, list) else [pruning_month]
        for m in months:
            m_idx = map_month_to_int(m)
            if m_idx:
                tasks.append({
                    "category": "Snoeien",
                    "month": m_idx,
                    "description": f"Snoeien aanbevolen voor {plant_data.get('common_name')}"
                })
            
    # Flowering information
    flower = main_species.get("flower", {}) or {}
    if bloom_months := flower.get("bloom_months"):
        months = bloom_months if isinstance(bloom_months, list) else [bloom_months]
        for m in months:
            m_idx = map_month_to_int(m)
            if m_idx:
                tasks.append({
                    "category": "Bloei",
                    "month": m_idx,
                    "description": f"Verwachte bloeiperiode voor {plant_data.get('common_name')}"
                })
            
    # Planting/Growth information
    growth = main_species.get("growth", {}) or {}
    if sowing_months := growth.get("sowing_months"):
        months = sowing_months if isinstance(sowing_months, list) else [sowing_months]
        for m in months:
            m_idx = map_month_to_int(m)
            if m_idx:
                tasks.append({
                    "category": "Planten",
                    "month": m_idx,
                    "description": f"Aanbevolen periode voor zaaien/planten van {plant_data.get('common_name')}"
                })
            
    return tasks

def map_month_to_int(month: Any) -> Optional[int]:
    if isinstance(month, int) and 1 <= month <= 12:
        return month
    if isinstance(month, str):
        month_lower = month.lower().strip()
        full_months = ["january", "february", "march", "april", "may", "june", 
                       "july", "august", "september", "october", "november", "december"]
        short_months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
        dutch_months = ["januari", "februari", "maart", "april", "mei", "juni",
                        "juli", "augustus", "september", "oktober", "november", "december"]
        
        if month_lower in full_months:
            return full_months.index(month_lower) + 1
        if month_lower in short_months:
            return short_months.index(month_lower) + 1
        if month_lower in dutch_months:
            return dutch_months.index(month_lower) + 1
        if month_lower.isdigit():
            m = int(month_lower)
            if 1 <= m <= 12:
                return m
    return None

def is_safe_url(url: str) -> bool:
    """
    Check if a URL is safe for server-side requests.
    Prevents SSRF by blocking non-HTTP(S) protocols and private/loopback IP addresses.
    """
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ('http', 'https'):
            return False
        
        hostname = parsed.hostname
        if not hostname:
            return False
            
        # 1. Check for literal IP addresses in hostname
        try:
            ip_obj = ipaddress.ip_address(hostname)
            if ip_obj.is_private or ip_obj.is_loopback:
                return False
        except ValueError:
            # Not an IP literal, continue to DNS resolution
            pass

        # 2. Resolve hostname to IP to check for private ranges
        # We use socket.getaddrinfo to get all possible IPs.
        addr_info = socket.getaddrinfo(hostname, None)
        for family, kind, proto, canonname, sockaddr in addr_info:
            ip = sockaddr[0]
            ip_obj = ipaddress.ip_address(ip)
            if ip_obj.is_private or ip_obj.is_loopback:
                return False
            
        return True
    except Exception:
        return False

def download_image(url: str, plant_id: int) -> Optional[str]:
    """Download image from URL and save it locally."""
    if not url or not is_safe_url(url):
        print(f"Blocked unsafe or invalid URL: {url}")
        return None
        
    try:
        response = requests.get(url, stream=True, timeout=10)
        if response.status_code == 200:
            os.makedirs("images", exist_ok=True)
            # Use only the filename part to prevent path traversal
            safe_basename = os.path.basename(urlparse(url).path).split('?')[0]
            if not safe_basename:
                safe_basename = f"plant_{plant_id}.jpg"
            
            file_name = f"images/trefle_{plant_id}_{safe_basename}"
            with open(file_name, 'wb') as f:
                for chunk in response.iter_content(1024):
                    f.write(chunk)
            return file_name
    except Exception as e:
        print(f"Error downloading image: {e}")
    return None
