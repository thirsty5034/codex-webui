/**
 * Notification core hook & utilities.
 *
 * Provides:
 * - useNotificationPermission() — React hook for browser Notification permission
 * - sendReplyNotification() — standalone async function, callable from event handlers
 * - Web Audio API dual-tone sound (no external audio files)
 */
import { useCallback, useState } from 'react';
import { settingsListSettings } from '@/generated/api/sdk.gen';
import { useTimelineStore } from '@/stores/timeline-store';

// ── Lazy singleton AudioContext ──────────────────────────────────────

let _audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!_audioCtx) {
    _audioCtx = new AudioContext();
  }
  if (_audioCtx.state === 'suspended') {
    void _audioCtx.resume();
  }
  return _audioCtx;
}

// ── Web Audio API dual-tone notification sound ────────────────────────


function playNotificationSound(): void {
  try {
    const ctx = getAudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    // Tone 1: A5 (880 Hz)
    const osc1 = ctx.createOscillator();
    osc1.frequency.value = 880;
    osc1.type = 'sine';
    osc1.connect(gain);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.15);

    // Tone 2: A6 (1760 Hz), 150 ms later
    const osc2 = ctx.createOscillator();
    osc2.frequency.value = 1760;
    osc2.type = 'sine';
    osc2.connect(gain);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.3);
  } catch {
    // Web Audio API unavailable — silently ignore
  }
}

// ── Browser Notification ──────────────────────────────────────────────

function sendBrowserNotification(title: string, body: string): void {
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: 'codex-webui',
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Notification API unavailable
  }
}

// ── Bark Push Notification ────────────────────────────────────────────

async function sendBarkNotification(
  barkUrl: string,
  barkKey: string,
  title: string,
  body: string,
  sound?: string,
): Promise<void> {
  try {
    const url = `${barkUrl.replace(/\/+$/, '')}/${encodeURIComponent(barkKey)}/${encodeURIComponent(title)}/${encodeURIComponent(body)}`;
    const params = new URLSearchParams();
    if (sound && sound !== 'default') params.set('sound', sound);
    await fetch(`${url}?${params.toString()}`, { method: 'GET', mode: 'no-cors' });
  } catch {
    // Bark network failure — silently ignore
  }
}

// ── Public: Send notification on turn completion ──────────────────────

export async function sendReplyNotification(): Promise<void> {
  try {
    const { data } = await settingsListSettings({
      query: { category: 'notifications' },
      throwOnError: true,
    });
    const settings = Object.fromEntries(
      data.settings.map((s) => [s.key, s.value]),
    );

    // Global toggle
    if (settings['notifications.enabled'] === false) return;

    const type = settings['notifications.type'] as string;
    if (type === 'none') return;

    // Build notification body from current thread title
    const threadId = useTimelineStore.getState().threadId;
    const threadTitle = threadId
      ? useTimelineStore.getState().threadsById[threadId]?.threadTitle
      : null;
    const title = 'Codex WebUI';
    const body = threadTitle || 'AI 回复已完成';
    const soundEnabled = settings['notifications.soundEnabled'] !== false;

    const doBrowser = type === 'browser' || type === 'both';
    const doBark = type === 'bark' || type === 'both';

    if (doBrowser) {
      sendBrowserNotification(title, body);
    }
    if (doBark) {
      const barkUrl = settings['notifications.barkUrl'] as string;
      const barkKey = settings['notifications.barkKey'] as string;
      if (barkUrl && barkKey) {
        void sendBarkNotification(
          barkUrl,
          barkKey,
          title,
          body,
          soundEnabled ? (settings['notifications.barkSound'] as string) : undefined,
        );
      }
    }
    if (soundEnabled) {
      playNotificationSound();
    }
  } catch (err) {
    console.warn('[notifications] sendReplyNotification failed:', err);
  }
}

// ── React Hook: Browser Notification permission management ───────────

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>(
    () => Notification.permission,
  );

  const requestPermission = useCallback(async () => {
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  return { permission, requestPermission };
}
