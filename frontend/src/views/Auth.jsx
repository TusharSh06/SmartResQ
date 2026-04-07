import React, { useState, useRef, useEffect } from 'react';
import './TechStack/TechStack.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

/* ── tiny shared styles ──────────────────────────────── */
const IS = {                // inputStyle
  width: '100%', padding: '0.75rem 1rem', borderRadius: '8px',
  background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#0F172A',
  outline: 'none', fontSize: '0.95rem', transition: 'all 0.2s ease',
  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
};
const ISF = { borderColor: '#3b82f6', boxShadow: '0 0 0 3px rgba(59,130,246,0.1)', background: '#ffffff' };
const labelStyle = { display: 'block', color: '#475569', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem' };

const Input = ({ label, type = 'text', value, onChange, required, min, extra = {}, suffix }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={type} value={value} onChange={onChange} required={required} min={min}
          style={{ ...IS, ...(focused ? ISF : {}), ...(suffix ? { paddingRight: '2.8rem' } : {}), ...extra }}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        />
        {suffix && <div style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)' }}>{suffix}</div>}
      </div>
    </div>
  );
};

/* ── OTP six-box component ───────────────────────────── */
const OtpBoxes = ({ value, onChange }) => {
  const refs = useRef([]);
  const digits = value.split('');

  const handleKey = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };
  const handleChange = (i, e) => {
    const v = e.target.value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = v;
    onChange(next.join(''));
    if (v && i < 5) refs.current[i + 1]?.focus();
  };
  const handlePaste = (e) => {
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(paste);
    refs.current[Math.min(paste.length, 5)]?.focus();
    e.preventDefault();
  };

  return (
    <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center' }}>
      {[0, 1, 2, 3, 4, 5].map(i => (
        <input
          key={i}
          ref={el => refs.current[i] = el}
          type="text" inputMode="numeric" maxLength={1}
          value={digits[i] || ''}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          style={{
            width: '48px', height: '56px', textAlign: 'center', fontSize: '1.6rem', fontWeight: 800,
            borderRadius: '10px', border: digits[i] ? '2px solid #2563EB' : '2px solid #E2E8F0',
            background: digits[i] ? '#EFF6FF' : '#F8FAFC', color: '#0F172A',
            outline: 'none', transition: 'all 0.15s', caretColor: 'transparent'
          }}
        />
      ))}
    </div>
  );
};

/* ── Step indicator ──────────────────────────────────── */
const StepBar = ({ step }) => {
  const steps = ['Details', 'Verify Email', 'Complete'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: '1.75rem' }}>
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: 800, transition: 'all 0.3s',
              background: step > i ? '#2563EB' : step === i ? '#EFF6FF' : '#F1F5F9',
              color: step > i ? 'white' : step === i ? '#2563EB' : '#94A3B8',
              border: step === i ? '2px solid #2563EB' : '2px solid transparent',
            }}>
              {step > i ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: step === i ? '#2563EB' : '#94A3B8', whiteSpace: 'nowrap' }}>{s}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: 2, marginBottom: '1.1rem', background: step > i ? '#2563EB' : '#E2E8F0', transition: 'background 0.3s', minWidth: 24 }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

/* ── Main Auth component ─────────────────────────────── */
const Auth = ({ onLogin }) => {
  const [isLogin, setIsLogin]           = useState(true);
  const [step, setStep]                  = useState(0);  // 0=form, 1=OTP, 2=done
  const [username, setUsername]          = useState('');
  const [password, setPassword]          = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName]        = useState('');
  const [lastName, setLastName]          = useState('');
  const [age, setAge]                    = useState('');
  const [showPassword, setShowPassword]  = useState(false);
  const [otp, setOtp]                    = useState('');
  const [error, setError]                = useState('');
  const [info, setInfo]                  = useState('');
  const [isLoading, setIsLoading]        = useState(false);
  const [resendTimer, setResendTimer]    = useState(0);

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setInterval(() => setResendTimer(p => p - 1), 1000);
    return () => clearInterval(t);
  }, [resendTimer]);

  const reset = () => { setStep(0); setOtp(''); setError(''); setInfo(''); };

  /* ── Step 0 → send OTP ──────────────────────────── */
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) return setError('Passwords do not match.');
    if (parseInt(age, 10) < 16) return setError('You must be at least 16 years old.');
    if (!username.includes('@')) return setError('Please enter a valid email address.');

    setIsLoading(true); setError(''); setInfo('');
    try {
      const res  = await fetch(`${API_BASE}/api/auth/send-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username.trim().toLowerCase() })
      });
      const data = await res.json();
      if (data.success) {
        setStep(1); setResendTimer(60);
        setInfo(`A 6-digit verification code was sent to ${username}`);
      } else {
        setError(data.error || 'Failed to send OTP');
      }
    } catch { setError('Network error. Is the backend running?'); }
    finally { setIsLoading(false); }
  };

  /* ── Step 1 → verify OTP ────────────────────────── */
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) return setError('Please enter the complete 6-digit code.');
    setIsLoading(true); setError('');
    try {
      const res  = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username.trim().toLowerCase(), otp })
      });
      const data = await res.json();
      if (data.success) {
        await handleCompleteSignup();
      } else {
        setError(data.error || 'Invalid OTP');
      }
    } catch { setError('Network error.'); }
    finally { setIsLoading(false); }
  };

  /* ── Final signup after OTP OK ──────────────────── */
  const handleCompleteSignup = async () => {
    const res  = await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.trim().toLowerCase(),
        password, first_name: firstName, last_name: lastName,
        age: parseInt(age, 10)
      })
    });
    const data = await res.json();
    if (data.success) {
      setStep(2);
      setTimeout(() => { setIsLogin(true); reset(); }, 2000);
    } else {
      setError(data.error || 'Account creation failed');
    }
  };

  /* ── Login ──────────────────────────────────────── */
  const handleLogin = async (e) => {
    e.preventDefault(); setError(''); setIsLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password })
      });
      const data = await res.json();
      if (data.success) onLogin(data.token, data.role, data.account_status || 'approved');
      else setError(data.error || 'Authentication failed');
    } catch { setError('Network error. Is the backend running?'); }
    finally { setIsLoading(false); }
  };

  /* ── Resend OTP ─────────────────────────────────── */
  const handleResend = async () => {
    if (resendTimer > 0) return;
    setIsLoading(true); setError(''); setInfo('');
    try {
      const res  = await fetch(`${API_BASE}/api/auth/send-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username.trim().toLowerCase() })
      });
      const data = await res.json();
      if (data.success) { setResendTimer(60); setInfo('New OTP sent!'); setOtp(''); }
      else setError(data.error);
    } catch { setError('Network error.'); }
    finally { setIsLoading(false); }
  };

  /* ── EyeToggle icon ─────────────────────────────── */
  const EyeBtn = () => (
    <button type="button" onClick={() => setShowPassword(p => !p)}
      style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '0.2rem', display: 'flex' }}>
      {showPassword
        ? <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/></svg>
        : <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      }
    </button>
  );

  const cardWidth = isLogin ? '400px' : '480px';

  return (
    <div style={{ height: '100vh', width: '100vw', overflowY: 'auto', background: '#F8FAFC', position: 'relative' }}>
      <div className="dev-bg-grid" style={{
        backgroundImage: 'linear-gradient(to right,rgba(37,99,235,0.06) 1px,transparent 1px),linear-gradient(to bottom,rgba(37,99,235,0.06) 1px,transparent 1px)',
        backgroundSize: '50px 50px', position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none'
      }} />

      <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem' }}>
        <div style={{
          position: 'relative', zIndex: 10, width: '100%', maxWidth: cardWidth,
          background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '2.5rem',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', transition: 'max-width 0.3s ease'
        }}>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '1rem', marginTop: '-1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 320, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/smartlogo.png" style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="Smart Resq" />
              </div>
            </div>
            <p style={{ color: '#64748B', fontSize: '0.9rem', marginTop: '-0.5rem', fontWeight: 500 }}>Security Gateway</p>
          </div>

          {/* ── LOGIN ── */}
          {isLogin && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Input label="Email / Username" value={username} onChange={e => setUsername(e.target.value)} required />
              <Input label="Password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required suffix={<EyeBtn />} />
              {error && <div style={{ padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 500, background: '#FEF2F2', color: '#DC2626', border: '1px solid #fecaca' }}>{error}</div>}
              <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '0.875rem', borderRadius: '8px', background: '#2563EB', color: 'white', fontWeight: 600, fontSize: '0.95rem', border: 'none', cursor: isLoading ? 'wait' : 'pointer', marginTop: '0.5rem', boxShadow: '0 4px 6px -1px rgba(37,99,235,0.2)' }}>
                {isLoading ? 'Verifying...' : 'Access Platform'}
              </button>
            </form>
          )}

          {/* ── SIGNUP: STEP 0 — Form ── */}
          {!isLogin && step === 0 && (
            <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <Input label="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} required />
                <Input label="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} required />
              </div>
              <Input label="Age" type="number" value={age} onChange={e => setAge(e.target.value)} required min="16" />
              <Input label="Email Address" type="email" value={username} onChange={e => setUsername(e.target.value)} required />
              <Input label="Password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required suffix={<EyeBtn />} />
              <Input label="Confirm Password" type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
              {error && <div style={{ padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 500, background: '#FEF2F2', color: '#DC2626', border: '1px solid #fecaca' }}>{error}</div>}
              <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '0.875rem', borderRadius: '8px', background: '#2563EB', color: 'white', fontWeight: 600, fontSize: '0.95rem', border: 'none', cursor: isLoading ? 'wait' : 'pointer', marginTop: '0.5rem', boxShadow: '0 4px 6px -1px rgba(37,99,235,0.2)' }}>
                {isLoading ? 'Sending OTP...' : 'Send Verification Code →'}
              </button>
            </form>
          )}

          {/* ── SIGNUP: STEP 1 — OTP ── */}
          {!isLogin && step === 1 && (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <StepBar step={1} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📧</div>
                <p style={{ color: '#475569', fontSize: '0.9rem', margin: 0 }}>
                  We sent a 6-digit code to<br />
                  <strong style={{ color: '#0F172A' }}>{username}</strong>
                </p>
              </div>

              <OtpBoxes value={otp} onChange={setOtp} />

              {info && <div style={{ padding: '0.7rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 500, background: '#F0FDF4', color: '#16A34A', border: '1px solid #bbf7d0', textAlign: 'center' }}>{info}</div>}
              {error && <div style={{ padding: '0.7rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 500, background: '#FEF2F2', color: '#DC2626', border: '1px solid #fecaca', textAlign: 'center' }}>{error}</div>}

              <button type="submit" disabled={isLoading || otp.length !== 6}
                style={{ width: '100%', padding: '0.875rem', borderRadius: '8px', background: otp.length === 6 ? '#2563EB' : '#94A3B8', color: 'white', fontWeight: 600, fontSize: '0.95rem', border: 'none', cursor: otp.length === 6 ? 'pointer' : 'not-allowed', transition: 'background 0.2s', boxShadow: otp.length === 6 ? '0 4px 6px -1px rgba(37,99,235,0.2)' : 'none' }}>
                {isLoading ? 'Verifying...' : 'Confirm & Create Account'}
              </button>

              <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#64748B' }}>
                Didn't receive it?{' '}
                <button type="button" onClick={handleResend} disabled={resendTimer > 0}
                  style={{ background: 'none', border: 'none', color: resendTimer > 0 ? '#94A3B8' : '#2563EB', cursor: resendTimer > 0 ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                </button>
              </div>

              <button type="button" onClick={reset} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'center' }}>
                ← Back to form
              </button>
            </form>
          )}

          {/* ── SIGNUP: STEP 2 — Success ── */}
          {!isLogin && step === 2 && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <StepBar step={3} />
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
              <h3 style={{ color: '#16A34A', margin: '0 0 0.5rem' }}>Account Created!</h3>
              <p style={{ color: '#64748B', fontSize: '0.9rem' }}>Redirecting you to login…</p>
            </div>
          )}

          {/* ── Toggle ── */}
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <button type="button" onClick={() => { setIsLogin(!isLogin); reset(); }}
              style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 600 }}
              onMouseOver={e => e.target.style.textDecoration = 'underline'}
              onMouseOut={e => e.target.style.textDecoration = 'none'}>
              {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Log In'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Auth;
