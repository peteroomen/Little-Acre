'use client';

import { useGameStore } from '@/lib/game/store';

const STARS = [
  { top: '14%', left: '18%', s: 3, dur: '2.2s', delay: '0s' },
  { top: '22%', left: '70%', s: 3, dur: '1.8s', delay: '.3s' },
  { top: '33%', left: '44%', s: 2, dur: '2.6s', delay: '.6s' },
  { top: '12%', left: '52%', s: 2, dur: '2s', delay: '.9s' },
  { top: '26%', left: '30%', s: 2, dur: '2.4s', delay: '.2s' },
];

/** Full-screen dusk overlay shown while sleeping; fades out at sunrise. */
export function NightOverlay() {
  const phase = useGameStore((s) => s.phase);
  const night = useGameStore((s) => s.night);
  const isNight = phase === 'night';

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center transition-opacity duration-500"
      style={{
        background: 'radial-gradient(circle at 50% 40%, #35306a, #201b45 70%)',
        pointerEvents: isNight ? 'auto' : 'none',
        opacity: isNight ? 1 : 0,
      }}
    >
      <div className="absolute inset-0 overflow-hidden">
        {STARS.map((st, i) => (
          <span
            key={i}
            className="la-anim absolute bg-white"
            style={{
              top: st.top,
              left: st.left,
              width: st.s,
              height: st.s,
              animation: `la-stars ${st.dur} ${st.delay} infinite`,
            }}
          />
        ))}
      </div>
      <div className="relative text-center">
        <div
          className="la-anim relative mx-auto mb-4 h-[70px] w-[70px]"
          style={{ animation: 'la-pulse 3s infinite' }}
        >
          <div className="absolute inset-0 rounded-full bg-[#fff0b8] shadow-[0_0_40px_rgba(255,240,184,.5)]" />
          <div className="absolute -right-2.5 -top-1.5 h-16 w-16 rounded-full bg-[#201b45]" />
        </div>
        <div className="font-pixel text-3xl font-semibold tracking-wider text-[#fdf3e0]">
          {night.title}
        </div>
        <div className="mt-1.5 text-[15px] text-[#c8bfe0]">{night.sub}</div>
      </div>
    </div>
  );
}
