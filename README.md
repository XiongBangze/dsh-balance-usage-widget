# dsh-balance-usage-widget

A tiny composer-dock widget for **DeepSeek Harness (DSH)**. It shows your DeepSeek account balance and the current session's token usage in one line:

```
¥12.34 · 12.3K tok
```

Hover for the breakdown: topped-up balance, granted balance, uncached input, cache reads, cache writes, output tokens and cache-hit rate.

> Community plugin. Not affiliated with or endorsed by DeepSeek.

## 中文说明

在 DSH 输入框下方的状态行显示“账户余额 + 本会话 token 用量”。

- 左边：DeepSeek 账号的充值余额（多币种用 `/` 分隔；低于 0.01 显示 `<0.01`）。
- 右边：本会话累计 token（未命中输入 + 缓存命中 + 缓存写入 + 输出）。
- 悬停：充值余额、赠金余额、本会话 token 分项和缓存命中率。
- 未登录或余额查询失败时显示 `余额 --`，token 仍正常显示。

### 安装

从 npm 安装（`desktop` profile 由桌面端独占管理时，请在界面里安装）：

```bash
dsh plugin --profile desktop add dsh-balance-usage-widget
```

或在 **侧栏 → 插件 → 添加插件** 中填写包名 `dsh-balance-usage-widget`，安装后重启 DSH。

本地开发时可在安装对话框里粘贴本目录的绝对路径。

### 隐私与边界

- 余额通过 DSH 客户端已有的 `ctx.remote.account.getBalance` 读取，与 **设置 → 账号** 同源；只读，不写文件。
- Token 来自 DSH 的 `tokenUsage` 会话投影，与“性能与用量 → 详细”同源。
- 不发起额外网络请求、不读取会话正文、不写任何文件。
- 余额每 60 秒刷新一次，页面重新可见时也会刷新。

## How it works

- Host half: an empty bundle patch that inserts one row.
- Client half: a browser module that registers a `conversation.composer.dock` entry.
  - balance: `ctx.remote.account.getBalance({ version, locale, timezoneOffsetSeconds })`
  - tokens: `useProjection('tokenUsage')`
- No build step; `client.js` is the published browser artifact.

## Compatibility

- DSH Web / Desktop `0.2.x` (`dsh.client` bundle).
- Balance requires a DeepSeek account login. API-key-only setups show `余额 --`, because the built-in account service does not expose balance for API keys.

## Development

```bash
# local install into a throwaway profile
dsh plugin --profile <profile> add /absolute/path/to/dsh-balance-usage-widget
```

The package is plain ESM plus one browser module; there is nothing to compile.

## License

MIT. See [LICENSE](LICENSE).
