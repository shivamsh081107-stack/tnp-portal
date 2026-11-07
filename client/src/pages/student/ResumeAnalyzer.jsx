import React, { useEffect, useState } from 'react';
import { Button, Card, Col, Form, ProgressBar, Row, Spinner } from 'react-bootstrap';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext.jsx';

const PRESETS = [
  {
    name: 'Software Engineer Intern',
    jd: `Software Development Engineer Intern
Required skills: Data Structures, Algorithms, Java, C++, SQL, Object Oriented Programming, Git
Good to have: Spring Boot, REST APIs, Microservices
Minimum CGPA: 7.5, Branch: CSE or IT`,
  },
  {
    name: 'Full Stack Web Developer',
    jd: `Full Stack Engineer - Fresher
Required skills: JavaScript, React, Node.js, Express, MongoDB, REST APIs, HTML, CSS, Git
Good to have: TypeScript, Redux, Docker, AWS
Minimum CGPA: 7.0, Branches: CSE, IT, ECE`,
  },
  {
    name: 'Data Analyst / ML Engineer',
    jd: `Data Analyst / Applied ML
Required skills: Python, SQL, Pandas, NumPy, Machine Learning, Data Visualization, Git
Good to have: Tableau, PowerBI, Scikit-Learn
Minimum CGPA: 7.0, Branches: CSE, IT, ECE`,
  },
];

const DEFAULT_RESUME = `Name: Rahul Sharma | Roll: IIITB-CSE-2027-0012
Branch: Computer Science and Engineering, IIIT Bhopal | Batch: 2027 | CGPA: 8.2

SKILLS
Programming: Java, C++, JavaScript, Python, SQL
Web & Frameworks: React, Node.js, Express, REST APIs, HTML5, CSS3
Tools & DB: Git, GitHub, MongoDB, MySQL, VS Code
Core CS: Data Structures & Algorithms, Object-Oriented Programming, DBMS, Operating Systems

PROJECTS
• Placement Management Portal (MERN Stack, Redis, REST APIs)
  - Developed full-stack placement portal with role-based auth, resume scoring, and live application tracking.
  - Implemented secure session handling and Redis caching for sub-50ms query responses.
• Campus Event Manager (React, Firebase)
  - Designed responsive UI and integrated real-time notifications for 500+ student users.

EDUCATION & COURSEWORK
B.Tech in Computer Science, IIIT Bhopal (2023 - 2027)
Relevant Coursework: Data Structures, Analysis of Algorithms, Database Systems, Computer Networks.`;

export default function ResumeAnalyzer() {
  const { user, profile } = useAuth();
  const [drives, setDrives] = useState([]);
  const [driveId, setDriveId] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [resumeText, setResumeText] = useState(DEFAULT_RESUME);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get('/student/drives')
      .then((res) => setDrives(res.data.drives || res.data.items || []))
      .catch(() => setDrives([]));
  }, []);

  function loadProfileData() {
    if (!profile) {
      setResumeText(DEFAULT_RESUME);
      return;
    }
    const skills = (profile.skills || ['JavaScript', 'React', 'Node.js', 'DSA', 'SQL']).join(', ');
    const text = `Name: ${user?.name || 'Student'} | Roll: ${profile.enrollmentNumber || 'IIITB-001'}
Branch: ${profile.branch || 'CSE'}, IIIT Bhopal | Batch: ${profile.batch || 2027} | CGPA: ${profile.cgpa ?? 8.0}

TECHNICAL SKILLS:
${skills}

PROJECTS & EXPERIENCE:
• Full Stack Web Application: Developed using modern web technologies, responsive UI, database integration, REST APIs, and version control with Git.
• Algorithms Practice: Solved 200+ problems on Data Structures, Arrays, Dynamic Programming, and Graph algorithms.

COURSEWORK:
Operating Systems, Database Management Systems (DBMS), Computer Networks, Object Oriented Programming.`;
    setResumeText(text);
  }

  async function analyze(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const body = { resumeText };
      if (driveId) body.driveId = driveId;
      else if (jobDescription.trim()) body.jobDescription = jobDescription.trim();
      const res = await api.post('/ai/resume-analyze', body);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Analysis failed. Please check inputs.');
    } finally {
      setBusy(false);
    }
  }

  async function parsePdf(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await api.post('/ai/resume-parse', body);
      setResumeText(res.data.text || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not read this PDF.');
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  const analysis = result?.analysis;
  const score = analysis?.matchScore ?? 0;
  const scoreVariant = score >= 75 ? 'success' : score >= 50 ? 'primary' : 'warning';

  return (
    <div>
      <div className="d-flex align-items-center gap-2 mb-2">
        <i className="bi bi-file-earmark-check fs-4 text-primary" />
        <h1 className="h3 mb-0">AI Resume & Job Match Analyzer</h1>
      </div>
      <p className="text-muted">
        Add a job description to get an ATS match score. Leave the job description empty for a normal resume review, with no ATS score.
      </p>

      <div className="d-flex flex-wrap gap-2 mb-3">
        <span className="small text-muted align-self-center me-1">Sample Job Descriptions:</span>
        {PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => {
              setDriveId('');
              setJobDescription(p.jd);
            }}
          >
            {p.name}
          </button>
        ))}
        <button
          type="button"
          className="btn btn-outline-info btn-sm ms-auto"
          onClick={loadProfileData}
        >
          <i className="bi bi-person-badge me-1" /> Load My Profile Skills
        </button>
      </div>

      <Form onSubmit={analyze}>
        <Row className="g-3">
          <Col lg={6}>
            <Form.Label className="fw-semibold">Select Drive or Custom JD</Form.Label>
            <Form.Select value={driveId} onChange={(event) => setDriveId(event.target.value)}>
              <option value="">Paste / Edit Job Description Below</option>
              {drives.map((drive) => (
                <option key={drive._id} value={drive._id}>
                  {drive.company?.name || 'Company'} · {drive.jobTitle}
                </option>
              ))}
            </Form.Select>
            <Form.Label className="mt-3 fw-semibold">Job description</Form.Label>
            <Form.Control
              as="textarea"
              rows={9}
              value={jobDescription}
              disabled={Boolean(driveId)}
              onChange={(event) => setJobDescription(event.target.value)}
              placeholder="Paste a job description for an ATS score. Leave this empty for a normal review."
            />
          </Col>
          <Col lg={6}>
            <Form.Label className="fw-semibold">Resume text</Form.Label>
            <Form.Control className="mb-2" type="file" accept="application/pdf" onChange={parsePdf} />
            <div className="d-flex gap-2 mb-2">
              <Button type="button" size="sm" variant="outline-secondary" onClick={loadProfileData}>Load profile skills</Button>
              {profile?.resumeText && (
                <Button type="button" size="sm" variant="outline-secondary" onClick={() => setResumeText(profile.resumeText)}>Use uploaded PDF text</Button>
              )}
            </div>
            <Form.Control
              as="textarea"
              rows={12}
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value)}
              placeholder="Paste your resume text here..."
              required
            />
          </Col>
        </Row>
        <div className="mt-3 d-flex gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? <Spinner size="sm" className="me-1" /> : <i className="bi bi-magic me-1" />}
            {jobDescription.trim() || driveId ? 'Check ATS match' : 'Review resume'}
          </Button>
        </div>
      </Form>

      {error && <div className="alert alert-warning mt-3">{error}</div>}

      {analysis && result?.mode !== 'ats' && (
        <Row className="g-3 mt-2">
          <Col xs={12}>
            <Card className="stat-card p-4">
              <h2 className="h5 mb-2">Resume review</h2>
              <p className="mb-2">{analysis.summary}</p>
              {result.note && <div className="small text-muted">{result.note}</div>}
            </Card>
          </Col>
          <Col md={6}>
            <Card className="stat-card p-3 h-100">
              <h2 className="h6 text-success">What is working</h2>
              <ul className="mb-0">{(analysis.strengths || []).map((item) => <li key={item}>{item}</li>)}</ul>
            </Card>
          </Col>
          <Col md={6}>
            <Card className="stat-card p-3 h-100">
              <h2 className="h6 text-warning">What to improve</h2>
              <ul className="mb-0">{(analysis.improvements || analysis.suggestions || []).map((item) => <li key={item}>{item}</li>)}</ul>
            </Card>
          </Col>
        </Row>
      )}

      {analysis && result?.mode === 'ats' && (
        <Row className="g-3 mt-2">
          <Col md={4}>
            <Card className="stat-card p-4 text-center h-100">
              <div className="text-muted small text-uppercase fw-semibold mb-1">ATS Match Score</div>
              <div className={`display-4 fw-bold text-${scoreVariant}`}>{score}%</div>
              <ProgressBar now={score} variant={scoreVariant} className="my-3" style={{ height: '10px' }} />
              <div className="small text-muted">
                {result.provider === 'openai' ? 'OpenAI GPT-4o Analysis' : 'Intelligent ATS Keyword Matcher'}
              </div>
            </Card>
          </Col>
          <Col md={8}>
            <Card className="stat-card p-4 h-100">
              <h2 className="h5 mb-2">Executive Summary</h2>
              <p className="lead fs-6 mb-2">{analysis.summary}</p>
              {result.note && <div className="small text-muted">{result.note}</div>}
              {result.drive?.isDemonstration && (
                <div className="badge bg-secondary mt-2">Sample / Demo Drive Listing</div>
              )}
            </Card>
          </Col>
          <Col md={6}>
            <Card className="stat-card p-3 h-100">
              <h2 className="h6 text-success d-flex align-items-center gap-1">
                <i className="bi bi-check-circle-fill" /> Matched Skills & Keywords ({analysis.matched?.length || 0})
              </h2>
              <div className="d-flex flex-wrap gap-1 mt-2">
                {(analysis.matched || []).map((item) => (
                  <span key={item} className="badge bg-success bg-opacity-75 p-2">
                    {item}
                  </span>
                ))}
                {!analysis.matched?.length && (
                  <div className="text-muted small">No direct keyword overlap found.</div>
                )}
              </div>
            </Card>
          </Col>
          <Col md={6}>
            <Card className="stat-card p-3 h-100">
              <h2 className="h6 text-warning d-flex align-items-center gap-1">
                <i className="bi bi-exclamation-triangle-fill" /> Missing / Recommended Skills ({analysis.missing?.length || 0})
              </h2>
              <div className="d-flex flex-wrap gap-1 mt-2">
                {(analysis.missing || []).map((item) => (
                  <span key={item} className="badge bg-warning text-dark p-2">
                    {item}
                  </span>
                ))}
              </div>
            </Card>
          </Col>
          <Col xs={12}>
            <Card className="stat-card p-3">
              <h2 className="h6 mb-2 d-flex align-items-center gap-1 text-primary">
                <i className="bi bi-lightbulb-fill" /> Actionable Resume Suggestions
              </h2>
              <ul className="mb-0 ps-3">
                {(analysis.suggestions || []).map((item) => (
                  <li key={item} className="mb-1 text-secondary">
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
}
