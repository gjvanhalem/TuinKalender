"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Users, UserPlus, Shield, Power, Mail, Garden, Leaf, LayoutGrid, CheckCircle2, XCircle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (session) {
      checkAdminStatus();
    }
  }, [session, status]);

  const checkAdminStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${session?.accessToken || session?.user?.email}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.is_admin) {
          setIsAdmin(true);
          fetchUsers();
        } else {
          router.push("/gardens");
        }
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${session?.accessToken || session?.user?.email}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching users:", error);
      setIsLoading(false);
    }
  };

  const toggleStatus = async (user: any) => {
    try {
      const response = await fetch(`${API_URL}/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${session?.accessToken || session?.user?.email}` 
        },
        body: JSON.stringify({ is_active: !user.is_active })
      });
      if (response.ok) fetchUsers();
    } catch (error) {
      console.error("Error toggling user status:", error);
    }
  };

  const toggleAdmin = async (user: any) => {
    if (user.email === session?.user?.email) {
        alert("U kunt uw eigen admin rechten niet intrekken.");
        return;
    }
    try {
      const response = await fetch(`${API_URL}/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${session?.accessToken || session?.user?.email}` 
        },
        body: JSON.stringify({ is_admin: !user.is_admin })
      });
      if (response.ok) fetchUsers();
    } catch (error) {
      console.error("Error toggling admin role:", error);
    }
  };

  const inviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    try {
      const response = await fetch(`${API_URL}/admin/users/invite`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${session?.accessToken || session?.user?.email}` 
        },
        body: JSON.stringify({ email: inviteEmail })
      });
      
      if (response.ok) {
        setMessage({ type: 'success', text: `Gebruiker ${inviteEmail} toegevoegd!` });
        setInviteEmail("");
        fetchUsers();
      } else {
        setMessage({ type: 'error', text: "Kon gebruiker niet toevoegen." });
      }
    } catch (error) {
      setMessage({ type: 'error', text: "Fout bij verbinding met server." });
    }
    
    setTimeout(() => setMessage(null), 3000);
  };

  if (!isAdmin || isLoading) {
    return <div className="p-12 text-center text-garden-green-700 font-bold">Laden en controleren van rechten...</div>;
  }

  return (
    <div className="container mx-auto p-6 md:p-12 max-w-6xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 mb-2 flex items-center gap-3">
            <div className="bg-garden-green-100 p-2 rounded-2xl">
              <Users className="w-8 h-8 text-garden-green-600" />
            </div>
            Gebruikersbeheer
          </h1>
          <p className="text-slate-500 font-medium">Beheer wie toegang heeft tot de TuinKalender.</p>
        </div>
      </div>

      {message && (
        <div className={`mb-8 p-4 rounded-2xl flex items-center gap-3 font-bold animate-in fade-in slide-in-from-top-4 ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Invite Section */}
      <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 mb-12">
        <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-garden-green-600" />
          Gebruiker Toevoegen
        </h2>
        <form onSubmit={inviteUser} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Google e-mailadres (bijv. naam@gmail.com)"
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-garden-green-500 transition-all font-medium"
              required
            />
          </div>
          <button
            type="submit"
            className="bg-garden-green-600 hover:bg-garden-green-700 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-garden-green-600/20 whitespace-nowrap"
          >
            Toevoegen aan lijst
          </button>
        </form>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">Gebruiker</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Tuinen</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Planten</th>
                <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Acties</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="p-6">
                    <div className="font-bold text-slate-900">{u.email}</div>
                    <div className="text-xs text-slate-400 font-medium">ID: {u.google_id || "Wacht op eerste login"}</div>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                            {u.is_active ? 'Actief' : 'Gedeactiveerd'}
                        </span>
                        {u.is_admin && (
                            <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                <Shield className="w-3 h-3" /> Admin
                            </span>
                        )}
                    </div>
                  </td>
                  <td className="p-6 text-center">
                    <div className="flex items-center justify-center gap-1 text-slate-600 font-bold">
                        <LayoutGrid className="w-4 h-4 text-slate-300" />
                        {u.garden_count}
                    </div>
                  </td>
                  <td className="p-6 text-center">
                    <div className="flex items-center justify-center gap-1 text-slate-600 font-bold">
                        <Leaf className="w-4 h-4 text-slate-300" />
                        {u.plant_count}
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => toggleStatus(u)}
                        title={u.is_active ? "Deactiveren" : "Activeren"}
                        className={`p-3 rounded-xl transition-all ${
                          u.is_active 
                            ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                            : 'bg-green-50 text-green-600 hover:bg-green-100'
                        }`}
                      >
                        <Power className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => toggleAdmin(u)}
                        title={u.is_admin ? "Admin rechten intrekken" : "Admin maken"}
                        className={`p-3 rounded-xl transition-all ${
                          u.is_admin 
                            ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                            : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                        }`}
                      >
                        <Shield className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
