import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ReactionsPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        FB Reactions Automation
      </h1>
      <p className="text-sm text-muted-foreground">Coming soon.</p>
      <Button variant="outline" render={<Link href="/" />}>
        ← Back
      </Button>
    </div>
  );
}
