/**
 * Thread route component — resumes/reads a thread by URL param.
 * Manages session panel and ChatInput within the thread context.
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

  const storeThreadId = useTimelineStore((s) => s.threadId);
  const threadCwd = useTimelineStore((s) => s.threadCwd);
  const setActiveThread = useTimelineStore((s) => s.setActiveThread);
  const setReadOnlyThread = useTimelineStore((s) => s.setReadOnlyThread);
  const hydrateTimeline = useTimelineStore((s) => s.hydrateTimeline);
  const hydrateTokenUsage = useTimelineStore((s) => s.hydrateTokenUsage);
  const hydrateTurnDiffs = useTimelineStore((s) => s.hydrateTurnDiffs);
  const setThreadTitle = useTimelineStore((s) => s.setThreadTitle);
  const setLoading = useTimelineStore((s) => s.setLoading);

  const resumeThread = useMutation({
    ...threadsResumeThreadMutation(),
    onSuccess: (res) => {
      setThreadTitle(threadLabel(res.thread));
      hydrateTimeline(res.thread.turns, res.cwd);
      void tokenUsageReadThreadTokenUsage({ path: { threadId } })
        .then(({ data }) => data && hydrateTokenUsage(data.turns))
        .catch(() => undefined);
      void turnDiffReadThreadTurnDiffs({ path: { threadId } })
        .then(({ data }) => data && hydrateTurnDiffs(data.turns))
        .catch(() => undefined);
    },
    onError: () => {
      setLoading(false);
      // If resume fails, try reading as archived
      void tryReadArchived();
    },
  });

  /** Fallback: try to read the thread as an archived snapshot. */
  const tryReadArchived = async () => {
    try {
      const res = await queryClient.fetchQuery(
        threadsReadThreadOptions({
          path: { threadId },
          query: { includeTurns: true },
        }),
      );
      setReadOnlyThread(res.thread);
      void tokenUsageReadThreadTokenUsage({ path: { threadId } })
        .then(({ data }) => data && hydrateTokenUsage(data.turns))
        .catch(() => undefined);
      void turnDiffReadThreadTurnDiffs({ path: { threadId } })
        .then(({ data }) => data && hydrateTurnDiffs(data.turns))
        .catch(() => undefined);
    } catch {
      showSnackbar(t('Thread not found or cannot be opened.'), 'error');
      void navigate({ to: '/' });
    }
  };

  // Load thread when URL param changes or doesn't match store
  useEffect(() => {
    if (storeThreadId === threadId) return;
    setActiveThread(threadId);
    setLoading(true);
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
