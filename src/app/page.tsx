import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

/**
 * The root is a router, not a landing page — this is an internal tool, so
 * signed-in users go straight to their dashboard and everyone else to login.
 */
export default async function RootPage() {
  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
