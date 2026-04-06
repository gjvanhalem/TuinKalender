"use client";

import React from "react";
import { 
  MapPin, Leaf, ExternalLink, Edit2, Trash2, Calendar, Info, Map
} from "lucide-react";
import Modal from "./Modal";

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
  tasks?: any[];
}

interface PlantInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  plant: Plant | null;
  onEdit: (plant: Plant) => void;
  onDelete: (id: number) => void;
  onViewRawData?: (data: any) => void;
  onMove?: (plant: Plant) => void;
  API_URL: string;
  showAdminOptions?: boolean;
}

export default function PlantInfoModal({ 
  isOpen, 
  onClose, 
  plant, 
  onEdit, 
  onDelete,
  onViewRawData,
  onMove,
  API_URL,
  showAdminOptions = false
}: PlantInfoModalProps) {
  if (!plant) return null;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={plant.common_name || "Plant Informatie"}
      maxWidth="max-w-3xl"
    >
      <div className="flex flex-col md:flex-row gap-8">
        {/* Left: Image */}
        <div className="w-full md:w-1/2">
          <div className="aspect-square rounded-[40px] overflow-hidden bg-slate-100 shadow-inner border border-slate-100">
            {plant.image_path ? (
              <img src={`${API_URL}/${plant.image_path}`} alt={plant.common_name} className="w-full h-full object-cover" />
            ) : plant.image_url ? (
              <img src={plant.image_url} alt={plant.common_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                <Leaf className="w-16 h-16 mb-4 opacity-20" />
                <span className="text-sm font-bold uppercase tracking-widest opacity-50">Geen foto</span>
              </div>
            )}
          </div>
          
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            <button 
              onClick={() => onEdit(plant)}
              className="flex items-center gap-2 px-6 py-3 bg-amber-50 text-amber-600 rounded-2xl font-bold hover:bg-amber-100 transition-all border border-amber-100/50"
            >
              <Edit2 className="w-4 h-4" />
              Bewerken
            </button>
            <button 
              onClick={() => onDelete(plant.id)}
              className="flex items-center gap-2 px-6 py-3 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-all border border-red-100/50"
            >
              <Trash2 className="w-4 h-4" />
              Verwijderen
            </button>
          </div>
        </div>

        {/* Right: Info */}
        <div className="w-full md:w-1/2 space-y-6">
          <div>
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">Wetenschappelijke Naam</h3>
            <p className="text-xl font-bold text-slate-700 italic">{plant.scientific_name || "Niet opgegeven"}</p>
          </div>

          <div>
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">Locatie in de tuin</h3>
            <p className="flex items-center gap-2 text-lg font-bold text-slate-700">
              <MapPin className="w-5 h-5 text-garden-green-500" />
              {plant.location_in_garden || "Niet opgegeven"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-garden-green-50/50 p-4 rounded-3xl border border-garden-green-100/30">
               <div className="flex items-center gap-2 text-garden-green-600 mb-2">
                 <Calendar className="w-4 h-4" />
                 <span className="text-[10px] font-black uppercase tracking-widest">Bloeiperiode</span>
               </div>
               <p className="text-lg font-black text-slate-800">{plant.flowering_months || "—"}</p>
            </div>
            <div className="bg-amber-50/50 p-4 rounded-3xl border border-amber-100/30">
               <div className="flex items-center gap-2 text-amber-600 mb-2">
                 <Calendar className="w-4 h-4" />
                 <span className="text-[10px] font-black uppercase tracking-widest">Snoeimaanden</span>
               </div>
               <p className="text-lg font-black text-slate-800">{plant.pruning_months || "—"}</p>
            </div>
          </div>

          {plant.remarks && (
            <div>
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Opmerkingen</h3>
              <div className="bg-slate-50 p-6 rounded-[30px] border border-slate-100 italic text-slate-600 leading-relaxed">
                "{plant.remarks}"
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-slate-100 flex flex-wrap gap-4">
            <a 
              href={`https://www.google.com/search?q=${encodeURIComponent(plant.common_name + " " + plant.scientific_name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-garden-green-600 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Zoek op Google
            </a>
            
            {showAdminOptions && (
              <>
                <button 
                  onClick={() => onViewRawData?.(plant.raw_data)}
                  className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-blue-600 transition-colors"
                >
                  <Info className="w-4 h-4" />
                  Bekijk Ruwe Data
                </button>
                {onMove && (
                  <button 
                    onClick={() => onMove(plant)}
                    className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    <Map className="w-4 h-4" />
                    Verplaatsen
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
