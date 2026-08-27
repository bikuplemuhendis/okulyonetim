import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth";
import { homePath } from "@/lib/rbac";

export default async function Home() {
  const actor = await getActor();
  redirect(actor ? homePath(actor.role) : "/login");
}
