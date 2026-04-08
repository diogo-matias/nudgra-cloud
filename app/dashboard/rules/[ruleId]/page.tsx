import { redirect } from "next/navigation";

export default async function OldRuleDetailPage({
  params,
}: {
  params: Promise<{ ruleId: string }>;
}) {
  const { ruleId } = await params;
  redirect(`/dashboard/automations/rules/${ruleId}`);
}
