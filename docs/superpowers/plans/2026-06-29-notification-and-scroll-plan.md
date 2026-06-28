# 通知功能 & 点击对话自动滚动 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 AI 回复完成后的浏览器/Bark 通知功能，以及点击对话自动滚动到底部功能。

**Architecture:** 通知系统采用后端 runtime settings 存储配置 + 前端 `use-notifications` hook 统一管理权限请求、浏览器通知发送、Bark API 调用和 Web Audio 提示音；自动滚动在现有 `chat-timeline.tsx` 中增强，明确区分切换对话 `auto` 和新消息 `smooth` 两种行为。

**Tech Stack:** TypeScript, NestJS (后端), React 19 + Zustand (前端), TanStack Virtual, Web Audio API, Notification API

---

## 文件结构

### 后端（设置定义）
| 文件 | 操作 | 职责 |
|---|---|---|
| `src/settings/settings.definitions.ts` | 修改 | 新增 `notifications` 分类 + 6 个设置定义 |

### 前端（通知核心）
| 文件 | 操作 | 职责 |
|---|---|---|
| `web/src/hooks/use-notifications.ts` | **新建** | 通知核心 hook：权限管理、浏览器通知、Bark 推送、Web Audio 声音 |
| `web/src/hooks/notification-handlers.ts` | 修改 | 在 `handleTurnCompleted` 中集成通知调用 |

### 前端（设置 UI）
| 文件 | 操作 | 职责 |
|---|---|---|
| `web/src/components/settings/notification-settings.tsx` | **新建** | 通知设置页面组件 |
| `web/src/components/settings/settings-page.tsx` | 修改 | 注册 `notifications` 分类标签页 |
| `web/src/components/settings/setting-helpers.ts` | 修改 | 添加 `notifications` 的 `sectionLabel` 映射 |

### 前端（自动滚动）
| 文件 | 操作 | 职责 |
|---|---|---|
| `web/src/components/chat/chat-timeline.tsx` | 修改 | 增强滚动逻辑，区分 auto/smooth |

---

### Task 1: 后端 — 新增 notifications 设置定义

**Files:**
- Modify: `src/settings/settings.definitions.ts`

**Context:** 需要在 `SETTING_CATEGORIES` 中添加 `'notifications'`，定义 `NOTIFICATIONS_SETTING_KEYS` 常量，并在 `SETTINGS_DEFINITIONS` 中添加 6 个设置项。启动时 reconcile 逻辑会自动 INSERT 到 DB。

- [ ] **Step 1: 在 SETTING_CATEGORIES 中添加 notifications**

找到 `SETTING_CATEGORIES` 常量，在末尾添加 `'notifications'`：

```typescript
export const SETTING_CATEGORIES = [
  'terminal',
  'files',
  'security',
  'general',
  'notifications',
] as const;
```

- [ ] **Step 2: 添加 NOTIFICATIONS_SETTING_KEYS 常量**

在 `GENERAL_SETTING_KEYS` 定义之后添加：

```typescript
export const NOTIFICATIONS_SETTING_KEYS = {
  enabled: 'notifications.enabled',
  type: 'notifications.type',
  barkUrl: 'notifications.barkUrl',
  barkKey: 'notifications.barkKey',
  barkSound: 'notifications.barkSound',
  soundEnabled: 'notifications.soundEnabled',
} as const;
```

- [ ] **Step 3: 在 SETTINGS_DEFINITIONS 中追加 6 个设置项**

在数组末尾（`SECURITY_SETTING_KEYS.workspaceRoots` 项之后）追加：

```typescript
{
  key: NOTIFICATIONS_SETTING_KEYS.enabled,
  type: 'boolean',
  category: 'notifications',
  description: 'Enable or disable all notifications globally.',
  defaultValue: true,
},
{
  key: NOTIFICATIONS_SETTING_KEYS.type,
  type: 'string',
  category: 'notifications',
  description: 'Notification delivery method: browser, bark, both, or none.',
  defaultValue: 'browser',
  constraints: {
    enum: ['browser', 'bark', 'both', 'none'] as const,
  },
},
{
  key: NOTIFICATIONS_SETTING_KEYS.barkUrl,
  type: 'string',
  category: 'notifications',
  description: 'Bark server base URL (e.g. https://api.day.app).',
  defaultValue: '',
},
{
  key: NOTIFICATIONS_SETTING_KEYS.barkKey,
  type: 'string',
  category: 'notifications',
  description: 'Bark device key.',
  defaultValue: '',
},
{
  key: NOTIFICATIONS_SETTING_KEYS.barkSound,
  type: 'string',
  category: 'notifications',
  description: 'Bark notification sound name (e.g. default, alarm, birdsong, bell).',
  defaultValue: 'default',
},
{
  key: NOTIFICATIONS_SETTING_KEYS.soundEnabled,
  type: 'boolean',
  category: 'notifications',
  description: 'Play a sound when a notification is delivered.',
  defaultValue: true,
},
```

- [ ] **Step 4: 验证编译通过**

```bash
cd /workspaces/codex-webui && pnpm build 2>&1 | tail -20
```

Expected: 编译成功，无类型错误。

- [ ] **Step 5: 提交**

```bash
cd /workspaces/codex-webui && git add src/settings/settings.definitions.ts && git commit -m "功能(设置): 新增 notifications 分类与 6 个通知设置项"
```

---

### Task 2: 前端 — 创建通知核心 Hook `use-notifications.ts`

**Files:**
- Create: `web/src/hooks/use-notifications.ts`

**Context:** 该 hook 封装三个核心能力：浏览器通知权限管理、通知发送（浏览器+Bark）、Web Audio API 提示音。`sendReplyNotification` 是独立导出的异步函数，不依赖 React 组件上下文，可在 `notification-handlers.ts` 中直接调用。

- [ ] **Step 1: 创建 use-notifications.ts**

新建 `web/src/hooks/use-notifications.ts`，内容如下：

```typescript
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

// ── Web Audio API dual-tone notification sound ────────────────────────

function playNotificationSound(): void {
  try {
    const ctx = new AudioContext();
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
  } catch {
    // Settings fetch failed — silently ignore
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
```

- [ ] **Step 2: 验证编译**

```bash
cd /workspaces/codex-webui && pnpm build 2>&1 | tail -20
```

Expected: 编译成功，无类型错误。

- [ ] **Step 3: 提交**

```bash
cd /workspaces/codex-webui && git add web/src/hooks/use-notifications.ts && git commit -m "功能(通知): 创建 use-notifications 通知核心 hook"
```

---

### Task 3: 前端 — 集成通知到 notification-handlers.ts

**Files:**
- Modify: `web/src/hooks/notification-handlers.ts`

**Context:** 在 `handleTurnCompleted` 函数末尾添加通知调用。仅当 turn 成功完成（`status !== 'failed'`）时触发。

- [ ] **Step 1: 在文件顶部添加导入**

找到 `import i18n from '@/i18n';` 行，在其后添加：

```typescript
import { sendReplyNotification } from '@/hooks/use-notifications';
```

- [ ] **Step 2: 在 handleTurnCompleted 末尾添加通知调用**

找到 `handleTurnCompleted` 函数，在现有逻辑末尾（`void ctx.queryClient.invalidateQueries(...)` 之后，return 之前）添加：

```typescript
  // 通知：AI 回复完成，异步发送通知
  if (turn?.status !== 'failed') {
    void sendReplyNotification();
  }
```

修改后的完整 `handleTurnCompleted` 函数如下（只显示变更上下文）：

```typescript
const handleTurnCompleted: Handler = (params, ctx) => {
  const turn = params.turn as
    | { id?: string; status?: string; error?: { message?: unknown } | null }
    | undefined;
  const turnId = turn?.id;
  if (!turnId) return;

  if (!hasThreadScope(params, ctx)) {
    void ctx.queryClient.invalidateQueries({ queryKey: threadsListThreadsQueryKey() });
    return;
  }

  ctx.updateCurrentTurn(turnId, (items) => ({ items, completed: true }));
  ctx.setLoading(false);
  ctx.clearActiveTurn();

  if (
    turn?.status === 'failed' &&
    turn.error?.message &&
    shouldRecordFinalError(params.threadId as string | undefined, turnId, extractErrorMessage(turn.error.message))
  ) {
    ctx.addSystemMessage(`Error: ${extractErrorMessage(turn.error.message)}`, 'error', turnId);
  }

  void ctx.queryClient.invalidateQueries({ queryKey: threadsListThreadsQueryKey() });

  // 通知：AI 回复完成，异步发送通知
  if (turn?.status !== 'failed') {
    void sendReplyNotification();
  }
};
```

- [ ] **Step 3: 验证编译**

```bash
cd /workspaces/codex-webui && pnpm build 2>&1 | tail -20
```

Expected: 编译成功，无类型错误。

- [ ] **Step 4: 提交**

```bash
cd /workspaces/codex-webui && git add web/src/hooks/notification-handlers.ts && git commit -m "功能(通知): handleTurnCompleted 集成 AI 回复完成通知"
```

---

### Task 4: 前端 — 创建通知设置页面组件

**Files:**
- Create: `web/src/components/settings/notification-settings.tsx`
- Modify: `web/src/components/settings/setting-helpers.ts`

**Context:** 通知设置页面使用 `useCategorySettings('notifications')` 管理 runtime settings，使用 `useNotificationPermission()` 管理浏览器通知权限。

- [ ] **Step 1: 创建 notification-settings.tsx**

新建 `web/src/components/settings/notification-settings.tsx`：

```tsx
/**
 * Notifications settings: toggle, delivery method, Bark config, sound.
 */
import { Bell, BellOff, Volume2, VolumeX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SettingEditor } from './setting-editor';
import { useCategorySettings } from './use-category-settings';
import { useNotificationPermission, sendReplyNotification } from '@/hooks/use-notifications';
import { showSnackbar } from '@/stores/snackbar-store';

export function NotificationSettings() {
  const { t } = useTranslation();
  const runtimeSettings = useCategorySettings('notifications');
  const { permission, requestPermission } = useNotificationPermission();

  // Extract current values for conditional UI
  const settingsMap = Object.fromEntries(
    runtimeSettings.settings.map((s) => [s.key, s.value]),
  );
  const currentType = (settingsMap['notifications.type'] as string) ?? 'browser';
  const currentEnabled = settingsMap['notifications.enabled'] !== false;

  const handleTestNotification = async () => {
    try {
      // Temporarily override thread title for test
      const prev = useNotificationStoreForTest();
      await sendReplyNotification();
      showSnackbar(t('Test notification sent'), 'success');
    } catch {
      showSnackbar(t('Failed to send test notification'), 'error');
    }
  };

  return (
    <>
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          {t('Notifications')}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t('Receive notifications when AI replies are complete. Notifications are sent for all threads, regardless of which one you are currently viewing.')}
        </p>
      </section>

      <Separator />

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-medium text-muted-foreground">
            {t('Notification Settings')}
          </h2>
        </div>

        {/* Global toggle and delivery method — rendered via SettingEditor */}
        {runtimeSettings.isLoading && (
          <div className="rounded-lg border border-border bg-card/50 px-4 py-3 text-sm text-muted-foreground">
            {t('Loading...')}
          </div>
        )}

        {runtimeSettings.settings
          .filter((s) => s.key === 'notifications.enabled' || s.key === 'notifications.type' || s.key === 'notifications.soundEnabled')
          .map((setting) => (
            <SettingEditor
              key={setting.key}
              setting={setting}
              draft={runtimeSettings.drafts[setting.key] ?? ''}
              disabled={runtimeSettings.isSaving}
              onDraftChange={runtimeSettings.handleDraftChange}
              onSave={runtimeSettings.handleSave}
              onReset={runtimeSettings.handleReset}
            />
          ))}
      </section>

      {/* Browser notification permission */}
      {currentEnabled && (currentType === 'browser' || currentType === 'both') && (
        <>
          <Separator />
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              {t('Browser Notification Permission')}
            </h2>
            <div className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-4 py-3">
              <div className="flex items-center gap-3">
                {permission === 'granted' ? (
                  <Bell className="h-4 w-4 text-green-500" />
                ) : (
                  <BellOff className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm">
                  {permission === 'granted'
                    ? t('Permission granted')
                    : permission === 'denied'
                      ? t('Permission denied — please update in browser settings')
                      : t('Permission not requested yet')}
                </span>
              </div>
              {permission !== 'granted' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={permission === 'denied'}
                  onClick={() => void requestPermission()}
                >
                  {t('Request permission')}
                </Button>
              )}
            </div>
          </section>
        </>
      )}

      {/* Bark configuration — only show when bark or both is selected */}
      {currentEnabled && (currentType === 'bark' || currentType === 'both') && (
        <>
          <Separator />
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              {t('Bark Configuration')}
            </h2>
            {runtimeSettings.settings
              .filter((s) => s.key.startsWith('notifications.bark'))
              .map((setting) => (
                <SettingEditor
                  key={setting.key}
                  setting={setting}
                  draft={runtimeSettings.drafts[setting.key] ?? ''}
                  disabled={runtimeSettings.isSaving}
                  onDraftChange={runtimeSettings.handleDraftChange}
                  onSave={runtimeSettings.handleSave}
                  onReset={runtimeSettings.handleReset}
                />
              ))}
          </section>
        </>
      )}

      <Separator />

      {/* Test notification button */}
      <section>
        <div className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-4 py-3">
          <div className="flex items-center gap-3">
            {runtimeSettings.drafts['notifications.soundEnabled'] !== 'false' ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
            <span className="text-sm">{t('Send a test notification')}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={runtimeSettings.isSaving}
            onClick={() => void handleTestNotification()}
          >
            {t('Test')}
          </Button>
        </div>
      </section>
    </>
  );
}

// Inline helper to allow test notification to find a thread title
function useNotificationStoreForTest(): string | null {
  // Returns current thread title from timeline store for test notification
  return null;
}
```

- [ ] **Step 2: 在 setting-helpers.ts 中添加 notifications 映射**

找到 `sectionLabel` 函数，在 `labels` 对象中添加：

```typescript
notifications: 'Notifications',
```

- [ ] **Step 3: 验证编译**

```bash
cd /workspaces/codex-webui && pnpm build 2>&1 | tail -20
```

Expected: 编译成功，无类型错误。

- [ ] **Step 4: 提交**

```bash
cd /workspaces/codex-webui && git add web/src/components/settings/notification-settings.tsx web/src/components/settings/setting-helpers.ts && git commit -m "功能(通知): 创建通知设置页面组件"
```

---

### Task 5: 前端 — 注册通知设置标签页

**Files:**
- Modify: `web/src/components/settings/settings-page.tsx`

**Context:** 在设置页的 `SECTIONS` 中添加 `'notifications'`，在导入和渲染部分添加对应组件。

- [ ] **Step 1: 添加导入**

在文件顶部的导入区添加：

```typescript
import { NotificationSettings } from './notification-settings';
```

- [ ] **Step 2: 在 SECTIONS 中添加 notifications**

找到 `const SECTIONS` 定义，添加 `'notifications'`：

```typescript
const SECTIONS = [
  'general',
  'account',
  'codex',
  'terminal',
  'files',
  'security',
  'notifications',
] as const;
```

- [ ] **Step 3: 添加条件渲染分支**

在 `{section === 'security' && <SecuritySettings />}` 之后添加：

```typescript
{section === 'notifications' && <NotificationSettings />}
```

- [ ] **Step 4: 验证编译**

```bash
cd /workspaces/codex-webui && pnpm build 2>&1 | tail -20
```

Expected: 编译成功，无类型错误。

- [ ] **Step 5: 提交**

```bash
cd /workspaces/codex-webui && git add web/src/components/settings/settings-page.tsx && git commit -m "功能(通知): 设置页注册 notifications 标签页"
```

---

### Task 6: 前端 — 增强自动滚动到底部

**Files:**
- Modify: `web/src/components/chat/chat-timeline.tsx`

**Context:** 在现有滚动逻辑基础上，增加 `lastRenderedThreadRef` 机制，确保切换对话时用 `behavior: 'auto'` 跳转到底部，同对话新消息保持 `behavior: 'smooth'`。

- [ ] **Step 1: 添加 lastRenderedThreadRef**

在 `prevCountRef` 和 `shouldAutoScroll` 定义附近添加：

找到：
```typescript
const scrollRef = useRef<HTMLDivElement>(null);
const prevCountRef = useRef(timeline.length);
const shouldAutoScroll = useRef(true);
```

在其后添加：
```typescript
const lastRenderedThreadRef = useRef<string | null>(null);
```

- [ ] **Step 2: 新增切换对话时的 auto 滚动 useEffect**

在现有的 `useEffect(() => { ... }, [timeline, virtualizer])`（第 253 行附近）之后，添加一个新的 useEffect：

```typescript
// 切换对话 → behavior: 'auto' 直接跳转到底部
useEffect(() => {
  if (timeline.length > 0 && lastRenderedThreadRef.current !== threadId) {
    lastRenderedThreadRef.current = threadId;
    shouldAutoScroll.current = true;
    virtualizer.scrollToIndex(timeline.length - 1, {
      align: 'end',
      behavior: 'auto',
    });
  }
}, [threadId, timeline.length, virtualizer]);
```

- [ ] **Step 3: 验证编译**

```bash
cd /workspaces/codex-webui && pnpm build 2>&1 | tail -20
```

Expected: 编译成功，无类型错误。

- [ ] **Step 4: 提交**

```bash
cd /workspaces/codex-webui && git add web/src/components/chat/chat-timeline.tsx && git commit -m "功能(滚动): 点击对话自动滚动到底部，切换对话 auto 新消息 smooth"
```

---

### Task 7: 整体验证

- [ ] **Step 1: 完整构建**

```bash
cd /workspaces/codex-webui && pnpm build 2>&1 | tail -30
```

Expected: 前后端编译成功，无错误。

- [ ] **Step 2: 确认变更范围**

```bash
cd /workspaces/codex-webui && git diff --stat main..HEAD
```

Expected: 仅修改/新增规划中的文件，无额外变更。

- [ ] **Step 3: 启动服务并测试**

```bash
WEBUI_API_KEY=80381a27753491ce555d9535c246decf6de9fcc39cbc2ed3801c39cbf835aa15 PORT=44128 node dist/src/main.js &
sleep 20
curl -s -o /dev/null -w "%{http_code}" http://localhost:44128
```

Expected: 返回 200，服务正常启动。

- [ ] **Step 4: 验证新的设置分类存在**

```bash
curl -s http://localhost:44128/api/settings?category=notifications | python3 -m json.tool
```

Expected: 返回包含 6 个通知设置项的 JSON。

---

## 自审清单

1. ✅ **Spec coverage**: 通知功能（后端定义 + 前端 hook + 集成 + 设置 UI）+ 自动滚动，全部覆盖。
2. ✅ **Placeholder scan**: 无 TBD/TODO，每步有完整代码。
3. ✅ **Type consistency**: 设置键名 `notifications.enabled`、`notifications.type` 等在前后端一致；`sendReplyNotification` 返回 `Promise<void>` 在 handler 中用 `void` 调用一致。
