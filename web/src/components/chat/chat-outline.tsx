/**
 * 右侧悬浮大纲触发块 + 浮层面板
 * 鼠标悬停右侧窄条时展开，移出后自动收起（除非固定）
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
const PANEL_WIDTH = 220; // px
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

  return (
    <div className="absolute right-0 top-0 z-30 h-full">
      {/* Trigger strip */}
      <div
        className="absolute right-0 top-0 h-full cursor-pointer"
        style={{ width: `${TRIGGER_WIDTH}px` }}
        onMouseEnter={handleTriggerEnter}
      >
        {/* Visual hint: subtle vertical line when hidden */}
        <div
          className={`h-full w-full transition-colors duration-150 ${
            isVisible
              ? 'bg-border/20'
              : 'bg-transparent hover:bg-border/10'
          }`}
        />
        {/* Small triangle indicator */}
        {!isVisible && (
          <div className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[8px] text-muted-foreground/20 select-none">
            ◄
          </div>
        )}
      </div>

      {/* Outline panel */}
      <div
        className={`h-full overflow-hidden border-l border-border/30 bg-card/95 backdrop-blur-sm transition-all duration-200 ease-in-out ${
          isVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        style={{
          width: isVisible ? `${PANEL_WIDTH}px` : '0px',
          marginLeft: `${TRIGGER_WIDTH}px`,
        }}
        onMouseEnter={handlePanelEnter}
        onMouseLeave={handlePanelLeave}
      >
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
  );
}
