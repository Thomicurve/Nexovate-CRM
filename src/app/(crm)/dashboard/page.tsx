import { requireMember } from "@/lib/auth/require-member";

export default async function DashboardPage() {
  await requireMember();
  return <h1>Dashboard</h1>;
}
