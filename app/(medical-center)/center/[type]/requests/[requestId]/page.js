import { notFound } from "next/navigation";
import PageHeader from "@/components/shared/PageHeader";
import CenterWorkspace from "@/features/centers/components/CenterWorkspace";
import { getCenterWorklist } from "@/features/centers/queries";
import { tehranDayKey } from "@/lib/care/dates";
export const dynamic="force-dynamic";
export const metadata={title:"پروندهٔ پذیرش مرکز"};
export default async function RequestDetail({params}){const {type,requestId}=await params;if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(requestId))notFound();const data=await getCenterWorklist(type,requestId);if(!data.requests.length)notFound();return <div className="space-y-6"><PageHeader title={data.config.report} description={data.user.center_name} /><CenterWorkspace data={data} view="detail" today={tehranDayKey()} /></div>;}
