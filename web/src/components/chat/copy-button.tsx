/**
 * Copy-to-clipboard button with transient "copied" feedback.
 * Renders as an icon button that shows a check mark for 1.5 s after copying.
 */
import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface Props {
  /** Returns the text to copy when the button is clicked. */
  getText: () => string;
  /** Extra class names applied to the button element. */
  className?: string;
}

export function CopyButton({ getText, className }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const text = getText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API may fail in insecure contexts — ignore silently.
    }
  }, [getText]);

  return (
    <button
      type="button"
      aria-label={copied ? t('Copied!') : t('Copy')}
      title={copied ? t('Copied!') : t('Copy')}
      onClick={handleCopy}
      className={cn(
        'flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        className,
      )}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
