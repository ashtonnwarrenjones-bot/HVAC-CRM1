import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ChevronRight, ChevronLeft, Play } from 'lucide-react';

// ─── Tour steps ───────────────────────────────────────────────────────────────

const STEPS = [
  {
    route: '/',
    title: 'Dashboard',
    icon: '📊',
    navTarget: 'a[href="/"]',
    contentTarget: '[data-tour="dashboard"]',
    desc: 'Your command center. At a glance you can see open jobs, revenue trends, proposals sent, active contracts, and upcoming work. Every widget is customizable — add, remove, resize, and rearrange them to match how your team works.',
  },
  {
    route: '/dispatch',
    title: 'Dispatch Board',
    icon: '🚚',
    navTarget: 'a[href="/dispatch"]',
    contentTarget: '[data-tour="dispatch"]',
    desc: 'See every job in one place, organized by status: Scheduled → In Progress → Completed. Drag jobs between columns to update their status. Assign or reassign technicians from here. Color coding shows which tech is on each job.',
  },
  {
    route: '/schedule',
    title: 'Schedule',
    icon: '📅',
    navTarget: 'a[href="/schedule"]',
    contentTarget: '[data-tour="schedule"]',
    desc: 'A calendar view of all scheduled jobs. Switch between day, week, and month views. See which techs are booked and spot open slots quickly. Jobs appear as color-coded blocks on the calendar.',
  },
  {
    route: '/pipeline',
    title: 'Sales Pipeline',
    icon: '🎯',
    navTarget: 'a[href="/pipeline"]',
    contentTarget: '[data-tour="pipeline"]',
    desc: 'Track every deal from first contact to closed contract. Drag deals between stages as they progress. See the total value in each stage and which deals need attention. Filter by sales rep or time period.',
  },
  {
    route: '/companies',
    title: 'Companies',
    icon: '🏢',
    navTarget: 'a[href="/companies"]',
    contentTarget: '[data-tour="companies"]',
    desc: 'All your customer accounts in one place — commercial, residential, and prospects. Each company record holds contact info, job history, proposals, invoices, equipment, and notes. Filter and search to find any account instantly.',
  },
  {
    route: '/contacts',
    title: 'Contacts',
    icon: '👥',
    navTarget: 'a[href="/contacts"]',
    contentTarget: '[data-tour="contacts"]',
    desc: 'Individual people at each company. Keep track of property managers, facility directors, decision makers, and billing contacts. Each contact links back to their company and all their history.',
  },
  {
    route: '/proposals',
    title: 'Proposals',
    icon: '📄',
    navTarget: 'a[href="/proposals"]',
    contentTarget: '[data-tour="proposals"]',
    desc: 'Create professional proposals with line items, labor, and materials. Send them to customers as a link they can open on any device and sign digitally. Track status: Draft → Sent → Viewed → Signed. Win rate is tracked automatically.',
  },
  {
    route: '/invoices',
    title: 'Invoices',
    icon: '🧾',
    navTarget: 'a[href="/invoices"]',
    contentTarget: '[data-tour="invoices"]',
    desc: 'Generate invoices from completed jobs or manually. Track what\'s paid, what\'s outstanding, and what\'s overdue. Send invoices directly to customers. Revenue totals roll up to the dashboard automatically.',
  },
  {
    route: '/memberships',
    title: 'Memberships',
    icon: '🛡️',
    navTarget: 'a[href="/memberships"]',
    contentTarget: '[data-tour="memberships"]',
    desc: 'Manage service contracts and maintenance agreements. Track which customers have active contracts, when they\'re due for service, and what\'s included. Recurring revenue from memberships is tracked separately on the dashboard.',
  },
  {
    route: '/pricebook',
    title: 'Pricebook',
    icon: '📋',
    navTarget: 'a[href="/pricebook"]',
    contentTarget: '[data-tour="pricebook"]',
    desc: 'Your catalog of parts, labor rates, and services with set prices. When building proposals and invoices, pull items directly from the pricebook so pricing is always consistent. Link items to supplier catalogs to track your cost vs sell price.',
  },
  {
    route: '/vendors',
    title: 'Vendors & Suppliers',
    icon: '🚛',
    navTarget: 'a[href="/vendors"]',
    contentTarget: '[data-tour="vendors"]',
    desc: 'Manage all your suppliers in one place. Store contact info, parts counter phone numbers, and the brands each supplier carries. When a tech sends you equipment info, one click drafts a quote request email to the right supplier automatically. Import supplier price lists by CSV.',
  },
  {
    route: '/analytics',
    title: 'Analytics',
    icon: '📈',
    navTarget: 'a[href="/analytics"]',
    contentTarget: '[data-tour="analytics"]',
    desc: 'Deep dive into business performance. Revenue by month, job completion rates, proposal win rates, top customers, technician productivity, and more. Filter by date range to compare periods. Export reports for presentations.',
  },
  {
    route: '/settings',
    title: 'Settings',
    icon: '⚙️',
    navTarget: 'a[href="/settings"]',
    contentTarget: '[data-tour="settings"]',
    desc: 'Configure your CRM: company info, branding for proposals, user accounts and roles, notification preferences, integrations (ComputerEase, QuickBooks), and more. Admins control what each user role can see and do.',
  },
];

// ─── Spotlight helper ─────────────────────────────────────────────────────────

function getRect(selector) {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

// ─── GuidedTour ───────────────────────────────────────────────────────────────

export default function GuidedTour({ onClose }) {
  const navigate    = useNavigate();
  const location    = useLocation();
  const [step, setStep]   = useState(0);
  const [rect, setRect]   = useState(null);
  const [phase, setPhase] = useState('nav');   // 'nav' | 'content'
  const [visible, setVisible] = useState(false);
  const timerRef = useRef();

  const current = STEPS[step];

  // Navigate to the step's route when step changes
  useEffect(() => {
    navigate(current.route);
  }, [step]);

  // After navigation, wait for render then position spotlight
  useEffect(() => {
    clearTimeout(timerRef.current);
    setVisible(false);

    timerRef.current = setTimeout(() => {
      // First: highlight the sidebar nav item
      setPhase('nav');
      const navRect = getRect(current.navTarget);
      if (navRect) {
        setRect(navRect);
        setVisible(true);
      }

      // After 900ms: shift spotlight to main content area
      timerRef.current = setTimeout(() => {
        setPhase('content');
        const cRect =
          getRect(current.contentTarget) ||
          getRect('[data-tour="main"]') ||
          getRect('main');
        if (cRect) {
          setRect(cRect);
          setVisible(true);
        }
      }, 900);
    }, 400);

    return () => clearTimeout(timerRef.current);
  }, [step, location.pathname]);

  const prev = () => step > 0 && setStep(s => s - 1);
  const next = () => step < STEPS.length - 1 ? setStep(s => s + 1) : onClose();

  const pad = 8;
  const spotStyle = rect ? {
    position: 'fixed',
    top:    rect.top    - pad,
    left:   rect.left   - pad,
    width:  rect.width  + pad * 2,
    height: rect.height + pad * 2,
    borderRadius: 10,
    boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
    border: '2px solid rgba(255,255,255,0.6)',
    zIndex: 9900,
    pointerEvents: 'none',
    transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
  } : null;

  // Popover position: below spotlight if it's in top 60% of screen, else above
  const popoverOnTop = rect && (rect.top + rect.height / 2) > window.innerHeight * 0.55;
  const popoverStyle = rect ? {
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    ...(popoverOnTop
      ? { bottom: window.innerHeight - rect.top + pad + 12 }
      : { top: rect.top + rect.height + pad + 12 }),
    zIndex: 9901,
    width: 'min(480px, 90vw)',
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
    overflow: 'hidden',
  } : null;

  if (!visible || !rect) return null;

  return (
    <>
      {/* Spotlight box */}
      <div style={spotStyle} />

      {/* Popover card */}
      <div style={popoverStyle}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #1e40af, #3b82f6)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>{current.icon}</span>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Step {step + 1} of {STEPS.length}
              </div>
              <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginTop: 1 }}>{current.title}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', padding: '6px 8px', display: 'flex', alignItems: 'center' }}>
            <X size={16}/>
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: '#e2e8f0' }}>
          <div style={{ height: '100%', background: '#3b82f6', width: `${((step + 1) / STEPS.length) * 100}%`, transition: 'width 0.35s ease' }} />
        </div>

        {/* Description */}
        <div style={{ padding: '18px 20px' }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#374151' }}>{current.desc}</p>
        </div>

        {/* Footer nav */}
        <div style={{ padding: '12px 20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 13, cursor: 'pointer', padding: '4px 0' }}>
            Skip tour
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button onClick={prev} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ChevronLeft size={14}/> Back
              </button>
            )}
            <button onClick={next} style={{ background: '#2563eb', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 5 }}>
              {step === STEPS.length - 1 ? 'Finish' : 'Next'} <ChevronRight size={14}/>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Tour launcher button ─────────────────────────────────────────────────────

export function TourLaunchButton({ onClick }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#fff', cursor: 'pointer', padding: '7px 13px', fontSize: 13, fontWeight: 600, width: '100%' }}>
      <Play size={13} fill="#fff"/> Take the Tour
    </button>
  );
}
