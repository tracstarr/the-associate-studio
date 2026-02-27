import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { CircleDot, CheckCircle2, Github, ChevronDown, X } from "lucide-react";
import {
  useIssues, useLinearIssues, useJiraIssues,
  useGithubLabels, useGithubAssignees,
  useLinearLabels, useLinearMembers,
  useJiraLabels, useJiraAssignees,
  useLinearViewer, useJiraMyself,
} from "@/hooks/useClaudeData";
import { useProjectsStore } from "@/stores/projectsStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useIssueFilterStore } from "@/stores/issueFilterStore";
import type { Issue, AssigneeOption } from "@/lib/tauri";
import { cn, pathToProjectId } from "@/lib/utils";

// ─── FilterDropdown ───────────────────────────────────────────────────────────

function FilterDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouse(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = options.filter((o) => o.toLowerCase().includes(search.toLowerCase()));

  function toggle(opt: string) {
    const next = new Set(selected);
    if (next.has(opt)) next.delete(opt);
    else next.add(opt);
    onChange(next);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] transition-all duration-200",
          open || selected.size > 0
            ? "bg-[var(--color-bg-raised)] text-[var(--color-text-primary)]"
            : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        )}
      >
        {label}
        {selected.size > 0 && (
          <span className="bg-[var(--color-accent-primary)] text-white rounded-full px-1 text-[9px] leading-tight">
            {selected.size}
          </span>
        )}
        <ChevronDown size={9} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-[var(--color-bg-overlay)] border border-[var(--color-border-muted)] rounded-lg shadow-lg w-48">
          <div className="p-1.5 border-b border-[var(--color-border-muted)] flex items-center gap-1">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent text-[10px] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]"
            />
            {selected.size > 0 && (
              <button
                onClick={() => onChange(new Set())}
                className="text-[9px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              >
                Clear
              </button>
            )}
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 200 }}>
            {filtered.length === 0 && (
              <p className="px-2 py-1.5 text-[10px] text-[var(--color-text-muted)]">No results</p>
            )}
            {filtered.map((opt) => (
              <label
                key={opt}
                className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-[var(--color-bg-raised)] text-[10px] text-[var(--color-text-secondary)]"
              >
                <input
                  type="checkbox"
                  checked={selected.has(opt)}
                  onChange={() => toggle(opt)}
                  className="w-3 h-3 accent-[var(--color-accent-primary)]"
                />
                <span className="truncate">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AssigneeDropdown (value ≠ label for Jira) ───────────────────────────────

function AssigneeDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: AssigneeOption[];
  selected: Set<string>; // set of values (accountId / login / name)
  onChange: (s: Set<string>) => void;
}) {
  const displayOptions: string[] = options.map((o) => o.label);
  const labelToValue = useMemo(() => {
    const m = new Map<string, string>();
    options.forEach((o) => m.set(o.label, o.value));
    return m;
  }, [options]);
  const selectedLabels = useMemo(() => {
    const s = new Set<string>();
    options.forEach((o) => { if (selected.has(o.value)) s.add(o.label); });
    return s;
  }, [selected, options]);

  function onChange2(newLabels: Set<string>) {
    const newValues = new Set<string>();
    newLabels.forEach((lbl) => {
      const v = labelToValue.get(lbl);
      if (v) newValues.add(v);
    });
    onChange(newValues);
  }

  return (
    <FilterDropdown
      label={label}
      options={displayOptions}
      selected={selectedLabels}
      onChange={onChange2}
    />
  );
}

// ─── IssueListPanel ───────────────────────────────────────────────────────────

export function IssueListPanel() {
  const activeProjectDir = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)?.path ?? null
  );
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const openTab = useSessionStore((s) => s.openTab);
  const linearApiKey = useSettingsStore((s) => s.linearApiKey);
  const jiraBaseUrl = useSettingsStore((s) => s.jiraBaseUrl);
  const jiraEmail = useSettingsStore((s) => s.jiraEmail);
  const jiraApiToken = useSettingsStore((s) => s.jiraApiToken);
  const hasJira = !!(jiraBaseUrl && jiraEmail && jiraApiToken);

  // Persisted filter state from store
  const getFilters = useIssueFilterStore((s) => s.getFilters);
  const setFilters = useIssueFilterStore((s) => s.setFilters);
  const projectId = activeProjectId ?? "__none__";
  const saved = getFilters(projectId);

  const state = saved.state;
  const ghAssignees = useMemo(() => new Set(saved.ghAssignees), [saved.ghAssignees]);
  const linearAssignees = useMemo(() => new Set(saved.linearAssignees), [saved.linearAssignees]);
  const jiraAssignees = useMemo(() => new Set(saved.jiraAssignees), [saved.jiraAssignees]);
  const labelFilter = useMemo(() => new Set(saved.labelFilter), [saved.labelFilter]);

  const setState = useCallback(
    (s: "open" | "closed" | "all") => setFilters(projectId, { state: s }),
    [projectId, setFilters],
  );
  const setGhAssignees = useCallback(
    (s: Set<string>) => setFilters(projectId, { ghAssignees: [...s] }),
    [projectId, setFilters],
  );
  const setLinearAssignees = useCallback(
    (s: Set<string>) => setFilters(projectId, { linearAssignees: [...s] }),
    [projectId, setFilters],
  );
  const setJiraAssignees = useCallback(
    (s: Set<string>) => setFilters(projectId, { jiraAssignees: [...s] }),
    [projectId, setFilters],
  );
  const setLabelFilter = useCallback(
    (s: Set<string>) => setFilters(projectId, { labelFilter: [...s] }),
    [projectId, setFilters],
  );

  // Provider toggles
  const configuredProviders = useMemo(() => {
    const p: string[] = ["github"];
    if (linearApiKey) p.push("linear");
    if (hasJira) p.push("jira");
    return p;
  }, [linearApiKey, hasJira]);

  // Derive active providers — use saved if non-empty, otherwise default to all configured
  const activeProviders = useMemo(() => {
    if (saved.activeProviders.length > 0) return new Set(saved.activeProviders);
    return new Set(configuredProviders);
  }, [saved.activeProviders, configuredProviders]);

  const setActiveProviders = useCallback(
    (updater: (prev: Set<string>) => Set<string>) => {
      const next = updater(activeProviders);
      setFilters(projectId, { activeProviders: [...next] });
    },
    [activeProviders, projectId, setFilters],
  );

  // Derive single filter values for each provider (GitHub only supports one --assignee)
  const ghAssignee = ghAssignees.size > 0 ? [...ghAssignees][0] : undefined;
  const linearAssignee = linearAssignees.size > 0 ? [...linearAssignees][0] : undefined;
  const jiraAssignee = jiraAssignees.size > 0 ? [...jiraAssignees][0] : undefined;
  const labels = labelFilter.size > 0 ? [...labelFilter] : undefined;

  // Issue queries — filters go to server
  const { data: ghIssues, isLoading: ghLoading, refetch: ghRefetch } = useIssues(
    activeProviders.has("github") ? activeProjectDir : null,
    state, ghAssignee, labels,
  );
  const { data: linearIssues, isLoading: linearLoading, refetch: linearRefetch } = useLinearIssues(
    !!linearApiKey && activeProviders.has("linear"),
    state, linearAssignee, labels,
  );
  const { data: jiraIssues, isLoading: jiraLoading, error: jiraError, refetch: jiraRefetch } = useJiraIssues(
    hasJira && activeProviders.has("jira"),
    jiraBaseUrl, jiraEmail, jiraApiToken,
    state, jiraAssignee, labels,
  );

  // Options — fetched from dedicated endpoints, not derived from issue list
  const { data: ghLabelOptions = [] } = useGithubLabels(activeProjectDir);
  const { data: ghAssigneeOptions = [] } = useGithubAssignees(activeProjectDir);
  const { data: linearLabelOptions = [] } = useLinearLabels(!!linearApiKey);
  const { data: linearMemberOptions = [] } = useLinearMembers(!!linearApiKey);
  const { data: jiraLabelOptions = [] } = useJiraLabels(hasJira, jiraBaseUrl, jiraEmail, jiraApiToken);
  const { data: jiraAssigneeOptions = [] } = useJiraAssignees(hasJira, jiraBaseUrl, jiraEmail, jiraApiToken);
  const { data: linearViewer } = useLinearViewer(!!linearApiKey);
  const { data: jiraMyself } = useJiraMyself(hasJira, jiraBaseUrl, jiraEmail, jiraApiToken);

  // Combine label options across configured providers
  const allLabelOptions = useMemo(() => {
    const active = new Set(activeProviders);
    const combined = new Set<string>();
    if (active.has("github")) ghLabelOptions.forEach((l) => combined.add(l));
    if (active.has("linear")) linearLabelOptions.forEach((l) => combined.add(l));
    if (active.has("jira")) jiraLabelOptions.forEach((l) => combined.add(l));
    return [...combined].sort();
  }, [activeProviders, ghLabelOptions, linearLabelOptions, jiraLabelOptions]);

  // Build assignee option lists with "Me" prepended and deduplicated
  const ghAssigneeOptionsFull: AssigneeOption[] = useMemo(
    () => [
      { value: "@me", label: "Me" },
      ...ghAssigneeOptions.map((l) => ({ value: l, label: l })),
    ],
    [ghAssigneeOptions]
  );
  const linearMemberOptionsFull: AssigneeOption[] = useMemo(
    () => [
      ...(linearViewer ? [{ value: linearViewer, label: "Me" }] : []),
      ...linearMemberOptions
        .filter((n) => n !== linearViewer)
        .map((n) => ({ value: n, label: n })),
    ],
    [linearViewer, linearMemberOptions]
  );
  const jiraAssigneeOptionsFull: AssigneeOption[] = useMemo(
    () => [
      ...(jiraMyself ? [{ value: jiraMyself.value, label: "Me" }] : []),
      ...jiraAssigneeOptions.filter((a) => a.value !== jiraMyself?.value),
    ],
    [jiraMyself, jiraAssigneeOptions]
  );

  const issues = useMemo(() => {
    const all = [...(ghIssues ?? []), ...(linearIssues ?? []), ...(jiraIssues ?? [])];
    return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [ghIssues, linearIssues, jiraIssues]);

  const isLoading = ghLoading || linearLoading || jiraLoading;

  const hasAssigneeFilter =
    ghAssignees.size > 0 || linearAssignees.size > 0 || jiraAssignees.size > 0;

  const showFilterRow =
    configuredProviders.length >= 2 ||
    allLabelOptions.length > 0 ||
    ghAssigneeOptionsFull.length > 0 ||
    linearMemberOptionsFull.length > 0 ||
    jiraAssigneeOptions.length > 0;

  function toggleProvider(p: string) {
    setActiveProviders((prev) => {
      const next = new Set(prev);
      if (next.has(p)) { if (next.size > 1) next.delete(p); }
      else next.add(p);
      return next;
    });
  }

  function clearFilters() {
    setFilters(projectId, {
      ghAssignees: [],
      linearAssignees: [],
      jiraAssignees: [],
      labelFilter: [],
    });
  }

  function refetch() {
    ghRefetch();
    linearRefetch();
    jiraRefetch();
  }

  const openIssueTab = (issue: Issue) => {
    if (!activeProjectDir) return;
    const projectId = pathToProjectId(activeProjectDir);
    const key = issue.identifier ?? String(issue.number);
    const title = issue.source === "github" ? `#${issue.number}` : key;
    openTab(
      {
        id: `issue:${issue.source}:${key}`,
        type: "issue-detail",
        title,
        projectDir: activeProjectDir,
        issueKey: key,
        issueSource: issue.source,
        issueUrl: issue.url,
      },
      projectId
    );
  };

  if (!activeProjectDir) {
    return (
      <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">
        Open a project to see issues
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Row 1: state + refresh */}
      <div className="flex items-center border-b border-[var(--color-border-muted)] px-2 py-1 gap-1">
        {(["open", "closed", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setState(s)}
            className={cn(
              "px-2 py-0.5 rounded-lg text-[10px] capitalize transition-all duration-200",
              state === s
                ? "bg-[var(--color-bg-raised)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            )}
          >
            {s}
          </button>
        ))}
        <button
          onClick={refetch}
          className="ml-auto text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        >
          ↻
        </button>
      </div>

      {/* Row 2: provider toggles + filters */}
      {showFilterRow && (
        <div className="flex items-center flex-wrap gap-1 border-b border-[var(--color-border-muted)] px-2 py-1">
          {configuredProviders.length >= 2 && (
            <>
              {configuredProviders.map((p) => (
                <button
                  key={p}
                  onClick={() => toggleProvider(p)}
                  title={p.charAt(0).toUpperCase() + p.slice(1)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] capitalize transition-all duration-200",
                    activeProviders.has(p)
                      ? "bg-[var(--color-bg-raised)] text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-muted)] opacity-50"
                  )}
                >
                  <ProviderIcon source={p as Issue["source"]} />
                  {p}
                </button>
              ))}
              <span className="text-[var(--color-border-muted)] text-[10px] select-none">|</span>
            </>
          )}

          {allLabelOptions.length > 0 && (
            <FilterDropdown
              label="Labels"
              options={allLabelOptions}
              selected={labelFilter}
              onChange={setLabelFilter}
            />
          )}

          {activeProviders.has("github") && ghAssigneeOptionsFull.length > 0 && (
            <AssigneeDropdown
              label="GH Assignees"
              options={ghAssigneeOptionsFull}
              selected={ghAssignees}
              onChange={setGhAssignees}
            />
          )}

          {activeProviders.has("linear") && linearMemberOptionsFull.length > 0 && (
            <AssigneeDropdown
              label="Linear Assignees"
              options={linearMemberOptionsFull}
              selected={linearAssignees}
              onChange={setLinearAssignees}
            />
          )}

          {activeProviders.has("jira") && jiraAssigneeOptionsFull.length > 0 && (
            <AssigneeDropdown
              label="Jira Assignees"
              options={jiraAssigneeOptionsFull}
              selected={jiraAssignees}
              onChange={setJiraAssignees}
            />
          )}

          {(labelFilter.size > 0 || hasAssigneeFilter) && (
            <button
              onClick={clearFilters}
              className="ml-auto text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              title="Clear filters"
            >
              <X size={10} />
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-3 text-xs text-[var(--color-text-muted)]">Loading…</div>
        )}
        {!isLoading && jiraError && (
          <div className="p-3 text-xs text-[var(--color-status-error)] break-all">
            Jira: {String(jiraError)}
          </div>
        )}
        {!isLoading && issues.length === 0 && !jiraError && (
          <div className="p-3 text-xs text-[var(--color-text-muted)] text-center">
            No {state === "all" ? "" : state} issues
          </div>
        )}
        {issues.map((issue, i) => (
          <IssueItem
            key={`${issue.source}-${issue.identifier ?? issue.number}-${i}`}
            issue={issue}
            onSelect={openIssueTab}
          />
        ))}
      </div>
    </div>
  );
}

// ─── ProviderIcon ─────────────────────────────────────────────────────────────

function ProviderIcon({ source }: { source: Issue["source"] }) {
  if (source === "github") return <Github size={10} />;
  if (source === "linear") {
    return (
      <svg width="10" height="10" viewBox="0 0 100 100" fill="currentColor">
        <path d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857l37.3249 37.3249c.6889.6889.0915 1.8189-.857 1.5964C20.0516 95.1512 5.1488 80.2483 1.22541 61.5228zM.00189135 46.8891c-.01764375.3792.08825.7558.32148 1.0661l52.0956 52.0956c.3103.2332.6869.3391 1.0661.3215C29.7011 98.0867 1.99222 70.3778.00189135 46.8891zM4.69889 29.2076 70.7918 95.3005c.3401.3401.4168.8341.2372 1.2627C64.4903 99.8302 57.4747 101 50.2222 101c-.8864 0-1.7682-.0213-2.6456-.0633L3.43284 56.8311c-.04211-.8774-.06329-1.7592-.06329-2.6456 0-7.2525 1.16983-14.268 3.32905-20.983zM7.96879 19.4655c-.92861.931-.72523 2.4998.43883 3.1583l69.6078 69.6078c.6585 1.164 2.2273 1.3674 3.1583.4388L7.96879 19.4655zM14.3976 12.5045 87.4949 85.6018c1.0683.8928 2.625.8141 3.4317-.1896L14.5872 9.07281c-1.0037.80665-1.0824 2.36335-.1896 3.43169zM22.8194 7.06997 92.9296 77.1802c.8928 1.0684.8141 2.6251-.1896 3.4317L19.3877 7.25958c1.0684-.89279 2.6251-.81403 3.4317.19039zM33.1677 3.35664 96.6428 66.8317c.6585 1.164.4551 2.7328-.4388 3.1583L29.0094 2.90948c.9485-.22253 2.4598.00965 4.1583.44716zM46.8891.00189C70.3778 1.99222 98.0867 29.7011 99.8215 53.1628c.0176.3792-.0883.7558-.3215 1.0661L45.8227.32337c-.3103-.2332-.6869-.3391-1.0661-.3215.3775-.00131.7551-.00131 1.1325 0z" />
      </svg>
    );
  }
  if (source === "jira") {
    return (
      <svg width="10" height="10" viewBox="0 0 256 257" fill="currentColor">
        <path d="M145.951 125.8L78.648 58.498 52.467 32.317 2.804 82.004 29 108.2l30.352 30.352-30.352 30.352-26.196 26.196 49.663 49.663 49.664-49.663 26.196-26.196 26.196-26.196-9.372-16.909zM205.533 148.553L179.337 122.357l-26.196-26.196-26.196 26.196 26.196 26.196 26.196 26.196 26.196-26.196z" />
      </svg>
    );
  }
  return null;
}

// ─── SourceBadge ─────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: Issue["source"] }) {
  const colors: Record<Issue["source"], string> = {
    github: "text-[var(--color-text-muted)]",
    linear: "text-indigo-400",
    jira: "text-blue-400",
  };
  return (
    <span title={source.charAt(0).toUpperCase() + source.slice(1)} className={cn("shrink-0", colors[source])}>
      <ProviderIcon source={source} />
    </span>
  );
}

// ─── IssueItem ────────────────────────────────────────────────────────────────

function IssueItem({ issue, onSelect }: { issue: Issue; onSelect: (issue: Issue) => void }) {
  const timeAgo = formatTimeAgo(issue.created_at);
  const displayId = issue.identifier ?? `#${issue.number}`;

  return (
    <div
      className="px-3 py-2 border-b border-[var(--color-border-muted)] hover:bg-[var(--color-bg-raised)] transition-all duration-200 cursor-pointer"
      onClick={() => onSelect(issue)}
    >
      <div className="flex items-start gap-2">
        <SourceBadge source={issue.source} />
        {issue.state === "open" ? (
          <CircleDot size={12} className="text-[var(--color-status-success)] mt-0.5 shrink-0" />
        ) : (
          <CheckCircle2 size={12} className="text-[var(--color-accent-secondary)] mt-0.5 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[var(--color-text-primary)] truncate">{issue.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {displayId}{issue.author ? ` by ${issue.author}` : ""}
              {issue.assignee ? ` → ${issue.assignee}` : ""}
              {" · "}{timeAgo}
            </span>
          </div>
          {issue.labels.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {issue.labels.slice(0, 3).map((label) => (
                <span
                  key={label}
                  className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--color-bg-overlay)] text-[var(--color-text-muted)]"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}
