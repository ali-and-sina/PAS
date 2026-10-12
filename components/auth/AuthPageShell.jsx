import styles from "./AuthPageShell.module.css";

export default function AuthPageShell({ children, variant = "public" }) {
  const isAdmin = variant === "admin";

  return (
    <main
      id="main-content"
      className="relative isolate flex min-h-svh items-center justify-center overflow-hidden bg-background px-4 py-10 sm:px-6 sm:py-14"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className={`${styles.grid} absolute inset-0`} />
        <div className={`${styles.orb} absolute -right-32 -top-36 size-[25rem] rounded-full bg-primary/[0.105] blur-3xl sm:-right-20 sm:-top-40 sm:size-[32rem]`} />
        <div className={`${styles.orb} ${styles.orbSecondary} absolute -bottom-36 -left-28 size-[23rem] rounded-full bg-cyan-300/[0.11] blur-3xl sm:-bottom-44 sm:-left-28 sm:size-[29rem]`} />
        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-background/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background/65 to-transparent" />
      </div>

      <div className={`${styles.content} relative z-10 w-full max-w-md`}>
        {children}
        <p className="mt-5 text-center text-[11px] tracking-wide text-muted-foreground/75">
          {isAdmin ? "دسترسی امن مدیران سامانه" : "سلامت، شفاف‌تر و در دسترس‌تر"}
        </p>
      </div>
    </main>
  );
}
