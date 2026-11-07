import React, { useEffect, useMemo, useState } from 'react';
import { Card, Col, Container, Form, Row, Table } from 'react-bootstrap';
import { Bar } from 'react-chartjs-2';
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js';
import api from '../../services/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function Statistics() {
  const [records, setRecords] = useState([]);
  const [batch, setBatch] = useState('all');
  useEffect(() => {
    api.get('/statistics').then((res) => setRecords(res.data.records || []));
  }, []);
  const filtered = records.filter((r) => (batch === 'all' ? true : String(r.batch) === batch));
  const highest = filtered.filter((r) => r.recordType === 'overall_highest');
  const branch = filtered.filter((r) => r.recordType === 'branch_wise');
  const batches = [...new Set(records.map((r) => r.batch))].sort((a, b) => b - a);
  const chart = useMemo(() => {
    const overall = branch.filter((r) => r.branch === 'OVERALL').sort((a, b) => a.batch - b.batch);
    return {
      labels: overall.map((r) => String(r.batch)),
      datasets: [{ label: 'Average CTC (LPA)', data: overall.map((r) => r.averageCtc), backgroundColor: '#2563eb' }],
    };
  }, [branch]);
  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center">
        <h2>Placement statistics</h2>
        <Form.Select style={{ maxWidth: 160 }} value={batch} onChange={(e) => setBatch(e.target.value)}>
          <option value="all">All batches</option>
          {batches.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </Form.Select>
      </div>
      <p className="text-muted">Source: IIIT Bhopal T&P Cell, 15 April 2026. Highest package, average CTC, and median are separate metrics. A missing median stays unpublished.</p>
      <Row className="g-3 mb-3">
        {highest.slice(0, 3).map((h) => (
          <Col md={4} key={h._id}>
            <Card className="stat-card p-3">
              <div className="small text-muted">{h.role}</div>
              <div className="fs-3 fw-bold">₹ {h.packageAmount} LPA</div>
              <div>{h.companyName} · {h.batch}</div>
            </Card>
          </Col>
        ))}
      </Row>
      <Card className="stat-card p-3 mb-3">
        <h5>Average CTC by batch (overall)</h5>
        <Bar data={chart} />
      </Card>
      <Card className="stat-card p-3">
        <h5>Branch-wise average CTC</h5>
        <Table responsive>
          <thead>
            <tr>
              <th>Batch</th>
              <th>Branch</th>
              <th>Average CTC</th>
              <th>Median</th>
              <th>Highest package</th>
              <th>Placed</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {branch.filter((r) => r.branch !== 'OVERALL').map((r) => (
              <tr key={r._id}>
                <td>{r.batch}</td>
                <td>{r.branch}</td>
                <td>{r.averageCtc != null ? `${r.averageCtc} LPA` : 'Awaiting published record'}</td>
                <td>{r.medianPackage != null ? `${r.medianPackage} LPA` : 'Awaiting published record'}</td>
                <td>{r.packageAmount != null ? `${r.packageAmount} LPA` : 'Awaiting published record'}</td>
                <td>{r.studentsPlaced ?? '—'}</td>
                <td>{r.placementPercent}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </Container>
  );
}
