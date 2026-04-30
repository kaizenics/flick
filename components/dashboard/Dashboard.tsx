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
    <div className="min-h-screen p-6 font-sans">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Page Engagement Automation</h1>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger render={<Button />}>+ Add account</DialogTrigger>
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
        </header>

        {loading && <p className="text-sm text-muted-foreground">Loading accounts…</p>}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
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
    </div>
  );
}
