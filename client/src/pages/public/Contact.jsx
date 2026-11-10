import React, { useEffect, useState } from 'react';
import { Card, Col, Container, Form, Row } from 'react-bootstrap';
import api from '../../services/api';
import { useFlash } from '../../context/FlashContext.jsx';

export default function Contact() {
  const [info, setInfo] = useState(null);
  const [validated, setValidated] = useState(false);
  const flash = useFlash();
  useEffect(() => {
    api.get('/contact').then((res) => setInfo(res.data.contact));
  }, []);
  const onSubmit = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      e.stopPropagation();
      setValidated(true);
      return;
    }
    flash.push({ type: 'info', text: 'Use the published phone number to reach the T&P cell.' });
  };
  return (
    <Container className="py-4">
      <Row className="g-3">
        <Col md={6}>
          <Card className="stat-card p-4">
            <h2>Contact</h2>
            <p>{info?.office}</p>
            <p>{info?.campus}</p>
            <p>Phone: {info?.phone}</p>
            <p>Email: {info?.email}</p>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="stat-card p-4">
            <h5>Message the cell</h5>
            <Form noValidate validated={validated} onSubmit={onSubmit} className={validated ? 'was-validated' : 'needs-validation'}>
              <Form.Group className="mb-2">
                <Form.Label>Name</Form.Label>
                <Form.Control required minLength={2} />
                <Form.Control.Feedback type="invalid">Name is required.</Form.Control.Feedback>
              </Form.Group>
              <Form.Group className="mb-2">
                <Form.Label>Email</Form.Label>
                <Form.Control type="email" required />
                <Form.Control.Feedback type="invalid">Enter a valid email.</Form.Control.Feedback>
              </Form.Group>
              <Form.Group className="mb-2">
                <Form.Label>Message</Form.Label>
                <Form.Control as="textarea" required minLength={10} />
              </Form.Group>
              <button className="btn btn-primary" type="submit">
                Send
              </button>
            </Form>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
