import {
  Component,
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

function classes(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export class AppErrorBoundary extends Component<
  { children: ReactNode; fallback?: (error: Error) => ReactNode },
  { error: Error | null }
> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(): void {
    // Application-level telemetry can be connected here without coupling the UI package to a provider.
  }

  override render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.state.error);
    return (
      <main className="ui-error-boundary" role="alert">
        <span>APPLICATION ERROR</span>
        <h1>页面暂时无法显示</h1>
        <p>界面遇到了未预期的错误。重新加载后仍未恢复，请携带发生时间联系维护人员。</p>
        <Button onClick={() => window.location.reload()}>重新加载</Button>
      </main>
    );
  }
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: 'sm' | 'md';
    loading?: boolean;
  }
>(function Button(
  { className, variant = 'primary', size = 'md', loading = false, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={classes('ui-button', `ui-button--${variant}`, `ui-button--${size}`, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner size="sm" label="正在处理" /> : children}
    </button>
  );
});

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={classes('ui-card', className)} {...props} />;
}

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger';
}) {
  return <span className={classes('ui-badge', `ui-badge--${tone}`, className)} {...props} />;
}

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={classes('ui-alert', `ui-alert--${tone}`)}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      {title ? <strong>{title}</strong> : null}
      <div>{children}</div>
    </div>
  );
}

export const TextField = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    hint?: string;
    error?: string;
  }
>(function TextField({ label, hint, error, id: externalId, className, ...props }, ref) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  const descriptionId = `${id}-description`;
  return (
    <label className={classes('ui-field', className)} htmlFor={id}>
      <span className="ui-field__label">{label}</span>
      <input
        ref={ref}
        id={id}
        className={classes('ui-input', error && 'ui-input--error')}
        aria-invalid={Boolean(error)}
        aria-describedby={hint || error ? descriptionId : undefined}
        {...props}
      />
      {hint || error ? (
        <span id={descriptionId} className={classes('ui-field__hint', error && 'ui-field__error')}>
          {error ?? hint}
        </span>
      ) : null}
    </label>
  );
});

export function Spinner({ size = 'md', label = '加载中' }: { size?: 'sm' | 'md'; label?: string }) {
  return (
    <span className={classes('ui-spinner-wrap', `ui-spinner-wrap--${size}`)} role="status">
      <span className="ui-spinner" aria-hidden="true" />
      <span className="ui-sr-only">{label}</span>
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="ui-page-header">
      <div>
        {eyebrow ? <span className="ui-page-header__eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="ui-page-header__actions">{actions}</div> : null}
    </header>
  );
}

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: 'start' | 'end';
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = '暂无数据',
}: {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
}) {
  return (
    <div className="ui-table-wrap">
      <table className="ui-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.align === 'end' ? 'ui-table__end' : undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={column.align === 'end' ? 'ui-table__end' : undefined}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="ui-table__empty">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="ui-empty-state">
      <span className="ui-empty-state__mark" aria-hidden="true">
        ◇
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function Dialog({
  open,
  title,
  description,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, open]);

  if (!open) return null;
  return createPortal(
    <div className="ui-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="ui-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ui-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="ui-dialog__header">
          <div>
            <h2 id="ui-dialog-title">{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button className="ui-icon-button" type="button" onClick={onClose} aria-label="关闭弹窗">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

type ToastTone = 'success' | 'info' | 'danger';
type Toast = { id: number; message: string; tone: ToastTone };
type ToastContextValue = { notify: (message: string, tone?: ToastTone) => void };
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== id)),
      3600,
    );
  }, []);
  const value = useMemo(() => ({ notify }), [notify]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="ui-toasts" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={classes('ui-toast', `ui-toast--${toast.tone}`)}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
}
