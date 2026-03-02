import { UserProfile } from "@/components/auth/user-profile";
import { AdminNav } from "@/app/admin/_components/admin-nav";
import { requireAdminPage } from "@/lib/auth/admin";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireAdminPage();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <h1 className="text-xl font-semibold">Admin</h1>
          <UserProfile />
        </div>
      </header>
      <AdminNav />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}

