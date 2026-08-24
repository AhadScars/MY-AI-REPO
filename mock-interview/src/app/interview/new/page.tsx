import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { SetupWizard } from "./wizard";

export const metadata = { title: "Start interview" };

export default async function NewInterviewPage() {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }
  return (
    <AppShell user={user}>
      <SetupWizard />
    </AppShell>
  );
}
