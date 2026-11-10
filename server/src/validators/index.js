const Joi = require('joi');
const {
  BRANCHES,
  DRIVE_STATUSES,
  APPLICATION_STATUSES,
  JOB_TYPES,
  WORK_MODES,
  ANNOUNCEMENT_AUDIENCES,
  CRITERIA_STATUSES,
  RECORD_TYPES,
  VERIFICATION_STATUSES,
  OTP_PURPOSES,
  PERMISSIONS,
  ROLES,
} = require('../utils/constants');
const env = require('../config/env');

const objectId = Joi.string().hex().length(24);
const url = Joi.string().uri({ scheme: ['http', 'https'] }).allow('', null);
const phone = Joi.string().pattern(/^[6-9]\d{9}$/);
const collegeEmail = Joi.string()
  .email()
  .lowercase()
  .custom((value, helpers) => {
    const domain = value.slice(value.lastIndexOf('@') + 1);
    if (domain !== 'gmail.com' && domain !== env.collegeEmailDomain) {
      return helpers.error('any.invalid');
    }
    return value;
  })
  .messages({ 'any.invalid': `Email must use @gmail.com or @${env.collegeEmailDomain}` });

const password = Joi.string()
  .min(8)
  .max(72)
  .pattern(/[A-Z]/)
  .pattern(/[a-z]/)
  .pattern(/[0-9]/)
  .pattern(/[^A-Za-z0-9]/)
  .messages({
    'string.pattern.base': 'Password must include upper, lower, number and special character',
  });

const pagination = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).custom((value) => Math.min(50, Math.max(1, value))).default(20),
  q: Joi.string().allow('').max(80),
  sort: Joi.string().max(40),
});

const listQuery = pagination.keys({
  status: Joi.string().max(40),
  branch: Joi.string().max(20),
  industry: Joi.string().max(80),
  drive: objectId,
  type: Joi.string().max(40),
  recordType: Joi.string().max(40),
  placement: Joi.string().valid('placed', 'unplaced'),
});

const idParam = Joi.object({
  id: objectId.required(),
});

const signup = Joi.object({
  name: Joi.string().min(2).max(120).required(),
  email: collegeEmail.required(),
  phone: phone.required(),
  password: password.required(),
  confirmPassword: Joi.any().valid(Joi.ref('password')).required().messages({
    'any.only': 'Passwords do not match',
  }),
  branch: Joi.string()
    .valid(...BRANCHES)
    .required(),
  batch: Joi.number().integer().min(2020).max(2035).required(),
  enrollmentNumber: Joi.string().min(4).max(30).required(),
  termsAccepted: Joi.boolean().valid(true).required(),
  otpChallengeId: Joi.string().required(),
});

const login = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  portal: Joi.string().valid(ROLES.ADMIN, ROLES.TNP_TEAM, ROLES.STUDENT).required(),
});

const loginOtp = Joi.object({
  email: Joi.string().email().lowercase().required(),
  otpChallengeId: Joi.string().required(),
  portal: Joi.string().valid(ROLES.ADMIN, ROLES.TNP_TEAM, ROLES.STUDENT).required(),
});

const otpSend = Joi.object({
  email: Joi.string().email().lowercase().required(),
  purpose: Joi.string()
    .valid(...OTP_PURPOSES)
    .required(),
  phone: Joi.when('purpose', {
    is: 'signup',
    then: phone.required(),
    otherwise: phone.optional(),
  }),
});

const otpVerify = Joi.object({
  email: Joi.string().email().lowercase().required(),
  purpose: Joi.string()
    .valid(...OTP_PURPOSES)
    .required(),
  otp: Joi.string().pattern(/^\d{4,8}$/).required(),
});

const forgotPassword = Joi.object({ email: Joi.string().email().required() });
const resetPassword = Joi.object({
  token: Joi.string().hex().length(64).required(),
  password: password.required(),
  confirmPassword: Joi.any().valid(Joi.ref('password')).required(),
});

const profileUpdate = Joi.object({
  name: Joi.string().min(2).max(120),
  cgpa: Joi.number().min(0).max(10),
  backlogs: Joi.number().integer().min(0).max(20),
  academicHistory: Joi.string().allow('').max(2000),
  skills: Joi.array().items(Joi.string().max(60)).max(40),
  projects: Joi.array().items(
    Joi.object({
      title: Joi.string().max(120),
      description: Joi.string().max(1000).allow(''),
      url: url,
    })
  ),
  githubUrl: url,
  linkedinUrl: url,
  codingProfiles: Joi.array().items(
    Joi.object({ platform: Joi.string().max(40), url: url.required() })
  ),
  certifications: Joi.array().items(
    Joi.object({ name: Joi.string().max(120), issuer: Joi.string().max(120).allow(''), url: url })
  ),
  internships: Joi.array().items(
    Joi.object({
      company: Joi.string().max(120),
      role: Joi.string().max(120),
      duration: Joi.string().max(80).allow(''),
      description: Joi.string().max(1000).allow(''),
    })
  ),
}).min(1);

const company = Joi.object({
  name: Joi.string().min(2).max(160).required(),
  website: url,
  description: Joi.string().allow('').max(4000),
  industry: Joi.string().allow('').max(80),
  isActive: Joi.boolean(),
  recruiterContact: Joi.object({
    name: Joi.string().allow('').max(120),
    email: Joi.string().email().allow(''),
    phone: Joi.string().allow('').max(15),
    visibleToTeam: Joi.boolean(),
  }),
  notes: Joi.string().allow('').max(1000),
});

const driveFields = {
  company: objectId.required(),
  jobTitle: Joi.string().min(2).max(160).required(),
  jobDescription: Joi.string().trim().min(20).max(8000).required(),
  knowMoreUrl: url,
  jobType: Joi.string().valid(...JOB_TYPES),
  workMode: Joi.string().valid(...WORK_MODES),
  location: Joi.string().allow('').max(160),
  eligibleBranches: Joi.array().items(Joi.string().valid(...BRANCHES)),
  eligibleBatches: Joi.array().items(Joi.number().integer()),
  minCgpa: Joi.number().min(0).max(10).required(),
  maxCgpa: Joi.number().min(0).max(10).allow(null),
  minBacklogs: Joi.number().integer().min(0).max(20).allow(null),
  maxBacklogs: Joi.number().integer().min(0).max(20).allow(null),
  packageDetails: Joi.string().allow('').max(500),
  packageLpa: Joi.number().min(0).allow(null),
  requiredSkills: Joi.array().items(Joi.string().max(60)),
  applicationOpenAt: Joi.date().allow(null),
  applicationDeadline: Joi.date().allow(null),
  requiredDocuments: Joi.array().items(Joi.string().max(80)),
  openings: Joi.number().integer().min(1).allow(null),
  additionalRules: Joi.string().allow('').max(2000),
  status: Joi.string().valid(...DRIVE_STATUSES),
  assignedTeamMembers: Joi.array().items(objectId),
  isDemonstration: Joi.boolean(),
};

const drive = Joi.object(driveFields).custom((value, helpers) => {
  if (value.maxCgpa != null && value.minCgpa != null && Number(value.maxCgpa) < Number(value.minCgpa)) {
    return helpers.message('Maximum CGPA cannot be lower than the minimum CGPA.');
  }
  if (value.minBacklogs != null && value.maxBacklogs != null && Number(value.maxBacklogs) < Number(value.minBacklogs)) {
    return helpers.message('Maximum backlogs cannot be lower than the minimum.');
  }
  return value;
});

const driveUpdate = Joi.object({
  ...driveFields,
  company: objectId,
  jobTitle: Joi.string().min(2).max(160),
  jobDescription: Joi.string().trim().min(20).max(8000),
  minCgpa: Joi.number().min(0).max(10),
}).min(1);

const applicationCreate = Joi.object({
  driveId: objectId.required(),
  declarationAccepted: Joi.boolean().valid(true).required(),
});

const applicationStatus = Joi.object({
  status: Joi.string()
    .valid(...APPLICATION_STATUSES)
    .required(),
  reviewNotes: Joi.string().allow('').max(2000),
  oaResult: Joi.string().valid('selected', 'rejected'),
  oaAt: Joi.date().allow(null, ''),
  oaMode: Joi.string().valid('onsite', 'online', '').allow(''),
  oaPlace: Joi.string().allow('').max(300),
  interviewAt: Joi.date().allow(null, ''),
  interviewMode: Joi.string().valid('onsite', 'online', '').allow(''),
  interviewPlace: Joi.string().allow('').max(200),
});

const announcement = Joi.object({
  title: Joi.string().min(3).max(180).required(),
  description: Joi.string().min(3).max(5000).required(),
  category: Joi.string().max(40),
  audience: Joi.string().valid(...ANNOUNCEMENT_AUDIENCES),
  publishedAt: Joi.date().allow(null),
  expiresAt: Joi.date().allow(null),
  status: Joi.string().valid('draft', 'published'),
});

const teamMember = Joi.object({
  fullName: Joi.string().min(2).max(120).required(),
  designation: Joi.string().allow('').max(120),
  teamRole: Joi.string().allow('').max(120),
  branch: Joi.string().allow(''),
  batch: Joi.number().integer().allow(null),
  collegeEmail: Joi.string().email().allow(''),
  responsibilities: Joi.string().allow('').max(2000),
  contactInfo: Joi.string().allow('').max(200),
  showContactPublicly: Joi.boolean(),
  isActive: Joi.boolean(),
  joiningDate: Joi.date().allow(null),
  tenureNote: Joi.string().allow('').max(200),
  permissions: Joi.array().items(Joi.string().valid(...Object.values(PERMISSIONS))),
  isPlaceholder: Joi.boolean(),
  user: objectId.allow(null, ''),
  createLogin: Joi.boolean(),
  phone: Joi.string().pattern(/^[6-9]\d{9}$/).allow(''),
  tempPassword: password.allow(''),
});

const joiningCriteria = Joi.object({
  title: Joi.string().min(3).max(180).required(),
  eligibilityRequirements: Joi.string().allow('').max(4000),
  academicRequirements: Joi.string().allow('').max(4000),
  expectedResponsibilities: Joi.string().allow('').max(4000),
  commitmentExpectations: Joi.string().allow('').max(4000),
  applicationOpensAt: Joi.date().allow(null),
  applicationClosesAt: Joi.date().allow(null),
  selectionRounds: Joi.array().items(Joi.string().max(120)),
  requiredDocuments: Joi.array().items(Joi.string().max(120)),
  faqs: Joi.array().items(Joi.object({ question: Joi.string(), answer: Joi.string() })),
  status: Joi.string().valid(...CRITERIA_STATUSES),
  isOfficial: Joi.boolean(),
});

const placementRecord = Joi.object({
  recordType: Joi.string()
    .valid(...RECORD_TYPES)
    .required(),
  companyName: Joi.string().allow('').max(160),
  role: Joi.string().allow('').max(120),
  branch: Joi.string().valid(...BRANCHES, 'OVERALL').allow('', null),
  batch: Joi.number().integer().min(2018).max(2035),
  packageAmount: Joi.number().min(0).allow(null),
  averageCtc: Joi.number().min(0).allow(null),
  medianPackage: Joi.number().min(0).allow(null),
  currency: Joi.string().default('INR'),
  unit: Joi.string().default('LPA'),
  metricNote: Joi.string().allow('').max(500),
  sourceDocument: Joi.string().required(),
  sourcePage: Joi.string().allow(''),
  sourceDate: Joi.string().allow(''),
  verificationStatus: Joi.string().valid(...VERIFICATION_STATUSES),
  notes: Joi.string().allow('').max(2000),
  studentsPlaced: Joi.number().integer().min(0).allow(null),
  studentsParticipated: Joi.number().integer().min(0).allow(null),
  placementPercent: Joi.number().min(0).max(100).allow(null),
});

const recruiter = Joi.object({
  company: objectId.required(),
  name: Joi.string().min(2).max(120).required(),
  email: Joi.string().email().allow(''),
  phone: Joi.string().allow('').max(15),
  designation: Joi.string().allow('').max(120),
  isActive: Joi.boolean(),
  notes: Joi.string().allow('').max(1000),
});

const roleUpdate = Joi.object({
  role: Joi.string().valid(...Object.values(ROLES)),
  permissions: Joi.array().items(Joi.string().valid(...Object.values(PERMISSIONS))),
  isActive: Joi.boolean(),
}).min(1);

const resumeAnalyze = Joi.object({
  driveId: objectId,
  jobDescription: Joi.string().trim().allow('').max(8000),
  resumeText: Joi.string().trim().min(10).max(12000).required(),
});

const aiChat = Joi.object({
  message: Joi.string().min(1).max(4000).required(),
  history: Joi.array()
    .items(Joi.object({ role: Joi.string().valid('user', 'assistant'), content: Joi.string().max(4000) }))
    .max(12),
});

module.exports = {
  objectId,
  pagination,
  listQuery,
  idParam,
  signup,
  login,
  loginOtp,
  otpSend,
  otpVerify,
  forgotPassword,
  resetPassword,
  profileUpdate,
  company,
  drive,
  driveUpdate,
  applicationCreate,
  applicationStatus,
  announcement,
  teamMember,
  joiningCriteria,
  placementRecord,
  recruiter,
  roleUpdate,
  aiChat,
  resumeAnalyze,
};
