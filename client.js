// Client half of the balance widget.
// Renders inside the composer dock next to the built-in stats:
//   ¥12.34 · 12.3K tok
// Hovering shows the wallet breakdown and this session's token buckets.
window.__ModuleLoader__.load({
  id: 'dsh-balance-usage-widget',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const REFRESH_MS = 60_000;
    const CLIENT_VERSION = '0.2.1-rc.2';

    function currencySymbol(currency) {
      if (currency === 'CNY') return '¥';
      if (currency === 'USD') return '$';
      return currency ? currency + ' ' : '';
    }

    function amountText(raw) {
      const n = Number(raw);
      if (!Number.isFinite(n)) return String(raw);
      if (n > 0 && n < 0.01) return '<0.01';
      const abs = Math.abs(n).toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return (n < 0 ? '-' : '') + abs;
    }

    function walletText(wallets) {
      if (!Array.isArray(wallets) || wallets.length === 0) return null;
      const parts = wallets
        .filter((wallet) => wallet && wallet.balance !== undefined)
        .map((wallet) => currencySymbol(wallet.currency) + amountText(wallet.balance));
      return parts.length > 0 ? parts.join(' / ') : null;
    }

    function compactTokens(value) {
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) return '0';
      if (n < 1000) return String(Math.round(n));
      if (n < 1e6) {
        const scaled = n / 1000;
        return (scaled >= 100 ? String(Math.round(scaled)) : String(Math.round(scaled * 10) / 10)) + 'K';
      }
      const scaled = n / 1e6;
      return (scaled >= 100 ? String(Math.round(scaled)) : String(Math.round(scaled * 10) / 10)) + 'M';
    }

    function readUsage(usage) {
      if (!usage) return null;
      const uncached = Number(usage.uncachedInputTokens) || 0;
      const cacheRead = Number(usage.cacheReadTokens) || 0;
      const cacheWrite = Number(usage.cacheWriteTokens) || 0;
      const output = Number(usage.outputTokens) || 0;
      const input = uncached + cacheRead + cacheWrite;
      return {
        uncached,
        cacheRead,
        cacheWrite,
        output,
        input,
        total: input + output,
        hitPercent: input > 0 ? Math.round((cacheRead / input) * 100) : null,
      };
    }

    function exact(value) {
      return Number(value).toLocaleString('zh-CN');
    }

    function BalancePill({ useProjection, readBalance }) {
      const usage = typeof useProjection === 'function' ? useProjection('tokenUsage') : undefined;
      // undefined = first read in flight, null = unavailable, object = AccountDetails.balance
      const [balance, setBalance] = React.useState(undefined);

      React.useEffect(() => {
        let alive = true;
        let busy = false;
        const load = async () => {
          if (busy) return;
          busy = true;
          try {
            const next = await readBalance();
            if (alive) setBalance(next ?? null);
          } catch {
            if (alive) setBalance(null);
          } finally {
            busy = false;
          }
        };
        load();
        const timer = setInterval(load, REFRESH_MS);
        const onVisible = () => {
          if (document.visibilityState === 'visible') load();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
          alive = false;
          clearInterval(timer);
          document.removeEventListener('visibilitychange', onVisible);
        };
      }, [readBalance]);

      const tokens = readUsage(usage);
      const ready = balance && balance.status === 'ready';
      const wallets = ready ? walletText(balance.value) : null;
      const bonus = ready ? walletText(balance.bonusWallets) : null;

      let balanceLabel;
      if (balance === undefined) balanceLabel = '余额 …';
      else if (wallets) balanceLabel = wallets;
      else balanceLabel = '余额 --';

      const tokenLabel = tokens ? compactTokens(tokens.total) + ' tok' : '0 tok';

      const title = [];
      if (wallets) title.push('充值余额：' + wallets);
      else if (balance === null) title.push('余额：未登录或查询失败');
      else if (balance && balance.status !== 'ready') title.push('余额：查询失败');
      if (bonus) title.push('赠金：' + bonus);
      if (tokens) {
        title.push(
          '本会话：' +
            exact(tokens.total) +
            ' tokens（缓存命中率 ' +
            (tokens.hitPercent === null ? '—' : tokens.hitPercent + '%') +
            '）',
        );
        const buckets = [
          '未命中输入 ' + exact(tokens.uncached),
          '缓存命中 ' + exact(tokens.cacheRead),
        ];
        if (tokens.cacheWrite > 0) buckets.push('缓存写入 ' + exact(tokens.cacheWrite));
        buckets.push('输出 ' + exact(tokens.output));
        title.push(buckets.join(' · '));
      }

      return h(
        'span',
        {
          title: title.join('\n'),
          'data-balance-widget': '',
          'aria-label': balanceLabel + ' · ' + tokenLabel,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            maxWidth: 300,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            fontSize: 12,
            lineHeight: '18px',
            color: 'var(--dsw-alias-label-tertiary)',
            cursor: 'default',
            userSelect: 'none',
          },
        },
        h('span', null, balanceLabel),
        h('span', { 'aria-hidden': true }, '·'),
        h('span', null, tokenLabel),
      );
    }

    return {
      inject: ['slots', 'locale', 'remote', 'remote.account'],
      apply(ctx) {
        const readBalance = async () => {
          try {
            const account = ctx.remote && ctx.remote.account;
            if (!account || typeof account.getBalance !== 'function') return null;
            const snapshot = ctx.locale.getSnapshot();
            const metadata = {
              version: CLIENT_VERSION,
              locale: snapshot && snapshot.active ? snapshot.active : 'zh-CN',
              timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
            };
            const result = await account.getBalance(metadata);
            if (!result || result.ok !== true) return null;
            return result.value;
          } catch {
            return null;
          }
        };

        ctx.slots.inject('conversation.composer.dock', () =>
          ctx.slots.register(
            {
              name: 'conversation.composer.dock',
              id: 'balance',
              order: 2,
              inject: () => ({ readBalance }),
            },
            BalancePill,
          ),
        );
      },
    };
  },
});
