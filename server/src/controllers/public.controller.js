const Company = require('../models/Company');
const PlacementDrive = require('../models/PlacementDrive');
const PlacementRecord = require('../models/PlacementRecord');
const TnpTeamMember = require('../models/TnpTeamMember');
const JoiningCriteria = require('../models/JoiningCriteria');
const Announcement = require('../models/Announcement');
const Recruiter = require('../models/Recruiter');
const { parsePagination, paginated } = require('../utils/pagination');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError } = require('../utils/apiError');
const { cacheGet, cacheSet } = require('../services/cache.service');
const env = require('../config/env');

const home = asyncHandler(async (_req, res) => {
  const cached = await cacheGet('home:summary');
  if (cached) return res.json({ success: true, ...cached, cached: true });
  const [highest, averages, companies, announcements] = await Promise.all([
    PlacementRecord.find({ recordType: 'overall_highest' }).sort({ batch: -1, packageAmount: -1 }).limit(6),
    PlacementRecord.find({ recordType: 'branch_wise', branch: 'OVERALL' }).sort({ batch: -1 }).limit(3),
    Company.countDocuments({ isActive: true }),
    Announcement.find({ status: 'published', audience: { $in: ['all', 'students'] } }).sort({ publishedAt: -1 }).limit(5),
  ]);
  const payload = {
    institute: {
      name: 'Indian Institute of Information Technology, Bhopal',
      tnp: 'Training and Placement Cell',
      address: 'Room No TB-201, First Floor, IIIT Office, New Teaching Block (NTB), C/O MANIT Campus, Bhopal, MP 462003',
      phone: '0755-2900140',
      email: 'info@iiitbhopal.ac.in',
    },
    statsDisclaimer: 'Headline figures below are taken from the IIIT Bhopal T&P Cell placement statistics document dated 15 April 2026. Conflicting third-party numbers are not merged. Brochure_IIIT_Bhopal.pdf in this repo is image-based and was not fully machine-readable.',
    highest,
    averages,
    companyCount: companies,
    announcements,
  };
  await cacheSet('home:summary', payload, 60);
  res.json({ success: true, ...payload });
});

const companies = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { isActive: true };
  if (req.query.q) filter.name = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (req.query.industry) filter.industry = req.query.industry;
  const [items, total] = await Promise.all([
    Company.find(filter).sort({ name: 1 }).skip(skip).limit(limit).select('name industry description website logo sourceNote').lean().maxTimeMS(8000),
    Company.countDocuments(filter).maxTimeMS(8000),
  ]);
  res.json({ success: true, ...paginated(items, total, page, limit) });
});

const companyById = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id).select('-recruiterContact');
  if (!company) throw new ApiError(404, 'Company not found.');
  const drives = await PlacementDrive.find({ company: company._id, status: { $ne: 'draft' } })
    .select('jobTitle status applicationDeadline isDemonstration')
    .sort({ createdAt: -1 })
    .limit(20)
    .lean()
    .maxTimeMS(8000);
  res.json({ success: true, company, drives });
});

const drives = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { status: { $in: ['open', 'closed'] } };
  if (req.query.q) filter.jobTitle = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (req.query.branch) filter.eligibleBranches = req.query.branch;
  if (req.query.status) filter.status = req.query.status;
  const [items, total] = await Promise.all([
    PlacementDrive.find(filter)
      .select('company jobTitle status workMode applicationDeadline eligibleBranches minCgpa maxCgpa minBacklogs maxBacklogs isDemonstration jobType knowMoreUrl')
      .populate('company', 'name logo industry website')
      .sort({ applicationDeadline: 1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .maxTimeMS(8000),
    PlacementDrive.countDocuments(filter).maxTimeMS(8000),
  ]);
  res.json({ success: true, ...paginated(items, total, page, limit) });
});

const driveById = asyncHandler(async (req, res) => {
  const drive = await PlacementDrive.findById(req.params.id).populate('company', 'name logo website description industry');
  if (!drive || drive.status === 'draft') throw new ApiError(404, 'Drive not found.');
  res.json({ success: true, drive });
});

const statistics = asyncHandler(async (_req, res) => {
  const cached = await cacheGet('stats:public');
  if (cached) return res.json({ success: true, ...cached, cached: true });
  const records = await PlacementRecord.find()
    .select('recordType companyName role branch batch packageAmount averageCtc medianPackage unit metricNote sourceDocument sourceDate verificationStatus notes studentsPlaced studentsParticipated placementPercent')
    .sort({ batch: -1, packageAmount: -1 })
    .limit(200)
    .lean()
    .maxTimeMS(8000);
  const payload = {
    source: 'IIIT Bhopal Training and Placement Cell, Our Placement Speaks, 15 April 2026',
    disclaimer:
      'Highest package, average CTC, and median are separate metrics. Median is shown only when a sourced row includes it. 2026 figures were in progress as of the source date.',
    records,
  };
  await cacheSet('stats:public', payload, 60);
  res.json({ success: true, ...payload });
});

const team = asyncHandler(async (_req, res) => {
  const members = await TnpTeamMember.find({ isActive: true }).sort({ createdAt: 1 });
  res.json({
    success: true,
    notice: 'The supplied brochure does not establish a verified public TNP roster. Placeholder cards are shown until authorized details are published.',
    members,
  });
});

const joiningCriteria = asyncHandler(async (_req, res) => {
  const published = await JoiningCriteria.findOne({ status: 'published' }).sort({ updatedAt: -1 });
  res.json({
    success: true,
    notice: published?.isOfficial
      ? 'Published official joining criteria.'
      : 'No authorized official joining policy is on file. Draft or placeholder content is labelled accordingly.',
    criteria: published,
  });
});

const announcements = asyncHandler(async (_req, res) => {
  const items = await Announcement.find({
    status: 'published',
    audience: { $in: ['all', 'students'] },
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gte: new Date() } }],
  })
    .select('title description category publishedAt')
    .sort({ publishedAt: -1 })
    .limit(20)
    .lean()
    .maxTimeMS(8000);
  res.json({ success: true, items });
});

const contact = asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    contact: {
      office: 'T&P Cell, Room No TB-201, First Floor, IIIT Office, New Teaching Block (NTB)',
      campus: 'C/O Maulana Azad National Institute of Technology (MANIT) Campus, Bhopal, MP 462003',
      phone: '0755-2900140',
      email: 'info@iiitbhopal.ac.in',
      website: 'https://iiitbhopal.ac.in/placement/t-and-p-cell/t-and-p-overview',
    },
  });
});

const meta = asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    flashAutoDismissMs: env.flashAutoDismissMs,
    collegeEmailDomain: env.collegeEmailDomain,
    features: {
      emailOtp: Boolean(env.smtpHost && env.smtpUser && env.smtpPass && env.mailFrom),
      cloudinary: Boolean(env.cloudinaryCloudName && env.cloudinaryApiKey),
      openai: Boolean(env.openaiApiKey),
      smtp: Boolean(env.smtpHost && env.smtpUser),
    },
  });
});

module.exports = {
  home,
  companies,
  companyById,
  drives,
  driveById,
  statistics,
  team,
  joiningCriteria,
  announcements,
  contact,
  meta,
  Recruiter,
};
