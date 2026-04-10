"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import Modal from "./Modal";
import { useRouter } from "@/i18n/routing";
import { useSession } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function OnboardingModal({ isOpen, onClose, user }: { isOpen: boolean, onClose: () => void, user: any }) {
  const t = useTranslations("Settings.onboarding");
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState(1);

  const handleFinishOnboarding = async (goToSettings = false) => {
    try {
      await fetch(`${API_URL}/users/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.accessToken}`
        },
        body: JSON.stringify({
          ...user,
          has_onboarded: true
        })
      });
      
      onClose();
      if (goToSettings) {
        router.push("/settings");
      }
    } catch (error) {
      console.error("Error updating onboarding status:", error);
      onClose();
    }
  };

  const steps = [
    (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="flex justify-center mb-8">
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-5xl">potted_plant</span>
          </div>
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-bold text-on-surface">{t('welcome')}</h3>
          <p className="text-on-surface-variant">{t('description')}</p>
        </div>
        <div className="space-y-4 pt-4">
          <div className="flex gap-4 p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
            <span className="material-symbols-outlined text-primary">yard</span>
            <p className="text-sm font-medium">{t('featureGardens')}</p>
          </div>
          <div className="flex gap-4 p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
            <span className="material-symbols-outlined text-primary">calendar_month</span>
            <p className="text-sm font-medium">{t('featureCalendar')}</p>
          </div>
          <div className="flex gap-4 p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
            <span className="material-symbols-outlined text-primary">psychology</span>
            <p className="text-sm font-medium">{t('featureAi')}</p>
          </div>
        </div>
      </div>
    ),
    (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="text-center space-y-2 mb-8">
          <h3 className="text-2xl font-bold text-on-surface">API Configuration</h3>
          <p className="text-on-surface-variant">{t('apiSetup')}</p>
        </div>
        <div className="space-y-6">
          <div className="space-y-1">
            <h4 className="font-bold flex items-center gap-2 text-primary">
              <span className="material-symbols-outlined text-sm">database</span>
              {t('trefleTitle')}
            </h4>
            <p className="text-sm text-on-surface-variant">{t('trefleDesc')}</p>
          </div>
          <div className="space-y-1">
            <h4 className="font-bold flex items-center gap-2 text-primary">
              <span className="material-symbols-outlined text-sm">smart_toy</span>
              {t('aiTitle')}
            </h4>
            <p className="text-sm text-on-surface-variant">{t('aiDesc')}</p>
          </div>
          <div className="space-y-1">
            <h4 className="font-bold flex items-center gap-2 text-primary">
              <span className="material-symbols-outlined text-sm">cloud</span>
              {t('weatherTitle')}
            </h4>
            <p className="text-sm text-on-surface-variant">{t('weatherDesc')}</p>
          </div>
        </div>
      </div>
    )
  ];

  const footer = (
    <div className="flex justify-between items-center w-full">
      <div className="flex gap-1">
        {steps.map((_, i) => (
          <div 
            key={i} 
            className={`h-1.5 rounded-full transition-all duration-300 ${step === i + 1 ? 'w-8 bg-primary' : 'w-2 bg-outline-variant'}`}
          />
        ))}
      </div>
      <div className="flex gap-3">
        {step > 1 && (
          <button 
            onClick={() => setStep(step - 1)}
            className="px-6 py-2.5 text-on-surface-variant font-bold hover:bg-surface-container-high rounded-xl transition-all"
          >
            {t('back')}
          </button>
        )}
        {step === 1 ? (
          <button 
            onClick={() => setStep(2)}
            className="px-6 py-2.5 bg-primary text-on-primary rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-all active:scale-95"
          >
            {t('next')}
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        ) : (
          <>
            <button 
              onClick={() => handleFinishOnboarding(false)}
              className="px-6 py-2.5 text-on-surface-variant font-bold hover:bg-surface-container-high rounded-xl transition-all"
            >
              {t('finish')}
            </button>
            <button 
              onClick={() => handleFinishOnboarding(true)}
              className="px-6 py-2.5 bg-primary text-on-primary rounded-xl font-bold hover:opacity-90 transition-all active:scale-95"
            >
              {t('goToSettings')}
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => handleFinishOnboarding(false)}
      title=""
      footer={footer}
      maxWidth="max-w-xl"
    >
      {steps[step - 1]}
    </Modal>
  );
}
