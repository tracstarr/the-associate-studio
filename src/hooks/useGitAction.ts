import { useOutputStore } from "@/stores/outputStore";
import { useUIStore } from "@/stores/uiStore";
import { debugLog } from "@/stores/debugStore";

export function useGitAction() {
  const addMessage = useOutputStore((s) => s.addMessage);

  return async (label: string, fn: () => Promise<string>) => {
    debugLog("GitAction", `Starting: ${label}`, undefined, "info");
    addMessage("info", `Running: ${label}…`, label);
    const { bottomPanelOpen, toggleBottomPanel, setBottomTab } = useUIStore.getState();
    setBottomTab("output");
    if (!bottomPanelOpen) toggleBottomPanel();
    try {
      const result = await fn();
      addMessage("success", result || "Done", label);
      debugLog("GitAction", `Done: ${label}`, { result }, "success");
    } catch (e) {
      addMessage("error", String(e), label);
      debugLog("GitAction", `Failed: ${label}`, { error: String(e) }, "error");
    }
  };
}
