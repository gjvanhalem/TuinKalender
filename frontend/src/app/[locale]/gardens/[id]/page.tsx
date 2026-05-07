"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Link, useRouter } from "@/i18n/routing";
import PlantModal from "@/components/PlantModal";
import PlantInfoModal from "@/components/PlantInfoModal";
import GardenPhotoModal from "@/components/GardenPhotoModal";
import { useTranslations, useLocale } from "next-intl";

interface Plant {
  id: number;
  common_name: string;
  scientific_name: string;
  trefle_id: number;
  location_in_garden: string;
  image_path: string;
  image_url: string;
  remarks?: string;
  flowering_months?: string;
  pruning_months?: string;
  raw_data?: any;
  tasks?: Task[];
}

interface Task {
  id: number;
  month: number;
  category: string;
  description: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Client-side cache to persist data across tab switches within the session
let plantsCache: Record<string, Plant[]> = {};
let gardenCache: Record<string, any> = {};

export default function GardenPlantsPage() {
  const t = useTranslations('Common');
  const locale = useLocale();
  const { id: gardenId } = useParams();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [garden, setGarden] = useState<any | null>(gardenCache[gardenId as string] || null);
  const [allGardens, setAllGardens] = useState<any[]>([]);
  const [userSettings, setUserSettings] = useState<any | null>(null);
  const [plants, setPlants] = useState<Plant[]>(plantsCache[gardenId as string] || []);
  
  const [isPlantModalOpen, setIsPlantModalOpen] = useState(false);
  const [isPlantInfoModalOpen, setIsPlantInfoModalOpen] = useState(false);
  const [activePlant, setActivePlant] = useState<Partial<Plant> | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [movingPlant, setMovingPlant] = useState<Plant | null>(null);
  const [adminPlantData, setAdminPlantData] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState(!plantsCache[gardenId as string]);
  const [weather, setWeather] = useState<any>(null);
  const [aiAdvice, setAiAdvice] = useState<string>("");
  const [isAdviceExpanded, setIsAdviceExpanded] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharedUsers, setSharedUsers] = useState<any[]>([]);
  const [shareEmail, setShareEmail] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: keyof Plant, direction: 'asc' | 'desc' } | null>({ key: 'common_name', direction: 'asc' });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGardenPhotoModalOpen, setIsGardenPhotoModalOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('share') === 'true') {
      setShowShareModal(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (session) {
      fetchGarden();
      fetchPlants();
      fetchUserSettings();
      fetchSharedUsers();
      fetchWeather();
      fetchAiAdvice();
    }
  }, [session, status, gardenId]);

  const fetchAiAdvice = async () => {
    try {
      const response = await fetch(`${API_URL}/gardens/${gardenId}/advice?locale=${locale}`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAiAdvice(data.advice);
      }
    } catch (error) {
      console.error("Error fetching AI advice:", error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`${API_URL}/gardens/${gardenId}/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.accessToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setWeather({ forecast: data.weather });
        setAiAdvice(data.advice);
        // Also show advice if it was hidden
        setIsAdviceExpanded(true);
      } else {
        const errorData = await response.json();
        alert(errorData.detail || "Failed to refresh weather and advice");
      }
    } catch (error) {
      console.error("Error refreshing weather:", error);
    }
    setIsRefreshing(false);
  };

  const fetchWeather = async () => {
    try {
      const response = await fetch(`${API_URL}/gardens/${gardenId}/weather`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` }
      });
      if (response.ok) {
        setWeather(await response.json());
      }
    } catch (error) {
      console.error("Error fetching weather:", error);
    }
  };

  const fetchSharedUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/gardens/${gardenId}/access`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` }
      });
      if (response.ok) {
        setSharedUsers(await response.json());
      }
    } catch (error) {}
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareEmail) return;
    setIsSharing(true);
    try {
      const response = await fetch(`${API_URL}/gardens/${gardenId}/share`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.accessToken}` 
        },
        body: JSON.stringify({ email: shareEmail })
      });
      if (response.ok) {
        setShareEmail("");
        fetchSharedUsers();
      } else {
        const data = await response.json();
        alert(data.detail || t("couldNotShareGarden"));
      }
    } catch (error) {}
    setIsSharing(false);
  };

  const removeShare = async (userId: number) => {
    try {
      const response = await fetch(`${API_URL}/gardens/${gardenId}/share/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.accessToken}` }
      });
      if (response.ok) fetchSharedUsers();
    } catch (error) {}
  };

  const fetchUserSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUserSettings(data);
      }
    } catch (error) {}
  };

  const fetchGarden = async () => {
    try {
      const response = await fetch(`${API_URL}/gardens/`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` }
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setAllGardens(data);
        const currentGarden = data.find((g: any) => g.id.toString() === gardenId);
        setGarden(currentGarden);
        if (currentGarden) {
          gardenCache[gardenId as string] = currentGarden;
        }
      }
    } catch (error) {
      console.error("Error fetching garden details:", error);
    }
  };

  const fetchPlants = async () => {
    if (!plantsCache[gardenId as string]) setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/plants/?garden_id=${gardenId}`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` }
      });
      const data = await response.json();
      const finalData = Array.isArray(data) ? data : [];
      setPlants(finalData);
      plantsCache[gardenId as string] = finalData;
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching plants:", error);
      setPlants([]);
      setIsLoading(false);
    }
  };

  const handleSavePlant = async (plantData: Partial<Plant>, file: File | null) => {
    try {
      const isUpdating = !!plantData.id;
      const url = isUpdating ? `${API_URL}/plants/${plantData.id}` : `${API_URL}/plants/`;
      const method = isUpdating ? "PUT" : "POST";

      const response = await fetch(url, {
        method: method,
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.accessToken}`
        },
        body: JSON.stringify({
          ...plantData,
          garden_id: parseInt(gardenId as string),
        }),
      });
      if (response.ok) {
        const savedPlant = await response.json();
        const plantToUploadId = isUpdating ? (plantData.id as number) : savedPlant.id;
        
        if (file) {
          await handleImageUpload(plantToUploadId, file);
        }
        setIsPlantModalOpen(false);
        setActivePlant(null);
        fetchPlants();
      }
    } catch (error) {
      console.error("Error adding/updating plant:", error);
    }
  };

  const deletePlant = async (id: number) => {
    if (!confirm(t("confirmDeletePlant") || "Weet je zeker dat je deze plant wilt verwijderen?")) return;
    try {
      await fetch(`${API_URL}/plants/${id}`, { 
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.accessToken}` }
      });
      fetchPlants();
      setIsPlantInfoModalOpen(false);
    } catch (error) {
      console.error("Error deleting plant:", error);
    }
  };

  const startEditPlant = (plant: Plant) => {
    setActivePlant(plant);
    setIsEditing(true);
    setIsPlantModalOpen(true);
    setIsPlantInfoModalOpen(false);
  };

  const startViewPlant = (plant: Plant) => {
    setActivePlant(plant);
    setIsPlantInfoModalOpen(true);
  };

  const movePlant = async (plant: Plant, targetGardenId: number) => {
    if (!confirm(t("confirmMovePlant", { name: plant.common_name || 'deze plant' }) || `Weet je zeker dat je ${plant.common_name || 'deze plant'} wilt verplaatsen?`)) return;
    
    try {
      const response = await fetch(`${API_URL}/plants/${plant.id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.accessToken}`
        },
        body: JSON.stringify({
          garden_id: targetGardenId
        }),
      });
      if (response.ok) {
        setMovingPlant(null);
        fetchPlants();
      }
    } catch (error) {
      console.error("Error moving plant:", error);
    }
  };

  const handleImageUpload = async (plant_id: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_URL}/plants/${plant_id}/image/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.accessToken}` },
        body: formData,
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
        console.error(`Image upload failed (${response.status}):`, errorBody);
      }
    } catch (error) {
      console.error("Error uploading image:", error);
    }
  };

  const filteredAndSortedPlants = plants
    .filter(plant => {
      const searchStr = searchTerm.toLowerCase();
      return (
        plant.common_name?.toLowerCase().includes(searchStr) ||
        plant.scientific_name?.toLowerCase().includes(searchStr) ||
        plant.location_in_garden?.toLowerCase().includes(searchStr) ||
        plant.remarks?.toLowerCase().includes(searchStr)
      );
    })
    .sort((a, b) => {
      if (!sortConfig) return 0;
      const { key, direction } = sortConfig;
      
      const valA = (a[key] || "").toString().toLowerCase();
      const valB = (b[key] || "").toString().toLowerCase();
      
      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

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
    <main className="pt-20 md:pt-24 pb-32 px-4 md:px-6 max-w-5xl mx-auto">
      {/* Hero Section */}
      <section className="mb-8 md:mb-12">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div className="flex items-center gap-4 md:gap-6 min-w-0">
            {garden?.image_path && (
              <div className="w-16 h-16 md:w-24 md:h-24 rounded-2xl overflow-hidden border border-outline-variant/10 shrink-0 shadow-sm">
                <img src={`${API_URL}/${garden.image_path}`} alt={garden.name} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="min-w-0 flex-grow">
              <span className="font-label text-xs md:text-sm text-primary font-semibold tracking-[0.2em] uppercase mb-1 md:mb-2 block">{t('myGarden') || "Mijn Tuin"}</span>
              <div className="flex items-center gap-2 md:gap-4 min-w-0">
                <h2 className="font-headline text-3xl sm:text-4xl md:text-6xl font-bold tracking-tight text-on-surface truncate">
                  {garden?.name || t('loading')}
                </h2>
                {allGardens.length > 1 && (
                  <div className="relative shrink-0">
                    <select
                      value={gardenId}
                      onChange={(e) => router.push(`/gardens/${e.target.value}`)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    >
                      {allGardens.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors">swap_horiz</span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 md:gap-4 mt-1 md:mt-2">
                {garden?.location && (
                  <p className="text-on-surface-variant text-xs md:text-sm flex items-center gap-1 font-medium truncate">
                    <span className="material-symbols-outlined text-xs md:text-sm text-outline">location_on</span>
                    {garden.location}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 md:gap-3 flex-wrap sm:flex-nowrap">
            {(userSettings?.openrouter_key || userSettings?.openai_key) && (
              <button
                onClick={() => setIsGardenPhotoModalOpen(true)}
                className="flex items-center justify-center w-12 h-12 md:w-14 md:h-14 bg-surface-container-high text-on-surface-variant rounded-xl hover:text-primary transition-all active:scale-95 shadow-sm shrink-0"
                title={t('photo.analyzeGarden')}
              >
                <span className="material-symbols-outlined">photo_camera</span>
              </button>
            )}
            {garden?.is_owner && (
              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center justify-center w-12 h-12 md:w-14 md:h-14 bg-surface-container-high text-on-surface-variant rounded-xl hover:text-secondary transition-all active:scale-95 shadow-sm shrink-0"
                title={t('shareGarden')}
              >
                <span className="material-symbols-outlined">share</span>
              </button>
            )}
            <button
              onClick={() => {
                setActivePlant({ common_name: "", scientific_name: "" });
                setIsEditing(false);
                setIsPlantModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary-container text-white px-4 md:px-8 py-3 md:py-4 rounded-xl font-semibold hover:opacity-90 transition-all active:scale-95 flex-grow sm:flex-grow-0"
            >
              <span className="material-symbols-outlined">add</span>
              <span className="text-sm md:text-base">{t('addPlant') || "Plant Toevoegen"}</span>
            </button>
          </div>
        </div>

        {/* Compact Dashboard Section */}
        {(weather?.forecast || aiAdvice) && (
          <div className="mb-6 bg-surface-container-low rounded-2xl border border-outline-variant/10 editorial-shadow overflow-hidden animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-outline-variant/10">
              {/* Weather Forecast (5 days) - More Compact */}
              {weather?.forecast?.list && (
                <div className="flex-grow p-3 md:p-4 overflow-x-auto scrollbar-none">
                  <div className="flex items-center gap-6 md:gap-10 min-w-max px-2">
                    {weather.forecast.list
                      .filter((_: any, index: number) => index % 8 === 0)
                      .slice(0, 5)
                      .map((day: any, idx: number) => (
                        <div key={idx} className="flex flex-row md:flex-col items-center gap-2 md:gap-0">
                          <p className="text-[10px] font-bold text-outline uppercase tracking-wider md:mb-1 w-8 md:w-auto">
                            {new Date(day.dt * 1000).toLocaleDateString(locale, { weekday: 'short' })}
                          </p>
                          <img 
                            src={`https://openweathermap.org/img/wn/${day.weather[0].icon}.png`} 
                            alt={day.weather[0].description} 
                            className="w-8 h-8"
                          />
                          <p className="text-xs font-bold text-on-surface">{Math.round(day.main.temp)}°</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* AI Advice Toggle - Slimmer */}
              {(aiAdvice || isRefreshing) && (
                <div className="flex divide-x divide-outline-variant/10 shrink-0">
                  <button 
                    onClick={() => setIsAdviceExpanded(!isAdviceExpanded)}
                    className={`px-4 py-3 md:px-6 flex items-center gap-3 transition-all hover:bg-surface-container-high ${isAdviceExpanded ? 'bg-secondary/5 text-secondary' : 'text-on-surface-variant'}`}
                  >
                    <span className="material-symbols-outlined text-secondary text-xl">auto_awesome</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest">{t('smartAdvice') || "Slim Advies"}</span>
                    <span className={`material-symbols-outlined text-sm transition-transform duration-300 ${isAdviceExpanded ? 'rotate-180' : ''}`}>
                      expand_more
                    </span>
                  </button>
                  <button 
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="px-4 py-3 flex items-center justify-center text-outline hover:text-primary transition-all active:scale-95 disabled:opacity-50"
                    title={t('refresh')}
                  >
                    <span className={`material-symbols-outlined text-xl ${isRefreshing ? 'animate-spin' : ''}`}>
                      refresh
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Expanded AI Advice Content - More Compact */}
            {aiAdvice && isAdviceExpanded && (
              <div className="px-5 pb-4 pt-1 animate-in slide-in-from-top-2 duration-300 bg-secondary/5 border-t border-secondary/10">
                <p className="text-sm text-on-surface leading-relaxed italic border-l-2 border-secondary/30 pl-4 py-1">
                  {aiAdvice}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Search Area */}
        <div className="relative group">
          <span className="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-outline">search</span>
          <input 
            className="w-full bg-surface-container-high border-none rounded-xl py-5 pl-16 pr-6 focus:ring-2 focus:ring-primary/20 text-lg placeholder:text-outline transition-all" 
            placeholder={t('searchInGardenPlaceholder') || "Zoek in deze tuin..."} 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </section>

      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h3 className="font-headline text-2xl font-bold">{t('plantsIn', { name: garden?.name }) || `Planten in ${garden?.name}`}</h3>
          <div className="flex items-center gap-4">
            <div className="flex bg-surface-container-high p-1 rounded-xl">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-surface text-primary' : 'text-on-surface-variant'}`}
              >
                <span className="material-symbols-outlined">grid_view</span>
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-surface text-primary' : 'text-on-surface-variant'}`}
              >
                <span className="material-symbols-outlined">list</span>
              </button>
            </div>
            <span className="bg-surface-container-lowest border border-outline-variant/15 px-3 py-1 rounded-full text-xs font-medium text-on-surface-variant uppercase tracking-wider">
              {filteredAndSortedPlants.length} {t('total')}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface-container-low h-64 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredAndSortedPlants.length === 0 ? (
          <div className="text-center py-20 bg-surface-container-low/50 rounded-3xl border-2 border-dashed border-outline-variant/20">
            <span className="material-symbols-outlined text-outline text-6xl mb-4">park</span>
            <p className="text-on-surface-variant font-medium">{t('noPlantsFound') || "Geen planten gevonden."}</p>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
            {filteredAndSortedPlants.map((plant) => (
              <div 
                key={plant.id} 
                className={`group bg-surface-container-low rounded-xl p-2 transition-all hover:bg-surface-container-high flex ${viewMode === 'grid' ? 'flex-col' : 'items-center gap-4'} editorial-shadow border border-outline-variant/5 cursor-pointer`}
                onClick={() => startViewPlant(plant)}
              >
                <div className={`${viewMode === 'grid' ? 'w-full aspect-[4/3]' : 'w-24 h-24'} rounded-lg overflow-hidden flex-shrink-0 relative`}>
                  {plant.image_path || plant.image_url ? (
                    <img 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                      src={plant.image_path ? (plant.image_path.startsWith('http') ? plant.image_path : `${API_URL}/${plant.image_path.replace(/^\/+/, '')}`) : plant.image_url} 
                      alt={plant.common_name} 
                    />
                  ) : (
                    <div className="w-full h-full bg-surface-container-highest flex items-center justify-center text-outline">
                      <span className="material-symbols-outlined text-3xl">image</span>
                    </div>
                  )}
                  {plant.location_in_garden && viewMode === 'grid' && (
                    <div className="absolute top-2 left-2 bg-surface/90 backdrop-blur-sm px-2 py-1 rounded-full text-[10px] font-bold text-on-surface border border-outline-variant/10 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">location_on</span>
                      {plant.location_in_garden}
                    </div>
                  )}
                </div>
                
                <div className={`flex-grow ${viewMode === 'grid' ? 'p-4' : 'pr-4'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-headline text-xl font-bold text-on-surface group-hover:text-primary transition-colors leading-tight">{plant.common_name || t('unknown')}</h4>
                      <p className="text-secondary font-medium italic text-sm line-clamp-1">{plant.scientific_name}</p>
                    </div>
                    {viewMode === 'grid' && (
                      <div className="flex gap-2">
                        <div className="w-8 h-8 rounded-full bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm">
                          <span className="material-symbols-outlined text-[18px]">info</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-2 flex flex-wrap gap-2">
                    {plant.flowering_months && (
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">filter_vintage</span>
                        {t('bloom')}: {plant.flowering_months}
                      </span>
                    )}
                    {plant.pruning_months && (
                      <span className="text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">content_cut</span>
                        {t('pruning')}: {plant.pruning_months}
                      </span>
                    )}
                  </div>

                  {viewMode === 'list' && plant.location_in_garden && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-on-surface-variant font-medium">
                      <span className="material-symbols-outlined text-[12px]">location_on</span>
                      {plant.location_in_garden}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB - Contextual add button for mobile */}
      <button 
        onClick={() => {
          setActivePlant({ common_name: "", scientific_name: "" });
          setIsEditing(false);
          setIsPlantModalOpen(true);
        }}
        className="fixed bottom-24 right-6 w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center editorial-shadow hover:scale-105 active:scale-95 transition-all md:hidden z-[60]"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>add</span>
      </button>

      {/* Modals */}
      <PlantModal
        isOpen={isPlantModalOpen}
        onClose={() => {
          setIsPlantModalOpen(false);
          setActivePlant(null);
        }}
        plant={activePlant}
        onSave={handleSavePlant}
        isEditing={isEditing}
        userSettings={userSettings}
        gardenId={parseInt(gardenId as string)}
        API_URL={API_URL}
        accessToken={session?.accessToken as string}
      />

      <PlantInfoModal
        isOpen={isPlantInfoModalOpen}
        onClose={() => {
          setIsPlantInfoModalOpen(false);
          setActivePlant(null);
        }}
        plant={activePlant as Plant}
        onEdit={startEditPlant}
        onDelete={deletePlant}
        onViewRawData={setAdminPlantData}
        onMove={setMovingPlant}
        API_URL={API_URL}
        accessToken={session?.accessToken as string}
        showAdminOptions={userSettings?.is_admin}
      />

      {garden && (
        <GardenPhotoModal
          isOpen={isGardenPhotoModalOpen}
          onClose={() => setIsGardenPhotoModalOpen(false)}
          gardenId={garden.id}
          gardenName={garden.name}
          API_URL={API_URL}
          accessToken={session?.accessToken as string}
        />
      )}

      {/* Admin Data Modal */}
      {adminPlantData && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-on-surface/40 backdrop-blur-sm">
          <div className="bg-surface w-full max-w-4xl max-h-[80vh] rounded-2xl flex flex-col overflow-hidden editorial-shadow">
            <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center">
              <div>
                <h2 className="font-headline text-2xl font-bold text-on-surface">{t('rawData')}</h2>
                <p className="text-on-surface-variant text-sm font-medium">Trefle.io JSON</p>
              </div>
              <button 
                onClick={() => setAdminPlantData(null)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-grow overflow-auto p-6 bg-surface-dim">
              <pre className="text-xs text-on-surface font-mono whitespace-pre-wrap">
                {JSON.stringify(adminPlantData, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Move Plant Modal */}
      {movingPlant && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-on-surface/40 backdrop-blur-sm">
          <div className="bg-surface w-full max-w-sm rounded-2xl overflow-hidden editorial-shadow">
            <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center">
              <h2 className="font-headline text-xl font-bold">{t('move') || "Verplaatsen"}</h2>
              <button onClick={() => setMovingPlant(null)} className="text-on-surface-variant">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-4 space-y-2">
              <p className="text-xs font-bold text-outline uppercase tracking-widest px-2">{t('chooseTargetGarden') || "Kies doeltuin"}</p>
              {allGardens
                .filter(g => g.id.toString() !== gardenId)
                .map(g => (
                  <button
                    key={g.id}
                    onClick={() => movePlant(movingPlant, g.id)}
                    className="w-full p-4 text-left bg-surface-container-low hover:bg-primary-container/10 rounded-xl transition-all flex items-center justify-between group"
                  >
                    <span className="font-bold text-on-surface">{g.name}</span>
                    <span className="material-symbols-outlined text-outline group-hover:translate-x-1 transition-transform">chevron_right</span>
                  </button>
                ))
              }
              {allGardens.length <= 1 && (
                <p className="p-4 text-sm text-on-surface-variant italic">{t('noOtherGardensAvailable') || "Geen andere tuinen beschikbaar."}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-on-surface/40 backdrop-blur-sm">
          <div className="bg-surface w-full max-w-md rounded-2xl overflow-hidden editorial-shadow border border-outline-variant/10">
            <div className="p-8 border-b border-outline-variant/10 flex justify-between items-center bg-secondary/5">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">share</span>
                  {t('shareGarden')}
                </h2>
                <p className="text-on-surface-variant text-sm font-medium">{t('accessTo', { name: garden?.name })}</p>
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
                    className="flex-1 p-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-secondary/20 transition-all font-medium outline-none"
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
