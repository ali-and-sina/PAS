import { redirect } from "next/navigation";
import { requireCenter } from "@/features/centers/queries";
import { centerHome } from "@/lib/centers/config";
export default async function CenterEntry(){const user=await requireCenter();redirect(centerHome(user.center_type));}
