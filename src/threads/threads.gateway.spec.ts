import { Test, TestingModule } from '@nestjs/testing';
import { ThreadsGateway } from './threads.gateway';
import { CodexProcessManager } from '../codex/codex-process-manager.service';

describe('ThreadsGateway', () => {
  let gateway: ThreadsGateway;
  const listeners: Record<string, (...args: unknown[]) => void> = {};

  const mockManager = {
    addListener: jest.fn(
      (event: string, handler: (...args: unknown[]) => void) => {
        listeners[event] = handler;
      },
    ),
    getClient: jest.fn(),
  };

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThreadsGateway,
        { provide: CodexProcessManager, useValue: mockManager },
      ],
    }).compile();

    gateway = module.get(ThreadsGateway);
    gateway.server = mockServer as never;
    gateway.afterInit();

    jest.clearAllMocks();
    mockServer.to.mockReturnThis();
  });

  it('should join room on subscribe', () => {
    const client = { id: 'c1', join: jest.fn() };
    const result = gateway.handleSubscribe(client as never, {
      threadId: 't1',
    });
    expect(client.join).toHaveBeenCalledWith('thread:t1');
    expect(result).toEqual({ ok: true });
  });

  it('should leave room on unsubscribe', () => {
    const client = { id: 'c1', leave: jest.fn() };
    const result = gateway.handleUnsubscribe(client as never, {
      threadId: 't1',
    });
    expect(client.leave).toHaveBeenCalledWith('thread:t1');
    expect(result).toEqual({ ok: true });
  });

  it('should route thread-scoped notification to room', () => {
    const notification = {
      method: 'item/agentMessage/delta',
      params: { threadId: 't1', text: 'hello' },
    };

    listeners['notification'](notification);

    expect(mockServer.to).toHaveBeenCalledWith('thread:t1');
    expect(mockServer.emit).toHaveBeenCalledWith(
      'codex.notification',
      notification,
    );
  });

  it('should broadcast non-thread notifications', () => {
    const notification = {
      method: 'error',
      params: { message: 'something broke' },
    };

    listeners['notification'](notification);

    expect(mockServer.to).not.toHaveBeenCalled();
    expect(mockServer.emit).toHaveBeenCalledWith(
      'codex.notification',
      notification,
    );
  });

  it('should forward server response to codex client', () => {
    const mockClient = { respondToServerRequest: jest.fn() };
    mockManager.getClient.mockReturnValue(mockClient);

    gateway.handleServerResponse({ id: 42, result: { approved: true } });

    expect(mockClient.respondToServerRequest).toHaveBeenCalledWith(42, {
      approved: true,
    });
  });
});
