# IIIT Bhopal TNP Portal

A full-stack Training and Placement portal for IIIT Bhopal. Students, the Training and Placement (TNP) team, and administrators share one site for campus recruitment.

Students see drives they are allowed to apply to, upload a resume, and follow each application. TNP members review the drives assigned to them. Administrators publish companies, drives, team accounts, and placement records.

The site runs at [http://localhost:5173/](http://localhost:5173/). The API listens on port 5000.

## Features

### Student portal

- Registration with a 6-digit email OTP. Signup accepts `@gmail.com` and `@iiitbhopal.ac.in`.
- Dashboard of open drives, with eligibility shown on each card.
- Profile and academic fields the student can edit.
- One PDF resume, up to 5 MB, required before an application is accepted.
- Drive page with role, eligibility, and package when the drive has one.
- Apply only when the server says the student is eligible and the drive is open.
- Tracker stages: Applied, Shortlisted, Online assessment, Interview, and Offer. The server rejects a status jump.
- Drive calendar at `/student/calendar` groups open drives by deadline. A notice is added when a drive closes within three days and the student has not applied.
- A resume must be a real PDF. The file header is checked, not only the name.
- In-app notices when a status changes.
- Email when the student clears the online assessment, and a congratulations email on final selection.
- If the online assessment is not cleared, the tracker shows **oops** and that company is disabled for that student only.

If the mail provider rejects the sender, local signup still fills the OTP into the form so registration can continue.

### Admin dashboard

- Add companies. **Remove** closes that company’s open drives and takes the company off the public list.
- Create a drive with role, branches, open and close times, package in LPA, and the TNP members who will mark results. Hold Ctrl to assign more than one member. Students see a drive when its status is `open`.
- Create a TNP login from **TNP Team**. **Suspend** removes the member, disables that login, and emails that they are suspended.
- Move an application as far as online assessment. The admin does not mark who cleared that round.
- **Students** splits unplaced students from placed students. Placed rows are grouped by batch and sorted by package, highest first.
- **Statistics** stores highest package, average CTC, and median as separate rows. A median is shown only when a sourced row includes it.
- Search on student, company, drive, and application lists. Each list loads one page at a time.
- **Import / export** downloads companies, drives, placement records, announcements, or applications as JSON or CSV.
- **Statistics** also shows live year-wise placed counts and company-wise offers from students marked placed in the portal. Published highest, average, and median rows stay separate and keep their source.

### TNP team portal

- Sees only drives assigned on the drive form.
- **Application Review** lists students waiting in online assessment.
- **Selected** emails the student and activates the interview round.
- **Not selected** records **oops** and disables that company for that student.
- Students in the interview round can be given a time, online or onsite, and a place or link. That email is separate from an online-assessment miss. **Not selected in interview** does not disable the company.
- The waiting list updates as soon as a row is marked.
- Placement page shows the same unplaced list and the batch-wise placed list.

### Placement figures

Public statistics come from published placement records, not from a live recalculation of every application.

- Home and the statistics page show the highest package, average CTC, and median when a record includes that field.
- Branch-wise rows keep batch, placed count, and placement percentage from the source document.
- The admin student page is the live placed and unplaced view, grouped by batch and ordered by package.

The seeded public figures are the IIIT Bhopal T&P statistics dated 15 April 2026. A missing median stays “Awaiting published record”.

### Application workflow

- Each status change is stored with a timestamp.
- Online assessment, interview, rejection, and final selection are different outcomes.
- Final selection (`selected` or `offer`) moves the student from unplaced to placed.
- Closing the last open drive for a company, or pressing **Remove** on the company, takes that company off the public directory.

### Deadlines and notifications

- A drive stores when applications open and when they close. Upcoming drives appear on the student dashboard.
- The student notification inbox records status changes.
- Email is used for OTP, online-assessment clearance, final selection, and TNP suspension.

The calendar lists deadlines. It does not book interview rooms by itself. The interview time is saved on the application.

### Eligibility

- A drive can limit branch, batch, minimum CGPA, maximum backlogs, and the application window.
- The drive card tells the student why they cannot apply.
- The server checks eligibility again when the application is submitted.
- A student cannot apply twice to the same drive, or apply without a resume, or apply after the company has been disabled for them.

## Technology stack

### Frontend

- React
- Vite
- React Router
- Redux Toolkit
- Bootstrap 5
- Tailwind CSS utilities

### Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- Passport
- Redis-backed sessions
- Joi
- Nodemailer

## Architecture

- **Client.** Screens, forms, and the application tracker. Lists keep only the current page in Redux.
- **Server.** Authentication, role checks, validation, eligibility, and recruitment actions.
- **MongoDB.** Users, companies, drives, applications, team members, and placement records.
- **Redis.** Sessions, OTP codes, and rate limits.
- **Email.** Nodemailer through the SMTP settings in `.env`.

## Getting started

### Prerequisites

- Node.js 18 or newer, and npm
- MongoDB
- Redis
- SMTP host, user, password, and a From address the provider accepts

### Installation

1. Open this project folder.
2. Install dependencies from the project root:

```bash
npm install
```

3. Copy `.env.example` to `.env`. Set MongoDB, Redis, `SESSION_SECRET`, `CSRF_SECRET`, SMTP, and `SEED_ADMIN_PASSWORD`. Do not commit `.env`.

4. Start MongoDB and Redis, then start the API and the client together:

```bash
npm run dev
```

5. Open [http://localhost:5173/](http://localhost:5173/).

Load the published statistics without deleting accounts:

```bash
npm run seed -w server -- --records-only
```

`npm run seed` wipes users, companies, and drives. Use that only on an empty database.

## Logins

| Role | Sign in | Opens |
| --- | --- | --- |
| Student | Signup with `@gmail.com` or `@iiitbhopal.ac.in` | `/student` |
| Admin | `admin@iiitbhopal.ac.in` and `SEED_ADMIN_PASSWORD` from `.env` | `/admin` |
| TNP team | Email and password saved on Admin → TNP Team | `/tnp` |

A student signup does not become an admin. The admin password is the value stored in `.env`, not a password printed in this file.

## Scripts

```bash
npm run dev
npm test
npm run build
```

`npm test` runs the server tests. `npm run build` builds the client.

## Mail delivery

OTP, assessment results, offer mail, and suspension mail use `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM`. The From address has to be a verified sender on that account. If sending fails, the portal still saves the signup code, the selection, or the suspension, and the screen shows a warning.
