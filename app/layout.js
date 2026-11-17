import { headers } from "next/headers";
import { Toaster } from "@/components/ui/sonner";
import { connection } from "next/server";
import localFont from "next/font/local";
import NavigationFeedback from "@/components/providers/NavigationFeedback";
import "./globals.css";

const themeInitScript = `(() => {
  try {
    const saved = window.localStorage.getItem("pas-theme");
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    const useDark = saved === "dark" || (saved !== "light" && prefersDark);
    document.documentElement.classList.toggle("dark", useDark);
    document.documentElement.style.colorScheme = useDark ? "dark" : "light";
  } catch {
    const useDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    document.documentElement.classList.toggle("dark", useDark);
    document.documentElement.style.colorScheme = useDark ? "dark" : "light";
  }
})();`;

const vazirmatn = localFont({
  src: "./fonts/Vazirmatn-Variable.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-vazirmatn",
  fallback: ["Tahoma", "Arial", "sans-serif"],
});

export const metadata = {
  title: {
    default: "پاس",
    template: "%s | پاس",
  },
  description:
    "پلتفرم یکپارچهٔ مراقبت سلامت برای بیماران، پزشکان و مراکز درمانی.",
  applicationName: "پاس",
  openGraph: {
    type: "website",
    locale: "fa_IR",
    siteName: "پاس",
    title: "پاس",
    description: "پلتفرم ارزیابی سلامت؛ همراه مسیر مراقبت شما.",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0f766e",
};

export default async function RootLayout({ children }) {
  // Framework scripts must receive the fresh nonce from the incoming request.
  await connection();
  const requestHeaders = await headers();
  const nonce = requestHeaders.get("x-nonce") || undefined;
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${vazirmatn.variable} min-h-dvh bg-background font-sans text-foreground antialiased`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:right-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          پرش به محتوای اصلی
        </a>

        <NavigationFeedback />
        {children}

        <Toaster
          position="bottom-left"
          dir="rtl"
          richColors={false}
          closeButton
          toastOptions={{
            className: "font-sans",
          }}
        />
      </body>
    </html>
  );
}
