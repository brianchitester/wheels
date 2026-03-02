import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";

function isStaffRole(role: string | null | undefined) {
  return role === "staff" || role === "admin";
}

export async function requireStaffPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/auth?message=Please sign in to view POS pages");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (!profile || !isStaffRole(profile.role)) {
    redirect("/dashboard?message=Staff or admin access required");
  }

  return { supabase, session, profile };
}

export async function requireStaffAction() {
  const supabase = await getSupabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Authentication required");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (!profile || !isStaffRole(profile.role)) {
    throw new Error("Staff or admin access required");
  }

  return { supabase, session, profile };
}

