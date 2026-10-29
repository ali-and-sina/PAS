"use client";

import { useState } from "react";
import SessionProvider from "@/components/providers/SessionProvider";
import Header from "./Header";
import Sidebar from "./Sidebar";
import MobileBottomNav from "./MobileBottomNav";

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
          <main id="main-content" tabIndex={-1} className="pas-workspace min-w-0 flex-1 px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-10">
            <div className="mx-auto w-full min-w-0 max-w-7xl">{children}</div>
          </main>
          <MobileBottomNav onOpenMenu={() => setMobileOpen(true)} menuOpen={mobileOpen} />
        </div>
      </div>
    </SessionProvider>
  );
}
