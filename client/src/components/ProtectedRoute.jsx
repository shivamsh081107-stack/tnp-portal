import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function LoadingSkeleton() {
  return (
    <div className="app-shell">
      <aside className="sidebar d-flex flex-column">
        <div className="d-flex align-items-center gap-2 px-2 mb-4">
          <div style={{ width: 36, height: 36, borderRadius: 6, background: 'rgba(255,255,255,0.15)' }} />
          <div>
            <div style={{ width: 90, height: 12, borderRadius: 4, background: 'rgba(255,255,255,0.2)', marginBottom: 4 }} />
            <div style={{ width: 60, height: 10, borderRadius: 4, background: 'rgba(255,255,255,0.12)' }} />
          </div>
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.08)', marginBottom: 6 }} />
        ))}
      </aside>
      <div className="main-col">
        <div className="topbar px-4 py-3" style={{ height: 56 }} />
        <div className="p-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="mb-3" style={{ height: 80, borderRadius: 12, background: '#f0f2f5', animation: 'pulse 1.4s ease-in-out infinite' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingSkeleton />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role) && !(roles.includes('tnp_team') && user.tnpTeam)) return <Navigate to="/" replace />;
  return children || <Outlet />;
}

