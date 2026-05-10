/**
 * Renders a command execution item showing the command and its output.
 */
import { Loader2, Terminal } from 'lucide-react';
import type { TurnItem } from '@/types/timeline';
import { cn } from '@/lib/utils';

interface Props {
  item: TurnItem;
}

export function CommandItem({ item }: Props) {
  /** Extract a readable command from the full shell invocation. */
  const displayCommand = item.command
    ? simplifyCommand(item.command)
    : undefined;

  return (
    <div className="overflow-hidden rounded-lg border border-border/50 bg-muted/40 font-mono">
      <div className="flex items-center gap-1.5 border-b border-border/50 px-3 py-1.5 text-xs text-muted-foreground">
        <Terminal className="h-3 w-3" />
        <span>Terminal</span>
        {item.exitCode !== undefined && item.completed && (
          <span
            className={cn(
              'ml-auto',
              item.exitCode === 0 ? 'text-green-400' : 'text-red-400',
            )}
          >
            exit {item.exitCode}
          </span>
        )}
        {!item.completed && (
          <Loader2 className="ml-auto h-3 w-3 animate-spin" />
        )}
      </div>

      {displayCommand && (
        <div className="border-b border-border/30 bg-muted/60 px-3 py-1.5 text-xs text-foreground/80">
          <span className="mr-1.5 text-green-400">$</span>
          {displayCommand}
        </div>
      )}

      {item.content && (
        <pre className="m-0 max-h-64 overflow-auto p-3 text-xs leading-relaxed text-muted-foreground">
          {item.content}
        </pre>
      )}
    </div>
  );
}

/**
 * Extracts the actual command from codex's shell invocation wrapper.
 * e.g. `/bin/zsh -lc "mkdir -p .claude && apply_patch ..."` → `mkdir -p .claude && apply_patch ...`
 */
function simplifyCommand(cmd: string): string {
  // Strip `/bin/zsh -lc "..."` or `/bin/bash -lc "..."` wrapper
  const match = cmd.match(/^\/bin\/(?:zsh|bash)\s+-\w+\s+"(.+)"$/s);
  if (match) {
    let inner = match[1];
    // Truncate very long commands (e.g. apply_patch with full content)
    if (inner.length > 200) {
      const firstLine = inner.split('\n')[0];
      inner = firstLine.length > 200
        ? firstLine.slice(0, 200) + '...'
        : firstLine + ' ...';
    }
    return inner;
  }
  return cmd.length > 200 ? cmd.slice(0, 200) + '...' : cmd;
}
