"use client";

import React, { useState, useEffect } from "react";
import Modal from "./Modal";
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
  const t = useTranslations('Common');
  const locale = useLocale();
  const [formData, setFormData] = useState<Partial<Plant>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<TreflePlant[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const identifyInputRef = React.useRef<HTMLInputElement>(null);

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

  const identifyFromPhoto = async (file: File) => {
    setIsIdentifying(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch(
        `${API_URL}/plants/identify/?locale=${locale}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: formData,
        }
      );
      if (response.ok) {
        const data = await response.json();
        const cleanMonths = (val: any) => {
          if (!val) return "";
          if (Array.isArray(val)) return val.join(",");
          return String(val).replace(/[\[\]{}]/g, "");
        };
        setFormData((prev) => ({
          ...prev,
          common_name: data.common_name || prev.common_name,
          scientific_name: data.scientific_name || prev.scientific_name,
          flowering_months: cleanMonths(data.flowering_months) || prev.flowering_months,
          pruning_months: cleanMonths(data.pruning_months) || prev.pruning_months,
          remarks: data.remarks || prev.remarks,
          trefle_id: data.trefle_id || prev.trefle_id,
        }));
        // Preview the uploaded photo
        setSelectedFile(file);
      } else {
        const err = await response.json();
        console.error("Identify error:", err.detail);
      }
    } catch (error) {
      console.error("Error identifying plant:", error);
    }
    setIsIdentifying(false);
  };

  const getAiSuggestions = async () => {
    if (!formData.common_name && !formData.scientific_name) return;
    
    setIsAiLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/ai-suggest/?common_name=${encodeURIComponent(formData.common_name || "")}&scientific_name=${encodeURIComponent(formData.scientific_name || "")}&locale=${locale}`,
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
          common_name: data.localized_name || data.dutch_name || formData.common_name,
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
      title={isEditing ? (formData.common_name || t('editPlant')) : t('newPlant')}
      maxWidth="max-w-4xl"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Side: Form */}
        <div className="space-y-6">
          {/* Identify from photo — shown when no name entered yet and AI is configured */}
          {!isEditing && (userSettings?.openrouter_key || userSettings?.openai_key) && (
            <>
              <input
                ref={identifyInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) identifyFromPhoto(file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => identifyInputRef.current?.click()}
                disabled={isIdentifying}
                className="w-full py-4 bg-secondary text-on-secondary rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-secondary/20 disabled:opacity-50"
              >
                {isIdentifying ? (
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined">photo_camera</span>
                )}
                {isIdentifying ? t('photo.identifying') : t('photo.identifyFromPhoto')}
              </button>
            </>
          )}

          {(formData.common_name || formData.scientific_name) && (userSettings?.openrouter_key || userSettings?.openai_key) && (
            <button
              type="button"
              onClick={getAiSuggestions}
              disabled={isAiLoading}
              className="w-full py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              {isAiLoading ? (
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined">auto_awesome</span>
              )}
              {isAiLoading ? t('analyzing') : t('fillWithAi')}
            </button>
          )}

          <form id="plant-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">{t('scientificName')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={t('scientificNameExample')}
                  className="flex-grow p-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all font-medium text-on-surface"
                  value={formData.scientific_name || ""}
                  onChange={(e) => setFormData({ ...formData, scientific_name: e.target.value })}
                />
                {!isEditing && (
                  <button
                    type="button"
                    onClick={handleSearch}
                    disabled={isSearching || (!formData.scientific_name && !formData.common_name) || !userSettings?.trefle_token}
                    className="bg-primary/10 text-primary p-4 rounded-xl hover:bg-primary hover:text-white transition-all disabled:opacity-30"
                  >
                    {isSearching ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : <span className="material-symbols-outlined">search</span>}
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">{t('commonName')}</label>
              <input
                type="text"
                placeholder={t('commonNameExample')}
                className="w-full p-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all font-medium text-on-surface"
                value={formData.common_name || ""}
                onChange={(e) => setFormData({ ...formData, common_name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">{t('locationInGarden')}</label>
              <input
                type="text"
                placeholder={t('locationExample')}
                className="w-full p-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all font-medium text-on-surface"
                value={formData.location_in_garden || ""}
                onChange={(e) => setFormData({ ...formData, location_in_garden: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">{t('bloomMonths')}</label>
                <input
                  type="text"
                  placeholder={t('monthsPlaceholder')}
                  className="w-full p-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all font-medium text-on-surface"
                  value={formData.flowering_months || ""}
                  onChange={(e) => setFormData({ ...formData, flowering_months: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">{t('pruningMonths')}</label>
                <input
                  type="text"
                  placeholder={t('monthsPlaceholder')}
                  className="w-full p-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all font-medium text-on-surface"
                  value={formData.pruning_months || ""}
                  onChange={(e) => setFormData({ ...formData, pruning_months: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">{t('remarks')}</label>
              <textarea
                placeholder={t('extraInfoPlaceholder')}
                rows={3}
                className="w-full p-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary/20 transition-all font-medium text-on-surface"
                value={formData.remarks || ""}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              />
            </div>
          </form>
        </div>

        {/* Right Side: Media & Info */}
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">{t('photo')}</label>
            <div className="relative aspect-square w-full rounded-2xl bg-surface-container-low overflow-hidden group border border-outline-variant/10 shadow-inner">
              {imagePreview ? (
                <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
              ) : formData.image_path ? (
                <img src={`${API_URL}/${formData.image_path}`} className="w-full h-full object-cover" alt="Current" />
              ) : formData.image_url ? (
                <img src={formData.image_url} className="w-full h-full object-cover opacity-70" alt="Trefle" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-outline">
                  <span className="material-symbols-outlined text-6xl">photo_camera</span>
                  <span className="text-xs font-bold uppercase mt-2">{t('noPhoto')}</span>
                </div>
              )}
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white font-bold text-sm gap-2 backdrop-blur-sm">
                <span className="material-symbols-outlined">add_a_photo</span>
                { (selectedFile || formData.image_path || formData.image_url) ? t('change') : t('upload') }
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
            <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10">
              <div className="flex justify-between items-center mb-4 px-2">
                <h3 className="text-xs font-bold text-outline uppercase tracking-widest">{t('searchResults')}</h3>
                <button onClick={() => setShowSearchResults(false)} className="text-outline hover:text-on-surface">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
              <div className="space-y-2 max-h-60 overflow-auto custom-scrollbar pr-2">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectPlantFromSearch(p)}
                    className="w-full flex items-center gap-3 p-3 bg-surface hover:bg-primary/5 rounded-xl transition-all text-left group border border-transparent hover:border-primary/20 shadow-sm"
                  >
                    <div className="w-12 h-12 rounded-lg bg-surface-container-high overflow-hidden shrink-0">
                      {p.image_url && <img src={p.image_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform" alt="" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-on-surface truncate">{p.common_name || p.scientific_name}</div>
                      <div className="text-[10px] text-outline italic truncate">{p.scientific_name}</div>
                    </div>
                    <span className="material-symbols-outlined text-outline ml-auto group-hover:text-primary transition-colors">add</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 pt-4">
            <button
              form="plant-form"
              type="submit"
              disabled={isSaving}
              className="w-full bg-primary text-white p-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 active:scale-95"
            >
              {isSaving ? (
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
              ) : (
                <>
                  <span className="material-symbols-outlined">save</span>
                  <span>{t('save')}</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-surface-container-high text-on-surface-variant p-4 rounded-xl font-bold hover:bg-surface-container-highest transition-all active:scale-95"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
