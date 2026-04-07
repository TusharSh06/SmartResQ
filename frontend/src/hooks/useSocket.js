import { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_BASE || import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const useSocket = () => {
    const socketRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const [dashboardState, setDashboardState] = useState({
        is_running: false,
        fps: 0,
        total_frames: 0,
        total_accidents: 0,
        total_plates: 0,
        frames_processed: 0,
        accidents: [],
        plates: [],
        uptime: '00:00',
        system_status: 'stopped',
        current_frame: null,   // base64 JPEG from live camera
        current_prob: 0,        // latest accident probability %
    });
    const [videoAnalysisState, setVideoAnalysisState] = useState({
        status: 'idle',
        progress: 0,
        frame_count: 0,
        total_frames: 0,
        accidents_so_far: 0,
        accidents: [],
        current_pred: '',
        current_prob: 0,
        last_frame: null,
        error: null
    });

    useEffect(() => {
        const socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
        });

        socket.on('connect', () => {
            console.log('✅ Connected to Smart Resq Intelligence Hub');
            setIsConnected(true);
        });

        socket.on('disconnect', () => {
            console.log('❌ Disconnected from Intelligence Hub');
            setIsConnected(false);
            // Mark system as stopped when socket drops
            setDashboardState(prev => ({ ...prev, is_running: false, system_status: 'stopped' }));
        });

        // ── System status (sent on connect + on start/stop) ──────────────
        socket.on('system_status', (data) => {
            const running = data.status === 'running';
            setDashboardState(prev => ({
                ...prev,
                system_status: data.status,
                is_running: running,
                // Reset frame when stopped
                current_frame: running ? prev.current_frame : null,
            }));
        });

        // ── Stats snapshot (sent on connect + periodically) ──────────────
        socket.on('stats_update', (data) => {
            setDashboardState(prev => ({
                ...prev,
                total_accidents:  data.total_accidents       ?? prev.total_accidents,
                total_plates:     data.total_plates_detected ?? prev.total_plates,
                frames_processed: data.frames_processed      ?? prev.frames_processed,
                uptime:           data.uptime                ?? prev.uptime,
            }));
        });

        // ── Live camera frame (fires every 2 frames from camera.py) ──────
        socket.on('frame_update', (data) => {
            setDashboardState(prev => ({
                ...prev,
                frames_processed: data.frame_count  ?? prev.frames_processed,
                fps:              data.fps           ?? prev.fps,
                current_prob:     data.probability   ?? prev.current_prob,
                // Only update current_frame when an actual image is provided
                current_frame:    data.frame         ?? prev.current_frame,
            }));
        });

        // ── Live accident detected (from live camera) ─────────────────────
        socket.on('accident_detected', (data) => {
            setDashboardState(prev => ({
                ...prev,
                total_accidents: (prev.total_accidents || 0) + 1,
                accidents: [data, ...(prev.accidents || [])].slice(0, 50),
            }));
        });

        // ── Plate detected ────────────────────────────────────────────────
        socket.on('plate_detected', (data) => {
            setDashboardState(prev => ({
                ...prev,
                total_plates: (prev.total_plates || 0) + 1,
            }));
        });

        // ── Generic dashboard_update (legacy / fallback) ──────────────────
        socket.on('dashboard_update', (data) => {
            setDashboardState(prev => ({ ...prev, ...data }));
        });

        // ── Video Analysis Events ─────────────────────────────────────────
        socket.on('video_analysis_progress', (data) => {
            setVideoAnalysisState(prev => ({
                ...prev,
                status:          'analyzing',
                progress:        data.progress         ?? prev.progress,
                frame_count:     data.frame_count      ?? prev.frame_count,
                total_frames:    data.total_frames     ?? prev.total_frames,
                accidents_so_far:data.accidents_so_far ?? prev.accidents_so_far,
                current_pred:    data.current_pred     ?? prev.current_pred,
                current_prob:    data.current_prob     ?? prev.current_prob,
                last_frame:      data.frame            ?? prev.last_frame,
            }));
        });

        socket.on('video_analysis_accident', (data) => {
            setVideoAnalysisState(prev => ({
                ...prev,
                accidents:        [...(prev.accidents || []), data],
                accidents_so_far: (prev.accidents_so_far || 0) + 1,
            }));
        });

        socket.on('video_analysis_complete', (data) => {
            setVideoAnalysisState(prev => ({
                ...prev,
                status:   'complete',
                accidents: data.accidents ?? prev.accidents,
                progress:  100,
            }));
        });

        socket.on('video_analysis_error', (data) => {
            setVideoAnalysisState(prev => ({
                ...prev,
                status: 'error',
                error:  data.error,
            }));
        });

        socket.on('video_analysis_stopped', () => {
            setVideoAnalysisState(prev => ({ ...prev, status: 'stopped' }));
        });

        socketRef.current = socket;

        return () => {
            if (socket) socket.disconnect();
        };
    }, []);

    const emitAction = useCallback((event, data = {}) => {
        if (socketRef.current) {
            socketRef.current.emit(event, data);
        }
    }, []);

    const resetVideoAnalysis = useCallback(() => {
        setVideoAnalysisState({
            status: 'idle',
            progress: 0,
            frame_count: 0,
            total_frames: 0,
            accidents_so_far: 0,
            accidents: [],
            current_pred: '',
            current_prob: 0,
            last_frame: null,
            error: null
        });
    }, []);

    return { 
        socket:             socketRef.current, 
        isConnected, 
        dashboardState,
        videoAnalysisState,
        resetVideoAnalysis,
        emitAction 
    };
};
