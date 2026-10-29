"use client";

import { useEffect, useState } from "react";
import AccountPanel, { type Account } from "./AccountPanel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AppTopbar } from "@/components/dashboard/app-topbar";
import { Heart, Plus } from "lucide-react";

export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    const r = await fetch("/api/accounts", { cache: "no-store" });
    setAccounts(await r.json());
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const submitAdd = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setSubmitting(true);
    try {
      await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setNewName("");
      setAddOpen(false);
      await refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const renameAccount = async (id: string, name: string) => {
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, name } : a)));
    await fetch("/api/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name }),
    });
  };

  const deleteAccount = async (id: string) => {
    await fetch(`/api/accounts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    refresh();
  };

  return (
    <>
      <AppTopbar title="Page Engagement" icon={Heart}>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger render={<Button variant="ghost" className="text-white" />}>
            <Plus data-icon="inline-start" /> Add account
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={submitAdd}>
              <DialogHeader>
                <DialogTitle>New account slot</DialogTitle>
                <DialogDescription>
                  Give this slot a label so you can tell your sessions apart later
                  (e.g. &quot;Work FB&quot;, &quot;Side project&quot;).
                </DialogDescription>
              </DialogHeader>
              <div className="my-4 grid gap-2">
                <Label htmlFor="account-name">Account name</Label>
                <Input
                  id="account-name"
                  autoFocus
                  placeholder="My second FB account"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || !newName.trim()}>
                  {submitting ? "Creating…" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </AppTopbar>

      <div className="flex flex-1 flex-col gap-6 px-4 pt-7 pb-16 md:px-7">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-xl font-semibold">Page engagement</h1>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading accounts…"
              : `${accounts.length} Facebook ${accounts.length === 1 ? "account" : "accounts"}. Each one follows and reacts to its target Pages from its own Pages.`}
          </p>
        </div>

        <div className="grid items-start gap-3.5 2xl:grid-cols-2">
          {accounts.map((acc) => (
            <AccountPanel
              key={acc.id}
              account={acc}
              onRename={renameAccount}
              onDelete={acc.id === "default" ? undefined : deleteAccount}
            />
          ))}
        </div>
      </div>
    </>
  );
}

// Live run state for one engagement account; used by the Overview server page.
export function EngagementRunState({ accountId }: { accountId: string }) {
  const [running, setRunning] = useState<boolean | null>(null);
  useEffect(() => {
    fetch(`/api/automation/status?account=${encodeURIComponent(accountId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((s: { running: boolean }) => setRunning(s.running))
      .catch(() => setRunning(null));
  }, [accountId]);
  if (running === null) return <Badge variant="neutral">Session saved</Badge>;
  return running ? <Badge variant="positive">Running</Badge> : <Badge variant="neutral">Idle</Badge>;
}
