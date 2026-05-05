import os
import json
import base64
import requests
from typing import Dict, Optional

def _build_vision_headers(api_key: str, provider: str) -> dict:
    if provider == "openai":
        return {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Plan-te",
    }

def _build_vision_url(provider: str) -> str:
    if provider == "openai":
        return "https://api.openai.com/v1/chat/completions"
    return "https://openrouter.ai/api/v1/chat/completions"

def _vision_model(provider: str, model: str) -> str:
    """Ensure we use a vision-capable model."""
    vision_fallbacks = {
        "openai": "gpt-4o",
        "openrouter": "google/gemini-2.0-flash-exp:free",
    }
    # Models known to support vision
    vision_capable = [
        "gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4-vision",
        "gemini", "claude-3", "claude-opus", "claude-sonnet",
        "llava", "pixtral", "qwen-vl", "internvl", "vision",
    ]
    model_lower = (model or "").lower()
    if any(v in model_lower for v in vision_capable):
        return model
    return vision_fallbacks.get(provider, "gpt-4o")


def identify_plant_from_image(
    image_bytes: bytes,
    api_key: str,
    model: str = "gpt-4o",
    provider: str = "openrouter",
    locale: str = "en",
) -> Dict:
    """
    Use a vision AI to identify a plant from an image.
    Returns suggested common_name, scientific_name, remarks, flowering_months, pruning_months.
    """
    if not api_key:
        return {}

    lang_map = {"nl": "Nederlands", "fr": "Français", "en": "English"}
    target_lang = lang_map.get(locale, "English")
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    vision_model = _vision_model(provider, model)

    prompt = (
        f"Identify the plant in this image and provide gardening advice in {target_lang}. "
        "Return ONLY a JSON object with these fields:\n"
        "- common_name: most common name in the target language\n"
        "- scientific_name: latin binomial\n"
        "- confidence: low/medium/high\n"
        "- flowering_months: comma-separated month numbers e.g. \"4,5,6\"\n"
        "- pruning_months: comma-separated month numbers e.g. \"3,10\"\n"
        "- remarks: short care summary (max 3 sentences) in the target language\n"
        "JSON:"
    )

    try:
        response = requests.post(
            url=_build_vision_url(provider),
            headers=_build_vision_headers(api_key, provider),
            data=json.dumps({
                "model": vision_model,
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                        {"type": "text", "text": prompt},
                    ],
                }],
            }),
            timeout=60,
        )
        if response.status_code != 200:
            print(f"Identify plant error: {response.text}")
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        return json.loads(content)
    except Exception as e:
        print(f"Identify plant AI error: {e}")
        return {}


def analyze_plant_health(
    image_bytes: bytes,
    plant_name: str,
    api_key: str,
    model: str = "gpt-4o",
    provider: str = "openrouter",
    locale: str = "en",
) -> Dict:
    """
    Analyze a plant photo for health issues, returning diagnosis and advice.
    """
    if not api_key:
        return {}

    lang_map = {"nl": "Nederlands", "fr": "Français", "en": "English"}
    target_lang = lang_map.get(locale, "English")
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    vision_model = _vision_model(provider, model)
    safe_name = (plant_name or "this plant").replace('"', "")[:80]

    prompt = (
        f"Analyze the health of {safe_name} shown in this image. "
        f"Respond in {target_lang} with ONLY a JSON object containing:\n"
        "- health_score: integer 1-10 (10 = perfect health)\n"
        "- status: one word summary e.g. Healthy / Stressed / Diseased\n"
        "- issues: list of observed problems (empty list if none)\n"
        "- diagnosis: 1-2 sentence explanation of what you see\n"
        "- advice: 2-3 concrete actionable care tips\n"
        "JSON:"
    )

    try:
        response = requests.post(
            url=_build_vision_url(provider),
            headers=_build_vision_headers(api_key, provider),
            data=json.dumps({
                "model": vision_model,
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                        {"type": "text", "text": prompt},
                    ],
                }],
            }),
            timeout=60,
        )
        if response.status_code != 200:
            print(f"Plant health error: {response.text}")
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        return json.loads(content)
    except Exception as e:
        print(f"Plant health AI error: {e}")
        return {}


def analyze_garden_photo(
    image_bytes: bytes,
    api_key: str,
    model: str = "gpt-4o",
    provider: str = "openrouter",
    locale: str = "en",
) -> Dict:
    """
    Analyze a garden photo for problem areas and provide actionable advice.
    """
    if not api_key:
        return {}

    lang_map = {"nl": "Nederlands", "fr": "Français", "en": "English"}
    target_lang = lang_map.get(locale, "English")
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    vision_model = _vision_model(provider, model)

    prompt = (
        f"Analyze this garden photo and provide advice in {target_lang}. "
        "Return ONLY a JSON object with:\n"
        "- overall_health: one word e.g. Good / Fair / Poor\n"
        "- observations: list of 2-5 key observations about the garden\n"
        "- problem_areas: list of identified problems or concerns\n"
        "- advice: list of 3-5 concrete, actionable recommendations\n"
        "- highlight: single most important action to take right now (1 sentence)\n"
        "JSON:"
    )

    try:
        response = requests.post(
            url=_build_vision_url(provider),
            headers=_build_vision_headers(api_key, provider),
            data=json.dumps({
                "model": vision_model,
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                        {"type": "text", "text": prompt},
                    ],
                }],
            }),
            timeout=60,
        )
        if response.status_code != 200:
            print(f"Garden photo error: {response.text}")
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        return json.loads(content)
    except Exception as e:
        print(f"Garden photo AI error: {e}")
        return {}


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
    from weather_service import summarize_forecast
    forecast_summary = summarize_forecast(weather_data.get("forecast"))
    
    prompt = f"""
    You are an expert gardening assistant. Provide short and powerful advice (max 4 sentences) in {target_lang} for a garden with the following plants:
    {plants_summary}

    Weather forecast for the coming week: {forecast_summary}.

    Focus on:
    1. Direct action based on the upcoming weather (e.g. watering in heat, protecting from frost).
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
