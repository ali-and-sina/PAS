"use client";

import { useState } from "react";
import SessionProvider from "@/components/providers/SessionProvider";
import Header from "./Header";
import Sidebar from "./Sidebar";

/**
 * Shared chrome for every authenticated role area: sidebar (desktop) +
 * drawer (mobile) + header, wrapping `children` in the session context they
 * read from. Role layouts stay tiny — they just read the session on the
 * server and hand the user object here.
 *
 * @param {{ user: object, children: React.ReactNode }} props
 */
export default function AppShell({ user, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <SessionProvider user={user}>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <Header mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />
          <main id="main-content" className="min-w-0 flex-1 px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
            <div className="mx-auto w-full min-w-0 max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
