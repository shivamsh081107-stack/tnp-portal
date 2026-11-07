import React from 'react';
import { Pagination } from 'react-bootstrap';

export default function PaginationBar({ pagination, onPage }) {
  if (!pagination || pagination.pages <= 1) return null;
  const { page, pages, total, limit } = pagination;
  const start = Math.max(1, page - 2);
  const end = Math.min(pages, start + 4);
  const numbers = [];
  for (let index = start; index <= end; index += 1) numbers.push(index);
  return (
    <div className="d-flex flex-wrap align-items-center gap-3 mt-3">
      <Pagination className="mb-0">
        <Pagination.Prev disabled={page <= 1} onClick={() => onPage(page - 1)} />
        {numbers.map((number) => (
          <Pagination.Item key={number} active={number === page} onClick={() => onPage(number)}>
            {number}
          </Pagination.Item>
        ))}
        <Pagination.Next disabled={page >= pages} onClick={() => onPage(page + 1)} />
      </Pagination>
      <span className="small text-muted">
        {total} records · page {page} of {pages} · {limit || 20} per page
      </span>
    </div>
  );
}
