import Link from "next/link";

const links = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/vehicles", label: "Vehicles" },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/reservations", label: "Reservations" },
];

export function AdminNav() {
  return (
    <nav className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl gap-4 px-4 py-3 text-sm sm:px-6 lg:px-8">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-md px-3 py-1.5 text-gray-700 hover:bg-gray-100"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

