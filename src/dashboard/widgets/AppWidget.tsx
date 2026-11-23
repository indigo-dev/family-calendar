import { useEffect, useState } from 'react';
import { getAppIcon } from '../../native/launcher';
import type { WidgetProps } from './shared';

/**
 * 1×1 tile that starts an Android app (only in the Android app). Shows the app's icon in the highest
 * resolution the app ships; tapping it is handled by the dashboard (launchApp).
 */
export function AppWidget({ widget }: WidgetProps) {
  const app = widget?.app;
  const [icon, setIcon] = useState<string | null>(null);

  useEffect(() => {
    if (!app) return;
    let alive = true;
    getAppIcon(app)
      .then((src) => alive && setIcon(src))
      .catch(() => alive && setIcon(null));
    return () => {
      alive = false;
    };
  }, [app]);

  if (!app) return null;
  return (
    <div className="dw-app">
      {icon ? (
        <img className="dw-app-icon" src={icon} alt="" draggable={false} />
      ) : (
        <span className="dw-app-icon dw-app-letter" aria-hidden>
          {app.label.slice(0, 1)}
        </span>
      )}
      <span className="dw-app-label">{app.label}</span>
    </div>
  );
}
