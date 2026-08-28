import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

export default function Login() {
  const { login } = useAuth();
  const [mode, setMode] = useState('loading'); // loading | login | setup
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
      <div style={styles.page}>
        <div style={styles.card}>
          <p style={{ color: '#888', textAlign: 'center' }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>

      {/* Left brand panel */}
      <div style={styles.brand}>
        <div style={styles.brandInner}>
          <Logo size={52} variant="white" subtitle={null} />
          <h1 style={styles.brandName}>Conduit</h1>
          <p style={styles.tagline}>
            Linking you to your customers,<br />and your customers back to you.
          </p>
          <div style={styles.featureList}>
            {['Proposals & e-signatures', 'Job scheduling & dispatch', 'Pipeline management', 'Customer portal'].map(f => (
              <div key={f} style={styles.featureItem}>
                <span style={styles.featureDot} />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right login panel */}
      <div style={styles.formPanel}>
        <div style={styles.card}>
          <h2 style={styles.title}>
            {mode === 'setup' ? 'Create your account' : 'Welcome back'}
          </h2>
          <p style={styles.sub}>
            {mode === 'setup'
              ? 'Set up your admin account to get started'
              : 'Sign in to your Conduit account'}
          </p>

          {error && <div style={styles.error}>{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={styles.label}>Username</label>
              <input
                style={styles.input}
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                autoFocus
                required
              />
            </div>
            <div>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                style={styles.input}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>
            {mode === 'setup' && (
              <div>
                <label style={styles.label}>Confirm Password</label>
                <input
                  type="password"
                  style={styles.input}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  required
                />
              </div>
            )}
            <button type="submit" style={styles.btn} disabled={submitting}>
              {submitting ? 'Please wait…' : mode === 'setup' ? 'Create Account & Sign In' : 'Sign In'}
            </button>
          </form>

          {mode === 'setup' && (
            <p style={{ marginTop: 16, fontSize: 12, color: '#999', textAlign: 'center' }}>
              This is a one-time setup. Your credentials will be stored securely.
            </p>
          )}

          <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
            <p style={{ fontSize: 11, color: '#bbb', marginBottom: 4 }}>Demo access</p>
            <p style={{ fontSize: 12, color: '#999' }}>
              Username: <strong style={{ color: '#555' }}>demo</strong> · Password: <strong style={{ color: '#555' }}>demo123</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'row',
    background: '#f8fafc',
  },
  brand: {
    flex: '0 0 420px',
    background: 'linear-gradient(160deg, #1e3a5f 0%, #1d4ed8 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 40px',
    '@media (max-width: 700px)': { display: 'none' },
  },
  brandInner: {
    maxWidth: 320,
  },
  brandName: {
    fontSize: 36,
    fontWeight: 800,
    color: '#fff',
    margin: '16px 0 6px',
    letterSpacing: '-0.5px',
  },
  tagline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 1.6,
    margin: '0 0 32px',
    fontStyle: 'italic',
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#60a5fa',
    flexShrink: 0,
  },
  formPanel: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    border: '1px solid #e8ecf0',
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: '#1a1f2e',
    margin: '0 0 6px',
  },
  sub: {
    fontSize: 13,
    color: '#888',
    marginBottom: 24,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#444',
    marginBottom: 5,
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1.5px solid #e0e0e0',
    borderRadius: 8,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color .2s',
  },
  btn: {
    marginTop: 4,
    padding: '12px',
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity .2s',
    width: '100%',
  },
  error: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
    marginBottom: 12,
  },
};
