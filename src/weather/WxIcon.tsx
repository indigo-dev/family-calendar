import type { CSSProperties } from 'react';
import { useStore } from '../store';
import { WEATHER_ICON_SETS, weatherEmoji, weatherIconSrc, weatherKey, type WeatherIconSet, type WeatherKey } from '../lib/weatherIcons';
import { describe } from '../lib/weather';

const byId = new Map(WEATHER_ICON_SETS.map((s) => [s.id, s]));

/**
 * A weather condition in the chosen icon style. The box is 1em – set the size with font-size.
 * One-colour styles take the text colour.
 */
export function WxIcon({
  code,
  isDay = true,
  icon,
  set,
  className = '',
  title,
}: {
  code?: number;
  isDay?: boolean;
  /** key instead of a WMO code (previews) */
  icon?: WeatherKey;
  set?: WeatherIconSet;
  className?: string;
  /** spoken / tooltip text; defaults to the condition */
  title?: string;
}) {
  const { settings } = useStore();
  const info = byId.get(set ?? settings.weatherIcons) ?? byId.get('mc-fill')!;
  const key = icon ?? weatherKey(code ?? 3, isDay);
  const label = title ?? (code !== undefined ? describe(code, isDay).text : undefined);
  const a11y = label ? { role: 'img', 'aria-label': label, title: label } : { 'aria-hidden': true };
  const cls = `wxi ${info.padded ? 'wxi-padded' : ''} ${className}`;

  if (info.mode === 'native') {
    return (
      <span className={`${cls} wxi-native`} {...a11y}>
        {weatherEmoji(key)}
      </span>
    );
  }
  const src = weatherIconSrc(info, key);
  if (info.mode === 'mask') {
    const style = { ['--wxi-src' as string]: `url("${src}")` } as CSSProperties;
    return <span className={`${cls} wxi-mask`} style={style} {...a11y} />;
  }
  return <img className={cls} src={src} alt={label ?? ''} title={label} draggable={false} />;
}
