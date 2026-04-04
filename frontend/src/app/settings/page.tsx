"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Settings, Key, Save, AlertTriangle, CheckCircle2, MapPin, Sparkles, ChevronDown } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [trefleToken, setTrefleToken] = useState("");
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [openrouterModel, setOpenrouterModel] = useState("nvidia/nemotron-3-super-120b-a12b:free");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (session) {
      fetchUserSettings();
    }
  }, [session]);

  const fetchUserSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${session?.accessToken || session?.user?.email}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTrefleToken(data.trefle_token || "");
        setOpenrouterKey(data.openrouter_key || "");
        setOpenrouterModel(data.openrouter_model || "google/gemini-2.0-flash-lite-preview-02-05:free");
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_URL}/users/me`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.accessToken || session?.user?.email}`
        },
        body: JSON.stringify({
          trefle_token: trefleToken,
          openrouter_key: openrouterKey,
          openrouter_model: openrouterModel,
        }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: "Instellingen succesvol opgeslagen!" });
      } else {
        setMessage({ type: 'error', text: "Er ging iets mis bij het opslaan." });
      }
    } catch (error) {
      setMessage({ type: 'error', text: "Server onbereikbaar." });
    } finally {
      setIsSaving(false);
    }
  };

  if (!session) {
    return (
      <div className="container mx-auto p-12 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Log in om uw instellingen te beheren.</h1>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 md:p-12 max-w-2xl">
      <h1 className="text-4xl font-black text-slate-900 mb-8 flex items-center gap-3">
        <div className="bg-garden-green-100 p-2 rounded-2xl">
          <Settings className="w-8 h-8 text-garden-green-600" />
        </div>
        Instellingen
      </h1>

      <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
        <p className="text-slate-500 mb-8 font-medium">
          Configureer uw persoonlijke API-sleutels om gebruik te maken van de plantendatabase en AI-functies.
        </p>

        <form onSubmit={saveSettings} className="space-y-8">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Key className="w-4 h-4 text-garden-green-600" />
                Trefle.io API Token
              </label>
              <span className="text-[10px] bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-bold uppercase">Verplicht</span>
            </div>
            <input
              type="password"
              placeholder="Uw Trefle token..."
              className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-garden-green-500 transition-all font-mono text-sm"
              value={trefleToken}
              onChange={(e) => setTrefleToken(e.target.value)}
              required
            />
            <p className="text-xs text-slate-400">Vraag uw token aan op <a href="https://trefle.io/" target="_blank" className="text-garden-green-600 underline">trefle.io</a></p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-600" />
                OpenRouter API Key
              </label>
              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase">Optioneel</span>
            </div>
            <input
              type="password"
              placeholder="Uw OpenRouter key..."
              className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-mono text-sm"
              value={openrouterKey}
              onChange={(e) => setOpenrouterKey(e.target.value)}
            />
            <p className="text-xs text-slate-400">Gebruikt voor slimme plantadviezen.</p>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              OpenRouter AI Model
            </label>
            <div className="relative group">
              <input
                type="text"
                placeholder="bijv: google/gemini-2.0-flash-lite-preview-02-05:free"
                className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-mono text-sm"
                value={openrouterModel}
                onChange={(e) => setOpenrouterModel(e.target.value)}
              />
              <ChevronDown className="w-5 h-5 absolute right-4 top-4 text-slate-300 pointer-events-none" />
            </div>
            <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
              Voer de ID van het gewenste model in. Standaard is het gratis Gemini model.<br />
              Beschikbare modellen vind je op <a href="https://openrouter.ai/models" target="_blank" className="text-blue-500 underline">openrouter.ai/models</a>.
            </p>
          </div>

          {message && (
            <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
              {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              <span className="font-bold text-sm">{message.text}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-garden-green-600 hover:bg-garden-green-700 text-white p-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-garden-green-600/20 disabled:opacity-50"
          >
            {isSaving ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <Save className="w-5 h-5" />}
            Instellingen Opslaan
          </button>
        </form>
      </div>
    </div>
  );
}
