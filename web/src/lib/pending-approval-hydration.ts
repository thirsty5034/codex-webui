/**
 * Hydrates pending approval requests from the server into the timeline store.
 * Called after a thread is resumed to catch any approvals that arrived
 * while the frontend was disconnected.
 */
import { pendingApprovalsListPending, pendingApprovalsRespond } from '@/generated/api/sdk.gen';
import type { PendingServerRequestDto } from '@/generated/api';
import type { ApprovalRequest } from '@/types/approval';
import { useTimelineStore } from '@/stores/timeline-store';
import { parseAvailableDecisions, parseStringArray, parseNetworkAmendments } from './approval-parsers';

/** Converts a persisted PendingServerRequestDto to an ApprovalRequest for the store. */
function toApprovalRequest(req: PendingServerRequestDto): ApprovalRequest | null {
  const params = req.params;
  const turnId = typeof params.turnId === 'string' ? params.turnId : req.turnId;
  if (!turnId) return null;

  const method = req.method;

  if (method === 'mcpServer/elicitation/request') {
    const meta = (params._meta ?? {}) as Record<string, unknown>;
    const toolDesc = (meta.tool_description as string) ?? params.message ?? 'MCP tool call';
    const itemId = typeof params.itemId === 'string' ? params.itemId : `mcp-${req.requestId}`;
    return {
      requestId: req.requestId,
      kind: 'commandExecution',
      threadId: req.threadId,
      turnId,
      itemId,
      status: req.status === 'resolved' ? 'resolved' : 'pending',
      command: String(toolDesc),
      reason: (params.message as string) ?? null,
      availableDecisions: ['accept', 'decline'],
    };
  }

  if (method === 'item/commandExecution/requestApproval') {
    const itemId = typeof params.itemId === 'string' ? params.itemId : `cmd-${req.requestId}`;
    return {
      requestId: req.requestId,
      kind: 'commandExecution',
      threadId: req.threadId,
      turnId,
      itemId,
      status: req.status === 'resolved' ? 'resolved' : 'pending',
      command: (params.command as string) ?? null,
      cwd: (params.cwd as string) ?? null,
      reason: (params.reason as string) ?? null,
      availableDecisions: parseAvailableDecisions(params.availableDecisions),
      proposedExecpolicyAmendment: parseStringArray(params.proposedExecpolicyAmendment),
      proposedNetworkPolicyAmendments: parseNetworkAmendments(params.proposedNetworkPolicyAmendments),
    };
  }

  if (method === 'item/fileChange/requestApproval') {
    const itemId = typeof params.itemId === 'string' ? params.itemId : `file-${req.requestId}`;
    return {
      requestId: req.requestId,
      kind: 'fileChange',
      threadId: req.threadId,
      turnId,
      itemId,
      status: req.status === 'resolved' ? 'resolved' : 'pending',
      reason: (params.reason as string) ?? null,
      grantRoot: (params.grantRoot as string) ?? null,
    };
  }

  return null;
}

/**
 * Fetches pending approvals for a thread and hydrates them into the store.
 * If autoApprove is enabled, automatically responds 'accept' to each.
 */
export async function hydratePendingApprovals(threadId: string): Promise<void> {
  try {
    const { data } = await pendingApprovalsListPending({
      query: { threadIds: threadId },
    });
    if (!data?.requests?.length) return;

    const store = useTimelineStore.getState();
    const autoApprove = store.autoApprove;

    for (const req of data.requests) {
      if (req.status !== 'pending') continue;

      const approval = toApprovalRequest(req);
      if (!approval) continue;

      // Hydrate into store so the UI can render it.
      store.addApprovalForThread(threadId, approval);

      // Auto-approve if the user has enabled it.
      if (autoApprove) {
        void pendingApprovalsRespond({
          path: { requestId: String(req.requestId) },
          body: { result: { decision: 'accept' } },
        })
          .then(() => store.resolveApprovalForThread(threadId, approval.itemId, 'accepted'))
          .catch(() => undefined);
      }
    }
  } catch {
    // Non-critical — don't block thread loading on hydration failure.
  }
}
