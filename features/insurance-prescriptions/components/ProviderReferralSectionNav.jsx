import Link from "next/link";

export default function ProviderReferralSectionNav({ type = "medical-center", active }) {
  const isLaboratory = type === "laboratory";
  const links = isLaboratory
    ? [
        { href: "/lab/dispatches", label: "درخواست‌های بیماران", key: "direct" },
        { href: "/lab/referrals", label: "ارجاع‌های بیمه‌ای", key: "insurance" },
      ]
    : [
        { href: `/center/${type}/requests`, label: "درخواست‌های مستقیم", key: "direct" },
        { href: `/center/${type}/referrals`, label: "ارجاع‌های بیمه‌ای", key: "insurance" },
      ];

  return (
    <nav aria-label="نوع درخواست‌های مرکز" className="flex flex-wrap gap-2 rounded-xl border bg-muted/20 p-1.5">
      {links.map((link) => {
        const isActive = active === link.key;
        return (
          <Link
            key={link.key}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex min-h-10 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isActive ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/70 hover:text-foreground"}`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
