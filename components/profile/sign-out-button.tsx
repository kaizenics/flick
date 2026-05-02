"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    await signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button variant="destructive" onClick={onClick} disabled={loading}>
      {loading ? "Signing out…" : "Sign out"}
    </Button>
  );
}
