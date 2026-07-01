/**
 * Hook: 从 TimelineEntry[] 解析对话大纲结构
 * 用于右侧大纲导航面板
 */
import { useMemo } from 'react';
import type { TimelineEntry } from '@/types/timeline';

export interface OutlineItem {
  /** 显示标签（用户消息前20字，AI回复前20字） */
  label: string;
  /** 条目类型 */
  type: 'user' | 'assistant';
  /** 在 timeline 中的索引 */
  index: number;
  /** 子条目（文件变更、工具调用等） */
  children?: OutlineItem[];
}

/**
 * 截取文本前 maxLen 个字符，避免大纲条目过长
 */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '…';
}

/**
 * 从 TimelineEntry 数组中解析大纲条目
 * @param timeline - 完整的对话时间线
 * @returns 大纲条目列表
 */
export function parseOutline(timeline: TimelineEntry[]): OutlineItem[] {
  const items: OutlineItem[] = [];

  for (let i = 0; i < timeline.length; i++) {
    const entry = timeline[i];

    if (entry.kind === 'user') {
      const label = truncate(entry.content, 20);
      items.push({
        label: label || '(empty)',
        type: 'user',
        index: i,
      });
    } else if (entry.kind === 'turn') {
      // 取第一条 agentMessage 的前20字作为标题
      const agentMsg = entry.items.find(item => item.type === 'agentMessage');
      const firstLine = agentMsg?.content
        ? agentMsg.content.split('\n')[0]
        : '';
      const label = truncate(firstLine, 20) || '(回复)';

      const outlineItem: OutlineItem = {
        label,
        type: 'assistant',
        index: i,
      };

      // 如果有文件变更，添加子条目
      const children: OutlineItem[] = [];
      for (const item of entry.items) {
        if (item.type === 'fileChange' && item.filePath) {
          children.push({
            label: `📄 ${truncate(item.filePath, 30)}`,
            type: 'assistant',
            index: i,
          });
        }
      }
      if (children.length > 0) {
        outlineItem.children = children;
      }

      items.push(outlineItem);
    }
    // system 条目跳过
  }

  return items;
}

/**
 * Hook: 根据 timeline 自动解析大纲
 */
export function useChatOutline(timeline: TimelineEntry[]): OutlineItem[] {
  return useMemo(() => parseOutline(timeline), [timeline]);
}
