import React from 'react';
import { Container, Card } from 'react-bootstrap';

export default function About() {
  return (
    <Container className="py-4">
      <Card className="stat-card p-4">
        <h2>About the Training and Placement Cell</h2>
        <p>
          IIIT Bhopal is an Institute of National Importance. The T&P Cell coordinates campus recruitment, internships
          and related student support from Room No TB-201, New Teaching Block, MANIT campus, Bhopal.
        </p>
        <p>
          This portal is a college minor-project implementation. Official statistics shown in the app are copied from
          the IIIT Bhopal T&P Cell document dated 15 April 2026. The bundled brochure PDF is image-based and was not
          fully machine-readable, so brochure-only claims are not invented here.
        </p>
        <p className="mb-0">
          Public TNP team names and joining rules remain placeholders until the institute provides an authorized roster
          and policy.
        </p>
      </Card>
    </Container>
  );
}
