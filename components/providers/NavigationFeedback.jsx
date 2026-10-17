"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function NavigationFeedbackContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locationKey = `${pathname || ""}?${searchParams.toString()}`;
  const [isNavigating, setIsNavigating] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const showTimerRef = useRef(null);
  const fallbackTimerRef = useRef(null);

  useEffect(() => {
    const clearTimers = () => {
      if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
      if (fallbackTimerRef.current) window.clearTimeout(fallbackTimerRef.current);
      showTimerRef.current = null;
      fallbackTimerRef.current = null;
    };

    const stopNavigation = () => {
      clearTimers();
      setIsNavigating(false);
      setIsVisible(false);
    };

    stopNavigation();
    return clearTimers;
  }, [locationKey]);

  useEffect(() => {
    function startNavigationFeedback() {
      setIsNavigating(true);
      setIsVisible(false);

      if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
      if (fallbackTimerRef.current) window.clearTimeout(fallbackTimerRef.current);

      // Avoid flashing the indicator on very fast, cached navigations.
      showTimerRef.current = window.setTimeout(() => setIsVisible(true), 120);
      // Guard against a route whose transition never commits (for example, a failed navigation).
      fallbackTimerRef.current = window.setTimeout(() => {
        setIsNavigating(false);
        setIsVisible(false);
      }, 15000);
    }

    function handleDocumentClick(event) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      const anchor = target instanceof Element ? target.closest("a[href]") : null;
      if (!anchor || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.getAttribute("aria-disabled") === "true") return;
      if (anchor.dataset.noNavigationFeedback === "true") return;
      if (anchor.getAttribute("rel")?.split(/\s+/).includes("external")) return;

      let nextUrl;
      try {
        nextUrl = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (nextUrl.origin !== window.location.origin) return;

      const currentUrl = new URL(window.location.href);
      const samePage =
        nextUrl.pathname === currentUrl.pathname &&
        nextUrl.search === currentUrl.search;

      // In-page jumps and links to the exact current URL are not route changes.
      if (samePage && (nextUrl.hash || nextUrl.href === currentUrl.href)) return;

      startNavigationFeedback();
    }

    function handleDocumentSubmit(event) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.dataset.navigationFeedback !== "true") return;
      if (form.method.toLowerCase() !== "get") return;
      if (form.target && form.target !== "_self") return;

      let actionUrl;
      try {
        actionUrl = new URL(form.action || window.location.href, window.location.href);
      } catch {
        return;
      }
      if (actionUrl.origin !== window.location.origin) return;

      startNavigationFeedback();
    }

    document.addEventListener("click", handleDocumentClick, true);
    document.addEventListener("submit", handleDocumentSubmit, true);
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
      document.removeEventListener("submit", handleDocumentSubmit, true);
    };
  }, []);

  if (!isNavigating || !isVisible) return null;

  return (
    <div className="pas-navigation-feedback" role="status" aria-live="polite" aria-atomic="true">
      <span className="pas-navigation-feedback__bar" aria-hidden="true" />
      <span className="pas-navigation-feedback__label">
        <span className="pas-navigation-feedback__spinner" aria-hidden="true" />
        در حال باز کردن صفحه…
      </span>
    </div>
  );
}

export default function NavigationFeedback() {
  return (
    <Suspense fallback={null}>
      <NavigationFeedbackContent />
    </Suspense>
  );
}
