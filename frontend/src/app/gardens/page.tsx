"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Garden {
  id: number;
  name: string;
  location: string;
  plant_count?: number;
  is_owner: boolean;
  owner_email: string;
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
  const [newGardenName, setNewGardenName] = useState("");
  const [newGardenLocation, setNewGardenLocation] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingGarden, setEditingGarden] = useState<Garden | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  const handleMapClick = async (lat: number, lng: number) => {
    setNewGardenLocation(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    if (GOOGLE_MAPS_API_KEY) {
      try {
        const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`);
        const data = await res.json();
        if (data.results && data.results[0]) {
          setNewGardenLocation(data.results[0].formatted_address);
        }
      } catch (e) {
        console.error("Reverse geocoding failed", e);
      }
    }
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

  const fetchGardens = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/gardens/`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setGardens(Array.isArray(data) ? data : []);
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
        setNewGardenName("");
        setNewGardenLocation("");
        setShowModal(false);
        setEditingGarden(null);
        fetchGardens();
      }
    } catch (error) {
      console.error("Failed to save garden:", error);
    }
  };

  const deleteGarden = async (id: number) => {
    if (!confirm("Weet je zeker dat je deze tuin wilt verwijderen? Alle planten in deze tuin worden ook verwijderd.")) return;
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

  const shareGarden = async (id: number) => {
    const email = prompt("E-mailadres van de persoon die je toegang wilt geven:");
    if (!email) return;

    try {
      const response = await fetch(`${API_URL}/gardens/${id}/share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.accessToken}`,
        },
        body: JSON.stringify({ email }),
      });
      
      if (response.ok) {
        alert("Tuin succesvol gedeeld!");
      } else {
        const errorData = await response.json();
        alert(`Fout bij delen: ${errorData.detail || "Onbekende fout"}`);
      }
    } catch (error) {
      console.error("Failed to share garden:", error);
      alert("Er is een fout opgetreden bij het delen van de tuin.");
    }
  };

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
      <section className="mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <span className="font-label text-sm text-primary font-semibold tracking-[0.2em] uppercase mb-2 block">Mijn Collectie</span>
            <h2 className="font-headline text-5xl md:text-6xl font-bold tracking-tight text-on-surface">Tuinen</h2>
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
            <span>Nieuwe Tuin</span>
          </button>
        </div>

        <div className="relative group">
          <span className="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-outline">search</span>
          <input 
            className="w-full bg-surface-container-high border-none rounded-xl py-5 pl-16 pr-6 focus:ring-2 focus:ring-primary/20 text-lg placeholder:text-outline transition-all" 
            placeholder="Zoek in je tuinen..." 
            type="text"
          />
        </div>
      </section>

      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h3 className="font-headline text-2xl font-bold">Mijn Tuinen</h3>
          <span className="bg-surface-container-lowest border border-outline-variant/15 px-3 py-1 rounded-full text-xs font-medium text-on-surface-variant uppercase tracking-wider">
            {gardens.length} Totaal
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
            <p className="text-on-surface-variant font-medium">Je hebt nog geen tuinen toegevoegd.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {gardens.map((garden) => (
              <div key={garden.id} className="group bg-surface-container-low rounded-xl p-6 transition-all hover:bg-surface-container-high flex flex-col justify-between editorial-shadow border border-outline-variant/5">
                <div className="flex justify-between items-start mb-4">
                  <Link href={`/gardens/${garden.id}`} className="flex-grow">
                    <h4 className="font-headline text-2xl font-bold text-on-surface group-hover:text-primary transition-colors flex items-center gap-2">
                      {garden.name}
                      <span className="material-symbols-outlined text-sm opacity-0 group-hover:opacity-100 transition-opacity">arrow_forward_ios</span>
                    </h4>
                    <p className="text-on-surface-variant text-sm flex items-center gap-1 mt-1 font-medium">
                      <span className="material-symbols-outlined text-sm">location_on</span>
                      {garden.location || "Geen locatie"}
                    </p>
                    {!garden.is_owner && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-secondary-fixed-dim bg-secondary/10 px-2 py-0.5 rounded-full mt-2">
                        Gedeeld door {garden.owner_email.split('@')[0]}
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
                          onClick={() => shareGarden(garden.id)}
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

                <div className="mt-6 flex items-center justify-between pt-4 border-t border-outline-variant/10">
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Planten</span>
                      <span className="text-xl font-bold text-on-surface">{garden.plant_count || 0}</span>
                    </div>
                  </div>
                  <Link
                    href={`/gardens/${garden.id}`}
                    className="bg-primary/10 text-primary px-6 py-2 rounded-xl font-bold text-sm hover:bg-primary hover:text-white transition-all flex items-center gap-2"
                  >
                    Open Tuin
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
                {editingGarden ? "Tuin Bewerken" : "Nieuwe Tuin"}
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
              <div className="space-y-2">
                <label className="text-sm font-semibold text-on-surface-variant px-1">Naam van de tuin</label>
                <input
                  type="text"
                  placeholder="Bijv. Achtertuin, Balkon"
                  className="w-full bg-surface-container-high border-none rounded-xl py-4 px-6 focus:ring-2 focus:ring-primary/20 text-on-surface"
                  value={newGardenName}
                  onChange={(e) => setNewGardenName(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-semibold text-on-surface-variant px-1">Locatie</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Locatie of coördinaten"
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
                <div className="mt-2 overflow-hidden rounded-xl border border-outline-variant/20 h-64">
                  <div ref={mapRef} className="w-full h-full" />
                </div>
              )}
              
              <button
                type="submit"
                className="w-full bg-primary text-white py-4 rounded-xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
              >
                <span className="material-symbols-outlined">{editingGarden ? "save" : "add_circle"}</span>
                {editingGarden ? "Wijzigingen Opslaan" : "Tuin Aanmaken"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
