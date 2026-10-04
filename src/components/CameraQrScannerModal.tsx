import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, X, CheckCircle2, AlertCircle, RefreshCw, Volume2, VolumeX, ShieldCheck, Clock } from 'lucide-react';
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
  const [scanCount, setScanCount] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastScannedPayloadRef = useRef<string | null>(null);
  const lastScannedTimeRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);

  // Play subtle feedback beep on successful scan
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

  // Frame processing loop
  const processFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.paused || video.ended) {
      return;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw === 0 || vh === 0) return;

    // Use offscreen canvas to extract pixel data
    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvasRef.current = canvas;
    }
    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width = vw;
      canvas.height = vh;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, vw, vh);

    // Analyze central scanning region for optimal speed and accuracy
    const imgData = ctx.getImageData(0, 0, vw, vh);
    const code = jsQR(imgData.data, vw, vh, {
      inversionAttempts: 'dontInvert'
    });

    if (code && code.data && code.data.trim()) {
      const payload = code.data.trim();
      const now = Date.now();
      const elapsed = now - lastScannedTimeRef.current;
      const isSameCode = lastScannedPayloadRef.current === payload;

      // Duplicate frame debounce / cooldown:
      // Same code: wait at least 3.5 seconds
      // Different code: wait at least 1.5 seconds to avoid accidental immediate re-trigger
      if (isSameCode && elapsed < 3500) {
        return;
      }
      if (!isSameCode && elapsed < 1500) {
        return;
      }

      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      lastScannedPayloadRef.current = payload;
      lastScannedTimeRef.current = now;

      // Execute attendance registration
      const result = onScan(payload);

      setLastScanResult(result);
      if (result.success) {
        setScanCount((prev) => prev + 1);
        playBeep(true);
      } else {
        playBeep(false);
      }

      // Unlock processing after brief pause
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 500);
    }
  }, [onScan, playBeep]);

  // Start camera stream
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
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraStatus('active');

        // Start scanning at ~12 fps (every 80ms)
        scanIntervalRef.current = setInterval(processFrame, 80);
      }
    } catch (err: unknown) {
      console.error('Camera initialization error:', err);
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
  }, [facingMode, processFrame, stopCameraStream]);

  // Lifecycle when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setScanCount(0);
      setLastScanResult(null);
      lastScannedPayloadRef.current = null;
      lastScannedTimeRef.current = 0;
      startCamera();
    } else {
      stopCameraStream();
    }

    return () => {
      stopCameraStream();
    };
  }, [isOpen, startCamera, stopCameraStream]);

  const handleClose = () => {
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
          maxWidth: '680px',
          width: '95%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '16px'
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Custom CSS for scanline animation and viewfinder */}
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
            box-shadow: 0 0 12px #22C55E;
            animation: qrLaserSweep 2.2s infinite ease-in-out;
            pointer-events: none;
          }
          .reticle-corner {
            position: absolute;
            width: 28px;
            height: 28px;
            border-color: #22C55E;
            border-style: solid;
            pointer-events: none;
          }
          .reticle-tl { top: 0; left: 0; border-width: 4px 0 0 4px; border-top-left-radius: 8px; }
          .reticle-tr { top: 0; right: 0; border-width: 4px 4px 0 0; border-top-right-radius: 8px; }
          .reticle-bl { bottom: 0; left: 0; border-width: 0 0 4px 4px; border-bottom-left-radius: 8px; }
          .reticle-br { bottom: 0; right: 0; border-width: 0 4px 4px 0; border-bottom-right-radius: 8px; }
        `}</style>

        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
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
              <p style={{ margin: 0, fontSize: '11.5px', color: '#94A3B8' }}>
                Arahkan kartu QR Pegawai ke kamera. Kamera tetap aktif untuk scan berkali-kali.
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
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px'
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
                fontSize: '12px'
              }}
            >
              <RefreshCw size={14} />
              <span style={{ fontSize: '11px' }}>{facingMode === 'environment' ? 'Belakang' : 'Depan'}</span>
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
                minWidth: '36px',
                minHeight: '36px'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body: Camera Viewport */}
        <div
          style={{
            position: 'relative',
            backgroundColor: '#000000',
            width: '100%',
            height: '380px',
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
              <RefreshCw size={36} className="spin-animation" style={{ margin: '0 auto 12px', color: '#38BDF8' }} />
              <div style={{ fontSize: '14px', fontWeight: 600 }}>Menghubungkan ke kamera...</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>Mohon izinkan akses kamera jika diminta browser.</div>
            </div>
          )}

          {/* Camera Error Screen */}
          {cameraStatus === 'error' && (
            <div style={{ textAlign: 'center', color: '#FCA5A5', padding: '24px', maxWidth: '420px' }}>
              <AlertCircle size={40} style={{ margin: '0 auto 12px', color: '#EF4444' }} />
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#FEE2E2', marginBottom: '6px' }}>
                Kamera Tidak Dapat Diakses
              </div>
              <div style={{ fontSize: '13px', lineHeight: 1.5, color: '#CBD5E1', marginBottom: '16px' }}>
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
                  width: '240px',
                  height: '240px',
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
                  borderRadius: '12px',
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
                  bottom: '14px',
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  color: '#F8FAFC',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
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
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#22C55E'
                  }}
                />
                Kamera aktif &mdash; Arahkan QR Pegawai ke dalam kotak pemindai
              </div>
            </div>
          )}
        </div>

        {/* Scan Result Feedback Banner & Session Stats */}
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            borderBottom: '1px solid #E2E8F0'
          }}
        >
          {lastScanResult ? (
            lastScanResult.success ? (
              <div
                style={{
                  backgroundColor: '#F0FDF4',
                  border: '1.5px solid #86EFAC',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
                id="scanner-success-feedback"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: '#22C55E',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <CheckCircle2 size={22} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>
                        ✓ Absensi Berhasil
                      </span>
                      <span style={{ fontSize: '11px', color: '#15803D', fontWeight: 600 }}>
                        [{lastScanResult.time || 'WIB'}]
                      </span>
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                      {lastScanResult.pegawai?.name}{' '}
                      <span style={{ fontSize: '12.5px', fontFamily: 'monospace', color: '#1D4ED8' }}>
                        ({lastScanResult.payload})
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '1px' }}>
                      {lastScanResult.pegawai?.role} &bull;{' '}
                      <strong>{lastScanResult.shift?.name}</strong>{' '}
                      ({lastScanResult.shift?.startTime}&ndash;{lastScanResult.shift?.endTime} WIB)
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: '#DCFCE7',
                    color: '#15803D',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
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
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
                id="scanner-error-feedback"
              >
                <AlertCircle size={26} color="#DC2626" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#991B1B' }}>
                    QR Tidak Dikenali: [{lastScanResult.payload}]
                  </div>
                  <div style={{ fontSize: '12px', color: '#B91C1C', marginTop: '2px' }}>
                    {lastScanResult.message || 'Pegawai tidak ditemukan dalam Master Pegawai.'} Kamera tetap aktif, silakan scan QR lainnya.
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
                padding: '8px 4px',
                fontSize: '13px',
                color: '#64748B'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} color="#3B82F6" />
                <span>Dekatkan QR identitas pegawai ke kamera untuk mencatat presensi.</span>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>
                Sesi ini: {scanCount} scan
              </span>
            </div>
          )}
        </div>

        {/* Modal Footer with Large Close Button */}
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#64748B' }}>
            <ShieldCheck size={16} color="#10B981" />
            <span>
              Total tercatat sesi ini: <strong style={{ color: '#0F172A' }}>{scanCount}</strong> pegawai
            </span>
          </div>

          <Button
            variant="secondary"
            size="lg"
            onClick={handleClose}
            id="btn-close-scanner-modal"
            style={{
              fontWeight: 700,
              minWidth: '140px',
              minHeight: '44px',
              fontSize: '14px',
              padding: '10px 24px'
            }}
          >
            Tutup Scanner
          </Button>
        </div>
      </div>
    </div>
  );
}
