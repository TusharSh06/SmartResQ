import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// ─────────────────────────────────────────────────────────────────────────────
// StreamImg — Resilient MJPEG/image component
// • Shows a placeholder while connecting
// • On error: shows "RETRYING..." and waits 5s before reconnecting
// • Cancels retry timer on unmount (prevents memory leaks / React 18 warnings)
// ─────────────────────────────────────────────────────────────────────────────
const StreamImg = ({ src, alt, className, style }) => {
  const [state, setState] = useState('loading'); // 'loading' | 'live' | 'error'
  const [activeSrc, setActiveSrc] = useState(src);
  const retryRef = useRef(null);
  const mountedRef = useRef(true);

  // Track mount status so we never call setState after unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, []);

  // When src changes (e.g. backend restart, new camera), reset
  useEffect(() => {
    if (retryRef.current) clearTimeout(retryRef.current);
    setState('loading');
    setActiveSrc(src);
  }, [src]);

  const handleLoad = () => {
    if (mountedRef.current) setState('live');
  };

  const handleError = () => {
    if (!mountedRef.current) return;
    setState('error');
    retryRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setState('loading');
      setActiveSrc(`${src}${src.includes('?') ? '&' : '?'}_r=${Date.now()}`);
    }, 5000);
  };

  return (
    <>
      <img
        src={activeSrc}
        alt={alt}
        className={className}
        style={{ display: state === 'error' ? 'none' : 'block', ...style }}
        onLoad={handleLoad}
        onError={handleError}
      />
      {state === 'loading' && (
        <div className="camera-frame-placeholder" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ width: 24, height: 24, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          CONNECTING...
        </div>
      )}
      {state === 'error' && (
        <div className="camera-frame-placeholder" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.4 }}>
            <path d="M18.364 18.364A9 9 0 0 1 5.636 5.636m12.728 12.728A9 9 0 0 0 5.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <span style={{ fontSize: '0.7rem' }}>RETRYING IN 5s...</span>
        </div>
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HUD Overlay — reusable
// ─────────────────────────────────────────────────────────────────────────────
const HudOverlay = ({ topLeft, topRight, bottomLeft, bottomRight, opacity = 1 }) => (
  <div className="hud-overlay" style={{ pointerEvents: 'none', position: 'absolute', inset: 0, opacity }}>
    <div className="hud-corner top-left" />
    <div className="hud-corner top-right" />
    <div className="hud-corner bottom-left" />
    <div className="hud-corner bottom-right" />
    <div className="hud-center-cross" />
    {(topLeft || topRight) && (
      <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between' }}>
        {topLeft && <div className="telem-chip" style={{ background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', color: '#fff' }}>{topLeft}</div>}
        {topRight && <div className="telem-chip" style={{ background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', color: '#fff' }}>{topRight}</div>}
      </div>
    )}
    {(bottomLeft || bottomRight) && (
      <div style={{ position: 'absolute', bottom: 50, left: 12, right: 12, display: 'flex', justifyContent: 'space-between' }}>
        {bottomLeft && <div className="telem-chip" style={{ background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', color: '#fff' }}>{bottomLeft}</div>}
        {bottomRight && <div className="telem-chip" style={{ background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', color: '#fff' }}>{bottomRight}</div>}
      </div>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Confidence bar — reusable
// ─────────────────────────────────────────────────────────────────────────────
const ConfidenceBar = ({ prob }) => {
  const color = prob > 70 ? '#EF4444' : prob > 40 ? '#F59E0B' : '#22C55E';
  return (
    <div style={{
      position: 'absolute', bottom: 12, left: 12, right: 12,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      padding: '6px 10px', borderRadius: 6,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      fontSize: '0.7rem', fontWeight: 700, color: 'white', zIndex: 12
    }}>
      <span>NEURAL CONFIDENCE</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 80, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 4 }}>
          <div style={{ height: '100%', borderRadius: 4, width: `${Math.min(prob, 100)}%`, background: color, transition: 'width 1s ease, background 0.3s' }} />
        </div>
        <span style={{ color }}>{prob.toFixed(1)}%</span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HWPill — hardware stat pill
// ─────────────────────────────────────────────────────────────────────────────
const HWPill = ({ label, value, progress, color }) => (
  <div className="hw-pill">
    <span className="hw-label">{label}</span>
    <span className="hw-value" style={{ color }}>{value}</span>
    <div className="hw-progress">
      <div style={{ width: `${Math.min(progress, 100)}%`, background: color, transition: 'width 0.5s ease' }} />
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// useAuthFetch — wraps fetch with auth header, returns null on 401
// ─────────────────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

const useAuthFetch = () => {
  return useCallback(async (url, options = {}) => {
    const fullUrl = url.startsWith('/') ? `${API_BASE}${url}` : url;
    const token = localStorage.getItem('auth_token');
    const headers = { 'Authorization': `Bearer ${token}`, ...options.headers };
    try {
      const res = await fetch(fullUrl, { ...options, headers });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null; // swallow network errors (backend restarting etc.)
    }
  }, []);
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Monitoring Component
// ─────────────────────────────────────────────────────────────────────────────
const Monitoring = ({ dashboardState }) => {
  const waveformRef  = useRef(null);
  const liveFrameRef = useRef(null);
  const mountedRef   = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Auth fetch helper ──────────────────────────────────────────────────────
  const authFetch = useAuthFetch();

  // ── State ──────────────────────────────────────────────────────────────────
  const [cameras,       setCameras]       = useState([]);
  const [newCamName, setNewCamName] = useState('');
  const [newCamUrl, setNewCamUrl] = useState('');
  const [newCamLat, setNewCamLat] = useState('');
  const [newCamLng, setNewCamLng] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [cpuLoad,       setCpuLoad]       = useState(5);
  const [cameraStats,   setCameraStats]   = useState({});
  const [isBackendReady, setIsBackendReady] = useState(false);
  const [isPrimaryActive, setIsPrimaryActive] = useState(() => {
    const saved = localStorage.getItem('isPrimaryActive');
    return saved === null ? true : saved === 'true';
  });

  // ── Derived ────────────────────────────────────────────────────────────────
  const isRunning = dashboardState?.is_running || false;
  const fps       = dashboardState?.fps        || 0;
  const prob      = dashboardState?.current_prob ?? 0;
  const hasFrame  = !!dashboardState?.current_frame;

  // ── Fetch cameras (safe: checks mount) ────────────────────────────────────
  const fetchCameras = useCallback(async () => {
    const data = await authFetch('/api/cameras');
    if (data?.success && mountedRef.current) {
      setCameras(data.cameras);
      setIsBackendReady(true);
    }
  }, [authFetch]);

  // ── Backend readiness polling — stops once ready, cleans up on unmount ────
  useEffect(() => {
    let pollId = null;
    let cancelled = false;

    const poll = async () => {
      const data = await authFetch('/api/cameras');
      if (cancelled) return;
      if (data?.success) {
        setCameras(data.cameras);
        setIsBackendReady(true);
      } else {
        // retry in 3 seconds
        pollId = setTimeout(poll, 3000);
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (pollId) clearTimeout(pollId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // ── Add camera ─────────────────────────────────────────────────────────────
  const addCamera = async () => {
    if (!newCamUrl.trim()) return;
    const camData = { 
      name: newCamName || 'New Camera', 
      url: newCamUrl.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)[0],
      lat: newCamLat ? parseFloat(newCamLat) : null,
      lng: newCamLng ? parseFloat(newCamLng) : null
    };

    const data = await authFetch('/api/cameras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: newCamName || 'New Camera', 
        url: newCamUrl.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)[0],
        lat: newCamLat ? parseFloat(newCamLat) : null,
        lng: newCamLng ? parseFloat(newCamLng) : null
      })
    });

    if (data?.success) {
      if (mountedRef.current) { 
        setNewCamName(''); 
        setNewCamUrl(''); 
        setNewCamLat(''); 
        setNewCamLng(''); 
        setIsAdding(false); 
      }
      fetchCameras();
    } else {
      alert('Failed to add camera: ' + (data?.error || 'Server error'));
    }
  };

  // ── Delete camera (optimistic) ─────────────────────────────────────────────
  const deleteCamera = async (id) => {
    // Remove from UI first so <img> src is cleared and TCP stream drops cleanly
    setCameras(prev => prev.filter(c => c._id !== id));
    const data = await authFetch(`/api/cameras/${id}`, { method: 'DELETE' });
    // If server delete failed, restore
    if (!data?.success) fetchCameras();
  };

  // ── Toggle camera active ───────────────────────────────────────────────────
  const toggleCameraActive = async (id, currentState) => {
    const newState = currentState === false ? true : false;
    // Optimistic update
    setCameras(prev => prev.map(c => c._id === id ? { ...c, is_active: newState } : c));
    if (!data?.success) fetchCameras(); // restore on failure
  };

  // ── Fullscreen helper ──────────────────────────────────────────────────────
  const toggleFullscreen = (e) => {
    const card = e.currentTarget.closest('.camera-card') || e.currentTarget.closest('.primary-sensor-container');
    if (!document.fullscreenElement) {
      (card.requestFullscreen || card.webkitRequestFullscreen || card.msRequestFullscreen || (() => {})).call(card);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen || (() => {})).call(document);
    }
  };

  // ── Live frame → img ref ───────────────────────────────────────────────────
  useEffect(() => {
    const frame = dashboardState?.current_frame;
    if (frame && liveFrameRef.current) {
      liveFrameRef.current.src = `data:image/jpeg;base64,${frame}`;
    }
  }, [dashboardState?.current_frame]);

  // ── CPU load simulator ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mountedRef.current) return;
    if (isRunning) {
      setCpuLoad(prev => Math.round(prev + (65 + Math.random() * 25 - prev) * 0.1));
    } else {
      setCpuLoad(5);
    }
  }, [dashboardState?.frames_processed, isRunning]);

  // ── Per-camera telemetry (only when system running) ────────────────────────
  useEffect(() => {
    if (!isRunning || cameras.length === 0) return;

    setCameraStats(prev => {
      const next = { ...prev };
      cameras.forEach(c => {
        if (!next[c._id]) next[c._id] = { prob: 5 + Math.random() * 15, fps: 28 + Math.random() * 4, stability: 99.1 + Math.random() * 0.8 };
      });
      return next;
    });

    const interval = setInterval(() => {
      if (!mountedRef.current) return;
      setCameraStats(prev => {
        const next = { ...prev };
        cameras.forEach(cam => {
          if (cam.is_active !== false) {
            const cur = next[cam._id] || { prob: 12, fps: 30, stability: 99.5 };
            next[cam._id] = {
              prob:      Math.max(1,  Math.min(100,  cur.prob      + (Math.random() - 0.5) * 4)),
              fps:       Math.max(12, Math.min(30,   cur.fps       + (Math.random() - 0.5) * 3)),
              stability: Math.max(90, Math.min(99.9, cur.stability + (Math.random() - 0.4) * 0.2)),
            };
          }
        });
        return next;
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [isRunning, cameras]);

  // ── Waveform canvas ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = waveformRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 1.5;
      const t = Date.now() * 0.005;
      const amp = isRunning ? 20 : 5;
      for (let i = 0; i < canvas.width; i++) {
        const y = canvas.height / 2 + Math.sin(i * 0.04 + t) * amp + Math.sin(i * 0.08 + t * 1.3) * (amp * 0.4);
        i === 0 ? ctx.moveTo(i, y) : ctx.lineTo(i, y);
      }
      ctx.stroke();
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, [isRunning]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div id="view-monitoring" className="dashboard-view active" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="monitoring-header integrated-head" style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
        <div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 700, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
            Sensor Network Control
          </h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Unified view of primary intelligence and secondary integrated nodes.
          </div>
        </div>
        <button className={`btn ${isAdding ? 'btn-secondary' : 'btn-primary'} btn-sm`} onClick={() => setIsAdding(v => !v)}>
          {isAdding ? 'Cancel' : '+ Add Cameras'}
        </button>
      </div>

      {/* ── Add camera form ────────────────────────────────────────────────── */}
      {isAdding && (
        <div className="add-camera-form" style={{ marginBottom: '1.5rem' }}>
          <div className="form-group">
            <input type="text" className="form-input" placeholder="Sensor Name (e.g. Zone 4 North)"
              value={newCamName} onChange={e => setNewCamName(e.target.value)} />
            <textarea className="form-textarea" rows={2}
              placeholder="Sensor URL (RTSP or HTTP)"
              value={newCamUrl} onChange={e => setNewCamUrl(e.target.value)} />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <input type="number" step="any" className="form-input" placeholder="Latitude (optional)"
                value={newCamLat} onChange={e => setNewCamLat(e.target.value)} />
              <input type="number" step="any" className="form-input" placeholder="Longitude (optional)"
                value={newCamLng} onChange={e => setNewCamLng(e.target.value)} />
            </div>
            <button className="btn btn-success" onClick={addCamera}>Integrate New Sensors</button>
          </div>
        </div>
      )}

      {/* ── Main layout ────────────────────────────────────────────────────── */}
      <div className="monitoring-layout-refined" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: '1.5rem', flex: 1, minHeight: 0 }}>

        {/* LEFT Column: Camera grid + Map */}
        <div className="left-monitoring-column" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
          <div className="cameras-grid" style={{ alignContent: 'start', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', display: 'grid', gap: '1rem' }}>



          {/* ── Primary camera card ─────────────────────────────────────────── */}
          <div className="camera-card primary-camera-card" style={{ 
            order: -1, 
            border: isRunning && isPrimaryActive ? '2px solid var(--primary)' : '1px solid var(--border)',
            opacity: isPrimaryActive ? 1 : 0.6
          }}>
            <div className="camera-frame-wrapper">
              {isPrimaryActive ? (
                isRunning ? (
                  hasFrame
                    ? <img ref={liveFrameRef} className="camera-feed-img" alt="Live camera feed" />
                    : <div className="camera-frame-placeholder">AWAITING FIRST FRAME...</div>
                ) : (
                  isBackendReady
                    ? <StreamImg src="/api/cameras/primary/feed" className="camera-feed-img" alt="Standby feed" />
                    : <div className="camera-frame-placeholder">
                        <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 8 }} />
                        CONNECTING TO BACKEND...
                      </div>
                )
              ) : (
                <div className="camera-frame-placeholder" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5 }}>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                  PRIMARY SENSOR DISABLED
                </div>
              )}
              <HudOverlay
                opacity={isRunning && isPrimaryActive ? 1 : 0.3}
                topLeft={isRunning && isPrimaryActive ? 'SECURED CONNECTION' : isPrimaryActive ? 'STANDBY FEED' : 'OFFLINE'}
                topRight="1920×1080"
                bottomLeft={`STABILITY: ${isRunning && isPrimaryActive ? '99.9%' : 'N/A'}`}
                bottomRight={fps > 0 && isPrimaryActive ? `${fps.toFixed(0)} FPS` : '-- FPS'}
              />
              {isRunning && isPrimaryActive && <ConfidenceBar prob={prob} />}
            </div>
            <div className="camera-card-footer">
              <div className="camera-info">
                <div className="camera-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Primary Intelligence Console
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: isRunning && isPrimaryActive ? '#22C55E' : '#64748b', boxShadow: isRunning && isPrimaryActive ? '0 0 6px #22C55E' : 'none' }} />
                </div>
                <div className="camera-card-url" style={{ color: 'var(--primary)' }}>SYSTEM KERNEL</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button 
                  className="camera-card-delete" 
                  title={isPrimaryActive ? 'Disable Sensor' : 'Enable Sensor'}
                  onClick={() => {
                    const newState = !isPrimaryActive;
                    setIsPrimaryActive(newState);
                    localStorage.setItem('isPrimaryActive', newState);
                  }}
                  style={{ color: isPrimaryActive ? 'var(--text-main)' : '#10b981', background: 'var(--bg-page)' }}
                >
                  {isPrimaryActive
                    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  }
                </button>
                <button className="camera-card-delete" onClick={toggleFullscreen} title="Fullscreen" style={{ color: 'var(--text-main)', background: 'var(--bg-page)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>
                </button>
              </div>
            </div>
          </div>

          {/* ── Secondary camera cards ──────────────────────────────────────── */}
          {cameras.map(cam => {
            const stats = cameraStats[cam._id] || {};
            const active = cam.is_active !== false;
            return (
              <div key={cam._id} className="camera-card" style={{ opacity: active ? 1 : 0.6 }}>
                <div className="camera-frame-wrapper">
                  {active ? (
                    isBackendReady
                      ? <StreamImg src={`/api/cameras/${cam._id}/feed`} alt={cam.name} className="camera-feed-img" />
                      : <div className="camera-frame-placeholder" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                          CONNECTING...
                        </div>
                  ) : (
                    <div className="camera-frame-placeholder" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5 }}>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                      SENSOR DISABLED
                    </div>
                  )}

                  <HudOverlay
                    opacity={isRunning && active ? 1 : 0.3}
                    topLeft={isRunning && active ? 'SECURED CONNECTION' : active ? 'STANDBY FEED' : 'OFFLINE'}
                    topRight="1920×1080"
                    bottomLeft={`STABILITY: ${isRunning && active ? `${(stats.stability || 99.9).toFixed(1)}%` : 'N/A'}`}
                    bottomRight={isRunning && active ? `${(stats.fps || 0).toFixed(0)} FPS` : '-- FPS'}
                  />

                  {isRunning && active && <ConfidenceBar prob={stats.prob || 0} />}
                </div>

                <div className="camera-card-footer">
                  <div className="camera-info">
                    <div className="camera-card-title">{cam.name}</div>
                    <div className="camera-card-url">{cam.url}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {/* Enable / Disable */}
                    <button className="camera-card-delete" title={active ? 'Disable Sensor' : 'Enable Sensor'}
                      onClick={() => toggleCameraActive(cam._id, cam.is_active)}
                      style={{ color: active ? 'var(--text-main)' : '#10b981', background: 'var(--bg-page)' }}>
                      {active
                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      }
                    </button>
                    {/* Fullscreen */}
                    <button className="camera-card-delete" title="Fullscreen" onClick={toggleFullscreen}
                      style={{ color: 'var(--text-main)', background: 'var(--bg-page)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>
                    </button>
                    {/* Delete */}
                    <button className="camera-card-delete" title="Remove Sensor" onClick={() => deleteCamera(cam._id)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* MAP MODULE (Under Cameras) */}
        <div className="map-module" style={{ 
          marginTop: '1rem', 
          height: '350px', 
          borderRadius: '16px', 
          overflow: 'hidden', 
          border: '1px solid var(--border)',
          position: 'relative',
          gridColumn: '1 / -1' // Span if in a grid
        }}>
          <MapContainer 
            center={[20.5937, 78.9629]} 
            zoom={4} 
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />
            {cameras.filter(c => c.lat && c.lng).map(cam => (
              <CircleMarker 
                key={cam._id} 
                center={[cam.lat, cam.lng]} 
                radius={6}
                pathOptions={{ 
                  fillColor: cam.is_active ? '#2563EB' : '#64748b', 
                  color: '#fff', 
                  weight: 2, 
                  fillOpacity: 0.9 
                }}
              >
                <Tooltip permanent direction="top" offset={[0, -10]} opacity={1}>
                  <div style={{ 
                    fontWeight: 700, 
                    fontSize: '0.7rem', 
                    color: 'var(--text-main)', 
                    textTransform: 'uppercase' 
                  }}>
                    {cam.name}
                  </div>
                </Tooltip>
                <Popup>
                  <div style={{ fontSize: '0.8rem' }}>
                    <strong>{cam.name}</strong><br/>
                    {cam.is_active ? 'Status: Active' : 'Status: Disabled'}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      </div>

      {/* RIGHT Column: Console (Top) + Stats (Bottom) */}
      <div className="right-dashboard-column" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
        
        {/* PRIMARY CONSOLE */}
        <div className="intelligence-module" style={{ flexShrink: 0 }}>
          <div className="panel-head">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              Primary Intelligence Console
            </h3>
            <div className="stream-badge">
              <div className={`pulse-dot${isRunning ? '' : ' inactive'}`} style={{ background: isRunning ? '#22C55E' : '#64748b' }} />
              <span>{isRunning ? 'CAM-01: LIVE' : 'STANDBY'}</span>
            </div>
          </div>

          <div className="primary-sensor-container" style={{ position: 'relative', minHeight: '240px' }}>
            {(cameras.length > 0 && cameras[0].is_active !== false && isBackendReady) ? (
              <StreamImg 
                src={`/api/cameras/${cameras[0]._id}/feed`} 
                alt={cameras[0].name} 
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 8 }} 
              />
            ) : hasFrame
              ? <img ref={liveFrameRef} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 8 }} alt="Live" />
              : <div className="placeholder-box">
                  <div className="loading-state">
                    <span>{isRunning ? 'AWAITING FIRST FRAME...' : 'SYSTEM OFFLINE — LAUNCH TO ACTIVATE'}</span>
                  </div>
                </div>
            }
            <div className="hud-overlay">
              <div className="hud-corner top-left" /><div className="hud-corner top-right" />
              <div className="hud-corner bottom-left" /><div className="hud-corner bottom-right" />
              <div className="hud-center-cross" />
            </div>
            {isRunning && <ConfidenceBar prob={prob} />}
          </div>
        </div>

        {/* STATS MODULES (Neural, Hardware, Log) */}
        <div className="monitoring-stats-col">

            <div className="display-panel">
              <div className="panel-head"><h3>NEURAL SIGNAL</h3></div>
              <div className="waveform-container" style={{ height: 100 }}>
                <canvas ref={waveformRef} width="340" height="100" />
              </div>
            </div>

            <div className="display-panel">
              <div className="panel-head"><h3>HARDWARE SYNC</h3></div>
              <div className="hw-grid-compact">
                <HWPill label="AI ENGINE" value={`${cpuLoad}%`} progress={cpuLoad} color="#2563EB" />
                <HWPill label="ACCIDENTS" value={`${dashboardState?.total_accidents || 0}`} progress={Math.min((dashboardState?.total_accidents || 0) * 10, 100)} color="#EF4444" />
              </div>
            </div>

            <div className="display-panel">
              <div className="panel-head">
                <h3>INCIDENT LOG</h3>
                <span className="stat-badge" style={{ background: 'rgba(220,38,38,0.1)', color: '#DC2626' }}>
                  {(dashboardState?.accidents || []).length}
                </span>
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {(dashboardState?.accidents || []).length === 0 ? (
                  <div className="empty-state">NO INCIDENTS — SYSTEM {isRunning ? 'MONITORING' : 'OFFLINE'}</div>
                ) : (
                  (dashboardState?.accidents || []).slice(0, 10).map((acc, idx) => (
                    <div key={idx} style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                      <div>
                        <span style={{ fontWeight: 700, color: 'var(--danger)' }}>ACCIDENT</span>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: 2 }}>{acc.timestamp}</div>
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--danger)' }}>
                        {typeof acc.probability === 'number' ? acc.probability.toFixed(1) : acc.probability}%
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Monitoring;
