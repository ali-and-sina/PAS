import AppShell from "@/components/layout/AppShell";
import { requireCenter } from "@/features/centers/queries";
import { redirect } from "next/navigation";
import { getProviderWorkspaceNavigationUser } from "@/features/insurance-prescriptions/queries";
export default async function CenterLayout({children,params}){const {type}=await params;const user=await requireCenter(type);if(type==="laboratory")redirect("/lab/dashboard");const workspaceUser=await getProviderWorkspaceNavigationUser(user);return <AppShell user={workspaceUser}>{children}</AppShell>;}
