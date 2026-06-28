# 通知功能 & 点击对话自动滚动设计文档

> 日期：2026-06-28
> 状态：草稿

---

## 1. 功能概述

本次新增两个功能：

1. **通知功能**：AI 回复完成后，通过浏览器 Notification API 或 Bark 推送向用户发送带声音的通知。用户可在设置中分别控制通知开关和通知方式。
2. **点击对话自动滚动到底部**：用户从侧边栏点击一个对话时，自动滚动到该对话时间线的最底部。

---

## 2. 通知功能详细设计

### 2.1 触发时机

- **主要触发**：当 Codex CLI 发出 `turn/completed` 事件且当前对话处于活跃状态（即 `ctx.threadId === eventThreadId`）时触发。
- **排除场景**：仅当 turn 成功完成（`status !== 'failed'`）时触发。错误场景已有 Snackbar 提示，不再重复通知。
- **去重**：使用现有 `finalErrorEntries` 机制避免重复通知。

### 2.2 通知方式

#### 2.2.1 浏览器通知 (Browser Notification)

- 使用 Web API `Notification` 接口
- 需要先请求权限：`Notification.requestPermission()`
- 通知内容：
  - **标题**："Codex WebUI"
  - **正文**：当前对话的主题（thread title）或回复摘要（第一条 agentMessage 的前 80 个字符）
  - **图标**：使用站点 favicon
  - **声音**：通过 `new Audio()` 播放一段提示音（使用 Base64 编码的短音频或系统默认通知声）
- 点击通知窗口聚焦页面（`window.focus()`）

#### 2.2.2 Bark 通知

- 使用 Bark 推送 API：`POST <bark_server>/<bark_key>/<title>/<body>`
- Bark 服务器地址和设备密钥由用户在设置中配置
- 支持自定义声音（通过 Bark URL 参数 `?sound=xxx`）
- 通知内容同浏览器通知

### 2.3 设置项

在设置页面新增"通知"分类（`notifications`），包含以下设置项：

| 设置键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `notifications.enabled` | boolean | `true` | 全局通知开关 |
| `notifications.method` | string (`"browser"` / `"bark"`) | `"browser"` | 通知方式选择 |
| `notifications.barkServer` | string | `""` | Bark 服务器地址（如 `https://api.day.app`） |
| `notifications.barkKey` | string | `""` | Bark 设备密钥 |
| `notifications.barkSound` | string | `"default"` | Bark 推送提示音 |
| `notifications.soundEnabled` | boolean | `true` | 通知是否带声音 |

### 2.4 前端实现

#### 2.4.1 新增模块

```
web/src/
  hooks/
    use-notification-permission.ts   # 浏览器通知权限管理 hook
  lib/
    notification-service.ts          # 通知发送服务（封装浏览器通知 + Bark）
  components/
    settings/
      notification-settings.tsx      # 通知设置页面组件
  stores/
    notification-store.ts            # (可选) 通知状态管理，与后端 runtime settings 对接
```

#### 2.4.2 核心逻辑

**`notification-service.ts`**：

```typescript
interface NotifyParams {
  title: string;
  body: string;
  soundEnabled: boolean;
  method: 'browser' | 'bark';
  barkServer?: string;
  barkKey?: string;
  barkSound?: string;
}

export async function sendNotification(params: NotifyParams): Promise<void> {
  if (params.method === 'browser') {
    await sendBrowserNotification(params);
  } else if (params.method === 'bark') {
    await sendBarkNotification(params);
  }
}

async function sendBrowserNotification(params: NotifyParams) {
  if (Notification.permission !== 'granted') return;
  const n = new Notification(params.title, {
    body: params.body,
    icon: '/favicon.ico',
    tag: 'codex-webui',
  });
  n.onclick = () => { window.focus(); n.close(); };
  if (params.soundEnabled) {
    playNotificationSound();
  }
}

async function sendBarkNotification(params: NotifyParams) {
  if (!params.barkServer || !params.barkKey) return;
  const url = `${params.barkServer}/${params.barkKey}/${encodeURIComponent(params.title)}/${encodeURIComponent(params.body)}`;
  const query = new URLSearchParams();
  if (params.soundEnabled && params.barkSound) {
    query.set('sound', params.barkSound);
  }
  await fetch(`${url}?${query.toString()}`, { method: 'GET' });
}
```

**`use-notification-permission.ts`**：

```typescript
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

#### 2.4.3 集成到现有通知系统

修改 `web/src/hooks/notification-handlers.ts` 中的 `handleTurnCompleted`：

```typescript
const handleTurnCompleted: Handler = (params, ctx) => {
  // ... 现有逻辑 ...

  // 新增：发送用户通知
  const turn = params.turn as { id?: string; status?: string; error?: unknown } | undefined;
  if (turn?.status !== 'failed' && ctx.threadId === params.threadId) {
    // 读取设置并发送通知（异步，不阻塞）
    void sendReplyNotification(ctx.threadId, params.threadId as string);
  }
};
```

新增 `sendReplyNotification` 函数：

```typescript
async function sendReplyNotification(
  currentThreadId: string | null,
  eventThreadId: string,
) {
  // 只在当前活跃对话触发通知
  if (currentThreadId !== eventThreadId) return;

  try {
    const { data } = await settingsListSettings({ query: { category: 'notifications' } });
    const settings = Object.fromEntries(
      data?.settings.map(s => [s.key, s.value]) ?? []
    );

    if (settings['notifications.enabled'] === false) return;

    // 获取对话标题
    const threadTitle = useTimelineStore.getState().threadsById[eventThreadId]?.threadTitle;
    const body = threadTitle ?? 'AI 回复已完成';

    await sendNotification({
      title: 'Codex WebUI',
      body,
      soundEnabled: settings['notifications.soundEnabled'] !== false,
      method: settings['notifications.method'] === 'bark' ? 'bark' : 'browser',
      barkServer: settings['notifications.barkServer'] as string,
      barkKey: settings['notifications.barkKey'] as string,
      barkSound: settings['notifications.barkSound'] as string,
    });
  } catch {
    // 通知失败静默处理，不影响用户体验
  }
}
```

#### 2.4.4 设置页面

- **新增分类**：在 `settings-page.tsx` 的 `SECTIONS` 中添加 `'notifications'`。
- **新增组件**：`notification-settings.tsx`，使用 `useCategorySettings('notifications')` 管理设置。
- 包含：
  - 全局通知开关（Switch）
  - 通知方式选择器（浏览器通知 / Bark）
  - 浏览器通知权限请求按钮（显示当前权限状态）
  - Bark 配置区域（服务器地址、设备密钥、提示音选择）
  - 声音开关
  - "发送测试通知"按钮

### 2.5 后端变更

- **新增 Runtime Settings**：在 `general` 分类下新增上述 6 个设置项，或新建 `notifications` 分类。
- 由于本设计采用"前端直发 Bark"模式，后端仅需提供设置存储 API（已有 `settingsListSettings` / `settingsUpdateSetting` / `settingsResetSetting`），**无需新增后端接口**。

---

## 3. 点击对话自动滚动到底部详细设计

### 3.1 现状分析

当前 `chat-timeline.tsx` 已有以下滚动逻辑：

1. **`useEffect` on `[timeline, virtualizer]`**（第 253-272 行）：当 timeline 长度变化且 `shouldAutoScroll.current` 为 true 时，滚动到底部。
2. **`useEffect` on `[threadId]`**（第 274-282 行）：当 `threadId` 变化时，设置 `shouldAutoScroll.current = true` 并滚动到底部。

但存在一个问题：当用户点击侧边栏对话时，`ThreadView` 组件挂载，`threadId` 变化触发 effect #2，但此时 `timeline` 可能为空（数据尚未从后端加载）。等 `resumeThread` 完成后，`timeline` 数据到达，触发 effect #1，但由于 `shouldAutoScroll.current` 在 effect #2 中已被设为 `true`，滚动应该可以工作。

需要验证的是：effect #1 中的 `appended` 分支是否覆盖了从 0 到 N 条数据的场景（hydration 场景）。从代码看，`previousCount > 0 && appended` 条件满足时使用 smooth 滚动，否则使用 auto 滚动。当从 0 到多条时，`previousCount === 0`，所以走 `'auto'` 分支，这是正确的。

**结论**：核心逻辑已经存在，但需要添加一个机制确保在数据延迟加载场景下仍能可靠触发。

### 3.2 改进方案

**方案：增加 timeline 数据就绪后的滚动触发**

在 `chat-timeline.tsx` 中，添加一个 `useEffect`，依赖 `[timeline, threadId]`，但增加一个"首次渲染完成"的标志：

```typescript
// 新增：确保 timeline 数据加载完成后滚动到底部
const timelineLoadedRef = useRef(false);

useEffect(() => {
  // 当 threadId 变化时，重置标志
  if (threadId) {
    timelineLoadedRef.current = false;
  }
}, [threadId]);

useEffect(() => {
  // 当 timeline 从空变为非空（数据加载完成）时，确保滚动到底部
  if (timeline.length > 0 && !timelineLoadedRef.current) {
    timelineLoadedRef.current = true;
    shouldAutoScroll.current = true;
    virtualizer.scrollToIndex(timeline.length - 1, { align: 'end' });
  }
}, [timeline, virtualizer, threadId]);
```

这个逻辑确保：
1. 切换对话时重置状态
2. 数据加载完成后强制滚动到底部
3. 与现有自动滚动逻辑互补，不产生冲突

### 3.3 涉及变更文件

| 文件 | 变更 |
|---|---|
| `web/src/components/chat/chat-timeline.tsx` | 增加上述滚动逻辑 |

---

## 4. 影响范围与风险

### 4.1 通知功能

| 维度 | 影响 |
|---|---|
| **安全性** | Bark 设备密钥存储在前端 localStorage（通过 Zustand persist），与现有模式一致。非 HTTPS 站点浏览器通知可能受限。 |
| **性能** | 通知发送为异步非阻塞操作，不影响主流程 |
| **兼容性** | 浏览器通知需要 HTTPS 或 localhost；Bark 需要网络访问 |
| **i18n** | 需添加中文/英文翻译条目 |

### 4.2 自动滚动

| 维度 | 影响 |
|---|---|
| **安全性** | 无 |
| **性能** | 无 |
| **兼容性** | 与现有 TanStack Virtual 虚拟列表完全兼容 |
| **回归风险** | 低。改动范围小，与现有滚动逻辑正交 |

---

## 5. 测试计划

### 5.1 通知功能

- [ ] 浏览器通知权限请求流程正常
- [ ] 浏览器通知发送成功（标题、正文、图标正确）
- [ ] 通知声音播放正常
- [ ] Bark 通知发送成功
- [ ] 通知开关关闭后不发送通知
- [ ] 切换通知方式后使用对应方式发送
- [ ] 设置页保存/重置正常
- [ ] 测试通知按钮功能正常

### 5.2 自动滚动

- [ ] 点击侧边栏对话自动滚动到底部
- [ ] 新建对话后自动滚动到底部
- [ ] 用户手动滚动到上方后，新消息不强制滚动（保持现有行为）
- [ ] 切换对话后正确滚动到新对话底部

---

## 6. 未解决问题

- [ ] Bark 通知是否需要自定义通知分组（通过 `group` 参数）？
- [ ] 是否需要支持"仅当页面处于后台时发送通知"？

*（以上问题将在实施阶段确认）*
