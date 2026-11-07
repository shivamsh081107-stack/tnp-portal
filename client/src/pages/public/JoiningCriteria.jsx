import React, { useEffect, useState } from 'react';
import { Card, Container } from 'react-bootstrap';
import api from '../../services/api';

export default function JoiningCriteria() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get('/joining-criteria').then((res) => setData(res.data));
  }, []);
  const c = data?.criteria;
  return (
    <Container className="py-4">
      <Card className="stat-card p-4">
        <h2>TNP team joining criteria</h2>
        <p className="text-muted">{data?.notice}</p>
        {!c && <div className="empty-state">No published official criteria. Administrators can draft and publish verified text.</div>}
        {c && (
          <>
            <h4>{c.title}</h4>
            <p><strong>Status:</strong> {c.status} {c.isOfficial ? '(official)' : '(not official)'}</p>
            <h6>Eligibility</h6>
            <p>{c.eligibilityRequirements}</p>
            <h6>Academic requirements</h6>
            <p>{c.academicRequirements}</p>
            <h6>Responsibilities</h6>
            <p>{c.expectedResponsibilities}</p>
          </>
        )}
      </Card>
    </Container>
  );
}
