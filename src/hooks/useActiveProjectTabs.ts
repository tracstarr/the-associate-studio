import type { SessionTab } from "../stores/sessionStore";
import { useProjectsStore } from "../stores/projectsStore";
import { useSessionStore } from "../stores/sessionStore";

const EMPTY_TABS: SessionTab[] = [];

export function useActiveProjectTabs() {
  const projectId = useProjectsStore((s) => s.activeProjectId) ?? "";
  const openTabs = useSessionStore((s) => s.tabsByProject[projectId] ?? EMPTY_TABS);
  const activeTabId = useSessionStore((s) => s.activeTabByProject[projectId] ?? null);
  return { openTabs, activeTabId, projectId };
}
