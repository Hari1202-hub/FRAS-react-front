import { useEffect, useState } from "react";
import axios from "axios";
import { BASEURL, TOKEN } from "../app.js";

// Keyed by token so a different login in the same tab is re-checked.
let cached: { token: string; result: Promise<boolean> } | null = null;

/** True when the logged-in user is the super admin (v2/auth/me → is_admin). */
export function fetchIsSuperAdmin(): Promise<boolean> {
  const token = TOKEN();
  if (cached?.token !== token) {
    const result = axios
      .get(`${BASEURL}v2/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.data?.data?.is_admin === true)
      .catch(() => {
        cached = null;
        return false;
      });
    cached = { token, result };
  }
  return cached.result;
}

/** null while loading. */
export function useIsSuperAdmin(): boolean | null {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    fetchIsSuperAdmin().then((value) => active && setIsAdmin(value));
    return () => { active = false; };
  }, []);
  return isAdmin;
}
