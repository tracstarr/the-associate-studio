import { useOutputStore } from "@/stores/outputStore";
import { useUIStore } from "@/stores/uiStore";

export function useGitAction() {
  const addMessage = useOutputStore((s) => s.addMessage);
  const setBottomTab = useUIStore((s) => s.setBottomTab);
  const bottomPanelOpen = useUIStore((s) => s.bottomPanelOpen);
  const toggleBottomPanel = useUIStore((s) => s.toggleBottomPanel);

  return async (label: string, fn: () => Promise<string>) => {
    addMessage("info", `Running: ${label}…`, label);
    setBottomTab("output");
    if (!bottomPanelOpen) toggleBottomPanel();
    try {
      const result = await fn();
      addMessage("success", result || "Done", label);
    } catch (e) {
      addMessage("error", String(e), label);
    }
  };
}
