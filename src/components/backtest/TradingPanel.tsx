'use client';

import { useState } from 'react';
import { rMultiple, type Trade } from '@/lib/backtest';
import { Icon } from '../ui/Icon';
import { captureChart } from './capture';
import { useBacktest } from './context';
import {
  EXIT_REASON_LABEL,
  SIDE_FA,
  faNum,
  lots,
  money,
  num,
  pnlClass,
  signedMoney,
  utcDateTime,
} from './format';
import { useBacktestStore } from './store';

const th = 'px-2 py-1.5 text-start font-medium text-muted whitespace-nowrap';
const td = 'px-2 py-1 whitespace-nowrap tabular-nums';
const act =
  'inline-flex h-6 items-center rounded px-1.5 text-[12px] text-muted hover:bg-hover hover:text-fg disabled:opacity-40';

/** Bottom trading panel: Positions · Orders · History tabs and the account summary. */
export function TradingPanel() {
  const c = useBacktest();
  const snap = useBacktestStore((s) => s.snap);
  const tab = useBacktestStore((s) => s.tab);
  const setTab = useBacktestStore((s) => s.setTab);
  const openModal = useBacktestStore((s) => s.openModal);
  const panelHidden = useBacktestStore((s) => s.panelHidden);
  const setPanelHidden = useBacktestStore((s) => s.setPanelHidden);
  const [collapsed, setCollapsed] = useState(false);
  if (!snap || panelHidden) return null;
  const p = c.spec.pricePrecision;
  const tabs = [
    { id: 'positions' as const, label: `معاملات باز (${faNum(snap.positions.length)})` },
    { id: 'orders' as const, label: `سفارش‌ها (${faNum(snap.orders.length)})` },
    { id: 'history' as const, label: `تاریخچه (${faNum(snap.trades.length)})` },
  ];
  const active = snap.status === 'active';
  return (
    <section
      aria-label="پنل معاملات"
      className="flex shrink-0 flex-col border-t border-line bg-panel text-[12.5px]"
    >
      <div className="flex h-9 items-center gap-1 overflow-x-auto px-2">
        <button
          type="button"
          aria-label={collapsed ? 'باز کردن پنل' : 'جمع کردن پنل'}
          onClick={() => setCollapsed((v) => !v)}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-hover"
        >
          <Icon name={collapsed ? 'chevronRight' : 'chevronDown'} size={14} />
        </button>
        <button
          type="button"
          aria-label="پنهان کردن پنل"
          title="پنهان کردن پنل"
          data-testid="hide-trading-panel"
          onClick={() => setPanelHidden(true)}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-hover"
        >
          <Icon name="eyeOff" size={14} />
        </button>
        <div role="tablist" className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => {
                setTab(t.id);
                setCollapsed(false);
              }}
              className={`h-7 whitespace-nowrap rounded px-2 ${tab === t.id ? 'bg-hover font-semibold text-fg' : 'text-muted hover:text-fg'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <Summary label="موجودی" value={money(snap.balance)} testId="bt-balance" />
        <Summary label="ارزش خالص" value={money(snap.equity)} testId="bt-equity" />
        <Summary
          label="سود شناور"
          value={signedMoney(snap.floating)}
          cls={pnlClass(snap.floating)}
          testId="bt-floating"
        />
        <Summary
          label="سود قطعی"
          value={signedMoney(snap.realized)}
          cls={pnlClass(snap.realized)}
        />
        <Summary
          label="نرخ برد"
          value={snap.trades.length ? `${faNum(snap.winRate * 100, 1)}٪` : '—'}
        />
      </div>
      {collapsed ? null : (
        <div className="h-44 overflow-auto border-t border-line">
          {tab === 'positions' ? (
            <table className="w-full">
              <thead className="sticky top-0 bg-panel">
                <tr>
                  {[
                    '#',
                    'نماد',
                    'جهت',
                    'حجم',
                    'ورود',
                    'فعلی',
                    'حد ضرر',
                    'حد سود',
                    'پیپ',
                    'سود',
                    'زمان ورود',
                    '',
                  ].map((h) => (
                    <th key={h} className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {snap.positions.map((x) => (
                  <tr key={x.id} className="border-t border-line/60 hover:bg-hover/50">
                    <td className={td}>{x.id}</td>
                    <td className={td}>{snap.settings.symbol}</td>
                    <td
                      className={`${td} font-semibold ${x.side === 'buy' ? 'text-accent' : 'text-down'}`}
                    >
                      {SIDE_FA[x.side]}
                    </td>
                    <td className={td}>{lots(x.volume)}</td>
                    <td className={td}>{num(x.entryPrice, p)}</td>
                    <td className={td}>{num(x.current, p)}</td>
                    <td className={td}>
                      {num(x.sl, p)}
                      {x.breakEven ? ' (سربه‌سر)' : ''}
                    </td>
                    <td className={td}>{num(x.tp, p)}</td>
                    <td className={`${td} ${pnlClass(x.pips)}`}>{faNum(x.pips, 1)}</td>
                    <td className={`${td} font-semibold ${pnlClass(x.floating)}`}>
                      {signedMoney(x.floating)}
                    </td>
                    <td className={td}>{utcDateTime(x.entryTime)}</td>
                    <td className={`${td} text-end`}>
                      <button
                        type="button"
                        className={act}
                        disabled={!active}
                        onClick={() => c.trading.breakEven(x.id)}
                        title="انتقال حد ضرر به قیمت ورود"
                      >
                        سربه‌سر
                      </button>
                      <button
                        type="button"
                        className={act}
                        disabled={!active}
                        onClick={() => openModal({ type: 'partial-close', positionId: x.id })}
                      >
                        بستن جزئی
                      </button>
                      <button
                        type="button"
                        className={act}
                        disabled={!active}
                        onClick={() => openModal({ type: 'edit-position', positionId: x.id })}
                      >
                        ویرایش
                      </button>
                      <button
                        type="button"
                        className={act}
                        disabled={!active}
                        onClick={() => c.trading.close(x.id)}
                        aria-label={`بستن معامله ${x.id}`}
                        data-testid={`close-${x.id}`}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {snap.positions.length > 1 ? (
                <tfoot>
                  <tr>
                    <td colSpan={12} className="px-2 py-1 text-end">
                      <button
                        type="button"
                        className={act}
                        disabled={!active}
                        onClick={() => c.trading.closeAll()}
                      >
                        بستن همه
                      </button>
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          ) : null}
          {tab === 'orders' ? (
            <table className="w-full">
              <thead className="sticky top-0 bg-panel">
                <tr>
                  {['#', 'نماد', 'نوع', 'حجم', 'قیمت', 'حد ضرر', 'حد سود', 'زمان ثبت', ''].map((h) => (
                    <th key={h} className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {snap.orders.map((o) => (
                  <tr key={o.id} className="border-t border-line/60 hover:bg-hover/50">
                    <td className={td}>{o.id}</td>
                    <td className={td}>{snap.settings.symbol}</td>
                    <td
                      className={`${td} font-semibold ${o.side === 'buy' ? 'text-accent' : 'text-down'}`}
                    >
                      {o.side === 'buy' ? 'خرید' : 'فروش'} {o.kind === 'limit' ? 'لیمیت' : 'استاپ'}
                    </td>
                    <td className={td}>{lots(o.volume)}</td>
                    <td className={td}>{num(o.price, p)}</td>
                    <td className={td}>{num(o.sl, p)}</td>
                    <td className={td}>{num(o.tp, p)}</td>
                    <td className={td}>{utcDateTime(o.placedAt)}</td>
                    <td className={`${td} text-end`}>
                      <button
                        type="button"
                        className={act}
                        disabled={!active}
                        onClick={() => openModal({ type: 'edit-order', orderId: o.id })}
                      >
                        ویرایش
                      </button>
                      <button
                        type="button"
                        className={act}
                        disabled={!active}
                        onClick={() => c.trading.cancel(o.id)}
                        aria-label={`لغو سفارش ${o.id}`}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {snap.orders.length > 1 ? (
                <tfoot>
                  <tr>
                    <td colSpan={9} className="px-2 py-1 text-end">
                      <button
                        type="button"
                        className={act}
                        disabled={!active}
                        onClick={() => c.trading.cancelAll()}
                      >
                        لغو همه
                      </button>
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          ) : null}
          {tab === 'history' ? <HistoryTable trades={snap.trades} precision={p} /> : null}
          {(tab === 'positions' && snap.positions.length === 0) ||
          (tab === 'orders' && snap.orders.length === 0) ||
          (tab === 'history' && snap.trades.length === 0) ? (
            <p className="p-4 text-center text-muted">
              {tab === 'positions'
                ? 'معاملهٔ بازی ندارید'
                : tab === 'orders'
                  ? 'سفارش معلقی ندارید'
                  : 'هنوز معامله‌ای بسته نشده'}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function HistoryTable({
  trades,
  precision,
}: {
  readonly trades: readonly Trade[];
  readonly precision: number;
}) {
  const c = useBacktest();
  const rows = [...trades].reverse();
  return (
    <table className="w-full">
      <thead className="sticky top-0 bg-panel">
        <tr>
          {[
            '#',
            'جهت',
            'حجم',
            'زمان ورود',
            'ورود',
            'زمان خروج',
            'خروج',
            'حد ضرر',
            'حد سود',
            'پیپ',
            'کارمزد',
            'سود',
            'R',
            'علت خروج',
            '',
          ].map((h) => (
            <th key={h} className={th}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((t) => {
          const r = rMultiple(c.cfg, t);
          const pips =
            ((t.side === 'buy' ? 1 : -1) * (t.closePrice - t.entryPrice)) / c.cfg.pipSize;
          return (
            <tr key={t.id} className="border-t border-line/60 hover:bg-hover/50">
              <td className={td}>{t.id}</td>
              <td
                className={`${td} font-semibold ${t.side === 'buy' ? 'text-accent' : 'text-down'}`}
              >
                {SIDE_FA[t.side]}
              </td>
              <td className={td}>{lots(t.initialVolume)}</td>
              <td className={td}>{utcDateTime(t.entryTime)}</td>
              <td className={td}>{num(t.entryPrice, precision)}</td>
              <td className={td}>{utcDateTime(t.closeTime)}</td>
              <td className={td}>{num(t.closePrice, precision)}</td>
              <td className={td}>{num(t.initialSl, precision)}</td>
              <td className={td}>{num(t.initialTp, precision)}</td>
              <td className={`${td} ${pnlClass(pips)}`}>{faNum(pips, 1)}</td>
              <td className={td}>{money(t.commission)}</td>
              <td className={`${td} font-semibold ${pnlClass(t.netPnl)}`}>
                {signedMoney(t.netPnl)}
              </td>
              <td className={`${td} ${pnlClass(r ?? 0)}`}>
                {r === null ? '—' : `${faNum(r, 2)}R`}
              </td>
              <td className={td}>
                {t.exits.length > 1 ? `${faNum(t.exits.length)} خروج · ` : ''}
                {EXIT_REASON_LABEL[t.closeReason]}
              </td>
              <td className={`${td} text-end`}>
                <button
                  type="button"
                  className={act}
                  title="ذخیره تصویر نمودار در دفتر این معامله"
                  aria-label={`تصویر معامله ${t.id}`}
                  onClick={() => {
                    const shot = captureChart();
                    if (shot)
                      void c
                        .addScreenshot(t.id, shot)
                        .then(() =>
                          c.notice('success', `تصویر به دفتر معامله ${faNum(Number(t.id))} اضافه شد`),
                        );
                  }}
                >
                  <Icon name="camera" size={14} />
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Summary({
  label,
  value,
  cls = 'text-fg',
  testId,
}: {
  readonly label: string;
  readonly value: string;
  readonly cls?: string;
  readonly testId?: string;
}) {
  return (
    <div className="flex flex-col items-end px-2 leading-tight">
      <span className="text-[10.5px] text-muted">{label}</span>
      <span className={`tabular-nums font-semibold ${cls}`} data-testid={testId}>
        {value}
      </span>
    </div>
  );
}
