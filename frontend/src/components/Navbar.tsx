"use client";

import { useState, useEffect } from "react";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { useSession, signIn, signOut } from "next-auth/react";
import { useTranslations, useLocale } from "next-intl";
import Logo from "./Logo";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Navbar() {
  const t = useTranslations('Common');
  const locale = useLocale();
  const router = useRouter();
  const { data: session } = useSession();
  const pathname = usePathname();
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

  const onLocaleChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

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
    <>
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-surface/70 backdrop-blur-xl flex justify-between items-center px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Logo size={32} />
          <h1 className="font-headline font-bold tracking-tight text-2xl text-primary">{t('appName')}</h1>
        </Link>
        <div className="flex items-center gap-4">
          {/* Language Switcher */}
          <select 
            value={locale}
            onChange={(e) => onLocaleChange(e.target.value)}
            className="bg-transparent text-on-surface-variant text-sm font-semibold cursor-pointer focus:outline-none hover:opacity-80 transition-opacity"
          >
            <option value="en">EN</option>
            <option value="nl">NL</option>
            <option value="fr">FR</option>
          </select>

          {session && (
            <>
              <Link href="/settings" className="material-symbols-outlined text-on-surface-variant hover:opacity-80 transition-opacity active:scale-95 duration-200">
                settings
              </Link>
              <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-container-high ring-2 ring-primary/10">
                <img 
                  alt="User profile" 
                  src={session.user?.image || "https://lh3.googleusercontent.com/a/default-user"} 
                  className="w-full h-full object-cover"
                />
              </div>
              <button onClick={() => signOut()} className="material-symbols-outlined text-on-surface-variant hover:text-error transition-colors">
                logout
              </button>
            </>
          )}
          {!session && (
            <button 
              onClick={() => signIn('google')}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-semibold hover:opacity-90 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined">login</span>
              <span className="hidden sm:inline">{t('login')}</span>
            </button>
          )}
        </div>
      </header>

      {/* BottomNavBar - Only show when logged in */}
      {session && isAuthorized && (
        <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-3 bg-surface/80 backdrop-blur-2xl z-50 rounded-t-lg md:rounded-t-xl shadow-[0_-4px_32px_rgba(21,30,22,0.06)] lg:max-w-md lg:left-1/2 lg:-translate-x-1/2 lg:mb-4 lg:rounded-full">
          <Link 
            href="/" 
            className={`flex flex-col items-center justify-center rounded-full transition-all p-2 ${pathname === '/' ? 'text-primary opacity-100 bg-primary/10' : 'text-on-surface opacity-60 hover:opacity-100 hover:bg-surface-container-low'}`}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: pathname === '/' ? "'FILL' 1" : "" }}>home</span>
            <span className="font-body text-[11px] font-medium tracking-wide uppercase mt-1">Home</span>
          </Link>
          <Link 
            href="/gardens" 
            className={`flex flex-col items-center justify-center rounded-full px-6 py-2 transition-all active:scale-90 duration-200 ${pathname.startsWith('/gardens') ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-on-surface opacity-60 hover:opacity-100 hover:bg-surface-container-low'}`}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: pathname.startsWith('/gardens') ? "'FILL' 1" : "" }}>potted_plant</span>
            <span className="font-body text-[11px] font-medium tracking-wide uppercase mt-1">Tuinen</span>
          </Link>
          <Link 
            href="/calendar" 
            className={`flex flex-col items-center justify-center rounded-full transition-all p-2 ${pathname === '/calendar' ? 'text-primary opacity-100 bg-primary/10' : 'text-on-surface opacity-60 hover:opacity-100 hover:bg-surface-container-low'}`}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: pathname === '/calendar' ? "'FILL' 1" : "" }}>calendar_month</span>
            <span className="font-body text-[11px] font-medium tracking-wide uppercase mt-1">Kalender</span>
          </Link>
          {isAdmin && (
            <Link 
              href="/admin" 
              className={`flex flex-col items-center justify-center rounded-full transition-all p-2 ${pathname === '/admin' ? 'text-secondary opacity-100 bg-secondary/10' : 'text-on-surface opacity-60 hover:opacity-100 hover:bg-surface-container-low'}`}
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: pathname === '/admin' ? "'FILL' 1" : "" }}>shield</span>
              <span className="font-body text-[11px] font-medium tracking-wide uppercase mt-1">Beheer</span>
            </Link>
          )}
        </nav>
      )}

      {/* FAB - Page specific or global? Let's add it here for now if user is on gardens page */}
      {/* This could be handled inside the pages instead for better context */}
    </>
  );
}
