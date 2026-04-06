"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import PlantModal from "@/components/PlantModal";
import PlantInfoModal from "@/components/PlantInfoModal";

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

export default function GardenPlantsPage() {
  const { id: gardenId } = useParams();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [garden, setGarden] = useState<any | null>(null);
  const [allGardens, setAllGardens] = useState<any[]>([]);
  const [userSettings, setUserSettings] = useState<any | null>(null);
  const [plants, setPlants] = useState<Plant[]>([]);
  
  const [isPlantModalOpen, setIsPlantModalOpen] = useState(false);
  const [isPlantInfoModalOpen, setIsPlantInfoModalOpen] = useState(false);
  const [activePlant, setActivePlant] = useState<Partial<Plant> | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [movingPlant, setMovingPlant] = useState<Plant | null>(null);
  const [adminPlantData, setAdminPlantData] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharedUsers, setSharedUsers] = useState<any[]>([]);
  const [shareEmail, setShareEmail] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: keyof Plant, direction: 'asc' | 'desc' } | null>({ key: 'common_name', direction: 'asc' });

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
    }
  }, [session, status, gardenId]);

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
        alert(data.detail || "Kon tuin niet delen");
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
      }
    } catch (error) {
      console.error("Error fetching garden details:", error);
    }
  };

  const fetchPlants = async () => {
    try {
      const response = await fetch(`${API_URL}/plants/?garden_id=${gardenId}`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` }
      });
      const data = await response.json();
      setPlants(Array.isArray(data) ? data : []);
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
    if (!confirm("Weet je zeker dat je deze plant wilt verwijderen?")) return;
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
    if (!confirm(`Weet je zeker dat je ${plant.common_name || 'deze plant'} wilt verplaatsen?`)) return;
    
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
      if (response.ok) {
        fetchPlants();
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
          <p className="text-on-surface font-medium animate-pulse">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-5xl mx-auto">
      {/* Hero Section */}
      <section className="mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <span className="font-label text-sm text-primary font-semibold tracking-[0.2em] uppercase mb-2 block">Mijn Tuin</span>
            <div className="flex items-center gap-4">
              <h2 className="font-headline text-5xl md:text-6xl font-bold tracking-tight text-on-surface">
                {garden?.name || "Laden..."}
              </h2>
              {allGardens.length > 1 && (
                <div className="relative">
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
            {garden?.location && (
              <p className="text-on-surface-variant text-sm flex items-center gap-1 mt-2 font-medium">
                <span className="material-symbols-outlined text-sm">location_on</span>
                {garden.location}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            {garden?.is_owner && (
              <button 
                onClick={() => setShowShareModal(true)}
                className="flex items-center justify-center w-14 h-14 bg-surface-container-high text-on-surface-variant rounded-xl hover:text-secondary transition-all active:scale-95 shadow-sm"
                title="Deel Tuin"
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
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-container text-white px-8 py-4 rounded-xl font-semibold hover:opacity-90 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined">add</span>
              <span>Plant Toevoegen</span>
            </button>
          </div>
        </div>

        {/* Search Area */}
        <div className="relative group">
          <span className="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-outline">search</span>
          <input 
            className="w-full bg-surface-container-high border-none rounded-xl py-5 pl-16 pr-6 focus:ring-2 focus:ring-primary/20 text-lg placeholder:text-outline transition-all" 
            placeholder="Zoek in deze tuin..." 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </section>

      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h3 className="font-headline text-2xl font-bold">Planten in {garden?.name}</h3>
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
              {filteredAndSortedPlants.length} Totaal
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
            <p className="text-on-surface-variant font-medium">Geen planten gevonden.</p>
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
                      src={plant.image_path ? `${API_URL}/${plant.image_path}` : plant.image_url} 
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
                      <h4 className="font-headline text-xl font-bold text-on-surface group-hover:text-primary transition-colors leading-tight">{plant.common_name || "Onbekend"}</h4>
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
                        Bloei: {plant.flowering_months}
                      </span>
                    )}
                    {plant.pruning_months && (
                      <span className="text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">content_cut</span>
                        Snoei: {plant.pruning_months}
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
        showAdminOptions={true}
      />

      {/* Admin Data Modal */}
      {adminPlantData && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-on-surface/40 backdrop-blur-sm">
          <div className="bg-surface w-full max-w-4xl max-h-[80vh] rounded-2xl flex flex-col overflow-hidden editorial-shadow">
            <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center">
              <div>
                <h2 className="font-headline text-2xl font-bold text-on-surface">Plant Ruwe Data</h2>
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
              <h2 className="font-headline text-xl font-bold">Verplaatsen</h2>
              <button onClick={() => setMovingPlant(null)} className="text-on-surface-variant">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-4 space-y-2">
              <p className="text-xs font-bold text-outline uppercase tracking-widest px-2">Kies doeltuin</p>
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
                <p className="p-4 text-sm text-on-surface-variant italic">Geen andere tuinen beschikbaar.</p>
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
                  Tuin Delen
                </h2>
                <p className="text-on-surface-variant text-sm font-medium">Toegang tot {garden?.name}</p>
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
                <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">Gebruiker uitnodigen</label>
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
                    {isSharing ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : "Deel"}
                  </button>
                </div>
              </form>

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-outline uppercase tracking-widest px-1 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">group</span>
                  Toegang
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-container/20 flex items-center justify-center text-primary text-xs font-bold">J</div>
                      <div>
                        <div className="text-sm font-bold text-on-surface">Jij</div>
                        <div className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Eigenaar</div>
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
                          <div className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Bewerker</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeShare(u.id)}
                        className="p-2 text-on-surface-variant hover:text-error transition-all"
                        title="Verwijder"
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
