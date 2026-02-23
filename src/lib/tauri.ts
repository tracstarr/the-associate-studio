import { invoke } from "@tauri-apps/api/core";

// ---- Session Types ----

export interface SessionEntry {
  sessionId: string;
  firstPrompt?: string;
  summary?: string;
  messageCount?: number;
  created?: string;
  modified?: string;
  gitBranch?: string;
  projectPath?: string;
  isSidechain?: boolean;
}

// ---- Team Types ----

export interface TeamMember {
  name: string;
  agentId?: string;
  agentType?: string;
  model?: string;
  cwd?: string;
  color?: string;
  joinedAt?: number;
  tmuxPaneId?: string;
  backendType?: string;
  prompt?: string;
  planModeRequired?: boolean;
  subscriptions?: string[];
}

export interface TeamConfig {
  name?: string;
  description?: string;
  createdAt?: number;
  leadAgentId?: string;
  leadSessionId?: string;
  members: TeamMember[];
}

export interface Team {
  dirName: string;
  config: TeamConfig;
}

// ---- Task Types ----

export type TaskStatus = "pending" | "in_progress" | "completed" | "deleted";

export interface Task {
  id: string;
  subject?: string;
  description?: string;
  status: TaskStatus;
  owner?: string;
  blocks: string[];
  blockedBy: string[];
  activeForm?: string;
  metadata?: Record<string, unknown>;
}

// ---- Inbox Types ----

export interface InboxMessage {
  from: string;
  text: string;
  timestamp?: string;
  read?: boolean;
  color?: string;
}

// ---- Todo Types ----

export interface TodoItem {
  content?: string;
  status?: string;
  activeForm?: string;
}

export interface TodoFile {
  filename: string;
  items: TodoItem[];
}

// ---- Plan Types ----

export type MarkdownLineKind = "Heading" | "CodeFence" | "CodeBlock" | "Normal";

export interface MarkdownLine {
  kind: MarkdownLineKind;
  text: string;
}

export interface PlanFile {
  filename: string;
  title: string;
  modified: number;
  lines: MarkdownLine[];
}

// ---- Transcript Types ----

export type TranscriptItemKind =
  | "User"
  | "Assistant"
  | "ToolUse"
  | "ToolResult"
  | "System"
  | "Progress"
  | "Other";

export interface TranscriptItem {
  timestamp?: string;
  kind: TranscriptItemKind;
  text: string;
}

// ---- Worktree Types ----

export interface WorktreeInfo {
  path: string;
  head: string;       // short SHA (first 8 chars)
  branch: string;     // short branch name, e.g. "feature/auth"
  isMain: boolean;
  isPrunable: boolean;
}

// ---- Git Types ----

export type GitFileSection = "Staged" | "Unstaged" | "Untracked";

export interface GitFileEntry {
  path: string;
  section: GitFileSection;
  statusChar: string;
}

export type DiffLineKind = "Header" | "Add" | "Remove" | "Hunk" | "Context";

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
}

export interface GitStatus {
  staged: GitFileEntry[];
  unstaged: GitFileEntry[];
  untracked: GitFileEntry[];
}

// ---- File System Types ----

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size?: number;
}

// ---- Invoke Wrappers ----

export async function loadSessions(
  projectDir: string
): Promise<SessionEntry[]> {
  return invoke("cmd_load_sessions", { projectDir });
}

export async function loadTranscript(
  sessionPath: string,
  offset: number
): Promise<[TranscriptItem[], number]> {
  return invoke("cmd_load_transcript", { sessionPath, offset });
}

export async function loadTeams(
  projectCwd?: string
): Promise<Team[]> {
  return invoke("cmd_load_teams", { projectCwd: projectCwd ?? null });
}

export async function loadTasks(teamName: string): Promise<Task[]> {
  return invoke("cmd_load_tasks", { teamName });
}

export async function loadInbox(
  teamName: string,
  agentName: string
): Promise<InboxMessage[]> {
  return invoke("cmd_load_inbox", { teamName, agentName });
}

export async function sendInboxMessage(
  teamName: string,
  agentName: string,
  from: string,
  text: string,
  color?: string
): Promise<void> {
  return invoke("cmd_send_inbox_message", {
    teamName,
    agentName,
    from,
    text,
    color: color ?? null,
  });
}

export async function loadTodos(): Promise<TodoFile[]> {
  return invoke("cmd_load_todos");
}

export async function loadPlans(): Promise<PlanFile[]> {
  return invoke("cmd_load_plans");
}

export async function readPlan(filename: string): Promise<string> {
  return invoke("cmd_read_plan", { filename });
}

export async function savePlan(filename: string, content: string): Promise<void> {
  return invoke("cmd_save_plan", { filename, content });
}

export async function gitStatus(cwd: string): Promise<GitStatus> {
  return invoke("cmd_git_status", { cwd });
}

export async function gitDiff(
  cwd: string,
  path: string,
  staged: boolean
): Promise<DiffLine[]> {
  return invoke("cmd_git_diff", { cwd, path, staged });
}

export async function gitBranches(cwd: string): Promise<string[]> {
  return invoke("cmd_git_branches", { cwd });
}

export async function gitCurrentBranch(cwd: string): Promise<string> {
  return invoke("cmd_git_current_branch", { cwd });
}

// ---- Git Log Types ----

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
  refs: string[];
}

export async function gitLog(cwd: string, limit = 100): Promise<CommitInfo[]> {
  return invoke("cmd_git_log", { cwd, limit });
}

// ---- Remote Branch Types ----

export interface RemoteBranch {
  remote: string;
  branch: string;
  fullRef: string;
}

export async function gitRemoteBranches(cwd: string): Promise<RemoteBranch[]> {
  return invoke("cmd_git_remote_branches", { cwd });
}

export async function createWorktree(
  projectPath: string,
  branchName: string
): Promise<string> {
  return invoke<string>("cmd_create_worktree", { projectPath, branchName });
}

export function listWorktrees(projectPath: string): Promise<WorktreeInfo[]> {
  return invoke("cmd_list_worktrees", { projectPath });
}

export function getWorktreeCopy(projectPath: string): Promise<string[]> {
  return invoke("cmd_get_worktree_copy", { projectPath });
}

export function setWorktreeCopy(projectPath: string, entries: string[]): Promise<void> {
  return invoke("cmd_set_worktree_copy", { projectPath, entries });
}

// ─── PR / Issues Types ────────────────────────────────────────────────────────

export interface PullRequest {
  number: number;
  title: string;
  state: "open" | "closed" | "merged";
  author: string;
  url: string;
  created_at: string;
  body?: string;
  labels: string[];
  draft: boolean;
  head_ref: string;
}

export interface Issue {
  number: number;
  title: string;
  state: "open" | "closed";
  author: string;
  url: string;
  created_at: string;
  body?: string;
  labels: string[];
}

export function listPRs(cwd: string, state = "open"): Promise<PullRequest[]> {
  return invoke("cmd_list_prs", { cwd, state });
}

export function listIssues(cwd: string, state = "open"): Promise<Issue[]> {
  return invoke("cmd_list_issues", { cwd, state });
}

// ---- PTY / Terminal Wrappers ----

export function ptySpawn(sessionId: string, cwd: string): Promise<void> {
  return invoke("pty_spawn", { sessionId, cwd });
}

export function ptyWrite(sessionId: string, data: string): Promise<void> {
  return invoke("pty_write", { sessionId, data });
}

export function ptyKill(sessionId: string): Promise<void> {
  return invoke("pty_kill", { sessionId });
}

export function ptyList(): Promise<string[]> {
  return invoke("pty_list");
}

// ---- Hook / Session Tracking Types ----

export interface ActiveSubagent {
  agent_id: string;
  agent_type?: string;
  started_at?: string;
}

export interface ActiveSession {
  session_id: string;
  cwd?: string;
  started_at?: string;
  model?: string;
  is_active: boolean;
  subagents: ActiveSubagent[];
}

export interface HookEvent {
  hook_event_name: string;
  session_id: string;
  transcript_path?: string;
  cwd?: string;
  source?: string;
  model?: string;
  reason?: string;
  agent_id?: string;
  agent_type?: string;
  last_assistant_message?: string;
  stop_hook_active?: boolean;
}

export function setupHooks(): Promise<void> {
  return invoke("cmd_setup_hooks");
}

export function removeHooks(): Promise<void> {
  return invoke("cmd_remove_hooks");
}

export function getActiveSessions(): Promise<ActiveSession[]> {
  return invoke("cmd_get_active_sessions");
}

export function hooksConfigured(): Promise<boolean> {
  return invoke("cmd_hooks_configured");
}

// ---- Project Types ----

export interface Project {
  id: string;
  path: string;
  name: string;
  sessionCount: number;
  lastModified?: string;
  isWorktree?: boolean;
}

// ---- Project Invoke Wrappers ----

export function listProjects(): Promise<Project[]> {
  return invoke("cmd_list_projects");
}

export function pickFolder(): Promise<string | null> {
  return invoke("cmd_pick_folder");
}

export function deleteProject(id: string): Promise<void> {
  return invoke("cmd_delete_project", { id });
}

export function listOrphanedProjects(): Promise<Project[]> {
  return invoke("cmd_list_orphaned_projects");
}

export function readFile(path: string): Promise<string> {
  return invoke("cmd_read_file", { path });
}

export function runClaudeInit(projectPath: string): Promise<string> {
  return invoke("cmd_run_claude_init", { projectPath });
}

export function runReadmeGen(projectPath: string): Promise<string> {
  return invoke("cmd_run_readme_gen", { projectPath });
}

export function writeFile(path: string, content: string): Promise<void> {
  return invoke("cmd_write_file", { path, content });
}

// ---- File Browser Wrappers ----

export function listDir(path: string): Promise<FileEntry[]> {
  return invoke("cmd_list_dir", { path });
}

export function getHomeDir(): Promise<string> {
  return invoke("cmd_get_home_dir");
}
