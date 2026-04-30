import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className="flex w-full max-w-5xl items-center justify-between rounded-full border border-border bg-background/70 px-4 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-background/50">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden
            >
              <path d="M5 19V5" />
              <path d="M5 5h9a4 4 0 0 1 0 8H5" />
              <path d="M14 13l5 6" />
            </svg>
          </span>
          <span className="text-sm font-semibold tracking-tight">Lifty</span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          <Link
            href="#about"
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            About
          </Link>
          <Link
            href="#faq"
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            FAQ
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Dashboard
          </Link>
        </nav>

        <Link
          href="/dashboard"
          className={buttonVariants({ size: "sm" }) + " cursor-pointer"}
        >
          Launch app
        </Link>
      </div>
    </header>
  );
}
