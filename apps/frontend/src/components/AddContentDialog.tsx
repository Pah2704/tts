import { useEffect, useMemo, useRef, useState } from 'react';

type Mode = 'mono' | 'dialog';

type Props = {
  open: boolean;
  onClose(): void;
  onSubmit(payload: { mode: Mode; text: string }): void;
};

export function AddContentDialog({ open, onClose, onSubmit }: Props) {
  const [mode, setMode] = useState<Mode>('mono');
  const [text, setText] = useState('');
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      setText('');
      setMode('mono');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    if (!dialog) return;

    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(
      (el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'),
    );
    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || focusable.length === 0) return;
      if (event.shiftKey) {
        if (document.activeElement === firstFocusable || document.activeElement === dialog) {
          event.preventDefault();
          lastFocusable?.focus();
        }
      } else if (document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    requestAnimationFrame(() => {
      firstFocusable?.focus();
    });

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocusedRef.current?.focus();
    };
  }, [open, onClose]);

  const warnings = useMemo(() => {
    if (mode !== 'dialog') return [];
    return text
      .split(/\n+/)
      .map((line, index) => {
        if (!line.trim()) return null;
        if (/^\s*\[[^\]]+\]\s*:/.test(line)) return null;
        return index + 1;
      })
      .filter((v): v is number => typeof v === 'number');
  }, [mode, text]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-content-title"
      >
        <header className="dialog__header">
          <h2 id="add-content-title">Add Content</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </header>

        <div className="dialog__body">
          <div className="mode-chips" role="group" aria-label="Input mode">
            <button
              type="button"
              className={`chip ${mode === 'mono' ? 'chip--active' : ''}`}
              onClick={() => setMode('mono')}
            >
              Đơn thoại (Mono)
            </button>
            <button
              type="button"
              className={`chip ${mode === 'dialog' ? 'chip--active' : ''}`}
              onClick={() => setMode('dialog')}
            >
              Hội thoại (Dialogue)
            </button>
          </div>

          <label htmlFor="add-content-text" className="manifest__metric-label">
            Paste text
          </label>
          <textarea
            id="add-content-text"
            className="textarea textarea--large"
            placeholder={
              mode === 'mono'
                ? 'Paste paragraphs. Empty line breaks into new block.'
                : '[Speaker]: Hello there…'
            }
            value={text}
            onChange={(event) => setText(event.target.value)}
          />

          {warnings.length > 0 && (
            <div className="soft-warning" role="alert">
              ⚠ Hội thoại nghi ngờ ở dòng: {warnings.join(', ')} — vẫn có thể tiếp tục.
            </div>
          )}
        </div>

        <footer className="dialog__footer">
          <button type="button" className="button is-secondary" onClick={onClose}>
            Hủy
          </button>
          <button
            type="button"
            className="button"
            onClick={() => onSubmit({ mode, text })}
            disabled={!text.trim()}
          >
            Tiếp tục
          </button>
        </footer>
      </div>
    </div>
  );
}
