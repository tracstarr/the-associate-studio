import { useEffect, useRef, useState, useMemo } from "react";
import { Command } from "cmdk";
import { useUIStore } from "@/stores/uiStore";
import { buildCommands, type Command as IDECommand } from "@/lib/commands";

export function CommandPalette() {
  const { commandPaletteOpen, closeCommandPalette } = useUIStore();
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo(() => buildCommands(), []);

  // Group commands by category
  const categories = useMemo(() => {
    const filtered = search
      ? commands.filter(
          (c) =>
            c.label.toLowerCase().includes(search.toLowerCase()) ||
            c.category.toLowerCase().includes(search.toLowerCase()) ||
            c.description?.toLowerCase().includes(search.toLowerCase()),
        )
      : commands;

    const groups: Record<string, IDECommand[]> = {};
    for (const cmd of filtered) {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push(cmd);
    }
    return groups;
  }, [commands, search]);

  useEffect(() => {
    if (commandPaletteOpen) {
      setSearch("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  const handleSelect = (cmd: IDECommand) => {
    cmd.action();
    closeCommandPalette();
    setSearch("");
  };

  if (!commandPaletteOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeCommandPalette();
      }}
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}
    >
      <Command
        className="w-[600px] max-h-[480px] bg-bg-overlay border border-border-default rounded-lg shadow-2xl overflow-hidden flex flex-col"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            closeCommandPalette();
            setSearch("");
          }
        }}
        shouldFilter={false}
      >
        <div className="flex items-center border-b border-border-default px-3 shrink-0">
          <span className="text-text-muted text-xs mr-2">&gt;</span>
          <Command.Input
            ref={inputRef}
            value={search}
            onValueChange={setSearch}
            placeholder="Type a command..."
            className="flex-1 py-3 bg-transparent text-text-primary text-sm outline-none placeholder:text-text-muted"
          />
          <kbd className="text-[10px] text-text-muted border border-border-default px-1.5 py-0.5 rounded">
            Esc
          </kbd>
        </div>

        <Command.List className="overflow-y-auto flex-1 py-1">
          <Command.Empty className="py-6 text-center text-text-muted text-sm">
            No commands found for &quot;{search}&quot;
          </Command.Empty>

          {Object.entries(categories).map(([category, cmds]) => (
            <Command.Group
              key={category}
              heading={category}
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-text-muted"
            >
              {cmds.map((cmd) => (
                <Command.Item
                  key={cmd.id}
                  value={cmd.id}
                  onSelect={() => handleSelect(cmd)}
                  className="flex items-center gap-3 px-3 py-2 mx-1 rounded cursor-pointer text-sm text-text-secondary data-[selected=true]:bg-bg-raised data-[selected=true]:text-text-primary hover:bg-bg-raised transition-colors"
                >
                  <span className="flex-1">{cmd.label}</span>
                  {cmd.description && (
                    <span className="text-[10px] text-text-muted truncate max-w-40">
                      {cmd.description}
                    </span>
                  )}
                  {cmd.keybinding && (
                    <kbd className="text-[10px] text-text-muted border border-border-default px-1.5 py-0.5 rounded font-mono shrink-0">
                      {cmd.keybinding}
                    </kbd>
                  )}
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>

        <div className="border-t border-border-default px-3 py-2 flex items-center gap-4 text-[10px] text-text-muted shrink-0">
          <span>
            <kbd className="border border-border-default px-1 rounded">
              ↑↓
            </kbd>{" "}
            navigate
          </span>
          <span>
            <kbd className="border border-border-default px-1 rounded">
              ↵
            </kbd>{" "}
            run
          </span>
          <span>
            <kbd className="border border-border-default px-1 rounded">
              Esc
            </kbd>{" "}
            close
          </span>
          <span className="ml-auto">
            {Object.values(categories).flat().length} commands
          </span>
        </div>
      </Command>
    </div>
  );
}
