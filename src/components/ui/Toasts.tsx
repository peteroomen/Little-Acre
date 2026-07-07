'use client';

import { useGameStore } from '@/lib/game/store';

/** Transient status messages that rise from above the hotbar. */
export function Toasts() {
  const toasts = useGameStore((s) => s.toasts);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[150px] z-[12] flex flex-col-reverse items-center gap-1.5">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="la-notch la-anim font-pixel text-sm font-semibold"
          style={{
            animation: 'la-toast 1.9s ease-out forwards',
            padding: '7px 14px',
            color: t.kind === 'bad' ? '#fff' : '#4a3826',
            background: t.kind === 'bad' ? 'var(--la-danger)' : 'var(--la-panel-soft)',
            boxShadow: `inset 0 0 0 3px ${t.kind === 'bad' ? '#c85f47' : '#f3d698'}`,
          }}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
