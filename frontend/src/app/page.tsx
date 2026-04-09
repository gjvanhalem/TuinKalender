"use client";

import { useState, useEffect } from 'react';
import { Leaf, Plus, Search, Calendar, Map, ArrowRight, LogIn } from 'lucide-react';
import Link from 'next/link';
import { useSession, signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Cache to prevent dashboard flashing
let dashboardCache: { gardenCount: number; plantCount: number; userName?: string } | null = null;

export default function Home() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const [stats, setStats] = useState({ 
    gardenCount: dashboardCache?.gardenCount || 0, 
    plantCount: dashboardCache?.plantCount || 0 
  });
  const [userName, setUserName] = useState(dashboardCache?.userName || "");

  useEffect(() => {
    if (session) {
      fetchStats();
      fetchUserData();
    }
  }, [session]);

  const fetchUserData = async () => {
    try {
      const response = await fetch(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        const name = data.name || session?.user?.name?.split(' ')[0] || "Tuinier";
        setUserName(name);
        if (dashboardCache) dashboardCache.userName = name;
      }
    } catch (error) {}
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/gardens/`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });
      if (response.ok) {
        const gardens = await response.json();
        const gardenCount = gardens.length;
        const plantCount = gardens.reduce((sum: number, g: any) => sum + (g.plant_count || 0), 0);
        
        const newStats = { gardenCount, plantCount };
        setStats(newStats);
        if (!dashboardCache) dashboardCache = { ...newStats };
        else {
           dashboardCache.gardenCount = gardenCount;
           dashboardCache.plantCount = plantCount;
        }
      }
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    }
  };

  return (
    <main className="pt-24 pb-32 px-6 max-w-5xl mx-auto">
      {/* Hero Section */}
      <section className="mb-12">
        {error === 'unauthorized' && (
          <div className="mb-8 p-4 bg-error-container text-on-error-container rounded-xl font-bold flex items-center justify-center gap-2 animate-bounce border border-error/20">
            <span className="material-symbols-outlined">warning</span>
            Toegang geweigerd. U bent (nog) niet uitgenodigd.
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <span className="font-label text-sm text-primary font-semibold tracking-[0.2em] uppercase mb-2 block">
              {session ? `Welkom terug, ${userName}` : 'Je Groene Oase'}
            </span>
            <h2 className="font-headline text-5xl md:text-6xl font-bold tracking-tight text-on-surface">
              {session ? 'Dashboard' : 'TuinKalender'}
            </h2>
          </div>
          {session ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/calendar" className="flex items-center gap-2 bg-secondary-container text-on-secondary-container px-8 py-4 rounded-xl font-semibold hover:opacity-90 transition-all active:scale-95 text-center justify-center">
                <span className="material-symbols-outlined">calendar_month</span>
                <span>Bekijk Kalender</span>
              </Link>
              <Link href="/gardens" className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-white px-8 py-4 rounded-xl font-semibold hover:opacity-90 transition-all active:scale-95 text-center justify-center">
                <span className="material-symbols-outlined">potted_plant</span>
                <span>Bekijk Tuinen</span>
              </Link>
            </div>
          ) : (
            <button 
              onClick={() => signIn('google')}
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-white px-8 py-4 rounded-xl font-semibold hover:opacity-90 transition-all active:scale-95 text-center justify-center"
            >
              <span className="material-symbols-outlined">login</span>
              <span>Aan de slag</span>
            </button>
          )}
        </div>

        {/* Search Area */}
        <div className="relative group">
          <span className="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-outline">search</span>
          <input 
            className="w-full bg-surface-container-high border-none rounded-xl py-5 pl-16 pr-6 focus:ring-2 focus:ring-primary/20 text-lg placeholder:text-outline transition-all" 
            placeholder="Zoek in je tuin..." 
            type="text"
          />
        </div>
      </section>

      {/* Feature Section / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-8 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-headline text-2xl font-bold">Waarom TuinKalender?</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="group bg-surface-container-low rounded-2xl p-6 transition-all hover:bg-surface-container-high flex flex-col gap-4 border border-outline-variant/5">
              <div className="w-12 h-12 bg-primary-container/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-primary text-2xl">map</span>
              </div>
              <div>
                <h4 className="font-headline text-lg font-bold text-on-surface">Meerdere Tuinen</h4>
                <p className="text-on-surface-variant text-sm mt-1">Organiseer je planten per locatie en deel toegang met anderen.</p>
              </div>
            </div>

            <div className="group bg-surface-container-low rounded-2xl p-6 transition-all hover:bg-surface-container-high flex flex-col gap-4 border border-outline-variant/5">
              <div className="w-12 h-12 bg-secondary-container/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-secondary text-2xl">cloud</span>
              </div>
              <div>
                <h4 className="font-headline text-lg font-bold text-on-surface">Live Weer-data</h4>
                <p className="text-on-surface-variant text-sm mt-1">Real-time weersverwachting per tuin voor slimme planning.</p>
              </div>
            </div>

            <div className="group bg-surface-container-low rounded-2xl p-6 transition-all hover:bg-surface-container-high flex flex-col gap-4 border border-outline-variant/5">
              <div className="w-12 h-12 bg-info-container/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-info text-2xl">auto_awesome</span>
              </div>
              <div>
                <h4 className="font-headline text-lg font-bold text-on-surface">AI Tuinadvies</h4>
                <p className="text-on-surface-variant text-sm mt-1">Persoonlijk advies op basis van je planten en het huidige weer.</p>
              </div>
            </div>

            <div className="group bg-surface-container-low rounded-2xl p-6 transition-all hover:bg-surface-container-high flex flex-col gap-4 border border-outline-variant/5">
              <div className="w-12 h-12 bg-tertiary-container/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-tertiary text-2xl">checklist</span>
              </div>
              <div>
                <h4 className="font-headline text-lg font-bold text-on-surface">Interactieve To-do</h4>
                <p className="text-on-surface-variant text-sm mt-1">Vink snoei- en planttaken af in je persoonlijke jaaroverzicht.</p>
              </div>
            </div>
          </div>

          <div className="pt-8 flex justify-center">
            <div className="inline-flex items-center gap-3 bg-surface-container-high/50 px-6 py-2 rounded-full border border-outline-variant/10">
              <div className="w-2 h-2 rounded-full bg-primary-container"></div>
              <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Powered by Trefle.io</span>
            </div>
          </div>
        </div>

        {/* Sidebar / Stats Area */}
        <div className="md:col-span-4 space-y-6">
          <div className="bg-surface-container-lowest rounded-lg p-6 editorial-shadow border border-outline-variant/5">
            <h5 className="font-headline text-lg font-bold mb-4">Tuin Status</h5>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-on-surface-variant">Actieve tuinen</span>
                <span className="text-sm font-bold text-primary">{stats.gardenCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-on-surface-variant">Totaal planten</span>
                <span className="text-sm font-bold text-secondary">{stats.plantCount}</span>
              </div>
            </div>
          </div>

          <div className="bg-primary-container/10 rounded-lg p-6 relative overflow-hidden">
            <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-primary/10 text-8xl">potted_plant</span>
            <h5 className="font-headline text-lg font-bold text-on-primary-container mb-2">Tip</h5>
            <p className="text-sm text-on-primary-container/80 leading-relaxed relative z-10">
              {stats.gardenCount === 0 
                ? "Begin met het toevoegen van je eerste tuin om je plantencollectie te organiseren."
                : stats.plantCount === 0
                ? "Voeg je eerste planten toe aan je tuin om je kalender te vullen."
                : "Bekijk de kalender om te zien welke planten deze maand aandacht nodig hebben."}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
