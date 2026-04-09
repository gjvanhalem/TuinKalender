"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AdminPage() {
  const t = useTranslations('Common');
  const tAdmin = useTranslations('Admin');
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
        headers: { Authorization: `Bearer ${session?.accessToken}` },
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
        headers: { Authorization: `Bearer ${session?.accessToken}` }
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
          Authorization: `Bearer ${session?.accessToken}` 
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
        alert(tAdmin("revokeSelfError"));
        return;
    }
    try {
      const response = await fetch(`${API_URL}/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${session?.accessToken}` 
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
    setMessage(null);

    try {
      const response = await fetch(`${API_URL}/admin/invite`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${session?.accessToken}` 
        },
        body: JSON.stringify({ email: inviteEmail })
      });
      if (response.ok) {
        setMessage({ type: 'success', text: tAdmin("inviteSuccess", { email: inviteEmail }) });
        setInviteEmail("");
        fetchUsers();
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.detail || tAdmin("inviteError") });
      }
    } catch (error) {
      setMessage({ type: 'error', text: t('serverUnreachable') });
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <span className="material-symbols-outlined text-primary text-6xl animate-spin">progress_activity</span>
          <p className="mt-4 text-on-surface font-bold">{tAdmin('verifying')}</p>
        </div>
      </div>
    );
  }

  return (
    <main className="pt-24 pb-32 px-6 max-w-5xl mx-auto">
      <section className="mb-12">
        <span className="font-label text-sm text-primary font-semibold tracking-[0.2em] uppercase mb-2 block">{tAdmin('system')}</span>
        <h2 className="font-headline text-5xl md:text-6xl font-bold tracking-tight text-on-surface">{tAdmin('title')}</h2>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* User Management */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-headline text-2xl font-bold">{tAdmin('users')}</h3>
            <span className="bg-surface-container-lowest border border-outline-variant/15 px-3 py-1 rounded-full text-xs font-medium text-on-surface-variant uppercase tracking-wider">
              {users.length} {t('total')}
            </span>
          </div>

          <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 overflow-hidden editorial-shadow">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-high/50 border-b border-outline-variant/10">
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-outline">{tAdmin('user')}</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-center text-outline">{tAdmin('status')}</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-center text-outline">{tAdmin('admin')}</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-right text-outline">{tAdmin('action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-surface-container-high/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-surface-container-highest overflow-hidden shrink-0 ring-2 ring-primary/5">
                            {user.image ? <img src={user.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-outline"><span className="material-symbols-outlined">person</span></div>}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-on-surface truncate">{user.name || t('unknown')}</div>
                            <div className="text-[10px] text-outline truncate">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <button onClick={() => toggleStatus(user)} className={`p-1.5 rounded-lg transition-all ${user.is_active ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}`} title={user.is_active ? tAdmin("deactivate") : tAdmin("activate")}>
                          <span className="material-symbols-outlined text-[20px]">{user.is_active ? 'check_circle' : 'cancel'}</span>
                        </button>
                      </td>
                      <td className="p-4 text-center">
                        <button onClick={() => toggleAdmin(user)} className={`p-1.5 rounded-lg transition-all ${user.is_admin ? 'bg-secondary/10 text-secondary' : 'bg-outline/10 text-outline'}`} title={user.is_admin ? tAdmin("revokeAdmin") : tAdmin("makeAdmin")}>
                          <span className="material-symbols-outlined text-[20px]">{user.is_admin ? 'shield' : 'person'}</span>
                        </button>
                      </td>
                      <td className="p-4 text-right">
                        <div className="text-[10px] font-bold text-outline">ID #{user.id}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Invite Area */}
        <div className="lg:col-span-4 space-y-6">
          <h3 className="font-headline text-2xl font-bold px-2">{tAdmin('invite')}</h3>
          <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 editorial-shadow">
            <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
              {tAdmin('inviteDescription')}
            </p>
            <form onSubmit={inviteUser} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-outline uppercase tracking-widest px-1">{tAdmin('emailAddress')}</label>
                <input
                  type="email"
                  placeholder="naam@gmail.com"
                  className="w-full p-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-secondary/20 transition-all text-on-surface font-medium"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-secondary text-white p-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-secondary/20 active:scale-95"
              >
                <span className="material-symbols-outlined">person_add</span>
                <span>{tAdmin('invite')}</span>
              </button>
            </form>

            {message && (
              <div className={`mt-4 p-3 rounded-lg text-xs font-bold flex items-center gap-2 ${message.type === 'success' ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}`}>
                <span className="material-symbols-outlined text-sm">{message.type === 'success' ? 'check_circle' : 'error'}</span>
                {message.text}
              </div>
            )}
          </div>

          <div className="bg-primary-container/10 rounded-2xl p-6 relative overflow-hidden">
            <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-primary/10 text-8xl">admin_panel_settings</span>
            <h5 className="font-headline text-lg font-bold text-on-primary-container mb-2">{tAdmin('adminTip')}</h5>
            <p className="text-sm text-on-primary-container/80 leading-relaxed relative z-10">
              {tAdmin('adminTipDescription')}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
