import { memo } from "react";
import { cn } from "@/lib/utils";
import { useUIStore, type BottomTab } from "@/stores/uiStore";
import { useDebugStore } from "@/stores/debugStore";
import { GitLogPanel } from "@/components/git/GitLogPanel";
import { OutputPanel } from "@/components/layout/OutputPanel";
import { DebugPanel } from "@/components/debug/DebugPanel";

const BASE_TABS: { id: BottomTab; label: string }[] = [
  { id: "log", label: "Git" },
  { id: "output", label: "Output" },
];

const tabPlaceholders: Record<BottomTab, string> = {
  log: "Select a project to view git log.",
  output: "No output.",
  debug: "No debug entries.",
};

function BottomPanelComponent() {
  const activeTab = useUIStore((s) => s.activeBottomTab);
  const setTab = useUIStore((s) => s.setBottomTab);
  const debugCount = useDebugStore((s) => s.entries.length);

  const tabs = import.meta.env.DEV
    ? [...BASE_TABS, { id: "debug" as BottomTab, label: "Debug" }]
    : BASE_TABS;

  return (
    <div className="flex flex-col h-full">
      {/* Tab strip */}
      <div className="flex items-center h-9 border-b border-border-muted px-2 gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={cn(
              "px-4 py-1.5 text-xs rounded-lg transition-all duration-200 flex items-center",
              activeTab === tab.id
                ? "text-accent-primary bg-accent-primary/10 font-medium"
                : "text-text-muted hover:text-text-secondary hover:bg-bg-raised/50"
            )}
          >
            {tab.label}
            {tab.id === "debug" && debugCount > 0 && (
              <span className="ml-1.5 px-1.5 text-[9px] rounded-full bg-bg-base text-text-muted font-mono">
                {debugCount > 99 ? "99+" : debugCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "log" ? (
        <div className="flex-1 overflow-hidden">
          <GitLogPanel />
        </div>
      ) : activeTab === "output" ? (
        <div className="flex-1 overflow-hidden">
          <OutputPanel />
        </div>
      ) : activeTab === "debug" ? (
        <div className="flex-1 overflow-hidden">
          <DebugPanel />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-text-muted text-center">
            {tabPlaceholders[activeTab]}
          </p>
        </div>
      )}
    </div>
  );
}

export const BottomPanel = memo(BottomPanelComponent);
