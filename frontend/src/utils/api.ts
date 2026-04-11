import { signOut } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function apiFetch(path: string, options: RequestInit = {}, session?: any) {
  const url = path.startsWith('http') ? path : `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  
  const headers = new Headers(options.headers);
  if (session?.accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${session.accessToken}`);
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401 || response.status === 403) {
      // Session might be expired or user revoked
      console.warn(`API returned ${response.status}, signing out...`);
      signOut({ callbackUrl: "/?error=session_expired" });
      return response;
    }

    return response;
  } catch (error) {
    console.error("API Fetch error:", error);
    throw error;
  }
}
