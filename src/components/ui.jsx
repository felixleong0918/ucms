import React, { useEffect, useId, useRef, useState } from 'react';
const paths = {
  home: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  task: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M7 3v4m10-4v4M3 10h18m-13 5h2m4 0h2" />
    </>
  ),
  file: (
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6M8 13h8m-8 4h5" />
  ),
  box: <path d="m12 3 9 5v9l-9 5-9-5V8Zm0 10v9M3 8l9 5 9-5M7.5 5.5l9 5" />,
  clock: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2M9 2h6" />
    </>
  ),
  moon: <path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z" />,
  bell: <path d="M5 17h14l-2-4V9a5 5 0 0 0-10 0v4ZM10 21h4" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  wallet: (
    <>
      <rect x="3" y="5" width="18" height="15" rx="3" />
      <path d="M21 10h-6v5h6M6 5V3h12" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5" />
    </>
  ),
  arrow: <path d="m7 17 10-10M7 7h10v10" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  search: (
    <>
      <circle cx="10" cy="10" r="6" />
      <path d="m15 15 6 6" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4" />
    </>
  ),
  logout: (
    <>
      <path d="M10 4H4v16h6m4-12 4 4-4 4M8 12h10" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
    </>
  ),
  refresh: <path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4m-4 5a8 8 0 0 0 14.9 3M20 20v-4h-4" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a8 8 0 0 1 16 0v1" />
    </>
  ),
  chat: <path d="M4 5h16v11H9l-5 4Zm4 4h8m-8 3h5" />,
  megaphone: <path d="M4 10v4h3l8 4V6l-8 4Zm14-1a4 4 0 0 1 0 6M8 14v5h3v-3.5" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
};
export function Icon({ name, ...props }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      {paths[name] || paths.file}
    </svg>
  );
}
export function Button({ children, kind = '', icon, busy, type = 'button', ...props }) {
  return (
    <button
      type={type}
      {...props}
      className={('button ' + kind).trim()}
      disabled={busy || props.disabled}
      aria-busy={busy || undefined}
    >
      {busy ? <span className="spinner" /> : icon && <Icon name={icon} />}
      <span>{children}</span>
    </button>
  );
}
export function Empty({ title = '還沒有資料', children, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <span className="spinner" /> 正在載入社團資料…
    </div>
  );
}
export function ErrorBox({ error, retry }) {
  return error ? (
    <div className="errorbox" role="alert">
      <span>{error.message || error}</span>
      {retry && <Button onClick={retry}>重試</Button>}
    </div>
  ) : null;
}
export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(),
    label = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? 'wide' : ''}
      aria-labelledby={label}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-head">
        <h2 id={label}>{title}</h2>
        <button type="button" className="iconbutton" onClick={onClose} aria-label="關閉">
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Field({ label, children, hint, ...props }) {
  const id = useId();
  return (
    <label className="field">
      <span>
        {label}
        {props.required && <b aria-hidden="true"> *</b>}
      </span>
      {children || <input id={id} maxLength={props.type === 'email' ? 254 : 200} {...props} />}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function TextArea({ label, hint, ...props }) {
  return (
    <Field label={label} hint={hint} required={props.required}>
      <textarea rows={4} maxLength={10000} {...props} />
    </Field>
  );
}
export function Select({ label, options, hint, ...props }) {
  return (
    <Field label={label} hint={hint} required={props.required}>
      <select {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
// 頁首只放大標題與操作按鈕；不放標題上方的小字或裝飾性副標。
export function Header({ title, children }) {
  return (
    <header className="pagehead">
      <h1>{title}</h1>
      {children && <div className="actions">{children}</div>}
    </header>
  );
}
export function Panel({ title, action, children, className = '' }) {
  return (
    <section className={'panel ' + className}>
      {(title || action) && (
        <div className="panelhead">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Tabs({ value, onChange, items }) {
  return (
    <div className="segmented" role="group">
      {items.map(([key, label]) => (
        <button
          type="button"
          key={key}
          className={key === value ? 'active' : ''}
          aria-pressed={key === value}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
export function Table({ headers, children }) {
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label="資料表，可水平捲動">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export function Search({ value, onChange, placeholder = '搜尋…' }) {
  return (
    <label className="search">
      <Icon name="search" />
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export function ConfirmDelete({ onConfirm, onClose, label }) {
  return (
    <Confirm title="確認刪除" confirmLabel="刪除" danger onConfirm={onConfirm} onClose={onClose}>
      確定刪除「{label}」？此操作無法復原。
    </Confirm>
  );
}
export function Confirm({ title, children, confirmLabel = '確定', danger, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  return (
    <Modal title={title} onClose={() => !busy && onClose()}>
      <p>{children}</p>
      <ErrorBox error={error} />
      <div className="formactions">
        <Button onClick={onClose} disabled={busy}>
          取消
        </Button>
        <Button
          kind={danger ? 'danger' : 'primary'}
          busy={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
export function SaveForm({ onSubmit, onCancel, children, submitLabel = '儲存' }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setError(null);
        setBusy(true);
        try {
          await onSubmit(new FormData(e.currentTarget));
        } catch (e) {
          setError(e);
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>{children}</fieldset>
      <ErrorBox error={error} />
      <div className="formactions">
        {onCancel && (
          <Button type="button" onClick={onCancel} disabled={busy}>
            取消
          </Button>
        )}
        <Button type="submit" kind="primary" busy={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
