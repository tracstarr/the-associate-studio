import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/// Mirror of Rust encode_project_path: C:\dev\ide → C--dev-ide
/// Replaces path separators, dots, and underscores with dashes to match Claude CLI behavior.
/// Example: C:\dev\apex_3.11.0 → C--dev-apex-3-11-0
export function pathToProjectId(cwd: string): string {
  let s = cwd.replace(/\//g, "\\");
  s = s.replace(/:\\/g, "--");
  s = s.replace(/\\/g, "-");
  s = s.replace(/[._]/g, "-");
  return s.replace(/-+$/, "");
}
