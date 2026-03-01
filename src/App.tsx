import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import { TitleBar } from "./components/shell/TitleBar";
import { StatusBar } from "./components/shell/StatusBar";
import { IDELayout } from "./components/layout/IDELayout";
import { CommandPalette } from "./components/shell/CommandPalette";
import { useKeyBindings } from "./hooks/useKeyBindings";
import { useClaudeWatcher, useGitBranchWatcher } from "./hooks/useClaudeData";
import { useSettingsStore } from "./stores/settingsStore";
import { useProjectsStore } from "./stores/projectsStore";
import { useIssueFilterStore } from "./stores/issueFilterStore";
import { useSessionStore } from "./stores/sessionStore";
import { useEffect, useRef, Component, type ReactNode } from "react";
import { NeuralFieldOverlay } from "./components/dashboard/NeuralFieldOverlay";
import * as tauri from "./lib/tauri";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: "monospace", color: "#f85149", background: "#0d1117", height: "100vh" }}>
          <h2 style={{ color: "#e6edf3" }}>Runtime Error</h2>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, color: "#8b949e" }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function IDEShell() {
  useKeyBindings();
  useClaudeWatcher();
  useGitBranchWatcher();
  const loadFromDisk = useSettingsStore((s) => s.loadFromDisk);
  const loadProjects = useProjectsStore((s) => s.loadProjects);
  const loadRecentFromDisk = useProjectsStore((s) => s.loadRecentFromDisk);
  const loadFiltersForProject = useIssueFilterStore((s) => s.loadFiltersForProject);
  const setPlanLinks = useSessionStore((s) => s.setPlanLinks);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const activeProjectPath = useProjectsStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)?.path ?? null
  );
  // Track previous activeProjectId to avoid re-running on unrelated re-renders
  const prevProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    loadFromDisk();
    loadProjects();
    loadRecentFromDisk();
  }, [loadFromDisk, loadProjects, loadRecentFromDisk]);

  useEffect(() => {
    if (activeProjectPath) loadFiltersForProject(activeProjectPath);
  }, [activeProjectPath, loadFiltersForProject]);

  useEffect(() => {
    if (!activeProjectId) return;
    if (prevProjectIdRef.current === activeProjectId) return;
    prevProjectIdRef.current = activeProjectId;
    tauri.loadPlanLinks(activeProjectId).then(setPlanLinks).catch(() => { /* ignore */ });
  }, [activeProjectId, setPlanLinks]);
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg-base text-text-primary">
      <TitleBar />
      <IDELayout />
      <StatusBar />
      <CommandPalette />
      <NeuralFieldOverlay />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <IDEShell />
        </ErrorBoundary>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
