import { redirect } from "next/navigation";
import { requireCenter } from "@/features/centers/queries";
import { centerHome } from "@/lib/centers/config";
export default async function CenterHome({params}){const {type}=await params;const user=await requireCenter(type);redirect(centerHome(user.center_type));}
