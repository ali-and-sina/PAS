"use client";

import { createContext, useContext, useMemo } from "react";

const SessionContext = createContext(null);

/**
 * Makes the server-verified session user available to Client Components
 * for DISPLAY ONLY (name, avatar, nav highlighting). It carries no
 * authorization weight — every route and mutation is still enforced by
 * proxy.js and RLS on the server, never by what this context contains.
 *
 * @param {{ user: object, children: React.ReactNode }} props
 */
export default function SessionProvider({ user, children }) {
  const value = useMemo(() => ({ user }), [user]);
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSessionUser() {
  const ctx = useContext(SessionContext);
  if (ctx === null) {
    throw new Error("useSessionUser must be used within <SessionProvider>");
  }
  return ctx.user;
}
