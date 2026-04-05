"use client";

import { useState, useEffect } from "react";
import { 
  Plus, Search, MapPin, Leaf, Camera, ExternalLink, X, Check, Trash2, Edit2, 
  Info, Sparkles, LayoutGrid, List, ArrowUpDown, Filter, ChevronDown, Move, 
  ArrowRight, Share2, UserMinus, Users
} from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

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

interface TreflePlant {
  id: number;
  common_name: string;
  scientific_name: string;
  image_url: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function GardenPlantsPage() {
  const { id: gardenId } = useParams();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // ... rest of state stays same ...

  useEffect(() => {
    if (searchParams.get('share') === 'true') {
      setShowShareModal(true);
    }
  }, [searchParams]);
  const [garden, setGarden] = useState<any | null>(null);
  const [allGardens, setAllGardens] = useState<any[]>([]);
  const [userSettings, setUserSettings] = useState<any | null>(null);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TreflePlant[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState<Partial<Plant> | null>(null);
  const [editingPlantId, setEditingPlantId] = useState<number | null>(null);
  const [movingPlant, setMovingPlant] = useState<Plant | null>(null);
  const [adminPlantData, setAdminPlantData] = useState<any | null>(null);
  const [newPlantLocation, setNewPlantLocation] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [isLoading, setIsLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharedUsers, setSharedUsers] = useState<any[]>([]);
  const [shareEmail, setShareEmail] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  // Sorting and Filtering states
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: keyof Plant, direction: 'asc' | 'desc' } | null>({ key: 'common_name', direction: 'asc' });

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

  useEffect(() => {
    if (!selectedFile) {
      setImagePreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedFile);
    setImagePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

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

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = selectedPlant?.scientific_name || selectedPlant?.common_name || searchQuery;
    if (!query) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(`${API_URL}/search-plants/?query=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` }
      });
      const data = await response.json();
      const results = Array.isArray(data) ? data : [];
      setSearchResults(results);
      if (results.length > 0) setShowSearchModal(true);
      setIsSearching(false);
    } catch (error) {
      console.error("Error searching plants:", error);
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  const selectPlantFromSearch = (plant: TreflePlant) => {
    setSelectedPlant({
      common_name: plant.common_name,
      scientific_name: plant.scientific_name,
      trefle_id: plant.id,
      image_url: plant.image_url,
      flowering_months: "",
      pruning_months: "",
      remarks: "",
    });
    setSearchResults([]);
    setShowSearchModal(false);
    setSearchQuery("");
    setSelectedFile(null);
    setImagePreview(null);
  };

  const addPlant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlant) return;

    try {
      const url = editingPlantId ? `${API_URL}/plants/${editingPlantId}` : `${API_URL}/plants/`;
      const method = editingPlantId ? "PUT" : "POST";

      const response = await fetch(url, {
        method: method,
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.accessToken}`
        },
        body: JSON.stringify({
          ...selectedPlant,
          garden_id: parseInt(gardenId as string),
          location_in_garden: newPlantLocation,
        }),
      });
      if (response.ok) {
        const savedPlant = await response.json();
        const plantToUploadId = editingPlantId || savedPlant.id;
        
        // If a file was selected, upload it now
        if (selectedFile) {
          await handleImageUpload(plantToUploadId, selectedFile);
        }

        setSelectedPlant(null);
        setEditingPlantId(null);
        setNewPlantLocation("");
        setSelectedFile(null);
        setImagePreview(null);
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
    } catch (error) {
      console.error("Error deleting plant:", error);
    }
  };

  const startEditPlant = (plant: Plant) => {
    setEditingPlantId(plant.id);
    setSelectedPlant({
      common_name: plant.common_name,
      scientific_name: plant.scientific_name,
      trefle_id: plant.trefle_id,
      flowering_months: plant.flowering_months,
      pruning_months: plant.pruning_months,
      remarks: plant.remarks,
      image_path: plant.image_path,
      image_url: plant.image_url,
    });
    setNewPlantLocation(plant.location_in_garden);
    setSelectedFile(null);
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

  const getAiSuggestions = async () => {
    if (!selectedPlant?.common_name && !selectedPlant?.scientific_name) return;
    
    setIsAiLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/ai-suggest/?common_name=${encodeURIComponent(selectedPlant.common_name || "")}&scientific_name=${encodeURIComponent(selectedPlant.scientific_name || "")}`,
        { headers: { Authorization: `Bearer ${session?.accessToken}` } }
      );
      const data = await response.json();
      
      if (data && !data.error) {
        const cleanMonths = (val: any) => {
          if (Array.isArray(val)) return val.join(",");
          return String(val).replace("[", "").replace("]", "").replace("{", "").replace("}", "");
        };

        setSelectedPlant({
          ...selectedPlant,
          common_name: data.dutch_name || selectedPlant.common_name,
          flowering_months: cleanMonths(data.flowering_months || selectedPlant.flowering_months || ""),
          pruning_months: cleanMonths(data.pruning_months || selectedPlant.pruning_months || ""),
          remarks: data.remarks || selectedPlant.remarks,
        });
      }
    } catch (error) {
      console.error("Error fetching AI suggestions:", error);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Filter and Sort Logic
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

  const requestSort = (key: keyof Plant) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  if (status === "loading") return <div className="p-12 text-center text-garden-green-700 font-bold">Laden...</div>;

  return (
    <div className="container mx-auto p-6 md:p-12 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 mb-2 flex items-center gap-3">
            <div className="bg-garden-green-100 p-2 rounded-2xl">
              <Leaf className="w-8 h-8 text-garden-green-600" />
            </div>
            {allGardens.length > 1 ? (
              <div className="relative inline-block group">
                <select
                  value={gardenId}
                  onChange={(e) => router.push(`/gardens/${e.target.value}`)}
                  className="appearance-none bg-transparent pr-10 focus:outline-none cursor-pointer hover:text-garden-green-700 transition-colors font-black text-slate-900 border-none p-0 m-0 leading-tight"
                >
                  {allGardens.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-6 h-6 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-garden-green-600 transition-colors" />
              </div>
            ) : (
              garden ? garden.name : "Tuinplanten"
            )}
          </h1>
          {garden?.location && (
            <p className="text-slate-500 font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4 text-garden-green-500" /> {garden.location}
            </p>
          )}
        </div>
        
        <div className="flex gap-4 items-center">
          {/* Quick Filter */}
          <div className="hidden md:flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
            <Filter className="w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Snel filteren..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-600 outline-none w-40"
            />
          </div>

          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-garden-green-100 text-garden-green-600' : 'text-slate-400 hover:text-slate-600'}`}
              title="Kaartweergave"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-garden-green-100 text-garden-green-600' : 'text-slate-400 hover:text-slate-600'}`}
              title="Lijstweergave"
            >
              <List className="w-5 h-5" />
            </button>
          </div>

          {garden?.is_owner && (
            <button 
              onClick={() => setShowShareModal(true)}
              className="bg-white text-slate-600 hover:bg-slate-50 px-4 py-3 rounded-xl font-bold flex items-center gap-2 transition-all border border-slate-200 shadow-sm"
            >
              <Share2 className="w-5 h-5 text-blue-500" />
              <span className="hidden sm:inline">Delen</span>
            </button>
          )}

          <button 
            onClick={() => {
              if (selectedPlant || editingPlantId) {
                setSelectedPlant(null);
                setEditingPlantId(null);
                setNewPlantLocation("");
                setSelectedFile(null);
                setImagePreview(null);
              } else {
                setSelectedPlant({ common_name: "", scientific_name: "" });
              }
            }}
            className={`${(selectedPlant || editingPlantId) ? 'bg-slate-200 text-slate-600' : 'bg-garden-green-600 text-white'} hover:opacity-90 px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg`}
          >
            {(selectedPlant || editingPlantId) ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            {(selectedPlant || editingPlantId) ? "Annuleren" : "Nieuwe Plant Toevoegen"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left Column: Form & Search Results */}
        <div className={`lg:col-span-4 space-y-8 ${(selectedPlant || editingPlantId) ? '' : 'hidden lg:block'}`}>
          {(selectedPlant || editingPlantId) && (
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 animate-in fade-in slide-in-from-left-4">
              <h2 className="text-2xl font-black text-slate-900 mb-6">{editingPlantId ? "Plant Bewerken" : "Plantgegevens"}</h2>
              
              {!editingPlantId && !userSettings?.openrouter_key && !userSettings?.openai_key && (
                <div className="mb-6 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
                    Voeg een <strong>AI API Key</strong> toe bij instellingen om deze plant automatisch te laten analyseren door AI voor bloei- en snoeiadvies.
                  </p>
                </div>
              )}

              {!editingPlantId && (selectedPlant.common_name || selectedPlant.scientific_name) && (userSettings?.openrouter_key || userSettings?.openai_key) && (
                <button
                  type="button"
                  onClick={getAiSuggestions}
                  disabled={isAiLoading}
                  className={`w-full mb-6 py-3 px-4 bg-gradient-to-r ${userSettings?.ai_provider === 'openai' ? 'from-green-600 to-emerald-600' : 'from-blue-600 to-indigo-600'} text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-50`}
                >
                  {isAiLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <Sparkles className="w-5 h-5" />
                  )}
                  {isAiLoading ? "AI is aan het denken..." : `Vul aan met AI (${userSettings?.ai_provider === 'openai' ? 'OpenAI' : 'OpenRouter'})`}
                </button>
              )}

              <form onSubmit={addPlant} className="flex flex-col gap-6">
                {/* Image Upload Area in Form */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Foto</label>
                  <div className="relative aspect-video w-full rounded-2xl bg-slate-100 overflow-hidden group/img">
                    {imagePreview ? (
                      <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                    ) : selectedPlant.image_path ? (
                      <img src={`${API_URL}/${selectedPlant.image_path}`} className="w-full h-full object-cover" alt="Current" />
                    ) : selectedPlant.image_url ? (
                      <img src={selectedPlant.image_url} className="w-full h-full object-cover opacity-70" alt="Trefle" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Camera className="w-10 h-10" />
                      </div>
                    )}
                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer text-white font-bold text-sm gap-2">
                      <Camera className="w-5 h-5" />
                      { (selectedFile || selectedPlant.image_path || selectedPlant.image_url) ? "Foto wijzigen" : "Foto uploaden" }
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*" 
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} 
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Wetenschappelijke Naam</label>
                    {!userSettings?.trefle_token && (
                      <div className="group relative">
                        <Info className="w-3 h-3 text-slate-300 cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg shadow-xl z-50">
                          Voeg een Trefle API token toe bij instellingen om automatisch plantgegevens te zoeken.
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Lavandula angustifolia"
                      className="flex-grow p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-garden-green-500 transition-all font-medium"
                      value={selectedPlant.scientific_name || ""}
                      onChange={(e) => setSelectedPlant({ ...selectedPlant, scientific_name: e.target.value })}
                    />
                    {!editingPlantId && (
                      <button
                        type="button"
                        onClick={handleSearch}
                        disabled={isSearching || (!selectedPlant.scientific_name && !selectedPlant.common_name) || !userSettings?.trefle_token}
                        className="bg-garden-green-100 text-garden-green-600 p-3 rounded-xl hover:bg-garden-green-200 transition-all disabled:opacity-30"
                        title={userSettings?.trefle_token ? "Zoek gegevens in Trefle" : "Voeg eerst een Trefle token toe bij instellingen"}
                      >
                        {isSearching ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-garden-green-600"></div> : <Search className="w-5 h-5" />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Nederlandse Naam</label>
                  <input
                    type="text"
                    placeholder="Echte Lavendel"
                    className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-garden-green-500 transition-all font-medium"
                    value={selectedPlant.common_name || ""}
                    onChange={(e) => setSelectedPlant({ ...selectedPlant, common_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Locatie in Tuin</label>
                  <input
                    type="text"
                    placeholder="Zonnige border, noordzijde"
                    className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-garden-green-500 transition-all font-medium"
                    value={newPlantLocation}
                    onChange={(e) => setNewPlantLocation(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Bloeimaanden</label>
                    <input
                      type="text"
                      placeholder="bijv: 4,5,6"
                      className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-garden-green-500 transition-all font-medium"
                      value={selectedPlant.flowering_months || ""}
                      onChange={(e) => setSelectedPlant({ ...selectedPlant, flowering_months: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Snoeimaanden</label>
                    <input
                      type="text"
                      placeholder="bijv: 3,10"
                      className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-garden-green-500 transition-all font-medium"
                      value={selectedPlant.pruning_months || ""}
                      onChange={(e) => setSelectedPlant({ ...selectedPlant, pruning_months: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Opmerkingen</label>
                  <textarea
                    placeholder="Extra informatie over verzorging..."
                    rows={3}
                    className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-garden-green-500 transition-all font-medium"
                    value={selectedPlant.remarks || ""}
                    onChange={(e) => setSelectedPlant({ ...selectedPlant, remarks: e.target.value })}
                  />
                </div>
                <button
                  type="submit"
                  className="mt-4 w-full bg-garden-green-600 hover:bg-garden-green-700 text-white p-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-garden-green-600/20"
                >
                  <Check className="w-5 h-5" />
                  Plant Opslaan
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right Column: Plant Inventory */}
        <div className={`${selectedPlant || searchResults.length > 0 ? 'lg:col-span-8' : 'lg:col-span-12'}`}>
          {isLoading ? (
            <div className="flex justify-center py-24">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-garden-green-600"></div>
            </div>
          ) : plants.length === 0 ? (
            <div className="bg-white rounded-[60px] p-24 border border-dashed border-slate-200 text-center flex flex-col items-center">
              <div className="bg-slate-50 p-8 rounded-full mb-8">
                <Leaf className="w-16 h-16 text-slate-200" />
              </div>
              <h3 className="text-3xl font-black text-slate-900 mb-4">Nog geen planten hier</h3>
              <p className="text-slate-500 max-w-sm font-medium">Gebruik de zoekfunctie om planten uit de Trefle database te vinden en aan je tuin toe te voegen.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {filteredAndSortedPlants.map((plant) => (
                <div key={plant.id} className="group bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-500">
                  <div className="aspect-[4/3] relative bg-slate-100 overflow-hidden">
                    {plant.image_path ? (
                      <img src={`${API_URL}/${plant.image_path}`} alt={plant.common_name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    ) : plant.image_url ? (
                      <img src={plant.image_url} alt={plant.common_name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center">
                        <div className="bg-white/50 backdrop-blur-sm p-4 rounded-full mb-3 text-slate-300">
                          <Camera className="w-8 h-8" />
                        </div>
                        <label className="cursor-pointer bg-white px-4 py-2 rounded-xl text-sm font-bold text-garden-green-600 shadow-sm hover:bg-garden-green-50 transition-colors border border-garden-green-50">
                          Foto Toevoegen
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(plant.id, file);
                            }}
                          />
                        </label>
                      </div>
                    )}
                    {/* Floating badge for location */}
                    {plant.location_in_garden && (
                      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-garden-green-700 shadow-sm flex items-center gap-1.5 border border-white">
                        <MapPin className="w-3 h-3" /> {plant.location_in_garden}
                      </div>
                    )}
                  </div>
                  <div className="p-8">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="text-2xl font-black text-slate-900 leading-tight truncate">{plant.common_name || "Onbekende Plant"}</h3>
                      <div className="flex gap-2 shrink-0 ml-4">
                        <button onClick={() => startEditPlant(plant)} className="p-2 bg-amber-50 text-amber-600 rounded-full hover:bg-amber-100 transition-colors">
                           <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => deletePlant(plant.id)} className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-colors">
                           <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-slate-400 italic font-medium mb-6 truncate">{plant.scientific_name}</p>
                    
                    <div className="space-y-3 mb-6">
                      {(plant.flowering_months || plant.pruning_months) && (
                        <div className="bg-slate-50 p-3 rounded-2xl">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Kalender Info</p>
                          <div className="flex flex-wrap gap-2">
                            {plant.flowering_months && (
                              <div className="text-[10px] font-bold text-slate-600 bg-white px-2 py-1 rounded-md border border-slate-100 flex items-center gap-1">
                                <span className="text-garden-green-600">Bloei:</span> {plant.flowering_months}
                              </div>
                            )}
                            {plant.pruning_months && (
                              <div className="text-[10px] font-bold text-slate-600 bg-white px-2 py-1 rounded-md border border-slate-100 flex items-center gap-1">
                                <span className="text-amber-600">Snoei:</span> {plant.pruning_months}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {plant.remarks && (
                        <div className="bg-garden-green-50/50 p-3 rounded-2xl border border-garden-green-100/20">
                          <p className="text-[10px] font-black uppercase tracking-widest text-garden-green-600 mb-1">Opmerkingen</p>
                          <p className="text-xs text-slate-600 leading-relaxed italic line-clamp-3">"{plant.remarks}"</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setAdminPlantData(plant.raw_data)} 
                          className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer"
                          title="Bekijk alle data (Admin)"
                        >
                           <Info className="w-4 h-4" />
                        </button>
                        {allGardens.length > 1 && (
                          <button 
                            onClick={() => setMovingPlant(plant)} 
                            className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer"
                            title="Verplaatsen naar andere tuin"
                          >
                             <Move className="w-4 h-4" />
                          </button>
                        )}
                        <a 
                          href={`https://www.google.com/search?q=${encodeURIComponent(plant.common_name + " " + plant.scientific_name)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-garden-green-50 hover:text-garden-green-600 transition-colors cursor-pointer"
                          title="Zoek op Google"
                        >
                           <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                      <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                         ID #{plant.id}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th 
                        className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:text-garden-green-600 transition-colors"
                        onClick={() => requestSort('common_name')}
                      >
                        <div className="flex items-center gap-2">
                          Plant
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th 
                        className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:text-garden-green-600 transition-colors"
                        onClick={() => requestSort('location_in_garden')}
                      >
                        <div className="flex items-center gap-2">
                          Locatie
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Kalender</th>
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Opmerkingen</th>
                      <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Acties</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredAndSortedPlants.map((plant) => (
                      <tr key={plant.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                              {plant.image_path ? (
                                <img src={`${API_URL}/${plant.image_path}`} alt={plant.common_name} className="w-full h-full object-cover" />
                              ) : plant.image_url ? (
                                <img src={plant.image_url} alt={plant.common_name} className="w-full h-full object-cover" />
                              ) : (
                                <Leaf className="w-full h-full p-3 text-slate-300" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900 leading-tight">{plant.common_name || "Onbekend"}</h4>
                              <p className="text-xs text-slate-400 italic">{plant.scientific_name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-6">
                          {plant.location_in_garden ? (
                            <span className="text-sm font-medium text-slate-600 flex items-center gap-1.5">
                              <MapPin className="w-3 h-3 text-garden-green-500" /> {plant.location_in_garden}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="p-6">
                          <div className="flex flex-col gap-1">
                            {plant.flowering_months && (
                              <span className="text-[10px] font-bold text-slate-600 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-garden-green-500"></span>
                                Bloei: {plant.flowering_months}
                              </span>
                            )}
                            {plant.pruning_months && (
                              <span className="text-[10px] font-bold text-slate-600 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                Snoei: {plant.pruning_months}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-6 max-w-[200px]">
                          <p className="text-xs text-slate-500 italic truncate" title={plant.remarks}>
                            {plant.remarks || "—"}
                          </p>
                        </td>
                        <td className="p-6 text-right">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setAdminPlantData(plant.raw_data)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Bekijk alle data (Admin)">
                              <Info className="w-4 h-4" />
                            </button>
                            {allGardens.length > 1 && (
                              <button onClick={() => setMovingPlant(plant)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Verplaatsen">
                                <Move className="w-4 h-4" />
                              </button>
                            )}
                            <a 
                              href={`https://www.google.com/search?q=${encodeURIComponent(plant.common_name + " " + plant.scientific_name)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-slate-400 hover:text-garden-green-600 hover:bg-garden-green-50 rounded-lg transition-colors"
                              title="Zoek op Google"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            <button onClick={() => startEditPlant(plant)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Bewerken">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => deletePlant(plant.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Verwijderen">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Admin Data Modal */}
      {adminPlantData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden border border-slate-100">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Plant Ruwe Data (Admin)</h2>
                <p className="text-slate-500 text-sm font-medium">Volledige JSON-respons van Trefle.io</p>
              </div>
              <button 
                onClick={() => setAdminPlantData(null)}
                className="p-3 bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-2xl transition-all shadow-sm border border-slate-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-grow overflow-auto p-8 custom-scrollbar bg-slate-900">
              <pre className="text-xs text-emerald-400 font-mono leading-relaxed">
                {JSON.stringify(adminPlantData, null, 2)}
              </pre>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trefle API v1 • TuinKalender Admin View</p>
            </div>
          </div>
        </div>
      )}

      {/* Move Plant Modal */}
      {movingPlant && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-sm flex flex-col overflow-hidden border border-slate-100">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-xl font-black text-slate-900">Verplaatsen</h2>
                <p className="text-slate-500 text-xs font-medium">{movingPlant.common_name || movingPlant.scientific_name}</p>
              </div>
              <button onClick={() => setMovingPlant(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-3">
               <p className="text-sm font-bold text-slate-400 uppercase tracking-widest ml-1">Kies doeltuin</p>
               <div className="grid grid-cols-1 gap-2">
                 {allGardens
                   .filter(g => g.id.toString() !== gardenId)
                   .map(g => (
                     <button
                       key={g.id}
                       onClick={() => movePlant(movingPlant, g.id)}
                       className="w-full p-4 text-left bg-slate-50 hover:bg-garden-green-50 rounded-2xl border border-transparent hover:border-garden-green-100 transition-all group flex items-center justify-between"
                     >
                        <span className="font-bold text-slate-700 group-hover:text-garden-green-700">{g.name}</span>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-garden-green-500 group-hover:translate-x-1 transition-all" />
                     </button>
                   ))
                 }
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-slate-100">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-blue-50/30">
              <div>
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  <Share2 className="w-6 h-6 text-blue-500" />
                  Tuin Delen
                </h2>
                <p className="text-slate-500 text-sm font-medium">Beheer wie toegang heeft tot {garden?.name}.</p>
              </div>
              <button 
                onClick={() => setShowShareModal(false)}
                className="p-3 bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-2xl transition-all shadow-sm border border-slate-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8 space-y-8">
              <form onSubmit={handleShare} className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Gebruiker uitnodigen (Google Email)</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="naam@gmail.com"
                    className="flex-1 p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all font-medium outline-none"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    required
                  />
                  <button 
                    disabled={isSharing}
                    className="bg-blue-600 text-white px-6 rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center min-w-[80px]"
                  >
                    {isSharing ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : "Deel"}
                  </button>
                </div>
              </form>

              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Mensen met toegang
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-garden-green-100 flex items-center justify-center text-garden-green-700 text-xs font-black ring-4 ring-white shadow-sm">J</div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">Jij</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Eigenaar</div>
                      </div>
                    </div>
                  </div>
                  {sharedUsers.map(u => (
                    <div key={u.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group border border-slate-100/50 hover:bg-white transition-colors shadow-sm hover:shadow-md">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-black ring-4 ring-white shadow-sm">
                          {u.email[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate max-w-[150px]">{u.email}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Bewerker</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeShare(u.id)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Toegang intrekken"
                      >
                        <UserMinus className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  {sharedUsers.length === 0 && (
                    <p className="text-center py-4 text-xs text-slate-400 font-medium italic">Nog met niemand gedeeld</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-slate-100">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-blue-50/30">
              <div>
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  <Share2 className="w-6 h-6 text-blue-500" />
                  Tuin Delen
                </h2>
                <p className="text-slate-500 text-sm font-medium">Beheer wie toegang heeft tot {garden?.name}.</p>
              </div>
              <button 
                onClick={() => setShowShareModal(false)}
                className="p-3 bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-2xl transition-all shadow-sm border border-slate-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8 space-y-8">
              <form onSubmit={handleShare} className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Gebruiker uitnodigen (Google Email)</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="naam@gmail.com"
                    className="flex-1 p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all font-medium outline-none"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    required
                  />
                  <button 
                    disabled={isSharing}
                    className="bg-blue-600 text-white px-6 rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center min-w-[80px]"
                  >
                    {isSharing ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : "Deel"}
                  </button>
                </div>
              </form>

              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Mensen met toegang
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-garden-green-100 flex items-center justify-center text-garden-green-700 text-xs font-black ring-4 ring-white shadow-sm">J</div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">Jij</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Eigenaar</div>
                      </div>
                    </div>
                  </div>
                  {sharedUsers.map(u => (
                    <div key={u.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group border border-slate-100/50 hover:bg-white transition-colors shadow-sm hover:shadow-md">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-black ring-4 ring-white shadow-sm">
                          {u.email[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate max-w-[150px]">{u.email}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Bewerker</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeShare(u.id)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Toegang intrekken"
                      >
                        <UserMinus className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  {sharedUsers.length === 0 && (
                    <p className="text-center py-4 text-xs text-slate-400 font-medium italic">Nog met niemand gedeeld</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trefle Search Results Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden border border-slate-100">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Plant Zoeken</h2>
                <p className="text-slate-500 text-sm font-medium">Selecteer een plant uit de database.</p>
              </div>
              <button 
                onClick={() => setShowSearchModal(false)}
                className="p-3 bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-2xl transition-all shadow-sm border border-slate-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {searchResults.map((plant) => (
                  <div
                    key={plant.id}
                    className="group p-4 bg-slate-50 hover:bg-garden-green-50 border border-transparent hover:border-garden-green-100 rounded-3xl cursor-pointer transition-all flex items-center gap-4 shadow-sm hover:shadow-md"
                    onClick={() => selectPlantFromSearch(plant)}
                  >
                    <div className="relative w-16 h-16 shrink-0 overflow-hidden rounded-2xl bg-slate-200 shadow-inner">
                      {plant.image_url ? (
                        <img src={plant.image_url} alt={plant.common_name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <Leaf className="w-full h-full p-4 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-grow min-w-0">
                      <h4 className="font-bold text-slate-900 truncate group-hover:text-garden-green-800 transition-colors">{plant.common_name || plant.scientific_name}</h4>
                      <p className="text-xs text-slate-500 italic truncate">{plant.scientific_name}</p>
                    </div>
                    <Plus className="w-5 h-5 text-slate-300 group-hover:text-garden-green-500 group-hover:scale-110 transition-all" />
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gevonden via Trefle.io API</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
