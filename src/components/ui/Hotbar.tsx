'use client';

import { useGameStore } from '@/lib/game/store';

/** Bottom hotbar: Click / Build tool toggle + the Store button. */
export function Hotbar() {
  const tool = useGameStore((s) => s.tool);
  const setTool = useGameStore((s) => s.setTool);
  const openStore = useGameStore((s) => s.openStore);

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center p-3">
      <div className="la-notch flex w-full max-w-[660px] items-stretch gap-2.5 bg-[var(--la-panel)] p-3 shadow-[inset_0_0_0_3px_#fffaf0,inset_0_0_0_6px_#e7cfa5]">
        <div className="flex min-w-0 flex-1 gap-2">
          <ToolButton active={tool === 'click'} onClick={() => setTool('click')} label="Click">
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
              <path
                d="M8 3 L8 15 L11 12.5 L13.5 18 L15.5 17 L13 11.5 L17 11 Z"
                fill="#6a4a2a"
                stroke="#3a2814"
                strokeWidth="1"
              />
            </svg>
          </ToolButton>
          <ToolButton active={tool === 'build'} onClick={() => setTool('build')} label="Build">
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
              <rect
                x="9.5"
                y="10"
                width="2.6"
                height="11"
                fill="#8a5a2b"
                transform="rotate(-28 11 15)"
              />
              <path
                d="M12.5 4 L19.5 8 L16.5 13 L9.5 9 Z"
                fill="#b7ad93"
                stroke="#7d745e"
                strokeWidth="1"
              />
            </svg>
          </ToolButton>
        </div>

        <div className="w-[3px] self-stretch bg-[#ecd9b6]" />

        <button
          onClick={openStore}
          className="la-notch flex w-[74px] flex-col items-center justify-center gap-0.5 bg-[var(--la-leaf)] px-1.5 py-2 font-pixel text-[13px] font-semibold text-[var(--la-leaf-text)] shadow-[inset_0_3px_0_rgba(255,255,255,.45),inset_0_-5px_0_rgba(40,80,20,.28),inset_0_0_0_3px_#bfe89b] active:translate-y-0.5"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
            <rect x="4" y="8" width="14" height="8" fill="#fbf3dc" />
            <rect x="4" y="6" width="14" height="3" fill="#e58a6a" />
            <rect x="6" y="6" width="2" height="3" fill="#fbf3dc" />
            <rect x="10" y="6" width="2" height="3" fill="#fbf3dc" />
            <rect x="14" y="6" width="2" height="3" fill="#fbf3dc" />
          </svg>
          <span>Store</span>
        </button>
      </div>
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`la-notch flex min-w-[64px] flex-1 flex-col items-center justify-center gap-1 px-1 py-3 font-pixel text-[13px] font-semibold active:translate-y-0.5 ${
        active
          ? 'bg-[#ffe1a0] text-[#8a5c14] shadow-[inset_0_3px_0_rgba(255,255,255,.65),inset_0_-6px_0_rgba(150,100,20,.3),inset_0_0_0_3px_#f0bd5e]'
          : 'bg-[#efe0c2] text-[#9a835f] shadow-[inset_0_3px_0_rgba(255,255,255,.6),inset_0_-6px_0_rgba(120,90,40,.2),inset_0_0_0_3px_#e0cca2]'
      }`}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}
