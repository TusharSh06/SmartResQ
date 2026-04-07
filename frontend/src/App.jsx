import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import TopNav from './components/TopNav';
import Overview from './views/Overview';
import Monitoring from './views/Monitoring';
import VideoAnalysis from './views/VideoAnalysis';
import Archive from './views/Archive';
import Alerts from './views/Alerts';
import TechStack from './views/TechStack/index.jsx';
import Settings from './views/Settings';
import Support from './views/Support';
import Developer from './views/Developer';
import Profile from './views/Profile';
import Auth from './views/Auth';
import AdminPanel from './views/AdminPanel';
import PendingApproval from './views/PendingApproval';
import { useSocket } from './hooks/useSocket';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

function App() {
  const [activeView, setActiveView] = useState('overview');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState('user');
  const [accountStatus, setAccountStatus] = useState('approved');
  const [isVerifying, setIsVerifying] = useState(true);
  const [showOfflineToast, setShowOfflineToast] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);
  const [actionError, setActionError] = useState(null);
  
  const { socket, dashboardState, videoAnalysisState, resetVideoAnalysis, emitAction, isConnected } = useSocket();

  React.useEffect(() => {
    if (!isConnected) {
      setShowOfflineToast(true);
      const timer = setTimeout(() => setShowOfflineToast(false), 4000);
      return () => clearTimeout(timer);
    } else {
      setShowOfflineToast(false);
    }
  }, [isConnected]);

  React.useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setIsVerifying(false);
      return;
    }
    fetch(`${API_BASE}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        setIsAuthenticated(true);
        setUserRole(data.role || 'user');
        setAccountStatus(data.account_status || 'approved');
        localStorage.setItem('user_role', data.role || 'user');
        localStorage.setItem('account_status', data.account_status || 'approved');
      } else {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_role');
        localStorage.removeItem('account_status');
      }
      setIsVerifying(false);
    })
    .catch(() => setIsVerifying(false));
  }, []);

  const handleStart = async () => {
    if (isActionPending) return;
    setIsActionPending(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/api/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Failed to start system');
        setTimeout(() => setActionError(null), 4000);
      }
    } catch (e) {
      setActionError('Network error — backend offline?');
      setTimeout(() => setActionError(null), 4000);
    } finally {
      setIsActionPending(false);
    }
  };

  const handleStop = async () => {
    if (isActionPending) return;
    setIsActionPending(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/api/stop`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Failed to stop system');
        setTimeout(() => setActionError(null), 4000);
      }
    } catch (e) {
      setActionError('Network error — backend offline?');
      setTimeout(() => setActionError(null), 4000);
    } finally {
      setIsActionPending(false);
    }
  };

  // renderView logic converted to persistent tabs to prevent unmounting and camera reconnections

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('account_status');
    setIsAuthenticated(false);
    setUserRole('user');
    setAccountStatus('approved');
  };

  if (isVerifying) return <div style={{ height: '100vh', background: '#0f172a' }}></div>;

  if (!isAuthenticated) {
    return <Auth onLogin={(token, role, status) => {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user_role', role || 'user');
      localStorage.setItem('account_status', status || 'approved');
      setUserRole(role || 'user');
      setAccountStatus(status || 'approved');
      setIsAuthenticated(true);
    }} />;
  }

  // Block non-approved users — show the waiting/rejected page instead
  if (accountStatus !== 'approved' && userRole !== 'admin') {
    return (
      <PendingApproval
        accountStatus={accountStatus}
        rejectionReason={localStorage.getItem('rejection_reason') || ''}
        onStatusChange={(s) => setAccountStatus(s)}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="dashboard-wrapper">
      <Sidebar activeView={activeView} setActiveView={setActiveView} onLogout={handleLogout} userRole={userRole} accountStatus={accountStatus} />
      
      <main className="main-view">
        <TopNav 
          systemStatus={dashboardState.system_status}
          onStart={handleStart}
          onStop={handleStop}
          isRunning={dashboardState.is_running}
          isActionPending={isActionPending}
          onLogout={handleLogout}
        />
        
        <div className="content-area">
          <div style={{ display: (!activeView || activeView === 'overview') ? 'block' : 'none', height: '100%' }}>
            <Overview dashboardState={dashboardState} onStart={handleStart} onSwitchAnalysis={() => setActiveView('video-analysis')} />
          </div>
          <div style={{ display: activeView === 'profile' ? 'block' : 'none', height: '100%' }}>
            <Profile />
          </div>
          <div style={{ display: activeView === 'monitoring' ? 'block' : 'none', height: '100%' }}>
            <Monitoring dashboardState={dashboardState} />
          </div>
          <div style={{ display: activeView === 'video-analysis' ? 'block' : 'none', height: '100%' }}>
            <VideoAnalysis videoAnalysisState={videoAnalysisState} resetVideoAnalysis={resetVideoAnalysis} emitAction={emitAction} />
          </div>
          <div style={{ display: activeView === 'archive' ? 'block' : 'none', height: '100%' }}>
            <Archive />
          </div>
          <div style={{ display: activeView === 'alerts' ? 'block' : 'none', height: '100%' }}>
            <Alerts socket={socket} />
          </div>
          <div style={{ display: activeView === 'tech-stack' ? 'block' : 'none', height: '100%' }}>
            <TechStack />
          </div>
          <div style={{ display: activeView === 'settings' ? 'block' : 'none', height: '100%' }}>
            <Settings />
          </div>
          <div style={{ display: activeView === 'support' ? 'block' : 'none', height: '100%' }}>
            <Support />
          </div>
          <div style={{ display: activeView === 'developer' ? 'block' : 'none', height: '100%' }}>
            <Developer />
          </div>
          <div style={{ display: activeView === 'admin' ? 'block' : 'none', height: '100%' }}>
            {userRole === 'admin' ? <AdminPanel /> : <Overview dashboardState={dashboardState} />}
          </div>
        </div>
      </main>

      {/* Toasts */}
      <div className="notification-area" style={{ 
        position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999,
        pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: '8px'
      }}>
        {/* Offline toast */}
        <div style={{ 
          background: 'var(--danger)', color: 'white', padding: '1rem', borderRadius: '8px', 
          boxShadow: 'var(--shadow-lg)', fontWeight: 700,
          transform: showOfflineToast ? 'translateY(0)' : 'translateY(150%)',
          opacity: showOfflineToast ? 1 : 0,
          transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          ⚠ OFFLINE: DISCONNECTED FROM INTELLIGENCE HUB
        </div>
        {/* Action error toast */}
        <div style={{ 
          background: '#92400e', color: 'white', padding: '1rem', borderRadius: '8px', 
          boxShadow: 'var(--shadow-lg)', fontWeight: 700,
          transform: actionError ? 'translateY(0)' : 'translateY(150%)',
          opacity: actionError ? 1 : 0,
          transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          ⚠ {actionError}
        </div>
      </div>
    </div>
  );
}

export default App;
