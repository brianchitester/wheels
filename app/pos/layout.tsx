import { UserProfile } from "@/components/auth/user-profile";
import { requireStaffPage } from "@/lib/auth/staff";
import { PosNav } from "@/app/pos/_components/pos-nav";

export default async function PosLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireStaffPage();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <h1 className="text-xl font-semibold">POS</h1>
          <UserProfile />
        </div>
      </header>
      <PosNav />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}

