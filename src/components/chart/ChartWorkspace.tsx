'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ChartApp,
  createBrowserDependencies,
  type AppDependencies,
  type ChartAppOptions,
} from '@/lib/app';
import { DialogHost } from '../dialogs/DialogHost';
import { useGlobalKeyboard } from '../hooks/useGlobalKeyboard';
import { useThemeCssVars } from '../hooks/useThemeCssVars';
import { IntervalTyperOverlay } from '../overlays/IntervalTyperOverlay';
import { LoadingOverlay } from '../overlays/LoadingOverlay';
import { Toasts } from '../overlays/Toasts';
import { AppContext } from '../state/app-context';
import { connectBridge } from '../state/bridge';
import { ReplayBar } from '../replay/ReplayBar';
import { TopToolbar } from '../toolbar/TopToolbar';
import { ToolbarLocaleContext, type ToolbarLocale } from '../toolbar/toolbar-locale';
import { ContextMenu, type ChartMenuItems } from '../drawing/ContextMenu';
import { DrawingToolbar } from '../drawing/DrawingToolbar';
import { FavoritesToolbar } from '../drawing/FavoritesToolbar';
import { FloatingToolbar } from '../drawing/FloatingToolbar';
import { TextEditorOverlay } from '../drawing/TextEditorOverlay';
import { ChartControls } from './ChartControls';
import { MobileChartOverlay } from './mobile/MobileChartOverlay';
import { MobileTimeDock } from './mobile/MobileTimeDock';
import { restoreDesktopMode, useCompactChart, useDesktopMode } from './mobile/mobile-ui';
import { Legend } from './Legend';

/** Reads optional URL overrides: ?provider=synthetic, ?bars=50000 (stress test). */
function urlOptions() {
  const p = new URLSearchParams(window.location.search);
  const provider = p.get('provider');
  const bars = Number(p.get('bars'));
  return {
    deps: provider ? { providerId: provider } : {},
    app:
      Number.isFinite(bars) && bars > 0 ? { initialBars: Math.min(200_000, Math.floor(bars)) } : {},
  };
}

export interface ChartWorkspaceProps {
  /** Decorates the browser dependencies before the app is created (e.g. data capture). */
  readonly wrapDeps?: (deps: AppDependencies) => AppDependencies;
  /** Called with the app once created, and with null when it is destroyed. */
  readonly onApp?: (app: ChartApp | null) => void;
  /** Rendered below the chart, above the replay bar (e.g. the lesson recorder bar). */
  readonly footer?: ReactNode;
  /** Rendered over the chart area (e.g. the challenge editor). */
  readonly overlay?: ReactNode;
  /** Rendered at the right end of the top toolbar (e.g. the account menu). */
  readonly toolbarEnd?: ReactNode;
  /** Rendered at the left end of the top toolbar (e.g. a back link). */
  readonly toolbarStart?: ReactNode;
  /** Custom desktop top bar replacing TopToolbar (e.g. BacktestTopBar). */
  readonly toolbar?: ReactNode;
  /** Options for the ChartApp (creation time only). */
  readonly appOptions?: ChartAppOptions;
  /** Hides the bar-replay button and bar (a host with its own replay). */
  readonly hideReplay?: boolean;
  /** Rendered to the right of the chart (e.g. an order panel). */
  readonly sidePanel?: ReactNode;
  /** Extra entries at the top of the chart's right-click menu. */
  readonly chartMenuItems?: ChartMenuItems;
  /**
   * Phone bottom bar. On a narrow screen it replaces `footer`.
   * Desktop keeps `footer`.
   */
  readonly mobileFooter?: ReactNode;
  /**
   * `replace` hides the host toolbar on a phone (the overlay draws its own).
   * `slim` keeps `toolbarStart` / `toolbarEnd` in a short bar.
   */
  readonly mobileChrome?: 'slim' | 'replace';
  /** Top-left control on the phone chart (a back link, for example). */
  readonly mobileStart?: ReactNode;
  /** Language of the host chrome (top toolbar). The chart itself stays English. */
  readonly locale?: ToolbarLocale;
  /** Phone row under the chart's top controls. */
  readonly mobileTop?: ReactNode;
  /** Backdrop tap on the phone side sheet. */
  readonly onSidePanelClose?: () => void;
}

/**
 * Client-only application shell. Creates the ChartApp in an effect and destroys it on unmount
 * (safe under React Strict Mode double-mounting). Chart state never enters React state.
 */
export default function ChartWorkspace({
  wrapDeps,
  onApp,
  footer,
  overlay,
  toolbarEnd,
  toolbarStart,
  toolbar,
  appOptions,
  hideReplay = false,
  sidePanel,
  chartMenuItems,
  mobileFooter,
  mobileChrome = 'slim',
  mobileStart,
  mobileTop,
  locale = 'en',
  onSidePanelClose,
}: ChartWorkspaceProps = {}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [app, setApp] = useState<ChartApp | null>(null);
  // Creation-time callbacks: the app is created once per mount, later prop changes are ignored.
  const [init] = useState(() => ({ wrapDeps, onApp, appOptions }));

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const opts = urlOptions();
    const base = createBrowserDependencies(opts.deps);
    const instance = new ChartApp(el, init.wrapDeps ? init.wrapDeps(base) : base, {
      ...opts.app,
      ...init.appOptions,
    });
    const disconnect = connectBridge(instance);
    // Dev-only handle for debugging and the e2e performance script.
    if (process.env.NODE_ENV !== 'production')
      (window as unknown as { __chartApp?: ChartApp }).__chartApp = instance;
    setApp(instance);
    init.onApp?.(instance);
    void instance.start();
    return () => {
      init.onApp?.(null);
      disconnect();
      instance.destroy();
      setApp(null);
    };
  }, [init]);

  useGlobalKeyboard(app);
  useThemeCssVars();
  const compact = useCompactChart();
  const desktopForced = useDesktopMode((s) => s.forced);
  useEffect(() => {
    restoreDesktopMode();
  }, []);

  return (
    <AppContext.Provider value={app}>
      <div
        dir="ltr"
        data-layout={desktopForced ? 'desktop' : 'auto'}
        className="relative flex h-full w-full flex-col bg-chart text-fg"
      >
        <div className="chart-desk shrink-0">
          {app ? (
            <ToolbarLocaleContext.Provider value={locale}>
              {toolbar ?? (
                <TopToolbar
                  end={toolbarEnd}
                  start={toolbarStart}
                  symbolLocked={appOptions?.symbol !== undefined}
                  hideReplay={hideReplay}
                />
              )}
            </ToolbarLocaleContext.Provider>
          ) : (
            <div className="h-11 border-b border-line bg-panel" />
          )}
        </div>
        {mobileChrome === 'replace' ? null : (
          <div className="chart-mob h-10 w-full shrink-0 items-center gap-1 border-b border-line bg-panel px-1.5">
            {toolbarStart}
            <div className="min-w-0 flex-1" />
            {/* CSS hides this bar on desktop, but React still mounts it. Wait for the chart so slots can call useApp(). */}
            {app ? toolbarEnd : null}
          </div>
        )}
        <div className="flex min-h-0 flex-1">
          <div className="chart-desk h-full w-12 shrink-0 overflow-hidden [&_nav]:h-full">
            {app ? (
              <DrawingToolbar />
            ) : (
              <div className="h-full w-12 border-r border-line bg-panel" />
            )}
          </div>
          <main className="relative min-w-0 flex-1" aria-label="Chart">
            <div ref={chartRef} className="absolute inset-0" data-testid="chart" />
            {app ? (
              <>
                <Legend />
                <ChartControls />
                <FavoritesToolbar />
                <MobileChartOverlay
                  start={mobileChrome === 'replace' ? mobileStart : undefined}
                  below={mobileTop}
                />
                <FloatingToolbar />
                <TextEditorOverlay />
                <IntervalTyperOverlay />
              </>
            ) : null}
            <LoadingOverlay />
            {overlay}
          </main>
          {compact ? null : sidePanel}
        </div>
        {mobileFooter ? (
          <>
            <div className="chart-desk flex shrink-0 flex-col">{footer}</div>
            <div className="chart-mob w-full shrink-0 flex-col">{mobileFooter}</div>
          </>
        ) : (
          <>
            <div className="chart-mob w-full shrink-0 flex-col">
              <MobileTimeDock />
            </div>
            {footer}
          </>
        )}
        {app && !hideReplay ? <ReplayBar /> : null}
        {compact && sidePanel ? (
          <div
            className="fixed inset-0 z-40 flex items-end bg-black/60"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) onSidePanelClose?.();
            }}
          >
            <div
              className="max-h-[92%] w-full overflow-auto rounded-t-2xl bg-panel shadow-2xl [&_aside]:max-h-[92vh] [&_aside]:w-full [&_aside]:border-0"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {sidePanel}
            </div>
          </div>
        ) : null}
        {app ? (
          <>
            <DialogHost />
            <ContextMenu chartItems={chartMenuItems} />
          </>
        ) : null}
        <Toasts />
      </div>
    </AppContext.Provider>
  );
}
