import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getSupabaseServer } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await getSupabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let role: "admin" | "staff" | null = null;
  if (session) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();
    role = profile?.role === "admin" || profile?.role === "staff" ? profile.role : null;
  }
  const canAccessPos = role === "admin" || role === "staff";
  const isAdmin = role === "admin";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted dark:from-background dark:to-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-foreground sm:text-5xl md:text-6xl">
              Welcome to <span className="text-indigo-600">Wheels</span>
            </h1>
            <p className="mt-3 max-w-md mx-auto text-base text-muted-foreground sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
              A modern web application built with Next.js and Supabase.
            </p>
            <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
              <div className="rounded-md shadow">
                <Link href="/reserve">
                  <Button className="w-full">Reserve Now</Button>
                </Link>
              </div>
              {canAccessPos && (
                <div className="mt-3 rounded-md shadow sm:mt-0 sm:ml-3">
                  <Link href="/pos">
                    <Button variant="outline" className="w-full">
                      POS
                    </Button>
                  </Link>
                </div>
              )}
              <div className="mt-3 rounded-md shadow sm:mt-0 sm:ml-3">
                <Link href={isAdmin ? "/admin" : "/auth"}>
                  <Button variant="outline" className="w-full">
                    {isAdmin ? "Admin" : "Sign In"}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

