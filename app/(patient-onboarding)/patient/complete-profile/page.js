import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/server";
import { LOGIN_PATH, ROLES, getRoleHome } from "@/lib/auth";
import ProfileCompletionForm from "@/features/profile/components/ProfileCompletionForm";

export const metadata = {
  title: "تکمیل مشخصات",
};

export default async function CompleteProfilePage() {
  const user = await getSessionUser();

  if (!user) redirect(LOGIN_PATH);
  if (user.role !== ROLES.PATIENT) redirect(getRoleHome(user.role));

  const home = getRoleHome(ROLES.PATIENT);
  if (user.full_name?.trim()) redirect(home);

  return (
    <main
      id="main-content"
      className="flex min-h-screen items-center justify-center px-4 py-12"
    >
      <ProfileCompletionForm redirectTo={home} />
    </main>
  );
}
