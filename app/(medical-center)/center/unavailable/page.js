import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/server";
import { CENTER_TYPES,centerHome } from "@/lib/centers/config";
import { Button } from "@/components/ui/button";
import AuthPageShell from "@/components/auth/AuthPageShell";
import UnavailableCenter from "@/features/centers/components/UnavailableCenter";
export default async function Unavailable(){const user=await getSessionUser();if(!user)redirect("/login");if(user.center_active&&CENTER_TYPES[user.center_type])redirect(centerHome(user.center_type));return <AuthPageShell><section className="space-y-5"><h1 className="text-2xl font-bold">دسترسی مرکز آماده نیست</h1><p className="text-sm leading-8 text-muted-foreground">نوع مرکز یا مجوز دسترسی این حساب باید توسط مدیر پلتفرم بررسی شود. برای ادامه با مدیر هماهنگ کنید.</p><UnavailableCenter /><Button asChild variant="ghost"><Link href="/">صفحهٔ اصلی</Link></Button></section></AuthPageShell>;}
