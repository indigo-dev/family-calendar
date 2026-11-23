import { Capacitor, CapacitorHttp, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { locale } from '../i18n';

/**
 * Bridge to the Android shell (HomeWally, see android/ and capacitor.config.ts).
 * On the website everything here is inactive: `isNative` is false and the module "Apps" is hidden.
 */
export const isNative = Capacitor.isNativePlatform();

export interface InstalledApp {
  packageName: string;
  activity: string;
  label: string;
  /** PNG/WebP data URL; missing if Android had no icon */
  icon?: string;
}

interface AppLauncherPlugin {
  getApps(opts?: { icons?: boolean }): Promise<{ apps: InstalledApp[] }>;
  launch(opts: { packageName: string; activity?: string }): Promise<void>;
  openSettings(opts?: { page?: 'home' | 'app' }): Promise<void>;
  isDefaultLauncher(): Promise<{ value: boolean }>;
  setKeepAwake(opts: { enabled: boolean }): Promise<void>;
  addListener(event: 'appsChanged', fn: () => void): Promise<PluginListenerHandle>;
}

/** native part: android/app/src/main/java/io/github/indigodev/homewally/AppLauncherPlugin.java */
const AppLauncher = registerPlugin<AppLauncherPlugin>('AppLauncher');

export async function getApps(): Promise<InstalledApp[]> {
  if (!isNative) return [];
  const { apps } = await AppLauncher.getApps({ icons: true });
  return apps.sort((a, b) => a.label.localeCompare(b.label, locale(), { sensitivity: 'base' }));
}

export const launchApp = (app: Pick<InstalledApp, 'packageName' | 'activity'>) =>
  AppLauncher.launch({ packageName: app.packageName, activity: app.activity });

export const openAndroidSettings = (page?: 'home' | 'app') => AppLauncher.openSettings({ page });

export async function isDefaultLauncher(): Promise<boolean> {
  if (!isNative) return false;
  return (await AppLauncher.isDefaultLauncher()).value;
}

export function setKeepAwake(enabled: boolean) {
  if (isNative) AppLauncher.setKeepAwake({ enabled }).catch(() => {});
}

/** Called when apps are installed or removed; returns the unsubscribe function. */
export function onAppsChanged(fn: () => void): () => void {
  if (!isNative) return () => {};
  const handle = AppLauncher.addListener('appsChanged', fn);
  return () => void handle.then((h) => h.remove());
}

/** The Android back button (MainActivity sends it to the web app instead of closing the launcher). */
export function onAndroidBack(fn: () => void): () => void {
  if (!isNative) return () => {};
  window.addEventListener('homewallyback', fn);
  return () => window.removeEventListener('homewallyback', fn);
}

/**
 * Loads a URL as text directly from the device, past the browser's CORS rules.
 * Only in the app: on the website calendar links still need the Cloudflare worker.
 */
export async function nativeGetText(url: string): Promise<{ status: number; text: string }> {
  const res = await CapacitorHttp.get({ url, responseType: 'text', headers: { Accept: 'text/calendar, text/plain, */*' } });
  const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  return { status: res.status, text };
}
