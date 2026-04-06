"use client";

import { useState, useEffect } from "react";
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
  garden_id?: number;
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
    garden_id?: number;
  };
}

const months = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December"
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const categoryIcons: Record<string, string> = {
  "Snoeien": "content_cut",
  "Bloei": "filter_vintage",
  "Planten": "sprout",
  "Zaaien": "sprout",
  "Oogsten": "eco",
};

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allYearTasks, setAllYearTasks] = useState<any[]>([]);
  const [gardens, setGardens] = useState<any[]>([]);
  const [selectedGardenId, setSelectedGardenId] = useState<string>("all");
  const [viewMode, setViewMode] = useState<'list' | 'table'>('list');
  const [isLoading, setIsLoading] = useState(true);
  
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

  useEffect(() => {
    if (session) {
      fetchTasks();
      fetchAllYearTasks();
    }
  }, [currentMonth, selectedGardenId, session]);

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
          const formData = new FormData();
          formData.append("file", file);
          await fetch(`${API_URL}/plants/${plantIdToUpload}/image/`, {
            method: "POST",
            headers: { Authorization: `Bearer ${session?.accessToken}` },
            body: formData,
          });
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
        body: JSON.stringify({ garden_id: targetGardenId }),
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

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-primary text-5xl animate-spin">calendar_month</span>
          <p className="text-on-surface font-medium animate-pulse">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-5xl mx-auto">
      <section className="mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <span className="font-label text-sm text-primary font-semibold tracking-[0.2em] uppercase mb-2 block">Seizoensgids</span>
            <h2 className="font-headline text-5xl md:text-6xl font-bold tracking-tight text-on-surface">Kalender</h2>
          </div>
          <div className="flex bg-surface-container-high p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant'}`}
            >
              <span className="material-symbols-outlined text-[20px]">view_list</span>
              <span className="text-sm font-bold">Lijst</span>
            </button>
            <button 
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant'}`}
            >
              <span className="material-symbols-outlined text-[20px]">grid_on</span>
              <span className="text-sm font-bold">Jaaroverzicht</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="w-full md:w-auto flex items-center gap-2 bg-surface-container-high px-4 py-2 rounded-xl">
            <span className="material-symbols-outlined text-outline">map</span>
            <select 
              value={selectedGardenId}
              onChange={(e) => setSelectedGardenId(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-sm font-bold text-on-surface-variant outline-none pr-8 cursor-pointer w-full"
            >
              <option value="all">Alle Tuinen</option>
              {gardens.map(g => (
                <option key={g.id} value={g.id.toString()}>
                  {g.name} {!g.is_owner ? `(gedeeld)` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className={`flex-grow flex items-center justify-between bg-surface-container-low px-6 py-3 rounded-2xl border border-outline-variant/10 ${viewMode === 'table' ? 'opacity-30 pointer-events-none' : ''}`}>
            <button onClick={prevMonth} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-high text-on-surface-variant transition-all">
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <div className="text-center">
              <span className="text-2xl font-bold text-on-surface">{months[currentMonth - 1]}</span>
            </div>
            <button onClick={nextMonth} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-high text-on-surface-variant transition-all">
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      </section>

      <div className="space-y-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface-container-low h-32 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : viewMode === 'list' ? (
          tasks.length === 0 ? (
            <div className="text-center py-20 bg-surface-container-low/50 rounded-3xl border-2 border-dashed border-outline-variant/20">
              <span className="material-symbols-outlined text-outline text-6xl mb-4">sunny</span>
              <p className="text-on-surface-variant font-medium">Geen taken voor {months[currentMonth - 1]}.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tasks.map((task) => {
                const categories = task.category.split(", ");
                return (
                  <div key={task.id} className="group bg-surface-container-low p-6 rounded-xl border border-outline-variant/5 hover:bg-surface-container-high transition-all flex flex-col md:flex-row items-center gap-6 cursor-pointer" onClick={() => fetchPlantDetails(task.plant_id)}>
                    <div className="flex gap-2">
                      {categories.map((cat, idx) => (
                        <div key={idx} className="w-14 h-14 rounded-2xl bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm">
                          <span className="material-symbols-outlined text-2xl">{categoryIcons[cat.trim()] || 'leaf'}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex-grow text-center md:text-left">
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-1">
                        <h4 className="font-headline text-xl font-bold text-on-surface group-hover:text-primary transition-colors">{task.plant.common_name}</h4>
                        <span className="text-[10px] bg-outline/10 text-on-surface-variant px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">{task.plant.garden_name}</span>
                      </div>
                      <p className="text-on-surface-variant font-medium">{task.description}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-3">
                      <Link href={`/gardens/${task.plant.garden_id}`} onClick={(e) => e.stopPropagation()} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-primary/10 text-primary transition-all">
                        <span className="material-symbols-outlined">open_in_new</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* Table View */
          <div className="bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden editorial-shadow">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-surface-container-high/50 border-b border-outline-variant/10">
                    <th className="p-6 text-[10px] font-bold uppercase tracking-widest text-outline w-64">Plant</th>
                    {months.map((m, idx) => (
                      <th key={m} className={`p-4 text-[10px] font-bold uppercase tracking-widest text-center ${idx + 1 === new Date().getMonth() + 1 ? 'text-primary' : 'text-outline'}`}>
                        {m.substring(0, 3)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {allYearTasks.map((item: any) => (
                    <tr key={item.plant_id} className="hover:bg-surface-container-high/50 transition-colors cursor-pointer" onClick={() => fetchPlantDetails(item.plant_id)}>
                      <td className="p-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-on-surface">{item.plant.common_name}</span>
                          <span className="text-[10px] text-outline italic">{item.plant.scientific_name}</span>
                        </div>
                      </td>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
                        const monthTasks = (item.tasks || []).filter((t: any) => t.month === m);
                        const hasPruning = monthTasks.some((t: any) => t.category.includes("Snoeien"));
                        const hasBlooming = monthTasks.some((t: any) => t.category.includes("Bloei"));
                        return (
                          <td key={m} className={`p-2 text-center ${m === new Date().getMonth() + 1 ? 'bg-primary/5' : ''}`}>
                            <div className="flex flex-col items-center justify-center gap-1 min-h-[40px]">
                              {hasBlooming && <span className="material-symbols-outlined text-primary text-sm">filter_vintage</span>}
                              {hasPruning && <span className="material-symbols-outlined text-secondary text-sm">content_cut</span>}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-6 bg-surface-container-high/30 border-t border-outline-variant/10 flex flex-wrap gap-6 justify-center">
               <div className="flex items-center gap-2 text-[10px] font-bold text-outline uppercase tracking-widest">
                  <span className="material-symbols-outlined text-primary text-sm">filter_vintage</span>
                  Bloeiperiode
               </div>
               <div className="flex items-center gap-2 text-[10px] font-bold text-outline uppercase tracking-widest">
                  <span className="material-symbols-outlined text-secondary text-sm">content_cut</span>
                  Snoeiperiode
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
        onEdit={(p) => {
          setActivePlant(p);
          setIsEditing(true);
          setIsPlantModalOpen(true);
          setIsPlantInfoModalOpen(false);
        }}
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
    </main>
  );
}
