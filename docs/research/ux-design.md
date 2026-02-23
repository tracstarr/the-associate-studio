# Claude IDE - UX Design Specification

## Design Philosophy

Claude IDE is a lightweight Windows IDE where **Claude Code CLI is the centerpiece**. Every UI element exists to support, augment, or provide context to active Claude CLI sessions. The design draws from three key influences:

- **VS Code**: Activity bar + sidebar + editor + panel + status bar layout system; information density
- **Zed**: Minimal chrome, distraction-free aesthetic, speed-first feeling
- **JetBrains (Islands theme)**: Tool window docking system, clear visual separation between regions

### Core Principles

1. **Terminal is the hero** - The Claude CLI terminal gets the most screen real estate
2. **Information density without clutter** - Show a lot, but organized into clear visual zones
3. **Keyboard first** - Every action reachable without a mouse
4. **Context-aware reactivity** - All panels update when the active session changes
5. **Minimal chrome** - No toolbars, no unnecessary borders, no wasted pixels

---

## 1. Layout Wireframes

### Overall Layout Architecture

The layout follows a VS Code-inspired zone system with five regions:

```
+--+----+------------------------------------------+----------------+
|AB| SB |              MAIN AREA                   |   CONTEXT      |
|  |    |                                          |   PANEL        |
|  |    |                                          |   (Right)      |
|  |    |                                          |                |
|  |    |                                          |                |
|  |    |                                          |                |
|  |    |                                          |                |
|  |    |                                          |                |
|  |    |                                          |                |
|  |    +------------------------------------------+                |
|  |    |          BOTTOM PANEL (optional)          |                |
+--+----+------------------------------------------+----------------+
|                       STATUS BAR                                  |
+-------------------------------------------------------------------+
```

- **AB** = Activity Bar (36px wide, icon-only, left edge)
- **SB** = Sidebar (240px default, collapsible)
- **MAIN** = Primary content area (terminal, editors)
- **CONTEXT** = Right panel (320px default, collapsible)
- **BOTTOM** = Bottom panel (optional, for secondary info)
- **STATUS BAR** = Fixed bottom bar (24px)

### Configuration A: Default View (Sessions + Terminal + Context)

This is the primary working layout. Sessions on the left, Claude terminal center, context panel on the right.

```
+--+------------+------------------------------------------+-----------------+
|  | SESSIONS   |  Claude Session: my-project              |  CONTEXT PANEL  |
|  |            |  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~|                 |
|  | > my-proj  |  $ claude                                |  Plan           |
|S |   session1*|  > Fix the authentication bug in the     |  ~~~~~~~~~~~~   |
|E |   session2 |    login module                          |  1. [x] Read    |
|S |            |                                          |     auth.ts     |
|S | > api-svc  |  I'll fix the authentication bug.        |  2. [>] Fix     |
|I |   session3 |  Let me start by reading the relevant    |     validateJWT |
|O |   session4 |  files...                                |  3. [ ] Write   |
|N |            |                                          |     tests       |
|S | > docs     |  Tool: Read auth/login.ts                |                 |
|  |   session5 |  Tool: Read auth/jwt.ts                  |  Tool Calls     |
|  |            |  Tool: Edit auth/login.ts                |  ~~~~~~~~~~~~   |
|  |            |                                          |  Read auth/..   |
|  |            |  I've fixed the JWT validation logic.     |  Read auth/..   |
|  |            |  The issue was...                         |  Edit auth/..   |
|  |            |                                          |                 |
|  |            |                                          |  Thinking       |
|  |            |                                          |  ~~~~~~~~~~~~   |
|  |            |                                          |  "Analyzing the |
|  |            |                                          |   JWT flow..."  |
+--+------------+------------------------------------------+-----------------+
|  my-project | session1 | main | 3 agents running | 2 todos remaining       |
+-------------------------------------------------------------------------------+
```

### Configuration B: Team View (Sessions + Terminal + Teams/Agents)

For monitoring multi-agent teams. The right panel switches to the teams/agents view.

```
+--+------------+------------------------------------------+-----------------+
|  | SESSIONS   |  Claude Session: my-project              |  TEAMS & AGENTS |
|  |            |  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~|                 |
|  | > my-proj  |  $ claude                                |  Team: feature  |
|T |   session1*|  > Build the new dashboard feature       |  ~~~~~~~~~~~~~~|
|E |   session2 |                                          |                 |
|A |            |  I'll coordinate the team to build       |  lead           |
|M | > api-svc  |  this dashboard feature...               |   * Running     |
|S |   session3 |                                          |   "Coordinating"|
|  |   session4 |  SendMessage: frontend-dev               |                 |
|  |            |  "Build the React components for..."     |  frontend-dev   |
|  |            |                                          |   * Running     |
|  |            |  SendMessage: backend-dev                |   "Building     |
|  |            |  "Create the API endpoints for..."       |    components"  |
|  |            |                                          |                 |
|  |            |                                          |  backend-dev    |
|  |            |                                          |   * Idle        |
|  |            |                                          |   "Waiting..."  |
|  |            |                                          |                 |
|  |            |                                          |  tester         |
|  |            |                                          |   o Pending     |
|  |            |                                          |   "Not started" |
+--+------------+------------------------------------------+-----------------+
|  my-project | session1 | main | Team: feature (3/4 active)                  |
+-------------------------------------------------------------------------------+
```

### Configuration C: Git View (Sessions + Terminal + Git Diff)

For reviewing changes. The right panel shows git status and diff.

```
+--+------------+------------------------------------------+-----------------+
|  | SESSIONS   |  Claude Session: my-project              |  GIT            |
|  |            |  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~|                 |
|  | > my-proj  |  $ claude                                |  Branch: main   |
|G |   session1*|  > Review the changes and commit         |  +3 ~2 -1       |
|I |   session2 |                                          |                 |
|T |            |  Let me review the staged changes...     |  Staged (2)     |
|  | > api-svc  |                                          |  ~~~~~~~~~~~~~~|
|  |   session3 |  Tool: Bash git diff --staged            |  M auth/login.ts|
|  |   session4 |                                          |  A auth/test.ts |
|  |            |  The changes look good. I'll commit      |                 |
|  |            |  with a descriptive message.             |  Unstaged (1)   |
|  |            |                                          |  ~~~~~~~~~~~~~~|
|  |            |  Tool: Bash git commit -m "Fix JWT..."   |  M readme.md    |
|  |            |                                          |                 |
|  |            |                                          |  -- Diff View --|
|  |            |                                          |  auth/login.ts  |
|  |            |                                          |  @@ -42,7 +42  |
|  |            |                                          | -  if (!token)  |
|  |            |                                          | +  if (!token   |
|  |            |                                          | +    || expired) |
+--+------------+------------------------------------------+-----------------+
|  my-project | session1 | main +3~2-1 | committed 2m ago                     |
+-------------------------------------------------------------------------------+
```

### Configuration D: Full Terminal (Minimal Panels)

For focused terminal work. Sidebar collapsed, no right panel.

```
+--+------------------------------------------------------------------------+
|  |  Claude Session: my-project > session1                                 |
|  |  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ |
|  |  $ claude                                                              |
|S |  > Build the entire authentication system from scratch                 |
|  |                                                                        |
|  |  I'll build a complete authentication system. Let me start by          |
|  |  planning the architecture...                                          |
|  |                                                                        |
|  |  ## Plan                                                               |
|  |  1. Set up JWT token generation and validation                         |
|  |  2. Create middleware for route protection                             |
|  |  3. Implement login/register endpoints                                 |
|  |  4. Add refresh token rotation                                         |
|  |  5. Write comprehensive tests                                          |
|  |                                                                        |
|  |  Let me start with the JWT module...                                   |
|  |                                                                        |
|  |  Tool: Write src/auth/jwt.ts                                           |
|  |  Tool: Write src/auth/middleware.ts                                     |
|  |  Tool: Write src/auth/routes.ts                                        |
|  |  Tool: Write src/auth/refresh.ts                                       |
|  |  Tool: Bash npm test                                                   |
|  |                                                                        |
|  |  All tests passing. The authentication system is complete.             |
|  |                                                                        |
+--+------------------------------------------------------------------------+
|  my-project | session1 | main | 0 errors | Claude: idle                    |
+-------------------------------------------------------------------------------+
```

### Configuration E: Inbox + PR/Issues View

For communication and project management. Bottom panel shows inbox, right panel shows PR/issues.

```
+--+------------+------------------------------------------+-----------------+
|  | SESSIONS   |  Claude Session: my-project              |  PR / ISSUES    |
|  |            |  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~|                 |
|  | > my-proj  |  $ claude                                |  Open PRs (3)   |
|I |   session1*|  > Review PR #42 and fix the issues      |  ~~~~~~~~~~~~~~|
|N |   session2 |                                          |  #42 Fix auth   |
|B |            |  I'll review PR #42...                   |    * 2 comments |
|O | > api-svc  |                                          |    * CI passing |
|X |   session3 |  Tool: Bash gh pr view 42                |  #41 Add cache  |
|  |            |                                          |    * Review req |
|  |            |  The PR has 2 review comments...          |  #39 Update dep |
|  |            |                                          |                 |
|  |            +------------------------------------------+  Issues (5)     |
|  |            |  INBOX                                   |  ~~~~~~~~~~~~~~|
|  |            |  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~|  #101 Login bug |
|  |            |  frontend-dev (2m ago)                    |    P1 - Open    |
|  |            |    "Components ready for review"          |  #98 Perf issue |
|  |            |  backend-dev (5m ago)                     |    P2 - Open    |
|  |            |    "API endpoints deployed to staging"    |                 |
|  |            |  tester (8m ago)                          |                 |
|  |            |    "Found edge case in token refresh"     |                 |
+--+------------+------------------------------------------+-----------------+
|  my-project | session1 | main | 3 unread messages | PR #42 active           |
+-------------------------------------------------------------------------------+
```

---

## 2. Component Hierarchy

### Top-Level Application Shell

```
<App>
  <TauriWindowFrame />           -- Custom titlebar for Tauri frameless window
  <WorkbenchLayout>              -- Main grid layout manager
    <ActivityBar />              -- Left icon strip (36px)
    <Sidebar />                  -- Collapsible left panel (240px default)
    <MainArea>                   -- Central content region
      <TabBar />                 -- Session/file tabs at top of main area
      <ContentArea />            -- Terminal or editor content
      <BottomPanel />            -- Optional bottom panel (inbox, output)
    </MainArea>
    <RightPanel />               -- Collapsible right panel (320px default)
    <StatusBar />                -- Fixed bottom bar (24px)
  </WorkbenchLayout>
  <CommandPalette />             -- Overlay, triggered by Ctrl+P
  <NotificationStack />          -- Toast notifications (bottom-right)
</App>
```

### Component Details

#### TauriWindowFrame
- Custom window titlebar with minimize/maximize/close buttons
- Draggable region for window movement
- Displays application title and active project name
- Props: `title: string`, `projectName: string`

#### ActivityBar
- Vertical icon strip on the far left
- Each icon switches the sidebar view
- Icons: Sessions, Teams, Inbox, Git, PRs, Search, Settings
- Active icon highlighted with accent color left border
- Props: `items: ActivityBarItem[]`, `activeItem: string`, `onItemClick: (id) => void`

```typescript
interface ActivityBarItem {
  id: string;           // 'sessions' | 'teams' | 'inbox' | 'git' | 'prs' | 'search' | 'settings'
  icon: IconName;
  label: string;        // Tooltip text
  badge?: number;        // Notification count badge
  badgeType?: 'info' | 'warning' | 'error';
}
```

#### Sidebar
- Hosts different views based on ActivityBar selection
- Resizable width with drag handle
- Collapsible with Ctrl+B
- Props: `activeView: string`, `width: number`, `collapsed: boolean`

##### SessionsPanel (Sidebar View)
- Tree view of sessions grouped by project
- Each project is a collapsible group
- Sessions show: name, status indicator, brief activity summary
- Right-click context menu for session actions
- Props: `projects: Project[]`, `activeSessionId: string`, `onSessionSelect: (id) => void`

```typescript
interface Project {
  id: string;
  name: string;
  path: string;
  sessions: Session[];
}

interface Session {
  id: string;
  name: string;
  status: 'running' | 'idle' | 'completed' | 'error';
  lastActivity: string;  // Brief text summary
  timestamp: Date;
  isTeamLead?: boolean;
  agentCount?: number;
}
```

##### TeamsPanel (Sidebar View)
- Displays all active teams and their agents
- Expandable team nodes with agent details
- Agent status with live activity text
- Props: `teams: Team[]`, `onAgentSelect: (agentId) => void`

```typescript
interface Team {
  id: string;
  name: string;
  sessionId: string;
  agents: Agent[];
}

interface Agent {
  id: string;
  name: string;
  role: string;
  status: 'running' | 'idle' | 'completed' | 'error' | 'pending';
  currentActivity: string;
  taskCount: number;
  completedTasks: number;
}
```

##### InboxPanel (Sidebar View)
- List of agent messages with sender, timestamp, preview
- Unread indicator (bold text, dot)
- Click to expand full message in bottom panel
- Compose button at top
- Props: `messages: InboxMessage[]`, `unreadCount: number`, `onMessageSelect: (id) => void`

```typescript
interface InboxMessage {
  id: string;
  sender: string;
  senderRole: string;
  timestamp: Date;
  preview: string;
  body: string;
  isRead: boolean;
  teamId: string;
}
```

##### GitPanel (Sidebar View)
- Branch name with switch button
- Staged/unstaged file lists
- Click file to show diff in right panel
- Stage/unstage buttons per file and bulk
- Commit message input with commit button
- Props: `branch: string`, `staged: GitFile[]`, `unstaged: GitFile[]`, `onFileSelect: (path) => void`

```typescript
interface GitFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked';
  additions: number;
  deletions: number;
}
```

##### PRIssuesPanel (Sidebar View)
- Tabs: Pull Requests | Issues
- Filterable list with status icons
- PR items show: number, title, status, CI status, review status
- Issue items show: number, title, priority, labels
- Props: `pullRequests: PR[]`, `issues: Issue[]`, `activeTab: 'prs' | 'issues'`

```typescript
interface PR {
  number: number;
  title: string;
  status: 'open' | 'merged' | 'closed' | 'draft';
  ciStatus: 'passing' | 'failing' | 'pending' | 'none';
  reviewStatus: 'approved' | 'changes_requested' | 'pending' | 'none';
  author: string;
  updatedAt: Date;
  commentCount: number;
}

interface Issue {
  number: number;
  title: string;
  status: 'open' | 'closed';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  labels: string[];
  assignee: string;
  updatedAt: Date;
}
```

#### MainArea

##### TabBar
- Horizontal tabs for open sessions/files
- Active tab highlighted
- Close button on hover
- Drag to reorder
- Overflow scroll with arrow buttons
- Props: `tabs: Tab[]`, `activeTabId: string`, `onTabSelect: (id) => void`, `onTabClose: (id) => void`

```typescript
interface Tab {
  id: string;
  label: string;
  icon?: IconName;
  isDirty?: boolean;     // Unsaved indicator dot
  isPinned?: boolean;
  sessionId?: string;
}
```

##### TerminalView (ContentArea)
- Full xterm.js terminal instance
- Renders Claude CLI session output
- Handles input forwarding to pty
- Supports selection, copy/paste, scrollback
- Links clickable (file paths open in editor)
- Props: `sessionId: string`, `ptyId: string`, `fontSize: number`, `fontFamily: string`

##### EditorView (ContentArea)
- Monaco or CodeMirror instance for file viewing/editing
- Used when opening files from tool calls or git diffs
- Syntax highlighting, line numbers
- Read-only by default (Claude does the editing)
- Props: `filePath: string`, `content: string`, `language: string`, `readOnly: boolean`

##### BottomPanel
- Collapsible panel below the main content area
- Hosts: Inbox Viewer, Output Log, Problems
- Tab strip at top of bottom panel
- Props: `activeTab: string`, `height: number`, `collapsed: boolean`

###### InboxViewer (BottomPanel Tab)
- Full message view with compose capability
- Message thread display
- Compose area with recipient selector and send button
- Props: `selectedMessage: InboxMessage | null`, `onCompose: (msg) => void`

###### OutputLog (BottomPanel Tab)
- Raw log stream from Claude sessions
- Filterable by session, log level
- Auto-scroll with pause on manual scroll
- Props: `entries: LogEntry[]`, `filter: LogFilter`

#### RightPanel (Context Panel)
- Collapsible panel on the right side
- Content changes based on activity bar selection and context
- Default: Claude Context Panel
- Props: `activeView: string`, `width: number`, `collapsed: boolean`

##### ContextPanel (RightPanel View)
- Shows current plan/todos from active Claude session
- Recent tool calls with status
- Thinking/reasoning steps
- Auto-updates as Claude works
- Props: `plan: PlanItem[]`, `toolCalls: ToolCall[]`, `thinking: ThinkingStep[]`

```typescript
interface PlanItem {
  id: string;
  text: string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface ToolCall {
  id: string;
  tool: string;          // 'Read', 'Edit', 'Bash', 'Write', etc.
  args: string;          // Brief summary of arguments
  status: 'running' | 'completed' | 'error';
  timestamp: Date;
  duration?: number;     // milliseconds
}

interface ThinkingStep {
  id: string;
  content: string;
  timestamp: Date;
}
```

##### DiffPanel (RightPanel View)
- Inline diff viewer for git changes
- Red/green highlighting for removals/additions
- File header with path and stats
- Navigate between hunks
- Props: `filePath: string`, `diff: DiffHunk[]`, `viewMode: 'inline' | 'split'`

##### AgentDetailPanel (RightPanel View)
- Detailed view of selected agent
- Current task, progress, recent actions
- Message history for this agent
- Props: `agent: Agent`, `tasks: Task[]`, `messages: InboxMessage[]`

##### PRDetailPanel (RightPanel View)
- PR description, comments, review status
- CI check details
- File change list
- Props: `pr: PRDetail`

#### StatusBar
- Fixed bar at bottom of window
- Left side: workspace-scoped info
- Right side: session-scoped info
- Clickable items for quick actions
- Props: `items: StatusBarItem[]`

```typescript
interface StatusBarItem {
  id: string;
  text: string;
  icon?: IconName;
  tooltip: string;
  position: 'left' | 'right';
  priority: number;       // Higher = further from edge
  onClick?: () => void;
  color?: string;          // Semantic color for status
}
```

#### CommandPalette
- Modal overlay triggered by Ctrl+P
- Fuzzy search input at top
- Categorized results list below
- Recent commands shown by default
- Mode prefixes: `>` for commands, `@` for sessions, `#` for agents, `:` for line number
- Props: `isOpen: boolean`, `onClose: () => void`, `onExecute: (command) => void`

#### NotificationStack
- Toast notifications in bottom-right corner
- Auto-dismiss after 5s (configurable)
- Click to expand or navigate
- Types: info, success, warning, error
- Props: `notifications: Notification[]`

---

## 3. Complete Keybinding Scheme

### Design Principles for Keybindings

- Follow VS Code conventions where possible (users already know them)
- Ctrl+number keys reserved for panel switching (like VS Code's Ctrl+1-9 for editor groups)
- Alt+key combinations for secondary actions
- Escape always closes/cancels overlays
- All shortcuts shown in command palette and tooltips

### Global Navigation

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+P` | Command Palette | Open command palette (fuzzy search everything) |
| `Ctrl+Shift+P` | Command Mode | Open command palette in command mode (prefilled `>`) |
| `Ctrl+B` | Toggle Sidebar | Show/hide the left sidebar |
| `Ctrl+Shift+B` | Toggle Right Panel | Show/hide the right context panel |
| `Ctrl+J` | Toggle Bottom Panel | Show/hide the bottom panel |
| `Ctrl+\`` | Focus Terminal | Focus the main terminal area |
| `F11` | Toggle Fullscreen | Enter/exit fullscreen mode |
| `Ctrl+Shift+F` | Toggle Full Terminal | Hide all panels, maximize terminal |
| `Ctrl+,` | Settings | Open settings panel |
| `Ctrl+K Ctrl+S` | Keyboard Shortcuts | Open keyboard shortcuts reference |

### Activity Bar / Panel Switching

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+1` | Sessions Panel | Switch sidebar to sessions view |
| `Ctrl+2` | Teams Panel | Switch sidebar to teams/agents view |
| `Ctrl+3` | Inbox Panel | Switch sidebar to inbox view |
| `Ctrl+4` | Git Panel | Switch sidebar to git view |
| `Ctrl+5` | PR/Issues Panel | Switch sidebar to PR/issues view |
| `Ctrl+6` | Search Panel | Switch sidebar to search view |
| `Ctrl+7` | Context Panel | Toggle right panel to context view |
| `Ctrl+8` | Diff Panel | Toggle right panel to diff view |
| `Ctrl+9` | Agent Detail | Toggle right panel to agent detail |

### Session Navigation

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+Tab` | Next Session Tab | Switch to next session tab |
| `Ctrl+Shift+Tab` | Previous Session Tab | Switch to previous session tab |
| `Ctrl+W` | Close Session Tab | Close the active session tab |
| `Ctrl+Shift+T` | Reopen Session | Reopen last closed session tab |
| `Alt+1..9` | Jump to Tab N | Switch to Nth session tab directly |
| `Ctrl+N` | New Session | Create a new Claude CLI session |
| `Ctrl+Shift+N` | New Session (Project)| New session with project picker |
| `Ctrl+K Ctrl+Up` | Previous Session | Select previous session in tree |
| `Ctrl+K Ctrl+Down`| Next Session | Select next session in tree |

### Panel Focus Navigation

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+0` | Focus Activity Bar | Move focus to activity bar |
| `Ctrl+Shift+E` | Focus Sidebar | Move focus to sidebar content |
| `Ctrl+\`` | Focus Terminal | Move focus to terminal |
| `Ctrl+Shift+\`` | Focus Right Panel | Move focus to right panel |
| `Ctrl+Shift+J` | Focus Bottom Panel | Move focus to bottom panel |
| `Alt+Left` | Focus Previous Zone | Cycle focus to previous panel zone |
| `Alt+Right` | Focus Next Zone | Cycle focus to next panel zone |
| `Escape` | Focus Terminal | Return focus to terminal from any panel |

### Terminal Actions

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+Shift+C` | Copy Selection | Copy selected terminal text |
| `Ctrl+Shift+V` | Paste | Paste into terminal |
| `Ctrl+Shift+A` | Select All | Select all terminal content |
| `Ctrl+L` | Clear Terminal | Clear the terminal screen |
| `Ctrl+Shift+Up` | Scroll Up (Page) | Scroll terminal output up one page |
| `Ctrl+Shift+Down`| Scroll Down (Page)| Scroll terminal output down one page |
| `Ctrl+Home` | Scroll to Top | Scroll to beginning of terminal output |
| `Ctrl+End` | Scroll to Bottom | Scroll to end of terminal output |
| `Ctrl+F` | Find in Terminal | Open terminal search bar |
| `Ctrl+Shift+F` | Find in All Sessions| Search across all session outputs |
| `Ctrl+K Ctrl+C` | Cancel/Interrupt | Send Ctrl+C to active session |
| `Ctrl+K Ctrl+K` | Kill Session | Terminate the active CLI session |

### Inbox / Messaging

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+Shift+I` | Open Inbox | Switch to inbox panel and focus it |
| `Ctrl+Shift+M` | Compose Message | Open compose new message |
| `Ctrl+Enter` | Send Message | Send the composed message |
| `J` / `K` | Navigate Messages | Next/previous message (when inbox focused) |
| `Enter` | Open Message | Open selected message in detail view |
| `R` | Reply | Quick reply to selected message |
| `U` | Toggle Read/Unread | Mark message as read/unread |
| `D` | Dismiss | Dismiss/archive message |
| `Escape` | Close Compose | Close compose area |

### Git Actions

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+Shift+G` | Open Git Panel | Switch sidebar to git view |
| `Ctrl+Enter` | Commit | Commit staged changes (when in git panel) |
| `S` | Stage File | Stage selected file (when git panel focused) |
| `U` | Unstage File | Unstage selected file (when git panel focused) |
| `D` | View Diff | Open diff for selected file |
| `X` | Discard Changes | Discard changes to selected file (with confirm) |
| `[` / `]` | Previous/Next Hunk | Navigate between diff hunks |
| `Ctrl+K Ctrl+D` | Toggle Diff View | Switch between inline and split diff |
| `Alt+Up/Down` | Navigate Files | Move between files in git status list |

### PR / Issues

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+Shift+R` | Open PRs Panel | Switch to PR/issues view |
| `Enter` | Open PR/Issue | Open selected item in detail panel |
| `O` | Open in Browser | Open selected PR/issue in GitHub |
| `C` | Comment | Add comment to selected PR/issue |
| `F` | Filter | Focus filter input |
| `Tab` | Switch PR/Issues | Toggle between PR and Issues tabs |
| `J` / `K` | Navigate Items | Next/previous item in list |
| `Ctrl+Shift+O` | Create PR | Trigger PR creation flow |

### Command Palette Modes

| Prefix | Mode | Description |
|--------|------|-------------|
| (none) | Fuzzy Search | Search everything (sessions, commands, files) |
| `>` | Commands | Filter to executable commands only |
| `@` | Sessions | Filter to sessions and projects |
| `#` | Agents | Filter to team agents |
| `:` | Line Jump | Jump to line number in current file/diff |
| `?` | Help | Show command palette mode help |

---

## 4. Color System & Theme

### Dark Theme Base Palette

The color system uses a neutral blue-grey base with semantic accent colors. Inspired by VS Code Dark+ and Zed's One Dark, but with warmer greys to reduce eye strain.

#### Background Layers (Darkest to Lightest)

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-base` | `#0D1117` | Application background, behind everything |
| `bg-surface` | `#161B22` | Panel backgrounds, sidebar, bottom panel |
| `bg-raised` | `#1C2128` | Cards, dropdowns, command palette background |
| `bg-overlay` | `#21262D` | Tooltips, hover states, modal overlays |
| `bg-input` | `#0D1117` | Input field backgrounds |
| `bg-terminal` | `#0A0E14` | Terminal background (slightly darker for focus) |

#### Border Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `border-default` | `#30363D` | Panel borders, separators |
| `border-muted` | `#21262D` | Subtle borders, inactive states |
| `border-focus` | `#58A6FF` | Focus ring, active input borders |

#### Text Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `text-primary` | `#E6EDF3` | Primary text, headings, terminal text |
| `text-secondary` | `#8B949E` | Secondary text, labels, timestamps |
| `text-muted` | `#484F58` | Disabled text, placeholder text |
| `text-link` | `#58A6FF` | Clickable links |
| `text-inverse` | `#0D1117` | Text on colored backgrounds |

#### Accent / Brand Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `accent-primary` | `#58A6FF` | Primary accent (links, active icons, focus) |
| `accent-secondary` | `#BC8CFF` | Secondary accent (Claude-related highlights) |
| `accent-tertiary` | `#79C0FF` | Tertiary accent (info badges) |

#### Semantic Status Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `status-success` | `#3FB950` | Success, passing, completed, running |
| `status-error` | `#F85149` | Error, failing, critical |
| `status-warning` | `#D29922` | Warning, pending, attention needed |
| `status-info` | `#58A6FF` | Informational, neutral status |

#### Agent Status Colors

| Status | Color | Token |
|--------|-------|-------|
| Running | `#3FB950` (green) | `agent-running` |
| Idle | `#D29922` (amber) | `agent-idle` |
| Completed | `#8B949E` (grey) | `agent-completed` |
| Error | `#F85149` (red) | `agent-error` |
| Pending | `#484F58` (dim grey) | `agent-pending` |

#### Session Status Colors

| Status | Color | Token |
|--------|-------|-------|
| Active/Running | `#3FB950` (green dot) | `session-running` |
| Idle | `#D29922` (amber dot) | `session-idle` |
| Completed | `#8B949E` (grey dot) | `session-completed` |
| Error | `#F85149` (red dot) | `session-error` |

#### Git Diff Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `diff-added-bg` | `#12261E` | Added line background |
| `diff-added-text` | `#3FB950` | Added line gutter indicator |
| `diff-added-highlight` | `#1B4332` | Added word-level highlight |
| `diff-removed-bg` | `#2D1215` | Removed line background |
| `diff-removed-text` | `#F85149` | Removed line gutter indicator |
| `diff-removed-highlight` | `#5C1D24` | Removed word-level highlight |
| `diff-modified-bg` | `#2A1F0B` | Modified line background |
| `diff-modified-text` | `#D29922` | Modified line gutter indicator |
| `diff-hunk-header` | `#1C2128` | Hunk header background |
| `diff-hunk-text` | `#BC8CFF` | Hunk header text (@@ lines) |

#### Activity Bar Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `actbar-bg` | `#0D1117` | Activity bar background |
| `actbar-icon-default` | `#484F58` | Inactive icon color |
| `actbar-icon-active` | `#E6EDF3` | Active icon color |
| `actbar-indicator` | `#58A6FF` | Active indicator bar (left edge) |
| `actbar-badge` | `#F85149` | Notification badge background |

#### Tool Call Colors

| Tool | Color | Usage |
|------|-------|-------|
| Read | `#58A6FF` (blue) | File read operations |
| Edit | `#D29922` (amber) | File edit operations |
| Write | `#3FB950` (green) | File creation operations |
| Bash | `#BC8CFF` (purple) | Shell command execution |
| Search/Grep | `#79C0FF` (light blue) | Search operations |
| WebFetch | `#F0883E` (orange) | Web fetch operations |

### Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Terminal text | `Cascadia Code, JetBrains Mono, Fira Code, monospace` | 14px | 400 |
| UI text | `Inter, -apple-system, system-ui, sans-serif` | 13px | 400 |
| UI headings | `Inter` | 13px | 600 |
| Status bar | `Inter` | 12px | 400 |
| Sidebar labels | `Inter` | 13px | 400 |
| Badges | `Inter` | 11px | 600 |
| Code in panels | `Cascadia Code, JetBrains Mono, monospace` | 12px | 400 |

---

## 5. Status Bar Design

The status bar is 24px tall, with a `bg-surface` background and `border-default` top border. Items are separated into left (workspace-scoped) and right (session-scoped) groups.

### Layout

```
+-----------------------------------------------------------------------+
| [icon] project-name | session-name | branch +3~2-1 | 3 agents | ... | ... | 2 todos | Claude: running | Ln 42 |
+-----------------------------------------------------------------------+
  <-- LEFT (workspace scope) ------->                   <-- RIGHT (session scope) -->
```

### Left Side Items (Workspace Scope)

| Item | Icon | Example | Click Action | Priority |
|------|------|---------|-------------|----------|
| Project | folder icon | `my-project` | Open project picker | 1 |
| Session | terminal icon | `session1` | Open session picker | 2 |
| Git Branch | branch icon | `main` | Switch branch | 3 |
| Git Changes | delta icon | `+3 ~2 -1` | Open git panel | 4 |
| Team Status | people icon | `3 agents running` | Open teams panel | 5 |
| Unread Messages | mail icon | `2 unread` | Open inbox | 6 |

### Right Side Items (Session Scope)

| Item | Icon | Example | Click Action | Priority |
|------|------|---------|-------------|----------|
| Todos | checkbox icon | `2 todos` | Open context panel | 1 |
| Claude Status | circle icon | `Claude: running` | Show activity detail | 2 |
| Errors/Warnings | warning icon | `0 errors` | Open problems panel | 3 |
| Active Tool | tool icon | `Edit: auth.ts` | Show tool call detail | 4 |

### Status Bar Behaviors

- **Claude Status** uses semantic colors: green dot for running, amber for idle, grey for completed
- **Git Changes** colored: green for additions, amber for modifications, red for deletions
- **Unread Messages** shows red badge when count > 0
- **Errors** shows red icon/text when errors > 0
- Items truncate gracefully when window is narrow
- Hovering any item shows a tooltip with more detail
- Status bar background changes to `status-error` red when a session has a critical error

---

## 6. Command Palette Design

### Appearance

The command palette is a modal overlay centered horizontally, positioned at the top 20% of the window. It has a width of 600px max (or 50% of window width, whichever is smaller).

```
+------------------------------------------------------+
| > search query here...                           [x] |
+------------------------------------------------------+
| RECENT                                               |
|   > Terminal: Clear                      Ctrl+L      |
|   @ my-project > session1                Alt+1       |
|   > Git: Commit                          Ctrl+Enter  |
+------------------------------------------------------+
| COMMANDS                                             |
|   > Terminal: New Session                Ctrl+N      |
|   > Terminal: Split Horizontal                       |
|   > View: Toggle Sidebar                Ctrl+B      |
+------------------------------------------------------+
```

### Visual Design

- Background: `bg-raised` with `border-default` border and 8px border-radius
- Shadow: `0 8px 30px rgba(0, 0, 0, 0.5)` for elevated feel
- Backdrop: semi-transparent `bg-base` overlay behind palette
- Input: 44px height, 16px font, `text-primary` color, no visible border
- Results: 32px row height, `text-primary` for name, `text-secondary` for shortcut
- Selected row: `bg-overlay` background highlight
- Category headers: `text-muted`, 11px uppercase, 8px top margin
- Matched characters in results highlighted with `accent-primary` color

### Mode Prefixes

| Prefix | Mode | Example Input | Results |
|--------|------|---------------|---------|
| (none) | Everything | `auth` | Sessions, files, commands matching "auth" |
| `>` | Commands | `>toggle` | All commands matching "toggle" |
| `@` | Sessions | `@api` | Sessions and projects matching "api" |
| `#` | Agents | `#front` | Team agents matching "front" |
| `:` | Line Jump | `:42` | Jump to line 42 in current view |
| `?` | Help | `?` | Show all available modes and tips |

### Search Behavior

- **Fuzzy matching**: Characters can be non-contiguous (`tsb` matches "Toggle Side Bar")
- **Ranking**: Exact match > prefix match > fuzzy match. Recent items boosted.
- **Grouping**: Results grouped by category (Recent, Sessions, Commands, Agents, Files)
- **Max results**: 12 visible at once, scrollable
- **Debounce**: 50ms debounce on input for smooth performance

### Example Commands

#### Session Commands
| Command | Description |
|---------|-------------|
| `Session: New` | Create a new Claude CLI session |
| `Session: New in Project` | Create session with project picker |
| `Session: Close` | Close the active session |
| `Session: Close All` | Close all sessions |
| `Session: Rename` | Rename the active session |
| `Session: Restart` | Restart the active Claude session |
| `Session: Duplicate` | Duplicate session configuration |

#### View Commands
| Command | Description |
|---------|-------------|
| `View: Toggle Sidebar` | Show/hide left sidebar |
| `View: Toggle Right Panel` | Show/hide right panel |
| `View: Toggle Bottom Panel` | Show/hide bottom panel |
| `View: Toggle Full Terminal` | Maximize terminal, hide panels |
| `View: Focus Terminal` | Move focus to terminal |
| `View: Focus Sidebar` | Move focus to sidebar |
| `View: Zoom In` | Increase UI zoom |
| `View: Zoom Out` | Decrease UI zoom |
| `View: Reset Zoom` | Reset to default zoom |

#### Git Commands
| Command | Description |
|---------|-------------|
| `Git: Stage All` | Stage all changed files |
| `Git: Unstage All` | Unstage all staged files |
| `Git: Commit` | Open commit dialog |
| `Git: Pull` | Pull from remote |
| `Git: Push` | Push to remote |
| `Git: Switch Branch` | Open branch picker |
| `Git: Create Branch` | Create new branch |
| `Git: View Stash` | View stashed changes |

#### Team Commands
| Command | Description |
|---------|-------------|
| `Team: View All` | Open teams panel |
| `Team: Message Agent` | Open compose to specific agent |
| `Team: Broadcast` | Send message to all agents |
| `Team: View Tasks` | Show task list for active team |
| `Team: Stop Agent` | Send shutdown request to agent |

#### Inbox Commands
| Command | Description |
|---------|-------------|
| `Inbox: Open` | Open inbox panel |
| `Inbox: Compose` | Open new message compose |
| `Inbox: Mark All Read` | Mark all messages as read |
| `Inbox: Filter Unread` | Show only unread messages |

#### PR/Issue Commands
| Command | Description |
|---------|-------------|
| `PR: List Open` | Show open pull requests |
| `PR: Create` | Start PR creation flow |
| `PR: Checkout` | Checkout a PR branch |
| `Issue: List Open` | Show open issues |
| `Issue: Create` | Start issue creation flow |

#### Settings Commands
| Command | Description |
|---------|-------------|
| `Settings: Open` | Open settings panel |
| `Settings: Theme` | Switch color theme |
| `Settings: Font Size` | Change terminal font size |
| `Settings: Keyboard Shortcuts` | View/edit keybindings |

---

## 7. Interaction Patterns

### Panel Resizing

- All panel borders are draggable resize handles (4px hit target, cursor changes to resize)
- Double-click a resize handle to reset to default width/height
- Minimum widths: Sidebar 160px, Right Panel 200px, Bottom Panel 100px
- Panels snap to closed when dragged below minimum
- Resize state persisted to localStorage per layout

### Session Switching

When a user clicks a different session in the sessions panel or switches via keyboard:

1. Terminal view switches to that session's pty
2. Right context panel updates with that session's plan, tool calls, thinking
3. Git panel updates to that session's project repository
4. Status bar updates all session-scoped items
5. Animation: 100ms cross-fade transition

### Tool Call Display in Context Panel

Tool calls appear as compact rows with:

```
[icon] [tool-name] [brief-args]           [status] [duration]

Example:
  Read   auth/login.ts                     done     120ms
  Edit   auth/login.ts L42-48              done     340ms
  Bash   npm test                          running   2.1s
  Write  src/auth/new-module.ts            done     80ms
```

- Icon colored by tool type (see Tool Call Colors)
- Status shown as: spinning dot (running), checkmark (done), X (error)
- Click to expand and show full arguments and output
- Most recent at top, scrollable history

### Notification Patterns

- **Toast**: Brief, auto-dismissing (5s). For: session completed, message received, commit success
- **Inline**: Within panel content. For: errors in git panel, validation warnings
- **Badge**: Count on activity bar icons. For: unread messages, pending reviews
- **Status bar flash**: Brief color pulse. For: Claude status change, error occurrence

### Empty States

When panels have no content, show helpful empty states:

- **Sessions Panel (empty)**: "No active sessions. Press Ctrl+N to start a new Claude session."
- **Inbox (empty)**: "No messages yet. Messages from team agents will appear here."
- **Git Panel (no repo)**: "No git repository detected in the current project."
- **Teams (no teams)**: "No active teams. Start a team session to see agents here."
- **Context Panel (no session)**: "Select a session to see its plan and activity."

---

## 8. Responsive Behavior

### Window Size Breakpoints

| Width | Behavior |
|-------|----------|
| < 800px | Sidebar and right panel auto-collapse, only terminal visible |
| 800-1200px | Sidebar visible, right panel collapsed by default |
| 1200-1600px | Full default layout (sidebar + terminal + right panel) |
| > 1600px | Additional space given to terminal, panels stay at default |

### Panel Priority (narrow windows)

When space is constrained, panels collapse in this order:
1. Bottom panel collapses first
2. Right panel collapses second
3. Sidebar collapses third
4. Terminal always visible (minimum 400px width)

---

## 9. Accessibility

- All interactive elements have visible focus indicators (`border-focus` ring)
- ARIA labels on all panels, buttons, and interactive elements
- Screen reader announcements for: session switches, new messages, status changes
- High contrast mode support (increased border visibility, bolder text colors)
- Minimum touch/click target: 32px (activity bar icons, tree items, buttons)
- Tab order follows visual layout: Activity Bar > Sidebar > Main > Right Panel > Status Bar
- Reduced motion preference respected (disable transitions)

---

## Research Sources

This design specification was informed by analysis of the following:

- [VS Code Custom Layout documentation](https://code.visualstudio.com/docs/configure/custom-layout) for the activity bar, sidebar, editor, and panel layout system
- [VS Code UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/overview) for status bar patterns and extension UI patterns
- [VS Code User Interface overview](https://code.visualstudio.com/docs/getstarted/userinterface) for workbench regions and layout structure
- [Zed editor UI discussions](https://github.com/zed-industries/zed/discussions/13103) for minimal aesthetic approach and GPU-rendered UI philosophy
- [Zed Appearance documentation](https://zed.dev/docs/appearance) for theme and visual customization patterns
- [JetBrains Islands Theme announcement](https://blog.jetbrains.com/platform/2025/12/meet-the-islands-theme-the-new-default-look-for-jetbrains-ides/) for clean layout with rounded corners and visual separation
- [IntelliJ Tool Windows documentation](https://www.jetbrains.com/help/idea/tool-windows.html) for tool window docking, viewing modes, and layout saving
- [IntelliJ Tool Window Layouts](https://www.jetbrains.com/help/idea/tool-window-layouts.html) for widescreen and side-by-side layout patterns
- [Designing Command Palettes](https://solomon.io/designing-command-palettes/) for fuzzy search UX and mode-prefix patterns
- [VS Code Source Control](https://code.visualstudio.com/docs/sourcecontrol/overview) for git diff UI patterns (inline vs side-by-side)
- [VS Code Status Bar API](https://code.visualstudio.com/api/ux-guidelines/status-bar) for status bar information architecture (left=workspace, right=file scope)
- [Semantic color design patterns](https://imperavi.com/blog/designing-semantic-colors-for-your-system/) for status indicators and dark theme color strategies
- [Microsoft Fluent 2 Color System](https://fluent2.microsoft.design/color) for token-based color architecture
- [xterm.js documentation](https://xtermjs.org/) and [xterm-react](https://github.com/PabloLION/xterm-react/) for terminal integration patterns
