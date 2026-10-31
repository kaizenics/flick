import Link from "next/link";

const links = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Reposting", href: "/reposting" },
  { label: "Flow", href: "/flow" },
  { label: "Engagement", href: "/engagement" },
  { label: "FAQ", href: "#faq" },
];

export function Footer() {
  return (
    <footer className="bg-card px-5 pt-16 pb-8 md:px-8 md:pt-24">
      <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
        <p data-reveal className="max-w-md text-2xl leading-snug font-medium tracking-tight md:text-3xl">
          Queue it once. Flick posts it on time.
        </p>
        <ul data-reveal className="flex flex-wrap gap-x-6 gap-y-2 text-base">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="text-muted-foreground transition-colors hover:text-white">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <p
        data-reveal
        aria-hidden
        className="mt-16 text-[26vw] leading-[0.78] font-semibold tracking-[-0.06em] select-none md:mt-24"
      >
        Flick
      </p>
      <p className="mt-8 text-sm text-muted-foreground">© {new Date().getFullYear()} Flick</p>
    </footer>
  );
}
