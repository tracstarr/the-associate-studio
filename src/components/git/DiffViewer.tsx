import { useGitDiff } from "@/hooks/useClaudeData";
import type { DiffLine, DiffLineKind } from "@/lib/tauri";
import { cn } from "@/lib/utils";

interface DiffViewerProps {
  cwd: string;
  filePath: string;
  staged: boolean;
}

export function DiffViewer({ cwd, filePath, staged }: DiffViewerProps) {
  const { data: lines, isLoading } = useGitDiff(cwd, filePath, staged);

  if (isLoading) {
    return <div className="p-3 text-xs text-text-muted">Loading diff...</div>;
  }

  if (!lines || lines.length === 0) {
    return <div className="p-3 text-xs text-text-muted">No diff available</div>;
  }

  return (
    <div className="font-mono text-xs overflow-auto h-full">
      {lines.map((line, i) => (
        <DiffLineRow key={i} line={line} />
      ))}
    </div>
  );
}

function DiffLineRow({ line }: { line: DiffLine }) {
  const style = getDiffLineStyle(line.kind);
  return (
    <div className={cn("px-3 py-0 leading-5 whitespace-pre", style.bg)}>
      <span className={cn("select-none mr-2", style.prefix)}>
        {getDiffPrefix(line.kind)}
      </span>
      <span className={style.text}>{line.text}</span>
    </div>
  );
}

function getDiffPrefix(kind: DiffLineKind): string {
  switch (kind) {
    case "Add": return "+";
    case "Remove": return "-";
    case "Hunk": return "@@";
    default: return " ";
  }
}

function getDiffLineStyle(kind: DiffLineKind): { bg: string; text: string; prefix: string } {
  switch (kind) {
    case "Add":
      return {
        bg: "bg-diff-add-bg",
        text: "text-status-success",
        prefix: "text-status-success",
      };
    case "Remove":
      return {
        bg: "bg-diff-remove-bg",
        text: "text-status-error",
        prefix: "text-status-error",
      };
    case "Hunk":
      return {
        bg: "bg-bg-raised",
        text: "text-accent-secondary",
        prefix: "text-accent-secondary",
      };
    case "Header":
      return {
        bg: "bg-bg-surface",
        text: "text-text-muted",
        prefix: "text-text-muted",
      };
    default:
      return {
        bg: "",
        text: "text-text-primary",
        prefix: "text-text-muted",
      };
  }
}
