"use client";

import { SessionProvider } from "next-auth/react";
import { LocaleRedirector } from "./LocaleRedirector";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <LocaleRedirector />
      {children}
    </SessionProvider>
  );
}
