"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const DEFAULT_MODEL = process.env.NEXT_PUBLIC_DEFAULT_OPENROUTER_MODEL || "google/gemini-2.0-flash-lite-preview-02-05:free";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [userName, setUserName] = useState("");
  const [trefleToken, setTrefleToken] = useState("");
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [openrouterModel, setOpenrouterModel] = useState(DEFAULT_MODEL);
  const [openaiKey, setOpenaiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o-mini");
  const [openweathermapKey, setOpenweatherMapKey] = useState("");
  const [aiProvider, setAiProvider] = useState("openrouter");
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
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUserName(data.name || "");
        setTrefleToken(data.trefle_token || "");
        setOpenrouterKey(data.openrouter_key || "");
        setOpenrouterModel(data.openrouter_model || DEFAULT_MODEL);
        setOpenaiKey(data.openai_key || "");
        setOpenaiModel(data.openai_model || "gpt-4o-mini");
        setOpenweatherMapKey(data.openweathermap_key || "");
        setAiProvider(data.ai_provider || "openrouter");
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
          Authorization: `Bearer ${session?.accessToken}`
        },
        body: JSON.stringify({
          name: userName,
          trefle_token: trefleToken,
          openrouter_key: openrouterKey,
          openrouter_model: openrouterModel,
          openai_key: openaiKey,
          openai_model: openaiModel,
          openweathermap_key: openweathermapKey,
          ai_provider: aiProvider,
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
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <span className="material-symbols-outlined text-outline text-6xl mb-4">lock</span>
          <h1 className="text-2xl font-bold text-on-surface">Log in om uw instellingen te beheren.</h1>
        </div>
      </div>
    );
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-2xl mx-auto">
      <section className="mb-12">
        <span className="font-label text-sm text-primary font-semibold tracking-[0.2em] uppercase mb-2 block">Account</span>
        <h2 className="font-headline text-5xl md:text-6xl font-bold tracking-tight text-on-surface">Instellingen</h2>
      </section>

      <div className="space-y-8">
        {message && (
          <div className={`p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-primary-container/20 text-on-primary-container' : 'bg-error-container text-on-error-container'}`}>
            <span className="material-symbols-outlined">{message.type === 'success' ? 'check_circle' : 'error'}</span>
            <span className="font-bold">{message.text}</span>
          </div>
        )}

        <form onSubmit={saveSettings} className="space-y-8">
          <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 editorial-shadow">
            <h3 className="font-headline text-xl font-bold mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">person</span>
              Profiel
            </h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">Naam</label>
                <input
                  type="text"
                  placeholder="Uw volledige naam"
                  className="w-full p-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all text-on-surface font-medium"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">E-mail</label>
                <input
                  type="email"
                  disabled
                  className="w-full p-4 bg-surface-container-high/50 border-none rounded-xl text-on-surface-variant font-medium cursor-not-allowed opacity-70"
                  value={session?.user?.email || ""}
                />
                <p className="text-[10px] text-outline px-1 mt-1">E-mailadres is gekoppeld aan uw Google-account.</p>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 editorial-shadow">
            <h3 className="font-headline text-xl font-bold mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">key</span>
              Plantendatabase (Trefle.io)
            </h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">API Token</label>
                <input
                  type="password"
                  placeholder="Uw Trefle.io API token"
                  className="w-full p-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all text-on-surface font-medium"
                  value={trefleToken}
                  onChange={(e) => setTrefleToken(e.target.value)}
                />
                <p className="text-[10px] text-outline px-1 mt-1 leading-relaxed">
                  Verplicht voor het zoeken naar planten. Verkrijg een gratis token op <a href="https://trefle.io/" target="_blank" className="text-primary underline">trefle.io</a>.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 editorial-shadow">
            <h3 className="font-headline text-xl font-bold mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">auto_awesome</span>
              AI & Automatisering
            </h3>
            <div className="space-y-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">AI Provider</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAiProvider('openrouter')}
                    className={`p-3 rounded-xl font-bold text-sm transition-all border ${aiProvider === 'openrouter' ? 'bg-secondary text-white border-secondary shadow-md' : 'bg-surface-container-high text-on-surface-variant border-transparent'}`}
                  >
                    OpenRouter
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiProvider('openai')}
                    className={`p-3 rounded-xl font-bold text-sm transition-all border ${aiProvider === 'openai' ? 'bg-primary text-white border-primary shadow-md' : 'bg-surface-container-high text-on-surface-variant border-transparent'}`}
                  >
                    OpenAI
                  </button>
                </div>
              </div>

              {aiProvider === 'openrouter' ? (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">OpenRouter API Key</label>
                    <input
                      type="password"
                      placeholder="sk-or-..."
                      className="w-full p-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-secondary/20 transition-all text-on-surface font-medium"
                      value={openrouterKey}
                      onChange={(e) => setOpenrouterKey(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">Model ID</label>
                    <input
                      type="text"
                      placeholder="google/gemini-2.0-flash-lite-preview-02-05:free"
                      className="w-full p-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-secondary/20 transition-all text-on-surface font-medium"
                      value={openrouterModel}
                      onChange={(e) => setOpenrouterModel(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">OpenAI API Key</label>
                    <input
                      type="password"
                      placeholder="sk-..."
                      className="w-full p-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all text-on-surface font-medium"
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">Model Name</label>
                    <input
                      type="text"
                      placeholder="gpt-4o-mini"
                      className="w-full p-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all text-on-surface font-medium"
                      value={openaiModel}
                      onChange={(e) => setOpenaiModel(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 editorial-shadow">
            <h3 className="font-headline text-xl font-bold mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-info">cloud</span>
              Weer (OpenWeatherMap)
            </h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">API Key</label>
                <input
                  type="password"
                  placeholder="Uw OpenWeatherMap API key"
                  className="w-full p-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all text-on-surface font-medium"
                  value={openweathermapKey}
                  onChange={(e) => setOpenweatherMapKey(e.target.value)}
                />
                <p className="text-[10px] text-outline px-1 mt-1 leading-relaxed">
                  Gebruikt voor weersverwachtingen en waarschuwingen per tuin. Verkrijg een gratis key op <a href="https://openweathermap.org/api" target="_blank" className="text-primary underline">openweathermap.org</a>.
                </p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-primary text-white p-5 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary/20 disabled:opacity-50 active:scale-95"
          >
            {isSaving ? (
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
            ) : (
              <>
                <span className="material-symbols-outlined">save</span>
                <span>Instellingen Opslaan</span>
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
