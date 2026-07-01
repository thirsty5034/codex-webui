/**
 * 对话大纲面板 - 显示在右侧悬浮触发块中
 * 展示对话结构树，支持点击跳转
 */
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, Pin, PinOff } from 'lucide-react';
import type { OutlineItem } from './use-chat-outline';

interface Props {
  items: OutlineItem[];
  isPinned: boolean;
  onTogglePin: () => void;
  onScrollTo: (index: number) => void;
  onScrollTop: () => void;
  onScrollBottom: () => void;
}

export function ChatOutlinePanel({
  items,
  isPinned,
  onTogglePin,
  onScrollTo,
  onScrollTop,
  onScrollBottom,
}: Props) {
  const { t } = useTranslation();

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-3">
        <p className="text-xs text-muted-foreground/50">
          {t('No outline available')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          {t('Chat outline')}
        </span>
        <button
          type="button"
          onClick={onTogglePin}
          className="rounded p-0.5 text-muted-foreground/50 hover:text-foreground"
          aria-label={isPinned ? t('Unpin') : t('Pin')}
        >
          {isPinned ? (
            <PinOff className="h-3.5 w-3.5" />
          ) : (
            <Pin className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Outline list */}
      <ScrollArea className="min-h-0 flex-1 px-2 py-1">
        <div className="space-y-0.5">
          {items.map((item, idx) => (
            <div key={`${item.type}-${item.index}-${idx}`}>
              <button
                type="button"
                onClick={() => onScrollTo(item.index)}
                className="flex w-full cursor-pointer items-start gap-1.5 rounded px-2 py-1 text-left text-xs text-muted-foreground/70 transition-colors hover:bg-accent/50 hover:text-foreground"
              >
                <span className="mt-0.5 shrink-0">
                  {item.type === 'user' ? '💬' : '🤖'}
                </span>
                <span className="line-clamp-2 break-all">{item.label}</span>
              </button>
              {item.children && item.children.length > 0 && (
                <div className="ml-4 space-y-0.5 border-l border-border/30 pl-2">
                  {item.children.map((child, ci) => (
                    <button
                      key={`${child.label}-${ci}`}
                      type="button"
                      onClick={() => onScrollTo(child.index)}
                      className="flex w-full cursor-pointer items-start gap-1 rounded px-2 py-0.5 text-left text-[11px] text-muted-foreground/50 transition-colors hover:bg-accent/50 hover:text-foreground"
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Quick nav footer */}
      <div className="flex items-center justify-center gap-2 border-t border-border/50 px-3 py-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground/60"
          onClick={onScrollTop}
        >
          <ArrowUp className="mr-1 h-3 w-3" />
          {t('Top')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground/60"
          onClick={onScrollBottom}
        >
          <ArrowDown className="mr-1 h-3 w-3" />
          {t('Bottom')}
        </Button>
      </div>
    </div>
  );
}
