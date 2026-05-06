"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";

interface GardenAnalysis {
  overall_health?: string;
  observations?: string[];
  problem_areas?: string[];
  advice?: string[];
  highlight?: string;
}

interface GardenPhoto {
  id: number;
  garden_id: number;
  file_path: string;
  taken_at: string;
  notes?: string;
  ai_analysis?: GardenAnalysis;
}

interface GardenPhotoGalleryProps {
  gardenId: number;
  API_URL: string;
  accessToken?: string;
}

function healthBadgeColor(health?: string): string {
  const h = (health || "").toLowerCase();
  if (h === "good" || h === "goed" || h === "bon") return "text-green-600 bg-green-50 border-green-200";
  if (h === "fair" || h === "matig" || h === "passable") return "text-yellow-600 bg-yellow-50 border-yellow-200";
  if (h === "poor" || h === "slecht" || h === "mauvais") return "text-red-600 bg-red-50 border-red-200";
  return "text-outline bg-surface-container-low border-outline-variant/20";
}

function detailBg(health?: string): string {
  const h = (health || "").toLowerCase();
  if (h === "good" || h === "goed" || h === "bon") return "bg-green-50 border-green-200";
  if (h === "fair" || h === "matig" || h === "passable") return "bg-yellow-50 border-yellow-200";
  if (h === "poor" || h === "slecht" || h === "mauvais") return "bg-red-50 border-red-200";
  return "bg-surface-container-low border-outline-variant/10";
}

export default function GardenPhotoGallery({
  gardenId,
  API_URL,
  accessToken,
}: GardenPhotoGalleryProps) {
  const t = useTranslations("Common");
  const locale = useLocale();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<GardenPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<GardenPhoto | null>(null);
  const [notes, setNotes] = useState("");
  const [uploadError, setUploadError] = useState("");

  const fetchPhotos = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/gardens/${gardenId}/photos/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) setPhotos(await res.json());
    } catch (e) {
      console.error("Error loading garden photos:", e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (gardenId) fetchPhotos();
  }, [gardenId]);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setUploadError("");
    const formData = new FormData();
    formData.append("file", file);
    if (notes) formData.append("notes", notes);
    try {
      const res = await fetch(
        `${API_URL}/gardens/${gardenId}/photos/?locale=${locale}&analyze=true`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: formData,
        }
      );
      if (res.ok) {
        setNotes("");
        await fetchPhotos();
      } else {
        const data = await res.json();
        setUploadError(data.detail || t("photo.uploadError"));
      }
    } catch (e) {
      setUploadError(t("photo.uploadError"));
    }
    setIsUploading(false);
  };

  const handleDelete = async (photoId: number) => {
    if (!confirm(t("photo.confirmDelete"))) return;
    try {
      const res = await fetch(
        `${API_URL}/gardens/${gardenId}/photos/${photoId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (res.ok) {
        if (selectedPhoto?.id === photoId) setSelectedPhoto(null);
        await fetchPhotos();
      }
    } catch (e) {
      console.error("Error deleting garden photo:", e);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-outline">
        <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
        {t("loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload section */}
      <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10">
        <h3 className="text-xs font-bold text-outline uppercase tracking-widest mb-3">
          {t("photo.addNew")}
        </h3>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("photo.gardenNotesPlaceholder")}
          className="w-full text-sm px-3 py-2 rounded-xl border border-outline-variant/30 bg-surface mb-3 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-on-primary rounded-xl font-bold hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
        >
          {isUploading ? (
            <>
              <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
              {t("photo.analyzing")}
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-xl">add_a_photo</span>
              {t("photo.takeOrUpload")}
            </>
          )}
        </button>
        {uploadError && (
          <p className="mt-2 text-xs text-error">{uploadError}</p>
        )}
      </div>

      {/* Photo timeline */}
      {photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-outline gap-2">
          <span className="material-symbols-outlined text-5xl opacity-20">photo_library</span>
          <p className="text-sm font-medium">{t("photo.noGardenPhotos")}</p>
          <p className="text-xs opacity-60">{t("photo.noGardenPhotosHint")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-outline uppercase tracking-widest px-1">
            {t("photo.history")} ({photos.length})
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo) => (
              <button
                key={photo.id}
                onClick={() =>
                  setSelectedPhoto(selectedPhoto?.id === photo.id ? null : photo)
                }
                className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                  selectedPhoto?.id === photo.id
                    ? "border-primary shadow-md scale-[0.97]"
                    : "border-transparent hover:border-outline-variant"
                }`}
              >
                <img
                  src={photo.file_path.startsWith('http') ? photo.file_path : `${API_URL}/${photo.file_path.replace(/^\/+/, '')}`}
                  alt={formatDate(photo.taken_at)}
                  className="w-full h-full object-cover"
                />
                {photo.ai_analysis?.overall_health && (
                  <div
                    className={`absolute bottom-1 left-1 right-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-center truncate ${healthBadgeColor(
                      photo.ai_analysis.overall_health
                    )}`}
                  >
                    {photo.ai_analysis.overall_health}
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Detail panel */}
          {selectedPhoto && (
            <div
              className={`rounded-2xl p-4 border space-y-4 ${detailBg(
                selectedPhoto.ai_analysis?.overall_health
              )}`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-outline">
                    {formatDate(selectedPhoto.taken_at)}
                  </p>
                  {selectedPhoto.notes && (
                    <p className="text-sm text-on-surface-variant italic">
                      "{selectedPhoto.notes}"
                    </p>
                  )}
                  {selectedPhoto.ai_analysis?.overall_health && (
                    <span
                      className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full border ${healthBadgeColor(
                        selectedPhoto.ai_analysis.overall_health
                      )}`}
                    >
                      {selectedPhoto.ai_analysis.overall_health}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(selectedPhoto.id)}
                  className="text-outline hover:text-error transition-colors shrink-0"
                  title={t("delete")}
                >
                  <span className="material-symbols-outlined text-xl">delete</span>
                </button>
              </div>

              {selectedPhoto.ai_analysis ? (
                <>
                  {/* Highlight */}
                  {selectedPhoto.ai_analysis.highlight && (
                    <div className="bg-white/70 rounded-xl px-4 py-3 flex items-start gap-3">
                      <span className="material-symbols-outlined text-primary text-xl mt-0.5 shrink-0">
                        priority_high
                      </span>
                      <p className="text-sm font-bold text-on-surface leading-relaxed">
                        {selectedPhoto.ai_analysis.highlight}
                      </p>
                    </div>
                  )}

                  {/* Observations */}
                  {selectedPhoto.ai_analysis.observations &&
                    selectedPhoto.ai_analysis.observations.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-outline uppercase tracking-widest mb-2">
                          {t("photo.observations")}
                        </p>
                        <ul className="space-y-1">
                          {selectedPhoto.ai_analysis.observations.map((obs, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-sm text-on-surface-variant"
                            >
                              <span className="material-symbols-outlined text-base text-secondary mt-0.5">
                                info
                              </span>
                              {obs}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {/* Problem areas */}
                  {selectedPhoto.ai_analysis.problem_areas &&
                    selectedPhoto.ai_analysis.problem_areas.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-outline uppercase tracking-widest mb-2">
                          {t("photo.problemAreas")}
                        </p>
                        <ul className="space-y-1">
                          {selectedPhoto.ai_analysis.problem_areas.map((p, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-sm text-on-surface-variant"
                            >
                              <span className="material-symbols-outlined text-base text-yellow-500 mt-0.5">
                                warning
                              </span>
                              {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {/* Recommendations */}
                  {selectedPhoto.ai_analysis.advice &&
                    selectedPhoto.ai_analysis.advice.length > 0 && (
                      <div className="bg-white/60 rounded-xl p-3">
                        <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2 flex items-center gap-1">
                          <span className="material-symbols-outlined text-base">eco</span>
                          {t("photo.recommendations")}
                        </p>
                        <ul className="space-y-1.5">
                          {selectedPhoto.ai_analysis.advice.map((tip, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-sm text-on-surface"
                            >
                              <span className="text-primary font-black text-base leading-5">
                                {i + 1}.
                              </span>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </>
              ) : (
                <p className="text-sm text-outline italic">{t("photo.noAnalysis")}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
