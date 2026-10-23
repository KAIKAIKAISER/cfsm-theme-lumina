# CFSM-Theme-Lumina (Custom Self-Hosted Edition)

专为 [CF-Server-Monitor](https://github.com/huilang-me/CF-Server-Monitor) 编写的自有安全版 LuminaPlus 风格监控主题（100% 自主可控源码、零第三方供应链风险、严格遵循 D1 零轮询铁律）。

## 核心特性

- **四种视图自由切换**：大卡片（Large）、紧凑卡（Compact）、迷你卡（Mini）、列表视图（Table）
- **首页聚合总览横幅**：节点在线率、全局实时上下行总带宽、月度累计流量、多币种折合月费与即将到期提醒
- **多线路延迟与 20 格丢包色带**：首页复用 `/api/servers` 2 小时窗口数据绘制三网色带；详情页复用 `/api/history/all` 绘制多线路 RTT 曲线与丢包色带（严格区分 `false` 未配置、`null` 超时、`0` 正常）
- **交互式高刷 SVG 趋势图表**：CPU/内存、实时上下行速率、磁盘 I/O（按需展示）、GPU 负载（按需展示）
- **主题个性化抽屉**：支持深浅色模式、5 种强调色（Cyan / Emerald / Violet / Amber / Rose）、毛玻璃不透明度、卡片元素开关；管理员登录态自动通过 `POST /api/theme_options` 同步至云端
- **零 D1 浪费铁律**：全工程无任何 `setInterval` 轮询 REST；WebSocket 增量合并（1 秒节流渲染）；页面切后台自动断开 WS 止损，切回前台自动补齐并重连

## 使用方式

### 方式一：在 CF-Server-Monitor 后台填入自定义主题地址

进入管理后台 `/admin#/admin` → **外观设置 / 主题商店** → **自定义主题 GitHub tree 地址**，填入本仓库 `dist` 分支地址（或固定 Commit SHA）：

```text
https://github.com/KAIKAIKAISER/cfsm-theme-lumina/tree/dist
```

### 方式二：GitHub Pages 纯静态跨域部署

1. 在仓库 `Settings -> Secrets and variables -> Actions` 中添加：
   - `API_BASE`：你的 Worker 域名（如 `https://server-monitor-pro.strawberryhoney.workers.dev`，多站点用英文逗号分隔）
   - `TITLE`（可选）：静态站点标题
   - `BACKGROUND_IMAGE`（可选）：背景图片 URL
2. 在每个 Cloudflare Worker 的环境变量中配置 `CORS_ALLOWED_ORIGINS`（纯 origin，英文逗号分隔）。
3. 在仓库 `Settings -> Pages` 中选择 `dist` 分支作为发布源。
