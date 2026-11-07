import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import api from '../../services/api';
import useDebounce from '../../hooks/useDebounce';
import PaginationBar from '../../components/PaginationBar.jsx';

export default function Companies() {
  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 300);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api
      .get('/companies', { params: { q: debounced, page, limit: 20 }, signal: controller.signal })
      .then((res) => setData(res.data))
      .catch((err) => {
        if (err.code !== 'ERR_CANCELED') setData({ items: [], pagination: { page: 1, pages: 1 } });
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [debounced, page]);
  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Companies and recruiters</h2>
        <Form.Control style={{ maxWidth: 280 }} placeholder="Search companies" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      </div>
      <p className="text-muted">Directory of companies named in official T&P highlights. A listing is not a current job opening.</p>
      {loading && <Spinner />}
      <Row className="g-3">
        {(data?.items || []).map((c) => (
          <Col md={4} key={c._id}>
            <Card className="stat-card p-3 h-100">
              <h5>{c.name}</h5>
              <p className="small text-muted">{c.description}</p>
              {c.website && <a className="d-block mb-2" href={c.website} target="_blank" rel="noreferrer">Know more</a>}
              <Link to={`/companies/${c._id}`}>View details</Link>
            </Card>
          </Col>
        ))}
      </Row>
      <PaginationBar pagination={data?.pagination} onPage={setPage} />
    </Container>
  );
}
