"use client";

import React from "react";
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
          <div className="aspect-square rounded-2xl overflow-hidden bg-surface-container-low shadow-inner border border-outline-variant/10">
            {plant.image_path ? (
              <img src={`${API_URL}/${plant.image_path}`} alt={plant.common_name} className="w-full h-full object-cover" />
            ) : plant.image_url ? (
              <img src={plant.image_url} alt={plant.common_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-outline">
                <span className="material-symbols-outlined text-6xl opacity-20">leaf</span>
                <span className="text-xs font-bold uppercase tracking-widest mt-2">Geen foto</span>
              </div>
            )}
          </div>
          
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            <button 
              onClick={() => onEdit(plant)}
              className="flex items-center gap-2 px-6 py-3 bg-secondary-container/20 text-secondary rounded-xl font-bold hover:bg-secondary-container/40 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-xl">edit</span>
              Bewerken
            </button>
            <button 
              onClick={() => onDelete(plant.id)}
              className="flex items-center gap-2 px-6 py-3 bg-error-container text-error rounded-xl font-bold hover:bg-error-container/40 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-xl">delete</span>
              Verwijderen
            </button>
          </div>
        </div>

        {/* Right: Info */}
        <div className="w-full md:w-1/2 space-y-6">
          <div>
            <h3 className="text-xs font-bold text-outline uppercase tracking-widest mb-1 px-1">Wetenschappelijk</h3>
            <p className="text-xl font-bold text-on-surface italic">{plant.scientific_name || "Onbekend"}</p>
          </div>

          <div>
            <h3 className="text-xs font-bold text-outline uppercase tracking-widest mb-1 px-1">Locatie</h3>
            <p className="flex items-center gap-2 text-lg font-bold text-on-surface">
              <span className="material-symbols-outlined text-primary">location_on</span>
              {plant.location_in_garden || "Niet opgegeven"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
               <div className="flex items-center gap-2 text-primary mb-1">
                 <span className="material-symbols-outlined text-xl">filter_vintage</span>
                 <span className="text-[10px] font-bold uppercase tracking-widest">Bloei</span>
               </div>
               <p className="text-lg font-bold text-on-surface">{plant.flowering_months || "—"}</p>
            </div>
            <div className="bg-secondary/5 p-4 rounded-xl border border-secondary/10">
               <div className="flex items-center gap-2 text-secondary mb-1">
                 <span className="material-symbols-outlined text-xl">content_cut</span>
                 <span className="text-[10px] font-bold uppercase tracking-widest">Snoei</span>
               </div>
               <p className="text-lg font-bold text-on-surface">{plant.pruning_months || "—"}</p>
            </div>
          </div>

          {plant.remarks && (
            <div>
              <h3 className="text-xs font-bold text-outline uppercase tracking-widest mb-2 px-1">Opmerkingen</h3>
              <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/10 italic text-on-surface-variant leading-relaxed text-sm">
                "{plant.remarks}"
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-outline-variant/10 flex flex-wrap gap-4">
            <a 
              href={`https://www.google.com/search?q=${encodeURIComponent(plant.common_name + " " + plant.scientific_name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs font-bold text-outline hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              Zoek op Google
            </a>
            
            {showAdminOptions && (
              <>
                <button 
                  onClick={() => onViewRawData?.(plant.raw_data)}
                  className="flex items-center gap-2 text-xs font-bold text-outline hover:text-secondary transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">code</span>
                  Ruwe Data
                </button>
                {onMove && (
                  <button 
                    onClick={() => onMove(plant)}
                    className="flex items-center gap-2 text-xs font-bold text-outline hover:text-primary transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">move_item</span>
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
