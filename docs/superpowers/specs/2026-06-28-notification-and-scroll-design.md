# 通知功能 & 点击对话自动滚动设计文档

> 日期：2026-06-28
> 状态：草稿（V2 — 融合方案）

---

## 1. 功能概述

本次新增两个功能：

1. **通知功能**：AI 回复完成后，通过浏览器 Notification API 和/或 Bark 推送向用户发送带声音的通知。用户可在设置中分别控制通知开关、通知方式以及声音开关。
2. **点击对话自动滚动到底部**：用户从侧边栏点击一个对话时，自动滚动到该对话时间线的最底部（切换对话用 `auto` 直接跳转，同对话新消息用 `smooth` 平滑滚动）。

---

## 2. 通知功能详细设计

### 2.1 触发时机

- **主要触发**：当 Codex CLI 发出 `turn/completed` 事件时触发，**不区分当前活跃对话**——用户可能只是挂着页面但人已离开屏幕，因此任何对话完成都应通知。
- **排除场景**：仅当 turn 成功完成（`status !== 'failed'`）时触发。错误场景已有 Snackbar 提示，不再重复通知。
- **去重**：短时间内相同的错误已完成通知不再重复发送。

### 2.2 通知方式

#### 2.2.1 浏览器通知 (Browser Notification)

- 使用 Web API `Notification` 接口
- 需要先请求权限：`Notification.requestPermission()`
- 通知内容：
  - **标题**："Codex WebUI"
  - **正文**：对话标题（thread title），若无则使用通用文案 "AI 回复已完成"
  - **图标**：使用站点 favicon
  - **声音**：使用 **Web Audio API** 生成双音调提示音（`OscillatorNode`），无需额外音频文件
- 点击通知窗口聚焦页面（`window.focus()`）并关闭通知

#### 2.2.2 Bark 通知

- 使用 Bark 推送 API：`GET <bark_url>/<bark_key>/<title>/<body>?sound=<sound>`
- Bark 服务器地址和设备密钥由用户在设置中配置
- 支持自定义提示音（通过 `sound` 参数）
- 通知内容同浏览器通知

### 2.3 设置项

在设置页面新增"通知"分类（`notifications`），包含以下设置项：

| 设置键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `notifications.enabled` | boolean | `true` | 全局通知总开关 |
| `notifications.type` | string（`browser` / `bark` / `both` / `none`） | `"browser"` | 通知方式：浏览器通知、Bark 推送、两者同时、静默 |
| `notifications.barkUrl` | string | `""` | Bark 服务器地址（如 `https://api.day.app`） |
| `notifications.barkKey` | string | `""` | Bark 设备密钥 |
| `notifications.barkSound` | string | `"default"` | Bark 推送提示音 |
| `notifications.soundEnabled` | boolean | `true` | 通知是否带声音 |

> `type: "none"` 等效于关闭，但保留 `enabled` 总开关以便快速切换。

### 2.4 实现架构

```
┌─────────────────────────────────────────────────────────────┐
│                  后端 (NestJS)                                │
│  src/settings/settings.definitions.ts                       │
│  └─ SETTING_CATEGORIES 新增 'notifications'                 │
│  └─ SETTINGS_DEFINITIONS 新增 6 条定义                       │
│  └─ settings.service.ts 自动 reconcile（无需人工干预）       │
├─────────────────────────────────────────────────────────────┤
│                  前端 (React)                                 │
│  use-notifications.ts          ← 通知核心 hook（新建）       │
│    ├─ 请求浏览器 Notification 权限                           │
│    ├─ sendReplyNotification() 发送逻辑                       │
│    ├─ Web Audio API 双音调提示音                             │
│    └─ Bark fetch 封装                                        │
│                                                              │
│  notification-settings.tsx     ← 设置页 UI 组件（新建）      │
│    ├─ 使用 useCategorySettings('notifications')              │
│    ├─ 权限请求按钮 + 权限状态显示                            │
│    ├─ 通知方式选择、Bark 配置、声音开关                      │
│    └─ "发送测试通知"按钮                                     │
│                                                              │
│  notification-handlers.ts      ← 集成点（修改）              │
│    └─ handleTurnCompleted 中调用 sendReplyNotification()     │
└─────────────────────────────────────────────────────────────┘
```

### 2.5 后端变更

#### 2.5.1 新增分类

在 `src/settings/settings.definitions.ts` 中：

```typescript
export const SETTING_CATEGORIES = [
  'terminal',
  'files',
  'security',
  'general',
  'notifications',   // ← 新增
] as const;
```

#### 2.5.2 新增设置键常量

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

#### 2.5.3 新增设置定义

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
    enum: ['browser', 'bark', 'both', 'none'],
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

> 启动时 settings service 的 reconcile 逻辑会自动 INSERT 新设置行，不会覆盖用户已有值。

### 2.6 前端实现

#### 2.6.1 通知核心 Hook：`web/src/hooks/use-notifications.ts`

```typescript
import { useCallback, useState } from 'react';
import { settingsListSettings } from '@/generated/api/sdk.gen';

// ── Web Audio API 双音调提示音 ──────────────────────────────
function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    // 第一音：A5 (880 Hz)
    const osc1 = ctx.createOscillator();
    osc1.frequency.value = 880;
    osc1.type = 'sine';
    osc1.connect(gain);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.15);

    // 第二音：A6 (1760 Hz)，间隔 0.15s
    const osc2 = ctx.createOscillator();
    osc2.frequency.value = 1760;
    osc2.type = 'sine';
    osc2.connect(gain);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.3);
  } catch {
    // Web Audio API 不可用时静默失败
  }
}

// ── 浏览器通知 ────────────────────────────────────────────────
function sendBrowserNotification(title: string, body: string): void {
  if (Notification.permission !== 'granted') return;
  const n = new Notification(title, { body, icon: '/favicon.ico', tag: 'codex-webui' });
  n.onclick = () => { window.focus(); n.close(); };
}

// ── Bark 通知 ─────────────────────────────────────────────────
async function sendBarkNotification(
  barkUrl: string,
  barkKey: string,
  title: string,
  body: string,
  sound?: string,
): Promise<void> {
  const url = `${barkUrl}/${barkKey}/${encodeURIComponent(title)}/${encodeURIComponent(body)}`;
  const params = new URLSearchParams();
  if (sound && sound !== 'default') params.set('sound', sound);
  await fetch(`${url}?${params.toString()}`, { method: 'GET', mode: 'no-cors' });
}

// ── 通知发送入口 ──────────────────────────────────────────────
export async function sendReplyNotification(): Promise<void> {
  try {
    const { data } = await settingsListSettings({
      query: { category: 'notifications' },
      throwOnError: true,
    });
    const settings = Object.fromEntries(
      data.settings.map((s) => [s.key, s.value]),
    );

    if (settings['notifications.enabled'] === false) return;

    const type = settings['notifications.type'] as string;
    if (type === 'none') return;

    const title = 'Codex WebUI';
    const body = (settings['_threadTitle'] as string) || 'AI 回复已完成';
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
    // 通知失败静默处理
  }
}

// ── 浏览器通知权限 Hook ───────────────────────────────────────
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

#### 2.6.2 集成到 `notification-handlers.ts`

修改 `handleTurnCompleted`，在现有逻辑末尾增加通知调用：

```typescript
const handleTurnCompleted: Handler = (params, ctx) => {
  // ... 现有逻辑（更新 timeline、清理状态等）保持不变 ...

  // 新增：异步发送通知（不阻塞主流程）
  if (turn?.status !== 'failed') {
    void sendReplyNotification();
  }
};
```

需要在文件顶部导入 `sendReplyNotification`。

> **为什么不传递 threadTitle？** 通知 hook 内部通过 `settingsListSettings` 读取设置，`threadTitle` 可以通过读取 `useTimelineStore` 当前活跃线程获取，或在通知调用前注入。更简单的做法：`handleTurnCompleted` 中可以读取当前 thread title 后注入。但为了保持 handler 简洁，可在 `sendReplyNotification` 内部直接从 store 读取：

```typescript
const threadId = useTimelineStore.getState().threadId;
const threadTitle = threadId
  ? useTimelineStore.getState().threadsById[threadId]?.threadTitle
  : null;
```

#### 2.6.3 设置页面组件：`web/src/components/settings/notification-settings.tsx`

- 使用 `useCategorySettings('notifications')` 管理设置
- 使用 `useNotificationPermission()` 管理浏览器通知权限
- UI 布局：
  - **全局开关**：Toggle（`notifications.enabled`）
  - **通知方式**：Select（`browser` / `bark` / `both` / `none`）
  - **浏览器通知权限**：显示当前权限状态 + "请求权限"按钮（仅当 `permission !== 'granted'` 时显示）
  - **Bark 配置**（展开/折叠）：Bark 服务器地址 Input + 设备密钥 Input（密码模式）+ 提示音 Select
  - **声音开关**：Toggle（`notifications.soundEnabled`）
  - **测试通知按钮**：点击后调用 `sendReplyNotification()` 触发一次通知

#### 2.6.4 注册设置页面

在 `web/src/components/settings/settings-page.tsx` 中：

```typescript
const SECTIONS = [
  'general',
  'account',
  'codex',
  'terminal',
  'files',
  'security',
  'notifications',   // ← 新增
] as const;
```

在 `sectionLabel()` 中添加映射：

```typescript
function sectionLabel(section: string): string {
  const labels: Record<string, string> = {
    general: 'General',
    account: 'Account',
    codex: 'Codex',
    terminal: 'Terminal',
    files: 'Files',
    security: 'Security',
    notifications: 'Notifications',
  };
  return labels[section] ?? section;
}
```

在设置页渲染中新增条件分支：

```typescript
{section === 'notifications' && <NotificationSettings />}
```

### 2.7 声音实现对比

| 方案 | 实现方式 | 优点 | 缺点 |
|---|---|---|---|
| ~~`new Audio()` 加载文件~~ | 需要外部 mp3/wav 或 Base64 | 音质可控 | 加载延迟、网络失败风险 |
| **Web Audio API 生成音调** ✅ | `OscillatorNode` + `GainNode` | 零依赖、无加载、即时播放 | 音色较简单（双音调） |

**选择 Web Audio API 方案**，不需要任何音频文件。

---

## 3. 点击对话自动滚动到底部详细设计

### 3.1 现状分析

当前 `chat-timeline.tsx` 已有以下滚动逻辑：

1. **`useEffect` on `[timeline, virtualizer]`**（第 253-272 行）：当 timeline 长度变化且 `shouldAutoScroll.current` 为 true 时，滚动到底部。
2. **`useEffect` on `[threadId]`**（第 274-282 行）：当 `threadId` 变化时，设置 `shouldAutoScroll.current = true` 并滚动到底部。

潜在问题：从侧边栏切换对话时，`threadId` 变化触发 effect #2，但此时 timeline 可能为空（数据未加载），滚动无效。之后数据加载完成触发 effect #1，但 `previousCount === 0` 时 `appended` 为 false，走 `'auto'` 分支，可以正确跳转。但 `shouldAutoScroll.current` 可能在 effect #2 中被设为 true，所以应该工作。

不过在实践中，当用户快速切换对话时，效果可能不稳定。

### 3.2 改进方案

在 `chat-timeline.tsx` 中增强滚动逻辑：

```typescript
// 新增：追踪当前 threadId 对应的 timeline 是否已完成首次渲染
const lastRenderedThreadRef = useRef<string | null>(null);

// 场景 A：切换对话 → behavior: 'auto'（直接跳转）
useEffect(() => {
  if (timeline.length > 0 && lastRenderedThreadRef.current !== threadId) {
    lastRenderedThreadRef.current = threadId;
    shouldAutoScroll.current = true;
    virtualizer.scrollToIndex(timeline.length - 1, { align: 'end', behavior: 'auto' });
  }
}, [threadId, timeline.length, virtualizer]);

// 场景 B：同对话新消息 → behavior: 'smooth'（平滑滚动，已有逻辑增强）
// 已有逻辑（timeline length 变化时的自动滚动）保持不变
```

**行为总结**：

| 场景 | 行为 | behavior |
|---|---|---|
| 点击侧边栏切换到另一个对话 | 立即跳转到底部 | `auto` |
| 同一个对话中收到新消息 | 平滑滚动到底部 | `smooth`（已有逻辑） |
| 页面首次加载/刷新 | 立即跳转到底部 | `auto` |

### 3.3 涉及变更文件

| 文件 | 变更说明 |
|---|---|
| `web/src/components/chat/chat-timeline.tsx` | 新增 `lastRenderedThreadRef` 逻辑，明确区分 auto/smooth |
| `src/settings/settings.definitions.ts` | 新增 `notifications` 分类和 6 个设置定义 |
| `web/src/hooks/use-notifications.ts` | **新增** — 通知核心 hook |
| `web/src/hooks/notification-handlers.ts` | 在 `handleTurnCompleted` 中集成通知调用 |
| `web/src/components/settings/notification-settings.tsx` | **新增** — 通知设置 UI |
| `web/src/components/settings/settings-page.tsx` | 注册 `notifications` 分类标签页 |
| `web/src/components/settings/setting-helpers.ts` | 添加 `notifications` 的 sectionLabel 映射 |

---

## 4. 影响范围与风险

### 4.1 通知功能

| 维度 | 影响 |
|---|---|
| **安全性** | Bark 设备密钥存储在后端 runtime settings DB（通过 API 读写），不暴露在前端 localStorage，比之前方案更安全 |
| **性能** | 通知发送为异步非阻塞操作，不影响主流程 |
| **兼容性** | 浏览器通知需要 HTTPS 或 localhost；Bark 需要网络访问；Web Audio API 支持所有现代浏览器 |
| **i18n** | 需添加中文/英文翻译条目（约 15 条） |

### 4.2 自动滚动

| 维度 | 影响 |
|---|---|
| **安全性** | 无 |
| **性能** | 无 |
| **兼容性** | 与现有 TanStack Virtual 虚拟列表完全兼容 |
| **回归风险** | 低。改动范围小，与现有滚动逻辑互补 |

---

## 5. 待定项（实施阶段确认）

1. **通知分组**：Bark 是否需要用 `group` 参数将同一对话的多条通知折叠？
2. **通知频率限制**：短时间内多个对话几乎同时完成，是否需要防抖（Debounce）合并通知？
3. **`handleTurnCompleted` 中获取 threadTitle 的方式**：从 `useTimelineStore` 读取还是由 handler 参数传递？
