import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

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
      <div style={styles.card}>
        <div style={styles.logo}>🔧</div>
        <h1 style={styles.title}>HVAC CRM</h1>
        <p style={styles.sub}>
          {mode === 'setup' ? 'Create your admin account to get started' : 'Sign in to continue'}
        </p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1a1f2e 0%, #0f1520 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
  },
  logo: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    textAlign: 'center',
    margin: '0 0 4px',
    color: '#1a1f2e',
  },
  sub: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
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
