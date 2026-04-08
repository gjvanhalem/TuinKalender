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
  is_completed?: boolean;
  plant_id: number;
  plant: {
    common_name: string;
    scientific_name: string;
    garden_name?: string;
    garden_id?: number;
    image_path?: string;
    image_url?: string;
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
  "Water": "water_drop",
  "Voeding": "Nutrition",
  "Verpotten": "potted_plant",
  "Notitie": "sticky_note_2",
  "Taak": "checklist"
};

// Client-side cache to persist data across tab switches within the session
let calendarCache: {
  tasks: Task[];
  allYearTasks: any[];
  gardens: any[];
  userSettings: any | null;
} | null = null;

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [tasks, setTasks] = useState<Task[]>(calendarCache?.tasks || []);
  const [allYearTasks, setAllYearTasks] = useState<any[]>(calendarCache?.allYearTasks || []);
  const [gardens, setGardens] = useState<any[]>(calendarCache?.gardens || []);
  const [selectedGardenId, setSelectedGardenId] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<'list' | 'table'>('list');
  const [isLoading, setIsLoading] = useState(!calendarCache);
  
  const [isPlantInfoModalOpen, setIsPlantInfoModalOpen] = useState(false);
  const [isPlantModalOpen, setIsPlantModalOpen] = useState(false);
  const [activePlant, setActivePlant] = useState<Partial<Plant> | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [userSettings, setUserSettings] = useState<any | null>(calendarCache?.userSettings || null);
  const [adminPlantData, setAdminPlantData] = useState<any | null>(null);
  const [movingPlant, setMovingPlant] = useState<Plant | null>(null);
  
  const [isAddingTask, setIsAddingTask] = useState<number | null>(null); // plantId
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState("Notitie");

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
        const data = await response.json();
        setUserSettings(data);
        if (!calendarCache) calendarCache = { tasks: [], allYearTasks: [], gardens: [], userSettings: null };
        calendarCache.userSettings = data;
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
      const finalData = Array.isArray(data) ? data : [];
      setAllYearTasks(finalData);
      if (!calendarCache) calendarCache = { tasks: [], allYearTasks: [], gardens: [], userSettings: null };
      calendarCache.allYearTasks = finalData;
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
      const finalData = Array.isArray(data) ? data : [];
      setGardens(finalData);
      if (!calendarCache) calendarCache = { tasks: [], allYearTasks: [], gardens: [], userSettings: null };
      calendarCache.gardens = finalData;
    } catch (error) {
      console.error("Error fetching gardens:", error);
      setGardens([]);
    }
  };

  const fetchTasks = async () => {
    if (!calendarCache) setIsLoading(true);
    try {
      let url = `${API_URL}/tasks/?month=${currentMonth}`;
      if (selectedGardenId !== "all") {
        url += `&garden_id=${selectedGardenId}`;
      }
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${session?.accessToken}` }
      });
      const data = await response.json();
      const finalData = Array.isArray(data) ? data : [];
      setTasks(finalData);
      if (!calendarCache) calendarCache = { tasks: [], allYearTasks: [], gardens: [], userSettings: null };
      calendarCache.tasks = finalData;
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      setTasks([]);
      setIsLoading(false);
    }
  };

  const toggleTask = async (taskId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(`${API_URL}/tasks/${taskId}/toggle`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session?.accessToken}` }
      });
      if (response.ok) {
        // Correct optimistic update for grouped task structure
        setTasks(prev => prev.map(group => ({
          ...group,
          tasks: group.tasks.map((t: any) => t.id === taskId ? { ...t, is_completed: !t.is_completed } : t)
        })));
        fetchAllYearTasks(); // Refresh table view too
      }
    } catch (error) {
      console.error("Error toggling task:", error);
    }
  };

  const handleAddCustomTask = async (plantId: number) => {
    if (!newTaskDescription.trim()) return;
    
    try {
      const response = await fetch(`${API_URL}/tasks/`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.accessToken}`
        },
        body: JSON.stringify({
          plant_id: plantId,
          month: currentMonth,
          category: newTaskCategory,
          description: newTaskDescription,
        }),
      });
      
      if (response.ok) {
        setNewTaskDescription("");
        setIsAddingTask(null);
        fetchTasks();
        fetchAllYearTasks();
      }
    } catch (error) {
      console.error("Error adding custom task:", error);
    }
  };

  const deleteTask = async (taskId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Weet je zeker dat je deze taak wilt verwijderen?")) return;
    try {
      const response = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.accessToken}` }
      });
      if (response.ok) {
        fetchTasks();
        fetchAllYearTasks();
      }
    } catch (error) {
      console.error("Error deleting task:", error);
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

          <div className="w-full md:w-auto flex items-center gap-2 bg-surface-container-high px-4 py-2 rounded-xl">
            <span className="material-symbols-outlined text-outline">filter_list</span>
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-sm font-bold text-on-surface-variant outline-none pr-8 cursor-pointer w-full"
            >
              <option value="all">Alle Activiteiten</option>
              <option value="Bloei">Alleen Bloei</option>
              <option value="Snoeien">Alleen Snoeien</option>
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
          (() => {
            const filteredGroups = tasks.filter(group => {
              if (selectedCategory === "all") return true;
              return group.tasks.some((t: any) => t.category.includes(selectedCategory));
            });

            return filteredGroups.length === 0 ? (
              <div className="text-center py-20 bg-surface-container-low/50 rounded-3xl border-2 border-dashed border-outline-variant/20">
                <span className="material-symbols-outlined text-outline text-6xl mb-4">sunny</span>
                <p className="text-on-surface-variant font-medium">Geen {selectedCategory !== "all" ? selectedCategory.toLowerCase() : 'taken'} voor {months[currentMonth - 1]}.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredGroups.map((group) => {
                  const plant = group.plant;
                  const groupTasks = group.tasks.filter((t: any) => 
                    selectedCategory === "all" || t.category.includes(selectedCategory)
                  );
                  
                  return (
                    <div 
                      key={group.plant_id} 
                      className="group bg-surface-container-low p-6 rounded-xl border border-outline-variant/5 hover:bg-surface-container-high transition-all flex flex-col md:flex-row items-center gap-6 cursor-pointer" 
                      onClick={() => group.plant_id && fetchPlantDetails(group.plant_id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-lg overflow-hidden bg-surface-container-highest shrink-0 border border-outline-variant/10 relative">
                          {plant?.image_path || plant?.image_url ? (
                            <img 
                              src={plant?.image_path ? `${API_URL}/${plant.image_path}` : plant?.image_url} 
                              alt={plant?.common_name || 'Plant'} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-outline">
                              <span className="material-symbols-outlined text-2xl">image</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex-grow text-center md:text-left">
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-3">
                          <h4 className="font-headline text-xl font-bold text-on-surface group-hover:text-primary transition-colors">{plant?.common_name || 'Onbekende Plant'}</h4>
                          {plant?.garden_name && (
                            <span className="text-[10px] bg-outline/10 text-on-surface-variant px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">{plant.garden_name}</span>
                          )}
                        </div>
                        
                        <div className="space-y-3">
                          {groupTasks.map((task: any) => {
                            const isActionable = task.category !== "Bloei" && task.category !== "Notitie";
                            const isCompleted = task.is_completed;
                            
                            return (
                              <div key={task.id} className="flex items-center gap-3 group/task">
                                {isActionable ? (
                                  <button 
                                    onClick={(e) => toggleTask(task.id, e)}
                                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${isCompleted ? 'bg-primary border-primary text-white' : 'border-outline hover:border-primary text-transparent'}`}
                                  >
                                    <span className="material-symbols-outlined text-[14px]">check</span>
                                  </button>
                                ) : (
                                  <div className="w-6 h-6 flex items-center justify-center text-primary/40 shrink-0">
                                    <span className="material-symbols-outlined text-[18px]">{categoryIcons[task.category] || 'info'}</span>
                                  </div>
                                )}
                                <p className={`text-sm font-medium flex-grow ${isCompleted ? 'line-through text-on-surface-variant opacity-60' : 'text-on-surface'}`}>
                                  <span className="font-bold text-primary/80 mr-2">{task.category}:</span>
                                  {task.description}
                                </p>
                                {task.is_user_override && (
                                  <button 
                                    onClick={(e) => deleteTask(task.id, e)}
                                    className="opacity-0 group-hover/task:opacity-100 p-1 text-outline hover:text-error transition-all"
                                    title="Verwijder taak"
                                  >
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Add Task Input */}
                        <div className="mt-4 pt-4 border-t border-outline-variant/5" onClick={(e) => e.stopPropagation()}>
                          {isAddingTask === group.plant_id ? (
                            <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                              <div className="flex gap-2">
                                <select 
                                  value={newTaskCategory}
                                  onChange={(e) => setNewTaskCategory(e.target.value)}
                                  className="p-2 bg-surface-container-highest rounded-lg text-xs font-bold outline-none border-none focus:ring-1 focus:ring-primary/30"
                                >
                                  <option value="Notitie">Notitie</option>
                                  <option value="Taak">Taak</option>
                                  <option value="Snoeien">Snoeien</option>
                                  <option value="Water">Water</option>
                                  <option value="Voeding">Voeding</option>
                                  <option value="Verpotten">Verpotten</option>
                                </select>
                                <input 
                                  autoFocus
                                  type="text"
                                  placeholder="Wat moet er gebeuren?"
                                  className="flex-1 p-2 bg-surface-container-highest rounded-lg text-sm outline-none border-none focus:ring-1 focus:ring-primary/30 text-on-surface"
                                  value={newTaskDescription}
                                  onChange={(e) => setNewTaskDescription(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTask(group.plant_id)}
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <button 
                                  onClick={() => setIsAddingTask(null)}
                                  className="text-[10px] font-bold uppercase tracking-wider text-outline hover:text-on-surface px-2 py-1"
                                >
                                  Annuleren
                                </button>
                                <button 
                                  onClick={() => handleAddCustomTask(group.plant_id)}
                                  className="text-[10px] font-bold uppercase tracking-wider bg-primary text-white px-3 py-1 rounded-md shadow-sm"
                                >
                                  Toevoegen
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setIsAddingTask(group.plant_id)}
                              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary/60 hover:text-primary transition-colors"
                            >
                              <span className="material-symbols-outlined text-sm">add_circle</span>
                              Taak of Notitie Toevoegen
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-3">
                        {plant?.garden_id && (
                          <Link href={`/gardens/${plant.garden_id}`} onClick={(e) => e.stopPropagation()} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-primary/10 text-primary transition-all">
                            <span className="material-symbols-outlined">open_in_new</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()
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
                  {allYearTasks
                    .filter(item => {
                      if (selectedCategory === "all") return true;
                      return (item.tasks || []).some((t: any) => t.category.includes(selectedCategory));
                    })
                    .map((item: any) => (
                      <tr key={item.plant_id} className="group hover:bg-surface-container-high/50 transition-colors cursor-pointer" onClick={() => fetchPlantDetails(item.plant_id)}>
                        <td className="p-6">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-lg overflow-hidden bg-surface-container-highest shrink-0 border border-outline-variant/10 relative">
                              {item.plant.image_path || item.plant.image_url ? (
                                <img 
                                  src={item.plant.image_path ? `${API_URL}/${item.plant.image_path}` : item.plant.image_url} 
                                  alt={item.plant.common_name} 
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-outline">
                                  <span className="material-symbols-outlined text-2xl">image</span>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-on-surface">{item.plant.common_name}</span>
                              <span className="text-[10px] text-outline italic">{item.plant.scientific_name}</span>
                              <span className="text-[10px] bg-outline/10 text-on-surface-variant px-2 py-0.5 rounded-full font-bold uppercase tracking-widest mt-1 w-fit">
                                {item.plant.garden_name}
                              </span>
                            </div>
                          </div>
                        </td>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
                          const monthTasks = (item.tasks || []).filter((t: any) => {
                            if (t.month !== m) return false;
                            if (selectedCategory !== "all" && !t.category.includes(selectedCategory)) return false;
                            return true;
                          });
                          const hasPruning = monthTasks.some((t: any) => t.category.includes("Snoeien"));
                          const hasBlooming = monthTasks.some((t: any) => t.category.includes("Bloei"));
                          const isAllCompleted = monthTasks.length > 0 && monthTasks.every((t: any) => t.is_completed);
                          return (
                            <td key={m} className={`p-2 text-center ${m === new Date().getMonth() + 1 ? 'bg-primary/5' : ''}`}>
                              <div className={`flex flex-col items-center justify-center gap-1 min-h-[40px] ${isAllCompleted ? 'opacity-30 grayscale' : ''}`}>
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
        showAdminOptions={userSettings?.is_admin}
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
