"use client";

import React, { useState, useEffect } from "react";
import { 
  Plus, Search, MapPin, Leaf, Camera, ExternalLink, X, Check, Trash2, Edit2, 
  Info, Sparkles, Move, ArrowRight, Save
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

interface TreflePlant {
  id: number;
  common_name: string;
  scientific_name: string;
  image_url: string;
}

interface PlantModalProps {
  isOpen: boolean;
  onClose: () => void;
  plant: Partial<Plant> | null;
  onSave: (plant: Partial<Plant>, file: File | null) => Promise<void>;
  isEditing?: boolean;
  userSettings?: any;
  gardenId?: number;
  API_URL: string;
  accessToken?: string;
}

export default function PlantModal({ 
  isOpen, 
  onClose, 
  plant, 
  onSave, 
  isEditing = false,
  userSettings,
  gardenId,
  API_URL,
  accessToken
}: PlantModalProps) {
  const [formData, setFormData] = useState<Partial<Plant>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<TreflePlant[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (plant) {
      setFormData(plant);
      setSelectedFile(null);
      setImagePreview(null);
      setShowSearchResults(false);
    }
  }, [plant]);

  useEffect(() => {
    if (!selectedFile) {
      setImagePreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedFile);
    setImagePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = formData.scientific_name || formData.common_name;
    if (!query) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(`${API_URL}/search-plants/?query=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await response.json();
      const results = Array.isArray(data) ? data : [];
      setSearchResults(results);
      if (results.length > 0) setShowSearchResults(true);
      setIsSearching(false);
    } catch (error) {
      console.error("Error searching plants:", error);
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  const selectPlantFromSearch = (p: TreflePlant) => {
    setFormData({
      ...formData,
      common_name: p.common_name,
      scientific_name: p.scientific_name,
      trefle_id: p.id,
      image_url: p.image_url,
    });
    setShowSearchResults(false);
  };

  const getAiSuggestions = async () => {
    if (!formData.common_name && !formData.scientific_name) return;
    
    setIsAiLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/ai-suggest/?common_name=${encodeURIComponent(formData.common_name || "")}&scientific_name=${encodeURIComponent(formData.scientific_name || "")}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await response.json();
      
      if (data && !data.error) {
        const cleanMonths = (val: any) => {
          if (Array.isArray(val)) return val.join(",");
          return String(val).replace(/[\[\]{}]/g, "");
        };

        setFormData({
          ...formData,
          common_name: data.dutch_name || formData.common_name,
          flowering_months: cleanMonths(data.flowering_months || formData.flowering_months || ""),
          pruning_months: cleanMonths(data.pruning_months || formData.pruning_months || ""),
          remarks: data.remarks || formData.remarks,
        });
      }
    } catch (error) {
      console.error("Error fetching AI suggestions:", error);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData, selectedFile);
      onClose();
    } catch (error) {
      console.error("Error saving plant:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!plant) return null;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={isEditing ? (formData.common_name || "Plant Bewerken") : "Nieuwe Plant Toevoegen"}
      maxWidth="max-w-4xl"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Side: Form */}
        <div className="space-y-6">
          {!isEditing && !userSettings?.openrouter_key && !userSettings?.openai_key && (
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
                Voeg een <strong>AI API Key</strong> toe bij instellingen om deze plant automatisch te laten analyseren.
              </p>
            </div>
          )}

          {(formData.common_name || formData.scientific_name) && (userSettings?.openrouter_key || userSettings?.openai_key) && (
            <button
              type="button"
              onClick={getAiSuggestions}
              disabled={isAiLoading}
              className={`w-full py-3 px-4 bg-gradient-to-r ${userSettings?.ai_provider === 'openai' ? 'from-green-600 to-emerald-600' : 'from-blue-600 to-indigo-600'} text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-50`}
            >
              {isAiLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
              {isAiLoading ? "AI is aan het denken..." : `Vul aan met AI (${userSettings?.ai_provider === 'openai' ? 'OpenAI' : 'OpenRouter'})`}
            </button>
          )}

          <form id="plant-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Wetenschappelijke Naam</label>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Lavandula angustifolia"
                  className="flex-grow p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-garden-green-500 transition-all font-medium"
                  value={formData.scientific_name || ""}
                  onChange={(e) => setFormData({ ...formData, scientific_name: e.target.value })}
                />
                {!isEditing && (
                  <button
                    type="button"
                    onClick={handleSearch}
                    disabled={isSearching || (!formData.scientific_name && !formData.common_name) || !userSettings?.trefle_token}
                    className="bg-garden-green-100 text-garden-green-600 p-3 rounded-xl hover:bg-garden-green-200 transition-all disabled:opacity-30"
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
                value={formData.common_name || ""}
                onChange={(e) => setFormData({ ...formData, common_name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Locatie in Tuin</label>
              <input
                type="text"
                placeholder="Zonnige border, noordzijde"
                className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-garden-green-500 transition-all font-medium"
                value={formData.location_in_garden || ""}
                onChange={(e) => setFormData({ ...formData, location_in_garden: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Bloeimaanden</label>
                <input
                  type="text"
                  placeholder="bijv: 4,5,6"
                  className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-garden-green-500 transition-all font-medium"
                  value={formData.flowering_months || ""}
                  onChange={(e) => setFormData({ ...formData, flowering_months: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Snoeimaanden</label>
                <input
                  type="text"
                  placeholder="bijv: 3,10"
                  className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-garden-green-500 transition-all font-medium"
                  value={formData.pruning_months || ""}
                  onChange={(e) => setFormData({ ...formData, pruning_months: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Opmerkingen</label>
              <textarea
                placeholder="Extra informatie over verzorging..."
                rows={3}
                className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-garden-green-500 transition-all font-medium"
                value={formData.remarks || ""}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              />
            </div>
          </form>
        </div>

        {/* Right Side: Media & Info */}
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Foto</label>
            <div className="relative aspect-square w-full rounded-[30px] bg-slate-100 overflow-hidden group/img border border-slate-100 shadow-inner">
              {imagePreview ? (
                <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
              ) : formData.image_path ? (
                <img src={`${API_URL}/${formData.image_path}`} className="w-full h-full object-cover" alt="Current" />
              ) : formData.image_url ? (
                <img src={formData.image_url} className="w-full h-full object-cover opacity-70" alt="Trefle" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <Camera className="w-16 h-16" />
                </div>
              )}
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer text-white font-bold text-sm gap-2 backdrop-blur-sm">
                <Camera className="w-6 h-6" />
                { (selectedFile || formData.image_path || formData.image_url) ? "Foto wijzigen" : "Foto uploaden" }
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*" 
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} 
                />
              </label>
            </div>
          </div>

          {showSearchResults && searchResults.length > 0 && (
            <div className="bg-slate-50 p-6 rounded-[30px] border border-slate-100 animate-in slide-in-from-top-2">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Gevonden in Database</h3>
                <button onClick={() => setShowSearchResults(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 max-h-60 overflow-auto custom-scrollbar pr-2">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectPlantFromSearch(p)}
                    className="flex items-center gap-3 p-3 bg-white hover:bg-garden-green-50 rounded-2xl transition-all text-left group border border-transparent hover:border-garden-green-100 shadow-sm"
                  >
                    <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0 shadow-inner">
                      {p.image_url && <img src={p.image_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform" alt="" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{p.common_name || p.scientific_name}</div>
                      <div className="text-[10px] text-slate-400 italic truncate">{p.scientific_name}</div>
                    </div>
                    <Plus className="w-4 h-4 text-slate-300 ml-auto group-hover:text-garden-green-500 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-4">
            <button
              form="plant-form"
              type="submit"
              disabled={isSaving}
              className="w-full bg-garden-green-600 hover:bg-garden-green-700 text-white p-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-garden-green-600/20 disabled:opacity-50"
            >
              {isSaving ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Plant Opslaan
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 p-4 rounded-2xl font-black transition-all"
            >
              Annuleren
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
