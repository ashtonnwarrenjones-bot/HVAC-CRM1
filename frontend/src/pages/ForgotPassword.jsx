import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';

export default function ForgotPassword() {
  const [email, setEmail]       = useState('');
  const [sent, setSent]         = useState(false);
  const [error, setError]       = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await axios.post('/api/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <style>{`
        .login-page { min-height:100vh; display:flex; flex-direction:row; background:#f8fafc; }
        .login-brand { flex:0 0 420px; background:linear-gradient(160deg,#1e3a5f 0%,#1d4ed8 100%); display:flex; align-items:center; justify-content:center; padding:48px 40px; }
        .login-mobile-header { display:none; background:linear-gradient(135deg,#1e3a5f 0%,#1d4ed8 100%); padding:28px 24px 24px; text-align:center; }
        .login-form-panel { flex:1; display:flex; align-items:center; justify-content:center; padding:40px 20px; }
        .login-card { background:#fff; border-radius:16px; padding:40px 36px; width:100%; max-width:400px; box-shadow:0 4px 24px rgba(0,0,0,.08); border:1px solid #e8ecf0; }
        .login-input { width:100%; padding:10px 12px; border:1.5px solid #e0e0e0; border-radius:8px; font-size:14px; outline:none; box-sizing:border-box; transition:border-color .2s; }
        .login-input:focus { border-color:#2563eb; }
        .login-btn { margin-top:4px; padding:12px; background:linear-gradient(135deg,#2563eb,#1d4ed8); color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; width:100%; transition:opacity .2s; }
        .login-btn:hover { opacity:0.92; }
        .login-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .login-error { background:#fef2f2; border:1px solid #fecaca; color:#dc2626; border-radius:8px; padding:10px 12px; font-size:13px; margin-bottom:12px; }
        @media (max-width:700px) {
          .login-brand { display:none; }
          .login-mobile-header { display:block; }
          .login-page { flex-direction:column; }
          .login-form-panel { padding:24px 16px; align-items:flex-start; }
          .login-card { padding:28px 20px; border-radius:12px; }
        }
      `}</style>

      <div className="login-page">
        <div className="login-brand">
          <div style={{ maxWidth: 320 }}>
            <Logo size={52} variant="white" subtitle={null} />
            <h1 style={{ fontSize: 36, fontWeight: 800, color: '#fff', margin: '16px 0 6px', letterSpacing: '-0.5px' }}>Conduit</h1>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, fontStyle: 'italic' }}>
              Linking you to your customers,<br />and your customers back to you.
            </p>
          </div>
        </div>

        <div className="login-mobile-header">
          <Logo size={40} variant="white" subtitle={null} />
          <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', marginTop: 10 }}>Conduit</div>
        </div>

        <div className="login-form-panel">
          <div className="login-card">
            {sent ? (
              <>
                <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 16 }}>📬</div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1a1f2e', margin: '0 0 8px', textAlign: 'center' }}>Check your email</h2>
                <p style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 1.6 }}>
                  If <strong>{email}</strong> is associated with an account, you'll receive a reset link within a minute.
                </p>
                <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', marginTop: 8 }}>
                  Check your spam folder if you don't see it.
                </p>
                <Link to="/login" style={{ display: 'block', marginTop: 24, textAlign: 'center', color: '#2563eb', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                  ← Back to sign in
                </Link>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1a1f2e', margin: '0 0 6px' }}>Forgot password?</h2>
                <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
                  Enter the email address on your account and we'll send a reset link.
                </p>

                {error && <div className="login-error">{error}</div>}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 5 }}>Email address</label>
                    <input
                      type="email"
                      className="login-input"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@yourcompany.com"
                      autoFocus
                      required
                    />
                  </div>
                  <button type="submit" className="login-btn" disabled={submitting}>
                    {submitting ? 'Sending…' : 'Send reset link'}
                  </button>
                </form>

                <div style={{ marginTop: 20, textAlign: 'center' }}>
                  <Link to="/login" style={{ color: '#6b7280', fontSize: 13, textDecoration: 'none' }}>
                    ← Back to sign in
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
