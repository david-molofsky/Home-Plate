import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { db } from '@/services/database/db';
import { useCookingTimer, formatSeconds } from '@/hooks/useCookingTimer';
import { mealDetailPath } from '@/routes/paths';

export function CookingModePage() {
  const { mealId } = useParams();
  const navigate = useNavigate();
  const meal = useLiveQuery(() => (mealId ? db.meals.get(mealId) : undefined), [mealId]);
  const { timer, remainingSeconds, isComplete, startTimer, dismissTimer } = useCookingTimer();

  const [stepIndex, setStepIndex] = useState(0);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const steps = meal?.steps ?? [];
  const step = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;
  const isFirstStep = stepIndex === 0;
  const timerBelongsToThisStep = !!timer && !!step && timer.stepId === step.id;

  // Reset scroll position to the top on every step change so a long
  // ingredient list from the previous step doesn't carry its scroll
  // offset into the next one.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [stepIndex]);

  // Keep the screen awake for as long as this step's timer is
  // actively running and this page is mounted — sidesteps
  // background-tab throttling for the (foreground) case that matters
  // most, without requiring a service worker push subscription.
  useEffect(() => {
    if (!('wakeLock' in navigator) || !timerBelongsToThisStep || isComplete) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    void navigator.wakeLock
      .request('screen')
      .then((s) => {
        if (cancelled) {
          void s.release();
          return;
        }
        sentinel = s;
      })
      .catch(() => {
        // Wake Lock isn't guaranteed (permissions, low battery mode,
        // etc.) — sound + vibration still fire regardless.
      });
    return () => {
      cancelled = true;
      void sentinel?.release();
    };
  }, [timerBelongsToThisStep, isComplete, timer?.targetEndsAt]);

  if (meal === undefined) return null; // still loading
  if (meal === null || !step) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary">
          This meal doesn&apos;t have any steps to cook through.
        </Typography>
        <Button sx={{ mt: 2 }} onClick={() => navigate(mealId ? mealDetailPath(mealId) : '/library')}>
          Back
        </Button>
      </Box>
    );
  }

  const handleStartTimer = () => {
    if (!step.timerSeconds) return;
    startTimer({
      mealId: meal.id,
      mealName: meal.name,
      stepId: step.id,
      stepTitle: step.title || `Step ${stepIndex + 1}`,
      durationSeconds: step.timerSeconds,
    });
  };

  const handleNext = () => {
    if (isLastStep) {
      navigate(mealDetailPath(meal.id));
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 1.5 }}>
        <IconButton onClick={() => setExitConfirmOpen(true)} aria-label="Exit cooking mode">
          <CloseIcon />
        </IconButton>
        <Typography variant="caption" color="text.disabled" fontWeight={700}>
          STEP {stepIndex + 1} OF {steps.length}
        </Typography>
        <Box sx={{ width: 40 }} />
      </Stack>

      <Box ref={scrollRef} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2.5, pb: 2.5 }}>
        {step.title && (
          <Typography
            variant="caption"
            color="text.disabled"
            fontWeight={700}
            sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
          >
            {step.title}
          </Typography>
        )}
        <Typography variant="h5" fontWeight={700} sx={{ my: 1.5, lineHeight: 1.35 }}>
          {step.content}
        </Typography>

        {step.timerSeconds !== undefined && (
          <Box
            sx={{
              position: 'sticky',
              top: 0,
              zIndex: 1,
              bgcolor: 'background.default',
              pt: 0.5,
              pb: 1.5,
            }}
          >
            <Box
              sx={{
                bgcolor: 'background.paper',
                border: 1,
                borderColor:
                  timerBelongsToThisStep && isComplete
                    ? 'warning.main'
                    : timerBelongsToThisStep
                      ? 'primary.main'
                      : 'divider',
                borderRadius: 2,
                p: 2,
                textAlign: 'center',
              }}
            >
              {!timerBelongsToThisStep && (
                <>
                  <Typography variant="h4" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatSeconds(step.timerSeconds)}
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<PlayArrowIcon />}
                    onClick={handleStartTimer}
                    sx={{ mt: 1 }}
                  >
                    Start Timer
                  </Button>
                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                    Keeps the screen awake while running
                  </Typography>
                </>
              )}
              {timerBelongsToThisStep && !isComplete && (
                <>
                  <Typography variant="h4" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatSeconds(remainingSeconds)}
                  </Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                    Screen will stay awake until this finishes
                  </Typography>
                </>
              )}
              {timerBelongsToThisStep && isComplete && (
                <>
                  <Typography variant="subtitle1" fontWeight={700} color="warning.main">
                    ⏰ Time&apos;s up!
                  </Typography>
                  <Button variant="outlined" color="warning" onClick={dismissTimer} sx={{ mt: 1 }}>
                    Dismiss
                  </Button>
                </>
              )}
            </Box>
          </Box>
        )}

        {meal.ingredients.length > 0 && (
          <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 2, p: 1.75 }}>
            <Typography
              variant="caption"
              color="text.disabled"
              fontWeight={700}
              sx={{ textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 0.75 }}
            >
              All Ingredients
            </Typography>
            <Stack spacing={0.25}>
              {meal.ingredients.map((ing) => (
                <Stack key={ing.id} direction="row" justifyContent="space-between">
                  <Typography variant="body2">{ing.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {ing.quantity ? `${ing.quantity}${ing.unit && ing.unit !== 'other' ? ` ${ing.unit}` : ''}` : ''}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        )}
      </Box>

      <Stack direction="row" spacing={1.25} sx={{ p: 2 }}>
        <Button variant="outlined" size="large" fullWidth disabled={isFirstStep} onClick={() => setStepIndex((i) => i - 1)}>
          ← Prev
        </Button>
        {isLastStep ? (
          <Button variant="contained" size="large" fullWidth onClick={handleNext}>
            Finish
          </Button>
        ) : (
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={handleNext}
            sx={{ bgcolor: 'primary.main', color: '#1a0f17', '&:hover': { bgcolor: 'primary.dark' } }}
          >
            Next →
          </Button>
        )}
      </Stack>

      <Dialog open={exitConfirmOpen} onClose={() => setExitConfirmOpen(false)}>
        <DialogTitle>Exit Cooking Mode?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {timer
              ? "Your timer keeps running in the background if it's still active. You can come back to this meal any time."
              : 'You can come back to this meal any time.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExitConfirmOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => navigate(mealDetailPath(meal.id))}>
            Exit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
