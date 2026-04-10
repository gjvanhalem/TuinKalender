"use client";

import { useState, useEffect, useRef } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

interface Garden {
  id: number;
  name: string;
  location: string;
  image_path?: string;
  plant_count?: number;
  is_owner: boolean;
  owner_email: string;
  weather?: any;
}

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// Client-side cache to persist data across tab switches within the session
let gardensCache: Garden[] | null = null;

export default function GardensPage() {
  const t = useTranslations('Common');
  const { data: session, status } = useSession();
  const router = useRouter();
  const [gardens, setGardens] = useState<Garden[]>(gardensCache || []);
  const [newGardenName, setNewGardenName] = useState("");
  const [newGardenLocation, setNewGardenLocation] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingGarden, setEditingGarden] = useState<Garden | null>(null);
  const [isLoading, setIsLoading] = useState(!gardensCache);
  
  const [showShareModal, setShowShareModal] = useState(false);
  const [currentSharingGarden, setCurrentSharingGarden] = useState<Garden | null>(null);
  const [sharedUsers, setSharedUsers] = useState<any[]>([]);
  const [shareEmail, setShareEmail] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (session) {
      fetchGardens();
    }
  }, [session, status]);

  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);

  useEffect(() => {
    if (showMapPicker && GOOGLE_MAPS_API_KEY && !window.google) {
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
    } else if (showMapPicker && window.google) {
      setTimeout(initMap, 100);
    }
  }, [showMapPicker]);

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

  const fetchGardens = async () => {
    if (!gardensCache) setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/gardens/`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        const finalData = Array.isArray(data) ? data : [];
        setGardens(finalData);
        gardensCache = finalData;
        
        // Fetch weather for each garden that has a location
        finalData.forEach(async (garden: Garden) => {
          if (garden.location) {
            try {
              const weatherRes = await fetch(`${API_URL}/gardens/${garden.id}/weather`, {
                headers: { Authorization: `Bearer ${session?.accessToken}` },
              });
              if (weatherRes.ok) {
                const weatherData = await weatherRes.json();
                setGardens(prev => prev.map(g => g.id === garden.id ? { ...g, weather: weatherData.current } : g));
              }
            } catch (e) {
              console.error(`Failed to fetch weather for garden ${garden.id}:`, e);
            }
          }
        });
      }
    } catch (error) {
      console.error("Failed to fetch gardens:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingGarden ? "PUT" : "POST";
      const url = editingGarden ? `${API_URL}/gardens/${editingGarden.id}` : `${API_URL}/gardens/`;
      
      const response = await fetch(url, {
        method: method,
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
        setShowModal(false);
        setEditingGarden(null);
        fetchGardens();
      }
    } catch (error) {
      console.error("Failed to save garden:", error);
    }
  };

  const fetchSharedUsers = async (gardenId: number) => {
    try {
      const response = await fetch(`${API_URL}/gardens/${gardenId}/access`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` }
      });
      if (response.ok) {
        setSharedUsers(await response.json());
      }
    } catch (error) {
      console.error("Failed to fetch shared users:", error);
    }
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareEmail || !currentSharingGarden) return;
    setIsSharing(true);
    try {
      const response = await fetch(`${API_URL}/gardens/${currentSharingGarden.id}/share`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.accessToken}` 
        },
        body: JSON.stringify({ email: shareEmail })
      });
      if (response.ok) {
        setShareEmail("");
        fetchSharedUsers(currentSharingGarden.id);
      } else {
        const data = await response.json();
        alert(data.detail || t("couldNotShareGarden"));
      }
    } catch (error) {
      console.error("Failed to share garden:", error);
    }
    setIsSharing(false);
  };

  const removeShare = async (userId: number) => {
    if (!currentSharingGarden) return;
    try {
      const response = await fetch(`${API_URL}/gardens/${currentSharingGarden.id}/share/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.accessToken}` }
      });
      if (response.ok) fetchSharedUsers(currentSharingGarden.id);
    } catch (error) {
      console.error("Failed to remove shared user:", error);
    }
  };

  const deleteGarden = async (id: number) => {
    if (!confirm(t("confirmDeleteGarden"))) return;
    try {
      const response = await fetch(`${API_URL}/gardens/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });
      if (response.ok) {
        fetchGardens();
      }
    } catch (error) {
      console.error("Failed to delete garden:", error);
    }
  };

  const shareGarden = (garden: Garden) => {
    setCurrentSharingGarden(garden);
    setShareEmail("");
    fetchSharedUsers(garden.id);
    setShowShareModal(true);
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-primary text-5xl animate-spin">potted_plant</span>
          <p className="text-on-surface font-medium animate-pulse">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-5xl mx-auto">
      <section className="mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <span className="font-label text-sm text-primary font-semibold tracking-[0.2em] uppercase mb-2 block">{t('myCollection')}</span>
            <h2 className="font-headline text-5xl md:text-6xl font-bold tracking-tight text-on-surface">{t('gardens')}</h2>
          </div>
          <button 
            onClick={() => {
              setEditingGarden(null);
              setNewGardenName("");
              setNewGardenLocation("");
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-white px-8 py-4 rounded-xl font-semibold hover:opacity-90 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined">add</span>
            <span>{t('newGarden')}</span>
          </button>
        </div>

        <div className="relative group">
          <span className="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-outline">search</span>
          <input 
            className="w-full bg-surface-container-high border-none rounded-xl py-5 pl-16 pr-6 focus:ring-2 focus:ring-primary/20 text-lg placeholder:text-outline transition-all" 
            placeholder={t('searchGardensPlaceholder')} 
            type="text"
          />
        </div>
      </section>

      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h3 className="font-headline text-2xl font-bold">{t('myGardens')}</h3>
          <span className="bg-surface-container-lowest border border-outline-variant/15 px-3 py-1 rounded-full text-xs font-medium text-on-surface-variant uppercase tracking-wider">
            {gardens.length} {t('total')}
          </span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface-container-low h-48 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : gardens.length === 0 ? (
          <div className="text-center py-20 bg-surface-container-low/50 rounded-3xl border-2 border-dashed border-outline-variant/20">
            <span className="material-symbols-outlined text-outline text-6xl mb-4">map</span>
            <p className="text-on-surface-variant font-medium">{t('noGardensAdded')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {gardens.map((garden) => (
              <div key={garden.id} className="group bg-surface-container-low rounded-xl p-6 transition-all hover:bg-surface-container-high flex flex-col justify-between editorial-shadow border border-outline-variant/5">
                <div className="flex gap-6 mb-4">
                  {/* Garden Image */}
                  <div className="w-24 h-24 rounded-lg overflow-hidden bg-surface-container-highest shrink-0 border border-outline-variant/10 relative">
                    {garden.image_path ? (
                      <img 
                        src={`${API_URL}/${garden.image_path}`} 
                        alt={garden.name} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-outline">
                        <span className="material-symbols-outlined text-3xl">map</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-grow flex justify-between items-start">
                    <Link href={`/gardens/${garden.id}`} className="flex-grow">
                      <h4 className="font-headline text-2xl font-bold text-on-surface group-hover:text-primary transition-colors flex items-center gap-2">
                        {garden.name}
                        <span className="material-symbols-outlined text-sm opacity-0 group-hover:opacity-100 transition-opacity">arrow_forward_ios</span>
                      </h4>
                      <p className="text-on-surface-variant text-sm flex items-center gap-1 mt-1 font-medium">
                        <span className="material-symbols-outlined text-sm">location_on</span>
                        {garden.location || t('noLocation')}
                      </p>
                      {garden.weather && (
                        <div className="flex items-center gap-2 mt-2 bg-primary/5 px-2 py-1 rounded-lg border border-primary/10 w-fit">
                          <img 
                            src={`https://openweathermap.org/img/wn/${garden.weather.weather[0].icon}.png`} 
                            alt={garden.weather.weather[0].description} 
                            className="w-5 h-5"
                          />
                          <span className="text-xs font-bold text-primary">{Math.round(garden.weather.main.temp)}°C</span>
                        </div>
                      )}
                      {!garden.is_owner && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-secondary-fixed-dim bg-secondary/10 px-2 py-0.5 rounded-full mt-2">
                          {t('sharedBy', { name: garden.owner_email.split('@')[0] })}
                        </span>
                      )}
                    </Link>
                    <div className="flex gap-2">
                      {garden.is_owner && (
                        <>
                          <button
                            onClick={() => {
                              setEditingGarden(garden);
                              setNewGardenName(garden.name);
                              setNewGardenLocation(garden.location);
                              setShowModal(true);
                            }}
                            className="w-10 h-10 rounded-full bg-surface-container-lowest flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-primary-container/20 transition-all"
                          >
                            <span className="material-symbols-outlined text-[20px]">edit</span>
                          </button>
                          <button
                            onClick={() => shareGarden(garden)}
                            className="w-10 h-10 rounded-full bg-surface-container-lowest flex items-center justify-center text-on-surface-variant hover:text-secondary hover:bg-secondary-container/20 transition-all"
                          >
                            <span className="material-symbols-outlined text-[20px]">share</span>
                          </button>
                          <button
                            onClick={() => deleteGarden(garden.id)}
                            className="w-10 h-10 rounded-full bg-surface-container-lowest flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container/20 transition-all"
                          >
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between pt-4 border-t border-outline-variant/10">
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">{t('plants')}</span>
                      <span className="text-xl font-bold text-on-surface">{garden.plant_count || 0}</span>
                    </div>
                  </div>
                  <Link
                    href={`/gardens/${garden.id}`}
                    className="bg-primary/10 text-primary px-6 py-2 rounded-xl font-bold text-sm hover:bg-primary hover:text-white transition-all flex items-center gap-2"
                  >
                    {t('openGarden')}
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-on-surface/40 backdrop-blur-md">
          <div className="bg-surface w-full max-w-lg rounded-2xl p-8 editorial-shadow border border-outline-variant/10">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-headline text-2xl font-bold text-on-surface">
                {editingGarden ? t('editGarden') : t('newGarden')}
              </h3>
              <button 
                onClick={() => {
                  setShowModal(false);
                  setEditingGarden(null);
                }}
                className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex flex-col items-center mb-6">
                 <div className="w-32 h-32 rounded-2xl bg-surface-container-high border-2 border-dashed border-outline-variant/30 flex items-center justify-center overflow-hidden relative group cursor-pointer">
                    {selectedFile ? (
                       <img src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover" />
                    ) : editingGarden?.image_path ? (
                       <img src={`${API_URL}/${editingGarden.image_path}`} className="w-full h-full object-cover" />
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

              <div className="space-y-2">
                <label className="text-sm font-semibold text-on-surface-variant px-1">{t('gardenName')}</label>
                <input
                  type="text"
                  placeholder={t('gardenNameExample')}
                  className="w-full bg-surface-container-high border-none rounded-xl py-4 px-6 focus:ring-2 focus:ring-primary/20 text-on-surface"
                  value={newGardenName}
                  onChange={(e) => setNewGardenName(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-semibold text-on-surface-variant px-1">{t('locationOrCoordinates')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t('locationOrCoordinates')}
                    className="flex-grow bg-surface-container-high border-none rounded-xl py-4 px-6 focus:ring-2 focus:ring-primary/20 text-on-surface"
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
              
              {showMapPicker && (
                <div className="mt-2 overflow-hidden rounded-xl border border-outline-variant/20 h-64 relative">
                  {GOOGLE_MAPS_API_KEY ? (
                    <div ref={mapRef} className="w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-surface-container-low text-on-surface-variant p-6 text-center">
                      <p className="text-sm">{t('googleMapsKeyMissing') || 'Google Maps API key is missing. Please check your configuration.'}</p>
                    </div>
                  )}
                </div>
              )}
              
              <button
                type="submit"
                className="w-full bg-primary text-white py-4 rounded-xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
              >
                <span className="material-symbols-outlined">{editingGarden ? "save" : "add_circle"}</span>
                {editingGarden ? t('saveChanges') : t('createGarden')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-on-surface/40 backdrop-blur-sm">
          <div className="bg-surface w-full max-w-md rounded-2xl overflow-hidden editorial-shadow border border-outline-variant/10">
            <div className="p-8 border-b border-outline-variant/10 flex justify-between items-center bg-secondary/5">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2 text-on-surface">
                  <span className="material-symbols-outlined text-secondary">share</span>
                  {t('shareGarden')}
                </h2>
                <p className="text-on-surface-variant text-sm font-medium">{t('accessTo', { name: currentSharingGarden?.name })}</p>
              </div>
              <button 
                onClick={() => setShowShareModal(false)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-8 space-y-8">
              <form onSubmit={handleShare} className="space-y-2">
                <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">{t('inviteUser')}</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="naam@gmail.com"
                    className="flex-1 p-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-secondary/20 transition-all font-medium outline-none text-on-surface"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    required
                  />
                  <button 
                    disabled={isSharing}
                    className="bg-secondary text-white px-6 rounded-xl font-bold hover:bg-secondary/90 transition-all disabled:opacity-50 flex items-center justify-center min-w-[80px]"
                  >
                    {isSharing ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : t('share')}
                  </button>
                </div>
              </form>

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-outline uppercase tracking-widest px-1 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">group</span>
                  {t('access')}
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-container/20 flex items-center justify-center text-primary text-xs font-bold">
                        {session?.user?.name?.[0]?.toUpperCase() || 'Y'}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-on-surface">{t('you')}</div>
                        <div className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">{t('owner')}</div>
                      </div>
                    </div>
                  </div>
                  {sharedUsers.map(u => (
                    <div key={u.id} className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl group hover:bg-surface-container-high transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary-container/20 flex items-center justify-center text-secondary text-xs font-bold">
                          {u.email[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-on-surface truncate max-w-[150px]">{u.email}</div>
                          <div className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">{t('editor')}</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeShare(u.id)}
                        className="p-2 text-on-surface-variant hover:text-error transition-all"
                        title={t('remove')}
                      >
                        <span className="material-symbols-outlined">person_remove</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
