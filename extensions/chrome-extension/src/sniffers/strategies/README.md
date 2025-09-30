# 通用嗅探策略系统

这个目录包含了用于嗅探页面中通用媒体资源的策略模式实现。

## 架构设计

### 策略模式 (Strategy Pattern)

策略模式允许我们将不同的嗅探算法封装成独立的策略类，使代码更加模块化和可维护。

```
┌─────────────────────┐
│  SniffStrategy      │ (抽象基类)
│  ---------------    │
│  + name             │
│  + priority         │
│  + sniff()          │
│  + sniffSafely()    │
└─────────────────────┘
          △
          │ 继承
          │
    ┌─────┴─────┬─────────┬─────────┐
    │           │         │         │
┌───┴────┐ ┌────┴───┐ ┌──┴──┐  ┌───┴───┐
│Image   │ │Video   │ │Audio│  │...    │
│Tag     │ │Tag     │ │Tag  │  │       │
└────────┘ └────────┘ └─────┘  └───────┘
```

## 已实现的策略

| 优先级 | 策略名称 | 文件 | 描述 |
|-------|---------|------|------|
| 1 | ImageTag | `image-tag.ts` | 扫描所有 `<img>` 标签 |
| 2 | BackgroundImage | `background-image.ts` | 扫描 CSS 背景图片 |
| 3 | VideoTag | `video-tag.ts` | 扫描所有 `<video>` 标签及其 `<source>` 子元素 |
| 4 | AudioTag | `audio-tag.ts` | 扫描所有 `<audio>` 标签及其 `<source>` 子元素 |
| 5 | PerformanceAPI | `performance-api.ts` | 从 Performance API 获取动态加载的资源 |
| 6 | CustomAttributes | `custom-attributes.ts` | 扫描自定义 data 属性（兜底方案） |
| 7 | ScriptExtraction | `script-extraction.ts` | 从页面脚本中提取视频 URL（针对抖音等平台） |

## 如何使用

### 在 content.ts 中自动加载

策略系统在 `content.ts` 中自动加载和执行：

```typescript
import { sniffStrategies } from './sniffers/strategies'

// 执行所有通用嗅探策略
sniffStrategies.forEach(strategy => {
  const strategyResources = strategy.sniffSafely(seenUrls)
  resources.push(...strategyResources)
})
```

### 策略执行顺序

策略按 `priority` 属性从小到大执行，确保：
1. 最常见的资源类型先被嗅探（如图片、视频）
2. 性能影响小的策略先执行
3. 兜底策略最后执行

## 如何添加新策略

### 步骤 1: 创建策略类

在 `strategies/` 目录下创建新文件，例如 `my-strategy.ts`：

```typescript
import { MediaResource } from '../base'
import { SniffStrategy } from './base'

export class MyStrategy extends SniffStrategy {
  get name(): string {
    return 'MyStrategy'
  }

  get priority(): number {
    return 8  // 设置优先级
  }

  sniff(seenUrls: Set<string>): MediaResource[] {
    const resources: MediaResource[] = []

    // 实现你的嗅探逻辑
    // 注意：seenUrls 用于去重，添加资源时需要检查和更新

    return resources
  }
}
```

### 步骤 2: 注册策略

在 `index.ts` 中导入并注册：

```typescript
import { MyStrategy } from './my-strategy'

export const sniffStrategies: SniffStrategy[] = [
  // ... 现有策略
  new MyStrategy()  // 添加新策略
].sort((a, b) => a.priority - b.priority)
```

### 步骤 3: 测试

重新构建扩展并测试：

```bash
pnpm build
```

## 设计原则

### 1. 单一职责

每个策略只负责一种嗅探方法，使代码易于理解和维护。

### 2. 去重机制

所有策略共享 `seenUrls` 集合：

```typescript
if (!seenUrls.has(url) && this.isValidUrl(url)) {
  seenUrls.add(url)
  resources.push({ url, type: 'image' })
}
```

### 3. 错误隔离

使用 `sniffSafely()` 包装执行，确保单个策略失败不影响其他策略：

```typescript
public sniffSafely(seenUrls: Set<string>): MediaResource[] {
  try {
    return this.sniff(seenUrls)
  } catch (error) {
    console.debug(`[Strategy:${this.name}] Sniffing error:`, error)
    return []
  }
}
```

### 4. 优先级控制

通过 `priority` 属性控制执行顺序：
- 1-3: 高优先级（基本 DOM 元素）
- 4-6: 中优先级（API 和属性）
- 7+: 低优先级（兜底和特殊情况）

## 性能优化

### 1. 惰性执行

策略只在需要时执行，不会预加载。

### 2. 早期退出

在策略内部尽早检查和退出：

```typescript
if (!seenUrls.has(url) && this.isValidUrl(url)) {
  // 只有在通过所有检查后才进行复杂操作
  seenUrls.add(url)
  resources.push(resource)
}
```

### 3. DOM 查询优化

使用高效的选择器：

```typescript
// 推荐
const images = document.querySelectorAll('img')

// 避免
const images = document.querySelectorAll('*')
  .filter(el => el.tagName === 'IMG')
```

## 与平台嗅探器的关系

- **平台嗅探器**（`sniffers/youtube.ts` 等）：针对特定平台的优化嗅探
- **通用策略**（`sniffers/strategies/`）：适用于所有页面的通用嗅探

执行顺序：
1. 先执行平台嗅探器（如果匹配）
2. 再执行通用策略
3. 所有结果合并并去重

## 故障排除

### 策略没有执行？

检查控制台日志：
```
[Sniff] Starting general strategies...
[Sniff] Running strategy: ImageTag
[Sniff] Strategy ImageTag found X resources
```

### 资源重复？

确保使用 `seenUrls` 去重：
```typescript
if (!seenUrls.has(url)) {
  seenUrls.add(url)
  // ...
}
```

### 性能问题？

- 检查策略的 priority，确保高开销策略后执行
- 使用 `console.time()` 测量策略执行时间
- 考虑添加防抖或节流

## 未来扩展

可以考虑添加的策略：
- **IframeStrategy**: 扫描 iframe 中的资源
- **SVGStrategy**: 扫描 SVG 图片
- **WebPStrategy**: 专门处理 WebP 图片
- **M3U8Strategy**: HLS 视频流专门处理
- **DataURLStrategy**: 处理 data URL 格式的资源