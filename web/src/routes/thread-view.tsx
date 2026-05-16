/**
 * Thread route component — resumes/reads a thread by URL param.
 * Selecting a thread no longer clears other live thread state.
 */
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChatTimeline } from '@/components/chat/chat-timeline';
import { ChatInput, type ChatInputHandle } from '@/components/chat/chat-input';
import { SessionPanel } from '@/components/chat/session-panel';
import { useTimelineStore } from '@/stores/timeline-store';
import { showSnackbar } from '@/stores/snackbar-store';
import {
  threadsResumeThreadMutation,
  threadsReadThreadOptions,
} from '@/generated/api/@tanstack/react-query.gen';
import { tokenUsageReadThreadTokenUsage, turnDiffReadThreadTurnDiffs } from '@/generated/api/sdk.gen';

/** Extracts a display label from a thread DTO. */
function threadLabel(thread: { name?: string | null; preview?: string | null }): string {
  return thread.name ?? thread.preview ?? '';
}

export function ThreadView() {
  const { threadId } = useParams({ strict: false }) as { threadId: string };
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const chatInputRef = useRef<ChatInputHandle>(null);
  const [sessionPanelOpen, setSessionPanelOpen] = useState(false);
  const sessionPanelHeight = 300;

  const threadCwd = useTimelineStore((s) => s.threadCwd);
  const setActiveThread = useTimelineStore((s) => s.setActiveThread);
  const setReadOnlyThread = useTimelineStore((s) => s.setReadOnlyThread);
  const hydrateTimelineForThread = useTimelineStore((s) => s.hydrateTimelineForThread);
  const hydrateTokenUsageForThread = useTimelineStore((s) => s.hydrateTokenUsageForThread);
  const hydrateTurnDiffsForThread = useTimelineStore((s) => s.hydrateTurnDiffsForThread);
  const setThreadTitleForThread = useTimelineStore((s) => s.setThreadTitleForThread);
  const setThreadStatusForThread = useTimelineStore((s) => s.setThreadStatusForThread);
  const setActiveTurnIdForThread = useTimelineStore((s) => s.setActiveTurnIdForThread);
  const setLoadingForThread = useTimelineStore((s) => s.setLoadingForThread);

  const resumeThread = useMutation({
    ...threadsResumeThreadMutation(),
    onSuccess: (res) => {
      const tid = res.thread.id;
      const title = threadLabel(res.thread);
      setThreadTitleForThread(tid, title);
      hydrateTimelineForThread(tid, res.thread.turns, res.cwd);
      // Restore active turn state so sidebar shows loading and input stays in steer mode.
      setThreadStatusForThread(tid, res.thread.status);
      const activeTurn = res.thread.turns.find((t) => t.status === 'inProgress');
      if (activeTurn) {
        setActiveTurnIdForThread(tid, activeTurn.id);
        setLoadingForThread(tid, true);
      } else {
        setLoadingForThread(tid, false);
      }
      void tokenUsageReadThreadTokenUsage({ path: { threadId: tid } })
        .then(({ data }) => data && hydrateTokenUsageForThread(tid, data.turns))
        .catch(() => undefined);
      void turnDiffReadThreadTurnDiffs({ path: { threadId: tid } })
        .then(({ data }) => data && hydrateTurnDiffsForThread(tid, data.turns))
        .catch(() => undefined);
    },
    onError: (_err, vars) => {
      const failedId = vars.path.threadId;
      setLoadingForThread(failedId, false);
      // Only attempt archived read if this thread is still selected.
      if (useTimelineStore.getState().threadId === failedId) {
        void tryReadArchived(failedId);
      }
    },
  });

  /** Fallback: try to read the thread as an archived snapshot. */
  const tryReadArchived = async (targetId: string) => {
    try {
      const res = await queryClient.fetchQuery(
        threadsReadThreadOptions({
          path: { threadId: targetId },
          query: { includeTurns: true },
        }),
      );
      // Guard: user may have navigated away during the fetch.
      if (useTimelineStore.getState().threadId !== targetId) return;
      setReadOnlyThread(res.thread);
      void tokenUsageReadThreadTokenUsage({ path: { threadId: targetId } })
        .then(({ data }) => data && hydrateTokenUsageForThread(targetId, data.turns))
        .catch(() => undefined);
      void turnDiffReadThreadTurnDiffs({ path: { threadId: targetId } })
        .then(({ data }) => data && hydrateTurnDiffsForThread(targetId, data.turns))
        .catch(() => undefined);
    } catch {
      if (useTimelineStore.getState().threadId !== targetId) return;
      showSnackbar(t('Thread not found or cannot be opened.'), 'error');
      void navigate({ to: '/' });
    }
  };

  // Load or select thread when URL param changes. Backend ensures resume is deduped.
  useEffect(() => {
    setActiveThread(threadId);
    setLoadingForThread(threadId, true);
    resumeThread.mutate({ path: { threadId } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  return (
    <>
      <ChatTimeline onEditMessage={(v) => chatInputRef.current?.setInput(v)} />

      {sessionPanelOpen && threadCwd && (
        <div style={{ height: sessionPanelHeight }} className="shrink-0">
          <SessionPanel
            threadId={threadId}
            cwd={threadCwd}
            onClose={() => setSessionPanelOpen(false)}
          />
        </div>
      )}

      <ChatInput
        ref={chatInputRef}
        panelOpen={sessionPanelOpen}
        onTogglePanel={() => setSessionPanelOpen((o) => !o)}
      />
    </>
  );
}
