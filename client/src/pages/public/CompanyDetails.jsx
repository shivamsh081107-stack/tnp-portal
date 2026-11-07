import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, Container } from 'react-bootstrap';
import api from '../../services/api';

export default function CompanyDetails() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get(`/companies/${id}`).then((res) => setData(res.data));
  }, [id]);
  if (!data) return <Container className="py-4">Loading…</Container>;
  const { company, drives } = data;
  return (
    <Container className="py-4">
      <Link to="/companies">Back</Link>
      <Card className="stat-card p-4 mt-3">
        <h2>{company.name}</h2>
        <p>{company.description}</p>
        {company.website && (
          <a href={company.website} target="_blank" rel="noreferrer">
            Know more
          </a>
        )}
        <hr />
        <h5>Related drives</h5>
        {drives.map((d) => (
          <div key={d._id} className="py-2 border-bottom">
            <Link to={`/drives/${d._id}`}>{d.jobTitle}</Link>
            <div className="small text-muted">
              {d.status} {d.isDemonstration ? '· demonstration (not an official opening)' : ''}
            </div>
          </div>
        ))}
        {!drives.length && <div className="text-muted">No published drives for this company.</div>}
      </Card>
    </Container>
  );
}
