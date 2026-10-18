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
import { ContextMenu, type ChartMenuItems } from '../drawing/ContextMenu';
import { DrawingToolbar } from '../drawing/DrawingToolbar';
import { FavoritesToolbar } from '../drawing/FavoritesToolbar';
import { FloatingToolbar } from '../drawing/FloatingToolbar';
import { TextEditorOverlay } from '../drawing/TextEditorOverlay';
import { ChartControls } from './ChartControls';
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
  /** Options for the ChartApp (creation time only). */
  readonly appOptions?: ChartAppOptions;
  /** Hides the bar-replay button and bar (a host with its own replay). */
  readonly hideReplay?: boolean;
  /** Rendered to the right of the chart (e.g. an order panel). */
  readonly sidePanel?: ReactNode;
  /** Extra entries at the top of the chart's right-click menu. */
  readonly chartMenuItems?: ChartMenuItems;
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
  appOptions,
  hideReplay = false,
  sidePanel,
  chartMenuItems,
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

  return (
    <AppContext.Provider value={app}>
      <div dir="ltr" className="flex h-full w-full flex-col bg-chart text-fg">
        {app ? (
          <TopToolbar
            end={toolbarEnd}
            start={toolbarStart}
            symbolLocked={appOptions?.symbol !== undefined}
            hideReplay={hideReplay}
          />
        ) : (
          <div className="h-10 shrink-0 border-b border-line bg-panel" />
        )}
        <div className="flex min-h-0 flex-1">
          {app ? (
            <DrawingToolbar />
          ) : (
            <div className="w-12 shrink-0 border-r border-line bg-panel" />
          )}
          <main className="relative min-w-0 flex-1" aria-label="Chart">
            <div ref={chartRef} className="absolute inset-0" data-testid="chart" />
            {app ? (
              <>
                <Legend />
                <ChartControls />
                <FavoritesToolbar />
                <FloatingToolbar />
                <TextEditorOverlay />
                <IntervalTyperOverlay />
              </>
            ) : null}
            <LoadingOverlay />
            {overlay}
          </main>
          {sidePanel}
        </div>
        {footer}
        {app && !hideReplay ? <ReplayBar /> : null}
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
