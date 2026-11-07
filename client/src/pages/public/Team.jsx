import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Col, Container, Row } from 'react-bootstrap';
import api from '../../services/api';

export default function Team() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get('/team').then((res) => setData(res.data));
  }, []);
  return (
    <Container className="py-4">
      <div className="hero p-4 mb-4">
        <h2>TNP — Our team</h2>
        <p className="mb-0 opacity-75">Guiding, connecting, building student careers at IIIT Bhopal.</p>
      </div>
      <div className="alert alert-info">{data?.notice}</div>
      <Row className="g-3">
        {(data?.members || []).filter((member) => !member.isPlaceholder).map((member) => (
          <Col md={3} key={member._id}>
            <Card className="stat-card p-3 text-center h-100">
              {member.profilePhoto?.url ? (
                <img alt="" src={member.profilePhoto.url} className="rounded-circle mb-2" width="72" height="72" />
              ) : (
                <div className="small text-muted mb-2">Awaiting published record</div>
              )}
              <strong>{member.fullName || 'Awaiting published record'}</strong>
              <div className="small text-muted">{member.designation || member.teamRole || 'Awaiting published record'}</div>
              {member.showContactPublicly && member.contactInfo ? <div className="small mt-2">{member.contactInfo}</div> : null}
            </Card>
          </Col>
        ))}
        {!(data?.members || []).some((member) => !member.isPlaceholder) && (
          <Col xs={12}><div className="empty-state">Awaiting published record</div></Col>
        )}
      </Row>
      <div className="mt-4">
        <Link to="/joining-criteria">View TNP joining criteria</Link>
      </div>
    </Container>
  );
}
