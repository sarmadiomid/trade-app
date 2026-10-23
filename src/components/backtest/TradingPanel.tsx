'use client';

import { useState } from 'react';
import { rMultiple, type Trade } from '@/lib/backtest';
import { Icon } from '../ui/Icon';
import { captureChart } from './capture';
import { useBacktest } from './context';
import {
  EXIT_REASON_LABEL,
  SIDE_FA,
  enNum,
  faNum,
  pnlClass,
  signedUsd,
  usd,
  utcDateTime,
} from './format';
import { useBacktestStore } from './store';

const th = 'px-2 py-1.5 text-start font-medium text-muted whitespace-nowrap';
const td = 'px-2 py-1 whitespace-nowrap tabular-nums';
const act =
  'inline-flex h-6 items-center rounded px-1.5 text-[12px] text-muted hover:bg-hover hover:text-fg disabled:opacity-40';

/** Bottom trading panel: Positions · Orders · History tabs and the account summary. */
export function TradingPanel({ sheet = false }: { readonly sheet?: boolean }) {
  const c = useBacktest();
  const snap = useBacktestStore((s) => s.snap);
  const tab = useBacktestStore((s) => s.tab);
  const setTab = useBacktestStore((s) => s.setTab);
  const openModal = useBacktestStore((s) => s.openModal);
  const panelHidden = useBacktestStore((s) => s.panelHidden);
  const setPanelHidden = useBacktestStore((s) => s.setPanelHidden);
  const actionsEnabled = useBacktestStore((s) => s.actionsEnabled);
  const [collapsed, setCollapsed] = useState(false);
  if (!snap || (panelHidden && !sheet)) return null;
  const p = c.spec.pricePrecision;
  const tabs = [
    { id: 'positions' as const, label: 'معاملات باز', count: snap.positions.length },
    { id: 'orders' as const, label: 'سفارش‌ها', count: snap.orders.length },
    { id: 'history' as const, label: 'تاریخچه', count: snap.trades.length },
  ];
  const active = snap.status === 'active' && actionsEnabled;
  return (
    <section
      aria-label="پنل معاملات"
      dir="rtl"
      className={
        sheet
          ? 'flex h-[min(62vh,520px)] flex-col bg-panel text-[12.5px]'
          : 'flex shrink-0 flex-col border-t border-line bg-panel text-[12.5px]'
      }
    >
      <div className="flex h-10 items-stretch gap-1 overflow-x-auto px-2">
        <div role="tablist" className="flex items-stretch gap-3">
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
              className={`relative flex items-center gap-1.5 whitespace-nowrap px-1 transition-colors ${
                tab === t.id ? 'font-semibold text-fg' : 'text-muted hover:text-fg'
              }`}
            >
              {t.label}
              <span
                className={`min-w-5 rounded-full px-1.5 text-center text-[10.5px] leading-[18px] ${
                  tab === t.id ? 'bg-accent/15 text-accent' : 'bg-hover text-muted'
                }`}
              >
                {faNum(t.count)}
              </span>
              {tab === t.id ? (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-accent" />
              ) : null}
            </button>
          ))}
        </div>
        <div className="min-w-4 flex-1" />
        <div className="flex items-center">
          <Summary label="موجودی" value={usd(snap.balance)} testId="bt-balance" />
          <Summary
            label="سود شناور"
            value={signedUsd(snap.floating)}
            cls={pnlClass(snap.floating)}
            testId="bt-floating"
          />
          <Summary
            label="سود قطعی"
            value={signedUsd(snap.realized)}
            cls={pnlClass(snap.realized)}
          />
          <Summary
            label="نرخ برد"
            value={snap.trades.length ? `${enNum(snap.winRate * 100, 1)}%` : '—'}
          />
        </div>
        {sheet ? null : (
          <div className="ms-1 flex items-center gap-0.5 border-s border-line ps-1.5">
            <button
              type="button"
              aria-label={collapsed ? 'باز کردن پنل' : 'جمع کردن پنل'}
              title={collapsed ? 'باز کردن پنل' : 'جمع کردن پنل'}
              onClick={() => setCollapsed((v) => !v)}
              className="inline-flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-hover hover:text-fg"
            >
              <Icon name="chevronDown" size={14} className={collapsed ? 'rotate-180' : ''} />
            </button>
            <button
              type="button"
              aria-label="پنهان کردن جزئیات معامله"
              title="پنهان کردن جزئیات معامله"
              data-testid="hide-trading-panel"
              onClick={() => setPanelHidden(true)}
              className="inline-flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-hover hover:text-fg"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        )}
      </div>
      {collapsed ? null : (
        <div
          className={
            sheet
              ? 'min-h-0 flex-1 overflow-auto border-t border-line'
              : 'h-44 overflow-auto border-t border-line'
          }
        >
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
                    <td className={td}>{enNum(x.volume)}</td>
                    <td className={td}>{enNum(x.entryPrice, p)}</td>
                    <td className={td}>{enNum(x.current, p)}</td>
                    <td className={td}>
                      {enNum(x.sl, p)}
                      {x.breakEven ? ' (سربه‌سر)' : ''}
                    </td>
                    <td className={td}>{enNum(x.tp, p)}</td>
                    <td className={`${td} ${pnlClass(x.pips)}`}>{enNum(x.pips, 1)}</td>
                    <td className={`${td} font-semibold ${pnlClass(x.floating)}`}>
                      {signedUsd(x.floating)}
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
                  {['#', 'نماد', 'نوع', 'حجم', 'قیمت', 'حد ضرر', 'حد سود', 'زمان ثبت', ''].map(
                    (h) => (
                      <th key={h} className={th}>
                        {h}
                      </th>
                    ),
                  )}
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
                    <td className={td}>{enNum(o.volume)}</td>
                    <td className={td}>{enNum(o.price, p)}</td>
                    <td className={td}>{enNum(o.sl, p)}</td>
                    <td className={td}>{enNum(o.tp, p)}</td>
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
              <td className={td}>{enNum(t.initialVolume)}</td>
              <td className={td}>{utcDateTime(t.entryTime)}</td>
              <td className={td}>{enNum(t.entryPrice, precision)}</td>
              <td className={td}>{utcDateTime(t.closeTime)}</td>
              <td className={td}>{enNum(t.closePrice, precision)}</td>
              <td className={td}>{enNum(t.initialSl, precision)}</td>
              <td className={td}>{enNum(t.initialTp, precision)}</td>
              <td className={`${td} ${pnlClass(pips)}`}>{enNum(pips, 1)}</td>
              <td className={td}>{usd(t.commission)}</td>
              <td className={`${td} font-semibold ${pnlClass(t.netPnl)}`}>{signedUsd(t.netPnl)}</td>
              <td className={`${td} ${pnlClass(r ?? 0)}`}>
                {r === null ? '—' : `${enNum(r, 2)}R`}
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
                          c.notice(
                            'success',
                            `تصویر به دفتر معامله ${faNum(Number(t.id))} اضافه شد`,
                          ),
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
    <div className="flex min-w-[5.5rem] flex-col items-start px-2 leading-tight">
      <span className="text-[10.5px] text-muted">{label}</span>
      <span className={`tabular-nums font-semibold ${cls}`} data-testid={testId}>
        {value}
      </span>
    </div>
  );
}
