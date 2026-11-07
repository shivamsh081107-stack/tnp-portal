const express = require('express');
const multer = require('multer');
const auth = require('../controllers/auth.controller');
const pub = require('../controllers/public.controller');
const student = require('../controllers/student.controller');
const admin = require('../controllers/admin.controller');
const { chatHandler, analyzeResumeHandler, parseResumeHandler } = require('../controllers/ai.controller');
const { validate } = require('../middleware/validate');
const schemas = require('../validators');
const { requireAuth, requireRole, requirePermission } = require('../middleware/auth');
const { PERMISSIONS, ROLES } = require('../utils/constants');
const { authLimiter, otpLimiter, uploadLimiter, aiLimiter, resetLimiter } = require('../middleware/rateLimit');
const { isRedisReady } = require('../config/redis');
const { ApiError } = require('../utils/apiError');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function requireRedis(message) {
  return (_req, _res, next) => {
    if (isRedisReady()) return next();
    return next(new ApiError(503, message));
  };
}

const sessionRedis = requireRedis('Sessions are unavailable because Redis is down.');
const router = express.Router();

router.get('/meta', pub.meta);
router.get('/home', pub.home);
router.get('/contact', pub.contact);
router.param('id', validate(schemas.idParam, 'params'));

router.get('/companies', validate(schemas.listQuery, 'query'), pub.companies);
router.get('/companies/:id', pub.companyById);
router.get('/drives', validate(schemas.listQuery, 'query'), pub.drives);
router.get('/drives/:id', pub.driveById);
router.get('/statistics', pub.statistics);
router.get('/team', pub.team);
router.get('/joining-criteria', pub.joiningCriteria);
router.get('/announcements', pub.announcements);

router.post('/auth/otp/send', sessionRedis, otpLimiter, validate(schemas.otpSend), auth.sendOtpHandler);
router.post('/auth/otp/verify', sessionRedis, otpLimiter, validate(schemas.otpVerify), auth.verifyOtpHandler);
router.post('/auth/signup', sessionRedis, authLimiter, validate(schemas.signup), auth.signup);
router.post('/auth/login', sessionRedis, authLimiter, validate(schemas.login), auth.login);
router.post('/auth/login-otp', sessionRedis, authLimiter, validate(schemas.loginOtp), auth.loginOtp);
router.post('/auth/logout', auth.logout);
router.get('/auth/me', auth.me);
router.post('/auth/forgot-password', sessionRedis, resetLimiter, validate(schemas.forgotPassword), auth.forgotPassword);
router.post('/auth/reset-password', sessionRedis, resetLimiter, validate(schemas.resetPassword), auth.resetPassword);

router.get('/student/profile', requireAuth, requireRole(ROLES.STUDENT), student.getProfile);
router.patch('/student/profile', requireAuth, requireRole(ROLES.STUDENT), validate(schemas.profileUpdate), student.updateProfile);
router.post('/student/profile/photo', requireAuth, requireRole(ROLES.STUDENT), uploadLimiter, upload.single('file'), student.uploadPhoto);
router.post('/student/resume', requireAuth, requireRole(ROLES.STUDENT), uploadLimiter, upload.single('file'), student.uploadResume);
router.get('/student/resume', requireAuth, requireRole(ROLES.STUDENT), student.resumeLink);
router.delete('/student/resume', requireAuth, requireRole(ROLES.STUDENT), student.deleteResume);
router.get('/student/drives', requireAuth, requireRole(ROLES.STUDENT), validate(schemas.listQuery, 'query'), student.eligibleDrives);
router.get('/student/drives/:id', requireAuth, requireRole(ROLES.STUDENT), student.driveForStudent);
router.get('/student/applications', requireAuth, requireRole(ROLES.STUDENT), validate(schemas.listQuery, 'query'), student.myApplications);
router.get('/student/applications/:id', requireAuth, requireRole(ROLES.STUDENT), student.applicationById);
router.post('/student/applications', requireAuth, requireRole(ROLES.STUDENT), validate(schemas.applicationCreate), student.apply);
router.get('/student/notifications', requireAuth, requireRole(ROLES.STUDENT), validate(schemas.listQuery, 'query'), student.notifications);
router.post('/student/notifications/:id/read', requireAuth, requireRole(ROLES.STUDENT), student.markNotificationRead);

router.post('/ai/chat', requireAuth, aiLimiter, validate(schemas.aiChat), chatHandler);
router.post(
  '/ai/resume-parse',
  requireAuth,
  requireRole(ROLES.STUDENT, ROLES.ADMIN, ROLES.TNP_TEAM),
  uploadLimiter,
  upload.single('file'),
  parseResumeHandler
);
router.post(
  '/ai/resume-analyze',
  requireAuth,
  requireRole(ROLES.STUDENT, ROLES.ADMIN, ROLES.TNP_TEAM),
  aiLimiter,
  validate(schemas.resumeAnalyze),
  analyzeResumeHandler
);

const staff = [requireAuth, requireRole(ROLES.ADMIN, ROLES.TNP_TEAM)];

router.get('/admin/dashboard', ...staff, admin.dashboard);
router.get('/admin/students', ...staff, requirePermission(PERMISSIONS.VIEW_STUDENTS, PERMISSIONS.MANAGE_STUDENTS), validate(schemas.listQuery, 'query'), admin.students);
router.get('/admin/students/:id', ...staff, requirePermission(PERMISSIONS.VIEW_STUDENTS, PERMISSIONS.MANAGE_STUDENTS), admin.studentDetail);
router.delete('/admin/students/:id', requireAuth, requireRole(ROLES.ADMIN), admin.suspendStudent);
router.get('/admin/students/:id/resume', ...staff, requirePermission(PERMISSIONS.VIEW_STUDENTS), admin.studentResume);

router.get('/admin/companies', ...staff, requirePermission(PERMISSIONS.MANAGE_COMPANIES), validate(schemas.listQuery, 'query'), admin.companies);
router.post('/admin/companies', requireAuth, requireRole(ROLES.ADMIN), validate(schemas.company), admin.createCompany);
router.patch('/admin/companies/:id', requireAuth, requireRole(ROLES.ADMIN), validate(schemas.company), admin.updateCompany);
router.post('/admin/companies/:id/end', requireAuth, requireRole(ROLES.ADMIN), admin.endCompany);
router.delete('/admin/companies/:id', requireAuth, requireRole(ROLES.ADMIN), admin.deleteCompany);
router.post('/admin/companies/:id/logo', requireAuth, requireRole(ROLES.ADMIN), uploadLimiter, upload.single('file'), admin.companyLogo);

router.get('/admin/drives', ...staff, requirePermission(PERMISSIONS.MANAGE_DRIVES), validate(schemas.listQuery, 'query'), admin.drives);
router.post('/admin/drives', ...staff, requirePermission(PERMISSIONS.MANAGE_DRIVES), validate(schemas.drive), admin.createDrive);
router.patch('/admin/drives/:id', ...staff, requirePermission(PERMISSIONS.MANAGE_DRIVES), validate(schemas.driveUpdate), admin.updateDrive);
router.delete('/admin/drives/:id', requireAuth, requireRole(ROLES.ADMIN), admin.deleteDrive);

router.get('/admin/applications', ...staff, requirePermission(PERMISSIONS.REVIEW_APPLICATIONS), validate(schemas.listQuery, 'query'), admin.applications);
router.patch('/admin/applications/:id', ...staff, requirePermission(PERMISSIONS.REVIEW_APPLICATIONS), validate(schemas.applicationStatus), admin.updateApplication);
router.get('/admin/placements', ...staff, requirePermission(PERMISSIONS.VIEW_STUDENTS, PERMISSIONS.MANAGE_STUDENTS, PERMISSIONS.UPDATE_PLACEMENT_INFO), admin.placementBoards);

router.get('/admin/records', ...staff, requirePermission(PERMISSIONS.MANAGE_STATISTICS, PERMISSIONS.UPDATE_PLACEMENT_INFO), validate(schemas.listQuery, 'query'), admin.records);
router.post('/admin/records', requireAuth, requireRole(ROLES.ADMIN), validate(schemas.placementRecord), admin.createRecord);
router.patch('/admin/records/:id', requireAuth, requireRole(ROLES.ADMIN), admin.updateRecord);
router.delete('/admin/records/:id', requireAuth, requireRole(ROLES.ADMIN), admin.deleteRecord);

router.get('/admin/team', requireAuth, requireRole(ROLES.ADMIN), admin.teamMembers);
router.post('/admin/team', requireAuth, requireRole(ROLES.ADMIN), validate(schemas.teamMember), admin.createTeamMember);
router.patch('/admin/team/:id', requireAuth, requireRole(ROLES.ADMIN), admin.updateTeamMember);
router.delete('/admin/team/:id', requireAuth, requireRole(ROLES.ADMIN), admin.deleteTeamMember);
router.post('/admin/team/:id/photo', requireAuth, requireRole(ROLES.ADMIN), upload.single('file'), admin.teamPhoto);

router.get('/admin/criteria', requireAuth, requireRole(ROLES.ADMIN), admin.criteriaList);
router.post('/admin/criteria', requireAuth, requireRole(ROLES.ADMIN), validate(schemas.joiningCriteria), admin.createCriteria);
router.patch('/admin/criteria/:id', requireAuth, requireRole(ROLES.ADMIN), admin.updateCriteria);

router.get('/admin/announcements', ...staff, requirePermission(PERMISSIONS.MANAGE_ANNOUNCEMENTS), validate(schemas.listQuery, 'query'), admin.announcements);
router.post('/admin/announcements', ...staff, requirePermission(PERMISSIONS.MANAGE_ANNOUNCEMENTS), validate(schemas.announcement), admin.createAnnouncement);
router.patch('/admin/announcements/:id', ...staff, requirePermission(PERMISSIONS.MANAGE_ANNOUNCEMENTS), admin.updateAnnouncement);
router.delete('/admin/announcements/:id', ...staff, requirePermission(PERMISSIONS.MANAGE_ANNOUNCEMENTS), admin.deleteAnnouncement);

router.get('/admin/recruiters', requireAuth, requireRole(ROLES.ADMIN), validate(schemas.listQuery, 'query'), admin.recruiters);
router.post('/admin/recruiters', requireAuth, requireRole(ROLES.ADMIN), validate(schemas.recruiter), admin.createRecruiter);
router.patch('/admin/recruiters/:id', requireAuth, requireRole(ROLES.ADMIN), admin.updateRecruiter);
router.delete('/admin/recruiters/:id', requireAuth, requireRole(ROLES.ADMIN), admin.deleteRecruiter);

router.get('/admin/roles', requireAuth, requireRole(ROLES.ADMIN), validate(schemas.listQuery, 'query'), admin.roles);
router.patch('/admin/roles/:id', requireAuth, requireRole(ROLES.ADMIN), validate(schemas.roleUpdate), admin.updateRole);
router.get('/admin/audit', requireAuth, requireRole(ROLES.ADMIN), validate(schemas.listQuery, 'query'), admin.auditLogs);
router.get('/admin/health', requireAuth, requireRole(ROLES.ADMIN), admin.healthDetail);
router.get('/admin/analytics', requireAuth, requireRole(ROLES.ADMIN), admin.recruitmentAnalytics);
router.get('/admin/export', requireAuth, requireRole(ROLES.ADMIN), admin.exportData);
router.post('/admin/import', requireAuth, requireRole(ROLES.ADMIN), admin.importJson);

module.exports = router;
