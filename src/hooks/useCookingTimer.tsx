import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { db } from '@/services/database/db';
import { DEVICE_SETTINGS_KEYS } from '@/models';
import type { ActiveCookingTimer } from '@/models';

interface CookingTimerContextValue {
  timer: ActiveCookingTimer | null;
  remainingSeconds: number;
  isComplete: boolean;
  /** Starts (or replaces) the active timer. audioUnlockEl must be the
   * same <audio> element the completion sound will later play from —
   * calling .play()/.pause() on it here, inside the tap that triggered
   * this, is what lets the later unattended .play() call succeed. */
  startTimer: (args: {
    mealId: string;
    mealName: string;
    stepId: string;
    stepTitle: string;
    durationSeconds: number;
  }) => void;
  dismissTimer: () => void;
}

const CookingTimerContext = createContext<CookingTimerContextValue | null>(null);

/** Mounted once at the app root (see App.tsx) so the timer keeps
 * ticking — and the completion alert still fires — no matter which
 * page is showing, including after exiting Cooking Mode with "keep
 * running" confirmed. Not reliable if the tab itself is fully
 * backgrounded/suspended (especially iOS Safari) or the app is
 * closed; that's a v1 PWA limitation, not something a plain
 * setInterval can fix without a service worker push subscription. */
export function CookingTimerProvider({ children }: { children: ReactNode }) {
  const [timer, setTimer] = useState<ActiveCookingTimer | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const alertedRef = useRef(false);

  // Restore any timer that was already running — e.g. after a soft
  // reload, or navigating back into the app.
  useEffect(() => {
    void db.deviceSettings.get(DEVICE_SETTINGS_KEYS.activeCookingTimer).then((rec) => {
      if (rec?.value) setTimer(rec.value as ActiveCookingTimer);
    });
  }, []);

  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const remainingMs = timer ? new Date(timer.targetEndsAt).getTime() - now : 0;
  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const isComplete = !!timer && remainingMs <= 0;

  // Fire the alert exactly once per completion, not on every tick
  // after it.
  useEffect(() => {
    if (isComplete && !alertedRef.current) {
      alertedRef.current = true;
      void audioRef.current?.play().catch(() => {
        // Autoplay can still be blocked if the unlocking tap (see
        // startTimer) happened in a different page lifetime — nothing
        // more we can do about that in v1 without a service worker.
      });
      if ('vibrate' in navigator) navigator.vibrate([300, 150, 300]);
    }
    if (!isComplete) alertedRef.current = false;
  }, [isComplete]);

  const startTimer: CookingTimerContextValue['startTimer'] = ({
    mealId,
    mealName,
    stepId,
    stepTitle,
    durationSeconds,
  }) => {
    const targetEndsAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
    const next: ActiveCookingTimer = { mealId, mealName, stepId, stepTitle, targetEndsAt };
    alertedRef.current = false;
    setTimer(next);
    setNow(Date.now());
    void db.deviceSettings.put({ key: DEVICE_SETTINGS_KEYS.activeCookingTimer, value: next });

    // Unlock audio playback for the later, unattended completion
    // .play() call — this runs inside the "Start Timer" tap's own
    // gesture context, which is what browsers require.
    const el = audioRef.current;
    if (el) {
      el.currentTime = 0;
      void el
        .play()
        .then(() => {
          el.pause();
          el.currentTime = 0;
        })
        .catch(() => {});
    }
  };

  const dismissTimer = () => {
    setTimer(null);
    alertedRef.current = false;
    void db.deviceSettings.delete(DEVICE_SETTINGS_KEYS.activeCookingTimer);
  };

  return (
    <CookingTimerContext.Provider value={{ timer, remainingSeconds, isComplete, startTimer, dismissTimer }}>
      {children}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src="/sounds/timer-done.mp3" preload="auto" />
    </CookingTimerContext.Provider>
  );
}

export function useCookingTimer() {
  const ctx = useContext(CookingTimerContext);
  if (!ctx) throw new Error('useCookingTimer must be used within CookingTimerProvider');
  return ctx;
}

/** Formats whole seconds as M:SS (or H:MM:SS past an hour) for the
 * timer displays. */
export function formatSeconds(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
