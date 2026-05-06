"use client";

import { useState, useEffect, useRef } from 'react';
import { Leaf, Plus, Search, Calendar, Map, ArrowRight, LogIn } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useSession, signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import Logo from '@/components/Logo';
import Modal from '@/components/Modal';

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

const categoryIcons: Record<string, string> = {
  "Snoeien": "content_cut",
  "Bloei": "filter_vintage",
  "Planten": "sprout",
  "Zaaien": "sprout",
  "Oogsten": "eco",
  "Water": "water_drop",
  "Voeding": "Nutrition",
  "Verpotten": "potted_plant",
  "Notitie": "sticky_note_2",
  "Taak": "checklist"
};

// Cache to prevent dashboard flashing
let dashboardCache: { 
  gardenCount: number; 
  plantCount: number; 
  userName?: string; 
  gardens?: any[];
  summary?: any;
} | null = null;

export default function Home() {
  const t = useTranslations('Common');
  const tHome = useTranslations('Home');
  const locale = useLocale();
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const [stats, setStats] = useState({ 
    gardenCount: dashboardCache?.gardenCount || 0, 
    plantCount: dashboardCache?.plantCount || 0 
  });
  const [gardens, setGardens] = useState<any[]>(dashboardCache?.gardens || []);
  const [selectedDashboardGardenId, setSelectedDashboardGardenId] = useState<number | null>(null);
  const [userName, setUserName] = useState(dashboardCache?.userName || "");
  const [summary, setSummary] = useState<any>(dashboardCache?.summary || null);
  const [rememberMe, setRememberMe] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newGardenName, setNewGardenName] = useState("");
  const [newGardenLocation, setNewGardenLocation] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);

  useEffect(() => {
    if (selectedFile) {
      const objectUrl = URL.createObjectURL(selectedFile);
      setPreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
    setPreviewUrl(null);
  }, [selectedFile]);

  useEffect(() => {
    if (session) {
      fetchStats();
      fetchUserData();
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      fetchDashboardSummary(selectedDashboardGardenId);
    }
  }, [session, selectedDashboardGardenId]);

  const fetchDashboardSummary = async (gardenId: number | null) => {
    try {
      const url = gardenId ? `${API_URL}/dashboard/summary?garden_id=${gardenId}` : `${API_URL}/dashboard/summary`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
        if (dashboardCache) dashboardCache.summary = data;
        if (!selectedDashboardGardenId && data.garden_id) {
          setSelectedDashboardGardenId(data.garden_id);
        }
      }
    } catch (error) {
      console.error("Error fetching dashboard summary:", error);
    }
  };

  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);

  useEffect(() => {
    if (showAddModal && showMapPicker && GOOGLE_MAPS_API_KEY && !window.google) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (typeof window.initMap === 'function') {
          window.initMap();
        } else {
          initMap();
        }
      };
      document.head.appendChild(script);
    } else if (showAddModal && showMapPicker && window.google) {
      setTimeout(initMap, 100);
    }
  }, [showAddModal, showMapPicker]);

  const initMap = () => {
    if (!mapRef.current || !window.google) return;
    
    let center = { lat: 52.3676, lng: 4.9041 };
    
    const newMap = new window.google.maps.Map(mapRef.current, {
      center: center,
      zoom: 12,
      disableDefaultUI: false,
      clickableIcons: false,
    });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const userLoc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        newMap.setCenter(userLoc);
        newMap.setZoom(15);
      });
    }

    newMap.addListener("click", (e: any) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      handleMapClick(lat, lng);
    });

    setMap(newMap);
  };

  const handleMapClick = (lat: number, lng: number) => {
    setNewGardenLocation(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    if (window.google && window.google.maps) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
        if (status === "OK" && results[0]) {
          setNewGardenLocation(results[0].formatted_address);
        }
      });
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert(t("geolocationNotSupported"));
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setNewGardenLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        
        if (window.google && window.google.maps) {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results: any, status: any) => {
            if (status === "OK" && results[0]) {
              setNewGardenLocation(results[0].formatted_address);
            }
            setIsLocating(false);
          });
        } else {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error("Error getting location", error);
        alert(t("couldNotGetLocation"));
        setIsLocating(false);
      }
    );
  };

  const handleAddGarden = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/gardens/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify({ name: newGardenName, location: newGardenLocation }),
      });
      
      if (response.ok) {
        const savedGarden = await response.json();
        
        if (selectedFile) {
          const formData = new FormData();
          formData.append("file", selectedFile);
          await fetch(`${API_URL}/gardens/${savedGarden.id}/image/`, {
            method: "POST",
            headers: { Authorization: `Bearer ${session?.accessToken}` },
            body: formData,
          });
        }

        setNewGardenName("");
        setNewGardenLocation("");
        setSelectedFile(null);
        setShowAddModal(false);
        setShowMapPicker(false);
        fetchStats();
      }
    } catch (error) {
      console.error("Failed to add garden:", error);
    }
  };

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
              <Link 
                href={gardens.length === 1 ? `/gardens/${gardens[0].id}` : "/gardens"} 
                className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-white px-8 py-4 rounded-xl font-semibold hover:opacity-90 transition-all active:scale-95 text-center justify-center"
              >
                <span className="material-symbols-outlined">potted_plant</span>
                <span>{t('viewGardens')}</span>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <button 
                onClick={() => {
                  if (rememberMe) {
                    document.cookie = "remember-me=true; path=/; max-age=2592000"; // 30 days
                  } else {
                    document.cookie = "remember-me=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
                  }
                  signIn('google');
                }}
                className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-white px-8 py-4 rounded-xl font-semibold hover:opacity-90 transition-all active:scale-95 text-center justify-center"
              >
                <span className="material-symbols-outlined">login</span>
                <span>{t('getStarted')}</span>
              </button>
              <label className="flex items-center gap-2 cursor-pointer select-none group">
                <div className="relative flex items-center justify-center">
                  <input 
                    type="checkbox" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="peer appearance-none w-5 h-5 border-2 border-outline rounded-md checked:bg-primary checked:border-primary transition-all cursor-pointer"
                  />
                  <span className="material-symbols-outlined absolute text-white text-sm opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity">
                    check
                  </span>
                </div>
                <span className="text-sm text-on-surface-variant font-medium group-hover:text-primary transition-colors">
                  {t('rememberMe')}
                </span>
              </label>
            </div>
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

      {/* Dashboard Summary Section */}
      {session && summary?.has_gardens && (
        <section className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center justify-between px-2 mb-6">
            <h3 className="font-headline text-2xl font-bold">{t('dashboardOverview')}</h3>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowAddModal(true)}
                className="hidden sm:flex items-center gap-2 text-primary hover:bg-primary/5 px-4 py-2 rounded-full transition-colors font-semibold text-sm"
              >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                <span>{t('addGarden')}</span>
              </button>
              
              {gardens.length > 1 ? (
                <div className="relative">
                  <select
                    value={selectedDashboardGardenId || ""}
                    onChange={(e) => setSelectedDashboardGardenId(Number(e.target.value))}
                    className="appearance-none bg-surface-container-low text-on-surface-variant text-sm font-bold pl-10 pr-10 py-2 rounded-full border border-outline-variant/10 cursor-pointer hover:bg-surface-container-high transition-colors focus:ring-2 focus:ring-primary/20 outline-none"
                  >
                    {gardens.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary text-sm pointer-events-none">location_on</span>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline-variant text-sm pointer-events-none">unfold_more</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-on-surface-variant text-sm font-bold bg-surface-container-low px-4 py-2 rounded-full border border-outline-variant/10">
                  <span className="material-symbols-outlined text-sm text-primary">location_on</span>
                  {summary.garden_name}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Weather & Advice Card */}
            <div className="bg-surface-container-low rounded-3xl border border-outline-variant/10 overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow">
              <div className="p-6 flex-grow">
                 <div className="flex items-center justify-between mb-4">
                   <h4 className="font-headline text-lg font-bold flex items-center gap-2">
                     <span className="material-symbols-outlined text-primary">cloud</span>
                     {tHome('features.weatherData.title')}
                   </h4>
                   {summary.weather?.forecast?.list && (
                      <div className="text-3xl font-bold text-on-surface">
                        {Math.round(summary.weather.forecast.list[0].main.temp)}°C
                      </div>
                   )}
                 </div>
                 
                 {summary.weather?.forecast?.list && (
                   <div className="flex justify-between mb-6 bg-surface-container-high/30 rounded-2xl p-4">
                      {summary.weather.forecast.list
                        .filter((_: any, index: number) => index % 8 === 0)
                        .slice(0, 5)
                        .map((day: any, idx: number) => (
                          <div key={idx} className="flex flex-col items-center">
                            <span className="text-[10px] font-bold text-outline-variant uppercase tracking-tighter">
                              {new Date(day.dt * 1000).toLocaleDateString(locale, { weekday: 'short' })}
                            </span>
                            <img 
                              src={`https://openweathermap.org/img/wn/${day.weather[0].icon}.png`} 
                              alt={day.weather[0].description} 
                              className="w-10 h-10"
                            />
                            <span className="text-sm font-bold text-on-surface">{Math.round(day.main.temp)}°</span>
                          </div>
                        ))}
                   </div>
                 )}

                 {summary.advice && (
                   <div className="bg-secondary/5 rounded-2xl p-4 border border-secondary/10 relative overflow-hidden group/advice">
                     <div className="absolute top-0 left-0 w-1 h-full bg-secondary opacity-20"></div>
                     <div className="flex items-center gap-2 mb-2">
                       <span className="material-symbols-outlined text-secondary text-sm animate-pulse">auto_awesome</span>
                       <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">{t('smartAdvice')}</span>
                     </div>
                     <p className="text-sm text-on-surface-variant italic leading-relaxed">
                       "{summary.advice.length > 180 ? summary.advice.substring(0, 180) + '...' : summary.advice}"
                     </p>
                   </div>
                 )}
              </div>
              <Link href={`/gardens/${summary.garden_id}`} className="bg-surface-container-high p-4 text-center text-sm font-bold text-primary hover:bg-primary hover:text-white transition-all">
                {t('openGarden')}
              </Link>
            </div>

            {/* Health & Tasks Column */}
            <div className="flex flex-col gap-6">
              {/* Tasks Card */}
              <div className="bg-surface-container-low rounded-3xl border border-outline-variant/10 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-headline text-lg font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">checklist</span>
                    {t('upcomingTasks')}
                  </h4>
                  <Link href="/calendar" className="text-xs font-bold text-primary hover:underline">
                    {t('viewCalendar')}
                  </Link>
                </div>
                
                <div className="space-y-3">
                  {summary.upcoming_tasks?.length > 0 ? (
                    summary.upcoming_tasks.slice(0, 3).map((task: any) => (
                      <div key={task.id} className="flex items-center gap-3 bg-surface-container-high/40 p-3 rounded-2xl border border-outline-variant/5 hover:border-primary/20 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-primary-container/20 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-primary text-xl">
                            {categoryIcons[task.category] || 'task_alt'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-on-surface truncate">{task.description}</p>
                          <p className="text-[10px] text-on-surface-variant font-medium">
                            {task.plant_name} • {task.garden_name}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 bg-surface-container-high/20 rounded-2xl border border-dashed border-outline-variant/20">
                      <p className="text-sm text-on-surface-variant italic">{t('noTasks')}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Health Status Card */}
              <div className={`rounded-3xl border p-6 shadow-sm ${summary.plant_alerts?.length > 0 ? 'bg-error-container/5 border-error/10' : 'bg-surface-container-low border-outline-variant/10'}`}>
                <h4 className={`font-headline text-lg font-bold mb-4 flex items-center gap-2 ${summary.plant_alerts?.length > 0 ? 'text-error' : 'text-on-surface'}`}>
                  <span className="material-symbols-outlined">{summary.plant_alerts?.length > 0 ? 'warning' : 'health_and_safety'}</span>
                  {summary.plant_alerts?.length > 0 ? t('healthAlerts') : t('gardenHealth')}
                </h4>
                
                <div className="space-y-3">
                  {summary.plant_alerts?.length > 0 ? (
                    summary.plant_alerts.map((alert: any) => (
                      <Link key={alert.plant_id} href={`/gardens/${alert.garden_id}`} className="flex items-center justify-between bg-white/40 p-3 rounded-2xl border border-error/5 hover:bg-white transition-all group">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-on-surface truncate group-hover:text-primary transition-colors">{alert.common_name}</p>
                          <p className="text-[10px] text-error font-semibold uppercase tracking-tight">{alert.status}</p>
                        </div>
                        <div className={`text-[10px] font-black w-8 h-8 flex items-center justify-center rounded-full ${alert.health_score < 5 ? 'bg-error text-white' : 'bg-warning text-on-warning'}`}>
                          {alert.health_score}
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-primary">check_circle</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-on-surface">{t('noAlerts')}</p>
                        <p className="text-xs text-on-surface-variant">{summary.garden_health?.overall_health || tHome('features.multipleGardens.description')}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Feature Section / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-12 space-y-6">
          {session && gardens.length === 0 && (
            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between px-2">
                <h3 className="font-headline text-2xl font-bold">{t('myGardens')}</h3>
              </div>
              
              <div className="bg-surface-container-low rounded-2xl p-12 text-center border-2 border-dashed border-outline-variant/20">
                <span className="material-symbols-outlined text-6xl text-outline-variant mb-4">yard</span>
                <p className="text-on-surface-variant font-medium mb-6">{t('noGardensYet')}</p>
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="bg-primary text-white px-8 py-3 rounded-full font-bold hover:opacity-90 transition-all active:scale-95"
                >
                  {t('addFirstGarden')}
                </button>
              </div>
            </div>
          )}

          {!session && (
            <>
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
            </>
          )}
        </div>
      </div>

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={t('addGarden')}>
        <form onSubmit={handleAddGarden} className="space-y-6">
          <div className="flex flex-col items-center mb-6">
             <div className="w-32 h-32 rounded-2xl bg-surface-container-high border-2 border-dashed border-outline-variant/30 flex items-center justify-center overflow-hidden relative group cursor-pointer">
                {previewUrl ? (
                   <img src={previewUrl} className="w-full h-full object-cover" />
                ) : (
                   <span className="material-symbols-outlined text-4xl text-outline">image</span>
                )}
                
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                   <span className="material-symbols-outlined text-white">add_a_photo</span>
                </div>

                {/* Hidden File Input on top */}
                <input 
                   type="file" 
                   accept="image/*" 
                   className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                   onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
             </div>
             <p className="text-[10px] font-bold text-outline uppercase tracking-widest mt-2">{t('clickToChoosePhoto')}</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">{t('gardenName')}</label>
              <input
                type="text"
                placeholder="Mijn Achtertuin"
                className="w-full p-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all text-on-surface font-medium"
                value={newGardenName}
                onChange={(e) => setNewGardenName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">{t('location')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Amsterdam"
                  className="flex-grow p-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all text-on-surface font-medium"
                  value={newGardenLocation}
                  onChange={(e) => setNewGardenLocation(e.target.value)}
                />
                <button
                  type="button"
                  onClick={useCurrentLocation}
                  disabled={isLocating}
                  className="bg-surface-container-highest p-4 rounded-xl text-primary hover:bg-primary-container/20 transition-colors"
                >
                  <span className={`material-symbols-outlined ${isLocating ? 'animate-pulse' : ''}`}>my_location</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowMapPicker(!showMapPicker)}
                  className={`p-4 rounded-xl transition-colors ${showMapPicker ? 'bg-primary text-white' : 'bg-surface-container-highest hover:bg-primary-container/20'}`}
                >
                  <span className="material-symbols-outlined">map</span>
                </button>
              </div>
            </div>
          </div>

          {showMapPicker && (
            <div className="w-full h-64 rounded-xl overflow-hidden border border-outline-variant/20 animate-in fade-in zoom-in duration-300">
              <div ref={mapRef} className="w-full h-full" />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="flex-1 px-6 py-4 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="flex-1 bg-primary text-white px-6 py-4 rounded-xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all"
            >
              {t('add')}
            </button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
