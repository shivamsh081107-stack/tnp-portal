import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Container, Row, Col, Card } from 'react-bootstrap';
import api from '../../services/api';

export default function Home() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    async function load(attempt) {
      try {
        const res = await api.get('/home');
        if (cancelled) return;
        setData(res.data);
        setError('');
      } catch {
        if (cancelled) return;
        if (attempt < 2) {
          setTimeout(() => load(attempt + 1), 800);
          return;
        }
        setError('Unable to load portal summary. Start MongoDB and seed data.');
      }
    }
    load(1);
    return () => {
      cancelled = true;
    };
  }, []);
  const highest = data?.highest?.[0];
  const second = data?.highest?.[1];
  const avg = data?.averages?.[0];
  return (
    <Container className="py-4">
      {error && <div className="alert alert-warning">{error}</div>}
      <div className="hero p-5 mb-4">
        <Row className="align-items-center">
          <Col lg={7}>
            <div className="badge bg-white text-primary mb-3">TNP · IIIT Bhopal</div>
            <h1 className="display-5 fw-bold">Turning potential into progress</h1>
            <p className="lead opacity-75">
              Training and Placement Cell, Indian Institute of Information Technology Bhopal — connecting students with
              campus opportunities.
            </p>
            <Link to="/drives" className="btn btn-light me-2">
              Explore opportunities
            </Link>
            <Link to="/about" className="btn btn-outline-light">
              About TNP
            </Link>
          </Col>
        </Row>
      </div>
      <Row className="g-3 mb-4">
        <Col md={4}>
          <Card className="stat-card p-3">
            <div className="text-muted small">Highest package</div>
            <div className="fs-2 fw-bold">{highest?.packageAmount != null ? `${highest.packageAmount} ${highest.unit || 'LPA'}` : 'Awaiting published record'}</div>
            <div className="small">Batch {highest?.batch || '—'} · {highest?.companyName || 'Awaiting published record'} · {highest?.sourceDocument || 'source on the statistics page'}</div>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="stat-card p-3">
            <div className="text-muted small">Average CTC</div>
            <div className="fs-2 fw-bold">{avg?.averageCtc != null ? `${avg.averageCtc} LPA` : 'Awaiting published record'}</div>
            <div className="small">Batch {avg?.batch || '—'} · overall · not the highest package · {avg?.sourceDate || ''}</div>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="stat-card p-3">
            <div className="text-muted small">Median</div>
            <div className="fs-2 fw-bold">{avg?.medianPackage != null ? `${avg.medianPackage} LPA` : 'Awaiting published record'}</div>
            <div className="small">Separate from highest package and average CTC{second ? ` · next highest highlight ${second.packageAmount} LPA` : ''}</div>
          </Card>
        </Col>
      </Row>
      <p className="small text-muted">{data?.statsDisclaimer}</p>
      <Row className="g-3">
        <Col lg={8}>
          <Card className="stat-card p-4">
            <h5>Latest announcements</h5>
            {(data?.announcements || []).map((a) => (
              <div key={a._id} className="border-bottom py-2">
                <strong>{a.title}</strong>
                <div className="small text-muted">{a.description}</div>
              </div>
            ))}
            {!data?.announcements?.length && <div className="text-muted">No published announcements yet.</div>}
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="stat-card p-4">
            <h5>Quick links</h5>
            <Link to="/drives" className="d-block py-1">Placement drives</Link>
            <Link to="/companies" className="d-block py-1">Companies</Link>
            <Link to="/team" className="d-block py-1">TNP team</Link>
            <Link to="/statistics" className="d-block py-1">Placement statistics</Link>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
