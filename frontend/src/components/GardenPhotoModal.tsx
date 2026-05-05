"use client";

import React from "react";
import Modal from "./Modal";
import GardenPhotoGallery from "./GardenPhotoGallery";
import { useTranslations } from "next-intl";

interface GardenPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  gardenId: number;
  gardenName: string;
  API_URL: string;
  accessToken?: string;
}

export default function GardenPhotoModal({
  isOpen,
  onClose,
  gardenId,
  gardenName,
  API_URL,
  accessToken,
}: GardenPhotoModalProps) {
  const t = useTranslations("Common");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={gardenName}
      maxWidth="max-w-2xl"
    >
      <GardenPhotoGallery
        gardenId={gardenId}
        API_URL={API_URL}
        accessToken={accessToken}
      />
    </Modal>
  );
}
