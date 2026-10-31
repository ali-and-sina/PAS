import PageHeader from "@/components/shared/PageHeader";
import IdentityQueue from "@/features/care/components/IdentityQueue";
import {getIdentityQueue} from "@/features/care/queries";
export const dynamic="force-dynamic";
export const metadata={title:"اصلاح اطلاعات حساب"};
export default async function IdentityRequestsPage(){const requests=await getIdentityQueue();return <div className="space-y-6"><PageHeader title="اصلاح اطلاعات حساب" description="بررسی مالکیت شماره و هویت پیش از همگام‌سازی اطلاعات ورود و پرونده."/><IdentityQueue requests={requests}/></div>}
