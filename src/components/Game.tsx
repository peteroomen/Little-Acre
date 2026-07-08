'use client';

import { useEffect, useRef } from 'react';

import { startLoop } from '@/lib/game/loop';
import { useGameStore, type ActionResult } from '@/lib/game/store';
import { BoardRenderer } from '@/lib/renderer/board-renderer';

import { BuildPicker } from './ui/BuildPicker';
import { Hotbar } from './ui/Hotbar';
import { Hud } from './ui/Hud';
import { NightOverlay } from './ui/NightOverlay';
import { ObjectiveBanner, PuzzleIntro, PuzzleResult } from './ui/PuzzleOverlays';
import { StoreModal } from './ui/StoreModal';
import { Toasts } from './ui/Toasts';

export function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BoardRenderer | null>(null);
  const hoverKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new BoardRenderer(canvas);
    rendererRef.current = renderer;

    // App.init() has already loaded the save / set up the active run — just seed the snapshot.
    const pushSnapshot = () => {
      const { board, phase } = useGameStore.getState();
      renderer.setSnapshot({ board, phase, hoverKey: hoverKeyRef.current });
    };
    pushSnapshot();
    renderer.start();

    // Keep the renderer's board/phase in sync without re-rendering React per frame.
    const unsub = useGameStore.subscribe(pushSnapshot);
    const stopLoop = startLoop();

    // ── Map an action result onto imperative renderer fx (prototype-faithful). ──
    const dispatchFx = (res: ActionResult) => {
      if (res.fx === 'none') return;
      const { x, y } = renderer.tileCenter(res.r, res.c);
      switch (res.fx) {
        case 'nudge':
          renderer.nudge(res.r, res.c);
          break;
        case 'water':
          renderer.pop(res.r, res.c);
          renderer.splash(x, y);
          break;
        case 'plant':
          renderer.pop(res.r, res.c);
          renderer.burst(x, y - 6, res.color ?? '#83c250', 8);
          if (res.cost) renderer.floatText(x, y - 10, `-${res.cost}`, 'coin');
          break;
        case 'harvest':
          renderer.pop(res.r, res.c);
          renderer.burst(x, y - 8, res.color ?? '#f0894a', 16, 90);
          renderer.coinBurst(x, y - 10);
          if (res.gain) renderer.floatText(x, y - 14, `+${res.gain}`, 'coinBig');
          renderer.addShake(3);
          break;
        case 'clear':
          renderer.pop(res.r, res.c);
          renderer.burst(x, y, res.color ?? '#a08a63', 10);
          break;
        case 'fish':
          renderer.pop(res.r, res.c);
          renderer.splash(x, y);
          renderer.coinBurst(x, y - 8);
          if (res.gain) renderer.floatText(x, y - 12, `+${res.gain}`, 'coinBig');
          renderer.addShake(2);
          break;
        case 'mine':
          renderer.pop(res.r, res.c);
          renderer.burst(x, y - 6, res.color ?? '#cfc6ac', 12, 80);
          renderer.coinBurst(x, y - 8);
          if (res.gain) renderer.floatText(x, y - 12, `+${res.gain}`, 'coinBig');
          renderer.addShake(3);
          break;
        case 'place':
          renderer.placeAnim(res.r, res.c);
          if (res.cost) renderer.floatText(x, y - 14, `-${res.cost}`, 'coin');
          renderer.addShake(4);
          break;
        case 'build':
          renderer.placeAnim(res.r, res.c);
          if (res.cost) renderer.floatText(x, y - 14, `-${res.cost}`, 'coin');
          renderer.addShake(3);
          break;
      }
    };

    const localXY = (e: PointerEvent): [number, number] => {
      const rect = canvas.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    };

    const onPointerDown = (e: PointerEvent) => {
      if (useGameStore.getState().phase !== 'day') return;
      const [px, py] = localXY(e);
      const hit = renderer.tileAt(px, py);
      if (!hit) return;
      const res = useGameStore.getState().useTool(hit.r, hit.c);
      dispatchFx(res);
    };

    const onPointerMove = (e: PointerEvent) => {
      const [px, py] = localXY(e);
      const hit = renderer.tileAt(px, py);
      const key = hit ? `${hit.r}-${hit.c}` : null;
      if (key !== hoverKeyRef.current) {
        hoverKeyRef.current = key;
        pushSnapshot();
      }
    };

    const onPointerLeave = () => {
      if (hoverKeyRef.current !== null) {
        hoverKeyRef.current = null;
        pushSnapshot();
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      unsub();
      stopLoop();
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <Hud />
      <ObjectiveBanner />
      <BuildPicker />
      <Hotbar />
      <Toasts />
      <NightOverlay />
      <StoreModal />
      <PuzzleIntro />
      <PuzzleResult />
    </div>
  );
}
