import { useState } from "react";
import { FileText, ChevronRight, ChevronDown, Layers, Scroll } from "lucide-react";
import { usePlans, useSessions, useSummaries } from "../../hooks/useClaudeData";
import { useSessionStore } from "../../stores/sessionStore";
import { useActiveProjectTabs } from "../../hooks/useActiveProjectTabs";
import { useProjectsStore } from "../../stores/projectsStore";
import type { PlanFile, MarkdownLine, SummaryFile } from "../../lib/tauri";
import { cn } from "../../lib/utils";

export function PlansPanel() {
  const { data: plans, isLoading } = usePlans();
  const planLinks = useSessionStore((s) => s.planLinks);
  const openPlanTab = useSessionStore((s) => s.openPlanTab);
  const { projectId } = useActiveProjectTabs();
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  const { projects, activeProjectId } = useProjectsStore();
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const { data: sessions } = useSessions(activeProject?.path ?? "");

  if (isLoading) {
    return (
      <div className="p-3 text-xs text-[var(--color-text-muted)]">
        Loading...
      </div>
    );
  }

  const sessionPlans: { plan: PlanFile; sessionId: string; sessionLabel: string }[] = (plans ?? [])
    .filter((plan) => !!planLinks[plan.filename])
    .map((plan) => {
      const sessionId = planLinks[plan.filename];
      const session = sessions?.find((s) => s.sessionId === sessionId);
      return { plan, sessionId, sessionLabel: session?.summary ?? sessionId?.slice(0, 8) ?? "" };
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
      {sessionPlans.map(({ plan, sessionId, sessionLabel }) => (
        <PlanRow
          key={plan.filename}
          plan={plan}
          sessionId={sessionId}
          sessionLabel={sessionLabel}
          projectId={projectId}
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
  sessionId,
  sessionLabel,
  projectId,
  expanded,
  onToggle,
  onOpen,
}: {
  plan: PlanFile;
  sessionId: string;
  sessionLabel: string;
  projectId: string;
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
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
        <div className="pb-3">
          <div className="px-4 space-y-0.5 max-h-48 overflow-y-auto">
            {plan.lines.map((line, i) => (
              <PlanLineRow key={i} line={line} />
            ))}
          </div>
          {sessionId && projectId && (
            <SummaryItems
              encodedProjectDir={projectId}
              sessionId={sessionId}
              projectId={projectId}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SummaryItems({
  encodedProjectDir,
  sessionId,
  projectId,
}: {
  encodedProjectDir: string;
  sessionId: string;
  projectId: string;
}) {
  const { data: summaries } = useSummaries(encodedProjectDir, sessionId);
  const openSummaryTab = useSessionStore((s) => s.openSummaryTab);

  if (!summaries || summaries.length === 0) return null;

  return (
    <div className="mt-2 border-t border-[var(--color-border-muted)] pt-1">
      {summaries.map((s: SummaryFile) => {
        const match = s.filename.match(/-summary-(\d+)\.md$/);
        const num = match ? parseInt(match[1], 10) : 1;
        return (
          <button
            key={s.filename}
            onClick={() => openSummaryTab(s.session_id, s.filename, encodedProjectDir, projectId)}
            className="flex items-center gap-1.5 w-full px-4 py-1 text-left text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent-primary)] hover:bg-[var(--color-bg-raised)] transition-colors"
            title={s.preview}
          >
            <Scroll size={10} className="text-[var(--color-text-muted)] shrink-0" />
            <span className="truncate">Summary {num}</span>
          </button>
        );
      })}
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
