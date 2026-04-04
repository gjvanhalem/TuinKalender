import os
import json
import requests
from typing import Dict, Optional

def get_plant_suggestions_ai(common_name: str, scientific_name: str, api_key: str, model: str = "openrouter/auto") -> Dict:
    """
    Use OpenRouter AI to get suggestions for flowering, pruning and remarks.
    """
    if not api_key:
        return {}

    prompt = f"""
    Geef tuinieradvies voor de volgende plant in het Nederlands:
    Naam: {common_name}
    Wetenschappelijke naam: {scientific_name}

    Geef de respons strikt in JSON formaat met de volgende velden:
    - dutch_name: de meest gangbare Nederlandse naam voor deze plant
    - flowering_months: een komma-gescheiden reeks van maandnummers (bijv. "4,5,6")
    - pruning_months: een komma-gescheiden reeks van maandnummers (bijv. "3,10")
    - remarks: een korte, krachtige samenvatting van verzorgingstips (max 3 zinnen).

    Belangrijk: Zorg dat flowering_months en pruning_months echt strings zijn met alleen nummers en komma's, geen haken of accolades.

    JSON:
    """

    try:
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000", 
                "X-Title": "TuinKalender",
            },
            data=json.dumps({
                "model": model, 
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            })
        )
        if response.status_code != 200:
            print(f"OpenRouter Error Details: {response.text}")
        response.raise_for_status()
        result = response.json()
        if 'choices' not in result or len(result['choices']) == 0:
            print(f"OpenRouter No Choices: {result}")
            return {}
            
        content = result['choices'][0]['message']['content']
        
        # Strip potential markdown code blocks
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
            
        return json.loads(content)
    except Exception as e:
        print(f"OpenRouter AI Error: {e}")
        return {}
