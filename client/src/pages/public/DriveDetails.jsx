import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, Col, Container, Row } from 'react-bootstrap';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext.jsx';

export default function DriveDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [drive, setDrive] = useState(null);
  useEffect(() => {
    api.get(`/drives/${id}`).then((res) => setDrive(res.data.drive));
  }, [id]);
  if (!drive) return <Container className="py-4">Loading…</Container>;
  return (
    <Container className="py-4">
      <Link to="/drives">Back to drives</Link>
      <Row className="g-3 mt-1">
        <Col lg={8}>
          <Card className="stat-card p-4">
            <div className="text-muted">{drive.company?.name}</div>
            <h2>{drive.jobTitle}</h2>
            {drive.isDemonstration && <div className="alert alert-warning">Demonstration drive — not an official campus opening.</div>}
            <p>{drive.jobDescription}</p>
            {(drive.knowMoreUrl || drive.company?.website) && (
              <a href={drive.knowMoreUrl || drive.company.website} target="_blank" rel="noreferrer">Know more</a>
            )}
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="stat-card p-4">
            <h5>Eligibility listed on this drive</h5>
            <div>Branches: {(drive.eligibleBranches || []).join(', ') || 'not specified'}</div>
            <div>Batches: {(drive.eligibleBatches || []).join(', ') || 'not specified'}</div>
            <div>CGPA: {drive.minCgpa ?? 'not specified'} to {drive.maxCgpa ?? 'no maximum'}</div>
            <div>Backlogs: {drive.minBacklogs ?? 0} to {drive.maxBacklogs ?? 'no maximum'}</div>
            <div>Package: {drive.packageDetails || 'not specified'}</div>
            {user?.role === 'student' && drive.status === 'open' && (
              <Link className="btn btn-primary mt-3" to={`/student/drives/${drive._id}`}>
                Apply from student workspace
              </Link>
            )}
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
