import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { UserProfile } from "@/components/auth/user-profile";

export default async function DashboardPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/auth?message=Please sign in to view your dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">Dashboard</h1>
            </div>
            <div className="flex items-center">
              <UserProfile />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Welcome to your Dashboard!
              </h2>
              <p className="text-gray-600">
                You are successfully authenticated with Supabase.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                User ID: {session.user.id}
              </p>
              <p className="text-sm text-gray-500">
                Email: {session.user.email}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
