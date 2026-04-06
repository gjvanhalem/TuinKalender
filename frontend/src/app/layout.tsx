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
      <body className="antialiased">
        <Providers>
          <Navbar />
          <div className="min-h-screen">
            <Suspense fallback={null}>
              {children}
            </Suspense>
          </div>
        </Providers>
      </body>
    </html>
  );
}
