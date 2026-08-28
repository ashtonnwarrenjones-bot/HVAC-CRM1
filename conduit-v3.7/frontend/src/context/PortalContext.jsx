import React, { createContext, useContext, useState } from 'react';

const PortalContext = createContext(null);

export function PortalProvider({ children }) {
  const [portalToken, setPortalToken] = useState(() => sessionStorage.getItem('portal_token'));
  const [portalContact, setPortalContact] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('portal_contact')); } catch { return null; }
  });
  const [portalCompany, setPortalCompany] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('portal_company')); } catch { return null; }
  });

  function portalLogin(token, contact, company) {
    sessionStorage.setItem('portal_token', token);
    sessionStorage.setItem('portal_contact', JSON.stringify(contact));
    sessionStorage.setItem('portal_company', JSON.stringify(company));
    setPortalToken(token);
    setPortalContact(contact);
    setPortalCompany(company);
  }

  function portalLogout() {
    sessionStorage.removeItem('portal_token');
    sessionStorage.removeItem('portal_contact');
    sessionStorage.removeItem('portal_company');
    setPortalToken(null);
    setPortalContact(null);
    setPortalCompany(null);
  }

  // Authenticated fetch helper for portal API calls
  async function portalFetch(path, options = {}) {
    const res = await fetch(`/api/portal${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${portalToken}`,
        ...options.headers,
      },
    });
    if (res.status === 401) { portalLogout(); throw new Error('Session expired'); }
    return res;
  }

  return (
    <PortalContext.Provider value={{
      portalToken, portalContact, portalCompany,
      portalLogin, portalLogout, portalFetch,
      isAuthenticated: !!portalToken,
    }}>
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  return useContext(PortalContext);
}
