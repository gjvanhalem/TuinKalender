"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";

interface PlantPhoto {
  id: number;
  plant_id: number;
  file_path: string;
  taken_at: string;
  notes?: string;
  ai_analysis?: {
    health_score?: number;
    status?: string;
    issues?: string[];
    diagnosis?: string;
    advice?: string;
  };
}

interface PlantPhotoGalleryProps {
  plantId: number;
  plantName: string;
  API_URL: string;
  accessToken?: string;
}

function healthColor(score?: number): string {
  if (!score) return "text-outline";
  if (score >= 8) return "text-green-600";
  if (score >= 5) return "text-yellow-500";
  return "text-red-500";
}

function healthBg(score?: number): string {
  if (!score) return "bg-surface-container-low";
  if (score >= 8) return "bg-green-50 border-green-200";
  if (score >= 5) return "bg-yellow-50 border-yellow-200";
  return "bg-red-50 border-red-200";
}

export default function PlantPhotoGallery({
  plantId,
  plantName,
  API_URL,
  accessToken,
}: PlantPhotoGalleryProps) {
  const t = useTranslations("Common");
  const locale = useLocale();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<PlantPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PlantPhoto | null>(null);
  const [notes, setNotes] = useState("");
  const [uploadError, setUploadError] = useState("");

  const fetchPhotos = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/plants/${plantId}/photos/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) setPhotos(await res.json());
    } catch (e) {
      console.error("Error loading plant photos:", e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (plantId) fetchPhotos();
  }, [plantId]);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setUploadError("");
    const formData = new FormData();
    formData.append("file", file);
    if (notes) formData.append("notes", notes);
    try {
      const res = await fetch(
        `${API_URL}/plants/${plantId}/photos/?locale=${locale}&analyze=true`,
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
        `${API_URL}/plants/${plantId}/photos/${photoId}`,
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
      console.error("Error deleting photo:", e);
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
          placeholder={t("photo.notesPlaceholder")}
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
          <p className="text-sm font-medium">{t("photo.noPhotos")}</p>
          <p className="text-xs opacity-60">{t("photo.noPhotosHint")}</p>
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
                onClick={() => setSelectedPhoto(selectedPhoto?.id === photo.id ? null : photo)}
                className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                  selectedPhoto?.id === photo.id
                    ? "border-primary shadow-md scale-[0.97]"
                    : "border-transparent hover:border-outline-variant"
                }`}
              >
                <img
                  src={`${API_URL}/${photo.file_path}`}
                  alt={formatDate(photo.taken_at)}
                  className="w-full h-full object-cover"
                />
                {photo.ai_analysis?.health_score && (
                  <div
                    className={`absolute bottom-1 right-1 text-xs font-bold px-1.5 py-0.5 rounded-full bg-white/90 ${healthColor(
                      photo.ai_analysis.health_score
                    )}`}
                  >
                    {photo.ai_analysis.health_score}/10
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Detail panel for selected photo */}
          {selectedPhoto && (
            <div
              className={`rounded-2xl p-4 border space-y-3 ${healthBg(
                selectedPhoto.ai_analysis?.health_score
              )}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-outline">
                    {formatDate(selectedPhoto.taken_at)}
                  </p>
                  {selectedPhoto.notes && (
                    <p className="text-sm text-on-surface-variant mt-0.5 italic">
                      "{selectedPhoto.notes}"
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(selectedPhoto.id)}
                  className="text-outline hover:text-error transition-colors"
                  title={t("delete")}
                >
                  <span className="material-symbols-outlined text-xl">delete</span>
                </button>
              </div>

              {selectedPhoto.ai_analysis ? (
                <>
                  {/* Health score + status */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`text-3xl font-black ${healthColor(
                        selectedPhoto.ai_analysis.health_score
                      )}`}
                    >
                      {selectedPhoto.ai_analysis.health_score ?? "—"}/10
                    </div>
                    <div>
                      <p className="text-xs text-outline uppercase tracking-widest">
                        {t("photo.healthScore")}
                      </p>
                      <p className="font-bold text-on-surface">
                        {selectedPhoto.ai_analysis.status ?? ""}
                      </p>
                    </div>
                  </div>

                  {/* Issues */}
                  {selectedPhoto.ai_analysis.issues &&
                    selectedPhoto.ai_analysis.issues.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-outline uppercase tracking-widest mb-1">
                          {t("photo.issues")}
                        </p>
                        <ul className="space-y-1">
                          {selectedPhoto.ai_analysis.issues.map((issue, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-sm text-on-surface-variant"
                            >
                              <span className="material-symbols-outlined text-base text-yellow-500 mt-0.5">
                                warning
                              </span>
                              {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {/* Diagnosis */}
                  {selectedPhoto.ai_analysis.diagnosis && (
                    <div>
                      <p className="text-xs font-bold text-outline uppercase tracking-widest mb-1">
                        {t("photo.diagnosis")}
                      </p>
                      <p className="text-sm text-on-surface-variant leading-relaxed">
                        {selectedPhoto.ai_analysis.diagnosis}
                      </p>
                    </div>
                  )}

                  {/* Advice */}
                  {selectedPhoto.ai_analysis.advice && (
                    <div className="bg-white/60 rounded-xl p-3">
                      <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">eco</span>
                        {t("photo.advice")}
                      </p>
                      <p className="text-sm text-on-surface leading-relaxed">
                        {selectedPhoto.ai_analysis.advice}
                      </p>
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
