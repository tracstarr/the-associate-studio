import { memo } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { X, FileText, BookOpen, Settings, GitBranch, History, Terminal, Code2 } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";
import type { SessionTab } from "@/stores/sessionStore";
import { useActiveProjectTabs } from "@/hooks/useActiveProjectTabs";
import { BottomPanel } from "./BottomPanel";
import { TerminalView } from "../terminal/TerminalView";
import { SessionView } from "../sessions/SessionView";
import { PlanEditorView } from "../plan/PlanEditorView";
import { ReadmeTab } from "../readme/ReadmeTab";
import { FileEditorTab } from "../files/FileEditorTab";
import { SettingsTab } from "../settings/SettingsTab";
import { DiffViewer } from "../git/DiffViewer";
import { cn } from "@/lib/utils";

function tabAccent(tab: SessionTab, knownSessions: Record<string, boolean>) {
  const isTerminal = !tab.type || tab.type === "terminal";
  if (isTerminal) {
    const isLive = tab.resolvedSessionId ? knownSessions[tab.resolvedSessionId] === true : false;
    return isLive
      ? { border: "border-t-[var(--color-status-success)]", icon: "text-[var(--color-status-success)]" }
      : { border: "border-t-[var(--color-status-warning)]", icon: "text-[var(--color-status-warning)]" };
  }
  if (tab.type === "session-view") {
    return { border: "border-t-[var(--color-status-warning)]", icon: "text-[var(--color-status-warning)]" };
  }
  // readme, plan, diff, settings → blue
  return { border: "border-t-[var(--color-accent-primary)]", icon: "text-[var(--color-accent-primary)]" };
}

function MainAreaComponent() {
  const bottomPanelOpen = useUIStore((s) => s.bottomPanelOpen);
  const { openTabs, activeTabId, projectId } = useActiveProjectTabs();
  const setActiveTab = useSessionStore((s) => s.setActiveTab);
  const closeTab = useSessionStore((s) => s.closeTab);
  const knownSessions = useSessionStore((s) => s.knownSessions);

  return (
    <PanelGroup direction="vertical" className="h-full">
      <Panel minSize={30}>
        <div className="flex flex-col h-full bg-bg-base">
          {/* Tab bar */}
          <div className="flex items-center h-9 bg-bg-surface border-b border-border-default overflow-x-auto shrink-0">
            {openTabs.length === 0 ? (
              <div className="flex items-center h-7 px-3 mx-1 rounded-t bg-bg-base text-text-primary text-xs border border-border-default border-b-0">
                Welcome
              </div>
            ) : (
              openTabs.map((tab) => {
                const isActive = activeTabId === tab.id;
                const accent = tabAccent(tab, knownSessions);
                return (
                <div
                  key={tab.id}
                  className={cn(
                    "flex items-center gap-2 px-3 h-full border-r border-border-default cursor-pointer text-xs whitespace-nowrap select-none",
                    isActive
                      ? cn("text-text-primary bg-bg-base border-t-2", accent.border)
                      : "text-text-muted hover:text-text-secondary hover:bg-bg-raised"
                  )}
                  onClick={() => setActiveTab(tab.id, projectId)}
                >
                  {tab.type === "settings" && (
                    <Settings size={10} className={cn("shrink-0", isActive ? accent.icon : "text-text-muted")} />
                  )}
                  {tab.type === "plan" && (
                    <FileText size={10} className={cn("shrink-0", isActive ? accent.icon : "text-text-muted")} />
                  )}
                  {tab.type === "readme" && (
                    <BookOpen size={10} className={cn("shrink-0", isActive ? "text-[var(--color-accent-secondary)]" : "text-text-muted")} />
                  )}
                  {tab.type === "diff" && (
                    <GitBranch size={10} className={cn("shrink-0", isActive ? accent.icon : "text-text-muted")} />
                  )}
                  {tab.type === "session-view" && (
                    <History size={10} className={cn("shrink-0", isActive ? accent.icon : "text-text-muted")} />
                  )}
                  {tab.type === "file" && (
                    <Code2 size={10} className={cn("shrink-0", isActive ? "text-[var(--color-accent-secondary)]" : "text-text-muted")} />
                  )}
                  {(!tab.type || tab.type === "terminal") && (
                    <Terminal size={10} className={cn("shrink-0", isActive ? accent.icon : "text-text-muted")} />
                  )}
                  {tab.title}
                  <button
                    className="text-text-muted hover:text-text-primary transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id, projectId);
                    }}
                    aria-label="Close tab"
                  >
                    <X size={10} />
                  </button>
                </div>
                );
              })
            )}
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-hidden relative">
            {openTabs.length === 0 ? (
              <div className="flex items-center justify-center w-full h-full">
                <div className="text-center text-text-muted">
                  <p className="text-4xl mb-4 opacity-20">&#x2328;</p>
                  <p className="text-sm font-medium text-text-secondary">
                    The Associate Studio
                  </p>
                  <p className="text-xs mt-2">Select a session or open a project to start</p>
                  <div className="mt-6 grid grid-cols-2 gap-2 text-xs text-left max-w-xs">
                    <kbd className="px-2 py-1 bg-bg-raised border border-border-default rounded text-center">Ctrl+1</kbd>
                    <span className="flex items-center text-text-muted">Projects</span>
                    <kbd className="px-2 py-1 bg-bg-raised border border-border-default rounded text-center">Ctrl+2</kbd>
                    <span className="flex items-center text-text-muted">Git</span>
                    <kbd className="px-2 py-1 bg-bg-raised border border-border-default rounded text-center">Ctrl+P</kbd>
                    <span className="flex items-center text-text-muted">Command palette</span>
                  </div>
                </div>
              </div>
            ) : (
              openTabs.map((tab) => (
                <div
                  key={tab.id}
                  className="w-full h-full absolute inset-0"
                  style={{ display: activeTabId === tab.id ? "block" : "none" }}
                >
                  {tab.type === "settings" ? (
                    <SettingsTab />
                  ) : tab.type === "plan" ? (
                    <PlanEditorView
                      filename={tab.planFilename!}
                      isActive={activeTabId === tab.id}
                    />
                  ) : tab.type === "file" ? (
                    <FileEditorTab filePath={tab.filePath!} isActive={activeTabId === tab.id} />
                  ) : tab.type === "readme" ? (
                    <ReadmeTab
                      filePath={tab.filePath ?? tab.projectDir + "/README.md"}
                      projectDir={tab.projectDir}
                      isActive={activeTabId === tab.id}
                      tabId={tab.id}
                    />
                  ) : tab.type === "diff" ? (
                    <DiffViewer
                      cwd={tab.projectDir}
                      filePath={tab.diffPath!}
                      staged={tab.diffStaged ?? false}
                    />
                  ) : tab.type === "session-view" ? (
                    <SessionView tab={tab} projectId={projectId} />
                  ) : (
                    <TerminalView
                      sessionId={tab.id}
                      resumeSessionId={tab.sessionId}
                      cwd={tab.projectDir || "C:/dev"}
                      isActive={activeTabId === tab.id}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </Panel>

      {bottomPanelOpen && (
        <>
          <PanelResizeHandle className="h-px bg-border-default hover:bg-accent-primary transition-colors" />
          <Panel defaultSize={25} minSize={10} maxSize={50}>
            <BottomPanel />
          </Panel>
        </>
      )}
    </PanelGroup>
  );
}

export const MainArea = memo(MainAreaComponent);
