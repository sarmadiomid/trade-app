'use client';

import { createContext, useContext } from 'react';

export type ToolbarLocale = 'en' | 'fa';

export const ToolbarLocaleContext = createContext<ToolbarLocale>('en');

const FA: Readonly<Record<string, string>> = {
  'Symbol search': 'جستجوی نماد',
  Interval: 'تایم‌فریم',
  'All intervals': 'همه تایم‌فریم‌ها',
  'Minutes': 'دقیقه',
  'Hours': 'ساعت',
  'Days & Weeks': 'روز و هفته',
  'Pin to toolbar': 'سنجاق به نوار بالا',
  'Unpin from toolbar': 'برداشتن از نوار بالا',
  'Chart type': 'نوع نمودار',
  'Classic': 'کلاسیک',
  'Lines & Area': 'خطی و ناحیه‌ای',
  'Price-based': 'مبتنی بر قیمت',
  'Order Flow': 'جریان سفارش',
  'Indicators': 'اندیکاتورها',
  'Volume': 'حجم معاملات',
  'Save chart image': 'ذخیره تصویر نمودار',
  'Full screen': 'تمام‌صفحه',
  'Exit full screen': 'خروج از تمام‌صفحه',
  'Chartis': 'چیدمان',
  'Layouts': 'چیدمان‌ها',
  'Save layout': 'ذخیره چیدمان',
  Undo: 'واگرد',
  Redo: 'انجام دوباره',
  Themes: 'پوسته‌ها',
  'Keyboard shortcuts': 'میانبرهای نمودار',
  'Chart settings': 'تنظیمات نمودار',
  More: 'بیشتر',
  'Export drawings (JSON)': 'خروجی ترسیم‌ها (JSON)',
  'Import drawings…': 'ورود ترسیم‌ها…',
  'Themes…': 'پوسته‌ها…',
  'Data source': 'منبع داده',
  'type e.g. 4h ↵': 'مثلاً 4h بنویسید ↵',
  'Replay': 'بازپخش',
  'Exit bar replay': 'خروج از بازپخش کندل',
  'Bar replay — pick a start bar': 'بازپخش کندل — انتخاب نقطه شروع',
  'Replay start options': 'گزینه‌های شروع بازپخش',
  'Select bar': 'انتخاب کندل از نمودار',
  'Select date…': 'انتخاب تاریخ…',
  'First available bar': 'اولین کندل موجود',
  'Random bar': 'کندل تصادفی',
  Candles: 'کندل',
  'Hollow candles': 'کندل توخالی',
  'Volume candles': 'کندل حجمی',
  Bars: 'میله‌ای',
  Line: 'خطی',
  'Step line': 'خط پله‌ای',
  Area: 'ناحیه‌ای',
  'HLC area': 'ناحیه HLC',
  Baseline: 'خط مبنا',
  Columns: 'ستونی',
  'High-low': 'سقف و کف',
  'Heikin Ashi': 'هیکن آشی',
  Renko: 'رنکو',
  'Line break': 'شکست خط',
  Kagi: 'کاگی',
  'Point & figure': 'نقطه و رقم',
  Range: 'رنج',
  'Volume footprint': 'فوت‌پرینت حجم',
  'Session volume profile': 'پروفایل حجم سشن',
  'Time price opportunity': 'TPO (نمای بازار)',
};

/** Toolbar copy in the host's language. Unknown strings fall back to English. */
export function useToolbarText(): {
  readonly fa: boolean;
  readonly t: (en: string) => string;
} {
  const locale = useContext(ToolbarLocaleContext);
  const fa = locale === 'fa';
  return { fa, t: (en) => (fa ? (FA[en] ?? en) : en) };
}
