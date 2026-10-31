import AppShell from "@/components/layout/AppShell";
import { requireCenter } from "@/features/centers/queries";
import { redirect } from "next/navigation";
export default async function CenterLayout({children,params}){const {type}=await params;const user=await requireCenter(type);if(type==="laboratory")redirect("/lab/dashboard");return <AppShell user={user}>{children}</AppShell>;}
