import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '../i18n';

interface Props {
  children: ReactNode;
  /** name shown in the message and the console, e.g. "Wetter" */
  label: string;
  /** a new value clears the error (e.g. the active module or settings tab) */
  resetKey?: unknown;
  /** small fallback that fits into a dashboard widget */
  compact?: boolean;
  /** try again by itself after this many seconds – nobody may be near the wall display; 0 = never */
  retrySec?: number;
  /** replaces the built-in fallback (`null` = show nothing) */
  fallback?: ReactNode;
  onError?: (error: Error) => void;
}

interface State {
  error: Error | null;
  resetKey: unknown;
}

/**
 * Catches render errors of one part of the app, so a single broken module or widget
 * doesn't leave the whole wall display blank.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey };
  private timer: number | undefined;

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.label}]`, error, info.componentStack);
    this.props.onError?.(error);
    const sec = this.props.retrySec ?? 60;
    window.clearTimeout(this.timer);
    if (sec > 0) this.timer = window.setTimeout(this.reset, sec * 1000);
  }

  componentWillUnmount() {
    window.clearTimeout(this.timer);
  }

  reset = () => {
    window.clearTimeout(this.timer);
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    const { children, label, compact, fallback } = this.props;
    if (!error) return children;
    if (fallback !== undefined) return fallback;

    if (compact) {
      return (
        <div className="error-fallback compact" role="alert">
          <span className="error-fallback-icon" aria-hidden>
            ⚠︎
          </span>
          <p>{t('error.failed', { label })}</p>
          <button
            className="btn"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              this.reset();
            }}
          >
            {t('common.retry')}
          </button>
        </div>
      );
    }

    return (
      <div className="error-fallback" role="alert">
        <span className="error-fallback-icon" aria-hidden>
          ⚠︎
        </span>
        <h3>{t('error.failed', { label })}</h3>
        <p className="muted">{error.message}</p>
        <div className="error-fallback-actions">
          <button className="btn primary" onClick={this.reset}>
            {t('common.retry')}
          </button>
          <button className="btn" onClick={() => window.location.reload()}>
            {t('error.reload')}
          </button>
        </div>
      </div>
    );
  }
}
