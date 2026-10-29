import AutomationFlow from "@/components/flow/AutomationFlow";

// Full-height builder: the topbar and canvas fill the viewport, nothing scrolls the page.
export default function FlowPage() {
  return (
    <div className="flex h-svh min-h-0 flex-col overflow-hidden">
      <AutomationFlow />
    </div>
  );
}
