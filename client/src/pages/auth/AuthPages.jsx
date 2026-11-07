import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, Form } from 'react-bootstrap';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext.jsx';
import { useFlash } from '../../context/FlashContext.jsx';

function destination(user, portal) {
  if (portal === 'admin') return '/admin';
  if (portal === 'tnp_team') return '/tnp';
  if (portal === 'student') return '/student';
  if (user?.role === 'admin') return '/admin';
  if (user?.role === 'tnp_team' || user?.tnpTeam) return '/tnp';
  return '/student';
}

function Shell({ title, children }) {
  return (
    <div className="login-split">
      <div className="login-visual p-5 d-flex flex-column justify-content-center">
        <div className="mb-3">IIIT Bhopal</div>
        <h1 className="display-5 fw-bold">Your future starts here</h1>
        <p className="mb-0">Pick Student, TNP member, or Admin. The account must belong to that portal.</p>
      </div>
      <div className="d-flex align-items-center justify-content-center p-4">
        <Card className="stat-card p-4" style={{ width: 'min(440px, 100%)' }}>
          <h2 className="h4">{title}</h2>
          {children}
        </Card>
      </div>
    </div>
  );
}

export function Login() {
  const { login, refresh } = useAuth();
  const navigate = useNavigate();
  const flash = useFlash();
  const [portal, setPortal] = useState('student');
  const [mode, setMode] = useState('password');
  const [form, setForm] = useState({ email: '', password: '', otp: '' });
  const [otpChallengeId, setOtpChallengeId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      if (mode === 'password') {
        const user = await login({ email: form.email, password: form.password, portal });
        navigate(destination(user, portal));
      } else {
        let challengeId = otpChallengeId;
        if (!challengeId) {
          const verified = await api.post('/auth/otp/verify', { email: form.email, purpose: 'login', otp: form.otp });
          challengeId = verified.data.otpChallengeId;
          setOtpChallengeId(challengeId);
        }
        const { data } = await api.post('/auth/login-otp', { email: form.email, otpChallengeId: challengeId, portal });
        flash.push(data.flash);
        await refresh();
        navigate(destination(data.user, portal));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Sign in failed.');
      flash.push(err.response?.data?.flash);
    }
  }

  async function sendLoginOtp() {
    setError('');
    setNotice('');
    if (!form.email) {
      setError('Please enter your email first.');
      return;
    }
    setSendingOtp(true);
    try {
      const { data } = await api.post('/auth/otp/send', { email: form.email, purpose: 'login' });
      if (data.devOtp) {
        setForm((prev) => ({ ...prev, otp: data.devOtp }));
        setNotice(`OTP code: ${data.devOtp} (Auto-filled for demonstration)`);
      } else {
        setNotice('OTP sent to your email address.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send OTP.');
    } finally {
      setSendingOtp(false);
    }
  }

  return (
    <Shell title="Welcome back">
      <div className="btn-group w-100 mb-3">
        {[
          ['student', 'Student'],
          ['tnp_team', 'TNP member'],
          ['admin', 'Admin'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`btn btn-sm ${portal === value ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => { setPortal(value); setError(''); }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="btn-group w-100 mb-3">
        <button
          type="button"
          className={`btn btn-sm ${mode === 'password' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => { setMode('password'); setError(''); setNotice(''); }}
        >
          Password Login
        </button>
        <button
          type="button"
          className={`btn btn-sm ${mode === 'otp' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => { setMode('otp'); setError(''); setNotice(''); }}
        >
          Email OTP Login
        </button>
      </div>
      <Form onSubmit={submit}>
        <Form.Label>Email</Form.Label>
        <Form.Control type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        
        {mode === 'password' ? (
          <>
            <Form.Label className="mt-3">Password</Form.Label>
            <Form.Control type="password" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </>
        ) : (
          <>
            <Form.Label className="mt-3">Email OTP</Form.Label>
            <div className="d-flex gap-2">
              <Form.Control type="text" placeholder="Enter 6-digit OTP" required value={form.otp} onChange={(event) => setForm({ ...form, otp: event.target.value })} />
              <Button type="button" variant="outline-primary" disabled={sendingOtp} onClick={sendLoginOtp}>
                {sendingOtp ? 'Sending...' : 'Send OTP'}
              </Button>
            </div>
          </>
        )}

        {notice && <div className="alert alert-info mt-3 mb-0">{notice}</div>}
        {error && <div className="alert alert-warning mt-3 mb-0">{error}</div>}
        
        <div className="mt-3 d-flex justify-content-between">
          <Link to="/forgot-password">Forgot password?</Link>
          <Link to="/">Home</Link>
        </div>
        <Button className="mt-3 w-100" type="submit">Login</Button>
        <p className="mt-3 mb-0 text-muted">{portal === 'student' ? <>No account? <Link to="/signup">Sign up</Link></> : 'This portal uses an account created by the administrator.'}</p>
      </Form>
    </Shell>
  );
}

export function Signup() {
  const navigate = useNavigate();
  const flash = useFlash();
  const { refresh } = useAuth();
  const [form, setForm] = useState({
    name: '',
    enrollmentNumber: '',
    branch: 'CSE',
    batch: 2027,
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    otp: '',
    otpChallengeId: '',
    termsAccepted: false,
  });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef(null);

  function set(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startCountdown(seconds) {
    setCountdown(seconds);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  async function sendOtp() {
    setError('');
    setNotice('');
    if (!form.email) {
      setError('Please enter your email first.');
      return;
    }
    setSendingOtp(true);
    try {
      const { data } = await api.post('/auth/otp/send', { email: form.email, purpose: 'signup' });
      setOtpSent(true);
      startCountdown(60);
      if (data.devOtp) {
        set('otp', data.devOtp);
        setNotice(`OTP code: ${data.devOtp} (Auto-filled for demonstration)`);
        return;
      }
      const msg = otpSent ? 'OTP resent to your email inbox.' : 'OTP sent to your email inbox.';
      setNotice(msg);
      flash.push({ type: 'info', text: msg });
    } catch (err) {
      setError(err.response?.data?.message || 'OTP could not be sent.');
    } finally {
      setSendingOtp(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    // Bootstrap validation
    event.target.classList.add('was-validated');
    if (!event.target.checkValidity()) return;

    try {
      let otpChallengeId = form.otpChallengeId;
      if (!otpChallengeId) {
        const verified = await api.post('/auth/otp/verify', { email: form.email, purpose: 'signup', otp: form.otp });
        otpChallengeId = verified.data.otpChallengeId;
      }
      await api.post('/auth/signup', { ...form, otpChallengeId, termsAccepted: true });
      flash.push({ type: 'success', text: 'Account created successfully! Welcome to TNP Portal.' });
      await refresh();
      navigate('/student');
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed.');
      flash.push({ type: 'danger', text: err.response?.data?.message || 'Signup failed. Please check your details.' });
    }
  }

  return (
    <Shell title="Create a student account">
      <Form noValidate onSubmit={submit}>
        <Form.Group className="mb-2">
          <Form.Label>Full Name</Form.Label>
          <Form.Control
            required
            minLength={2}
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
            placeholder="Enter your full name"
          />
          <Form.Control.Feedback type="invalid">Please enter your full name.</Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-2">
          <Form.Label>Roll / Enrollment Number</Form.Label>
          <Form.Control
            required
            value={form.enrollmentNumber}
            onChange={(event) => set('enrollmentNumber', event.target.value)}
            placeholder="e.g. 2100030"
          />
          <Form.Control.Feedback type="invalid">Enrollment number is required.</Form.Control.Feedback>
        </Form.Group>

        <div className="row g-2 mb-2">
          <div className="col">
            <Form.Group>
              <Form.Label>Branch</Form.Label>
              <Form.Select value={form.branch} onChange={(event) => set('branch', event.target.value)}>
                <option>CSE</option>
                <option>IT</option>
                <option>ECE</option>
              </Form.Select>
            </Form.Group>
          </div>
          <div className="col">
            <Form.Group>
              <Form.Label>Batch (Year)</Form.Label>
              <Form.Control
                type="number"
                min={2020}
                max={2035}
                required
                value={form.batch}
                onChange={(event) => set('batch', Number(event.target.value))}
              />
              <Form.Control.Feedback type="invalid">Enter a valid batch year.</Form.Control.Feedback>
            </Form.Group>
          </div>
        </div>

        <Form.Group className="mb-2">
          <Form.Label>Phone</Form.Label>
          <Form.Control
            required
            pattern="[6-9][0-9]{9}"
            value={form.phone}
            onChange={(event) => set('phone', event.target.value)}
            placeholder="10-digit mobile number"
          />
          <Form.Control.Feedback type="invalid">Enter a valid 10-digit Indian mobile number.</Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-2">
          <Form.Label>Email</Form.Label>
          <div className="d-flex gap-2">
            <Form.Control
              type="email"
              required
              value={form.email}
              onChange={(event) => set('email', event.target.value)}
              placeholder="@gmail.com or @iiitbhopal.ac.in"
            />
            <Button
              type="button"
              variant={otpSent ? 'outline-secondary' : 'outline-primary'}
              onClick={sendOtp}
              disabled={sendingOtp || countdown > 0}
              style={{ whiteSpace: 'nowrap' }}
            >
              {sendingOtp ? 'Sending…' : otpSent ? (countdown > 0 ? `Resend (${countdown}s)` : 'Resend OTP') : 'Send OTP'}
            </Button>
          </div>
          <div className="form-text">Use @gmail.com or @iiitbhopal.ac.in. OTP valid for 10 minutes.</div>
        </Form.Group>

        <Form.Group className="mb-2">
          <Form.Label>Email OTP</Form.Label>
          <Form.Control
            required
            minLength={4}
            maxLength={8}
            value={form.otp}
            onChange={(event) => set('otp', event.target.value)}
            placeholder="Enter 6-digit OTP"
          />
          <Form.Control.Feedback type="invalid">Please enter the OTP sent to your email.</Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-2">
          <Form.Label>Password</Form.Label>
          <Form.Control
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(event) => set('password', event.target.value)}
            placeholder="Minimum 8 characters"
          />
          <Form.Control.Feedback type="invalid">Password must be at least 8 characters.</Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Confirm Password</Form.Label>
          <Form.Control
            type="password"
            required
            value={form.confirmPassword}
            onChange={(event) => set('confirmPassword', event.target.value)}
            placeholder="Re-enter password"
            isInvalid={form.confirmPassword.length > 0 && form.confirmPassword !== form.password}
          />
          <Form.Control.Feedback type="invalid">Passwords do not match.</Form.Control.Feedback>
        </Form.Group>

        <Form.Check
          className="mb-3"
          required
          label="I accept the portal terms and conditions"
          checked={form.termsAccepted}
          onChange={(event) => set('termsAccepted', event.target.checked)}
          feedback="You must accept the terms to continue."
          feedbackType="invalid"
        />

        {notice && <div className="alert alert-info py-2 mb-2"><i className="bi bi-envelope-check me-2" />{notice}</div>}
        {error && <div className="alert alert-danger py-2 mb-2"><i className="bi bi-exclamation-circle me-2" />{error}</div>}

        <Button className="w-100 mt-1" type="submit">
          <i className="bi bi-person-check me-2" />Verify &amp; Create Account
        </Button>
        <p className="mt-3 mb-0 text-center"><Link to="/login">Already registered? Sign in</Link></p>
      </Form>
    </Shell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setMessage(data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset could not be started.');
    }
  }

  return (
    <Shell title="Reset password">
      <p className="text-muted">A single-use link goes to the account email when mail is configured. The link expires and cannot be reused.</p>
      <Form onSubmit={submit}>
        <Form.Label>Email</Form.Label>
        <Form.Control type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        {message && <div className="alert alert-info mt-3">{message}</div>}
        {error && <div className="alert alert-warning mt-3">{error}</div>}
        <Button className="mt-3" type="submit">Send reset link</Button>
        <p className="mt-3 mb-0"><Link to="/login">Back to sign in</Link></p>
      </Form>
    </Shell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    try {
      await api.post('/auth/reset-password', { token: params.get('token'), password, confirmPassword });
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'This reset link is invalid or has expired.');
    }
  }

  return (
    <Shell title="Choose a new password">
      <Form onSubmit={submit}>
        <Form.Label>New password</Form.Label>
        <Form.Control type="password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        <Form.Label className="mt-2">Confirm password</Form.Label>
        <Form.Control type="password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
        {error && <div className="alert alert-warning mt-3">{error}</div>}
        <Button className="mt-3" type="submit">Update password</Button>
      </Form>
    </Shell>
  );
}
