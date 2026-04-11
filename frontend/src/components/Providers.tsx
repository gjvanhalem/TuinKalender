"use client";

import { SessionProvider } from "next-auth/react";
import { LocaleRedirector } from "./LocaleRedirector";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider 
      refetchOnWindowFocus={true} 
      refetchInterval={5 * 60} // Refetch every 5 minutes to keep it fresh
    >
      <LocaleRedirector />
      {children}
    </SessionProvider>
  );
}
