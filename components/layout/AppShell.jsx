"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import SessionProvider from "@/components/providers/SessionProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import Header from "./Header";
import Sidebar from "./Sidebar";
import MobileBottomNav from "./MobileBottomNav";
import OfflineStatus from "./OfflineStatus";

const CommandPalette = dynamic(() => import("./CommandPalette"), {
  ssr: false,
  loading: () => null,
});
const KeyboardShortcutsDialog = dynamic(() => import("./KeyboardShortcutsDialog"), {
  ssr: false,
  loading: () => null,
});

function isTextEntryTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("input, textarea, select, [role='textbox'], [contenteditable='true']"));
}

/**
 * Shared chrome for authenticated workspaces.
 * Authorization remains entirely server-side; this component only renders
 * navigation for the already verified user supplied by the server layout.
 */
export default function AppShell({ user, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((value) => !value);
  }, []);
  const openCommandPalette = useCallback(() => setCommandOpen(true), []);
  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);

  useEffect(() => {
    function handleGlobalShortcuts(event) {
      if (event.defaultPrevented || event.isComposing) return;

      // The command-palette shortcut remains available even when an input has focus.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setShortcutsOpen(false);
        setCommandOpen(true);
        return;
      }

      if (isTextEntryTarget(event.target)) return;

      if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key === "?") {
        event.preventDefault();
        setCommandOpen(false);
        setShortcutsOpen(true);
      }
    }

    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => window.removeEventListener("keydown", handleGlobalShortcuts);
  }, []);

  return (
    <SessionProvider user={user}>
      <TooltipProvider delayDuration={300} skipDelayDuration={100}>
        <div className="flex min-h-dvh min-w-0 overflow-x-clip">
          <Sidebar collapsed={sidebarCollapsed} />
          <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
            <Header
              mobileOpen={mobileOpen}
              onMobileOpenChange={setMobileOpen}
              sidebarCollapsed={sidebarCollapsed}
              onToggleSidebar={toggleSidebar}
              onOpenCommandPalette={openCommandPalette}
              onOpenShortcuts={openShortcuts}
            />
            <OfflineStatus />
            <main
              id="main-content"
              tabIndex={-1}
              className="pas-workspace min-w-0 flex-1 px-3 pt-5 sm:px-5 sm:pt-7 lg:px-7 lg:pb-10 xl:px-8"
            >
              <div className="mx-auto w-full min-w-0 max-w-7xl">{children}</div>
            </main>
            <MobileBottomNav
              onOpenMenu={() => setMobileOpen(true)}
              menuOpen={mobileOpen}
            />
          </div>
        </div>
        {commandOpen ? (
          <CommandPalette
            open
            onOpenChange={setCommandOpen}
            onOpenShortcuts={openShortcuts}
          />
        ) : null}
        {shortcutsOpen ? (
          <KeyboardShortcutsDialog open onOpenChange={setShortcutsOpen} />
        ) : null}
      </TooltipProvider>
    </SessionProvider>
  );
}
