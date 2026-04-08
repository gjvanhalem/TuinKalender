import requests
from typing import Optional, Dict

def get_weather_data(location: str, api_key: str) -> Optional[Dict]:
    """
    Fetch current weather data from OpenWeatherMap.
    location: "lat,lng" or city name
    """
    if not api_key or not location:
        return None
        
    def is_coord(s):
        try:
            val = float(s.strip())
            return True
        except ValueError:
            return False

    def fetch_url(url):
        try:
            response = requests.get(url)
            if response.status_code == 200:
                return response.json()
            return None
        except:
            return None

    # 1. Try as Coordinates
    if "," in location:
        parts = location.split(",")
        if len(parts) == 2 and is_coord(parts[0]) and is_coord(parts[1]):
            lat, lon = parts[0].strip(), parts[1].strip()
            data = fetch_url(f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}&units=metric&lang=nl")
            if data: return data

    # 2. Try full string as City
    data = fetch_url(f"https://api.openweathermap.org/data/2.5/weather?q={location.strip()}&appid={api_key}&units=metric&lang=nl")
    if data: return data

    # 3. Fallback: If it's a long address, try to extract the city (usually the part before the country)
    if "," in location:
        parts = [p.strip() for p in location.split(",")]
        # Typical format: Street, Zip City, Country -> Take "Zip City" and try that
        if len(parts) >= 2:
            # Try second to last part (often contains City)
            city_part = parts[-2]
            data = fetch_url(f"https://api.openweathermap.org/data/2.5/weather?q={city_part}&appid={api_key}&units=metric&lang=nl")
            if data: return data
            
            # Try last part (if user just typed City, Country)
            data = fetch_url(f"https://api.openweathermap.org/data/2.5/weather?q={parts[-1]}&appid={api_key}&units=metric&lang=nl")
            if data: return data

    return None

def get_forecast_data(location: str, api_key: str) -> Optional[Dict]:
    """
    Fetch 5-day / 3-hour forecast data.
    """
    if not api_key or not location:
        return None
        
    def is_coord(s):
        try:
            float(s.strip())
            return True
        except ValueError:
            return False

    def fetch_url(url):
        try:
            response = requests.get(url)
            if response.status_code == 200:
                return response.json()
            return None
        except:
            return None

    # 1. Try as Coordinates
    if "," in location:
        parts = location.split(",")
        if len(parts) == 2 and is_coord(parts[0]) and is_coord(parts[1]):
            lat, lon = parts[0].strip(), parts[1].strip()
            data = fetch_url(f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={api_key}&units=metric&lang=nl")
            if data: return data

    # 2. Try full string as City
    data = fetch_url(f"https://api.openweathermap.org/data/2.5/forecast?q={location.strip()}&appid={api_key}&units=metric&lang=nl")
    if data: return data

    # 3. Fallback for long addresses
    if "," in location:
        parts = [p.strip() for p in location.split(",")]
        if len(parts) >= 2:
            city_part = parts[-2]
            data = fetch_url(f"https://api.openweathermap.org/data/2.5/forecast?q={city_part}&appid={api_key}&units=metric&lang=nl")
            if data: return data

    return None
