import React from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Container, Nav, Navbar } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext.jsx';

export default function PublicLayout() {
  const { user } = useAuth();
  const dash =
    user?.role === 'admin' ? '/admin' : user?.role === 'tnp_team' ? '/tnp' : user ? '/student' : '/login';
  return (
    <div>
      <Navbar expand="lg" className="public-nav py-3">
        <Container>
          <Navbar.Brand as={Link} to="/" className="d-flex align-items-center gap-2">
            <span className="brand-mark">TNP</span>
            <span>
              <strong>Training & Placement Cell</strong>
              <div className="small text-muted">IIIT Bhopal</div>
            </span>
          </Navbar.Brand>
          <Navbar.Toggle />
          <Navbar.Collapse>
            <Nav className="ms-auto align-items-lg-center gap-lg-2">
              <Nav.Link as={NavLink} to="/">Home</Nav.Link>
              <Nav.Link as={NavLink} to="/about">About TNP</Nav.Link>
              <Nav.Link as={NavLink} to="/companies">Companies</Nav.Link>
              <Nav.Link as={NavLink} to="/drives">Placement Drives</Nav.Link>
              <Nav.Link as={NavLink} to="/statistics">Statistics</Nav.Link>
              <Nav.Link as={NavLink} to="/team">TNP Team</Nav.Link>
              <Nav.Link as={NavLink} to="/joining-criteria">Joining criteria</Nav.Link>
              <Nav.Link as={NavLink} to="/contact">Contact</Nav.Link>
              <Link className="btn btn-primary rounded-pill px-3" to={dash}>
                {user ? 'Dashboard' : 'Sign in'}
              </Link>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Outlet />
      <footer className="py-4 text-center text-muted small">
        IIIT Bhopal T&P Cell · Placement figures sourced from the 15 April 2026 statistics document
      </footer>
    </div>
  );
}
