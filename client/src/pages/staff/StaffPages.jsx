import React, { useEffect, useState } from 'react';
import { Button, Card, Col, Form, Row } from 'react-bootstrap';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext.jsx';
import PagedTable from '../../components/PagedTable.jsx';

const PERMISSIONS = [
  'view_students',
  'manage_students',
  'manage_drives',
  'review_applications',
  'manage_announcements',
  'manage_companies',
  'manage_statistics',
  'update_placement_info',
  'manage_criteria',
  'manage_recruiters',
  'import_export',
  'view_audit',
];

const STATUSES = ['submitted', 'shortlisted', 'online_assessment', 'interview', 'offer', 'selected', 'rejected'];

function messageFrom(err) {
  const data = err.response?.data;
  if (Array.isArray(data?.details) && data.details.length) {
    return data.details.map((item) => item.message).filter(Boolean).join(' ');
  }
  return data?.message || 'Request failed.';
}

function Metric({ label, value, hint }) {
  return (
    <Card className="stat-card p-3 h-100">
      <div className="text-muted small">{label}</div>
      <div className="fs-3 fw-bold">{value ?? '—'}</div>
      {hint && <div className="small text-muted">{hint}</div>}
    </Card>
  );
}

export function TeamDashboard() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get('/admin/dashboard').then((res) => setData(res.data)).catch(() => setData(null));
  }, []);
  return (
    <div>
      <h1 className="h3">TNP team dashboard</h1>
      <p className="text-muted">Counts are for drives assigned to this login.</p>
      <Row className="g-3">
        <Col md={4}><Metric label="Assigned drives" value={data?.stats?.assigned} /></Col>
        <Col md={4}><Metric label="To review" value={data?.stats?.toReview} hint="Status: applied" /></Col>
        <Col md={4}><Metric label="Applications" value={data?.stats?.apps} /></Col>
      </Row>
    </div>
  );
}

export function TeamDrives() {
  return <PagedTable title="Assigned drives" hint="This login sees drives assigned to it. Company deletion stays with the administrator." endpoint="/admin/drives" columns={[
    { key: 'title', label: 'Drive', render: (row) => row.jobTitle },
    { key: 'company', label: 'Company', render: (row) => row.company?.name || 'Awaiting published record' },
    { key: 'status', label: 'Status' },
    { key: 'deadline', label: 'Deadline', render: (row) => row.applicationDeadline ? new Date(row.applicationDeadline).toLocaleDateString() : '—' },
  ]} />;
}

export function TeamStudents() {
  return <PagedTable title="Student records you may open" hint="Limited to students on your assigned drives. Search hits the server." endpoint="/admin/students" columns={[
    { key: 'name', label: 'Name' },
    { key: 'roll', label: 'Roll', render: (row) => row.profile?.enrollmentNumber || 'Awaiting published record' },
    { key: 'branch', label: 'Branch', render: (row) => row.profile?.branch || '—' },
    { key: 'cgpa', label: 'CGPA', render: (row) => row.profile?.cgpa ?? '—' },
    { key: 'resume', label: 'Resume', render: (row) => row.profile?.hasResume ? 'On file' : 'Missing' },
  ]} />;
}

function ApplicationReview() {
  const [note, setNote] = useState('');
  async function setStatus(row, status, oaResult) {
    const res = await api.patch(`/admin/applications/${row._id}`, { status, reviewNotes: note, ...(oaResult ? { oaResult } : {}) });
    if (res.data.mailWarning) window.alert(res.data.mailWarning);
    window.location.reload();
  }
  return (
    <div>
      <PagedTable title="Application review" hint="One page at a time. Status is saved on the server." endpoint="/admin/applications" columns={[
        { key: 'student', label: 'Student', render: (row) => row.student?.name || row.student?.email || '—' },
        { key: 'drive', label: 'Drive', render: (row) => row.drive?.jobTitle || '—' },
        { key: 'status', label: 'Status' },
        { key: 'action', label: 'Set status', render: (row) => (
          <Form.Select defaultValue={row.status} onChange={(event) => setStatus(row, event.target.value)}>
            {STATUSES.map((status) => <option key={status}>{status}</option>)}
          </Form.Select>
        ) },
      ]} />
      <Form.Control className="mt-3" placeholder="Optional review note sent with the next status change" value={note} onChange={(event) => setNote(event.target.value)} />
    </div>
  );
}

export function TeamApplications() {
  const { user } = useAuth();
  const [pending, setPending] = useState([]);
  const [marked, setMarked] = useState([]);
  const [error, setError] = useState('');

  function load() {
    api.get('/admin/applications', { params: { status: 'online_assessment', page: 1, limit: 50 } })
      .then((res) => setPending(res.data.items || []))
      .catch((err) => setError(messageFrom(err)));
  }

  useEffect(() => { load(); }, []);

  async function mark(row, oaResult) {
    setError('');
    try {
      const res = await api.patch(`/admin/applications/${row._id}`, { status: row.status, oaResult });
      if (res.data.mailWarning) window.alert(res.data.mailWarning);
      setPending((current) => current.filter((item) => item._id !== row._id));
      setMarked((current) => [{ ...row, outcome: oaResult === 'selected' ? 'Selected' : 'Not selected' }, ...current]);
    } catch (err) {
      setError(messageFrom(err));
    }
  }

  return (
    <div>
      <h1 className="h3">OA selection list</h1>
      <p className="text-muted">{user?.name || 'TNP team member'} marks this list. Only drives assigned to you are shown. Selected students move to the next round. The others stay as oops and that company is disabled for them.</p>
      {error && <div className="alert alert-warning">{error}</div>}
      <Card className="stat-card p-3 mb-3">
        <h2 className="h5">Waiting for your decision</h2>
        {!pending.length && <p className="text-muted mb-0">No student is in the online assessment on your drives.</p>}
        {pending.map((row) => (
          <div key={row._id} className="d-flex flex-wrap justify-content-between align-items-center gap-2 border-bottom py-2">
            <div>
              <b>{row.student?.name || row.student?.email || 'Student'}</b>
              <div className="small text-muted">{row.drive?.company?.name || 'Company'} · {row.drive?.jobTitle || 'Drive'}</div>
            </div>
            <div className="d-flex gap-2">
              <Button size="sm" onClick={() => mark(row, 'selected')}>Selected</Button>
              <Button size="sm" variant="outline-danger" onClick={() => mark(row, 'rejected')}>Not selected</Button>
            </div>
          </div>
        ))}
      </Card>
      <OnlineAssessmentRound />
      <InterviewRound />
      {!!marked.length && (
        <Card className="stat-card p-3">
          <h2 className="h5">Marked just now</h2>
          {marked.map((row) => (
            <p key={row._id} className="mb-1">{row.student?.name || row.student?.email} · {row.outcome}</p>
          ))}
        </Card>
      )}
    </div>
  );
}

function OnlineAssessmentRound() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  function load() {
    api.get('/admin/applications', { params: { status: 'online_assessment', page: 1, limit: 50 } })
      .then((res) => setRows(res.data.items || []))
      .catch((err) => setError(messageFrom(err)));
  }
  useEffect(() => { load(); }, []);
  async function schedule(event, row) {
    event.preventDefault();
    const data = new FormData(event.target);
    try {
      const res = await api.patch(`/admin/applications/${row._id}`, {
        status: 'online_assessment',
        oaAt: data.get('oaAt'),
        oaMode: data.get('oaMode'),
        oaPlace: data.get('oaPlace'),
      });
      if (res.data.mailWarning) window.alert(res.data.mailWarning);
      load();
    } catch (err) {
      setError(messageFrom(err));
    }
  }
  return (
    <Card className="stat-card p-3 mb-3">
      <h2 className="h5">Online assessment details</h2>
      <p className="text-muted">After a student is moved to online assessment, add the time and the link or room. The student sees this on the application and in notifications.</p>
      {error && <div className="alert alert-warning">{error}</div>}
      {!rows.length && <p className="text-muted mb-0">No student is waiting for online assessment details.</p>}
      {rows.map((row) => (
        <Form key={row._id} className="border-bottom py-2" onSubmit={(event) => schedule(event, row)}>
          <b>{row.student?.name || row.student?.email}</b>
          <div className="small text-muted mb-2">{row.drive?.company?.name || 'Company'} · {row.drive?.jobTitle}</div>
          <Row className="g-2">
            <Col md={4}><Form.Control type="datetime-local" name="oaAt" required defaultValue={row.oaAt ? row.oaAt.slice(0, 16) : ''} /></Col>
            <Col md={3}>
              <Form.Select name="oaMode" defaultValue={row.oaMode || 'online'}>
                <option value="online">online</option>
                <option value="onsite">onsite</option>
              </Form.Select>
            </Col>
            <Col md={5}><Form.Control name="oaPlace" placeholder="Link or room" defaultValue={row.oaPlace || ''} /></Col>
          </Row>
          <Button size="sm" className="mt-2" type="submit">Send OA details</Button>
        </Form>
      ))}
    </Card>
  );
}

function InterviewRound() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  function load() {
    api.get('/admin/applications', { params: { status: 'interview', page: 1, limit: 50 } })
      .then((res) => setRows(res.data.items || []))
      .catch((err) => setError(messageFrom(err)));
  }
  useEffect(() => { load(); }, []);
  async function schedule(event, row) {
    event.preventDefault();
    const data = new FormData(event.target);
    try {
      const res = await api.patch(`/admin/applications/${row._id}`, {
        status: 'interview',
        interviewAt: data.get('interviewAt'),
        interviewMode: data.get('interviewMode'),
        interviewPlace: data.get('interviewPlace'),
      });
      if (res.data.mailWarning) window.alert(res.data.mailWarning);
      load();
    } catch (err) {
      setError(messageFrom(err));
    }
  }
  async function rejectInterview(row) {
    try {
      await api.patch(`/admin/applications/${row._id}`, { status: 'rejected' });
      load();
    } catch (err) {
      setError(messageFrom(err));
    }
  }
  return (
    <Card className="stat-card p-3 mb-3">
      <h2 className="h5">Interview round</h2>
      <p className="text-muted">Schedule the interview, or mark this round as not selected. That outcome is separate from an online assessment miss.</p>
      {error && <div className="alert alert-warning">{error}</div>}
      {!rows.length && <p className="text-muted mb-0">No student is in the interview round on your drives.</p>}
      {rows.map((row) => (
        <Form key={row._id} className="border-bottom py-2" onSubmit={(event) => schedule(event, row)}>
          <b>{row.student?.name || row.student?.email}</b>
          <div className="small text-muted mb-2">{row.drive?.company?.name || 'Company'} · {row.drive?.jobTitle}</div>
          <Row className="g-2">
            <Col md={4}><Form.Control type="datetime-local" name="interviewAt" required /></Col>
            <Col md={3}>
              <Form.Select name="interviewMode" defaultValue="online">
                <option value="online">online</option>
                <option value="onsite">onsite</option>
              </Form.Select>
            </Col>
            <Col md={5}><Form.Control name="interviewPlace" placeholder="Link or room" /></Col>
          </Row>
          <div className="d-flex gap-2 mt-2">
            <Button size="sm" type="submit">Save schedule</Button>
            <Button size="sm" type="button" variant="outline-danger" onClick={() => rejectInterview(row)}>Not selected in interview</Button>
          </div>
        </Form>
      ))}
    </Card>
  );
}

export function TeamPlacements() {
  return (
    <div>
      <h1 className="h3">Placed and unplaced</h1>
      <PagedTable title="Unplaced students" hint="Selecting a student on Application Review removes them from this list." endpoint="/admin/students" extra={{ placement: 'unplaced' }} columns={[
        { key: 'name', label: 'Name' },
        { key: 'roll', label: 'Roll', render: (row) => row.profile?.enrollmentNumber || '—' },
        { key: 'branch', label: 'Branch', render: (row) => row.profile?.branch || '—' },
        { key: 'batch', label: 'Batch', render: (row) => row.profile?.batch || '—' },
      ]} />
      <PlacementBoards />
    </div>
  );
}

function AnnouncementForm() {
  const [form, setForm] = useState({ title: '', description: '', audience: 'students', status: 'published' });
  const [message, setMessage] = useState('');
  async function save(event) {
    event.preventDefault();
    try {
      await api.post('/admin/announcements', form);
      setMessage('Announcement saved.');
    } catch (err) {
      setMessage(messageFrom(err));
    }
  }
  return (
    <Card className="stat-card p-3 mb-3" style={{ maxWidth: 640 }}>
      <Form onSubmit={save}>
        <Form.Label>Title</Form.Label>
        <Form.Control required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        <Form.Label className="mt-2">Audience</Form.Label>
        <Form.Select value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })}>
          <option value="students">Students</option>
          <option value="all">Everyone</option>
          <option value="tnp_team">TNP team</option>
        </Form.Select>
        <Form.Label className="mt-2">Body</Form.Label>
        <Form.Control as="textarea" rows={3} required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <Button className="mt-3" type="submit">Publish</Button>
        {message && <p className="mt-2 text-muted">{message}</p>}
      </Form>
    </Card>
  );
}

export function TeamAnnouncements() {
  return (
    <div>
      <h1 className="h3">Announcements you can publish</h1>
      <AnnouncementForm />
      <PagedTable title="Published and draft notices" endpoint="/admin/announcements" columns={[
        { key: 'title', label: 'Title' },
        { key: 'audience', label: 'Audience' },
        { key: 'status', label: 'State' },
      ]} />
    </div>
  );
}

export function TeamProfile() {
  const { user } = useAuth();
  return (
    <div>
      <h1 className="h3">Team profile</h1>
      <Card className="stat-card p-3" style={{ maxWidth: 560 }}>
        <p className="mb-1"><b>{user?.name}</b></p>
        <p className="text-muted mb-1">Role: TNP team</p>
        <p className="text-muted mb-1">Email: {user?.email}</p>
        <p className="text-muted mb-0">Permissions: {(user?.permissions || []).join(', ') || 'Awaiting published record'}</p>
      </Card>
    </div>
  );
}

export function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get('/admin/dashboard').then((res) => setData(res.data)).catch((err) => setError(messageFrom(err)));
  }, []);
  return (
    <div>
      <h1 className="h3">Admin dashboard</h1>
      <p className="text-muted">Counts use the database counters. The student list itself stays paged.</p>
      {error && <div className="alert alert-warning">{error}</div>}
      <Row className="g-3">
        <Col md={3}><Metric label="Students" value={data?.stats?.studentsCount} /></Col>
        <Col md={3}><Metric label="Companies" value={data?.stats?.companiesCount} /></Col>
        <Col md={3}><Metric label="Open drives" value={data?.stats?.openDrives} /></Col>
        <Col md={3}><Metric label="Applications" value={data?.stats?.apps} /></Col>
      </Row>
      <Card className="stat-card p-3 mt-3">
        <h2 className="h6">Recent applications</h2>
        {(data?.recentApps || []).map((row) => (
          <p key={row._id} className="mb-1">{row.student?.name || 'Student'} · {row.drive?.jobTitle || 'Drive'} · {row.status}</p>
        ))}
        {!data?.recentApps?.length && <p className="text-muted mb-0">Awaiting published record</p>}
      </Card>
    </div>
  );
}

function PlacementBoards({ canSuspend = false, refresh = 0, onSuspended }) {
  const [years, setYears] = useState([]);
  useEffect(() => {
    api.get('/admin/placements').then((res) => setYears(res.data.years || [])).catch(() => setYears([]));
  }, [refresh]);
  async function suspend(item) {
    if (!window.confirm(`Suspend ${item.name || item.email}? They will not be able to sign in.`)) return;
    const res = await api.delete(`/admin/students/${item.id}`);
    if (res.data.mailWarning) window.alert(res.data.mailWarning);
    if (onSuspended) onSuspended(res.data.message || 'Student suspended.');
  }
  return (
    <div className="mt-4">
      <h2 className="h4">Placed students</h2>
      <p className="text-muted">Grouped by batch. Inside each batch the higher package is listed first.</p>
      {!years.length && <p className="text-muted">No placed students yet.</p>}
      {years.map((year) => (
        <Card key={year.batch} className="stat-card p-3 mb-3">
          <h3 className="h5">Batch {year.batch}</h3>
          <table className="table mb-0">
            <thead>
              <tr><th>Student</th><th>Company</th><th>Role</th><th>Package</th>{canSuspend && <th>Remove</th>}</tr>
            </thead>
            <tbody>
              {year.items.map((item) => (
                <tr key={`${item.email}-${item.companyName}`}>
                  <td>{item.name}<div className="small text-muted">{item.enrollmentNumber} · {item.branch}</div></td>
                  <td>{item.companyName || '—'}</td>
                  <td>{item.role || '—'}</td>
                  <td>{item.packageLpa != null ? `${item.packageLpa} LPA` : '—'}</td>
                  {canSuspend && (
                    <td><Button size="sm" variant="outline-danger" onClick={() => suspend(item).catch((err) => window.alert(messageFrom(err)))}>Suspend</Button></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}

export function AdminStudents() {
  const [listKey, setListKey] = useState(0);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('success');
  return (
    <div>
      {message && <p className={`text-${messageTone}`}>{message}</p>}
      <PagedTable title="Unplaced students" hint="A student leaves this list when a company selects them. Suspend removes their login." endpoint="/admin/students" extra={{ placement: 'unplaced', listKey }} columns={[
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'roll', label: 'Roll', render: (row) => row.profile?.enrollmentNumber || 'Awaiting published record' },
        { key: 'branch', label: 'Branch', render: (row) => row.profile?.branch || '—' },
        { key: 'batch', label: 'Batch', render: (row) => row.profile?.batch || '—' },
        { key: 'cgpa', label: 'CGPA', render: (row) => row.profile?.cgpa ?? '—' },
        { key: 'remove', label: 'Remove', render: (row) => (
          <Button size="sm" variant="outline-danger" onClick={async () => {
            const label = row.name || row.email;
            if (!window.confirm(`Suspend ${label}? They will not be able to sign in.`)) return;
            try {
              const res = await api.delete(`/admin/students/${row._id}`);
              if (res.data.mailWarning) window.alert(res.data.mailWarning);
              setMessageTone('success');
              setMessage(res.data.message || 'Student suspended.');
              setListKey((value) => value + 1);
            } catch (err) {
              setMessageTone('danger');
              setMessage(messageFrom(err));
            }
          }}>Suspend</Button>
        ) },
      ]} />
      <PlacementBoards
        canSuspend
        refresh={listKey}
        onSuspended={(text) => {
          setMessageTone('success');
          setMessage(text);
          setListKey((value) => value + 1);
        }}
      />
    </div>
  );
}

export function AdminTeam() {
  const [form, setForm] = useState({
    fullName: '',
    designation: '',
    teamRole: '',
    collegeEmail: '',
    phone: '',
    responsibilities: '',
    showContactPublicly: false,
    createLogin: true,
    tempPassword: '',
  });
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('muted');
  const [rosterKey, setRosterKey] = useState(0);
  async function save(event) {
    event.preventDefault();
    try {
      const { data } = await api.post('/admin/team', form);
      setMessageTone(data.mailWarning ? 'warning' : 'success');
      setMessage(data.message || data.flash?.text || 'Team member saved.');
      setForm((prev) => ({ ...prev, tempPassword: '' }));
      setRosterKey((value) => value + 1);
    } catch (err) {
      setMessageTone('danger');
      setMessage(messageFrom(err));
    }
  }
  return (
    <div>
      <h1 className="h3">TNP team members</h1>
      <p className="text-muted">Add a member only from an authorized list. Empty fields stay unpublished.</p>
      <ul className="small text-muted">
        <li>Name is required, 2 to 120 characters.</li>
        <li>Seat and designation are optional, up to 120 characters.</li>
        <li>College email can match an existing student account. That person keeps their current password and also gets TNP team access.</li>
        <li>Phone can stay blank. A filled phone must be 10 digits and start with 6, 7, 8, or 9. It is only checked when a new login is created.</li>
        <li>Login password, when filled, needs 8 to 72 characters with an uppercase letter, a lowercase letter, a number, and a symbol. A blank password becomes TeamPass#123.</li>
      </ul>
      <Card className="stat-card p-3 mb-3">
        <Form onSubmit={save}>
          <Row className="g-2">
            <Col md={6}><Form.Label>Name</Form.Label><Form.Control required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></Col>
            <Col md={6}><Form.Label>Seat</Form.Label><Form.Control value={form.teamRole} onChange={(event) => setForm({ ...form, teamRole: event.target.value })} /></Col>
            <Col md={6}><Form.Label>Designation</Form.Label><Form.Control value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })} /></Col>
            <Col md={6}><Form.Label>College email</Form.Label><Form.Control type="email" value={form.collegeEmail} onChange={(event) => setForm({ ...form, collegeEmail: event.target.value })} /></Col>
            <Col md={6}><Form.Label>Phone</Form.Label><Form.Control value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="10-digit mobile" /></Col>
            <Col md={6}><Form.Label>Login password</Form.Label><Form.Control type="password" value={form.tempPassword} onChange={(event) => setForm({ ...form, tempPassword: event.target.value })} placeholder="Used only if a team login is created" /></Col>
          </Row>
          <Form.Label className="mt-2">Responsibilities</Form.Label>
          <Form.Control as="textarea" rows={2} value={form.responsibilities} onChange={(event) => setForm({ ...form, responsibilities: event.target.value })} />
          <Form.Check className="mt-3" label="Also create a TNP team login for this email" checked={form.createLogin} onChange={(event) => setForm({ ...form, createLogin: event.target.checked })} />
          <p className="small text-muted mt-2 mb-0">A student and a TNP member can share one email. If the email already has an account, they sign in with the password they already use.</p>
          <Button className="mt-3" type="submit">Save member</Button>
          {message && <p className={`mt-2 text-${messageTone}`}>{message}</p>}
        </Form>
      </Card>
      <PagedTable key={rosterKey} title="Roster" endpoint="/admin/team" columns={[
        { key: 'fullName', label: 'Name', render: (row) => row.fullName || 'Awaiting published record' },
        { key: 'teamRole', label: 'Seat' },
        { key: 'designation', label: 'Designation' },
        { key: 'remove', label: 'Remove', render: (row) => (
          <Button size="sm" variant="outline-danger" onClick={async () => {
            const res = await api.delete(`/admin/team/${row._id}`);
            if (res.data.mailWarning) window.alert(res.data.mailWarning);
            window.location.reload();
          }}>Suspend</Button>
        ) },
      ]} />
    </div>
  );
}

export function AdminCompanies() {
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [message, setMessage] = useState('');
  async function save(event) {
    event.preventDefault();
    try {
      await api.post('/admin/companies', { name, website, description: '', isActive: true });
      setMessage('Company created.');
      setName('');
      setWebsite('');
    } catch (err) {
      setMessage(messageFrom(err));
    }
  }
  return (
    <div>
      <h1 className="h3">Companies</h1>
      <Form onSubmit={save} className="mb-3" style={{ maxWidth: 720 }}>
        <Row className="g-2">
          <Col md={5}>
            <Form.Label>Company name</Form.Label>
            <Form.Control placeholder="Microsoft" required value={name} onChange={(event) => setName(event.target.value)} />
          </Col>
          <Col md={5}>
            <Form.Label>Know more link</Form.Label>
            <Form.Control type="url" placeholder="https://careers.microsoft.com" required value={website} onChange={(event) => setWebsite(event.target.value)} />
          </Col>
          <Col md={2} className="d-flex align-items-end">
            <Button type="submit">Add company</Button>
          </Col>
        </Row>
      </Form>
      {message && <p className="text-muted">{message}</p>}
      <PagedTable title="Directory" endpoint="/admin/companies" columns={[
        { key: 'name', label: 'Company' },
        { key: 'industry', label: 'Know more', render: (row) => row.website ? <a href={row.website} target="_blank" rel="noreferrer">Know more</a> : '—' },
        { key: 'end', label: 'Finished', render: (row) => (
          <Button size="sm" variant="outline-danger" onClick={async () => {
            await api.post(`/admin/companies/${row._id}/end`);
            window.location.reload();
          }}>Remove</Button>
        ) },
      ]} />
    </div>
  );
}

const DRIVE_ROLES = [
  'Software Development Engineer',
  'Software Development Engineer Intern',
  'Software Engineer',
  'Backend Developer',
  'Frontend Developer',
  'Full Stack Developer',
  'Data Analyst',
  'Data Scientist',
  'Machine Learning Engineer',
  'DevOps Engineer',
  'Associate Product Analyst',
];

export function AdminDrives() {
  const [companies, setCompanies] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [form, setForm] = useState({
    company: '',
    jobTitle: '',
    jobDescription: '',
    knowMoreUrl: '',
    minCgpa: 7,
    maxCgpa: '',
    minBacklogs: '',
    maxBacklogs: '',
    status: 'open',
    eligibleBranches: 'CSE,IT,ECE',
    applicationOpenAt: '',
    applicationDeadline: '',
    packageLpa: '',
    assignedTeamMembers: [],
  });
  const [message, setMessage] = useState('');
  useEffect(() => {
    api.get('/admin/companies', { params: { page: 1, limit: 50 } }).then((res) => setCompanies(res.data.items || []));
    api.get('/admin/roles', { params: { page: 1, limit: 50 } }).then((res) => {
      setTeamMembers((res.data.items || []).filter((item) => item.role === 'tnp_team' && item.isActive !== false));
    }).catch(() => setTeamMembers([]));
  }, []);
  async function save(event) {
    event.preventDefault();
    try {
      const minCgpa = Number(form.minCgpa);
      const maxCgpa = form.maxCgpa === '' ? null : Number(form.maxCgpa);
      const minBacklogs = form.minBacklogs === '' ? null : Number(form.minBacklogs);
      const maxBacklogs = form.maxBacklogs === '' ? null : Number(form.maxBacklogs);
      if (Number.isNaN(minCgpa) || minCgpa < 0 || minCgpa > 10) {
        setMessage('Enter a minimum CGPA between 0 and 10.');
        return;
      }
      if (maxCgpa != null && (Number.isNaN(maxCgpa) || maxCgpa < minCgpa || maxCgpa > 10)) {
        setMessage('Maximum CGPA must be between the minimum CGPA and 10.');
        return;
      }
      if (minBacklogs != null && maxBacklogs != null && maxBacklogs < minBacklogs) {
        setMessage('Maximum backlogs cannot be lower than the minimum.');
        return;
      }
      const payload = {
        company: form.company,
        jobTitle: form.jobTitle,
        jobDescription: form.jobDescription,
        minCgpa,
        status: form.status,
        eligibleBranches: form.eligibleBranches.split(',').map((item) => item.trim()).filter(Boolean),
        isDemonstration: false,
      };
      if (maxCgpa != null) payload.maxCgpa = maxCgpa;
      if (minBacklogs != null) payload.minBacklogs = minBacklogs;
      if (maxBacklogs != null) payload.maxBacklogs = maxBacklogs;
      if (form.knowMoreUrl) payload.knowMoreUrl = form.knowMoreUrl;
      if (form.applicationOpenAt) payload.applicationOpenAt = form.applicationOpenAt;
      if (form.applicationDeadline) payload.applicationDeadline = form.applicationDeadline;
      if (form.packageLpa !== '') payload.packageLpa = Number(form.packageLpa);
      if (form.assignedTeamMembers.length) payload.assignedTeamMembers = form.assignedTeamMembers;
      await api.post('/admin/drives', payload);
      setMessage('Drive saved.');
    } catch (err) {
      setMessage(messageFrom(err));
    }
  }
  return (
    <div>
      <h1 className="h3">Drives</h1>
      <Card className="stat-card p-3 mb-3">
        <Form onSubmit={save}>
          <Row className="g-2">
            <Col md={4}>
              <Form.Label>Company</Form.Label>
              <Form.Select required value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })}>
                <option value="">Select</option>
                {companies.map((company) => <option key={company._id} value={company._id}>{company.name}</option>)}
              </Form.Select>
            </Col>
            <Col md={4}>
              <Form.Label>Role</Form.Label>
              <Form.Select required value={form.jobTitle} onChange={(event) => setForm({ ...form, jobTitle: event.target.value })}>
                <option value="">Select role</option>
                {DRIVE_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
              </Form.Select>
            </Col>
            <Col md={2}><Form.Label>Min CGPA</Form.Label><Form.Control required type="number" min="0" max="10" step="0.01" value={form.minCgpa} onChange={(event) => setForm({ ...form, minCgpa: event.target.value })} /></Col>
            <Col md={2}><Form.Label>Max CGPA</Form.Label><Form.Control type="number" min="0" max="10" step="0.01" value={form.maxCgpa} onChange={(event) => setForm({ ...form, maxCgpa: event.target.value })} /></Col>
            <Col md={2}><Form.Label>Min backlogs</Form.Label><Form.Control type="number" min="0" max="20" step="1" value={form.minBacklogs} onChange={(event) => setForm({ ...form, minBacklogs: event.target.value })} /></Col>
            <Col md={2}><Form.Label>Max backlogs</Form.Label><Form.Control type="number" min="0" max="20" step="1" value={form.maxBacklogs} onChange={(event) => setForm({ ...form, maxBacklogs: event.target.value })} /></Col>
            <Col md={2}><Form.Label>Status</Form.Label><Form.Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>draft</option><option>open</option><option>closed</option></Form.Select></Col>
            <Col md={12}><Form.Label>Job description</Form.Label><Form.Control as="textarea" rows={5} required minLength={20} value={form.jobDescription} onChange={(event) => setForm({ ...form, jobDescription: event.target.value })} placeholder="Role, skills, and what the company expects" /></Col>
            <Col md={6}><Form.Label>Know more link</Form.Label><Form.Control type="url" value={form.knowMoreUrl} onChange={(event) => setForm({ ...form, knowMoreUrl: event.target.value })} placeholder="https://company.com/careers" /></Col>
            <Col md={4}><Form.Label>Branches</Form.Label><Form.Control value={form.eligibleBranches} onChange={(event) => setForm({ ...form, eligibleBranches: event.target.value })} placeholder="CSE,IT,ECE" /></Col>
            <Col md={4}><Form.Label>Opens</Form.Label><Form.Control type="datetime-local" value={form.applicationOpenAt} onChange={(event) => setForm({ ...form, applicationOpenAt: event.target.value })} /></Col>
            <Col md={4}><Form.Label>Closes</Form.Label><Form.Control type="datetime-local" value={form.applicationDeadline} onChange={(event) => setForm({ ...form, applicationDeadline: event.target.value })} /></Col>
            <Col md={2}><Form.Label>Package LPA</Form.Label><Form.Control type="number" min="0" step="0.01" value={form.packageLpa} onChange={(event) => setForm({ ...form, packageLpa: event.target.value })} /></Col>
            <Col md={6}>
              <Form.Label>TNP members who mark this drive</Form.Label>
              <Form.Select multiple value={form.assignedTeamMembers} onChange={(event) => setForm({ ...form, assignedTeamMembers: [...event.target.selectedOptions].map((option) => option.value) })}>
                {teamMembers.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.email}</option>)}
              </Form.Select>
            </Col>
          </Row>
          <Button className="mt-3" type="submit">Create drive</Button>
          {message && <p className="mt-2 text-muted">{message}</p>}
        </Form>
      </Card>
      <PagedTable title="All drives" endpoint="/admin/drives" columns={[
        { key: 'jobTitle', label: 'Drive' },
        { key: 'status', label: 'Status' },
        { key: 'branches', label: 'Eligibility', render: (row) => `CGPA ${row.minCgpa ?? '—'}–${row.maxCgpa ?? '—'} · backlogs ${row.minBacklogs ?? 0}–${row.maxBacklogs ?? '—'} · ${(row.eligibleBranches || []).join('/')}` },
        { key: 'deadline', label: 'Deadline', render: (row) => row.applicationDeadline ? new Date(row.applicationDeadline).toLocaleDateString() : '—' },
      ]} />
    </div>
  );
}

export function AdminApplications() {
  return <ApplicationReview />;
}

export function AdminStatistics() {
  const [form, setForm] = useState({
    recordType: 'overall_highest',
    batch: 2026,
    companyName: '',
    packageAmount: '',
    averageCtc: '',
    medianPackage: '',
    branch: 'OVERALL',
    sourceDocument: '',
    sourceDate: '',
    verificationStatus: 'provisional',
    metricNote: '',
  });
  const [message, setMessage] = useState('');
  const [analytics, setAnalytics] = useState(null);
  useEffect(() => {
    api.get('/admin/analytics').then((res) => setAnalytics(res.data)).catch(() => setAnalytics(null));
  }, []);
  async function save(event) {
    event.preventDefault();
    try {
      await api.post('/admin/records', {
        ...form,
        packageAmount: form.packageAmount === '' ? null : Number(form.packageAmount),
        averageCtc: form.averageCtc === '' ? null : Number(form.averageCtc),
        medianPackage: form.medianPackage === '' ? null : Number(form.medianPackage),
        batch: Number(form.batch),
      });
      setMessage('Record saved. The public statistics cache is cleared.');
    } catch (err) {
      setMessage(messageFrom(err));
    }
  }
  return (
    <div>
      <h1 className="h3">Statistics records</h1>
      <p className="text-muted">Published rows stay tied to their source. The tables under them count students actually marked placed in this portal.</p>
      <Row className="g-3 mb-3">
        <Col md={6}>
          <Card className="stat-card p-3">
            <h2 className="h6">Year-wise placed students</h2>
            {(analytics?.liveByBatch || []).map((row) => (
              <p key={row.batch} className="mb-1">Batch {row.batch}: {row.placed} placed{row.topPackage != null ? ` · top ${row.topPackage} LPA` : ''}</p>
            ))}
            {!analytics?.liveByBatch?.length && <p className="text-muted mb-0">No live placements yet.</p>}
          </Card>
        </Col>
        <Col md={6}>
          <Card className="stat-card p-3">
            <h2 className="h6">Company-wise offers</h2>
            {(analytics?.liveByCompany || []).map((row) => (
              <p key={row.company} className="mb-1">{row.company}: {row.offers}{row.topPackage != null ? ` · top ${row.topPackage} LPA` : ''}</p>
            ))}
            {!analytics?.liveByCompany?.length && <p className="text-muted mb-0">No live offers yet.</p>}
          </Card>
        </Col>
      </Row>
      <p className="text-muted">Highest package, average CTC, and median are separate fields. Each row keeps its source.</p>
      <Card className="stat-card p-3 mb-3">
        <Form onSubmit={save}>
          <Row className="g-2">
            <Col md={4}><Form.Label>Metric type</Form.Label><Form.Select value={form.recordType} onChange={(event) => setForm({ ...form, recordType: event.target.value })}><option value="overall_highest">Highest package</option><option value="branch_wise">Average or branch row</option></Form.Select></Col>
            <Col md={2}><Form.Label>Batch</Form.Label><Form.Control value={form.batch} onChange={(event) => setForm({ ...form, batch: event.target.value })} /></Col>
            <Col md={3}><Form.Label>Company</Form.Label><Form.Control value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} /></Col>
            <Col md={3}><Form.Label>Branch</Form.Label><Form.Select value={form.branch} onChange={(event) => setForm({ ...form, branch: event.target.value })}><option>OVERALL</option><option>CSE</option><option>IT</option><option>ECE</option></Form.Select></Col>
            <Col md={4}><Form.Label>Highest package LPA</Form.Label><Form.Control value={form.packageAmount} onChange={(event) => setForm({ ...form, packageAmount: event.target.value })} /></Col>
            <Col md={4}><Form.Label>Average CTC LPA</Form.Label><Form.Control value={form.averageCtc} onChange={(event) => setForm({ ...form, averageCtc: event.target.value })} /></Col>
            <Col md={4}><Form.Label>Median LPA</Form.Label><Form.Control value={form.medianPackage} onChange={(event) => setForm({ ...form, medianPackage: event.target.value })} /></Col>
            <Col md={6}><Form.Label>Source document</Form.Label><Form.Control required value={form.sourceDocument} onChange={(event) => setForm({ ...form, sourceDocument: event.target.value })} /></Col>
            <Col md={3}><Form.Label>Source date</Form.Label><Form.Control value={form.sourceDate} onChange={(event) => setForm({ ...form, sourceDate: event.target.value })} /></Col>
            <Col md={3}><Form.Label>Verification</Form.Label><Form.Select value={form.verificationStatus} onChange={(event) => setForm({ ...form, verificationStatus: event.target.value })}><option>provisional</option><option>verified</option></Form.Select></Col>
          </Row>
          <Button className="mt-3" type="submit">Add sourced record</Button>
          {message && <p className="mt-2 text-muted">{message}</p>}
        </Form>
      </Card>
      <PagedTable title="Stored rows" endpoint="/admin/records" columns={[
        { key: 'recordType', label: 'Metric', render: (row) => row.recordType === 'overall_highest' ? 'Highest package' : 'Average CTC row' },
        { key: 'batch', label: 'Batch' },
        { key: 'value', label: 'Value', render: (row) => row.packageAmount != null ? `${row.packageAmount} LPA highest` : row.averageCtc != null ? `${row.averageCtc} LPA average` : 'Awaiting published record' },
        { key: 'median', label: 'Median', render: (row) => row.medianPackage != null ? `${row.medianPackage} LPA` : 'Awaiting published record' },
        { key: 'source', label: 'Source', render: (row) => `${row.verificationStatus || 'provisional'} · ${row.sourceDate || row.sourceDocument}` },
      ]} />
    </div>
  );
}

export function AdminCriteria() {
  const [form, setForm] = useState({ title: '', eligibilityRequirements: '', status: 'draft', isOfficial: false });
  const [message, setMessage] = useState('');
  async function save(status) {
    try {
      await api.post('/admin/criteria', { ...form, status, isOfficial: status === 'published' });
      setMessage(status === 'published' ? 'Published.' : 'Draft saved.');
    } catch (err) {
      setMessage(messageFrom(err));
    }
  }
  return (
    <div>
      <h1 className="h3">Joining criteria editor</h1>
      <Card className="stat-card p-3" style={{ maxWidth: 640 }}>
        <Form onSubmit={(event) => { event.preventDefault(); save('draft'); }}>
          <Form.Label>Title</Form.Label>
          <Form.Control required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <Form.Label className="mt-2">Body</Form.Label>
          <Form.Control as="textarea" rows={4} value={form.eligibilityRequirements} onChange={(event) => setForm({ ...form, eligibilityRequirements: event.target.value })} />
          <div className="d-flex gap-2 mt-3">
            <Button type="submit">Save draft</Button>
            <Button type="button" variant="outline-primary" onClick={() => save('published')}>Publish</Button>
          </div>
          {message && <p className="mt-2 text-muted">{message}</p>}
        </Form>
      </Card>
    </div>
  );
}

export function AdminAnnouncements() {
  return (
    <div>
      <h1 className="h3">Announcements</h1>
      <AnnouncementForm />
      <PagedTable title="All notices" endpoint="/admin/announcements" columns={[
        { key: 'title', label: 'Title' },
        { key: 'audience', label: 'Audience' },
        { key: 'status', label: 'State' },
      ]} />
    </div>
  );
}

export function AdminRecruiters() {
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({ company: '', name: '', email: '' });
  const [message, setMessage] = useState('');
  useEffect(() => {
    api.get('/admin/companies', { params: { limit: 50, page: 1 } }).then((res) => setCompanies(res.data.items || []));
  }, []);
  async function save(event) {
    event.preventDefault();
    try {
      await api.post('/admin/recruiters', form);
      setMessage('Recruiter saved.');
    } catch (err) {
      setMessage(messageFrom(err));
    }
  }
  return (
    <div>
      <h1 className="h3">Recruiters</h1>
      <Form onSubmit={save} className="mb-3">
        <Row className="g-2">
          <Col md={4}><Form.Select required value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })}><option value="">Company</option>{companies.map((company) => <option key={company._id} value={company._id}>{company.name}</option>)}</Form.Select></Col>
          <Col md={4}><Form.Control required placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Col>
          <Col md={4}><Form.Control placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Col>
        </Row>
        <Button className="mt-2" type="submit">Save recruiter</Button>
        {message && <p className="text-muted mt-2">{message}</p>}
      </Form>
      <PagedTable title="Contacts" endpoint="/admin/recruiters" columns={[
        { key: 'name', label: 'Name' },
        { key: 'company', label: 'Company', render: (row) => row.company?.name || 'Awaiting published record' },
        { key: 'email', label: 'Email', render: (row) => row.email || 'Awaiting published record' },
      ]} />
    </div>
  );
}

export function AdminRoles() {
  return <PagedTable title="Roles and permissions" hint="Students keep their own profile. Team permissions are edited per account." endpoint="/admin/roles" columns={[
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
    { key: 'permissions', label: 'Can do', render: (row) => (row.permissions || []).join(', ') || '—' },
    { key: 'edit', label: 'Update', render: (row) => <RoleEditor user={row} /> },
  ]} />;
}

function RoleEditor({ user }) {
  const [permissions, setPermissions] = useState(user.permissions || []);
  function toggle(permission) {
    setPermissions((current) => current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission]);
  }
  async function save() {
    await api.patch(`/admin/roles/${user.id}`, { permissions });
  }
  return (
    <div>
      {PERMISSIONS.map((permission) => (
        <Form.Check key={permission} inline label={permission} checked={permissions.includes(permission)} onChange={() => toggle(permission)} />
      ))}
      <Button size="sm" className="mt-2" onClick={save}>Save</Button>
    </div>
  );
}

export function AdminImport() {
  const [type, setType] = useState('companies');
  const [message, setMessage] = useState('');
  async function download(format) {
    if (format === 'csv') {
      const res = await api.get('/admin/export', { params: { type, format: 'csv' }, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }
    const { data } = await api.get('/admin/export', { params: { type } });
    const blob = new Blob([JSON.stringify(data.items || [], null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${type}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const items = JSON.parse(text);
      const { data } = await api.post('/admin/import', { type, items });
      setMessage(`Imported ${data.count} records.`);
    } catch (err) {
      setMessage(messageFrom(err));
    }
  }
  return (
    <div>
      <h1 className="h3">Import / export</h1>
      <Row className="g-3">
        <Col md={6}>
          <Card className="stat-card p-3">
            <h2 className="h6">Export</h2>
            <Form.Select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="companies">Companies</option>
              <option value="drives">Drives</option>
              <option value="records">Placement records</option>
              <option value="announcements">Announcements</option>
              <option value="applications">Applications</option>
            </Form.Select>
            <div className="d-flex gap-2 mt-3">
              <Button onClick={() => download('json')}>Download JSON</Button>
              <Button variant="outline-primary" onClick={() => download('csv')}>Download CSV</Button>
            </div>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="stat-card p-3">
            <h2 className="h6">Import</h2>
            <p className="text-muted">Up to 200 validated rows. Companies and placement records only.</p>
            <Form.Control type="file" accept="application/json" onChange={upload} />
            {message && <p className="mt-2 text-muted">{message}</p>}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export function AdminAudit() {
  return <PagedTable title="Audit log" endpoint="/admin/audit" columns={[
    { key: 'createdAt', label: 'When', render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleString() : '—' },
    { key: 'action', label: 'Action' },
    { key: 'resource', label: 'Target' },
  ]} />;
}

export function AdminHealth() {
  const [health, setHealth] = useState(null);
  const { features } = useAuth();
  useEffect(() => {
    api.get('/admin/health').then((res) => setHealth(res.data));
  }, []);
  return (
    <div>
      <h1 className="h3">System health</h1>
      <Row className="g-3">
        <Col md={3}><Metric label="API" value="Up" /></Col>
        <Col md={3}><Metric label="MongoDB" value={health?.mongo ? 'Up' : 'Down'} /></Col>
        <Col md={3}><Metric label="Redis" value={health?.redis ? 'Up' : 'Down'} hint="Sessions, OTP, and rate limits" /></Col>
        <Col md={3}><Metric label="OpenAI" value={features.openai ? 'Configured' : 'Off'} /></Col>
      </Row>
      <Card className="stat-card p-3 mt-3">
        <h2 className="h6">Integrations</h2>
        <p className="mb-0">Cloudinary: {features.cloudinary ? 'configured' : 'idle until keys are present'}. Mail: {features.smtp ? 'configured' : 'password reset email stays off until the mail host is set'}. Email OTP: {features.emailOtp ? 'configured' : 'needs the SMTP settings'}.</p>
      </Card>
    </div>
  );
}
