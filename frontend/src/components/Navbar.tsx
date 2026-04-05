"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { Leaf, Map, Calendar, Settings, LogIn, LogOut, Shield } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Navbar() {
  const { data: session } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (session) {
      checkUserStatus();
    } else {
      setIsAdmin(false);
      setIsAuthorized(false);
    }
  }, [session]);

  const checkUserStatus = async () => {
    if (!session?.accessToken) return;

    try {
      const response = await fetch(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      
      if (response.status === 403) {
        signOut({ callbackUrl: "/?error=unauthorized" });
        return;
      }

      if (response.status === 401) {
        // Token might be invalid or expired
        console.warn("Unauthorized access to /users/me");
        signOut({ callbackUrl: "/?error=session_expired" });
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setIsAdmin(data.is_admin);
        setIsAuthorized(true);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-garden-green-100 shadow-sm flex justify-between items-center px-6 py-4">
      <Link href="/" className="flex items-center gap-2 text-2xl font-black text-garden-green-800 tracking-tight">
        <div className="bg-garden-green-600 p-1.5 rounded-lg">
          <Leaf className="w-6 h-6 text-white" />
        </div>
        Tuin<span className="text-garden-green-600">Kalender</span>
      </Link>
      
      <div className="flex gap-8 items-center font-semibold text-slate-600">
        {session && isAuthorized ? (
          <>
            <Link href="/gardens" className="hover:text-garden-green-600 transition-colors flex items-center gap-2">
              <Map className="w-5 h-5" />
              <span className="hidden md:inline">Mijn Tuinen</span>
            </Link>
            <Link href="/calendar" className="hover:text-garden-green-600 transition-colors flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              <span className="hidden md:inline">Kalender</span>
            </Link>
            {isAdmin && (
              <Link href="/admin" className="hover:text-garden-green-600 transition-colors flex items-center gap-2 text-amber-600">
                <Shield className="w-5 h-5" />
                <span className="hidden md:inline">Beheer</span>
              </Link>
            )}
            <Link href="/settings" className="hover:text-garden-green-600 transition-colors flex items-center gap-2" title="Instellingen">
              <Settings className="w-5 h-5" />
            </Link>
            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-3">
              <img src={session.user?.image || ""} className="w-8 h-8 rounded-full border border-garden-green-100" alt="" />
              <button onClick={() => signOut()} className="text-slate-400 hover:text-red-500 transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </>
        ) : !session ? (
          <button 
            onClick={() => signIn('google')} 
            className="bg-garden-green-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-garden-green-700 transition-all"
          >
            <LogIn className="w-5 h-5" />
            Inloggen met Google
          </button>
        ) : (
          <div className="text-sm text-slate-400 animate-pulse">Controleren...</div>
        )}
      </div>
    </nav>
  );
}
