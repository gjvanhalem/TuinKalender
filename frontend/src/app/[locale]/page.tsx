"use client";

import { useState, useEffect, useRef } from 'react';
import { Leaf, Plus, Search, Calendar, Map, ArrowRight, LogIn } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useSession, signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
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

      {/* Feature Section / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className={`${session ? 'md:col-span-8' : 'md:col-span-12'} space-y-6`}>
          {session && (
            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between px-2">
                <h3 className="font-headline text-2xl font-bold">{t('myGardens')}</h3>
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 text-primary hover:bg-primary/5 px-4 py-2 rounded-full transition-colors font-semibold"
                >
                  <span className="material-symbols-outlined">add_circle</span>
                  <span>{t('addGarden')}</span>
                </button>
              </div>
              
              {gardens.length > 0 ? (
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
              ) : (
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
              )}
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
        {session && (
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
        )}
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
