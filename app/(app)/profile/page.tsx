import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignOutButton } from "@/components/profile/sign-out-button";

export default async function ProfilePage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session) redirect("/login");

  const accounts = await auth.api.listUserAccounts({ headers: reqHeaders });
  const googleConnected = accounts.some((a) => a.providerId === "google");

  const { user } = session;
  const displayName = user.name?.trim() || user.email.split("@")[0];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Your account details and connected providers.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="flex aspect-square size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-card text-lg font-medium">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={displayName}
                className="size-full object-cover"
              />
            ) : (
              displayName[0]?.toUpperCase()
            )}
          </div>
          <div className="flex min-w-0 flex-col">
            <CardTitle className="truncate">{displayName}</CardTitle>
            <CardDescription className="truncate">{user.email}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Name" value={user.name ?? "—"} />
          <Field label="Email" value={user.email} />
          <Field
            label="Email verified"
            value={user.emailVerified ? "Yes" : "No"}
          />
          <Field
            label="Member since"
            value={new Date(user.createdAt).toLocaleDateString()}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connected accounts</CardTitle>
          <CardDescription>
            Sign-in providers linked to this account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-md border border-border p-4">
            <div className="flex flex-col">
              <span className="text-sm font-medium">Google</span>
              <span className="text-xs text-muted-foreground">
                {googleConnected
                  ? "Linked — you can sign in with Google."
                  : "Not linked."}
              </span>
            </div>
            <span
              className={
                "rounded-full px-2.5 py-1 text-xs font-medium " +
                (googleConnected
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-muted text-muted-foreground")
              }
            >
              {googleConnected ? "Connected" : "Not connected"}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <SignOutButton />
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
