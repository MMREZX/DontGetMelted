import { useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

export function Dialog({ label, className, children }: { label: string; className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, [label]);

  function trapTab(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab') return;
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'button, input, select, textarea, a[href], [tabindex]',
    )).filter((item) => item.tabIndex >= 0 && !item.matches(':disabled') && item.getClientRects().length > 0);
    const current = items.indexOf(document.activeElement as HTMLElement);

    if (current === -1 || (event.shiftKey ? current === 0 : current === items.length - 1)) {
      event.preventDefault();
      items[event.shiftKey ? items.length - 1 : 0]?.focus();
    }
  }

  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onKeyDown={trapTab} className={className}>
      {children}
    </div>
  );
}
