import PhysicianDashboard from "@/features/physician-care/components/PhysicianDashboard";
import { getPhysicianDashboard } from "@/features/physician-care/queries";

export const metadata = { title: "داشبورد پزشک" };
export const dynamic = "force-dynamic";

export default async function DoctorDashboardPage() {
  const data = await getPhysicianDashboard();
  return <PhysicianDashboard data={data} />;
}
