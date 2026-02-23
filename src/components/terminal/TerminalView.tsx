import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "@/stores/settingsStore";
import "@xterm/xterm/css/xterm.css";

interface TerminalViewProps {
  sessionId: string;
  resumeSessionId?: string;
  cwd: string;
  isActive: boolean;
}

export function TerminalView({ sessionId, resumeSessionId, cwd, isActive }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const spawnedRef = useRef(false);
  const lastDimsRef = useRef({ rows: 24, cols: 80 });
  const fontSize = useSettingsStore((s) => s.fontSize);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const fontSizeRef = useRef(fontSize);
  const fontFamilyRef = useRef(fontFamily);

  // Update font settings live without killing the PTY
  useEffect(() => {
    fontSizeRef.current = fontSize;
    fontFamilyRef.current = fontFamily;
    if (termRef.current) {
      termRef.current.options.fontSize = fontSize;
      termRef.current.options.fontFamily = fontFamily;
      fitAddonRef.current?.fit();
    }
  }, [fontSize, fontFamily]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Guard against React strict mode double-invocation
    if (spawnedRef.current) return;
    spawnedRef.current = true;

    const term = new Terminal({
      theme: {
        background: "#0A0E14",
        foreground: "#E6EDF3",
        cursor: "#58A6FF",
        cursorAccent: "#0A0E14",
        selectionBackground: "rgba(88, 166, 255, 0.3)",
        black: "#1C2128",
        red: "#F85149",
        green: "#3FB950",
        yellow: "#D29922",
        blue: "#58A6FF",
        magenta: "#BC8CFF",
        cyan: "#39C5CF",
        white: "#E6EDF3",
        brightBlack: "#484F58",
        brightRed: "#F85149",
        brightGreen: "#3FB950",
        brightYellow: "#D29922",
        brightBlue: "#79C0FF",
        brightMagenta: "#D2A8FF",
        brightCyan: "#56D364",
        brightWhite: "#FFFFFF",
      },
      fontFamily: fontFamilyRef.current,
      fontSize: fontSizeRef.current,
      lineHeight: 1.4,
      letterSpacing: 0,
      cursorBlink: true,
      cursorStyle: "block",
      scrollback: 5000,
      allowTransparency: false,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(searchAddon);

    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Get actual terminal dimensions after fit
    const dims = fitAddon.proposeDimensions() ?? { rows: 24, cols: 80 };

    // Handle user input - send to PTY
    const dataDisposable = term.onData((data) => {
      invoke("pty_write", { sessionId, data }).catch(console.error);
    });

    // Spawn the Claude process with actual terminal dimensions
    invoke("pty_spawn", {
      sessionId,
      resumeSessionId: resumeSessionId ?? null,
      cwd,
      rows: dims.rows,
      cols: dims.cols,
    }).catch((e: unknown) => {
      term.writeln(`\x1b[31mFailed to start Claude: ${e}\x1b[0m`);
    });

    // Listen for terminal output
    const unlisten = listen<string>(`pty-data-${sessionId}`, (event) => {
      term.write(event.payload);
    });

    const unlistenExit = listen(`pty-exit-${sessionId}`, () => {
      term.writeln("\r\n\x1b[33m[Process exited]\x1b[0m");
    });

    // Resize observer: fit xterm then sync PTY size
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      const d = fitAddon.proposeDimensions();
      if (d) {
        lastDimsRef.current = { rows: d.rows, cols: d.cols };
        invoke("pty_resize", { sessionId, rows: d.rows, cols: d.cols }).catch(() => {});
      }
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      spawnedRef.current = false;
      unlisten.then((f) => f());
      unlistenExit.then((f) => f());
      resizeObserver.disconnect();
      dataDisposable.dispose();
      invoke("pty_kill", { sessionId }).catch(() => {});
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId, cwd]);

  // Focus terminal when tab becomes active
  useEffect(() => {
    if (isActive && termRef.current) {
      termRef.current.focus();
    }
  }, [isActive]);

  // When tab goes to background, periodically trigger a redraw by toggling the
  // PTY height by +1 row and immediately restoring it.
  // Rationale: Windows ConPTY (ResizePseudoConsole) only fires a
  // WINDOW_BUFFER_SIZE_EVENT into the child process's input queue when the size
  // *actually changes*. Sending the same dimensions repeatedly is a silent no-op,
  // so enquirer never redraws. Toggling forces two real resize events per cycle.
  useEffect(() => {
    if (isActive) return;
    const ping = () => {
      const { rows, cols } = lastDimsRef.current;
      invoke("pty_resize", { sessionId, rows: rows + 1, cols }).catch(() => {});
      setTimeout(() => {
        invoke("pty_resize", { sessionId, rows, cols }).catch(() => {});
      }, 100);
    };
    ping();
    const id = setInterval(ping, 5000);
    return () => clearInterval(id);
  }, [isActive, sessionId]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ backgroundColor: "#0A0E14" }}
    />
  );
}
