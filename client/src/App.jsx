import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from './components/PublicLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AppLayout from './layouts/AppLayout.jsx';

const Home = lazy(() => import('./pages/public/Home.jsx'));
const About = lazy(() => import('./pages/public/About.jsx'));
const Companies = lazy(() => import('./pages/public/Companies.jsx'));
const CompanyDetails = lazy(() => import('./pages/public/CompanyDetails.jsx'));
const Drives = lazy(() => import('./pages/public/Drives.jsx'));
const DriveDetails = lazy(() => import('./pages/public/DriveDetails.jsx'));
const Statistics = lazy(() => import('./pages/public/Statistics.jsx'));
const Team = lazy(() => import('./pages/public/Team.jsx'));
const JoiningCriteria = lazy(() => import('./pages/public/JoiningCriteria.jsx'));
const Contact = lazy(() => import('./pages/public/Contact.jsx'));

const Login = lazy(() => import('./pages/auth/AuthPages.jsx').then((mod) => ({ default: mod.Login })));
const Signup = lazy(() => import('./pages/auth/AuthPages.jsx').then((mod) => ({ default: mod.Signup })));
const ForgotPassword = lazy(() => import('./pages/auth/AuthPages.jsx').then((mod) => ({ default: mod.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/auth/AuthPages.jsx').then((mod) => ({ default: mod.ResetPassword })));

const StudentDashboard = lazy(() => import('./pages/student/StudentPages.jsx').then((mod) => ({ default: mod.StudentDashboard })));
const StudentDrives = lazy(() => import('./pages/student/StudentPages.jsx').then((mod) => ({ default: mod.StudentDrives })));
const DriveCalendar = lazy(() => import('./pages/student/StudentPages.jsx').then((mod) => ({ default: mod.DriveCalendar })));
const StudentDrive = lazy(() => import('./pages/student/StudentPages.jsx').then((mod) => ({ default: mod.StudentDrive })));
const Applications = lazy(() => import('./pages/student/StudentPages.jsx').then((mod) => ({ default: mod.Applications })));
const Resume = lazy(() => import('./pages/student/StudentPages.jsx').then((mod) => ({ default: mod.Resume })));
const Profile = lazy(() => import('./pages/student/StudentPages.jsx').then((mod) => ({ default: mod.Profile })));
const Academics = lazy(() => import('./pages/student/StudentPages.jsx').then((mod) => ({ default: mod.Academics })));
const Notifications = lazy(() => import('./pages/student/StudentPages.jsx').then((mod) => ({ default: mod.Notifications })));
const Assistant = lazy(() => import('./pages/student/StudentPages.jsx').then((mod) => ({ default: mod.Assistant })));
const ResumeAnalyzer = lazy(() => import('./pages/student/ResumeAnalyzer.jsx'));

const AdminDashboard = lazy(() => import('./pages/staff/StaffPages.jsx').then((mod) => ({ default: mod.AdminDashboard })));
const AdminStudents = lazy(() => import('./pages/staff/StaffPages.jsx').then((mod) => ({ default: mod.AdminStudents })));
const AdminTeam = lazy(() => import('./pages/staff/StaffPages.jsx').then((mod) => ({ default: mod.AdminTeam })));
const AdminCompanies = lazy(() => import('./pages/staff/StaffPages.jsx').then((mod) => ({ default: mod.AdminCompanies })));
const AdminDrives = lazy(() => import('./pages/staff/StaffPages.jsx').then((mod) => ({ default: mod.AdminDrives })));
const AdminApplications = lazy(() => import('./pages/staff/StaffPages.jsx').then((mod) => ({ default: mod.AdminApplications })));
const AdminStatistics = lazy(() => import('./pages/staff/StaffPages.jsx').then((mod) => ({ default: mod.AdminStatistics })));
const AdminCriteria = lazy(() => import('./pages/staff/StaffPages.jsx').then((mod) => ({ default: mod.AdminCriteria })));
const AdminAnnouncements = lazy(() => import('./pages/staff/StaffPages.jsx').then((mod) => ({ default: mod.AdminAnnouncements })));
const AdminRecruiters = lazy(() => import('./pages/staff/StaffPages.jsx').then((mod) => ({ default: mod.AdminRecruiters })));
const AdminRoles = lazy(() => import('./pages/staff/StaffPages.jsx').then((mod) => ({ default: mod.AdminRoles })));
const AdminImport = lazy(() => import('./pages/staff/StaffPages.jsx').then((mod) => ({ default: mod.AdminImport })));
const AdminAudit = lazy(() => import('./pages/staff/StaffPages.jsx').then((mod) => ({ default: mod.AdminAudit })));
const AdminHealth = lazy(() => import('./pages/staff/StaffPages.jsx').then((mod) => ({ default: mod.AdminHealth })));
const TeamDashboard = lazy(() => import('./pages/staff/StaffPages.jsx').then((mod) => ({ default: mod.TeamDashboard })));
const TeamDrives = lazy(() => import('./pages/staff/StaffPages.jsx').then((mod) => ({ default: mod.TeamDrives })));
const TeamApplications = lazy(() => import('./pages/staff/StaffPages.jsx').then((mod) => ({ default: mod.TeamApplications })));
const TeamStudents = lazy(() => import('./pages/staff/StaffPages.jsx').then((mod) => ({ default: mod.TeamStudents })));
const TeamPlacements = lazy(() => import('./pages/staff/StaffPages.jsx').then((mod) => ({ default: mod.TeamPlacements })));
const TeamAnnouncements = lazy(() => import('./pages/staff/StaffPages.jsx').then((mod) => ({ default: mod.TeamAnnouncements })));
const TeamProfile = lazy(() => import('./pages/staff/StaffPages.jsx').then((mod) => ({ default: mod.TeamProfile })));

function PageFallback() {
  return <div className="p-4 text-muted">Loading…</div>;
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/companies/:id" element={<CompanyDetails />} />
          <Route path="/drives" element={<Drives />} />
          <Route path="/drives/:id" element={<DriveDetails />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/team" element={<Team />} />
          <Route path="/team-public" element={<Team />} />
          <Route path="/joining-criteria" element={<JoiningCriteria />} />
          <Route path="/contact" element={<Contact />} />
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<ProtectedRoute roles={['student']} />}>
          <Route element={<AppLayout role="student" />}>
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/student/drives" element={<StudentDrives />} />
            <Route path="/student/calendar" element={<DriveCalendar />} />
            <Route path="/student/drives/:id" element={<StudentDrive />} />
            <Route path="/student/applications" element={<Applications />} />
            <Route path="/student/applications/:id" element={<Applications />} />
            <Route path="/student/resume" element={<Resume />} />
            <Route path="/student/profile" element={<Profile />} />
            <Route path="/student/academics" element={<Academics />} />
            <Route path="/student/notifications" element={<Notifications />} />
            <Route path="/student/assistant" element={<Assistant />} />
            <Route path="/student/resume-analyzer" element={<ResumeAnalyzer />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['tnp_team']} />}>
          <Route element={<AppLayout role="tnp_team" />}>
            <Route path="/tnp" element={<TeamDashboard />} />
            <Route path="/tnp/drives" element={<TeamDrives />} />
            <Route path="/tnp/applications" element={<TeamApplications />} />
            <Route path="/tnp/students" element={<TeamStudents />} />
            <Route path="/tnp/placements" element={<TeamPlacements />} />
            <Route path="/tnp/announcements" element={<TeamAnnouncements />} />
            <Route path="/tnp/profile" element={<TeamProfile />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route element={<AppLayout role="admin" />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/students" element={<AdminStudents />} />
            <Route path="/admin/team" element={<AdminTeam />} />
            <Route path="/admin/companies" element={<AdminCompanies />} />
            <Route path="/admin/drives" element={<AdminDrives />} />
            <Route path="/admin/applications" element={<AdminApplications />} />
            <Route path="/admin/statistics" element={<AdminStatistics />} />
            <Route path="/admin/criteria" element={<AdminCriteria />} />
            <Route path="/admin/announcements" element={<AdminAnnouncements />} />
            <Route path="/admin/recruiters" element={<AdminRecruiters />} />
            <Route path="/admin/roles" element={<AdminRoles />} />
            <Route path="/admin/import-export" element={<AdminImport />} />
            <Route path="/admin/audit" element={<AdminAudit />} />
            <Route path="/admin/health" element={<AdminHealth />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
