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

    def fetch_url(url, params=None):
        try:
            response = requests.get(url, params=params)
            if response.status_code == 200:
                return response.json()
            print(f"Weather API Error: {response.status_code} - {response.text}")
            return None
        except Exception as e:
            print(f"Weather Fetch Error: {e}")
            return None

    # 1. Try as Coordinates
    if "," in location:
        parts = location.split(",")
        if len(parts) == 2 and is_coord(parts[0]) and is_coord(parts[1]):
            lat, lon = parts[0].strip(), parts[1].strip()
            params = {"lat": lat, "lon": lon, "appid": api_key, "units": "metric", "lang": "nl"}
            data = fetch_url("https://api.openweathermap.org/data/2.5/weather", params=params)
            if data: return data

    # 2. Try full string as City
    params = {"q": location.strip(), "appid": api_key, "units": "metric", "lang": "nl"}
    data = fetch_url("https://api.openweathermap.org/data/2.5/weather", params=params)
    if data: return data

    # 3. Fallback: If it's a long address, try to extract the city
    if "," in location:
        parts = [p.strip() for p in location.split(",")]
        if len(parts) >= 2:
            city_part = parts[-2]
            params = {"q": city_part, "appid": api_key, "units": "metric", "lang": "nl"}
            data = fetch_url("https://api.openweathermap.org/data/2.5/weather", params=params)
            if data: return data
            
            params = {"q": parts[-1], "appid": api_key, "units": "metric", "lang": "nl"}
            data = fetch_url("https://api.openweathermap.org/data/2.5/weather", params=params)
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

    def fetch_url(url, params=None):
        try:
            response = requests.get(url, params=params)
            if response.status_code == 200:
                return response.json()
            print(f"Forecast API Error: {response.status_code} - {response.text}")
            return None
        except Exception as e:
            print(f"Forecast Fetch Error: {e}")
            return None

    # 1. Try as Coordinates
    if "," in location:
        parts = location.split(",")
        if len(parts) == 2 and is_coord(parts[0]) and is_coord(parts[1]):
            lat, lon = parts[0].strip(), parts[1].strip()
            params = {"lat": lat, "lon": lon, "appid": api_key, "units": "metric", "lang": "nl"}
            data = fetch_url("https://api.openweathermap.org/data/2.5/forecast", params=params)
            if data: return data

    # 2. Try full string as City
    params = {"q": location.strip(), "appid": api_key, "units": "metric", "lang": "nl"}
    data = fetch_url("https://api.openweathermap.org/data/2.5/forecast", params=params)
    if data: return data

    # 3. Fallback for long addresses
    if "," in location:
        parts = [p.strip() for p in location.split(",")]
        if len(parts) >= 2:
            city_part = parts[-2]
            params = {"q": city_part, "appid": api_key, "units": "metric", "lang": "nl"}
            data = fetch_url("https://api.openweathermap.org/data/2.5/forecast", params=params)
            if data: return data

    return None

def summarize_forecast(forecast: Optional[Dict]) -> str:
    """
    Summarize a 5-day/3-hour forecast for the AI prompt.
    """
    if not forecast or 'list' not in forecast:
        return "Unknown forecast."
    
    daily_summaries = {}
    from datetime import datetime
    
    for item in forecast['list']:
        dt = datetime.fromtimestamp(item['dt'])
        day_str = dt.strftime("%Y-%m-%d")
        if day_str not in daily_summaries:
            daily_summaries[day_str] = {
                'temps': [],
                'weather': []
            }
        daily_summaries[day_str]['temps'].append(item['main']['temp'])
        daily_summaries[day_str]['weather'].append(item['weather'][0]['description'])
    
    summary_parts = []
    # Take up to 5 days
    days = sorted(daily_summaries.keys())[:5]
    for day in days:
        temps = daily_summaries[day]['temps']
        weather = daily_summaries[day]['weather']
        avg_temp = sum(temps) / len(temps)
        most_common_weather = max(set(weather), key=weather.count)
        summary_parts.append(f"{day}: {most_common_weather}, avg {avg_temp:.1f}°C")
    
    return "; ".join(summary_parts)
