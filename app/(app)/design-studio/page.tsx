"use client";

import dynamic from "next/dynamic";

// Fabric needs the DOM, so the editor never renders on the server.
const DesignStudioPanel = dynamic(
  () => import("@/components/dashboard/DesignStudioPanel").then((m) => m.DesignStudioPanel),
  { ssr: false },
);

export default function DesignStudioPage() {
  return <DesignStudioPanel />;
}
