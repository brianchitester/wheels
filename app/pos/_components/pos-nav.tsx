import Link from "next/link";

const links = [
  { href: "/pos", label: "Today" },
  { href: "/pos/new", label: "New Walk-In" },
];

export function PosNav() {
  return (
    <nav className="border-b bg-card">
      <div className="mx-auto flex max-w-7xl gap-3 px-4 py-3 text-sm sm:px-6 lg:px-8">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}


