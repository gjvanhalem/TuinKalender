"use client";

import { useState, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, Leaf, Flower2, Scissors, Sprout, ArrowRight, Map, LayoutGrid, Table2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Task {
  id: number;
  month: number;
  category: string;
  description: string;
  plant_id: number;
  plant: {
    common_name: string;
    scientific_name: string;
    garden_name?: string;
  };
}

const months = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December"
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const categoryIcons: Record<string, any> = {
  "Snoeien": Scissors,
  "Bloei": Flower2,
  "Planten": Sprout,
  "Zaaien": Sprout,
  "Oogsten": Leaf,
};

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allYearTasks, setAllYearTasks] = useState<Task[]>([]);
  const [gardens, setGardens] = useState<any[]>([]);
  const [selectedGardenId, setSelectedGardenId] = useState<string>("all");
  const [viewMode, setViewMode] = useState<'list' | 'table'>('table');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (session) {
      fetchGardens();
    }
  }, [session, status]);

  useEffect(() => {
    if (session) {
      fetchTasks();
      fetchAllYearTasks();
    }
  }, [currentMonth, selectedGardenId, session]);

  const fetchAllYearTasks = async () => {
    try {
      let url = `${API_URL}/tasks/`;
      if (selectedGardenId !== "all") {
        url += `?garden_id=${selectedGardenId}`;
      }
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${session?.accessToken || session?.user?.email}` }
      });
      const data = await response.json();
      setAllYearTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching all year tasks:", error);
    }
  };

  const fetchGardens = async () => {
    try {
      const response = await fetch(`${API_URL}/gardens/`, {
        headers: { Authorization: `Bearer ${session?.accessToken || session?.user?.email}` }
      });
      const data = await response.json();
      setGardens(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching gardens:", error);
      setGardens([]);
    }
  };

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      let url = `${API_URL}/tasks/?month=${currentMonth}`;
      if (selectedGardenId !== "all") {
        url += `&garden_id=${selectedGardenId}`;
      }
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${session?.accessToken || session?.user?.email}` }
      });
      const data = await response.json();
      setTasks(Array.isArray(data) ? data : []);
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      setTasks([]);
      setIsLoading(false);
    }
  };

  const nextMonth = () => setCurrentMonth((prev) => (prev % 12) + 1);
  const prevMonth = () => setCurrentMonth((prev) => (prev === 1 ? 12 : prev - 1));

  if (status === "loading") return <div className="p-12 text-center text-garden-green-700 font-bold">Laden...</div>;

  return (
    <div className="container mx-auto p-6 md:p-12 max-w-5xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 mb-2 flex items-center gap-3">
            <div className="bg-garden-green-100 p-2 rounded-2xl">
              <Calendar className="w-8 h-8 text-garden-green-600" />
            </div>
            Tuinkalender
          </h1>
          <p className="text-slate-500 font-medium text-lg">Jouw maandelijkse gids voor een bloeiende tuin.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          {/* Garden Filter */}
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100">
            <Map className="w-4 h-4 text-slate-400" />
            <select 
              value={selectedGardenId}
              onChange={(e) => setSelectedGardenId(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-600 outline-none pr-8 cursor-pointer"
            >
              <option value="all">Alle Tuinen</option>
              {gardens.map(g => (
                <option key={g.id} value={g.id.toString()}>
                  {g.name} {!g.is_owner ? `(van ${g.owner_email.split('@')[0]})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100 h-[52px]">
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-garden-green-100 text-garden-green-600' : 'text-slate-400 hover:text-slate-600'}`}
              title="Lijstweergave"
            >
              <LayoutGrid className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-garden-green-100 text-garden-green-600' : 'text-slate-400 hover:text-slate-600'}`}
              title="Tabelweergave (Jaaroverzicht)"
            >
              <Table2 className="w-6 h-6" />
            </button>
          </div>

          <div className={`flex items-center gap-6 bg-white px-6 py-3 rounded-[30px] shadow-sm border border-slate-100 ${viewMode === 'table' ? 'opacity-30 pointer-events-none' : ''}`}>
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-garden-green-600 transition-all"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <div className="text-center min-w-[160px]">
             <span className="block text-[10px] font-black uppercase tracking-widest text-slate-300 mb-1">Bekijken</span>
             <span className="text-2xl font-black text-slate-900">{months[currentMonth - 1]}</span>
          </div>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-garden-green-600 transition-all"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {isLoading ? (
          <div className="flex justify-center py-24">
             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-garden-green-600"></div>
          </div>
        ) : viewMode === 'list' ? (
          tasks.length === 0 ? (
            <div className="bg-white p-24 rounded-[60px] shadow-sm border border-dashed border-slate-200 text-center flex flex-col items-center">
              <div className="bg-slate-50 p-8 rounded-full mb-8">
                <Calendar className="w-16 h-16 text-slate-200" />
              </div>
              <h3 className="text-3xl font-black text-slate-900 mb-4">Een rustige maand voor de boeg</h3>
              <p className="text-slate-500 max-w-sm font-medium">Er zijn geen taken gepland voor {months[currentMonth - 1]}. Gebruik deze tijd om je volgende beplanting te plannen!</p>
            </div>
          ) : (
            tasks.map((task) => {
              const categories = task.category.split(", ");
              const icons = categories.map(cat => categoryIcons[cat.trim()] || Leaf);
              
              return (
                <div key={task.id} className="group bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-8 hover:shadow-xl transition-all duration-500">
                  <div className="flex -space-x-6">
                    {icons.map((Icon, idx) => (
                      <div key={idx} className={`p-6 rounded-[30px] bg-slate-50 text-garden-green-600 group-hover:bg-garden-green-600 group-hover:text-white transition-all duration-500 shadow-inner border-4 border-white`}>
                        <Icon className="w-10 h-10" />
                      </div>
                    ))}
                  </div>
                  <div className="flex-grow text-center md:text-left">
                    <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
                      <div className="flex flex-wrap gap-1 justify-center md:justify-start">
                        {categories.map(cat => (
                          <span key={cat} className="bg-garden-green-100 text-garden-green-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                            {cat}
                          </span>
                        ))}
                      </div>
                      <h3 className="text-2xl font-black text-slate-900">{task.plant.common_name}</h3>
                      {task.plant.garden_name && (
                        <span className="text-slate-400 text-sm font-medium flex items-center gap-1 ml-0 md:ml-2">
                          <Map className="w-3 h-3" /> {task.plant.garden_name}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 font-medium text-lg leading-relaxed">{task.description}</p>
                  </div>
                  <div className="shrink-0">
                     <Link 
                       href={`/gardens/${task.plant.garden_id}`}
                       className="w-12 h-12 rounded-full border border-slate-100 flex items-center justify-center text-slate-300 hover:border-garden-green-200 hover:text-garden-green-500 transition-all cursor-pointer"
                       title="Ga naar tuin"
                     >
                        <ArrowRight className="w-6 h-6" />
                     </Link>
                  </div>
                </div>
              );
            })
          )
        ) : (
          /* Table View - Year Overview */
          <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-slate-400 w-64">Plant</th>
                    {months.map((m, idx) => (
                      <th key={m} className={`p-4 text-[10px] font-black uppercase tracking-widest text-center ${idx + 1 === new Date().getMonth() + 1 ? 'text-garden-green-600 bg-garden-green-50/50' : 'text-slate-400'}`}>
                        {m.substring(0, 3)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {allYearTasks.map((item: any) => {
                    const plant = item.plant;
                    const plantTasks = item.tasks || [];
                    
                    return (
                      <tr key={item.plant_id} className="hover:bg-slate-50/50 transition-colors group/row">
                        <td className="p-6">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 group-hover/row:text-garden-green-700 transition-colors">{plant.common_name}</span>
                            <span className="text-[10px] text-slate-400 italic">{plant.scientific_name}</span>
                          </div>
                        </td>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
                          const monthTasks = plantTasks.filter((t: any) => t.month === m);
                          const hasPruning = monthTasks.some((t: any) => t.category.includes("Snoeien"));
                          const hasBlooming = monthTasks.some((t: any) => t.category.includes("Bloei"));
                          const isCurrentMonth = m === new Date().getMonth() + 1;

                          return (
                            <td key={m} className={`p-2 border-x border-slate-50/30 text-center ${isCurrentMonth ? 'bg-garden-green-50/30' : ''}`}>
                              <div className="flex flex-col items-center justify-center gap-1 min-h-[40px]">
                                {hasBlooming && (
                                  <div className="w-5 h-5 bg-garden-green-100 text-garden-green-600 rounded-full flex items-center justify-center" title="Bloei">
                                    <Flower2 className="w-3 h-3" />
                                  </div>
                                )}
                                {hasPruning && (
                                  <div className="w-5 h-5 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center" title="Snoeien">
                                    <Scissors className="w-3 h-3" />
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-6 justify-center">
               <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <div className="w-3 h-3 bg-garden-green-100 text-garden-green-600 rounded-full flex items-center justify-center"><Flower2 className="w-2 h-2" /></div>
                  Bloeiperiode
               </div>
               <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <div className="w-3 h-3 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center"><Scissors className="w-2 h-2" /></div>
                  Snoeimaanden
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
