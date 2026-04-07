import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

const Settings = () => {
    const [cameras, setCameras] = useState([]);
    const [activeTab, setActiveTab] = useState('video');
    const [settings, setSettings] = useState({
        detection_threshold: 99,
        ocr_model: "EASY_OCR_V2",
        default_camera_id: "primary",
        alerts_browser: true,
        alerts_sms: false,
        alerts_email: true,
        system_threshold_confidence: 80,
        system_threshold_cooldown: 5,
        hardware_resolution: "HD_720P",
        hardware_fps_cap: 25
    });
    const [originalSettings, setOriginalSettings] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const fetchCameras = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/cameras`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
            });
            const data = await res.json();
            if (data.success) {
                setCameras(data.cameras);
            }
        } catch (e) {
            console.error('Failed to fetch cameras', e);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/settings`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
            });
            const data = await res.json();
            if (data.success) {
                setSettings(data.settings);
                setOriginalSettings(data.settings);
            }
        } catch (e) {
            console.error('Failed to fetch settings', e);
        }
    };

    useEffect(() => {
        fetchCameras();
        fetchSettings();
    }, []);

    const handleChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const renameCamera = async (id, newName) => {
        if (!newName.trim()) return;
        try {
            const res = await fetch(`${API_BASE}/api/cameras/${id}/rename`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}` 
                },
                body: JSON.stringify({ name: newName })
            });
            const data = await res.json();
            if (data.success) fetchCameras();
        } catch(e) { console.error('Failed to rename camera', e); }
    };

    const saveSettings = async () => {
        setIsSaving(true);
        try {
            const res = await fetch(`${API_BASE}/api/settings`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}` 
                },
                body: JSON.stringify(settings)
            });
            const data = await res.json();
            if (data.success) {
                setOriginalSettings(settings);
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 2000);
            }
        } catch (e) {
            console.error('Failed to save settings', e);
        } finally {
            setIsSaving(false);
        }
    };

    const hasUnsavedChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

    return (
        <div id="view-settings" className="dashboard-view active">
            <div className="settings-page">
                <div className="panel-head" style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <h3>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" style={{ marginRight: '8px', verticalAlign: 'middle' }}>
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                            Core Calibration
                        </h3>
                        {hasUnsavedChanges && (
                            <span style={{ fontSize: '0.75rem', background: '#FEF3C7', color: '#92400E', padding: '0.2rem 0.6rem', borderRadius: '100px', fontWeight: 600 }}>
                                UNSAVED CHANGES
                            </span>
                        )}
                    </div>
                </div>

                <div className="settings-tabs">
                    <button 
                        className={`settings-tab ${activeTab === 'video' ? 'active' : ''}`}
                        onClick={() => setActiveTab('video')}
                    >
                        Video Analytics
                    </button>
                    <button 
                        className={`settings-tab ${activeTab === 'thresholds' ? 'active' : ''}`}
                        onClick={() => setActiveTab('thresholds')}
                    >
                        System Thresholds
                    </button>
                    <button 
                        className={`settings-tab ${activeTab === 'webhooks' ? 'active' : ''}`}
                        onClick={() => setActiveTab('webhooks')}
                    >
                        API Webhooks
                    </button>
                    <button 
                        className={`settings-tab ${activeTab === 'hardware' ? 'active' : ''}`}
                        onClick={() => setActiveTab('hardware')}
                    >
                        Hardware
                    </button>
                </div>

                <div className="settings-content">
                    {activeTab === 'video' && (
                        <div className="settings-group">
                            <h4>Vision Parameters</h4>
                            <div className="settings-grid-3" style={{ marginBottom: '1.5rem' }}>
                                <div className="input-group">
                                    <label>DEFAULT INPUT SOURCE KERNEL</label>
                                    <select 
                                        className="premium-input"
                                        value={settings.default_camera_id}
                                        onChange={(e) => handleChange('default_camera_id', e.target.value)}
                                    >
                                        <option value="primary">System Kernel (Primary Hardware)</option>
                                        {cameras.map((c) => (
                                            <option key={c._id} value={c._id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label>DETECTION THRESHOLD ({settings.detection_threshold}%)</label>
                                    <input 
                                        type="range" 
                                        min="50" 
                                        max="100" 
                                        value={settings.detection_threshold} 
                                        onChange={(e) => handleChange('detection_threshold', parseInt(e.target.value))}
                                        className="premium-range" 
                                    />
                                </div>
                                <div className="input-group">
                                    <label>OCR MODEL</label>
                                    <select 
                                        className="premium-input"
                                        value={settings.ocr_model}
                                        onChange={(e) => handleChange('ocr_model', e.target.value)}
                                    >
                                        <option value="EASY_OCR_V2">EASY_OCR_V2</option>
                                        <option value="TESSERACT_LTS">TESSERACT_LTS</option>
                                        <option value="VISION_TRANSFORMER">VISION_TRANSFORMER (BETA)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="settings-subgroup">
                                <h5>SENSOR IDENTITY MANAGEMENT</h5>
                                {cameras.length === 0 ? (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No secondary sensors integrated yet. Add them in the Monitoring tab.</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {cameras.map(cam => (
                                            <div key={cam._id} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                <div className="input-group" style={{ flex: 1, margin: 0 }}>
                                                    <input 
                                                        type="text" 
                                                        className="premium-input" 
                                                        defaultValue={cam.name}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                renameCamera(cam._id, e.target.value);
                                                                e.target.blur();
                                                            }
                                                        }}
                                                        onBlur={(e) => renameCamera(cam._id, e.target.value)}
                                                    />
                                                </div>
                                                <div style={{ flex: 1, fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    URL: {cam.url}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'thresholds' && (
                        <div className="settings-group">
                            <h4>Confidence & Cooldown</h4>
                            <div className="settings-grid-3">
                                <div className="input-group">
                                    <label>CONFIDENCE SCORE CUTOFF ({settings.system_threshold_confidence}%)</label>
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="100" 
                                        value={settings.system_threshold_confidence}
                                        onChange={(e) => handleChange('system_threshold_confidence', parseInt(e.target.value))}
                                        className="premium-range" 
                                    />
                                </div>
                                <div className="input-group">
                                    <label>DETECTION COOLDOWN (MIN)</label>
                                    <input 
                                        type="number" 
                                        className="premium-input"
                                        value={settings.system_threshold_cooldown}
                                        onChange={(e) => handleChange('system_threshold_cooldown', parseInt(e.target.value))}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'webhooks' && (
                        <div className="settings-group">
                            <h4>Notification Matrix</h4>
                            <div className="toggle-list">
                                <div className="toggle-item">
                                    <span>SYSTEM ALERTS (BROWSER)</span>
                                    <label className="switch">
                                        <input 
                                            type="checkbox" 
                                            checked={settings.alerts_browser} 
                                            onChange={(e) => handleChange('alerts_browser', e.target.checked)}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                                <div className="toggle-item">
                                    <span>SMS GATEWAY (TWILIO)</span>
                                    <label className="switch">
                                        <input 
                                            type="checkbox" 
                                            checked={settings.alerts_sms} 
                                            onChange={(e) => handleChange('alerts_sms', e.target.checked)}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                                <div className="toggle-item">
                                    <span>EMAIL REPORTS</span>
                                    <label className="switch">
                                        <input 
                                            type="checkbox" 
                                            checked={settings.alerts_email}
                                            onChange={(e) => handleChange('alerts_email', e.target.checked)}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'hardware' && (
                        <div className="settings-group">
                            <h4>Hardware Optimization</h4>
                            <div className="settings-grid-3">
                                <div className="input-group">
                                    <label>RESOLUTION</label>
                                    <select 
                                        className="premium-input"
                                        value={settings.hardware_resolution}
                                        onChange={(e) => handleChange('hardware_resolution', e.target.value)}
                                    >
                                        <option value="SD_480P">SD (480p)</option>
                                        <option value="HD_720P">HD (720p)</option>
                                        <option value="FHD_1080P">Full HD (1080p)</option>
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label>FPS CAP ({settings.hardware_fps_cap})</label>
                                    <input 
                                        type="range" 
                                        min="1" 
                                        max="60" 
                                        value={settings.hardware_fps_cap}
                                        onChange={(e) => handleChange('hardware_fps_cap', parseInt(e.target.value))}
                                        className="premium-range" 
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="settings-footer">
                    <button 
                        className={`btn-premium ${saveSuccess ? 'btn-success' : 'btn-start'}`} 
                        style={{ padding: '0.75rem 2.5rem', minWidth: '200px' }}
                        onClick={saveSettings}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            'Processing...'
                        ) : saveSuccess ? (
                            <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                Changes Synced
                            </>
                        ) : (
                            <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                    <polyline points="17 21 17 13 7 13 7 21" />
                                    <polyline points="7 3 7 8 15 8" />
                                </svg>
                                Sync Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                .settings-tabs {
                    display: flex;
                    gap: 0.5rem;
                    background: #f1f5f9;
                    padding: 0.4rem;
                    border-radius: 12px;
                    margin-bottom: 2rem;
                    width: fit-content;
                    border: 1px solid #e2e8f0;
                }
                .settings-tab {
                    padding: 0.6rem 1.2rem;
                    border-radius: 8px;
                    border: none;
                    background: transparent;
                    color: #64748b;
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    white-space: nowrap;
                }
                .settings-tab:hover {
                    color: #0f172a;
                    background: rgba(255, 255, 255, 0.5);
                }
                .settings-tab.active {
                    background: #ffffff;
                    color: #2563eb;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                }
                .btn-success {
                    background: #22C55E !important;
                    box-shadow: 0 4px 14px 0 rgba(34, 197, 94, 0.39) !important;
                }
                .settings-subgroup {
                    background: #f8fafc;
                    padding: 1.5rem;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                }
                .settings-subgroup h5 {
                    margin-top: 0;
                    margin-bottom: 1rem;
                    color: #0f172a;
                    font-size: 0.85rem;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                }
            `}} />
        </div>
    );
};

export default Settings;
