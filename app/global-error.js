"use client";

import { useEffect } from "react";

export default function GlobalError({ error, unstable_retry, reset }) {
  const retryAction = unstable_retry || reset;

  useEffect(() => {
    console.error("[PAS Global Error]", error);
  }, [error]);

  return (
    <html lang="fa" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0f766e" />
        <title>خطای سامانه | پاس</title>
      </head>
      <body style={{ margin: 0, minHeight: "100vh", background: "#f3f6f8", color: "#1f2937", fontFamily: "Tahoma, Arial, sans-serif" }}>
        <main style={{ boxSizing: "border-box", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
          <section style={{ boxSizing: "border-box", width: "100%", maxWidth: "30rem", border: "0.0625rem solid #dbe3e8", borderRadius: "1.25rem", background: "#ffffff", padding: "2.25rem 1.75rem", textAlign: "center", boxShadow: "0 0.75rem 2.5rem rgba(15, 23, 42, .06)" }}>
            <p dir="ltr" style={{ margin: "0 0 0.875rem", color: "#64748b", fontSize: "0.75rem", letterSpacing: ".18em" }}>500 · PAS</p>
            <h1 style={{ margin: 0, fontSize: "1.375rem", lineHeight: 1.7 }}>مشکلی در اجرای سامانه پیش آمد</h1>
            <p style={{ margin: "0.75rem 0 1.5rem", color: "#64748b", fontSize: "0.875rem", lineHeight: 2 }}>صفحه نتوانست به‌درستی بارگذاری شود. دوباره تلاش کنید یا بعداً به سامانه برگردید.</p>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.625rem" }}>
              <button type="button" onClick={() => retryAction?.()} style={{ minHeight: "2.75rem", border: 0, borderRadius: "0.625rem", background: "#0f766e", color: "#ffffff", padding: "0 1.25rem", font: "inherit", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}>تلاش دوباره</button>
              <a href="/" style={{ display: "inline-flex", minHeight: "2.75rem", alignItems: "center", border: "0.0625rem solid #cbd5e1", borderRadius: "0.625rem", color: "#334155", padding: "0 1.25rem", fontSize: "0.875rem", textDecoration: "none" }}>صفحه اصلی</a>
            </div>
            {error?.digest ? <p dir="ltr" style={{ margin: "1.375rem 0 0", color: "#94a3b8", fontFamily: "monospace", fontSize: "0.6875rem" }}>Reference: {error.digest}</p> : null}
          </section>
        </main>
      </body>
    </html>
  );
}
