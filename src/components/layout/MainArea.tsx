import { memo, useState, useCallback } from "react";
import { X, FileText, BookOpen, Settings, GitBranch, History, Terminal, Code2 } from "lucide-react";
import { useSessionStore } from "@/stores/sessionStore";
import type { SessionTab } from "@/stores/sessionStore";
import { useActiveProjectTabs } from "@/hooks/useActiveProjectTabs";
import { TerminalView } from "../terminal/TerminalView";
import { SessionView } from "../sessions/SessionView";
import { PlanEditorView } from "../plan/PlanEditorView";
import { ReadmeTab } from "../readme/ReadmeTab";
import { FileEditorTab } from "../files/FileEditorTab";
import { SettingsTab } from "../settings/SettingsTab";
import { DiffViewer } from "../git/DiffViewer";
import { TabContextMenu } from "./TabContextMenu";
import type { TabCloseAction } from "./TabContextMenu";
import { CloseTabsWarningDialog } from "./CloseTabsWarningDialog";
import { cn } from "@/lib/utils";

function tabAccent(tab: SessionTab, knownSessions: Record<string, "active" | "idle" | "completed">) {
  const isTerminal = !tab.type || tab.type === "terminal";
  if (isTerminal) {
    const isLive = tab.resolvedSessionId ? knownSessions[tab.resolvedSessionId] === "active" : false;
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

function MainAreaComponent({ projectId: projectIdProp }: { projectId?: string }) {
  const { openTabs, activeTabId, projectId } = useActiveProjectTabs(projectIdProp);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);
  const closeTab = useSessionStore((s) => s.closeTab);
  const knownSessions = useSessionStore((s) => s.knownSessions);
  const dirtyTabs = useSessionStore((s) => s.dirtyTabs);
  const closeAllTabs = useSessionStore((s) => s.closeAllTabs);
  const closeOtherTabs = useSessionStore((s) => s.closeOtherTabs);
  const closeTabsToLeft = useSessionStore((s) => s.closeTabsToLeft);
  const closeTabsToRight = useSessionStore((s) => s.closeTabsToRight);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tab: SessionTab } | null>(null);
  const [pendingClose, setPendingClose] = useState<{ action: TabCloseAction; tabId: string } | null>(null);

  const getAffectedTabIds = useCallback((action: TabCloseAction, tabId: string): string[] => {
    switch (action) {
      case "close":
        return [tabId];
      case "closeAll":
        return openTabs.map((t) => t.id);
      case "closeOthers":
        return openTabs.filter((t) => t.id !== tabId).map((t) => t.id);
      case "closeLeft": {
        const idx = openTabs.findIndex((t) => t.id === tabId);
        return idx > 0 ? openTabs.slice(0, idx).map((t) => t.id) : [];
      }
      case "closeRight": {
        const idx = openTabs.findIndex((t) => t.id === tabId);
        return idx !== -1 ? openTabs.slice(idx + 1).map((t) => t.id) : [];
      }
    }
  }, [openTabs]);

  const computeWarnings = useCallback((action: TabCloseAction, tabId: string): string[] => {
    const affectedIds = getAffectedTabIds(action, tabId);
    const warnings: string[] = [];
    for (const id of affectedIds) {
      const tab = openTabs.find((t) => t.id === id);
      if (!tab) continue;
      if (dirtyTabs[id]) {
        warnings.push(`"${tab.title}" has unsaved changes`);
      }
      const isTerminal = !tab.type || tab.type === "terminal";
      if (isTerminal && tab.resolvedSessionId && knownSessions[tab.resolvedSessionId] === "active") {
        warnings.push(`"${tab.title}" has an active Claude session`);
      }
    }
    return warnings;
  }, [getAffectedTabIds, openTabs, dirtyTabs, knownSessions]);

  const executeClose = useCallback((action: TabCloseAction, tabId: string) => {
    switch (action) {
      case "close": closeTab(tabId, projectId); break;
      case "closeAll": closeAllTabs(projectId); break;
      case "closeOthers": closeOtherTabs(tabId, projectId); break;
      case "closeLeft": closeTabsToLeft(tabId, projectId); break;
      case "closeRight": closeTabsToRight(tabId, projectId); break;
    }
  }, [closeTab, closeAllTabs, closeOtherTabs, closeTabsToLeft, closeTabsToRight, projectId]);

  const handleAction = useCallback((action: TabCloseAction, tabId: string) => {
    const warnings = computeWarnings(action, tabId);
    if (warnings.length > 0) {
      setPendingClose({ action, tabId });
    } else {
      executeClose(action, tabId);
    }
  }, [computeWarnings, executeClose]);

  return (
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
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, tab });
              }}
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
                <FileEditorTab tabId={tab.id} filePath={tab.filePath!} isActive={activeTabId === tab.id} />
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

      {contextMenu && (
        <TabContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          tab={contextMenu.tab}
          tabs={openTabs}
          onClose={() => setContextMenu(null)}
          onAction={(action) => {
            setContextMenu(null);
            handleAction(action, contextMenu.tab.id);
          }}
        />
      )}

      {pendingClose && (
        <CloseTabsWarningDialog
          warnings={computeWarnings(pendingClose.action, pendingClose.tabId)}
          onConfirm={() => {
            executeClose(pendingClose.action, pendingClose.tabId);
            setPendingClose(null);
          }}
          onCancel={() => setPendingClose(null)}
        />
      )}
    </div>
  );
}

export const MainArea = memo(MainAreaComponent);
