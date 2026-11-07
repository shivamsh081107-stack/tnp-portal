import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Container, Form } from 'react-bootstrap';
import api from '../../services/api';
import useDebounce from '../../hooks/useDebounce';
import PaginationBar from '../../components/PaginationBar.jsx';

export default function Drives() {
  const [q, setQ] = useState('');
  const debounced = useDebounce(q);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    api.get('/drives', { params: { q: debounced, page, limit: 20 }, signal: controller.signal }).then((res) => setData(res.data)).catch(() => {});
    return () => controller.abort();
  }, [debounced, page]);
  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between mb-3">
        <h2>Placement drives</h2>
        <Form.Control style={{ maxWidth: 280 }} value={q} placeholder="Search roles" onChange={(e) => setQ(e.target.value)} />
      </div>
      {(data?.items || []).map((d) => (
        <Card key={d._id} className="stat-card p-3 mb-3">
          <div className="d-flex justify-content-between">
            <div>
              <h5 className="mb-1">{d.company?.name} · {d.jobTitle}</h5>
              <div className="small text-muted">
                {d.status} · {d.workMode} · deadline {d.applicationDeadline ? new Date(d.applicationDeadline).toLocaleDateString() : 'unspecified'}
                {d.isDemonstration ? ' · demonstration drive' : ''}
              </div>
            </div>
            <Link className="btn btn-primary btn-sm" to={`/drives/${d._id}`}>
              View
            </Link>
          </div>
        </Card>
      ))}
      <PaginationBar pagination={data?.pagination} onPage={setPage} />
    </Container>
  );
}
