/**
 * Compact per-turn token usage row displayed after completed turns.
 * Shows the turn's token consumption (input/output/total) with an optional inline copy button.
 */
import { Share2, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTimelineStore } from '@/stores/timeline-store';
import { formatTokens } from '@/lib/token-usage';
import { CopyButton } from './copy-button';

interface Props {
  turnId: string;
  getCopyText?: () => string;
  onShare?: () => void;
}

export function TurnTokenFooter({ turnId, getCopyText, onShare }: Props) {
  const { t } = useTranslation();
  const usage = useTimelineStore((s) => s.tokenUsageByTurn[turnId]);

  if (!usage) return null;

  const { last } = usage;
  // inputTokens includes cachedInputTokens; split for clarity
  const billableInput = Math.max(0, last.inputTokens - last.cachedInputTokens);

  return (
    <div className="mt-1 flex items-center gap-3 text-[11px] tabular-nums text-muted-foreground">
      {getCopyText && (
        <CopyButton getText={getCopyText} className="h-4 w-4" />
      )}
      <Zap className="h-3 w-3" />
      <span>
        {t('Input')} {formatTokens(billableInput)}
      </span>
      {last.cachedInputTokens > 0 && (
        <span>
          {t('Cached')} {formatTokens(last.cachedInputTokens)}
        </span>
      )}
      <span>
        {t('Output')} {formatTokens(last.outputTokens)}
      </span>
      {last.reasoningOutputTokens > 0 && (
        <span>
          {t('Reasoning')} {formatTokens(last.reasoningOutputTokens)}
        </span>
      )}
      <span className="font-medium">
        {t('Total')} {formatTokens(last.totalTokens)}
      </span>
      {onShare && (
        <button
          type="button"
          onClick={onShare}
          className="text-muted-foreground hover:text-foreground"
          aria-label={t('Share')}
        >
          <Share2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
