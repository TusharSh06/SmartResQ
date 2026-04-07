import React, { useState, useRef, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

/* ── Replay modal ─────────────────────────────────── */
const ReplayModal = ({ frames, accidents, videoInfo, onClose }) => {
  const [idx, setIdx]       = useState(0);
  const [playing, setPlaying] = useState(true);
  const intervalRef           = useRef(null);
  const fps                    = videoInfo?.fps || 30;
  const delay                  = Math.max(33, Math.round(1000 / fps)); // ms per frame, min 33ms

  useEffect(() => {
    if (playing && frames.length > 0) {
      intervalRef.current = setInterval(() => {
        setIdx(prev => {
          if (prev >= frames.length - 1) {
            clearInterval(intervalRef.current);
            setPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, delay);
    }
    return () => clearInterval(intervalRef.current);
  }, [playing, frames.length, delay]);

  const togglePlay = () => {
    if (idx >= frames.length - 1) { setIdx(0); setPlaying(true); return; }
    setPlaying(p => !p);
  };
  const restart = () => { setIdx(0); setPlaying(true); };

  const currentFrame = frames[idx];
  const progress = frames.length > 1 ? (idx / (frames.length - 1)) * 100 : 0;

  // Find accidents near current frame
  const nearbyAcc = accidents.filter(a => Math.abs((a.frame_number || a.frame || 0) - idx * 5) < 15);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(6px)', animation: 'fadeIn 0.2s ease'
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg-panel, #111827)', borderRadius: 16,
        border: '1px solid var(--border, #1e293b)',
        width: 'min(900px, 94vw)', maxHeight: '90vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 32px 64px rgba(0,0,0,0.6)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.4rem', borderBottom: '1px solid var(--border, #1e293b)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
              Replay: {videoInfo?.name || 'Analysis'}
            </span>
            <span style={{
              background: 'rgba(37,99,235,0.12)', color: '#2563EB',
              borderRadius: 6, padding: '2px 8px', fontSize: '0.68rem', fontWeight: 700
            }}>
              {frames.length} frames captured
            </span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid var(--border,#334155)',
            borderRadius: 8, color: 'var(--text-muted,#64748b)', cursor: 'pointer',
            padding: '4px 10px', fontSize: '0.8rem', lineHeight: 1.4
          }}>✕ Close</button>
        </div>

        {/* Video area */}
        <div style={{ position: 'relative', background: '#000', flex: '1 1 auto', minHeight: 0 }}>
          {currentFrame ? (
            <img
              src={`data:image/jpeg;base64,${currentFrame}`}
              alt={`Frame ${idx}`}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', maxHeight: '52vh' }}
            />
          ) : (
            <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.85rem' }}>
              No frames captured — analysis ran in fast mode.
            </div>
          )}
          {/* HUD corners */}
          <div className="hud-overlay">
            <div className="hud-corner top-left"/><div className="hud-corner top-right"/>
            <div className="hud-corner bottom-left"/><div className="hud-corner bottom-right"/>
          </div>
          {/* Accident badge */}
          {nearbyAcc.length > 0 && (
            <div style={{
              position: 'absolute', top: 10, right: 10,
              background: 'rgba(220,38,38,0.9)', color: '#fff',
              borderRadius: 8, padding: '4px 10px', fontSize: '0.72rem', fontWeight: 700,
              animation: 'pulse 1s infinite'
            }}>
              ⚠ ACCIDENT DETECTED
            </div>
          )}
          {/* Frame counter */}
          <div style={{
            position: 'absolute', bottom: 8, left: 10, fontSize: '0.68rem',
            color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace'
          }}>
            FRAME {idx + 1} / {frames.length}
          </div>
        </div>

        {/* Controls */}
        <div style={{ padding: '0.85rem 1.2rem', borderTop: '1px solid var(--border,#1e293b)' }}>
          {/* Scrubber */}
          <input
            type="range" min={0} max={Math.max(frames.length - 1, 0)} value={idx}
            onChange={e => { setPlaying(false); setIdx(Number(e.target.value)); }}
            style={{ width: '100%', marginBottom: '0.65rem', accentColor: '#2563EB', cursor: 'pointer' }}
          />
          {/* Accident markers */}
          {accidents.length > 0 && frames.length > 0 && (
            <div style={{ position: 'relative', height: 4, background: 'var(--border,#1e293b)', borderRadius: 4, marginBottom: '0.65rem' }}>
              {accidents.map((a, i) => {
                const fNum = a.frame_number || a.frame || 0;
                const pct  = Math.min(100, (fNum / ((frames.length - 1) * 5 || 1)) * 100);
                return (
                  <div key={i} title={`Accident @ frame ${fNum}`} style={{
                    position: 'absolute', left: `${pct}%`, top: -2,
                    width: 4, height: 8, background: '#DC2626',
                    borderRadius: 2, transform: 'translateX(-50%)', cursor: 'pointer'
                  }} onClick={() => { setPlaying(false); setIdx(Math.round(fNum / 5)); }} />
                );
              })}
            </div>
          )}
          {/* Buttons row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button onClick={restart} title="Restart" style={{
              background: 'none', border: '1px solid var(--border,#334155)',
              borderRadius: 8, color: 'var(--text-muted,#94a3b8)', cursor: 'pointer',
              padding: '6px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
              </svg> Restart
            </button>
            <button onClick={togglePlay} style={{
              background: playing ? 'rgba(220,38,38,0.12)' : 'rgba(37,99,235,0.12)',
              border: `1px solid ${playing ? '#DC2626' : '#2563EB'}`,
              color: playing ? '#DC2626' : '#2563EB',
              borderRadius: 8, padding: '6px 18px', fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem'
            }}>
              {playing ? (
                <><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>Pause</>
              ) : (
                <><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>{idx >= frames.length - 1 ? 'Replay' : 'Play'}</>
              )}
            </button>
            <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted,#64748b)' }}>
              Progress: {progress.toFixed(0)}%
              {accidents.length > 0 && <span style={{ color: '#DC2626', marginLeft: '0.5rem' }}>· {accidents.length} accident{accidents.length !== 1 ? 's' : ''} found</span>}
            </span>
          </div>
        </div>

        {/* Accident log */}
        {accidents.length > 0 && (
          <div style={{
            borderTop: '1px solid var(--border,#1e293b)',
            maxHeight: 180, overflowY: 'auto',
            padding: '0.6rem 1.2rem'
          }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted,#64748b)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
              Accident Log
            </div>
            {accidents.map((acc, i) => {
              const sec = acc.timestamp_sec != null ? acc.timestamp_sec.toFixed(2) + 's'
                        : acc.timestamp_str || '—';
              const pct  = acc.probability != null ? acc.probability.toFixed(1) + '%' : '—';
              return (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.3rem 0', borderBottom: '1px solid var(--border,#1e293b)',
                  fontSize: '0.76rem'
                }}>
                  <span>#{i + 1} · Frame&nbsp;<strong>{acc.frame_number || acc.frame}</strong></span>
                  <span style={{ color: 'var(--text-muted,#64748b)' }}>{sec}</span>
                  <span style={{ color: '#DC2626', fontWeight: 700 }}>{pct}</span>
                  <button onClick={() => { setPlaying(false); setIdx(Math.round((acc.frame_number || acc.frame || 0) / 5)); }} style={{
                    background: 'none', border: '1px solid var(--border,#334155)',
                    borderRadius: 6, color: '#2563EB', cursor: 'pointer', fontSize: '0.7rem', padding: '2px 7px'
                  }}>Jump</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Main VideoAnalysis component ─────────────── */
const VideoAnalysis = ({ videoAnalysisState, resetVideoAnalysis }) => {
  const [file, setFile]                     = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading]       = useState(false);
  const [videoInfo, setVideoInfo]           = useState(null);
  const [uiStatus, setUiStatus]             = useState('IDLE');
  const [error, setError]                   = useState(null);
  const [showReplay, setShowReplay]         = useState(false);
  const [capturedFrames, setCapturedFrames] = useState([]);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  
  // Settings State
  const [threshold, setThreshold] = useState(10);
  const [frameSkip, setFrameSkip] = useState(3);

  const fileInputRef  = useRef(null);
  const liveFrameRef  = useRef(null);

  // Sync server status → UI status
  useEffect(() => {
    if (!videoAnalysisState) return;
    const s = videoAnalysisState.status;
    if (s === 'analyzing')  setUiStatus('ANALYZING');
    else if (s === 'complete') setUiStatus('COMPLETE');
    else if (s === 'error')  { setUiStatus('ERROR'); setError(videoAnalysisState.error); }
    else if (s === 'stopped') setUiStatus('READY');
  }, [videoAnalysisState?.status]);

  // Capture frames for replay + update live preview
  useEffect(() => {
    if (!videoAnalysisState?.last_frame) return;
    if (liveFrameRef.current) {
      liveFrameRef.current.src = `data:image/jpeg;base64,${videoAnalysisState.last_frame}`;
    }
    if (uiStatus === 'ANALYZING') {
      setCapturedFrames(prev => {
        // Sample every ~5th push to keep replay memory reasonable (≤600 frames)
        if (prev.length >= 600) return prev;
        return [...prev, videoAnalysisState.last_frame];
      });
    }
  }, [videoAnalysisState?.last_frame]);

  const handleFileSelected = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setVideoInfo({ name: f.name, size: (f.size / (1024 * 1024)).toFixed(2) + ' MB' });
    setUiStatus('IDLE'); setError(null);
    setCapturedFrames([]);
    resetVideoAnalysis?.();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('video/')) {
      setFile(f);
      setVideoInfo({ name: f.name, size: (f.size / (1024 * 1024)).toFixed(2) + ' MB' });
      setUiStatus('IDLE'); setError(null);
      setCapturedFrames([]);
      resetVideoAnalysis?.();
    }
  };

  const uploadAndAnalyse = async () => {
    if (!file) return;
    setError(null); setIsUploading(true);
    setUiStatus('UPLOADING'); setUploadProgress(0);
    setCapturedFrames([]);

    const formData = new FormData();
    formData.append('video', file);
    try {
      const uploadResp = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE}/api/upload-video`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => xhr.status === 200
          ? resolve(JSON.parse(xhr.responseText))
          : reject(new Error(JSON.parse(xhr.responseText)?.error || 'Upload failed'));
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(formData);
      });

      if (uploadResp.video_info) {
        setVideoInfo(prev => ({ ...prev, ...uploadResp.video_info, size: prev.size }));
      }
      setIsUploading(false); setUiStatus('READY');

      const analyseResp = await fetch(`${API_BASE}/api/analyze-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold: threshold, frame_skip: frameSkip })
      });
      const analyseData = await analyseResp.json();
      if (!analyseResp.ok) throw new Error(analyseData.error || 'Failed to start analysis');
      setUiStatus('ANALYZING');
    } catch (err) {
      setIsUploading(false); setUiStatus('ERROR'); setError(err.message);
    }
  };

  const stopAnalysis = async () => {
    await fetch(`${API_BASE}/api/video-analysis/stop`, { method: 'POST' });
    setUiStatus('READY');
  };

  const reset = async () => {
    try { await fetch(`${API_BASE}/api/video-analysis/reset`, { method: 'POST' }); } catch (_) {}
    setFile(null); setVideoInfo(null); setUiStatus('IDLE');
    setUploadProgress(0); setError(null); setCapturedFrames([]);
    resetVideoAnalysis?.();
    if (liveFrameRef.current) liveFrameRef.current.src = '';
  };

  const isAnalyzing   = uiStatus === 'ANALYZING';
  const isComplete    = uiStatus === 'COMPLETE';
  const progress      = videoAnalysisState?.progress ?? 0;
  const accidents     = videoAnalysisState?.accidents ?? [];
  const frameCount    = videoAnalysisState?.frame_count ?? 0;
  const totalFrames   = videoAnalysisState?.total_frames ?? 0;
  const accidentsSoFar = videoAnalysisState?.accidents_so_far ?? 0;

  return (
    <div id="view-video-analysis" className="dashboard-view active">
      <div className="va-layout">

        {/* ── LEFT: Upload + Controls ── */}
        <div className="va-left-col">
          <div className="display-panel" id="va-upload-panel">
            <div className="panel-head">
              <h3>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
                Video Analysis Engine
              </h3>
              <span className="stat-badge" id="va-status-badge" style={{
                background: isAnalyzing ? 'rgba(37,99,235,0.1)' :
                            isComplete  ? 'rgba(22,163,74,0.1)'  :
                            uiStatus === 'ERROR' ? 'rgba(220,38,38,0.1)' : 'rgba(100,116,139,0.1)',
                color: isAnalyzing ? '#2563EB' :
                       isComplete  ? '#16A34A'  :
                       uiStatus === 'ERROR' ? '#DC2626' : '#64748b'
              }}>
                {uiStatus}
              </span>
            </div>

            {/* Drop Zone */}
            <div
              className="va-drop-zone"
              onClick={() => !isAnalyzing && fileInputRef.current.click()}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              style={{ background: file ? 'rgba(37,99,235,0.05)' : '', cursor: isAnalyzing ? 'default' : 'pointer' }}
            >
              <div className="va-drop-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <div className="va-drop-title">{file ? file.name : 'Drop Video Here'}</div>
              <div className="va-drop-sub">or click to browse — MP4, AVI, MOV, MKV, WEBM supported</div>
              <input type="file" ref={fileInputRef} accept="video/*" style={{ display: 'none' }} onChange={handleFileSelected} />
            </div>

            {/* Video metadata */}
            {videoInfo && (
              <div className="va-info-grid" style={{ display: 'grid' }}>
                <div className="va-info-card"><div className="va-info-label">FILE</div><div className="va-info-value" style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{videoInfo.name}</div></div>
                <div className="va-info-card"><div className="va-info-label">SIZE</div><div className="va-info-value">{videoInfo.size}</div></div>
                {videoInfo.resolution && <div className="va-info-card"><div className="va-info-label">RESOLUTION</div><div className="va-info-value">{videoInfo.resolution}</div></div>}
                {videoInfo.fps       && <div className="va-info-card"><div className="va-info-label">FPS</div><div className="va-info-value">{typeof videoInfo.fps === 'number' ? videoInfo.fps.toFixed(1) : videoInfo.fps}</div></div>}
                {videoInfo.duration_seconds && <div className="va-info-card"><div className="va-info-label">DURATION</div><div className="va-info-value">{videoInfo.duration_seconds}s</div></div>}
              </div>
            )}

            {/* Upload progress */}
            {isUploading && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.4rem', fontWeight: 600, letterSpacing: '0.5px' }}>
                  UPLOADING… {uploadProgress}%
                </div>
                <div className="va-prog-track">
                  <div className="va-prog-bar" style={{ width: `${uploadProgress}%` }}/>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(220,38,38,0.1)', borderRadius: '8px', color: '#DC2626', fontSize: '0.8rem', fontWeight: 600 }}>
                ⚠ {error}
              </div>
            )}

            {/* Settings & Controls */}
            {file && (
              <div style={{ marginTop: '1.5rem' }}>
                <div style={{ 
                  background: 'var(--bg-page)', 
                  border: '1px solid var(--border)', 
                  borderRadius: '12px', 
                  padding: '1.5rem', 
                  marginBottom: '1rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '1.2rem', letterSpacing: '0.5px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    ANALYSIS SETTINGS
                  </div>
                  
                  {/* Threshold */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Detection Threshold</label>
                      <span style={{ 
                        background: 'rgba(239,68,68,0.1)', color: '#EF4444', 
                        padding: '4px 8px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 700 
                      }}>{threshold}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="10" 
                      max="99" 
                      value={threshold} 
                      onChange={(e) => setThreshold(Number(e.target.value))}
                      disabled={isAnalyzing}
                      style={{ width: '100%', accentColor: '#2563EB', marginBottom: '0.5rem', cursor: isAnalyzing ? 'not-allowed' : 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>10% — More sensitive</span>
                      <span>99% — Stricter</span>
                    </div>
                    {threshold < 40 && (
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        Low threshold — may flag non-accidents
                      </div>
                    )}
                  </div>

                  {/* Frame Skip */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Frame Sampling Rate</label>
                      <span style={{ 
                        background: 'rgba(37,99,235,0.1)', color: '#2563EB', 
                        padding: '4px 8px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 700 
                      }}>Every {frameSkip} frames</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="15" 
                      value={frameSkip} 
                      onChange={(e) => setFrameSkip(Number(e.target.value))}
                      disabled={isAnalyzing}
                      style={{ width: '100%', accentColor: '#2563EB', marginBottom: '0.5rem', cursor: isAnalyzing ? 'not-allowed' : 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>1 — Every frame (slow)</span>
                      <span>15 — Fast scan</span>
                    </div>
                  </div>
                </div>

                <div className="va-controls" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {!isAnalyzing ? (
                    <button className="btn-premium btn-start" onClick={uploadAndAnalyse} disabled={isUploading} style={{ width: '100%', padding: '12px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      {uiStatus === 'READY' || isComplete ? 'Re-Analyse' : 'Analyse Video'}
                    </button>
                  ) : (
                    <button className="btn-premium btn-stop" onClick={stopAnalysis} style={{ width: '100%', padding: '12px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                      Stop Analysis
                    </button>
                  )}

                  {/* ── REPLAY BUTTON ── shown after analysis completes ── */}
                  {isComplete && capturedFrames.length > 0 && (
                    <button
                      id="btn-replay-analysis"
                      className="btn-premium"
                      onClick={() => setShowReplay(true)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: 'linear-gradient(135deg, rgba(37,99,235,0.05), rgba(99,102,241,0.05))',
                        border: '1px solid rgba(37,99,235,0.3)',
                        color: '#60A5FA',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                        <path d="M19 3 v4 M19 21 v-4" opacity="0.5"/>
                      </svg>
                      Replay Analysis
                    </button>
                  )}

                  <button 
                    className="btn-icon" 
                    onClick={reset} 
                    title="Upload new video" 
                    style={{ 
                      width: '100%', 
                      padding: '10px', 
                      display: 'flex', 
                      justifyContent: 'center', 
                      gap: '8px',
                      background: 'var(--bg-page)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text-muted)'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
                    </svg>
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Progress Panel */}
          {(isAnalyzing || isComplete) && (
            <div className="display-panel" id="vaProgressPanel" style={{ display: 'block' }}>
              <div className="panel-head">
                <h3>Analysis Progress</h3>
                <span style={{ fontWeight: 700, color: '#2563EB' }}>{progress.toFixed(1)}%</span>
              </div>
              <div className="va-prog-track va-prog-track--lg">
                <div className={`va-prog-bar${isAnalyzing ? ' va-prog-bar--animated' : ''}`} style={{ width: `${progress}%` }}/>
              </div>
              <div className="va-progress-meta">
                <span>Frames: <strong>{frameCount}</strong> / <strong>{totalFrames}</strong></span>
                <span>Accidents: <strong style={{ color: 'var(--danger)' }}>{accidentsSoFar}</strong></span>
              </div>
              {isComplete && (
                <div style={{ marginTop: '0.5rem', color: '#16A34A', fontWeight: 700, fontSize: '0.8rem' }}>
                  ✓ ANALYSIS COMPLETE — {accidents.length} accident(s) found
                  {capturedFrames.length > 0 && (
                    <span style={{ color: '#2563EB', marginLeft: '0.75rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem', textDecoration: 'underline' }}
                      onClick={() => setShowReplay(true)}>
                      Watch Replay ▶
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: Live Frame + Timeline ── */}
        <div className="va-right-col">
          <div className="display-panel">
            <div className="panel-head">
              <h3>Live Frame Preview</h3>
              {isAnalyzing && (
                <div className="rec-pulse" style={{ opacity: 1 }}>
                  <div className="rec-dot"/>
                  <span>SCANNING</span>
                </div>
              )}
              {isComplete && capturedFrames.length > 0 && (
                <button
                  onClick={() => setShowReplay(true)}
                  style={{
                    background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.3)',
                    borderRadius: 8, color: '#60A5FA', cursor: 'pointer',
                    padding: '4px 12px', fontSize: '0.72rem', fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 4
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Replay
                </button>
              )}
            </div>
            <div className="video-viewport">
              {videoAnalysisState?.last_frame ? (
                <img
                  ref={liveFrameRef}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                  alt="Live analysis frame"
                />
              ) : (
                <div className="placeholder-box">
                  <div className="loading-state">
                    <span>{isAnalyzing ? 'PROCESSING NEURAL STREAM…' : 'AWAITING VIDEO ARCHIVE…'}</span>
                  </div>
                </div>
              )}
              <div className="hud-overlay">
                <div className="hud-corner top-left"/><div className="hud-corner top-right"/>
                <div className="hud-corner bottom-left"/><div className="hud-corner bottom-right"/>
              </div>
              {isAnalyzing && videoAnalysisState?.current_pred && (
                <div style={{
                  position: 'absolute', bottom: 12, left: 12, right: 12,
                  background: 'rgba(0,0,0,0.7)', padding: '6px 12px',
                  borderRadius: 6, fontSize: '0.75rem', fontWeight: 700,
                  color: 'white', display: 'flex', justifyContent: 'space-between'
                }}>
                  <span style={{ color: videoAnalysisState.current_pred === 'Accident' ? '#EF4444' : '#22C55E' }}>
                    {videoAnalysisState.current_pred?.toUpperCase()}
                  </span>
                  <span>{videoAnalysisState.current_prob?.toFixed(1)}% conf</span>
                </div>
              )}
            </div>
          </div>

          {/* Accident Timeline */}
          <div className="display-panel">
            <div className="panel-head">
              <h3>Detected Accidents Timeline</h3>
              <span className="stat-badge" style={{ background: 'rgba(220,38,38,0.1)', color: '#DC2626' }}>
                {accidents.length}
              </span>
            </div>
            <div className="va-timeline">
              {accidents.length === 0 ? (
                <div className="empty-state">NO ACCIDENTS DETECTED YET</div>
              ) : (
                accidents.map((acc, idx) => (
                  <div key={idx} style={{
                    padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    animation: 'fadeIn 0.3s ease'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                        Accident @ {acc.timestamp_str || (acc.timestamp_sec != null ? acc.timestamp_sec.toFixed(2) + 's' : '—')}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Frame #{acc.frame_number || acc.frame}
                      </div>
                    </div>
                    {acc.photo_path && (
                      <div style={{ 
                        marginRight: '1rem', width: '56px', height: '40px', 
                        borderRadius: '4px', overflow: 'hidden', background: '#e2e8f0',
                        border: '1px solid var(--border)', cursor: 'pointer'
                      }}
                      onClick={() => setFullScreenImage(acc.photo_path)}
                      >
                        <img src={acc.photo_path} alt="Accident Frame" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '0.85rem' }}>
                        {acc.probability?.toFixed(1)}%
                      </span>
                      <div style={{ fontSize: '0.7rem', color: '#DC2626', marginTop: '2px' }}>VERIFIED</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Replay Modal ── */}
      {showReplay && (
        <ReplayModal
          frames={capturedFrames}
          accidents={accidents}
          videoInfo={videoInfo}
          onClose={() => setShowReplay(false)}
        />
      )}
      {/* ── Fullscreen Image Modal ── */}
      {fullScreenImage && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.9)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)'
        }} onClick={() => setFullScreenImage(null)}>
          <img src={fullScreenImage} alt="Fullscreen Accident" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }} />
          <button style={{
            position: 'absolute', top: '2rem', right: '3rem', background: 'rgba(255,255,255,0.1)', 
            border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '0.5rem 1rem', 
            borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '1rem'
          }} onClick={(e) => { e.stopPropagation(); setFullScreenImage(null); }}>
            ✕ Close
          </button>
        </div>
      )}

    </div>
  );
};

export default VideoAnalysis;
