import React from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const MENUS = {
  student: [
    ['/student', 'Dashboard', 'bi-house'],
    ['/student/drives', 'Placement Drives', 'bi-briefcase'],
    ['/student/calendar', 'Drive calendar', 'bi-calendar3'],
    ['/student/applications', 'My Applications', 'bi-journal-check'],
    ['/student/resume', 'Resume', 'bi-file-earmark-pdf'],
    ['/student/profile', 'Profile', 'bi-person'],
    ['/student/academics', 'Academics', 'bi-mortarboard'],
    ['/student/notifications', 'Notifications', 'bi-bell'],
    ['/student/assistant', 'AI Assistant', 'bi-stars'],
    ['/student/resume-analyzer', 'Resume analyzer', 'bi-file-earmark-check'],
    ['/team-public', 'TNP Team', 'bi-people'],
    ['/statistics', 'Statistics', 'bi-graph-up'],
  ],
  tnp_team: [
    ['/tnp', 'Dashboard', 'bi-house'],
    ['/tnp/drives', 'Assigned Drives', 'bi-briefcase'],
    ['/tnp/applications', 'Application Review', 'bi-ui-checks'],
    ['/tnp/students', 'Student Records', 'bi-people'],
    ['/tnp/placements', 'Placement Updates', 'bi-graph-up'],
    ['/tnp/announcements', 'Announcements', 'bi-megaphone'],
    ['/tnp/profile', 'Team Profile', 'bi-person-badge'],
  ],
  admin: [
    ['/admin', 'Dashboard', 'bi-speedometer2'],
    ['/admin/students', 'Students', 'bi-people'],
    ['/admin/team', 'TNP Team', 'bi-person-badge'],
    ['/admin/companies', 'Companies', 'bi-buildings'],
    ['/admin/drives', 'Drives', 'bi-briefcase'],
    ['/admin/applications', 'Applications', 'bi-ui-checks'],
    ['/admin/statistics', 'Statistics', 'bi-graph-up'],
    ['/admin/criteria', 'Joining Criteria', 'bi-list-check'],
    ['/admin/announcements', 'Announcements', 'bi-megaphone'],
    ['/admin/recruiters', 'Recruiters', 'bi-person-lines-fill'],
    ['/admin/roles', 'Roles', 'bi-shield-lock'],
    ['/admin/import-export', 'Import / Export', 'bi-arrow-left-right'],
    ['/admin/audit', 'Audit Logs', 'bi-journal-text'],
    ['/admin/health', 'System Health', 'bi-heart-pulse'],
  ],
};

export default function AppLayout({ role }) {
  const { user, profile, logout } = useAuth();
  const items = MENUS[role] || [];
  const photoUrl = profile?.profileImage?.url;
  const enrollmentNo = profile?.enrollmentNumber;

  return (
    <div className="app-shell">
      <aside className="sidebar d-flex flex-column">
        <Link to="/" className="d-flex align-items-center gap-2 px-2 mb-3 text-white text-decoration-none">
          <span className="brand-mark">TNP</span>
          <div>
            <div className="fw-bold">IIIT Bhopal</div>
            <div className="small opacity-75">Training &amp; Placement</div>
          </div>
        </Link>

        {/* Student profile card in sidebar */}
        {role === 'student' && (
          <div className="text-center mb-3 px-2 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
            {/* Photo on top */}
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={user?.name || 'Photo'}
                className="rounded-circle border border-2 border-light mb-2"
                style={{ width: 68, height: 68, objectFit: 'cover' }}
              />
            ) : (
              <div
                className="rounded-circle border border-2 border-light d-inline-flex align-items-center justify-content-center mb-2"
                style={{ width: 68, height: 68, background: 'rgba(255,255,255,0.12)', fontSize: 26 }}
              >
                <i className="bi bi-person-fill text-white" />
              </div>
            )}
            {/* Enrollment number in middle */}
            {enrollmentNo && (
              <div className="small fw-semibold mb-1" style={{ color: 'rgba(255,255,255,0.6)', letterSpacing: '0.04em' }}>
                {enrollmentNo}
              </div>
            )}
            {/* Full name at bottom */}
            <div className="fw-bold text-white" style={{ fontSize: '0.82rem', lineHeight: 1.3 }}>
              {user?.name || '—'}
            </div>
          </div>
        )}

        <nav className="d-grid gap-1 flex-grow-1">
          {items.map(([to, label, icon]) => (
            <NavLink key={to} to={to} end={to.split('/').length <= 2}>
              <i className={`bi ${icon}`} /> {label}
            </NavLink>
          ))}
          {role === 'tnp_team' && user?.role === 'student' && (
            <NavLink to="/student">
              <i className="bi bi-mortarboard" /> Student portal
            </NavLink>
          )}
          {role === 'student' && user?.tnpTeam && (
            <NavLink to="/tnp">
              <i className="bi bi-person-badge" /> TNP team
            </NavLink>
          )}
        </nav>
        <button className="btn btn-outline-light btn-sm mt-3" onClick={logout}>
          Logout
        </button>
      </aside>
      <div className="main-col">
        <div className="topbar px-4 py-3 d-flex justify-content-between align-items-center">
          <div className="text-muted small text-uppercase">{role.replace('_', ' ')}</div>
          <div className="fw-semibold">{user?.name}</div>
        </div>
        <div className="p-4">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
