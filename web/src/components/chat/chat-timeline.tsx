/**
 * Virtualized scrollable message timeline.
 * Uses TanStack Virtual for efficient rendering of long conversations.
 */
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useLayoutStore } from '@/stores/layout-store';
import { useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, Bot, CheckSquare, Copy, Loader2, Pencil, Square, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  threadsListThreadsQueryKey,
  threadsRollbackThreadMutation,
} from '@/generated/api/@tanstack/react-query.gen';
import { tokenUsageReadThreadTokenUsage, turnDiffReadThreadTurnDiffs } from '@/generated/api/sdk.gen';
import { useTimelineStore } from '@/stores/timeline-store';
import { showSnackbar } from '@/stores/snackbar-store';
import type { TimelineEntry } from '@/types/timeline';
import { TurnBlock } from './turn-block';
import { Button } from '@/components/ui/button';
import { CopyButton } from './copy-button';
import { UserMessageBubble } from './user-message-bubble';

/** Extracts plain text from a timeline entry for copy/export. */
function extractEntryText(entry: TimelineEntry): string {
  if (entry.kind === 'user') return entry.content;
  if (entry.kind === 'system') return entry.content;
  // Turn: collect agentMessage content only (skip reasoning / tool calls)
  return entry.items
    .filter((i) => i.type === 'agentMessage' && i.content)
    .map((i) => i.content)
    .join('\n\n');
}

/** Counts how many turns need to be rolled back when editing this user message. */
function computeRollbackTurns(timeline: TimelineEntry[], userIndex: number): number {
  const turnEntries = timeline
    .slice(userIndex)
    .filter((e): e is Extract<TimelineEntry, { kind: 'turn' }> => e.kind === 'turn');
  return turnEntries.length;
}

/** Returns true if the scroll container is near the bottom. */
function isNearBottom(el: HTMLElement, threshold = 120): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
}

interface Props {
  onEditMessage?: (message: string) => void;
}

export function ChatTimeline({ onEditMessage }: Props) {
  'use no memo'; // TanStack Virtual is incompatible with React Compiler memoization
  const { t } = useTranslation();
  const timeline = useTimelineStore((s) => s.timeline);
  const threadId = useTimelineStore((s) => s.threadId);
  const threadCwd = useTimelineStore((s) => s.threadCwd);
  const threadMode = useTimelineStore((s) => s.threadMode);
  const loading = useTimelineStore((s) => s.loading);
  const hydrateTimeline = useTimelineStore((s) => s.hydrateTimeline);
  const hydrateTokenUsage = useTimelineStore((s) => s.hydrateTokenUsage);
  const hydrateTurnDiffs = useTimelineStore((s) => s.hydrateTurnDiffs);
  const [rollbackTarget, setRollbackTarget] = useState<{
    numTurns: number;
    content: string;
  } | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(() => new Set());
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const queryClient = useQueryClient();

  const rollbackThread = useMutation({
    ...threadsRollbackThreadMutation(),
  });

  const canRollback = threadMode === 'live' && !loading && !rollbackThread.isPending;

  // ── Multi-select helpers ─────────────────────────────────────────────
  const toggleSelectIndex = useCallback((idx: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }, []);

  const enterSelectMode = useCallback((preselectIndex?: number) => {
    setSelectMode(true);
    if (preselectIndex !== undefined) {
      setSelectedIndices(new Set([preselectIndex]));
    } else {
      setSelectedIndices(new Set());
    }
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIndices(new Set());
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIndices(new Set(timeline.map((_, i) => i)));
  }, [timeline]);

  const copySelectedEntries = useCallback(async () => {
    const parts: string[] = [];
    // Sort indices to maintain timeline order regardless of selection order
    const sortedIndices = [...selectedIndices].sort((a, b) => a - b);
    for (const idx of sortedIndices) {
      const entry = timeline[idx];
      if (!entry) continue;
      const text = extractEntryText(entry);
      if (!text) continue;
      const label = entry.kind === 'user' ? 'User' : 'Assistant';
      parts.push(`${label}: ${text}`);
    }
    if (parts.length === 0) return;
    try {
      await navigator.clipboard.writeText(parts.join('\n\n'));
      showSnackbar(t('{{count}} messages copied', { count: parts.length }), 'success');
    } catch { /* ignore */ }
    exitSelectMode();
  }, [selectedIndices, timeline, exitSelectMode]);

  // ── Virtualizer ─────────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(timeline.length);
  const shouldAutoScroll = useRef(true);
  const scrollFrameRef = useRef<number | null>(null);
  const lastRenderedThreadRef = useRef<string | null>(null);

  // Panel transition state
  const sidePanel = useLayoutStore((s) => s.sidePanel);
  const panelTransitionRef = useRef(false);

  // Mark transition start when sidePanel changes
  useLayoutEffect(() => {
    panelTransitionRef.current = true;
    shouldAutoScroll.current = false;
  }, [sidePanel]);

  // Set up transition finalization
  useEffect(() => {
    const el = scrollRef.current;

    const onUser = () => {
      panelTransitionRef.current = false;
      // Let the next natural scroll event update shouldAutoScroll
    };
    el?.addEventListener('wheel', onUser, { once: true, passive: true });
    el?.addEventListener('touchstart', onUser, { once: true, passive: true });

    const finalTimer = setTimeout(() => {
      panelTransitionRef.current = false;
      // Don't re-enable shouldAutoScroll here — let user scroll do it
    }, 500);

    return () => {
      clearTimeout(finalTimer);
      el?.removeEventListener('wheel', onUser);
    };
  }, [sidePanel]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual known limitation
  const virtualizer = useVirtualizer({
    count: timeline.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 80,
    overscan: 5,
    observeElementRect: (_instance, cb) => {
      const el = scrollRef.current;
      if (!el) return () => {};
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          // Always forward size to virtualizer so it can render items
          cb(entry.contentRect);
          // Restore scroll position during panel transitions to prevent jumps
          if (panelTransitionRef.current) {
            const saved = lastScrollTopRef.current;
            if (saved !== null) {
              el.scrollTop = saved;
              requestAnimationFrame(() => {
                if (panelTransitionRef.current && saved !== null) {
                  el.scrollTop = saved;
                }
              });
            }
          }
        }
      });
      ro.observe(el);
      return () => { ro.disconnect(); };
    },
  });
  // Track scrollTop via property setter override (captures ALL changes)
  const lastScrollTopRef = useRef<number | null>(null);
  const applyScrollTopSetter = (el: HTMLElement | null) => {
    if (!el) return;
    // Skip if already has own descriptor (already overridden)
    if (Object.getOwnPropertyDescriptor(el, 'scrollTop')) return;
    // Find scrollTop descriptor on prototype chain
    const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTop')
      ?? Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
    if (!descriptor?.set) return;
    Object.defineProperty(el, 'scrollTop', {
      get() { return descriptor.get!.call(this); },
      set(v: number) {
        descriptor.set!.call(this, v);
        if (!panelTransitionRef.current) {
          lastScrollTopRef.current = v;
        }
      },
      configurable: true,
    });
  };

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el && !panelTransitionRef.current) {
      const nearBottom = isNearBottom(el);
      shouldAutoScroll.current = nearBottom;
      setShowScrollBottom(prev => {
        const show = !nearBottom;
        return prev === show ? prev : show;
      });
    }
  }, []);

  // Cleanup pending animation frames
  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    };
  }, []);

  // Keep bottom pinned during streaming (content changes) and new entries.
  // Smooth scroll for appended entries; instant jump for hydration (0→many).
  useEffect(() => {
    const previousCount = prevCountRef.current;
    const appended = timeline.length > previousCount;
    prevCountRef.current = timeline.length;

    if (timeline.length === 0 || !shouldAutoScroll.current) return;
    // Skip auto-scroll entirely during panel transitions
    if (panelTransitionRef.current) return;

    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);

    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      if (panelTransitionRef.current) return;
      virtualizer.scrollToIndex(timeline.length - 1, {
        align: 'end',
        behavior: previousCount > 0 && appended ? 'smooth' : 'auto',
      });
    });
  }, [timeline, virtualizer]);

  // 切换对话 → behavior: 'auto' 直接跳转到底部
  useEffect(() => {
    if (timeline.length > 0 && lastRenderedThreadRef.current !== threadId) {
      lastRenderedThreadRef.current = threadId;
      shouldAutoScroll.current = true;
      // Cancel pending streaming scroll RAF to prevent race condition
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
      // Reset prevCount so Effect A's RAF callback sees no appended entries
      prevCountRef.current = timeline.length;
      virtualizer.scrollToIndex(timeline.length - 1, {
        align: 'end',
        behavior: 'auto',
      });
    }
    // Only on threadId or timeline.length change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, timeline.length]);

  const virtualItems = virtualizer.getVirtualItems();

  // ── Empty states ────────────────────────────────────────────────────
  if (timeline.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="mb-3 h-8 w-8 animate-spin opacity-40" />
            <p className="text-sm">{t('Loading...')}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Bot className="mb-4 h-12 w-12 opacity-30" />
            <p className="text-sm">
              {threadId
                ? t('Send a message to start the conversation.')
                : t('Create a new thread to begin.')}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Virtualized list ────────────────────────────────────────────────
  return (
    <>
      <div
        ref={(el) => { if (el) { (scrollRef as React.MutableRefObject<HTMLElement | null>).current = el; applyScrollTopSetter(el); } }}
        onScroll={handleScroll}
        className="relative min-h-0 flex-1 overflow-y-auto"
      >
        <div
          className="relative px-3 sm:px-4 lg:px-6"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          <div
            className="absolute left-0 top-0 w-full px-3 sm:px-4 lg:px-6"
            style={{ transform: `translateY(${virtualItems[0]?.start ?? 0}px)` }}
          >
            {virtualItems.map((virtualItem) => {
              const entry = timeline[virtualItem.index];
              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  className="py-2"
                >
                  <TimelineEntryRow
                    entry={entry}
                    index={virtualItem.index}
                    timeline={timeline}
                    threadCwd={threadCwd}
                    canRollback={canRollback}
                    onRollback={setRollbackTarget}
                    selectMode={selectMode}
                    selected={selectedIndices.has(virtualItem.index)}
                    onToggleSelect={toggleSelectIndex}
                    onShare={() => enterSelectMode(virtualItem.index)}
                    t={t}
                  />
                </div>
              );
            })}
          </div>
        </div>
        {showScrollBottom && timeline.length > 0 && (
          <div className="sticky bottom-4 z-10 flex justify-end pointer-events-none">
            <Button
              size="icon"
              variant="secondary"
              className="h-9 w-9 rounded-full shadow-md pointer-events-auto"
              aria-label={t('Scroll to bottom')}
              onClick={() => {
                virtualizer.scrollToIndex(timeline.length - 1, {
                  align: 'end',
                  behavior: 'smooth',
                });
                shouldAutoScroll.current = true;
                setShowScrollBottom(false);
              }}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Share mode bottom toolbar */}
      {selectMode && (
        <div className="sticky bottom-0 z-20 flex items-center gap-2 border-t border-border bg-card/95 px-4 py-2 backdrop-blur">
          <Button size="sm" variant="ghost" onClick={exitSelectMode}>
            <X className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('{{count}} selected', { count: selectedIndices.size })}
          </span>
          <Button size="sm" variant="ghost" onClick={selectAll}>
            {t('Select all')}
          </Button>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="default"
            disabled={selectedIndices.size === 0}
            onClick={() => void copySelectedEntries()}
          >
            <Copy className="mr-1 h-4 w-4" />
            {t('Copy')}
          </Button>
        </div>
      )}

      <AlertDialog open={rollbackTarget !== null} onOpenChange={(open) => !open && setRollbackTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Edit this message?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('This will remove this turn and all subsequent turns. File changes will NOT be reverted.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={rollbackThread.isPending}
              onClick={() => {
                if (!threadId || !rollbackTarget || rollbackTarget.numTurns < 1) return;
                const editContent = rollbackTarget.content;
                rollbackThread.mutate(
                  {
                    path: { threadId },
                    body: { numTurns: rollbackTarget.numTurns },
                  },
                  {
                    onSuccess: (res) => {
                      const tid = res.thread.id;
                      hydrateTimeline(res.thread.turns, res.thread.cwd);
                      void tokenUsageReadThreadTokenUsage({ path: { threadId: tid } })
                        .then(({ data }) => data && hydrateTokenUsage(data.turns))
                        .catch(() => undefined);
                      void turnDiffReadThreadTurnDiffs({ path: { threadId: tid } })
                        .then(({ data }) => data && hydrateTurnDiffs(data.turns))
                        .catch(() => undefined);
                      setRollbackTarget(null);
                      void queryClient.invalidateQueries({ queryKey: threadsListThreadsQueryKey() });
                      if (editContent) onEditMessage?.(editContent);
                    },
                  },
                );
              }}
            >
              {t('Confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Renders a single timeline entry (user message, system message, or turn block). */
function TimelineEntryRow({
  entry,
  index,
  timeline,
  threadCwd,
  canRollback,
  onRollback,
  selectMode,
  selected,
  onToggleSelect,
  onShare,
  t,
}: {
  entry: TimelineEntry;
  index: number;
  timeline: TimelineEntry[];
  threadCwd: string | null;
  canRollback: boolean;
  onRollback: (target: { numTurns: number; content: string }) => void;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: (idx: number) => void;
  onShare?: () => void;
  t: (key: string) => string;
}) {
  // ── Checkbox for multi-select mode ──────────────────────────────
  const selectCheckbox = selectMode ? (
    <button
      type="button"
      className="mr-2 mt-1 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
      onClick={(e) => { e.stopPropagation(); onToggleSelect(index); }}
      aria-label={selected ? t('Deselect') : t('Select')}
    >
      {selected ? (
        <CheckSquare className="h-5 w-5 text-primary" />
      ) : (
        <Square className="h-5 w-5" />
      )}
    </button>
  ) : null;

  if (entry.kind === 'user') {
    const numTurns = computeRollbackTurns(timeline, index);
    return (
      <div className="group/user flex items-start" onClick={selectMode ? () => onToggleSelect(index) : undefined} style={selectMode ? { cursor: 'pointer' } : undefined}>
        {selectCheckbox}
        <div className="flex flex-1 flex-col items-end">
        <div
          className="max-w-2xl overflow-hidden rounded-2xl bg-blue-600 px-4 py-3 text-white [&_a]:text-blue-200 [&_a]:underline [&_blockquote]:text-white/70 [&_code]:bg-white/15 [&_del]:text-white/70"
          style={{
            boxShadow:
              '0 8px 24px rgba(59, 130, 246, 0.20), inset 0 1px 0 rgba(255, 255, 255, 0.18), inset 0 -1px 0 rgba(0, 0, 0, 0.12)',
          }}
        >
          <UserMessageBubble content={entry.content} threadCwd={threadCwd} images={entry.images} />
        </div>
        <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover/user:opacity-100">
          <CopyButton getText={() => entry.content} className="h-6 w-6" />
          {canRollback && numTurns > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={t('Edit this message')}
                  className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={() => onRollback({ numTurns, content: entry.content })}
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t('Edit this message')}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      </div>
    );
  }

  if (entry.kind === 'system') {
    const severity = entry.severity ?? 'error';
    const colorMap = {
      info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      warning: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
      error: 'bg-destructive/10 text-destructive',
    } as const;
    return (
      <div className="text-center">
        <span className={`inline-block rounded-lg px-3 py-1.5 text-sm ${colorMap[severity]}`}>
          {entry.content}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-start" onClick={selectMode ? () => onToggleSelect(index) : undefined} style={selectMode ? { cursor: 'pointer' } : undefined}>
      {selectCheckbox}
      <div className="min-w-0 flex-1">
        <TurnBlock entry={entry} onShare={onShare} selectMode={selectMode} />
      </div>
    </div>
  );
}
