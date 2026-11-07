const StudentProfile = require('../models/StudentProfile');
const Application = require('../models/Application');
const PlacementDrive = require('../models/PlacementDrive');
const Notification = require('../models/Notification');
const { ApiError, flash } = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { cardReason } = require('../utils/eligibility');
const { assertFile, uploadBuffer, signedResumeUrl, destroyAsset } = require('../services/cloudinary.service');
const { extractPdfText } = require('../utils/pdfText');
const { parsePagination, paginated } = require('../utils/pagination');

const getProfile = asyncHandler(async (req, res) => {
  const profile = await StudentProfile.findOne({ user: req.user._id });
  res.json({ success: true, profile, user: req.user.safeJSON() });
});

const updateProfile = asyncHandler(async (req, res) => {
  if (req.body.role || req.body.email || req.body.enrollmentNumber) {
    throw new ApiError(400, 'That field cannot be changed here.');
  }
  const allowed = [
    'cgpa',
    'backlogs',
    'academicHistory',
    'skills',
    'projects',
    'githubUrl',
    'linkedinUrl',
    'codingProfiles',
    'certifications',
    'internships',
  ];
  const updates = {};
  for (const key of allowed) if (req.body[key] !== undefined) updates[key] = req.body[key];
  if (req.body.name) {
    req.user.name = req.body.name;
    await req.user.save();
  }
  const profile = await StudentProfile.findOneAndUpdate({ user: req.user._id }, updates, { new: true });
  res.json({ success: true, profile, user: req.user.safeJSON(), flash: flash('success', 'Profile updated.') });
});

const uploadPhoto = asyncHandler(async (req, res) => {
  assertFile(req.file, 'image');
  const result = await uploadBuffer(req.file, { folder: 'tnp/profiles', resourceType: 'image', accessMode: 'public' });
  const profile = await StudentProfile.findOne({ user: req.user._id });
  if (profile.profileImage?.publicId) await destroyAsset(profile.profileImage.publicId, 'image');
  profile.profileImage = {
    publicId: result.public_id,
    url: result.secure_url,
    bytes: result.bytes,
    mimeType: req.file.mimetype,
    originalName: req.file.originalname,
    uploadedAt: new Date(),
  };
  await profile.save();
  res.json({ success: true, profile, flash: flash('success', 'Profile image uploaded.') });
});

const uploadResume = asyncHandler(async (req, res) => {
  assertFile(req.file, 'resume');
  const result = await uploadBuffer(req.file, {
    folder: 'tnp/resumes',
    resourceType: 'raw',
    accessMode: 'authenticated',
  });
  const profile = await StudentProfile.findOne({ user: req.user._id });
  if (profile.resume?.publicId) await destroyAsset(profile.resume.publicId, 'raw');
  let resumeText = '';
  try {
    resumeText = await extractPdfText(req.file.buffer);
  } catch {
    resumeText = '';
  }
  profile.resume = {
    publicId: result.public_id,
    url: result.secure_url,
    bytes: result.bytes,
    mimeType: req.file.mimetype,
    originalName: req.file.originalname,
    accessMode: 'authenticated',
    uploadedAt: new Date(),
  };
  profile.resumeText = resumeText;
  await profile.save();
  const message = resumeText
    ? 'Resume uploaded. Text was read from the PDF.'
    : 'Resume uploaded. This PDF has no readable text, so paste the resume in the analyzer if you need a review.';
  res.json({ success: true, resume: profile.resume, resumeText, flash: flash(resumeText ? 'success' : 'warning', message) });
});

const resumeLink = asyncHandler(async (req, res) => {
  const profile = await StudentProfile.findOne({ user: req.user._id });
  if (!profile?.resume?.publicId) throw new ApiError(404, 'No resume uploaded.');
  const url = signedResumeUrl(profile.resume.publicId);
  res.json({ success: true, url, expiresIn: 120 });
});

const deleteResume = asyncHandler(async (req, res) => {
  const profile = await StudentProfile.findOne({ user: req.user._id });
  if (profile.resume?.publicId) await destroyAsset(profile.resume.publicId, 'raw');
  profile.resume = undefined;
  profile.resumeText = '';
  await profile.save();
  res.json({ success: true, flash: flash('success', 'Resume deleted.') });
});

function applyCompanyBlock(drive, eligibility, blocked) {
  const companyId = String(drive.company?._id || drive.company || '');
  if (!blocked.has(companyId)) return eligibility;
  return { ...eligibility, eligible: false, canApply: false, code: 'oops', companyDisabled: true };
}

const eligibleDrives = asyncHandler(async (req, res) => {
  const profile = await StudentProfile.findOne({ user: req.user._id }).select('branch batch cgpa backlogs resume.publicId blockedCompanies').lean().maxTimeMS(8000);
  const blocked = new Set((profile?.blockedCompanies || []).map((id) => String(id)));
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { status: { $in: ['open', 'closed'] } };
  if (req.query.q) filter.jobTitle = new RegExp(req.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const [items, total] = await Promise.all([
    PlacementDrive.find(filter)
      .select('company jobTitle jobType workMode eligibleBranches eligibleBatches minCgpa maxCgpa minBacklogs maxBacklogs packageDetails applicationDeadline status isDemonstration requiredSkills knowMoreUrl')
      .populate('company', 'name logo industry website')
      .sort({ applicationDeadline: 1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .maxTimeMS(8000),
    PlacementDrive.countDocuments(filter).maxTimeMS(8000),
  ]);
  const applications = await Application.find({ student: req.user._id, drive: { $in: items.map((drive) => drive._id) } })
    .select('drive status')
    .lean()
    .maxTimeMS(8000);
  const applied = new Map(applications.map((row) => [String(row.drive), row.status]));
  const mapped = items.map((drive) => ({
    ...drive,
    eligibility: applyCompanyBlock(drive, cardReason(profile, drive), blocked),
    applicationStatus: applied.get(String(drive._id)) || null,
  }));
  res.json({ success: true, ...paginated(mapped, total, page, limit) });
});

const driveForStudent = asyncHandler(async (req, res) => {
  const drive = await PlacementDrive.findById(req.params.id)
    .select('company jobTitle jobDescription jobType workMode eligibleBranches eligibleBatches minCgpa maxCgpa minBacklogs maxBacklogs packageDetails applicationDeadline status isDemonstration requiredSkills location knowMoreUrl')
    .populate('company', 'name logo industry website')
    .lean()
    .maxTimeMS(8000);
  if (!drive || drive.status === 'draft') throw new ApiError(404, 'Drive not found.');
  const profile = await StudentProfile.findOne({ user: req.user._id }).select('branch batch cgpa backlogs resume.publicId blockedCompanies').lean().maxTimeMS(8000);
  const blocked = new Set((profile?.blockedCompanies || []).map((id) => String(id)));
  const existing = await Application.findOne({ student: req.user._id, drive: drive._id }).select('status trackerMessage').lean().maxTimeMS(8000);
  res.json({
    success: true,
    drive: {
      ...drive,
      eligibility: applyCompanyBlock(drive, cardReason(profile, drive), blocked),
      applicationStatus: existing?.status || null,
      trackerMessage: existing?.trackerMessage || '',
    },
  });
});

const myApplications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { student: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  const [items, total] = await Promise.all([
    Application.find(filter)
      .select('drive status submittedAt statusHistory reviewNotes trackerMessage oaAt oaMode oaPlace interviewAt interviewMode interviewPlace createdAt')
      .populate({ path: 'drive', select: 'jobTitle company', populate: { path: 'company', select: 'name logo' } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .maxTimeMS(8000),
    Application.countDocuments(filter).maxTimeMS(8000),
  ]);
  res.json({ success: true, ...paginated(items, total, page, limit) });
});

const applicationById = asyncHandler(async (req, res) => {
  const app = await Application.findOne({ _id: req.params.id, student: req.user._id }).populate({
    path: 'drive',
    populate: { path: 'company' },
  });
  if (!app) throw new ApiError(404, 'Application not found.');
  res.json({ success: true, application: app });
});

const apply = asyncHandler(async (req, res) => {
  const drive = await PlacementDrive.findById(req.body.driveId);
  if (!drive) throw new ApiError(404, 'Drive not found.');
  const profile = await StudentProfile.findOne({ user: req.user._id });
  const blocked = new Set((profile?.blockedCompanies || []).map((id) => String(id)));
  if (blocked.has(String(drive.company))) {
    throw new ApiError(400, 'oops. This company is disabled for you.');
  }
  const eligibility = cardReason(profile, drive);
  if (!eligibility.canApply) {
    const cgpaMiss = (eligibility.reasons || []).find((reason) => /CGPA/i.test(reason));
    if (cgpaMiss) {
      throw new ApiError(400, `${cgpaMiss}. Apply is allowed only when your CGPA is inside this drive's range.`);
    }
    throw new ApiError(400, eligibility.code === 'resume missing' ? 'Upload a resume before applying.' : `You are not eligible: ${eligibility.code}`);
  }
  try {
    const application = await Application.create({
      drive: drive._id,
      student: req.user._id,
      profileSnapshot: {
        name: req.user.name,
        email: req.user.email,
        branch: profile.branch,
        batch: profile.batch,
        cgpa: profile.cgpa,
        backlogs: profile.backlogs,
      },
      resumePublicId: profile.resume.publicId,
      declarationAccepted: true,
      status: 'submitted',
      submittedAt: new Date(),
      statusHistory: [{ status: 'submitted', at: new Date(), by: req.user._id }],
    });
    await Notification.create({
      user: req.user._id,
      title: 'Application submitted',
      body: `Your application for ${drive.jobTitle} was submitted.`,
      category: 'application',
      link: `/student/applications/${application._id}`,
    });
    res.status(201).json({
      success: true,
      application,
      flash: flash('success', 'Application submitted successfully!'),
    });
  } catch (err) {
    if (err.code === 11000) throw new ApiError(409, 'You have already applied to this drive.');
    throw err;
  }
});

async function remindDeadlines(userId) {
  const now = new Date();
  const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const drives = await PlacementDrive.find({
    status: 'open',
    applicationDeadline: { $gte: now, $lte: soon },
  }).select('jobTitle applicationDeadline').limit(20).lean();
  const applied = await Application.find({ student: userId, drive: { $in: drives.map((drive) => drive._id) } }).select('drive').lean();
  const appliedIds = new Set(applied.map((row) => String(row.drive)));
  for (const drive of drives) {
    if (appliedIds.has(String(drive._id))) continue;
    const link = `/student/drives/${drive._id}`;
    const exists = await Notification.findOne({ user: userId, category: 'deadline', link }).select('_id').lean();
    if (exists) continue;
    await Notification.create({
      user: userId,
      title: 'Application deadline',
      body: `${drive.jobTitle} closes on ${new Date(drive.applicationDeadline).toLocaleString()}.`,
      category: 'deadline',
      link,
    });
  }
}

const notifications = asyncHandler(async (req, res) => {
  await remindDeadlines(req.user._id);
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { user: req.user._id };
  const [items, total] = await Promise.all([
    Notification.find(filter).select('title body category link readAt createdAt').sort({ createdAt: -1 }).skip(skip).limit(limit).lean().maxTimeMS(8000),
    Notification.countDocuments(filter).maxTimeMS(8000),
  ]);
  res.json({ success: true, ...paginated(items, total, page, limit) });
});

const markNotificationRead = asyncHandler(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { readAt: new Date() });
  res.json({ success: true });
});

module.exports = {
  getProfile,
  updateProfile,
  uploadPhoto,
  uploadResume,
  resumeLink,
  deleteResume,
  eligibleDrives,
  driveForStudent,
  myApplications,
  applicationById,
  apply,
  notifications,
  markNotificationRead,
};
