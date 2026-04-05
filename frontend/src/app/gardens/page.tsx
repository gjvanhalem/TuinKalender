"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, MapPin, ExternalLink, Map, Leaf, ArrowRight, Edit2, Navigation, Search, X, Save } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Garden {
  id: number;
  name: string;
  location: string;
  plant_count?: number;
  plant_summary?: string;
}

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function GardensPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [gardens, setGardens] = useState<Garden[]>([]);
  const [userSettings, setUserSettings] = useState<any | null>(null);
  const [newGardenName, setNewGardenName] = useState("");
  const [newGardenLocation, setNewGardenLocation] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingGarden, setEditingGarden] = useState<Garden | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (session) {
      fetchUserSettings();
      fetchGardens();
    }
  }, [session, status]);

  const fetchUserSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${session?.accessToken || session?.user?.email}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUserSettings(data);
      }
    } catch (error) {}
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocatie wordt niet ondersteund door uw browser.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setNewGardenLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        
        // Try to reverse geocode if system Google Maps key is available
        if (GOOGLE_MAPS_API_KEY) {
          try {
            const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`);
            const data = await res.json();
            if (data.results && data.results[0]) {
              setNewGardenLocation(data.results[0].formatted_address);
            }
          } catch (e) {
            console.error("Reverse geocoding failed", e);
          }
        }
        setIsLocating(false);
      },
      (error) => {
        console.error("Error getting location", error);
        alert("Kon uw locatie niet ophalen.");
        setIsLocating(false);
      }
    );
  };

  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);

  useEffect(() => {
    if (showMapPicker && GOOGLE_MAPS_API_KEY && !window.google) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
      script.async = true;
      script.defer = true;
      script.onload = initMap;
      document.head.appendChild(script);
    } else if (showMapPicker && window.google) {
      setTimeout(initMap, 100);
    }
  }, [showMapPicker]);

  const initMap = () => {
    if (!mapRef.current || !window.google) return;
    
    // Default to Amsterdam
    let center = { lat: 52.3676, lng: 4.9041 };
    
    const newMap = new window.google.maps.Map(mapRef.current, {
      center: center,
      zoom: 12,
      disableDefaultUI: false,
      clickableIcons: false,
    });

    // Try to center on user's current location if available
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

  const handleMapClick = async (lat: number, lng: number) => {
    setNewGardenLocation(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    if (GOOGLE_MAPS_API_KEY) {
      try {
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`);
        const data = await res.json();
        if (data.results && data.results[0]) {
          setNewGardenLocation(data.results[0].formatted_address);
        }
      } catch (e) {}
    }
    setShowMapPicker(false);
  };

  const fetchGardens = async () => {
    try {
      const response = await fetch(`${API_URL}/gardens/`, {
        headers: { Authorization: `Bearer ${session?.accessToken || session?.user?.email}` }
      });
      const data = await response.json();
      setGardens(Array.isArray(data) ? data : []);
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching gardens:", error);
      setGardens([]);
      setIsLoading(false);
    }
  };

  const addGarden = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGardenName) return;

    try {
      const url = editingGarden ? `${API_URL}/gardens/${editingGarden.id}` : `${API_URL}/gardens/`;
      const method = editingGarden ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method: method,
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.accessToken || session?.user?.email}`
        },
        body: JSON.stringify({ name: newGardenName, location: newGardenLocation }),
      });
      if (response.ok) {
        setNewGardenName("");
        setNewGardenLocation("");
        setEditingGarden(null);
        setShowEditModal(false);
        fetchGardens();
      } else {
        const errorData = await response.json();
        alert("Fout bij het opslaan: " + (errorData.detail || "Onbekende fout"));
      }
    } catch (error) {
      console.error("Error adding/updating garden:", error);
      alert("Er kon geen verbinding worden gemaakt met de server.");
    }
  };

  const deleteGarden = async (id: number) => {
    if (!confirm("Weet je zeker dat je deze tuin wilt verwijderen? Alle planten in deze tuin worden ook verwijderd.")) return;
    try {
      await fetch(`${API_URL}/gardens/${id}`, { 
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.accessToken || session?.user?.email}` }
      });
      fetchGardens();
    } catch (error) {
      console.error("Error deleting garden:", error);
    }
  };

  const startEdit = (garden: Garden) => {
    setEditingGarden(garden);
    setNewGardenName(garden.name);
    setNewGardenLocation(garden.location);
    setShowEditModal(true);
  };

  if (status === "loading") return <div className="p-12 text-center text-garden-green-700 font-bold">Laden...</div>;

  return (
    <div className="container mx-auto p-6 md:p-12 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 mb-2 flex items-center gap-3">
            <div className="bg-garden-green-100 p-2 rounded-2xl">
              <MapPin className="w-8 h-8 text-garden-green-600" />
            </div>
            Mijn Tuinen
          </h1>
          <p className="text-slate-500 font-medium">Beheer en organiseer je buitenruimtes.</p>
        </div>
        
        <button 
          onClick={() => {
            setEditingGarden(null);
            setNewGardenName("");
            setNewGardenLocation("");
            setShowEditModal(true);
          }}
          className="bg-garden-green-600 hover:bg-garden-green-700 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-garden-green-600/20"
        >
          <Plus className="w-6 h-6" />
          Nieuwe Tuin
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-24">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-garden-green-600"></div>
          </div>
        ) : gardens.length === 0 ? (
          <div className="col-span-full bg-white rounded-[60px] p-24 border border-dashed border-slate-200 text-center flex flex-col items-center">
            <div className="bg-slate-50 p-8 rounded-full mb-8">
              <Map className="w-16 h-16 text-slate-200" />
            </div>
            <h3 className="text-3xl font-black text-slate-900 mb-4">Nog geen tuinen</h3>
            <p className="text-slate-500 max-w-sm font-medium mb-10">Klik op de knop hierboven om je eerste tuin aan te maken.</p>
          </div>
        ) : (
          gardens.map((garden) => (
            <div
              key={garden.id}
              className="group relative bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-default"
            >
              {/* Decorative background element */}
              <div className="absolute top-0 right-0 p-12 bg-garden-green-50 rounded-bl-[100px] -mr-6 -mt-6 group-hover:bg-garden-green-100 transition-colors duration-300 pointer-events-none">
                 <Leaf className="w-12 h-12 text-garden-green-200 group-hover:text-garden-green-300 transition-colors" />
              </div>
              
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-2xl font-black text-slate-900 group-hover:text-garden-green-700 transition-colors">{garden.name}</h3>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {garden.location && (
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(garden.location)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100"
                        title="Bekijk op Google Maps"
                        onClick={(e) => e.stopPropagation()}
                      >
                         <MapPin className="w-4 h-4" />
                      </a>
                    )}
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); startEdit(garden); }} className="p-2 bg-amber-50 text-amber-600 rounded-full hover:bg-amber-100">
                       <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteGarden(garden.id); }} className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100">
                       <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {garden.location && (
                  <p className="text-slate-500 flex items-center gap-1.5 font-semibold text-sm">
                    <MapPin className="w-4 h-4 text-garden-green-500" /> {garden.location}
                  </p>
                )}
                
                <div className="mt-4 space-y-1">
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Planten ({garden.plant_count || 0})</p>
                   <p className="text-xs text-slate-600 font-medium line-clamp-1 italic">
                      {garden.plant_summary || "Nog geen planten toegevoegd"}
                   </p>
                </div>
              </div>
              
              <div className="relative z-10 mt-12 flex items-center justify-between">
                <Link
                  href={`/gardens/${garden.id}`}
                  className="text-garden-green-600 font-black flex items-center gap-2 text-sm uppercase tracking-wider hover:translate-x-1 transition-transform"
                >
                  Planten Beheren
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-slate-100">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                   {editingGarden ? "Tuin Bewerken" : "Nieuwe Tuin"}
                </h2>
                <p className="text-slate-500 text-sm font-medium">Vul de details van uw tuin in.</p>
              </div>
              <button 
                onClick={() => setShowEditModal(false)}
                className="p-3 bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-2xl transition-all shadow-sm border border-slate-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={addGarden} className="p-8 space-y-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Naam</label>
                <input
                  type="text"
                  placeholder="Achtertuin"
                  className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-garden-green-500 transition-all font-medium"
                  value={newGardenName}
                  onChange={(e) => setNewGardenName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Locatie</label>
                <div className="relative flex gap-2">
                  <input
                    type="text"
                    placeholder="Amsterdam, NL"
                    className="flex-grow p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-garden-green-500 transition-all font-medium"
                    value={newGardenLocation}
                    onChange={(e) => setNewGardenLocation(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={useCurrentLocation}
                    disabled={isLocating}
                    className="bg-blue-50 text-blue-600 p-4 rounded-2xl hover:bg-blue-100 transition-all disabled:opacity-50"
                    title="Gebruik huidige locatie"
                  >
                    {isLocating ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div> : <Navigation className="w-5 h-5" />}
                  </button>
                  {GOOGLE_MAPS_API_KEY && (
                    <button
                      type="button"
                      onClick={() => setShowMapPicker(true)}
                      className="bg-red-50 text-red-600 p-4 rounded-2xl hover:bg-red-100 transition-all"
                      title="Kies op kaart"
                    >
                      <MapPin className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="pt-4 flex flex-col gap-3">
                <button
                  type="submit"
                  className={`w-full ${editingGarden ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 'bg-garden-green-600 hover:bg-garden-green-700 shadow-garden-green-600/20'} text-white p-5 rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-xl`}
                >
                  {editingGarden ? <Save className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                  {editingGarden ? "Wijzigingen Opslaan" : "Tuin Aanmaken"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Map Picker Modal */}
      {showMapPicker && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden border border-slate-100">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Locatie Kiezen</h2>
                <p className="text-slate-500 text-sm font-medium">Klik op de kaart om de locatie van uw tuin te bepalen.</p>
              </div>
              <button 
                onClick={() => setShowMapPicker(false)}
                className="p-3 bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-2xl transition-all shadow-sm border border-slate-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-grow bg-slate-100 relative">
              <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
              <div className="absolute top-4 right-4 z-10">
                 <div className="bg-white p-3 rounded-2xl shadow-lg border border-slate-100 text-xs font-bold text-slate-600">
                    Klik op de kaart om een locatie te kiezen
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
