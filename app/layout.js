import { Toaster } from "sonner";
import "./globals.css";

export const metadata = {
  title: {
    default: "پزشک‌یار",
    template: "%s | پزشک‌یار",
  },
  description:
    "پلتفرم مدیریت گردش‌کار سلامت برای پزشکان، آزمایشگاه‌ها و بیماران.",
  applicationName: "پزشک‌یار",
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0E7490",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:right-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          پرش به محتوای اصلی
        </a>

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
