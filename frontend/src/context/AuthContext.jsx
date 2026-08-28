import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

function parseRole(token) {
  if (!token) return 'admin';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role || 'admin';
  } catch { return 'admin'; }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('crm_token'));
  const [username, setUsername] = useState(() => localStorage.getItem('crm_user'));
  const [role, setRole] = useState(() => parseRole(localStorage.getItem('crm_token')));
  const [loading, setLoading] = useState(false);

  const isDemo = role === 'demo';

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  useEffect(() => {
    const id = axios.interceptors.response.use(
      res => res,
      err => {
        if (err.response?.status === 401 && token) logout();
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, [token]);

  function login(newToken, newUsername) {
    localStorage.setItem('crm_token', newToken);
    localStorage.setItem('crm_user', newUsername);
    setToken(newToken);
    setUsername(newUsername);
    setRole(parseRole(newToken));
  }

  function logout() {
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    setToken(null);
    setUsername(null);
    setRole('admin');
  }

  return (
    <AuthContext.Provider value={{ token, username, role, isDemo, login, logout, loading, setLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
