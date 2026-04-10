"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import OnboardingModal from "./OnboardingModal";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function LocaleRedirector() {
  const { data: session, status } = useSession();
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    // Only check once when the user is logged in
    if (status === "authenticated" && session?.accessToken && !checked) {
      const checkUserStatus = async () => {
        try {
          const response = await fetch(`${API_URL}/users/me`, {
            headers: { Authorization: `Bearer ${session.accessToken}` },
          });
          
          if (response.ok) {
            const data = await response.json();
            setUserData(data);
            
            // Handle Locale Redirect
            const preferredLanguage = data.preferred_language;
            if (preferredLanguage && preferredLanguage !== currentLocale) {
              router.replace(pathname, { locale: preferredLanguage });
            }

            // Handle Onboarding
            if (!data.has_onboarded) {
              setShowOnboarding(true);
            }
          }
          setChecked(true);
        } catch (error) {
          console.error("Error checking user status:", error);
          setChecked(true); // Don't keep trying if it fails
        }
      };

      checkUserStatus();
    } else if (status === "unauthenticated") {
      setChecked(false);
      setShowOnboarding(false);
    }
  }, [status, session, currentLocale, router, pathname, checked]);

  return (
    <>
      {userData && (
        <OnboardingModal 
          isOpen={showOnboarding} 
          onClose={() => setShowOnboarding(false)} 
          user={userData} 
        />
      )}
    </>
  );
}
