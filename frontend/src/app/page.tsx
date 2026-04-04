"use client";

import { Leaf, Plus, Search, Calendar, Map, ArrowRight, LogIn } from 'lucide-react';
import Link from 'next/link';
import { useSession, signIn } from 'next-auth/react';

export default function Home() {
  const { data: session } = useSession();

  return (
    <main className="flex min-h-screen flex-col overflow-hidden">
      {/* Hero Section */}
      <section className="relative pt-24 pb-32 px-6 bg-gradient-to-br from-garden-green-900 via-garden-green-800 to-slate-900 overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">       
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-garden-green-400 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-emerald-500 rounded-full blur-[120px]" />
        </div>

        <div className="container mx-auto relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm font-medium mb-8">
            <Leaf className="w-4 h-4 text-garden-green-400" />
            Geef je tuin kracht
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight tracking-tight">
            Verzorg je planten,<br /><span className="text-garden-green-400">Vereenvoudig je tuinieren.</span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-300 mb-12 font-medium">
            Beheer je tuin met deskundige plantinzichten van Trefle en een aangepaste maandelijkse kalender.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {session ? (
              <>
                <Link href="/gardens" className="group bg-garden-green-500 hover:bg-garden-green-600 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-lg shadow-garden-green-900/40 transition-all flex items-center gap-2">
                  Mijn Tuinen
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="/calendar" className="bg-white/10 hover:bg-white/15 text-white px-8 py-4 rounded-2xl font-bold text-lg backdrop-blur-md border border-white/20 transition-all">
                  Bekijk Kalender
                </Link>
              </>
            ) : (
              <button 
                onClick={() => signIn('google')}
                className="group bg-garden-green-500 hover:bg-garden-green-600 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-lg shadow-garden-green-900/40 transition-all flex items-center gap-2"
              >
                Inloggen met Google om te beginnen
                <LogIn className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-24 px-6 bg-white relative z-20 -mt-10 rounded-t-[40px] md:rounded-t-[80px]">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
              <div className="w-14 h-14 bg-garden-green-100 rounded-2xl flex items-center justify-center mb-6">
                <Map className="w-7 h-7 text-garden-green-600" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-900 tracking-tight">Meerdere Tuinen</h3>
              <p className="text-slate-600 leading-relaxed">
                Organiseer je planten in verschillende fysieke locaties, zoals je achtertuin, voortuin of kas.
              </p>
            </div>
            
            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
                <Search className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-900 tracking-tight">Aangedreven door Trefle</h3>
              <p className="text-slate-600 leading-relaxed">
                Maak verbinding met de wereldwijde Trefle-database om automatisch wetenschappelijke namen en deskundige zorginstructies te krijgen.
              </p>
            </div>
            
            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
              <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mb-6">
                <Calendar className="w-7 h-7 text-amber-600" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-900 tracking-tight">Persoonlijke Taken</h3>
              <p className="text-slate-600 leading-relaxed">
                Blijf op de hoogte van snoeien, planten en bloeien met een kalender die zich aanpast aan je planten.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
