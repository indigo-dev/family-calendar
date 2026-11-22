import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android shell ("HomeWally"): the same web build as the website, packed into an app that can be the
 * tablet's home screen (launcher). Build: `npm run android:sync`, then GitHub Actions (android.yml).
 * The package name (appId) is fixed in the Play Store and must never change.
 */
const config: CapacitorConfig = {
  appId: 'io.github.indigodev.homewally',
  appName: 'HomeWally',
  webDir: 'dist',
  android: {
    // the app shows its own content behind the system bars' colours; no zoom gestures of the WebView
    allowMixedContent: false,
  },
};

export default config;
