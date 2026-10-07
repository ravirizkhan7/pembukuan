import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, X, CheckCircle2, AlertCircle, RefreshCw, Volume2, VolumeX, ShieldCheck, Clock, History } from 'lucide-react';
import jsQR from 'jsqr';
import { Button } from './ui';
import { Pegawai, Shift } from '../types';

export interface ScanResultDetail {
  success: boolean;
  payload: string;
  pegawai?: Pegawai;
  shift?: Shift;
  time?: string;
  message?: string;
  isAlreadyAttended?: boolean;
}

export interface CameraQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (payload: string) => ScanResultDetail;
}

export function CameraQrScannerModal({
  isOpen,
  onClose,
  onScan
}: CameraQrScannerModalProps) {
  const [cameraStatus, setCameraStatus] = useState<'initializing' | 'active' | 'error'>('initializing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastScanResult, setLastScanResult] = useState<ScanResultDetail | null>(null);
  const [recentScans, setRecentScans] = useState<ScanResultDetail[]>([]);
  const [recordedEmployeeIds, setRecordedEmployeeIds] = useState<string[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastScannedPayloadRef = useRef<string | null>(null);
  const lastScannedTimeRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);
  const isOpenRef = useRef<boolean>(isOpen);
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  // Keep latest onScan callback in ref to prevent camera stream restarts on parent re-renders
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  // Play subtle feedback beep on scan
  const playBeep = useCallback((success: boolean) => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (success) {
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
        osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.08); // D6 note
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.22);
      } else {
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {
      // Audio playback fails silently if browser policy blocks it
    }
  }, [soundEnabled]);

  const playBeepRef = useRef(playBeep);
  useEffect(() => {
    playBeepRef.current = playBeep;
  }, [playBeep]);

  // Clean stop for camera tracks
  const stopCameraStream = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    isProcessingRef.current = false;
  }, []);

  // Frame processing loop - Fast, continuous, zero delay for different employees
  const processFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.paused || video.ended) {
      return;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw === 0 || vh === 0) return;

    // Viewfinder/reticle coverage: sample central 72% of minimum dimension with generous tolerance
    const minDim = Math.min(vw, vh);
    const cropDim = Math.round(minDim * 0.72);
    const sx = Math.round((vw - cropDim) / 2);
    const sy = Math.round((vh - cropDim) / 2);

    // Target processing canvas resolution: 400x400
    // Memory per frame: 400 * 400 * 4 = 640 KB (reduced from ~3.68 MB, ~82.6% reduction in GC pressure)
    // jsQR executes >5x faster on 160k pixels than 921k pixels while retaining high module contrast
    const targetDim = 400;

    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvasRef.current = canvas;
    }
    if (canvas.width !== targetDim || canvas.height !== targetDim) {
      canvas.width = targetDim;
      canvas.height = targetDim;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(video, sx, sy, cropDim, cropDim, 0, 0, targetDim, targetDim);

    const imgData = ctx.getImageData(0, 0, targetDim, targetDim);
    const code = jsQR(imgData.data, targetDim, targetDim, {
      inversionAttempts: 'dontInvert'
    });

    if (code && code.data && code.data.trim()) {
      const payload = code.data.trim();
      const now = Date.now();
      const elapsed = now - lastScannedTimeRef.current;
      const isSameCode = lastScannedPayloadRef.current === payload;

      // Dedupe:
      // 1. Same employee card: 2.5s guard against continuous duplicate frames
      if (isSameCode && elapsed < 2500) {
        return;
      }

      // 2. Different employee card: ZERO artificial delay! Read immediately!
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      lastScannedPayloadRef.current = payload;
      lastScannedTimeRef.current = now;

      try {
        // Execute attendance registration via ref
        const result = onScanRef.current(payload);

        // Update persistent feedback
        setLastScanResult(result);

        if (result.success) {
          const empId = result.pegawai?.id || result.payload.trim();
          if (!result.isAlreadyAttended && empId) {
            setRecordedEmployeeIds((prev) => {
              if (prev.includes(empId)) return prev;
              return [...prev, empId];
            });
          }
          setRecentScans((prev) => {
            const filtered = prev.filter((item) => item.payload !== result.payload);
            return [result, ...filtered].slice(0, 3);
          });
          playBeepRef.current(true);
        } else {
          playBeepRef.current(false);
        }
      } catch (err) {
        console.error('Scan processing error:', err);
      } finally {
        // Immediately release lock so next frame can scan the next employee
        isProcessingRef.current = false;
      }
    }
  }, []);

  const processFrameRef = useRef<() => void>(() => {});
  useEffect(() => {
    processFrameRef.current = processFrame;
  }, [processFrame]);

  // Start camera stream - called ONLY when modal opens or camera facingMode toggles
  const startCamera = useCallback(async () => {
    stopCameraStream();
    setCameraStatus('initializing');
    setErrorMessage(null);

    // Check secure context
    if (
      typeof window !== 'undefined' &&
      !window.isSecureContext &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      setCameraStatus('error');
      setErrorMessage('Akses kamera memerlukan koneksi aman (HTTPS atau localhost).');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus('error');
      setErrorMessage('Browser atau perangkat ini tidak mendukung akses kamera langsung.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Guard: if modal closed while awaiting getUserMedia, release tracks immediately
      if (!isOpenRef.current) {
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // ignore
          }
        });
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        // Second guard: if modal closed during video.play()
        if (!isOpenRef.current) {
          stopCameraStream();
          return;
        }

        setCameraStatus('active');

        // Fast continuous scan loop at ~14 FPS (every 70ms) using processFrameRef
        scanIntervalRef.current = setInterval(() => {
          processFrameRef.current();
        }, 70);
      } else {
        stopCameraStream();
      }
    } catch (err: unknown) {
      console.error('Camera initialization error:', err);
      // Clean up any acquired stream tracks immediately
      stopCameraStream();
      setCameraStatus('error');

      const error = err as { name?: string; message?: string };
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setErrorMessage('Izin kamera ditolak. Berikan izin akses kamera pada pengaturan browser untuk melakukan scan.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setErrorMessage('Kamera tidak ditemukan pada perangkat ini.');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        setErrorMessage('Kamera sedang digunakan oleh aplikasi lain atau tidak dapat diakses.');
      } else {
        setErrorMessage(error.message || 'Gagal memulai scanner kamera.');
      }
    }
  }, [facingMode, stopCameraStream]);

  // Lifecycle when modal opens/closes - Depends ONLY on isOpen and facingMode!
  // NEVER restarts the camera after attendance scanning!
  useEffect(() => {
    if (isOpen) {
      setRecordedEmployeeIds([]);
      setLastScanResult(null);
      setRecentScans([]);
      lastScannedPayloadRef.current = null;
      lastScannedTimeRef.current = 0;
      startCamera();
    } else {
      setRecordedEmployeeIds([]);
      stopCameraStream();
    }

    return () => {
      stopCameraStream();
    };
  }, [isOpen, facingMode, startCamera, stopCameraStream]);

  const handleClose = () => {
    setRecordedEmployeeIds([]);
    stopCameraStream();
    onClose();
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content modal-lg"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '620px',
          width: '95%',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '16px'
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Scoped CSS for scanline animation and reticles */}
        <style>{`
          @keyframes qrLaserSweep {
            0% { top: 8%; opacity: 0.8; }
            50% { top: 88%; opacity: 1; }
            100% { top: 8%; opacity: 0.8; }
          }
          .qr-laser-line {
            position: absolute;
            left: 5%;
            right: 5%;
            height: 3px;
            background: linear-gradient(90deg, transparent, #22C55E, #10B981, transparent);
            box-shadow: 0 0 10px #22C55E;
            animation: qrLaserSweep 2s infinite ease-in-out;
            pointer-events: none;
          }
          .reticle-corner {
            position: absolute;
            width: 24px;
            height: 24px;
            border-color: #22C55E;
            border-style: solid;
            pointer-events: none;
          }
          .reticle-tl { top: 0; left: 0; border-width: 3.5px 0 0 3.5px; border-top-left-radius: 6px; }
          .reticle-tr { top: 0; right: 0; border-width: 3.5px 3.5px 0 0; border-top-right-radius: 6px; }
          .reticle-bl { bottom: 0; left: 0; border-width: 0 0 3.5px 3.5px; border-bottom-left-radius: 6px; }
          .reticle-br { bottom: 0; right: 0; border-width: 0 3.5px 3.5px 0; border-bottom-right-radius: 6px; }
        `}</style>

        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            borderBottom: '1px solid #1E293B'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#1E3A8A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#60A5FA'
              }}
            >
              <Camera size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, letterSpacing: '0.02em' }}>
                SCAN QR ABSENSI
              </h3>
              <p style={{ margin: 0, fontSize: '11px', color: '#94A3B8' }}>
                Arahkan kartu QR Pegawai ke kamera. Scanner siap membaca secara berulang.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Audio Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Matikan Suara Beep' : 'Nyalakan Suara Beep'}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#E2E8F0',
                borderRadius: '6px',
                padding: '6px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px'
              }}
            >
              {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>

            {/* Switch Camera Button (Tablet/Phone) */}
            <button
              type="button"
              onClick={toggleFacingMode}
              title="Ganti Kamera Depan / Belakang"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#E2E8F0',
                borderRadius: '6px',
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px'
              }}
            >
              <RefreshCw size={13} />
              <span>{facingMode === 'environment' ? 'Belakang' : 'Depan'}</span>
            </button>

            {/* Close X */}
            <button
              type="button"
              onClick={handleClose}
              aria-label="Tutup Scanner"
              id="btn-close-scanner-x"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                borderRadius: '6px',
                padding: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '34px',
                minHeight: '34px'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body: Compact Live Camera Viewport (Height 260px) */}
        <div
          style={{
            position: 'relative',
            backgroundColor: '#000000',
            width: '100%',
            height: '260px',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {/* Live Video */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            id="camera-scanner-video"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: cameraStatus === 'active' ? 'block' : 'none'
            }}
          />

          {/* Camera Initializing */}
          {cameraStatus === 'initializing' && (
            <div style={{ textAlign: 'center', color: '#94A3B8', padding: '20px' }}>
              <RefreshCw size={32} className="spin-animation" style={{ margin: '0 auto 10px', color: '#38BDF8' }} />
              <div style={{ fontSize: '13.5px', fontWeight: 600 }}>Menghubungkan ke kamera...</div>
              <div style={{ fontSize: '11.5px', marginTop: '3px' }}>Mohon izinkan akses kamera jika diminta browser.</div>
            </div>
          )}

          {/* Camera Error Screen */}
          {cameraStatus === 'error' && (
            <div style={{ textAlign: 'center', color: '#FCA5A5', padding: '20px', maxWidth: '420px' }}>
              <AlertCircle size={36} style={{ margin: '0 auto 10px', color: '#EF4444' }} />
              <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#FEE2E2', marginBottom: '4px' }}>
                Kamera Tidak Dapat Diakses
              </div>
              <div style={{ fontSize: '12.5px', lineHeight: 1.4, color: '#CBD5E1', marginBottom: '14px' }}>
                {errorMessage}
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={RefreshCw}
                onClick={startCamera}
                id="btn-retry-camera"
                style={{ fontWeight: 600 }}
              >
                Coba Lagi
              </Button>
            </div>
          )}

          {/* Active Viewfinder Overlay */}
          {cameraStatus === 'active' && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none'
              }}
            >
              {/* Semi-transparent scrim cutout */}
              <div
                style={{
                  position: 'relative',
                  width: '190px',
                  height: '190px',
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.42)',
                  borderRadius: '10px',
                  overflow: 'hidden'
                }}
              >
                {/* 4 Corner Reticles */}
                <div className="reticle-corner reticle-tl" />
                <div className="reticle-corner reticle-tr" />
                <div className="reticle-corner reticle-bl" />
                <div className="reticle-corner reticle-br" />

                {/* Animated Laser Scanline */}
                <div className="qr-laser-line" />
              </div>

              {/* Status pill on camera */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  color: '#F8FAFC',
                  padding: '5px 12px',
                  borderRadius: '16px',
                  fontSize: '11.5px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backdropFilter: 'blur(4px)',
                  border: '1px solid rgba(255, 255, 255, 0.15)'
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: '#22C55E'
                  }}
                />
                Kamera aktif &mdash; Arahkan QR Pegawai ke kotak pemindai
              </div>
            </div>
          )}
        </div>

        {/* Persistent Last Scan Feedback Area */}
        <div
          style={{
            padding: '14px 18px',
            backgroundColor: '#FFFFFF',
            borderTop: '1px solid #E2E8F0',
            borderBottom: '1px solid #E2E8F0',
            minHeight: '84px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}
        >
          {lastScanResult ? (
            lastScanResult.success ? (
              <div
                style={{
                  backgroundColor: '#F0FDF4',
                  border: '1.5px solid #86EFAC',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
                id="scanner-success-feedback"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: '#22C55E',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '15px', color: '#0F172A' }}>
                        {lastScanResult.pegawai?.name}
                      </strong>
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontFamily: 'monospace',
                          color: '#1D4ED8',
                          fontWeight: 700
                        }}
                      >
                        [{lastScanResult.payload}]
                      </span>
                      {lastScanResult.isAlreadyAttended ? (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#92400E',
                            backgroundColor: '#FEF3C7',
                            border: '1px solid #FCD34D',
                            padding: '2px 8px',
                            borderRadius: '4px'
                          }}
                        >
                          Sudah Absen (Absensi sudah diambil)
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#15803D',
                            backgroundColor: '#DCFCE7',
                            border: '1px solid #86EFAC',
                            padding: '2px 8px',
                            borderRadius: '4px'
                          }}
                        >
                          ✓ Absensi berhasil dicatat
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                      {lastScanResult.pegawai?.role} &bull;{' '}
                      <strong>{lastScanResult.shift?.name}</strong>{' '}
                      ({lastScanResult.shift?.startTime}&ndash;{lastScanResult.shift?.endTime} WIB) &bull;{' '}
                      <span style={{ fontWeight: 600 }}>Jam {lastScanResult.time || 'WIB'}</span>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: '#DCFCE7',
                    color: '#15803D',
                    padding: '3px 8px',
                    borderRadius: '5px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textAlign: 'right',
                    flexShrink: 0
                  }}
                >
                  Scanner Siap
                </div>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: '#FEF2F2',
                  border: '1.5px solid #FCA5A5',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
                id="scanner-error-feedback"
              >
                <AlertCircle size={22} color="#DC2626" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#991B1B' }}>
                    ⚠ QR Tidak Dikenali: [{lastScanResult.payload}]
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#B91C1C', marginTop: '1px' }}>
                    {lastScanResult.message || 'Pegawai tidak ditemukan dalam Master Pegawai.'} Kamera tetap aktif, silakan arahkan QR lain.
                  </div>
                </div>
              </div>
            )
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 4px',
                fontSize: '12.5px',
                color: '#64748B'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} color="#3B82F6" />
                <span>Dekatkan QR kartu pegawai ke kamera. Scanner akan otomatis merekam.</span>
              </div>
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#0F172A' }}>
                Sesi ini: {recordedEmployeeIds.length} pegawai tercatat
              </span>
            </div>
          )}
        </div>

        {/* Recent Scans List (Refinement E) */}
        {recentScans.length > 0 && (
          <div
            style={{
              padding: '10px 18px',
              backgroundColor: '#F8FAFC',
              borderBottom: '1px solid #E2E8F0'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#64748B',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '6px'
              }}
            >
              <History size={13} />
              <span>Scan Terakhir (Sesi Ini)</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {recentScans.map((scan) => (
                <div
                  key={scan.payload}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={13} color="#16A34A" />
                    <strong style={{ color: '#0F172A' }}>{scan.pegawai?.name}</strong>
                    <span style={{ color: '#64748B', fontSize: '11.5px' }}>
                      ({scan.payload}) &bull; {scan.shift?.name} &bull; {scan.time} WIB
                    </span>
                  </div>
                  <div>
                    {scan.isAlreadyAttended ? (
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 600,
                          color: '#B45309',
                          backgroundColor: '#FEF3C7',
                          padding: '1px 6px',
                          borderRadius: '4px'
                        }}
                      >
                        Sudah Absen
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 600,
                          color: '#15803D',
                          backgroundColor: '#DCFCE7',
                          padding: '1px 6px',
                          borderRadius: '4px'
                        }}
                      >
                        Hadir
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Footer with Large Close Button */}
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748B' }}>
            <ShieldCheck size={16} color="#10B981" />
            <span>
              Total tercatat sesi ini: <strong style={{ color: '#0F172A' }}>{recordedEmployeeIds.length}</strong> pegawai
            </span>
          </div>

          <Button
            variant="secondary"
            size="lg"
            onClick={handleClose}
            id="btn-close-scanner-modal"
            style={{
              fontWeight: 700,
              minWidth: '130px',
              minHeight: '44px',
              fontSize: '14px',
              padding: '8px 20px'
            }}
          >
            Tutup Scanner
          </Button>
        </div>
      </div>
    </div>
  );
}
