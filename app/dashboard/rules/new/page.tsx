import { redirect } from "next/navigation";

export default function OldNewRulePage() {
  redirect("/dashboard/automations/rules/new");
}
