import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

export default function Login() {
  const { login } = useAuth();
  const [mode, setMode] = useState('loading');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    axios.get('/api/auth/status')
      .then(r => setMode(r.data.needsSetup ? 'setup' : 'login'))
      .catch(() => setMode('login'));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (mode === 'setup' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      const endpoint = mode === 'setup' ? '/api/auth/setup' : '/api/auth/login';
      const { data } = await axios.post(endpoint, { username, password });
      login(data.token, data.username);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === 'loading') {
    return (
      <div className="login-page">
        <div className="login-card">
          <p style={{ color: '#888', textAlign: 'center' }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          flex-direction: row;
          background: #f8fafc;
        }
        .login-brand {
          flex: 0 0 420px;
          background: linear-gradient(160deg, #1e3a5f 0%, #1d4ed8 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 40px;
        }
        .login-mobile-header {
          display: none;
          background: linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%);
          padding: 28px 24px 24px;
          text-align: center;
        }
        .login-form-panel {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
        }
        .login-card {
          background: #fff;
          border-radius: 16px;
          padding: 40px 36px;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08);
          border: 1px solid #e8ecf0;
        }
        .login-input {
          width: 100%;
          padding: 10px 12px;
          border: 1.5px solid #e0e0e0;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          box-sizing: border-box;
          transition: border-color .2s;
        }
        .login-input:focus { border-color: #2563eb; }
        .login-btn {
          margin-top: 4px;
          padding: 12px;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          width: 100%;
          transition: opacity .2s;
        }
        .login-btn:hover { opacity: 0.92; }
        .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .login-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 13px;
          margin-bottom: 12px;
        }
        .feature-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #60a5fa; flex-shrink: 0;
          display: inline-block; margin-right: 10px;
        }
        @media (max-width: 700px) {
          .login-brand { display: none; }
          .login-mobile-header { display: block; }
          .login-page { flex-direction: column; }
          .login-form-panel { padding: 24px 16px; align-items: flex-start; }
          .login-card {
            padding: 28px 20px;
            border-radius: 12px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          }
        }
      `}</style>

      <div className="login-page">

        {/* Desktop brand panel */}
        <div className="login-brand">
          <div style={{ maxWidth: 320 }}>
            <Logo size={52} variant="white" subtitle={null} />
            <h1 style={{ fontSize: 36, fontWeight: 800, color: '#fff', margin: '16px 0 6px', letterSpacing: '-0.5px' }}>
              Conduit
            </h1>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, margin: '0 0 32px', fontStyle: 'italic' }}>
              Linking you to your customers,<br />and your customers back to you.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['Proposals & e-signatures', 'Job scheduling & dispatch', 'Pipeline management', 'Customer portal'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
                  <span className="feature-dot" />
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile top header (replaces brand panel) */}
        <div className="login-mobile-header">
          <Logo size={40} variant="white" subtitle={null} />
          <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', marginTop: 10 }}>Conduit</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontStyle: 'italic' }}>
            Linking you to your customers
          </div>
        </div>

        {/* Form panel */}
        <div className="login-form-panel">
          <div className="login-card">
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1a1f2e', margin: '0 0 6px' }}>
              {mode === 'setup' ? 'Create your account' : 'Welcome back'}
            </h2>
            <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
              {mode === 'setup' ? 'Set up your admin account to get started' : 'Sign in to your Conduit account'}
            </p>

            {error && <div className="login-error">{error}</div>}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 5 }}>Username</label>
                <input className="login-input" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username" autoFocus required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 5 }}>Password</label>
                <input type="password" className="login-input" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" required />
              </div>
              {mode === 'setup' && (
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 5 }}>Confirm Password</label>
                  <input type="password" className="login-input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm password" required />
                </div>
              )}
              <button type="submit" className="login-btn" disabled={submitting}>
                {submitting ? 'Please wait…' : mode === 'setup' ? 'Create Account & Sign In' : 'Sign In'}
              </button>
            </form>

            {mode === 'setup' && (
              <p style={{ marginTop: 16, fontSize: 12, color: '#999', textAlign: 'center' }}>
                This is a one-time setup. Your credentials will be stored securely.
              </p>
            )}

            {mode === 'login' && (
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <Link to="/forgot-password" style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
                  Forgot password?
                </Link>
              </div>
            )}

            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: '#bbb', marginBottom: 4 }}>Demo access</p>
              <p style={{ fontSize: 12, color: '#999' }}>
                Username: <strong style={{ color: '#555' }}>demo</strong> · Password: <strong style={{ color: '#555' }}>demo123</strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
