'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { BacktestController } from '@/lib/app';
import type { ChartWorkspaceProps } from '../chart/ChartWorkspace';
import { Icon } from '../ui/Icon';
import { BacktestModals } from './BacktestModals';
import { BacktestTopBar } from './BacktestTopBar';
import { MobileBacktestBar, MobileReplayTop } from './mobile/MobileBacktestBar';
import { OrderTicket } from './OrderTicket';
import { PriceSkipperBar } from './PriceSkipperBar';
import { PropRulesPanel } from './PropRulesPanel';
import { sessionChartMenu } from './session-menu';
import { useBacktestStore } from './store';
import { TradingPanel } from './TradingPanel';

const ChartWorkspace = dynamic(() => import('../chart/ChartWorkspace'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-chart" />,
});

/**
 * The one trading chart: top bar, drawing tools, order ticket, positions panel, and replay bar.
 * Backtest and Battle both render this. A host adds its own pieces through the slots.
 */
export function SessionChart({
  wrapDeps,
  onApp,
  appOptions,
  controller,
  homeHref = '/backtest',
  homeLabel = 'بازگشت به جلسه‌ها',
  toolbarEnd,
  badge,
  subtitle,
  overlay,
  mobileTop,
}: {
  readonly wrapDeps: NonNullable<ChartWorkspaceProps['wrapDeps']>;
  readonly onApp: NonNullable<ChartWorkspaceProps['onApp']>;
  readonly appOptions: ChartWorkspaceProps['appOptions'];
  readonly controller: BacktestController | null;
  readonly homeHref?: string;
  readonly homeLabel?: string;
  /** Host controls on the desktop top bar (the battle timer, for example). */
  readonly toolbarEnd?: ReactNode;
  /** Replaces the شخصی / پراپ badge on the session menu. */
  readonly badge?: ReactNode;
  /** Replaces the session-menu subtitle. */
  readonly subtitle?: string;
  /** Drawn over the chart, after the shared trading overlays. */
  readonly overlay?: ReactNode;
  /** Phone row under the chart controls. */
  readonly mobileTop?: ReactNode;
}) {
  const ticket = useBacktestStore((s) => s.ticket);
  const actionsEnabled = useBacktestStore((s) => s.actionsEnabled);

  return (
    <ChartWorkspace
      wrapDeps={wrapDeps}
      onApp={(app) => {
        if (app) useBacktestStore.getState().setPanelHidden(true);
        onApp(app);
      }}
      {...(appOptions ? { appOptions } : {})}
      hideReplay
      locale="fa"
      toolbar={
        <BacktestTopBar
          homeHref={homeHref}
          homeLabel={homeLabel}
          {...(toolbarEnd ? { end: toolbarEnd } : {})}
          {...(badge ? { badge } : {})}
          {...(subtitle ? { subtitle } : {})}
        />
      }
      mobileChrome="replace"
      mobileStart={
        <Link
          href={homeHref}
          aria-label={homeLabel}
          className="flex h-9 w-9 items-center justify-center rounded-full text-fg hover:bg-hover"
        >
          <Icon name="chevronLeft" size={20} />
        </Link>
      }
      mobileTop={
        <>
          {controller ? <MobileReplayTop /> : null}
          {mobileTop}
        </>
      }
      mobileFooter={controller ? <MobileBacktestBar /> : null}
      onSidePanelClose={() => useBacktestStore.getState().openTicket(null)}
      overlay={
        <>
          {controller ? (
            <>
              <PropRulesPanel />
              <BacktestModals />
            </>
          ) : null}
          {overlay}
        </>
      }
      sidePanel={
        controller && ticket && actionsEnabled ? <OrderTicket key={ticketKey(ticket)} /> : null
      }
      footer={
        controller ? (
          <div dir="rtl" className="flex shrink-0 flex-col">
            <TradingPanel />
            <PriceSkipperBar />
          </div>
        ) : null
      }
      chartMenuItems={(point) => (controller ? sessionChartMenu(controller, point) : [])}
    />
  );
}

const ticketKey = (t: { side: string; type: string; price?: number }) =>
  `${t.side}:${t.type}:${t.price ?? ''}`;
