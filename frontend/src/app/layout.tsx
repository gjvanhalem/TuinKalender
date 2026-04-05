import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import Navbar from "@/components/Navbar";
import { Leaf } from "lucide-react";
import { Suspense } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TuinKalender",
  description: "Jouw persoonlijke tuinkalender",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <body className={`${inter.className} bg-slate-50 text-slate-900`}>
        <Providers>
          <Navbar />
          <div className="min-h-screen pb-20">
            <Suspense fallback={null}>
              {children}
            </Suspense>
          </div>
          <footer className="bg-slate-900 text-slate-400 py-12 text-center">
            <div className="container mx-auto px-6">
              <div className="flex justify-center items-center gap-2 mb-4 text-white font-bold">
                <Leaf className="w-5 h-5 text-garden-green-400" />
                TuinKalender
              </div>
              <p className="max-w-md mx-auto mb-6 text-sm">
                Helpt je bij het moeiteloos beheren van je tuin met deskundige data en een persoonlijke kalender.
              </p>
              <p className="text-xs uppercase tracking-widest opacity-50 font-semibold">© 2026 TuinKalender • Mogelijk gemaakt door Trefle.io</p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
