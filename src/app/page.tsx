import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth/require-member";

export default async function HomePage() {
  await requireMember();
  redirect("/dashboard");
}
