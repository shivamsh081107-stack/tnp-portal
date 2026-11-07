const ROLES = {
  ADMIN: 'admin',
  TNP_TEAM: 'tnp_team',
  STUDENT: 'student',
};

const PERMISSIONS = {
  MANAGE_STUDENTS: 'manage_students',
  MANAGE_TEAM: 'manage_team',
  MANAGE_COMPANIES: 'manage_companies',
  MANAGE_DRIVES: 'manage_drives',
  REVIEW_APPLICATIONS: 'review_applications',
  UPDATE_PLACEMENT_INFO: 'update_placement_info',
  MANAGE_ANNOUNCEMENTS: 'manage_announcements',
  MANAGE_STATISTICS: 'manage_statistics',
  MANAGE_CRITERIA: 'manage_criteria',
  MANAGE_RECRUITERS: 'manage_recruiters',
  VIEW_STUDENTS: 'view_students',
  VIEW_AUDIT: 'view_audit',
  MANAGE_SETTINGS: 'manage_settings',
  IMPORT_EXPORT: 'import_export',
};

const TEAM_PERMISSION_DEFAULTS = [
  PERMISSIONS.VIEW_STUDENTS,
  PERMISSIONS.MANAGE_DRIVES,
  PERMISSIONS.REVIEW_APPLICATIONS,
  PERMISSIONS.MANAGE_ANNOUNCEMENTS,
];

const BRANCHES = ['CSE', 'IT', 'ECE'];
const BRANCH_LABELS = {
  CSE: 'Computer Science and Engineering',
  IT: 'Information Technology',
  ECE: 'Electronics and Communication Engineering',
};

const DRIVE_STATUSES = ['draft', 'open', 'closed', 'archived'];
const APPLICATION_STATUSES = [
  'submitted',
  'shortlisted',
  'online_assessment',
  'interview',
  'offer',
  'rejected',
  'under_review',
  'selected',
];
const APPLICATION_TIMELINE = [
  { status: 'submitted', label: 'Applied' },
  { status: 'shortlisted', label: 'Shortlisted' },
  { status: 'online_assessment', label: 'Online assessment' },
  { status: 'interview', label: 'Interview' },
  { status: 'offer', label: 'Offer' },
];
const JOB_TYPES = ['full_time', 'internship', 'ppo', 'other'];
const WORK_MODES = ['onsite', 'hybrid', 'remote', 'unspecified'];
const ANNOUNCEMENT_AUDIENCES = ['all', 'students', 'tnp_team', 'admin'];
const CRITERIA_STATUSES = ['draft', 'published'];
const RECORD_TYPES = ['overall_highest', 'branch_wise'];
const VERIFICATION_STATUSES = ['provisional', 'verified'];
const OTP_PURPOSES = ['signup', 'login', 'phone_verify'];

module.exports = {
  ROLES,
  PERMISSIONS,
  TEAM_PERMISSION_DEFAULTS,
  BRANCHES,
  BRANCH_LABELS,
  DRIVE_STATUSES,
  APPLICATION_STATUSES,
  APPLICATION_TIMELINE,
  JOB_TYPES,
  WORK_MODES,
  ANNOUNCEMENT_AUDIENCES,
  CRITERIA_STATUSES,
  RECORD_TYPES,
  VERIFICATION_STATUSES,
  OTP_PURPOSES,
};
