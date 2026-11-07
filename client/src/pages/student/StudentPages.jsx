import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext.jsx';
import { useFlash } from '../../context/FlashContext.jsx';
import useDebounce from '../../hooks/useDebounce';
import PaginationBar from '../../components/PaginationBar.jsx';

const STEPS = [
  ['submitted', 'Applied'],
  ['shortlisted', 'Shortlisted'],
  ['online_assessment', 'Online assessment'],
  ['interview', 'Interview'],
  ['offer', 'Offer'],
];

function reasonClass(code) {
  if (code === 'eligible') return 'text-bg-success';
  if (code === 'resume missing' || code === 'deadline passed') return 'text-bg-warning';
  return 'text-bg-danger';
}

function stepDate(application, status) {
  const history = application.statusHistory || [];
  const match = history.find((row) => row.status === status || (status === 'offer' && row.status === 'selected'));
  if (match?.at) return new Date(match.at).toLocaleString();
  if (status === 'submitted' && application.submittedAt) return new Date(application.submittedAt).toLocaleString();
  return 'Not reached';
}

function Timeline({ application }) {
  if (application.trackerMessage === 'oops') {
    return (
      <div>
        <div className="display-6 mb-1">oops</div>
        <p className="text-muted mb-0">You were not selected in the online assessment. This company is disabled for you.</p>
      </div>
    );
  }
  if (application.trackerMessage === 'Not selected in the interview.') {
    return (
      <div>
        <strong>Not selected in the interview.</strong>
        <p className="text-muted mb-0">This result is separate from an online assessment miss. The company is not disabled.</p>
      </div>
    );
  }
  const current = application.status === 'selected' ? 'offer' : application.status;
  const index = STEPS.findIndex(([status]) => status === current);
  return (
    <div>
      {STEPS.map(([status, label], step) => (
        <div key={status} className="d-flex gap-3 mb-2">
          <span className={`badge ${index >= step ? 'text-bg-primary' : 'text-bg-light'}`}>{step + 1}</span>
          <div>
            <strong>{label}</strong>
            <div className="small text-muted">
              {status === 'online_assessment' && application.oaAt
                ? `Scheduled ${new Date(application.oaAt).toLocaleString()}${application.oaMode ? ` · ${application.oaMode}` : ''}${application.oaPlace ? ` · ${application.oaPlace}` : ''}`
                : status === 'interview' && application.interviewAt
                  ? `Scheduled ${new Date(application.interviewAt).toLocaleString()}${application.interviewMode ? ` · ${application.interviewMode}` : ''}${application.interviewPlace ? ` · ${application.interviewPlace}` : ''}`
                  : index === step && status === 'interview'
                    ? 'Next round is active'
                    : stepDate(application, status)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function StudentDashboard() {
  const { user, profile } = useAuth();
  const [drives, setDrives] = useState([]);
  const [notes, setNotes] = useState([]);
  useEffect(() => {
    const controller = new AbortController();
    api.get('/student/drives', { params: { page: 1, limit: 20 }, signal: controller.signal }).then((res) => setDrives(res.data.items || [])).catch(() => {});
    api.get('/student/notifications', { params: { page: 1, limit: 5 }, signal: controller.signal }).then((res) => setNotes(res.data.items || [])).catch(() => {});
    return () => controller.abort();
  }, []);
  const resumeMissing = !profile?.resume?.publicId;
  return (
    <div>
      <h1 className="h3 mb-1">Welcome back</h1>
      <p className="text-muted">{user?.name} · {profile?.branch || 'Branch awaiting published record'} · batch {profile?.batch || '—'} · CGPA {profile?.cgpa ?? '—'}</p>
      <Row className="g-3">
        <Col md={3}><Card className="stat-card p-3"><div className="text-muted small">Drives on this page</div><div className="fs-3 fw-bold">{drives.length}</div></Card></Col>
        <Col md={3}><Card className="stat-card p-3"><div className="text-muted small">Resume</div><div className="fs-5 fw-bold">{resumeMissing ? 'Missing' : 'On file'}</div></Card></Col>
        <Col md={6}><Card className="stat-card p-3"><div className="text-muted small">Apply stays off until a PDF resume is on your profile.</div><Link to="/student/resume">Upload resume</Link></Card></Col>
      </Row>
      <Row className="g-3 mt-1">
        <Col lg={7}>
          <Card className="stat-card p-3">
            <h2 className="h5">Upcoming deadlines</h2>
            {drives.slice(0, 5).map((drive) => (
              <p key={drive._id} className="mb-2">
                <b>{drive.company?.name || 'Company'} · {drive.jobTitle}</b>{' '}
                <span className={`badge ${reasonClass(drive.eligibility?.code)}`}>{drive.eligibility?.code || 'Awaiting published record'}</span>
              </p>
            ))}
            {!drives.length && <p className="text-muted mb-0">Awaiting published record</p>}
            <Link to="/student/drives">View drives</Link>
          </Card>
        </Col>
        <Col lg={5}>
          <Card className="stat-card p-3">
            <h2 className="h5">Notices for you</h2>
            {notes.map((note) => <p key={note._id} className="mb-2"><b>{note.title}</b><span className="d-block small text-muted">{note.body}</span></p>)}
            {!notes.length && <p className="text-muted">Awaiting published record</p>}
            <Link to="/student/notifications">Open notifications</Link>
          </Card>
        </Col>
      </Row>
      <Card className="stat-card p-3 mt-3 d-flex flex-wrap justify-content-between align-items-center">
        <div>
          <h2 className="h5 mb-1">AI placement assistant</h2>
          <p className="text-muted mb-0">Asks about eligibility, this profile, and one drive at a time. It does not change an application.</p>
        </div>
        <Link className="btn btn-primary" to="/student/assistant">Chat now</Link>
      </Card>
    </div>
  );
}

export function StudentDrives() {
  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 300);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], pagination: null });
  useEffect(() => {
    const controller = new AbortController();
    api
      .get('/student/drives', { params: { q: debounced, page, limit: 20 }, signal: controller.signal })
      .then((res) => setData({ items: res.data.items || [], pagination: res.data.pagination }))
      .catch((err) => {
        if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError') return;
        setData({ items: [], pagination: null });
      });
    return () => controller.abort();
  }, [debounced, page]);
  return (
    <div>
      <div className="d-flex justify-content-between gap-3 mb-3">
        <h1 className="h3">Available drives</h1>
        <Form.Control style={{ maxWidth: 260 }} placeholder="Search roles" value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} />
      </div>
      {data.items.map((drive) => (
        <Card key={drive._id} className="stat-card p-3 mb-3">
          <div className="d-flex justify-content-between gap-3">
            <div>
              <h2 className="h5 mb-1">{drive.company?.name || 'Awaiting published record'} · {drive.jobTitle}</h2>
              <div className="small text-muted">CGPA {drive.minCgpa ?? '—'}–{drive.maxCgpa ?? '—'} · Backlogs {drive.minBacklogs ?? 0}–{drive.maxBacklogs ?? '—'} · {(drive.eligibleBranches || []).join(', ') || 'branches not listed'}</div>
            </div>
            <span className={`badge ${reasonClass(drive.eligibility?.code)}`}>{drive.eligibility?.companyDisabled ? 'oops' : drive.eligibility?.code}</span>
          </div>
          <div className="alert alert-light mt-2 mb-2">{drive.eligibility?.companyDisabled ? 'oops. This company is disabled for you.' : drive.applicationStatus ? `Already applied · ${drive.applicationStatus}` : drive.eligibility?.code}</div>
          {!drive.eligibility?.companyDisabled && <Link className="btn btn-outline-primary btn-sm" to={`/student/drives/${drive._id}`}>Open</Link>}
        </Card>
      ))}
      {!data.items.length && <div className="empty-state">Awaiting published record</div>}
      <PaginationBar pagination={data.pagination} onPage={setPage} />
    </div>
  );
}

export function StudentDrive() {
  const { id } = useParams();
  const flash = useFlash();
  const [drive, setDrive] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/student/drives/${id}`).then((res) => setDrive(res.data.drive)).catch((err) => setError(err.response?.data?.message || 'Drive not found.'));
  }, [id]);

  async function apply() {
    setBusy(true);
    setError('');
    try {
      await api.post('/student/applications', { driveId: id, declarationAccepted: true });
      const res = await api.get(`/student/drives/${id}`);
      setDrive(res.data.drive);
      flash.push({ type: 'success', text: 'Application submitted successfully!' });
    } catch (err) {
      setError(err.response?.data?.message || 'Apply failed.');
    } finally {
      setBusy(false);
    }
  }

  if (!drive) return error ? <div className="alert alert-warning">{error}</div> : <Spinner />;
  const canApply = drive.eligibility?.canApply && !drive.applicationStatus && !drive.eligibility?.companyDisabled;
  return (
    <div>
      <Link to="/student/drives">Back to drives</Link>
      <h1 className="h3 mt-2">{drive.jobTitle}</h1>
      <p className="text-muted">{drive.company?.name || 'Awaiting published record'}</p>
      {(drive.knowMoreUrl || drive.company?.website) && (
        <p><a href={drive.knowMoreUrl || drive.company.website} target="_blank" rel="noreferrer">Know more about the company</a></p>
      )}
      <div className={`alert ${drive.eligibility?.companyDisabled ? 'alert-danger' : drive.eligibility?.canApply ? 'alert-success' : 'alert-warning'}`}>
        {drive.eligibility?.companyDisabled ? 'oops. This company is disabled for you.' : drive.eligibility?.code}
        {drive.eligibility?.reasons?.length ? ` — ${drive.eligibility.reasons.join(' ')}` : ''}
      </div>
      <p className="small text-muted">Apply stays closed unless your CGPA is inside {drive.minCgpa ?? '—'} to {drive.maxCgpa ?? 'no maximum'}.</p>
      <p>{drive.jobDescription}</p>
      {error && <div className="alert alert-warning">{error}</div>}
      <Button disabled={!canApply || busy} onClick={apply}>{busy ? 'Submitting…' : 'Apply'}</Button>
    </div>
  );
}

export function DriveCalendar() {
  const [drives, setDrives] = useState([]);
  useEffect(() => {
    api.get('/student/drives', { params: { page: 1, limit: 50 } }).then((res) => setDrives(res.data.items || [])).catch(() => setDrives([]));
  }, []);
  const dated = drives.filter((drive) => drive.applicationDeadline);
  const byDay = new Map();
  for (const drive of dated) {
    const key = new Date(drive.applicationDeadline).toLocaleDateString();
    byDay.set(key, [...(byDay.get(key) || []), drive]);
  }
  const days = [...byDay.keys()].sort((a, b) => new Date(a) - new Date(b));
  return (
    <div>
      <h1 className="h3">Drive calendar</h1>
      <p className="text-muted">Open drives grouped by application deadline. A drive without a deadline is listed underneath.</p>
      {days.map((day) => (
        <Card key={day} className="stat-card p-3 mb-3">
          <h2 className="h6">{day}</h2>
          {byDay.get(day).map((drive) => (
            <p key={drive._id} className="mb-1">
              <Link to={`/student/drives/${drive._id}`}>{drive.company?.name || 'Company'} · {drive.jobTitle}</Link>
              <span className="small text-muted"> · {drive.eligibility?.companyDisabled ? 'oops' : drive.eligibility?.code}</span>
            </p>
          ))}
        </Card>
      ))}
      {!days.length && <p className="text-muted">No dated drives on this page.</p>}
    </div>
  );
}

export function Applications() {
  const { id } = useParams();
  const [data, setData] = useState({ items: [], pagination: null });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    api.get('/student/applications', { params: { page, limit: 20 }, signal: controller.signal }).then((res) => setData(res.data));
    return () => controller.abort();
  }, [page]);
  useEffect(() => {
    if (!id) return;
    api.get(`/student/applications/${id}`).then((res) => setSelected(res.data.application));
  }, [id]);
  const current = selected || data.items[0];
  return (
    <div>
      <h1 className="h3">My applications</h1>
      <Row className="g-3 mt-1">
        <Col lg={7}>
          <Card className="stat-card p-3">
            {current ? (
              <>
                <h2 className="h5">{current.drive?.company?.name || 'Company'} · {current.drive?.jobTitle}</h2>
                <Timeline application={current} />
              </>
            ) : <p className="text-muted mb-0">Awaiting published record</p>}
          </Card>
        </Col>
        <Col lg={5}>
          <Card className="stat-card p-3">
            <h2 className="h6">This page</h2>
            {data.items.map((item) => (
              <button key={item._id} className="btn btn-link p-0 d-block" type="button" onClick={() => setSelected(item)}>
                {item.drive?.jobTitle || 'Drive'} · {item.trackerMessage === 'oops' ? 'oops' : item.status}
              </button>
            ))}
          </Card>
        </Col>
      </Row>
      <PaginationBar pagination={data.pagination} onPage={setPage} />
    </div>
  );
}

export function Resume() {
  const { profile, refresh } = useAuth();
  const [error, setError] = useState('');
  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    try {
      await api.post('/student/resume', body);
      await refresh();
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed. PDF only, up to 5 MB.');
    }
  }
  async function openResume() {
    const { data } = await api.get('/student/resume');
    window.open(data.url, '_blank', 'noopener');
  }
  async function remove() {
    await api.delete('/student/resume');
    await refresh();
  }
  const onFile = Boolean(profile?.resume?.publicId);
  return (
    <div>
      <h1 className="h3">Resume</h1>
      <Card className="stat-card p-4 mt-3" style={{ maxWidth: 560 }}>
        <span className={`badge ${onFile ? 'text-bg-success' : 'text-bg-warning'}`}>{onFile ? 'On file' : 'Missing'}</span>
        <p className="mt-3">PDF only, up to 5 MB. The file is stored for applications, and the text inside the PDF is read for the resume analyzer.</p>
        <Form.Control type="file" accept="application/pdf" onChange={upload} />
        <div className="d-flex gap-2 mt-3">
          <Button variant="outline-primary" disabled={!onFile} onClick={openResume}>View</Button>
          <Button variant="outline-danger" disabled={!onFile} onClick={remove}>Delete</Button>
        </div>
        {error && <div className="alert alert-warning mt-3 mb-0">{error}</div>}
      </Card>
    </div>
  );
}

export function Profile() {
  const { user, profile, refresh } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [message, setMessage] = useState('');
  async function save(event) {
    event.preventDefault();
    try {
      await api.patch('/student/profile', { name });
      await refresh();
      setMessage('Profile updated.');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Save failed.');
    }
  }
  async function photo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    await api.post('/student/profile/photo', body);
    await refresh();
  }
  return (
    <div>
      <h1 className="h3">Profile</h1>
      <Row className="g-3 mt-1">
        <Col md={7}>
          <Card className="stat-card p-3">
            <Form onSubmit={save}>
              <Form.Label>Name</Form.Label>
              <Form.Control value={name} onChange={(event) => setName(event.target.value)} />
              <Form.Label className="mt-2">Email</Form.Label>
              <Form.Control value={user?.email || ''} disabled />
              <Form.Label className="mt-2">Phone</Form.Label>
              <Form.Control value={user?.phone || ''} disabled />
              <Button className="mt-3" type="submit">Save</Button>
              {message && <p className="mt-2 mb-0 text-muted">{message}</p>}
            </Form>
          </Card>
        </Col>
        <Col md={5}>
          <Card className="stat-card p-3 text-center">
            <h2 className="h6">Photo</h2>
            {profile?.profileImage?.url ? <img alt="" src={profile.profileImage.url} className="rounded-circle mb-2" width="72" height="72" /> : <div className="text-muted mb-2">Awaiting published record</div>}
            <Form.Control type="file" accept="image/png,image/jpeg,image/webp" onChange={photo} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export function Academics() {
  const { profile, refresh } = useAuth();
  const [form, setForm] = useState({
    cgpa: profile?.cgpa ?? '',
    backlogs: profile?.backlogs ?? 0,
    skills: (profile?.skills || []).join(', '),
  });
  const [message, setMessage] = useState('');
  async function save(event) {
    event.preventDefault();
    try {
      await api.patch('/student/profile', {
        cgpa: Number(form.cgpa),
        backlogs: Number(form.backlogs),
        skills: form.skills.split(',').map((item) => item.trim()).filter(Boolean),
      });
      await refresh();
      setMessage('Academics saved. CGPA is checked again when you apply.');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Save failed.');
    }
  }
  return (
    <div>
      <h1 className="h3">Academics</h1>
      <Card className="stat-card p-3 mt-3" style={{ maxWidth: 560 }}>
        <Form onSubmit={save}>
          <Form.Label>Branch</Form.Label>
          <Form.Control value={profile?.branch || ''} disabled />
          <Form.Label className="mt-2">Batch</Form.Label>
          <Form.Control value={profile?.batch || ''} disabled />
          <Form.Label className="mt-2">CGPA</Form.Label>
          <Form.Control value={form.cgpa} onChange={(event) => setForm({ ...form, cgpa: event.target.value })} />
          <Form.Label className="mt-2">Active backlogs</Form.Label>
          <Form.Control value={form.backlogs} onChange={(event) => setForm({ ...form, backlogs: event.target.value })} />
          <Form.Label className="mt-2">Skills</Form.Label>
          <Form.Control value={form.skills} onChange={(event) => setForm({ ...form, skills: event.target.value })} />
          <Button className="mt-3" type="submit">Save academics</Button>
          {message && <p className="mt-2 text-muted">{message}</p>}
        </Form>
      </Card>
    </div>
  );
}

export function Notifications() {
  const [data, setData] = useState({ items: [], pagination: null });
  const [page, setPage] = useState(1);
  useEffect(() => {
    const controller = new AbortController();
    api.get('/student/notifications', { params: { page, limit: 20 }, signal: controller.signal }).then((res) => setData(res.data));
    return () => controller.abort();
  }, [page]);
  return (
    <div>
      <h1 className="h3">Notifications</h1>
      <div className="mt-3">
        {data.items.map((item) => (
          <Card key={item._id} className="stat-card p-3 mb-2">
            <strong>{item.title}</strong>
            <div className="text-muted">{item.body}</div>
            <div className="small">{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</div>
          </Card>
        ))}
        {!data.items.length && <div className="empty-state">Awaiting published record</div>}
      </div>
      <PaginationBar pagination={data.pagination} onPage={setPage} />
    </div>
  );
}

export function Assistant() {
  const [message, setMessage] = useState('');
  const [thread, setThread] = useState([
    {
      role: 'assistant',
      content:
        'Hello! I am your IIIT Bhopal AI Placement Assistant. You can ask me about open drives, your eligibility status, placement statistics, or interview preparation tips.',
    },
  ]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const SUGGESTIONS = [
    'Check my eligibility for open drives',
    'What are the highest and average packages?',
    'Technical interview preparation tips',
    'List all active placement drives',
    'Explain the placement selection process',
  ];

  async function handleSend(textToSend) {
    const text = (textToSend || message).trim();
    if (!text || busy) return;
    setMessage('');
    setError('');
    const newThread = [...thread, { role: 'user', content: text }];
    setThread(newThread);
    setBusy(true);

    try {
      const history = newThread
        .filter((item, idx) => idx > 0) // exclude initial greeting
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));
      const { data } = await api.post('/ai/chat', { message: text, history });
      const replyContent = data.reply?.content || data.reply || 'No reply received.';
      setThread((current) => [...current, { role: 'assistant', content: replyContent }]);
    } catch (err) {
      setError(err.response?.data?.message || 'The assistant is currently unavailable.');
    } finally {
      setBusy(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    handleSend();
  }

  return (
    <div>
      <div className="d-flex align-items-center gap-2 mb-2">
        <i className="bi bi-stars fs-4 text-primary" />
        <h1 className="h3 mb-0">AI Placement Assistant</h1>
      </div>
      <p className="text-muted">
        Your intelligent placement co-pilot at IIIT Bhopal. Ask about drives, packages, eligibility, or interview strategies.
      </p>

      <div className="d-flex flex-wrap gap-2 mb-3">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className="btn btn-outline-primary btn-sm rounded-pill"
            disabled={busy}
            onClick={() => handleSend(s)}
          >
            <i className="bi bi-chat-left-dots me-1" /> {s}
          </button>
        ))}
      </div>

      <Card className="stat-card p-3" style={{ maxWidth: 780 }}>
        <div
          className="mb-3 d-flex flex-column gap-2"
          style={{ maxHeight: '480px', overflowY: 'auto' }}
        >
          {thread.map((item, index) => {
            const isUser = item.role === 'user';
            return (
              <div
                key={`${item.role}-${index}`}
                className={`d-flex ${isUser ? 'justify-content-end' : 'justify-content-start'}`}
              >
                <div
                  className={`rounded-3 p-3 shadow-sm ${
                    isUser
                      ? 'bg-primary text-white'
                      : 'bg-light text-dark border'
                  }`}
                  style={{ maxWidth: '85%', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}
                >
                  <div className="small fw-bold mb-1 opacity-75">
                    {isUser ? 'You' : 'IIIT Bhopal Assistant'}
                  </div>
                  {item.content}
                </div>
              </div>
            );
          })}
          {busy && (
            <div className="d-flex justify-content-start">
              <div className="rounded-3 p-3 bg-light text-muted border">
                <Spinner size="sm" animation="border" className="me-2" />
                Thinking...
              </div>
            </div>
          )}
        </div>

        <Form onSubmit={submit} className="d-flex gap-2">
          <Form.Control
            value={message}
            disabled={busy}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ask anything about drives, packages, eligibility, or interviews..."
          />
          <Button type="submit" disabled={busy || !message.trim()}>
            {busy ? <Spinner size="sm" /> : 'Send'}
          </Button>
        </Form>
        {error && <div className="alert alert-warning mt-3 mb-0">{error}</div>}
      </Card>
    </div>
  );
}
