/**
 * 对话大纲面板 - 显示在右侧悬浮触发块中
 * 展示对话结构树，支持搜索过滤和点击跳转
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowUp, ArrowDown, Pin, PinOff, Search, X } from 'lucide-react';
import type { OutlineItem } from './use-chat-outline';

interface Props {
  items: OutlineItem[];
  isPinned: boolean;
  onTogglePin: () => void;
  onScrollTo: (index: number) => void;
  onScrollTop: () => void;
  onScrollBottom: () => void;
}

/**
 * 在文本中高亮搜索关键字，返回 JSX 片段
 */
function highlightText(text: string, keyword: string): React.ReactNode {
  if (!keyword.trim()) return <>{text}</>;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === keyword.toLowerCase()
          ? <mark key={i} className="rounded-sm bg-yellow-200/60 px-0.5 text-inherit dark:bg-yellow-500/30">{part}</mark>
          : part
      )}
    </>
  );
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
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((item) => item.label.toLowerCase().includes(q));
  }, [items, searchQuery]);

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

      {/* Search bar */}
      <div className="relative border-b border-border/30 px-3 py-1.5">
        <Search className="absolute left-4 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/40" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('Search outline...')}
          className="h-7 rounded-md pl-7 pr-7 text-xs"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Match count */}
      {searchQuery.trim() && (
        <div className="px-3 py-1 text-[10px] text-muted-foreground/40">
          {t('{{count}} / {{total}} matches', { count: filtered.length, total: items.length })}
        </div>
      )}

      {/* Outline list */}
      <ScrollArea className="min-h-0 flex-1 px-2 py-1">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-xs text-muted-foreground/40">{t('No matches')}</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((item, idx) => (
              <button
                key={`${item.type}-${item.index}-${idx}`}
                type="button"
                onClick={() => onScrollTo(item.index)}
                className="flex w-full cursor-pointer items-start gap-1.5 rounded px-2 py-1 text-left text-xs text-muted-foreground/70 transition-colors hover:bg-accent/50 hover:text-foreground"
              >
                <span className="mt-0.5 shrink-0">
                  {item.type === 'user' ? '💬' : '🤖'}
                </span>
                <span className="line-clamp-2 break-all">
                  {searchQuery.trim()
                    ? highlightText(item.label, searchQuery)
                    : item.label}
                </span>
              </button>
            ))}
          </div>
        )}
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
