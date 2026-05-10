/**
 * Hook that connects socket.io events to Zustand stores.
 * Handles all Codex app-server notification routing.
 */
import { useEffect } from 'react';
import { getSocket } from '../socket';
import { useConnectionStore } from '../stores/connection-store';
import { useTimelineStore } from '../stores/timeline-store';

export function useCodexSocket() {
  const setConnected = useConnectionStore((s) => s.setConnected);
  const {
    updateCurrentTurn,
    updateTurnItem,
    updateTurnDiff,
    setLoading,
    expandReasoning,
    collapseReasoning,
  } = useTimelineStore();

  useEffect(() => {
    const socket = getSocket();

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on(
      'codex.notification',
      (notification: {
        method: string;
        params: Record<string, unknown>;
      }) => {
        const { method, params } = notification;
        const turnId = params.turnId as string | undefined;
        const itemId = params.itemId as string | undefined;

        // Reasoning delta
        if (
          method === 'item/reasoning/summaryTextDelta' &&
          turnId &&
          itemId
        ) {
          const delta = params.delta as string;
          updateTurnItem(turnId, itemId, (existing) => ({
            type: 'reasoning',
            itemId,
            content: (existing?.content ?? '') + delta,
            completed: false,
          }));
          expandReasoning(itemId);
        }

        // Agent message delta
        if (method === 'item/agentMessage/delta' && turnId && itemId) {
          const delta = params.delta as string;
          updateTurnItem(turnId, itemId, (existing) => ({
            type: 'agentMessage',
            itemId,
            content: (existing?.content ?? '') + delta,
            completed: false,
          }));
        }

        // Command execution output delta
        if (
          method === 'item/commandExecution/outputDelta' &&
          turnId &&
          itemId
        ) {
          const delta = params.delta as string;
          updateTurnItem(turnId, itemId, (existing) => ({
            type: 'commandExecution',
            itemId,
            content: (existing?.content ?? '') + delta,
            completed: false,
          }));
        }

        // File change output delta
        if (
          method === 'item/fileChange/outputDelta' &&
          turnId &&
          itemId
        ) {
          const delta = params.delta as string;
          updateTurnItem(turnId, itemId, (existing) => ({
            type: 'fileChange',
            itemId,
            content: (existing?.content ?? '') + delta,
            completed: false,
            filePath: existing?.filePath,
          }));
        }

        // Turn-level unified diff updated
        if (method === 'turn/diff/updated' && turnId) {
          const diff = params.diff as string;
          updateTurnDiff(turnId, diff);
        }

        // Item started — create placeholder for tool calls
        if (method === 'item/started' && turnId) {
          const item = params.item as Record<string, unknown> | undefined;
          if (!item) return;
          const startedItemId = item.id as string;

          if (item.type === 'mcpToolCall') {
            updateTurnItem(turnId, startedItemId, () => ({
              type: 'mcpToolCall',
              itemId: startedItemId,
              content: '',
              completed: false,
              toolServer: (item.server as string) ?? '',
              toolName: (item.tool as string) ?? '',
              toolArgs: item.arguments
                ? JSON.stringify(item.arguments, null, 2)
                : '',
            }));
          }

          if (item.type === 'fileChange') {
            const changes = item.changes as
              | Array<{ file?: string }>
              | undefined;
            const filePath = changes?.[0]?.file ?? '';
            updateTurnItem(turnId, startedItemId, () => ({
              type: 'fileChange',
              itemId: startedItemId,
              content: '',
              completed: false,
              filePath,
            }));
          }

          if (item.type === 'commandExecution') {
            updateTurnItem(turnId, startedItemId, () => ({
              type: 'commandExecution',
              itemId: startedItemId,
              content: '',
              completed: false,
              command: (item.command as string) ?? '',
            }));
          }
        }

        // Item completed — calibrate and mark done
        if (method === 'item/completed' && turnId) {
          const item = params.item as Record<string, unknown> | undefined;
          if (!item) return;
          const completedItemId =
            (params.itemId as string) ?? (item.id as string);

          if (item.type === 'agentMessage') {
            const text = (item.text as string) ?? '';
            updateTurnItem(turnId, completedItemId, () => ({
              type: 'agentMessage',
              itemId: completedItemId,
              content: text,
              completed: true,
            }));
          }

          if (item.type === 'reasoning') {
            updateTurnItem(turnId, completedItemId, (existing) => ({
              ...(existing ?? {
                type: 'reasoning' as const,
                itemId: completedItemId,
                content: '',
              }),
              completed: true,
            }));
            collapseReasoning(completedItemId);
          }

          if (item.type === 'commandExecution') {
            const cmd = (item.command as string) ?? '';
            const output = (item.aggregatedOutput as string) ?? '';
            updateTurnItem(turnId, completedItemId, (existing) => ({
              ...(existing ?? {
                type: 'commandExecution' as const,
                itemId: completedItemId,
                content: '',
              }),
              content: output || existing?.content || '',
              command: cmd || existing?.command,
              exitCode: (item.exitCode as number) ?? existing?.exitCode,
              completed: true,
            }));
          }

          if (item.type === 'mcpToolCall') {
            const result = item.result as Record<string, unknown> | null;
            const resultText = result?.content
              ? JSON.stringify(result.content, null, 2).slice(0, 500)
              : ((item.error as string) ?? '');
            updateTurnItem(turnId, completedItemId, (existing) => ({
              ...(existing ?? {
                type: 'mcpToolCall' as const,
                itemId: completedItemId,
                toolServer: (item.server as string) ?? '',
                toolName: (item.tool as string) ?? '',
                toolArgs: '',
              }),
              content: resultText,
              completed: true,
            }));
          }

          if (item.type === 'fileChange') {
            const changes = item.changes as
              | Array<{ file?: string }>
              | undefined;
            const filePath = changes?.[0]?.file ?? '';
            updateTurnItem(turnId, completedItemId, (existing) => ({
              ...(existing ?? {
                type: 'fileChange' as const,
                itemId: completedItemId,
              }),
              content: existing?.content ?? '',
              completed: true,
              filePath: existing?.filePath ?? filePath,
            }));
          }
        }

        // Turn completed
        if (method === 'turn/completed' && turnId) {
          updateCurrentTurn(turnId, (items) => ({
            items,
            completed: true,
          }));
          setLoading(false);
        }
      },
    );

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('codex.notification');
    };
  }, [
    setConnected,
    updateCurrentTurn,
    updateTurnItem,
    updateTurnDiff,
    setLoading,
    expandReasoning,
    collapseReasoning,
  ]);
}
