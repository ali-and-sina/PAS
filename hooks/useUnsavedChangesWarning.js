"use client";

import * as React from "react";

/**
 * Warns before a browser refresh/tab close while a form is dirty.
 * App Router in-app navigation still needs an explicit ConfirmDialog at the
 * navigation point; this hook intentionally does not monkey-patch routing.
 */
export default function useUnsavedChangesWarning(
  isDirty,
  message = "تغییرات ذخیره‌نشده دارید. آیا می‌خواهید از صفحه خارج شوید؟",
) {
  const messageRef = React.useRef(message);

  React.useEffect(() => {
    messageRef.current = message;
  }, [message]);

  React.useEffect(() => {
    if (!isDirty || typeof window === "undefined") return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = messageRef.current;
      return messageRef.current;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);
}
