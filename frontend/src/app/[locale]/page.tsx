"use client";

import { useState, useEffect } from 'react';
import { Leaf, Plus, Search, Calendar, Map, ArrowRight, LogIn } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useSession, signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Logo from '@/components/Logo';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Cache to prevent dashboard flashing
let dashboardCache: { gardenCount: number; plantCount: number; userName?: string; gardens?: any[] } | null = null;

export default function Home() {
  const t = useTranslations('Common');
  const tHome = useTranslations('Home');
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const [stats, setStats] = useState({ 
    gardenCount: dashboardCache?.gardenCount || 0, 
    plantCount: dashboardCache?.plantCount || 0 
  });
  const [gardens, setGardens] = useState<any[]>(dashboardCache?.gardens || []);
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
        const gardensData = await response.json();
        const gardenCount = gardensData.length;
        const plantCount = gardensData.reduce((sum: number, g: any) => sum + (g.plant_count || 0), 0);
        
        const newStats = { gardenCount, plantCount };
        setStats(newStats);
        setGardens(gardensData);
        if (!dashboardCache) dashboardCache = { ...newStats, gardens: gardensData };
        else {
           dashboardCache.gardenCount = gardenCount;
           dashboardCache.plantCount = plantCount;
           dashboardCache.gardens = gardensData;
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
            {t('unauthorized')}
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div className="flex items-center gap-6">
            {!session && <Logo size={80} className="hidden md:block" />}
            <div>
              <span className="font-label text-sm text-primary font-semibold tracking-[0.2em] uppercase mb-2 block">
                {session ? t('welcome', { name: userName }) : t('guestWelcome')}
              </span>
              <h2 className="font-headline text-5xl md:text-6xl font-bold tracking-tight text-on-surface">
                {session ? t('dashboard') : t('appName')}
              </h2>
            </div>
          </div>
          {session ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/calendar" className="flex items-center gap-2 bg-secondary-container text-on-secondary-container px-8 py-4 rounded-xl font-semibold hover:opacity-90 transition-all active:scale-95 text-center justify-center">
                <span className="material-symbols-outlined">calendar_month</span>
                <span>{t('viewCalendar')}</span>
              </Link>
              <Link href="/gardens" className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-white px-8 py-4 rounded-xl font-semibold hover:opacity-90 transition-all active:scale-95 text-center justify-center">
                <span className="material-symbols-outlined">potted_plant</span>
                <span>{t('viewGardens')}</span>
              </Link>
            </div>
          ) : (
            <button 
              onClick={() => signIn('google')}
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-white px-8 py-4 rounded-xl font-semibold hover:opacity-90 transition-all active:scale-95 text-center justify-center"
            >
              <span className="material-symbols-outlined">login</span>
              <span>{t('getStarted')}</span>
            </button>
          )}
        </div>

        {/* Search Area */}
        <div className="relative group">
          <span className="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-outline">search</span>
          <input 
            className="w-full bg-surface-container-high border-none rounded-xl py-5 pl-16 pr-6 focus:ring-2 focus:ring-primary/20 text-lg placeholder:text-outline transition-all" 
            placeholder={t('searchPlaceholder')} 
            type="text"
          />
        </div>
      </section>

      {/* Feature Section / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-8 space-y-6">
          {session && gardens.length > 0 && (
            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between px-2">
                <h3 className="font-headline text-2xl font-bold">{t('myGardens')}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {gardens.map((garden) => (
                  <Link 
                    key={garden.id} 
                    href={`/gardens/${garden.id}`}
                    className="group bg-surface-container-low rounded-2xl p-6 transition-all hover:bg-surface-container-high flex items-center gap-4 border border-outline-variant/5"
                  >
                    <div className="w-12 h-12 bg-primary-container/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-primary text-2xl">
                        {garden.is_owner ? 'yard' : 'share'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-headline text-lg font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                        {garden.name}
                      </h4>
                      <p className="text-on-surface-variant text-xs mt-0.5 truncate">
                        {garden.plant_count} {t('plants').toLowerCase()}
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-outline ml-auto group-hover:translate-x-1 transition-transform">
                      arrow_forward
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-2">
            <h3 className="font-headline text-2xl font-bold">{tHome('whyAppName')}</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="group bg-surface-container-low rounded-2xl p-6 transition-all hover:bg-surface-container-high flex flex-col gap-4 border border-outline-variant/5">
              <div className="w-12 h-12 bg-primary-container/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-primary text-2xl">map</span>
              </div>
              <div>
                <h4 className="font-headline text-lg font-bold text-on-surface">{tHome('features.multipleGardens.title')}</h4>
                <p className="text-on-surface-variant text-sm mt-1">{tHome('features.multipleGardens.description')}</p>
              </div>
            </div>

            <div className="group bg-surface-container-low rounded-2xl p-6 transition-all hover:bg-surface-container-high flex flex-col gap-4 border border-outline-variant/5">
              <div className="w-12 h-12 bg-secondary-container/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-secondary text-2xl">cloud</span>
              </div>
              <div>
                <h4 className="font-headline text-lg font-bold text-on-surface">{tHome('features.weatherData.title')}</h4>
                <p className="text-on-surface-variant text-sm mt-1">{tHome('features.weatherData.description')}</p>
              </div>
            </div>

            <div className="group bg-surface-container-low rounded-2xl p-6 transition-all hover:bg-surface-container-high flex flex-col gap-4 border border-outline-variant/5">
              <div className="w-12 h-12 bg-info-container/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-info text-2xl">auto_awesome</span>
              </div>
              <div>
                <h4 className="font-headline text-lg font-bold text-on-surface">{tHome('features.aiAdvice.title')}</h4>
                <p className="text-on-surface-variant text-sm mt-1">{tHome('features.aiAdvice.description')}</p>
              </div>
            </div>

            <div className="group bg-surface-container-low rounded-2xl p-6 transition-all hover:bg-surface-container-high flex flex-col gap-4 border border-outline-variant/5">
              <div className="w-12 h-12 bg-tertiary-container/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-tertiary text-2xl">checklist</span>
              </div>
              <div>
                <h4 className="font-headline text-lg font-bold text-on-surface">{tHome('features.todoList.title')}</h4>
                <p className="text-on-surface-variant text-sm mt-1">{tHome('features.todoList.description')}</p>
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
            <h5 className="font-headline text-lg font-bold mb-4">{tHome('gardenStatus')}</h5>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-on-surface-variant">{tHome('activeGardens')}</span>
                <span className="text-sm font-bold text-primary">{stats.gardenCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-on-surface-variant">{tHome('totalPlants')}</span>
                <span className="text-sm font-bold text-secondary">{stats.plantCount}</span>
              </div>
            </div>
          </div>

          <div className="bg-primary-container/10 rounded-lg p-6 relative overflow-hidden">
            <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-primary/10 text-8xl">potted_plant</span>
            <h5 className="font-headline text-lg font-bold text-on-primary-container mb-2">{tHome('tip')}</h5>
            <p className="text-sm text-on-primary-container/80 leading-relaxed relative z-10">
              {stats.gardenCount === 0 
                ? tHome('tips.noGardens')
                : stats.plantCount === 0
                ? tHome('tips.noPlants')
                : tHome('tips.regular')}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
