"use client";

import { useState, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, Leaf, Flower2, Scissors, Sprout, ArrowRight, Map, LayoutGrid, Table2, Info, Plus, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PlantInfoModal from "@/components/PlantInfoModal";
import PlantModal from "@/components/PlantModal";

interface Plant {
  id: number;
  common_name: string;
  scientific_name: string;
  trefle_id: number;
  location_in_garden: string;
  image_path: string;
  image_url: string;
  remarks?: string;
  flowering_months?: string;
  pruning_months?: string;
  raw_data?: any;
  tasks?: any[];
}

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
  
  // Modal states
  const [isPlantInfoModalOpen, setIsPlantInfoModalOpen] = useState(false);
  const [isPlantModalOpen, setIsPlantModalOpen] = useState(false);
  const [activePlant, setActivePlant] = useState<Partial<Plant> | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [userSettings, setUserSettings] = useState<any | null>(null);
  const [adminPlantData, setAdminPlantData] = useState<any | null>(null);
  const [movingPlant, setMovingPlant] = useState<Plant | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (session) {
      fetchGardens();
      fetchUserSettings();
    }
  }, [session, status]);

  const fetchUserSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });
      if (response.ok) {
        setUserSettings(await response.json());
      }
    } catch (error) {}
  };

  const fetchPlantDetails = async (plantId: number) => {
    if (!plantId) return;

    setActivePlant({ id: plantId, common_name: "Laden..." } as any);
    setIsPlantInfoModalOpen(true);

    try {
      const response = await fetch(`${API_URL}/plants/${plantId}`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` }
      });
      
      if (response.ok) {
        const plant = await response.json();
        setActivePlant(plant);
      }
    } catch (error) {
      console.error("Error fetching plant details:", error);
    }
  };

  const handleSavePlant = async (plantData: Partial<Plant>, file: File | null) => {
    try {
      const isUpdating = !!plantData.id;
      const url = isUpdating ? `${API_URL}/plants/${plantData.id}` : `${API_URL}/plants/`;
      const method = isUpdating ? "PUT" : "POST";

      const response = await fetch(url, {
        method: method,
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.accessToken}`
        },
        body: JSON.stringify({
          ...plantData,
          garden_id: isUpdating ? plantData.garden_id : (selectedGardenId === "all" ? undefined : parseInt(selectedGardenId)),
        }),
      });
      if (response.ok) {
        const savedPlant = await response.json();
        const plantIdToUpload = isUpdating ? (plantData.id as number) : savedPlant.id;
        
        if (file) {
          await handleImageUpload(plantIdToUpload, file);
        }
        setIsPlantModalOpen(false);
        setActivePlant(null);
        fetchTasks();
        fetchAllYearTasks();
      }
    } catch (error) {
      console.error("Error saving plant:", error);
    }
  };

  const movePlant = async (plant: Plant, targetGardenId: number) => {
    try {
      const response = await fetch(`${API_URL}/plants/${plant.id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.accessToken}`
        },
        body: JSON.stringify({
          garden_id: targetGardenId
        }),
      });
      if (response.ok) {
        setMovingPlant(null);
        fetchTasks();
        fetchAllYearTasks();
      }
    } catch (error) {
      console.error("Error moving plant:", error);
    }
  };

  const handleImageUpload = async (plant_id: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      await fetch(`${API_URL}/plants/${plant_id}/image/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.accessToken}` },
        body: formData,
      });
    } catch (error) {}
  };

  const deletePlant = async (id: number) => {
    if (!confirm("Weet je zeker dat je deze plant wilt verwijderen?")) return;
    try {
      await fetch(`${API_URL}/plants/${id}`, { 
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.accessToken}` }
      });
      setIsPlantInfoModalOpen(false);
      fetchTasks();
      fetchAllYearTasks();
    } catch (error) {}
  };

  const startEditPlant = (plant: Plant) => {
    setActivePlant(plant);
    setIsEditing(true);
    setIsPlantModalOpen(true);
    setIsPlantInfoModalOpen(false);
  };

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
        headers: { Authorization: `Bearer ${session?.accessToken}` }
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
        headers: { Authorization: `Bearer ${session?.accessToken}` }
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
        headers: { Authorization: `Bearer ${session?.accessToken}` }
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
                      <h3 
                        onClick={(e) => { e.stopPropagation(); fetchPlantDetails(task.plant_id); }}
                        className="text-2xl font-black text-slate-900 cursor-pointer hover:text-garden-green-600 transition-colors"
                      >
                        {task.plant.common_name}
                      </h3>
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
                        <td 
                          className="p-6 cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); fetchPlantDetails(item.plant_id); }}
                        >
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

      <PlantInfoModal
        isOpen={isPlantInfoModalOpen}
        onClose={() => {
          setIsPlantInfoModalOpen(false);
          setActivePlant(null);
        }}
        plant={activePlant as any}
        onEdit={startEditPlant}
        onDelete={deletePlant}
        onViewRawData={setAdminPlantData}
        onMove={setMovingPlant}
        API_URL={API_URL}
        showAdminOptions={true}
      />

      <PlantModal
        isOpen={isPlantModalOpen}
        onClose={() => {
          setIsPlantModalOpen(false);
          setActivePlant(null);
        }}
        plant={activePlant}
        onSave={handleSavePlant}
        isEditing={isEditing}
        userSettings={userSettings}
        gardenId={selectedGardenId !== "all" ? parseInt(selectedGardenId) : undefined}
        API_URL={API_URL}
        accessToken={session?.accessToken as string}
      />

      {/* Admin Data Modal */}
      {adminPlantData && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden border border-slate-100">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Plant Ruwe Data (Admin)</h2>
                <p className="text-slate-500 text-sm font-medium">Volledige JSON-respons van Trefle.io</p>
              </div>
              <button 
                onClick={() => setAdminPlantData(null)}
                className="p-3 bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-2xl transition-all shadow-sm border border-slate-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-grow overflow-auto p-8 custom-scrollbar bg-slate-900">
              <pre className="text-xs text-emerald-400 font-mono leading-relaxed">
                {JSON.stringify(adminPlantData, null, 2)}
              </pre>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trefle API v1 • TuinKalender Admin View</p>
            </div>
          </div>
        </div>
      )}

      {/* Move Plant Modal */}
      {movingPlant && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-sm flex flex-col overflow-hidden border border-slate-100">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-xl font-black text-slate-900">Verplaatsen</h2>
                <p className="text-slate-500 text-xs font-medium">{movingPlant.common_name || movingPlant.scientific_name}</p>
              </div>
              <button onClick={() => setMovingPlant(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-3">
               <p className="text-sm font-bold text-slate-400 uppercase tracking-widest ml-1">Kies doeltuin</p>
               <div className="grid grid-cols-1 gap-2">
                 {gardens
                   .filter(g => g.id.toString() !== movingPlant.garden_id?.toString())
                   .map(g => (
                     <button
                       key={g.id}
                       onClick={() => movePlant(movingPlant, g.id)}
                       className="w-full p-4 text-left bg-slate-50 hover:bg-garden-green-50 rounded-2xl border border-transparent hover:border-garden-green-100 transition-all group flex items-center justify-between"
                     >
                        <span className="font-bold text-slate-700 group-hover:text-garden-green-700">{g.name}</span>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-garden-green-500 group-hover:translate-x-1 transition-all" />
                     </button>
                   ))
                 }
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
