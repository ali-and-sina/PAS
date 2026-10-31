import PageHeader from "@/components/shared/PageHeader";
import CenterWorkspace from "@/features/centers/components/CenterWorkspace";
import { getCenterWorklist } from "@/features/centers/queries";
import { tehranDayKey } from "@/lib/care/dates";
export const dynamic="force-dynamic";
export default async function WorkspacePage({params,searchParams}){const {type}=await params;const filters=await searchParams;const data=await getCenterWorklist(type,null,{...filters,});return <div className="space-y-6"><PageHeader title={"خانهٔ "+data.config.label} description={data.user.center_name+" · "+data.config.description} /><CenterWorkspace data={data} view="dashboard" today={tehranDayKey()} /></div>;}
