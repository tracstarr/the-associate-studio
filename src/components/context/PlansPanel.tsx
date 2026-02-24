import { useState } from "react";
import { FileText, ChevronRight, ChevronDown, Layers } from "lucide-react";
import { usePlans } from "../../hooks/useClaudeData";
import { useSessionStore } from "../../stores/sessionStore";
import { useActiveProjectTabs } from "../../hooks/useActiveProjectTabs";
import type { PlanFile, MarkdownLine } from "../../lib/tauri";
import { cn } from "../../lib/utils";

export function PlansPanel() {
  const { data: plans, isLoading } = usePlans();
  const planLinks = useSessionStore((s) => s.planLinks);
  const openPlanTab = useSessionStore((s) => s.openPlanTab);
  const { openTabs, projectId } = useActiveProjectTabs();
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="p-3 text-xs text-[var(--color-text-muted)]">
        Loading...
      </div>
    );
  }

  const sessionPlans: { plan: PlanFile; tabTitle: string }[] = (plans ?? [])
    .filter((plan) => !!planLinks[plan.filename])
    .map((plan) => {
      const tabId = planLinks[plan.filename];
      const tab = openTabs.find((t) => t.id === tabId);
      return { plan, tabTitle: tab?.title ?? tabId };
    });

  if (!plans || sessionPlans.length === 0) {
    return (
      <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">
        No active plans
      </div>
    );
  }

  const toggle = (filename: string) =>
    setExpandedPlan(expandedPlan === filename ? null : filename);

  const handleOpen = (plan: PlanFile) => {
    if (projectId) {
      openPlanTab(plan.filename, plan.title || plan.filename.replace(/\.md$/, ""), projectId);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-bg-raised)] border-b border-[var(--color-border-muted)]">
        <Layers size={10} className="text-[var(--color-accent-primary)]" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Session Plans
        </span>
      </div>
      {sessionPlans.map(({ plan, tabTitle }) => (
        <PlanRow
          key={plan.filename}
          plan={plan}
          sessionLabel={tabTitle}
          expanded={expandedPlan === plan.filename}
          onToggle={() => toggle(plan.filename)}
          onOpen={() => handleOpen(plan)}
        />
      ))}
    </div>
  );
}

function PlanRow({
  plan,
  expanded,
  onToggle,
  onOpen,
  sessionLabel,
}: {
  plan: PlanFile;
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
  sessionLabel?: string;
}) {
  return (
    <div className="border-b border-[var(--color-border-muted)] group">
      <div className="flex items-center gap-1 w-full px-2 py-1.5 hover:bg-[var(--color-bg-raised)] transition-all duration-200">
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-4 h-4 shrink-0 text-[var(--color-text-muted)]"
        >
          {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </button>
        <FileText
          size={12}
          className="text-[var(--color-accent-primary)] shrink-0"
        />
        <button
          onClick={onOpen}
          className={cn(
            "text-xs text-[var(--color-text-primary)] truncate flex-1 text-left hover:text-[var(--color-accent-primary)] transition-all duration-200",
          )}
        >
          {plan.title || plan.filename}
        </button>
        {sessionLabel && (
          <span className="text-[10px] text-[var(--color-accent-secondary)] bg-[var(--color-bg-raised)] px-1.5 py-0.5 rounded-lg shrink-0">
            {sessionLabel}
          </span>
        )}
      </div>
      {expanded && (
        <div className="px-4 pb-3 space-y-0.5 max-h-60 overflow-y-auto">
          {plan.lines.map((line, i) => (
            <PlanLineRow key={i} line={line} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlanLineRow({ line }: { line: MarkdownLine }) {
  if (line.kind === "Heading") {
    return (
      <p className="text-xs font-semibold text-[var(--color-text-primary)] mt-2">
        {line.text}
      </p>
    );
  }
  if (line.kind === "CodeFence") return null;
  if (line.kind === "CodeBlock") {
    return (
      <code className="text-[10px] text-[var(--color-accent-secondary)] font-mono">
        {line.text}
      </code>
    );
  }
  return (
    <p className="text-xs text-[var(--color-text-secondary)]">{line.text}</p>
  );
}
