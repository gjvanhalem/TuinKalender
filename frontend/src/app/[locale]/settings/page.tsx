"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const DEFAULT_MODEL = process.env.NEXT_PUBLIC_DEFAULT_OPENROUTER_MODEL || "google/gemini-2.0-flash-lite-preview-02-05:free";

export default function SettingsPage() {
  const t = useTranslations('Common');
  const tSettings = useTranslations('Settings');
  const { data: session } = useSession();
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  
  const [userName, setUserName] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState(currentLocale);
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
        setPreferredLanguage(data.preferred_language || currentLocale);
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
          preferred_language: preferredLanguage,
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
        setMessage({ type: 'success', text: tSettings('saveSuccess') });
        if (preferredLanguage !== currentLocale) {
          router.replace(pathname, { locale: preferredLanguage as any });
        }
      } else {
        setMessage({ type: 'error', text: tSettings('saveError') });
      }
    } catch (error) {
      setMessage({ type: 'error', text: tSettings('serverUnreachable') });
    } finally {
      setIsSaving(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <span className="material-symbols-outlined text-outline text-6xl mb-4">lock</span>
          <h1 className="text-2xl font-bold text-on-surface">{tSettings('loginToManage')}</h1>
        </div>
      </div>
    );
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-2xl mx-auto">
      <section className="mb-12">
        <span className="font-label text-sm text-primary font-semibold tracking-[0.2em] uppercase mb-2 block">{tSettings('account')}</span>
        <h2 className="font-headline text-5xl md:text-6xl font-bold tracking-tight text-on-surface">{tSettings('title')}</h2>
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
              {tSettings('profile')}
            </h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">{tSettings('name')}</label>
                <input
                  type="text"
                  placeholder={tSettings('yourFullName')}
                  className="w-full p-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all text-on-surface font-medium"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">{tSettings('language')}</label>
                <select
                  className="w-full p-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all text-on-surface font-medium appearance-none"
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="nl">Nederlands</option>
                  <option value="fr">Français</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">{tSettings('email')}</label>
                <input
                  type="email"
                  disabled
                  className="w-full p-4 bg-surface-container-high/50 border-none rounded-xl text-on-surface-variant font-medium cursor-not-allowed opacity-70"
                  value={session?.user?.email || ""}
                />
                <p className="text-[10px] text-outline px-1 mt-1">{tSettings('emailLinked')}</p>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 editorial-shadow">
            <h3 className="font-headline text-xl font-bold mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">key</span>
              {tSettings('plantDatabase')}
            </h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">{tSettings('apiToken')}</label>
                <input
                  type="password"
                  placeholder={tSettings('apiToken')}
                  className="w-full p-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all text-on-surface font-medium"
                  value={trefleToken}
                  onChange={(e) => setTrefleToken(e.target.value)}
                />
                <p className="text-[10px] text-outline px-1 mt-1 leading-relaxed">
                  {tSettings('trefleHelp').split('trefle.io')[0]} <a href="https://trefle.io/" target="_blank" className="text-primary underline">trefle.io</a>.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 editorial-shadow">
            <h3 className="font-headline text-xl font-bold mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">auto_awesome</span>
              {tSettings('aiAutomation')}
            </h3>
            <div className="space-y-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">{tSettings('aiProvider')}</label>
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
                    <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">{tSettings('openrouterKey')}</label>
                    <input
                      type="password"
                      placeholder="sk-or-..."
                      className="w-full p-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-secondary/20 transition-all text-on-surface font-medium"
                      value={openrouterKey}
                      onChange={(e) => setOpenrouterKey(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">{tSettings('modelId')}</label>
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
                    <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">{tSettings('openaiKey')}</label>
                    <input
                      type="password"
                      placeholder="sk-..."
                      className="w-full p-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all text-on-surface font-medium"
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">{tSettings('modelName')}</label>
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
              {tSettings('weatherOpenWeatherMap')}
            </h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">{tSettings('apiToken')}</label>
                <input
                  type="password"
                  placeholder={tSettings('openweathermapPlaceholder')}
                  className="w-full p-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all text-on-surface font-medium"
                  value={openweathermapKey}
                  onChange={(e) => setOpenweatherMapKey(e.target.value)}
                />
                <p className="text-[10px] text-outline px-1 mt-1 leading-relaxed">
                  {tSettings('weatherHelp').split('openweathermap.org')[0]} <a href="https://openweathermap.org/api" target="_blank" className="text-primary underline">openweathermap.org</a>.
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
                <span>{tSettings('saveSettings')}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
