/** Global terminal view route component. */
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { TerminalRiskGate } from '@/components/terminal/terminal-risk-gate';
import { TerminalView } from '@/components/terminal/terminal-view';
import { filesGetRootsOptions } from '@/generated/api/@tanstack/react-query.gen';
import { useTimelineStore } from '@/stores/timeline-store';

export function TerminalRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const threadId = useTimelineStore((s) => s.threadId);
  const { data, isLoading } = useQuery(filesGetRootsOptions());

  const navigateBack = () => {
    if (threadId) {
      void navigate({ to: '/t/$threadId', params: { threadId } });
    } else {
      void navigate({ to: '/' });
    }
  };

  if (isLoading || !data?.homeDir) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        {t('Loading...')}
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1">
      <TerminalRiskGate onCancel={navigateBack}>
        <TerminalView cwd={data.homeDir} />
      </TerminalRiskGate>
    </div>
  );
}
