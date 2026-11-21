import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { Modals } from './components/Modals';
import { TitleScreen } from './components/TitleScreen';
import { GameEngine } from './game/engine';
import type { CharacterId, HudSnapshot, ModalType } from './game/types';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const gameFocusRef = useRef<HTMLElement | null>(null);

  const [selectedChar, setSelectedChar] = useState<CharacterId>('pip');
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [hasSave, setHasSave] = useState(false);
  const [modal, setModal] = useState<ModalType>(null);
  const [modalPayload, setModalPayload] = useState<{
    creatureId?: string;
    residentId?: string;
    plotId?: string;
    buildingId?: string;
  }>({});
  const isPlaying = hud?.mode === 'playing';
  const isTitle = !hud || hud.mode === 'title';
  const dialogOpen = !isTitle && Boolean(modal || !isPlaying);

  useLayoutEffect(() => {
    if (isPlaying && !dialogOpen) {
      const previous = gameFocusRef.current;
      (previous?.isConnected ? previous : canvasRef.current)?.focus({ preventScroll: true });
    }
  }, [dialogOpen, isPlaying]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3400);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new GameEngine(canvas, {
      onHudUpdate: (snap) => setHud(snap),
      onToast: (msg) => showToast(msg),
      onOpenModal: (nextModal, payload) => {
        setModal(nextModal);
        setModalPayload(payload || {});
      },
      onModeChange: (nextMode) => {
        if (nextMode === 'title') {
          setHasSave(engine.hasSave());
        }
      },
    });

    engineRef.current = engine;
    setHasSave(engine.hasSave());
    engine.startLoop();

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.startNewGame('pip');
    } else {
      document.body.dataset.state = 'title';
    }

    return () => {
      engine.destroy();
      engineRef.current = null;
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, [showToast]);

  const handleMinimapRef = useCallback((el: HTMLCanvasElement | null) => {
    engineRef.current?.setMinimapCanvas(el);
  }, []);

  const handleStart = useCallback(() => {
    engineRef.current?.startNewGame(selectedChar);
  }, [selectedChar]);

  const handleResumeSave = useCallback(() => {
    engineRef.current?.loadGame();
  }, []);

  const handleRestart = useCallback(() => {
    engineRef.current?.startNewGame(hud?.charId || selectedChar);
  }, [hud?.charId, selectedChar]);

  const handleReturnTitle = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.setActiveModal(null);
    eng.setMode('title');
  }, []);

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#160c24]">
      {/* Isolated Full-Bleed Canvas Viewport */}
      <div className="fixed inset-0 z-0" inert={dialogOpen || isTitle}>
        <canvas
          ref={canvasRef}
          tabIndex={0}
          data-testid="game-canvas"
          aria-label="Don't Melt surreal survival world"
          onFocus={(event) => { gameFocusRef.current = event.currentTarget; }}
          className="block w-full h-full touch-none focus-visible:outline-offset-[-2px]"
        />
      </div>

      {/* Title Screen Overlay */}
      {isTitle && (
        <TitleScreen
          selectedChar={selectedChar}
          onSelectChar={setSelectedChar}
          onStart={handleStart}
          hasSave={hasSave}
          onResume={handleResumeSave}
        />
      )}

      {/* Active Playing HUD */}
      {hud && hud.mode !== 'title' && (
        <div inert={dialogOpen} onFocus={(event) => { gameFocusRef.current = event.target; }}>
          <GameHud
            hud={hud}
            showRadioTicker={!toast}
            minimapRef={handleMinimapRef}
            onOpenModal={(m) => engineRef.current?.setActiveModal(m)}
            onToggleMute={() => engineRef.current?.toggleMute()}
            onSave={() => engineRef.current?.saveGame(false)}
            onPause={() => engineRef.current?.setMode('paused')}
            onBoop={() => engineRef.current?.triggerBoop()}
            onRoll={() => engineRef.current?.triggerRoll()}
            onAbility={() => engineRef.current?.triggerAbility()}
            onConsumeItem={(id) => engineRef.current?.consumeItem(id)}
            onSelectCastSlot={(slot) => engineRef.current?.selectCastSlot(slot)}
            onMoveDockLamp={(slot) => engineRef.current?.moveDockLamp(slot)}
            onStartCast={(slot) => engineRef.current?.startCast(slot)}
            onFishingActionDown={() => engineRef.current?.handleFishingActionDown()}
            onFishingReel={(pressed) => engineRef.current?.setFishingReel(pressed)}
            onToggleFishingAssist={() => engineRef.current?.toggleFishingAssist()}
            onCancelFishing={() => engineRef.current?.cancelFishing()}
            onPlaceMovedBuilding={() => engineRef.current?.placeMovedBuilding()}
            onRotateMovedBuilding={() => {
              if (hud.movingBuildingId) engineRef.current?.rotateBuilding(hud.movingBuildingId);
            }}
            onCancelMove={() => engineRef.current?.cancelMoveBuilding()}
          />
        </div>
      )}

      {/* Gameplay Modals, Pause, and Game Over */}
      {hud && hud.mode !== 'title' && (
        <Modals
          engine={engineRef.current}
          hud={hud}
          modal={modal}
          payload={modalPayload}
          onClose={() => engineRef.current?.setActiveModal(null)}
          onResume={() => engineRef.current?.setMode('playing')}
          onRestart={handleRestart}
          onTitle={handleReturnTitle}
          onSave={() => engineRef.current?.saveGame(false)}
        />
      )}
      <div role="status" className={`fixed z-50 pointer-events-none left-1/2 -translate-x-1/2 w-max max-w-[90vw] ${
        dialogOpen ? 'top-2' : isTitle ? 'top-4' : 'top-[192px] sm:top-4'
      }`}>
        {toast && (
          <div className="max-w-[490px] px-4 py-2 rounded-xl bg-[#ffd166] text-[#160c24] font-bold text-xs sm:text-[13px] border-2 border-[#160c24] shadow-lg text-center">
            {toast}
          </div>
        )}
      </div>
    </main>
  );
}
