/**
 * Chat view for the index route (no thread selected).
 * Clears active thread in store so UI returns to empty state.
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTimelineStore } from '@/stores/timeline-store';

export function ChatView() {
  const { t } = useTranslation();
  const threadId = useTimelineStore((s) => s.threadId);
  const clearThread = useTimelineStore((s) => s.clearThread);

  // Landing on / means no thread is active — clear any stale store state
  useEffect(() => {
    if (threadId) clearThread();
  }, [threadId, clearThread]);

  return (
    <div className="flex flex-1 items-center justify-center text-muted-foreground">
      <p className="text-sm">{t('Select or create a thread to start chatting.')}</p>
    </div>
  );
}
