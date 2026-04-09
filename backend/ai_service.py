import os
import json
import requests
from typing import Dict, Optional

def get_plant_suggestions_ai(common_name: str, scientific_name: str, api_key: str, model: str = "openrouter/auto", provider: str = "openrouter", locale: str = "en") -> Dict:
    """
    Use AI (OpenRouter or OpenAI) to get suggestions for flowering, pruning and remarks.
    """
    if not api_key:
        return {}

    # Basic input cleaning to prevent simple prompt injection
    def clean(text):
        if not text: return ""
        return text.replace('"', '').replace("'", "").replace("\n", " ").strip()[:100]

    safe_common = clean(common_name)
    safe_scientific = clean(scientific_name)

    lang_map = {
        "nl": "Nederlands",
        "fr": "Français",
        "en": "English"
    }
    target_lang = lang_map.get(locale, "English")

    prompt = f"""
    Provide gardening advice for the following plant in {target_lang}:
    Name: {safe_common}
    Scientific name: {safe_scientific}

    Provide the response strictly in JSON format with the following fields:
    - localized_name: the most common name for this plant in {target_lang}
    - flowering_months: a comma-separated sequence of month numbers (e.g. "4,5,6")
    - pruning_months: a comma-separated sequence of month numbers (e.g. "3,10")
    - remarks: a short, powerful summary of care tips (max 3 sentences) in {target_lang}.

    Important: Ensure that flowering_months and pruning_months are strings containing only numbers and commas, no brackets or braces.

    JSON:
    """

    try:
        if provider == "openai":
            url = "https://api.openai.com/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
        else:
            url = "https://openrouter.ai/api/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000", 
                "X-Title": "Plan-te",
            }

        response = requests.post(
            url=url,
            headers=headers,
            data=json.dumps({
                "model": model, 
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            })
        )
        if response.status_code != 200:
            print(f"{provider.capitalize()} Error Details: {response.text}")
        response.raise_for_status()
        result = response.json()
        if 'choices' not in result or len(result['choices']) == 0:
            print(f"{provider.capitalize()} No Choices: {result}")
            return {}
            
        content = result['choices'][0]['message']['content']
        
        # Strip potential markdown code blocks
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
            
        return json.loads(content)
    except Exception as e:
        print(f"{provider.capitalize()} AI Error: {e}")
        return {}

def get_garden_advice_ai(plants_summary: str, weather_data: Dict, api_key: str, model: str = "openrouter/auto", provider: str = "openrouter", locale: str = "en") -> str:
    """
    Get dynamic gardening advice based on the current weather and the plants in the garden.
    """
    lang_map = {
        "nl": "Nederlands",
        "fr": "Français",
        "en": "English"
    }
    target_lang = lang_map.get(locale, "English")

    if not api_key:
        error_msgs = {
            "nl": "AI-sleutel niet geconfigureerd.",
            "fr": "Clé IA non configurée.",
            "en": "AI key not configured."
        }
        return error_msgs.get(locale, "AI key not configured.")

    # Safely extract weather data
    current_weather = weather_data.get("current") or {}
    weather_list = current_weather.get("weather", [{}])
    weather_desc = weather_list[0].get("description", "unknown") if weather_list else "unknown"
    temp = current_weather.get("main", {}).get("temp", "unknown")
    
    prompt = f"""
    You are an expert gardening assistant. Provide short and powerful advice (max 4 sentences) in {target_lang} for a garden with the following plants:
    {plants_summary}

    Current weather: {weather_desc}, temperature: {temp}°C.

    Focus on:
    1. Direct action based on the weather (e.g. watering in heat, protecting from frost).
    2. Specific tips for these plants in these conditions.
    3. Be personal and helpful.
    """

    try:
        if provider == "openai":
            url = "https://api.openai.com/v1/chat/completions"
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        else:
            url = "https://openrouter.ai/api/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "Plan-te",
            }

        response = requests.post(
            url=url,
            headers=headers,
            data=json.dumps({
                "model": model,
                "messages": [{"role": "user", "content": prompt}]
            })
        )
        response.raise_for_status()
        result = response.json()
        return result['choices'][0]['message']['content'].strip()
    except Exception as e:
        print(f"Advice AI Error: {e}")
        error_msgs = {
            "nl": "Kon geen AI-advies ophalen op dit moment.",
            "fr": "Impossible de récupérer les conseils de l'IA pour le moment.",
            "en": "Could not fetch AI advice at this time."
        }
        return error_msgs.get(locale, "Could not fetch AI advice at this time.")
