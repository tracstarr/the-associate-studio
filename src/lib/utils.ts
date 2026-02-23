import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/// Mirror of Rust encode_project_path: C:\dev\ide → C--dev-ide
export function pathToProjectId(cwd: string): string {
  let s = cwd.replace(/\//g, "\\");
  s = s.replace(/:\\/g, "--");
  s = s.replace(/\\/g, "-");
  return s.replace(/-+$/, "");
}
