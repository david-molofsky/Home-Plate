import { useEffect, useRef, useState, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import { lookupGroceryProductByBarcode } from '@/services/barcode/openFoodFactsService';
import { normalizeGroceryBarcode } from '@/utils/groceryBarcode';

interface BarcodeScanDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the matched product name — caller decides what to do
   * with it (fill an ingredient row, fill the shopping-list add-item
   * field, etc.). Dialog closes itself right after calling this. */
  onFill: (name: string) => void;
}

type ScanPhase = 'scanning' | 'looking-up' | 'found' | 'not-found' | 'service-error' | 'camera-denied';

/** Same interval as Media Journal's scan dialogs — frequent enough to
 * feel responsive, infrequent enough not to peg the CPU while the
 * camera is open. */
const DETECT_INTERVAL_MS = 300;

export function BarcodeScanDialog({ open, onClose, onFill }: BarcodeScanDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const intervalRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<ScanPhase>('scanning');
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [foundName, setFoundName] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const handleDetected = useCallback(
    async (code: string) => {
      stopCamera();
      setScannedCode(code);
      setPhase('looking-up');
      const outcome = await lookupGroceryProductByBarcode(code);
      if (outcome.status === 'found') {
        setFoundName(outcome.name);
        setPhase('found');
      } else {
        setPhase(outcome.status);
      }
    },
    [stopCamera],
  );

  const startCamera = useCallback(async () => {
    setPhase('scanning');
    setFoundName(null);
    setScannedCode(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      // One detector covering all three grocery barcode formats — see
      // Media Journal's UpcScanDialog for why *its* two detectors are
      // split; that split was needed specifically because combining
      // upc_a with another format broke detection on some Android
      // devices. ean_13/ean_8/upc_a together haven't shown that issue,
      // so a single detector is simpler here unless real-device
      // testing says otherwise.
      detectorRef.current ??= new BarcodeDetector({ formats: ['ean_13', 'upc_a', 'ean_8'] });

      intervalRef.current = window.setInterval(async () => {
        if (!videoRef.current || !detectorRef.current) return;
        try {
          const barcodes = await detectorRef.current.detect(videoRef.current);
          for (const barcode of barcodes) {
            const code = normalizeGroceryBarcode(barcode);
            if (code) {
              void handleDetected(code);
              break;
            }
          }
        } catch {
          // Transient detect() failures (e.g. a frame mid-transition)
          // are expected and safely ignored — the next tick retries.
        }
      }, DETECT_INTERVAL_MS);
    } catch {
      setPhase('camera-denied');
    }
  }, [handleDetected]);

  useEffect(() => {
    (async () => {
      if (open) await startCamera();
      else stopCamera();
    })();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleUseResult = () => {
    if (!foundName) return;
    onFill(foundName);
    onClose();
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Scan barcode</DialogTitle>
      <DialogContent>
        {phase === 'scanning' && (
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              Point at the barcode on the packaging
            </Typography>
            <Box
              sx={{
                position: 'relative',
                bgcolor: 'black',
                borderRadius: 2,
                height: 220,
                overflow: 'hidden',
              }}
            >
              <Box
                component="video"
                ref={videoRef}
                muted
                playsInline
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 180,
                  height: 90,
                  border: '2px solid',
                  borderColor: 'primary.main',
                  borderRadius: 1,
                  pointerEvents: 'none',
                }}
              />
            </Box>
          </Stack>
        )}

        {phase === 'looking-up' && (
          <Stack spacing={1.5} alignItems="center" sx={{ py: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Looking up {scannedCode}…
            </Typography>
          </Stack>
        )}

        {phase === 'found' && foundName && (
          <Stack spacing={1.5} alignItems="center" sx={{ py: 2 }}>
            <Alert severity="success" variant="outlined" sx={{ width: '100%' }}>
              Product found
            </Alert>
            <Typography variant="body1" fontWeight={600}>
              {foundName}
            </Typography>
          </Stack>
        )}

        {phase === 'not-found' && (
          <Stack spacing={1.5} sx={{ py: 1 }}>
            <Alert severity="warning" variant="outlined">
              Read the barcode ({scannedCode}), but couldn't find a match. This is common for
              smaller, regional, or generic/store-brand products — enter the name manually
              instead.
            </Alert>
          </Stack>
        )}

        {phase === 'service-error' && (
          <Stack spacing={1.5} sx={{ py: 1 }}>
            <Alert severity="warning" variant="outlined">
              Couldn't reach the lookup service just now. You can try again, or enter the name
              manually instead.
            </Alert>
          </Stack>
        )}

        {phase === 'camera-denied' && (
          <Alert severity="info" variant="outlined">
            Camera access is needed to scan — you can also enter the name manually instead.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        {phase === 'scanning' && <Button onClick={handleClose}>Cancel</Button>}
        {phase === 'found' && (
          <>
            <Button onClick={handleClose}>Cancel</Button>
            <Button variant="contained" onClick={handleUseResult}>
              Use this
            </Button>
          </>
        )}
        {(phase === 'not-found' || phase === 'service-error') && (
          <>
            <Button onClick={handleClose}>Enter manually instead</Button>
            <Button variant="contained" onClick={() => void startCamera()}>
              Scan again
            </Button>
          </>
        )}
        {phase === 'camera-denied' && <Button onClick={handleClose}>Close</Button>}
      </DialogActions>
    </Dialog>
  );
}
