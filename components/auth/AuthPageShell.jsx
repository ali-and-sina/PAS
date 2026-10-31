import { ClipboardList, FileCheck2, HeartHandshake, ShieldCheck, Stethoscope, Users } from "lucide-react";
import Brand from "@/components/brand/Brand";
import styles from "./AuthPageShell.module.css";

const careSteps = [
  { icon: ClipboardList, title: "درخواست آزمایش", description: "ثبت درخواست پزشک و انتخاب آزمایشگاه" },
  { icon: FileCheck2, title: "نتایج در دسترس", description: "مشاهده نتیجه و توضیحات تأییدشده پزشک" },
  { icon: HeartHandshake, title: "ادامه مسیر مراقبت", description: "نسخه‌ها، پرونده و پیگیری‌های سلامت" },
];
const adminSteps = [
  { icon: Users, title: "مدیریت کاربران", description: "جستجو و بررسی حساب‌های سامانه" },
  { icon: Stethoscope, title: "تأیید پزشکان", description: "بررسی مشخصات و وضعیت حساب پزشک" },
  { icon: ShieldCheck, title: "مدیریت مراکز درمانی", description: "تعیین نوع مرکز و پنل اختصاصی هر حساب" },
];

export default function AuthPageShell({ children, variant = "public" }) {
  const isAdmin = variant === "admin";
  const steps = isAdmin ? adminSteps : careSteps;
  return <main id="main-content" className="flex min-h-svh items-center justify-center bg-background px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
    <div className="grid w-full max-w-md overflow-hidden rounded-3xl border bg-card shadow-[0_24px_80px_-48px_hsl(var(--foreground)/0.3)] lg:min-h-[740px] lg:max-w-6xl lg:grid-cols-[1.05fr_1fr]">
      <aside aria-label={isAdmin ? "فضای مدیریت پاس" : "درباره پاس"} className={`${styles.panel} relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex xl:p-12`}>
        <div aria-hidden="true" className={styles.rings} />
        <div className="relative"><Brand inverse /><p className="mt-14 text-sm font-medium text-white">{isAdmin ? "مدیریت هماهنگ سامانه" : "همراه مسیر سلامت"}</p><p className="mt-4 max-w-md text-4xl font-extrabold leading-[1.65] xl:text-[2.75rem]">{isAdmin ? <>یک نمای روشن<br />از تمام سامانه.</> : <>مراقبت بهتر،<br />با ارتباط روشن‌تر.</>}</p><p className="mt-5 max-w-sm text-sm leading-8 text-white">{isAdmin ? "کاربران، پزشکان و مراکز درمانی را از یک فضای کاری یکپارچه مدیریت کنید." : "از ویزیت و درخواست خدمات درمانی تا دریافت گزارش، نسخه و پیگیری؛ بیمار، پزشک و مراکز درمانی در یک مسیر هماهنگ."}</p></div>
        <ol className="relative mt-10 space-y-4 rounded-2xl border border-white/20 bg-white/[0.08] p-5">
          {steps.map(({ icon: Icon, title, description }) => <li key={title} className="flex items-center gap-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/15"><Icon className="size-5" strokeWidth={1.6} aria-hidden="true" /></span><span><span className="block text-sm font-semibold">{title}</span><span className="mt-0.5 block text-xs leading-6 text-white">{description}</span></span></li>)}
        </ol>
      </aside>
      <div className="flex min-w-0 flex-col justify-center px-6 py-8 sm:px-9 sm:py-10 lg:px-10 xl:px-14">
        {children}
        <p className="mt-8 border-t pt-5 text-center text-xs leading-6 text-muted-foreground">{isAdmin ? "ورود ویژه مدیران سامانه" : "پاس · پلتفرم ارزیابی سلامت"}</p>
      </div>
    </div>
  </main>;
}
