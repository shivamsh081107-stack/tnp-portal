import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Form, Spinner, Table } from 'react-bootstrap';
import api from '../services/api';
import useDebounce from '../hooks/useDebounce';
import PaginationBar from './PaginationBar.jsx';
import { listFailed, listReceived, listRequested } from '../store/listsSlice';

export default function PagedTable({ title, hint, endpoint, columns, extra = {} }) {
  const dispatch = useDispatch();
  const list = useSelector((state) => state.lists);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounce(q, 300);
  const extraKey = JSON.stringify(extra);

  useEffect(() => {
    const controller = new AbortController();
    const key = `${endpoint}?${extraKey}`;
    dispatch(listRequested({ key, page, filters: { q: debounced, ...extra } }));
    api
      .get(endpoint, { params: { q: debounced, page, limit: 20, ...extra }, signal: controller.signal })
      .then((res) => {
        dispatch(listReceived({ key, items: res.data.items || [], pagination: res.data.pagination }));
      })
      .catch((err) => {
        if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError') return;
        dispatch(listFailed({ key, error: err.response?.data?.message || 'Could not load this page.' }));
      });
    return () => controller.abort();
  }, [dispatch, endpoint, debounced, page, extraKey]);

  const key = `${endpoint}?${extraKey}`;
  const active = list.key === key ? list : { items: [], pagination: null, status: 'idle', error: '' };

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <div>
          <h1 className="h3 mb-1 text-navy">{title}</h1>
          {hint && <p className="text-muted mb-0">{hint}</p>}
        </div>
        <Form.Control
          style={{ maxWidth: 280 }}
          placeholder="Search"
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setPage(1);
          }}
        />
      </div>
      {active.error && <div className="alert alert-warning">{active.error}</div>}
      {active.status === 'loading' && <Spinner size="sm" />}
      <Table responsive hover className="bg-white rounded">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {active.items.map((item) => (
            <tr key={item._id || item.id}>
              {columns.map((column) => (
                <td key={column.key}>{column.render ? column.render(item) : item[column.key] ?? '—'}</td>
              ))}
            </tr>
          ))}
          {!active.items.length && active.status !== 'loading' && (
            <tr>
              <td colSpan={columns.length} className="text-muted">
                Awaiting published record
              </td>
            </tr>
          )}
        </tbody>
      </Table>
      <PaginationBar pagination={active.pagination} onPage={setPage} />
    </div>
  );
}
