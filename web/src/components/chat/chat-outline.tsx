/**
 * 右侧大纲触发条 + 悬浮面板
 * 使用 position:absolute 相对于对话容器定位，
 * 触发条在滚动条左侧（right: 14px），避开滚动条遮挡
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatOutlinePanel } from './chat-outline-panel';
import type { OutlineItem } from './use-chat-outline';

interface Props {
  items: OutlineItem[];
  onScrollTo: (index: number) => void;
  onScrollTop: () => void;
  onScrollBottom: () => void;
}

const TRIGGER_WIDTH = 8; // px
const PANEL_WIDTH = 260; // px
const SCROLLBAR_GAP = 14; // px, 让触发条在滚动条左侧
const AUTO_HIDE_DELAY = 500; // ms

export function ChatOutline({ items, onScrollTo, onScrollTop, onScrollBottom }: Props) {
  const [isHovering, setIsHovering] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isVisible = isHovering || isPinned;

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const startHideTimer = useCallback(() => {
    if (isPinned) return;
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setIsHovering(false);
    }, AUTO_HIDE_DELAY);
  }, [isPinned, clearHideTimer]);

  const handleTriggerEnter = useCallback(() => {
    clearHideTimer();
    setIsHovering(true);
  }, [clearHideTimer]);

  const handlePanelEnter = useCallback(() => {
    clearHideTimer();
  }, [clearHideTimer]);

  const handlePanelLeave = useCallback(() => {
    startHideTimer();
  }, [startHideTimer]);

  const handleTogglePin = useCallback(() => {
    setIsPinned((prev) => !prev);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="absolute right-0 top-0 z-30 h-full pointer-events-none">
      {/* Trigger strip — 在滚动条左侧，避开遮挡 */}
      <div
        className="absolute top-0 h-full pointer-events-auto cursor-pointer"
        style={{
          width: `${TRIGGER_WIDTH}px`,
          right: `${SCROLLBAR_GAP}px`,
        }}
        onMouseEnter={handleTriggerEnter}
      >
        <div
          className={`h-full w-full rounded-l-sm transition-all duration-150 ${
            isVisible
              ? 'bg-border/30'
              : 'bg-transparent hover:bg-border/10'
          }`}
        />
        {!isVisible && (
          <div className="absolute right-1/2 top-3 bottom-3 w-px bg-border/15" />
        )}
      </div>

      {/* Outline panel */}
      <div
        className={`absolute top-0 h-full overflow-hidden border-l border-border/30 bg-card/95 backdrop-blur-sm transition-all duration-200 ease-in-out pointer-events-auto ${
          isVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        style={{
          width: isVisible ? `${PANEL_WIDTH}px` : '0px',
          right: isVisible ? `${SCROLLBAR_GAP + TRIGGER_WIDTH}px` : `${SCROLLBAR_GAP + TRIGGER_WIDTH}px`,
        }}
        onMouseEnter={handlePanelEnter}
        onMouseLeave={handlePanelLeave}
      >
        <div className="h-full w-[260px]">
          <ChatOutlinePanel
            items={items}
            isPinned={isPinned}
            onTogglePin={handleTogglePin}
            onScrollTo={onScrollTo}
            onScrollTop={onScrollTop}
            onScrollBottom={onScrollBottom}
          />
        </div>
      </div>
    </div>
  );
}
