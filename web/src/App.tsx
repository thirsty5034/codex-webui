import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { getSocket } from './socket';
import './App.css';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  itemId?: string;
}

function App() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Disconnected');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Socket.io event listeners
  useEffect(() => {
    const socket = getSocket();

    socket.on('connect', () => setStatus('Connected'));
    socket.on('disconnect', () => setStatus('Disconnected'));

    socket.on('codex.notification', (notification: { method: string; params: Record<string, unknown> }) => {
      const { method, params } = notification;

      if (method === 'item/agentMessage/delta') {
        const itemId = params.itemId as string;
        const text = params.delta as string;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && last.itemId === itemId) {
            return [...prev.slice(0, -1), { ...last, content: last.content + text }];
          }
          return [...prev, { role: 'assistant', content: text, itemId }];
        });
      }

      if (method === 'item/completed') {
        const item = params.item as Record<string, unknown> | undefined;
        if (item?.type === 'agentMessage') {
          const itemId = params.itemId as string;
          const text = (item.text as string) ?? '';
          // Calibrate with final content
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.itemId === itemId);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], content: text };
              return updated;
            }
            return prev;
          });
        }
      }

      if (method === 'turn/completed') {
        setLoading(false);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('codex.notification');
    };
  }, []);

  const createThread = useCallback(async () => {
    try {
      setStatus('Creating thread...');
      const res = await api.createThread({});
      setThreadId(res.thread.id);
      setMessages([]);
      setStatus('Connected');

      // Subscribe to thread events
      const socket = getSocket();
      socket.emit('thread.subscribe', { threadId: res.thread.id });
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }, []);

  const sendMessage = useCallback(async () => {
    if (!threadId || !input.trim() || loading) return;

    const text = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      await api.sendMessage(threadId, text);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'system', content: `Error: ${(err as Error).message}` },
      ]);
      setLoading(false);
    }
  }, [threadId, input, loading]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void sendMessage();
      }
    },
    [sendMessage],
  );

  return (
    <div className="chat-container">
      <header className="chat-header">
        <h1>Codex WebUI</h1>
        <span className="status">{status}</span>
        <button type="button" onClick={() => void createThread()}>
          New Thread
        </button>
      </header>

      <main className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message message-${msg.role}`}>
            <span className="message-role">{msg.role}</span>
            <pre className="message-content">{msg.content}</pre>
          </div>
        ))}
        {loading && <div className="message message-system">Thinking...</div>}
        <div ref={bottomRef} />
      </main>

      <footer className="chat-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={threadId ? 'Type a message...' : 'Create a thread first'}
          disabled={!threadId || loading}
          rows={2}
        />
        <button
          type="button"
          onClick={() => void sendMessage()}
          disabled={!threadId || !input.trim() || loading}
        >
          Send
        </button>
      </footer>
    </div>
  );
}

export default App;
