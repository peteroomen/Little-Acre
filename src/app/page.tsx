'use client';

import dynamic from 'next/dynamic';

// The whole app shell is client-only (the Canvas2D board is browser-only). Skip SSR at the top.
const App = dynamic(() => import('@/components/App').then((m) => m.App), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-[#e7f2e4]">
      <p className="font-pixel text-sm text-[#a08862] tracking-widest">Loading…</p>
    </div>
  ),
});

export default function Page() {
  return (
    <main className="h-full">
      <App />
    </main>
  );
}
