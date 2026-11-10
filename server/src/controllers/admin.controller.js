const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const Company = require('../models/Company');
const PlacementDrive = require('../models/PlacementDrive');
const Application = require('../models/Application');
const PlacementRecord = require('../models/PlacementRecord');
const TnpTeamMember = require('../models/TnpTeamMember');
const JoiningCriteria = require('../models/JoiningCriteria');
const Announcement = require('../models/Announcement');
const Recruiter = require('../models/Recruiter');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const { parsePagination, paginated } = require('../utils/pagination');
const asyncHandler = require('../utils/asyncHandler');
const { ApiError, flash } = require('../utils/apiError');
const { audit } = require('../services/audit.service');
const { cacheDel } = require('../services/cache.service');
const { randomDigits } = require('../utils/crypto');
const { ROLES, TEAM_PERMISSION_DEFAULTS } = require('../utils/constants');
const env = require('../config/env');
const { isRedisReady } = require('../config/redis');
const { signedResumeUrl, assertFile, uploadBuffer, destroyAsset } = require('../services/cloudinary.service');
const { trySendSms } = require('../services/twilio.service');

function whenText(value) {
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
}

async function smsTo(phone, text, kind) {
  if (!phone) return 'SMS was not sent because this account has no mobile number.';
  const sms = await trySendSms(phone, text, kind);
  if (!sms.sent) return sms.reason || 'The SMS could not be sent.';
  if (sms.trial) return 'TRIAL: Twilio sent its sample SMS. Upgrade the account to text the real date, time, and selection message.';
  return '';
}

function smsNote(warning, savedPrefix) {
  if (!warning) return '';
  if (warning.startsWith('TRIAL:')) return warning.slice(7);
  return `${savedPrefix} ${warning}`;
}

const PLACED_STATUSES = new Set(['selected', 'offer']);
const STATUS_TRANSITIONS = {
  submitted: ['shortlisted', 'under_review', 'online_assessment', 'rejected'],
  under_review: ['shortlisted', 'online_assessment', 'rejected'],
  shortlisted: ['online_assessment', 'rejected'],
  online_assessment: ['interview', 'rejected'],
  interview: ['offer', 'selected', 'rejected'],
  offer: ['selected'],
  selected: [],
  rejected: [],
};

function assertStatusTransition(from, to) {
  const allowed = STATUS_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new ApiError(400, `Cannot move an application from ${from.replaceAll('_', ' ')} to ${to.replaceAll('_', ' ')}.`);
  }
}

function actsAsTeam(user) {
  return user?.role === ROLES.TNP_TEAM || Boolean(user?.tnpTeam);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function listHandler(Model, { searchFields = ['name'], populate, filterFn, select } = {}) {
  return asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = filterFn ? filterFn(req) : {};
    if (req.query.q && searchFields.length) {
      const pattern = new RegExp(escapeRegex(req.query.q), 'i');
      filter.$or = searchFields.map((field) => ({ [field]: pattern }));
    }
    let query = Model.find(filter).maxTimeMS(8000).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    if (select) query = query.select(select);
    if (populate) query = query.populate(populate);
    const [items, total] = await Promise.all([query, Model.countDocuments(filter).maxTimeMS(8000)]);
    res.json({ success: true, ...paginated(items, total, page, limit) });
  });
}

const students = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { role: ROLES.STUDENT, isActive: { $ne: false } };
  if (actsAsTeam(req.user)) {
    const drives = await PlacementDrive.find({ assignedTeamMembers: req.user._id }).select('_id').lean().maxTimeMS(8000);
    const driveIds = drives.map((drive) => drive._id);
    const applications = await Application.find({ drive: { $in: driveIds } }).select('student').lean().maxTimeMS(8000);
    filter._id = { $in: [...new Set(applications.map((row) => String(row.student)))] };
  }
  if (req.query.placement === 'placed' || req.query.placement === 'unplaced') {
    const placedIds = (await StudentProfile.find({ 'placement.status': 'placed' }).select('user').lean().maxTimeMS(8000)).map((profile) => profile.user);
    const placedSet = new Set(placedIds.map((id) => String(id)));
    if (filter._id && filter._id.$in) {
      filter._id = {
        $in: filter._id.$in.filter((id) => (req.query.placement === 'placed' ? placedSet.has(String(id)) : !placedSet.has(String(id)))),
      };
    } else if (req.query.placement === 'placed') {
      filter._id = { $in: placedIds };
    } else {
      filter._id = { $nin: placedIds };
    }
  }
  const q = String(req.query.q || '').trim();
  if (q) {
    const profiles = await StudentProfile.find({ enrollmentNumber: new RegExp(`^${escapeRegex(q)}`, 'i') })
      .select('user')
      .limit(50)
      .lean()
      .maxTimeMS(8000);
    filter.$and = [
      {
        $or: [
          { name: new RegExp(`^${escapeRegex(q)}`, 'i') },
          { email: new RegExp(`^${escapeRegex(q)}`, 'i') },
          { _id: { $in: profiles.map((profile) => profile.user) } },
        ],
      },
    ];
  }
  const [users, total] = await Promise.all([
    User.find(filter)
      .select('name email role isActive phone createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .maxTimeMS(8000),
    User.countDocuments(filter).maxTimeMS(8000),
  ]);
  const profiles = await StudentProfile.find({ user: { $in: users.map((user) => user._id) } })
    .select('user enrollmentNumber branch batch cgpa resume.publicId placement')
    .lean()
    .maxTimeMS(8000);
  const byUser = new Map(profiles.map((profile) => [String(profile.user), profile]));
  const items = users.map((user) => {
    const profile = byUser.get(String(user._id)) || null;
    return {
      ...user,
      profile: profile
        ? {
            enrollmentNumber: profile.enrollmentNumber,
            branch: profile.branch,
            batch: profile.batch,
            cgpa: profile.cgpa,
            hasResume: Boolean(profile.resume?.publicId),
            placementStatus: profile.placement?.status || 'unplaced',
            companyName: profile.placement?.companyName || '',
            packageLpa: profile.placement?.packageLpa ?? null,
          }
        : null,
    };
  });
  res.json({ success: true, ...paginated(items, total, page, limit) });
});

const studentDetail = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user || user.role !== ROLES.STUDENT) throw new ApiError(404, 'Student not found.');
  const profile = await StudentProfile.findOne({ user: user._id });
  res.json({ success: true, user: user.safeJSON(), profile });
});

const suspendStudent = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user || user.role !== ROLES.STUDENT) throw new ApiError(404, 'Student not found.');
  if (user.isActive === false) {
    return res.json({ success: true, message: 'This student is already suspended.', flash: flash('info', 'This student is already suspended.') });
  }
  user.isActive = false;
  user.tnpTeam = false;
  user.permissions = [];
  await user.save();
  await TnpTeamMember.deleteMany({ $or: [{ user: user._id }, { collegeEmail: user.email }] });
  const mailWarning = await smsTo(user.phone, 'IIIT Bhopal TNP: your account has been suspended. You can no longer sign in.', 'alert');
  await audit(req, 'suspend', 'User', user._id, { email: user.email });
  const message = mailWarning ? `Student suspended. ${mailWarning}` : 'Student suspended. An SMS was sent to their mobile number.';
  res.json({ success: true, mailWarning, message, flash: flash('success', message) });
});

const studentResume = asyncHandler(async (req, res) => {
  const profile = await StudentProfile.findOne({ user: req.params.id });
  if (!profile?.resume?.publicId) throw new ApiError(404, 'No resume.');
  res.json({ success: true, url: signedResumeUrl(profile.resume.publicId) });
});

const companies = listHandler(Company, { searchFields: ['name', 'industry'], filterFn: () => ({ isActive: true }) });
const createCompany = asyncHandler(async (req, res) => {
  const company = await Company.create(req.body);
  await audit(req, 'create', 'Company', company._id, { name: company.name });
  await cacheDel('home:*');
  res.status(201).json({ success: true, company, flash: flash('success', 'Company created.') });
});
const updateCompany = asyncHandler(async (req, res) => {
  const company = await Company.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!company) throw new ApiError(404, 'Company not found.');
  await audit(req, 'update', 'Company', company._id);
  await cacheDel('home:*');
  res.json({ success: true, company, flash: flash('success', 'Company updated.') });
});
async function retireCompany(companyId) {
  await PlacementDrive.updateMany(
    { company: companyId, status: { $in: ['open', 'draft'] } },
    { status: 'closed' }
  );
  await Company.findByIdAndUpdate(companyId, { isActive: false });
  await cacheDel('home:*');
}

async function retireCompanyIfFinished(companyId) {
  const stillRunning = await PlacementDrive.countDocuments({
    company: companyId,
    status: { $in: ['open', 'draft'] },
  }).maxTimeMS(8000);
  if (stillRunning === 0) await retireCompany(companyId);
}

const endCompany = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) throw new ApiError(404, 'Company not found.');
  await retireCompany(company._id);
  await audit(req, 'delete', 'Company', company._id, { ended: true });
  res.json({ success: true, flash: flash('success', 'Company removed. Its open drives are closed.') });
});

const deleteCompany = asyncHandler(async (req, res) => {
  await Company.findByIdAndDelete(req.params.id);
  await audit(req, 'delete', 'Company', req.params.id);
  res.json({ success: true, flash: flash('success', 'Company deleted.') });
});
const companyLogo = asyncHandler(async (req, res) => {
  assertFile(req.file, 'image');
  const company = await Company.findById(req.params.id);
  if (!company) throw new ApiError(404, 'Company not found.');
  const result = await uploadBuffer(req.file, { folder: 'tnp/logos', resourceType: 'image', accessMode: 'public' });
  if (company.logo?.publicId) await destroyAsset(company.logo.publicId, 'image');
  company.logo = { publicId: result.public_id, url: result.secure_url };
  await company.save();
  res.json({ success: true, company, flash: flash('success', 'Logo uploaded.') });
});

const drives = listHandler(PlacementDrive, {
  searchFields: ['jobTitle'],
  populate: { path: 'company', select: 'name' },
  select: 'company jobTitle status applicationDeadline eligibleBranches eligibleBatches minCgpa maxCgpa minBacklogs maxBacklogs packageDetails isDemonstration assignedTeamMembers knowMoreUrl',
  filterFn: (req) => (actsAsTeam(req.user) ? { assignedTeamMembers: req.user._id } : {}),
});
const createDrive = asyncHandler(async (req, res) => {
  const drive = await PlacementDrive.create(req.body);
  await audit(req, 'create', 'PlacementDrive', drive._id);
  res.status(201).json({ success: true, drive, flash: flash('success', 'Drive created.') });
});
const updateDrive = asyncHandler(async (req, res) => {
  const drive = await PlacementDrive.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!drive) throw new ApiError(404, 'Drive not found.');
  if (drive.status === 'closed' || drive.status === 'archived') await retireCompanyIfFinished(drive.company);
  await audit(req, 'update', 'PlacementDrive', drive._id, { status: drive.status });
  res.json({ success: true, drive, flash: flash('success', 'Drive updated.') });
});
const deleteDrive = asyncHandler(async (req, res) => {
  await PlacementDrive.findByIdAndDelete(req.params.id);
  await audit(req, 'delete', 'PlacementDrive', req.params.id);
  res.json({ success: true, flash: flash('success', 'Drive deleted.') });
});

const applications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.drive) filter.drive = req.query.drive;
  if (actsAsTeam(req.user)) {
    const assigned = await PlacementDrive.find({ assignedTeamMembers: req.user._id }).select('_id');
    filter.drive = { $in: assigned.map((d) => d._id) };
    if (req.query.drive) filter.drive = req.query.drive;
  }
  const [items, total] = await Promise.all([
    Application.find(filter)
      .select('student drive status submittedAt statusHistory reviewNotes trackerMessage oaAt oaMode oaPlace interviewAt interviewMode interviewPlace createdAt')
      .populate('student', 'name email')
      .populate({ path: 'drive', select: 'jobTitle company', populate: { path: 'company', select: 'name' } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .maxTimeMS(8000),
    Application.countDocuments(filter).maxTimeMS(8000),
  ]);
  res.json({ success: true, ...paginated(items, total, page, limit) });
});

const updateApplication = asyncHandler(async (req, res) => {
  const application = await Application.findById(req.params.id);
  if (!application) throw new ApiError(404, 'Application not found.');
  const driveDoc = await PlacementDrive.findById(application.drive).populate('company', 'name');
  if (actsAsTeam(req.user)) {
    const allowed = driveDoc?.assignedTeamMembers?.some((id) => String(id) === String(req.user._id));
    if (!allowed) throw new ApiError(403, 'You are not assigned to this drive.');
  }
  const previousStatus = application.status;
  let mailWarning = '';
  let notice = '';
  if (req.body.oaResult) {
    if (!actsAsTeam(req.user)) {
      throw new ApiError(403, 'Only a TNP team member can mark who is selected in the online assessment.');
    }
    if (application.status !== 'online_assessment') {
      throw new ApiError(400, 'Record the OA result only when the application is in online assessment.');
    }
    if (req.body.oaResult === 'selected') {
      application.status = 'interview';
      application.trackerMessage = '';
      notice = `You are selected in the online assessment for ${driveDoc?.jobTitle || 'this drive'}. The next round is now active.`;
      const student = await User.findById(application.student);
      mailWarning = await smsTo(
        student?.phone,
        `IIIT Bhopal TNP: you are selected in the online assessment for ${driveDoc?.jobTitle || 'this drive'} at ${driveDoc?.company?.name || 'the company'}. The interview round is now active.`,
        'selection'
      );
    } else {
      application.status = 'rejected';
      application.trackerMessage = 'oops';
      notice = 'oops';
      const companyId = driveDoc?.company?._id || driveDoc?.company;
      if (companyId) {
        await StudentProfile.updateOne({ user: application.student }, { $addToSet: { blockedCompanies: companyId } });
      }
    }
  } else if (req.body.status && req.body.status !== application.status) {
    assertStatusTransition(application.status, req.body.status);
    application.status = req.body.status;
    if (application.status === 'rejected' && previousStatus === 'interview') {
      application.trackerMessage = 'Not selected in the interview.';
    }
    notice = application.trackerMessage === 'Not selected in the interview.'
      ? application.trackerMessage
      : PLACED_STATUSES.has(application.status)
        ? 'Congratulations. You have been selected and moved to the placed list.'
        : `Your application status is now ${String(application.status).replaceAll('_', ' ')}.`;
  }
  if (req.body.oaAt) {
    if (application.status !== 'online_assessment') {
      throw new ApiError(400, 'Schedule an online assessment only after the student has been moved to that round.');
    }
    application.oaAt = new Date(req.body.oaAt);
    application.oaMode = req.body.oaMode || '';
    application.oaPlace = req.body.oaPlace || '';
    const when = whenText(application.oaAt);
    const scheduleNotice = `Your online assessment is on ${when}${application.oaMode ? ` (${application.oaMode})` : ''}${application.oaPlace ? `. Link or place: ${application.oaPlace}` : ''}.`;
    notice = scheduleNotice;
    const student = await User.findById(application.student);
    const smsWarning = await smsTo(
      student?.phone,
      `IIIT Bhopal TNP: online assessment for ${driveDoc?.jobTitle || 'your drive'} at ${driveDoc?.company?.name || 'the company'} is on ${when}${application.oaMode ? ` (${application.oaMode})` : ''}${application.oaPlace ? `. ${application.oaPlace}` : ''}.`,
      'appointment'
    );
    if (smsWarning) mailWarning = mailWarning || smsNote(smsWarning, 'The online assessment is saved, but the SMS was not sent.');
  }
  if (req.body.interviewAt) {
    if (application.status !== 'interview') {
      throw new ApiError(400, 'Schedule an interview only after the student has reached that round.');
    }
    application.interviewAt = new Date(req.body.interviewAt);
    application.interviewMode = req.body.interviewMode || '';
    application.interviewPlace = req.body.interviewPlace || '';
    const when = whenText(application.interviewAt);
    const scheduleNotice = `Your interview is on ${when}${application.interviewMode ? ` (${application.interviewMode})` : ''}${application.interviewPlace ? ` at ${application.interviewPlace}` : ''}.`;
    notice = notice || scheduleNotice;
    const student = await User.findById(application.student);
    const smsWarning = await smsTo(
      student?.phone,
      `IIIT Bhopal TNP: interview for ${driveDoc?.jobTitle || 'your drive'} at ${driveDoc?.company?.name || 'the company'} is on ${when}${application.interviewMode ? ` (${application.interviewMode})` : ''}${application.interviewPlace ? ` at ${application.interviewPlace}` : ''}.`,
      'appointment'
    );
    if (smsWarning) mailWarning = mailWarning || smsNote(smsWarning, 'The interview is saved, but the SMS was not sent.');
  }
  if (req.body.reviewNotes !== undefined) application.reviewNotes = req.body.reviewNotes;
  if (previousStatus !== application.status) {
    application.statusHistory.push({ status: application.status, at: new Date(), by: req.user._id });
  }
  await application.save();
  if (PLACED_STATUSES.has(application.status) && !PLACED_STATUSES.has(previousStatus)) {
    mailWarning = await markStudentPlaced(application);
  } else if (!PLACED_STATUSES.has(application.status)) {
    await clearPlacementForDrive(application);
  }
  if (notice) {
    await Notification.create({
      user: application.student,
      title: application.trackerMessage === 'oops' ? 'oops' : 'Application update',
      body: notice,
      category: 'application',
      link: `/student/applications/${application._id}`,
    });
  }
  await audit(req, 'status_change', 'Application', application._id, { status: application.status });
  const message = mailWarning || (application.trackerMessage === 'oops' ? 'Marked oops. This company is now disabled for the student.' : 'Application status updated.');
  res.json({ success: true, application, mailWarning, flash: flash('success', message) });
});

async function markStudentPlaced(application) {
  const student = await User.findById(application.student);
  const drive = await PlacementDrive.findById(application.drive).populate('company', 'name');
  const profile = await StudentProfile.findOne({ user: application.student });
  const companyName = drive?.company?.name || 'the company';
  const role = drive?.jobTitle || 'the role';
  if (profile) {
    profile.placement = {
      status: 'placed',
      companyName,
      role,
      packageLpa: drive?.packageLpa ?? undefined,
      drive: drive?._id,
      selectedAt: new Date(),
    };
    await profile.save();
  }
  const packageLine = drive?.packageLpa != null ? ` Package: ${drive.packageLpa} LPA.` : '';
  const warning = await smsTo(
    student?.phone,
    `IIIT Bhopal TNP: you are selected. ${companyName} has selected you for ${role}.${packageLine} You are now on the placed list for batch ${profile?.batch || ''}.`,
    'selection'
  );
  return smsNote(warning, 'The selection is saved, but the SMS was not sent.');
}

async function clearPlacementForDrive(application) {
  const profile = await StudentProfile.findOne({ user: application.student });
  if (!profile?.placement || profile.placement.status !== 'placed') return;
  if (String(profile.placement.drive || '') !== String(application.drive)) return;
  profile.placement = { status: 'unplaced', companyName: '', role: '' };
  await profile.save();
}

const placementBoards = asyncHandler(async (req, res) => {
  const profiles = await StudentProfile.find()
    .select('user enrollmentNumber branch batch placement')
    .lean()
    .maxTimeMS(8000);
  const users = await User.find({ _id: { $in: profiles.map((profile) => profile.user) }, role: ROLES.STUDENT, isActive: { $ne: false } })
    .select('name email')
    .lean()
    .maxTimeMS(8000);
  const byId = new Map(users.map((user) => [String(user._id), user]));
  const rows = profiles
    .map((profile) => {
      const user = byId.get(String(profile.user));
      if (!user) return null;
      return {
        id: user._id,
        name: user.name,
        email: user.email,
        enrollmentNumber: profile.enrollmentNumber,
        branch: profile.branch,
        batch: profile.batch,
        status: profile.placement?.status || 'unplaced',
        companyName: profile.placement?.companyName || '',
        role: profile.placement?.role || '',
        packageLpa: profile.placement?.packageLpa ?? null,
      };
    })
    .filter(Boolean);
  const placed = rows.filter((row) => row.status === 'placed');
  const years = [...new Set(placed.map((row) => row.batch))]
    .sort((a, b) => b - a)
    .map((batch) => ({
      batch,
      items: placed
        .filter((row) => row.batch === batch)
        .sort((a, b) => (b.packageLpa ?? -1) - (a.packageLpa ?? -1)),
    }));
  res.json({
    success: true,
    years,
    unplacedCount: rows.filter((row) => row.status !== 'placed').length,
  });
});

const records = listHandler(PlacementRecord, { searchFields: ['companyName', 'sourceDocument'] });
const createRecord = asyncHandler(async (req, res) => {
  const record = await PlacementRecord.create(req.body);
  await cacheDel('home:*');
  await cacheDel('stats:public');
  await audit(req, 'create', 'PlacementRecord', record._id);
  res.status(201).json({ success: true, record, flash: flash('success', 'Placement record saved.') });
});
const updateRecord = asyncHandler(async (req, res) => {
  const record = await PlacementRecord.findByIdAndUpdate(req.params.id, req.body, { new: true });
  await cacheDel('home:*');
  await cacheDel('stats:public');
  res.json({ success: true, record, flash: flash('success', 'Placement record updated.') });
});
const deleteRecord = asyncHandler(async (req, res) => {
  await PlacementRecord.findByIdAndDelete(req.params.id);
  await cacheDel('home:*');
  await cacheDel('stats:public');
  res.json({ success: true, flash: flash('success', 'Record deleted.') });
});

async function unusedTeamPhone(preferred) {
  if (preferred) {
    const taken = await User.findOne({ phone: preferred }).select('_id');
    if (taken) throw new ApiError(409, 'This phone number is already registered. Leave it blank or use a different number.');
    return preferred;
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const phone = `9${randomDigits(9)}`;
    const taken = await User.findOne({ phone }).select('_id');
    if (!taken) return phone;
  }
  throw new ApiError(500, 'Could not assign a phone number for this login.');
}

const teamMembers = listHandler(TnpTeamMember, { searchFields: ['fullName', 'designation'] });
const createTeamMember = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  delete body.createLogin;
  delete body.phone;
  delete body.tempPassword;

  let user = null;
  let loginPassword = '';
  let createdUser = false;
  let reusedAccount = false;
  if (req.body.createLogin) {
    if (!req.body.collegeEmail) throw new ApiError(400, 'College email is required to create a team login.');
    const email = String(req.body.collegeEmail).toLowerCase();
    const alreadyListed = await TnpTeamMember.findOne({ collegeEmail: email }).select('_id');
    if (alreadyListed) throw new ApiError(409, 'This email is already on the TNP team roster.');
    const existing = await User.findOne({ email });
    const teamPermissions = body.permissions?.length ? body.permissions : TEAM_PERMISSION_DEFAULTS;
    if (existing) {
      existing.tnpTeam = true;
      existing.permissions = [...new Set([...(existing.permissions || []), ...teamPermissions])];
      await existing.save();
      user = existing;
      reusedAccount = true;
    } else {
      const phone = await unusedTeamPhone(req.body.phone);
      loginPassword = req.body.tempPassword || 'TeamPass#123';
      try {
        user = await User.register(
          {
            name: body.fullName,
            email: req.body.collegeEmail,
            phone,
            role: ROLES.TNP_TEAM,
            permissions: teamPermissions,
            phoneVerified: true,
            tnpTeam: true,
          },
          loginPassword
        );
        createdUser = true;
      } catch (err) {
        if (err && err.code === 11000) throw new ApiError(409, 'This phone number is already registered. Leave it blank or use a different number.');
        throw err;
      }
    }
  }

  let member;
  try {
    member = await TnpTeamMember.create({ ...body, user: user?._id, isPlaceholder: !user });
  } catch (err) {
    if (createdUser) await User.deleteOne({ _id: user._id });
    throw err;
  }

  let mailWarning = '';
  if (createdUser) {
    mailWarning = await smsTo(
      user.phone,
      `IIIT Bhopal TNP team login. Email: ${user.email}. Temporary password: ${loginPassword}. Sign in at ${env.clientOrigin}/login and change the password.`,
      'alert'
    );
  }

  await audit(req, 'create', 'TnpTeamMember', member._id);
  const message = reusedAccount
    ? 'Team member saved. This email already has an account, so they sign in with their existing password.'
    : !user
      ? 'Team member saved.'
      : mailWarning
        ? `Team member saved. ${mailWarning.startsWith('TRIAL:') ? 'Twilio trial sent a sample SMS, so share this password' : 'The login SMS was not sent, so share this password'}: ${loginPassword}`
        : 'Team member saved. Login details were sent by SMS.';
  res.status(201).json({
    success: true,
    member,
    mailWarning,
    message,
    flash: flash(mailWarning ? 'warning' : 'success', message),
  });
});
const updateTeamMember = asyncHandler(async (req, res) => {
  const member = await TnpTeamMember.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (member?.user && req.body.permissions) {
    await User.findByIdAndUpdate(member.user, { permissions: req.body.permissions });
  }
  res.json({ success: true, member, flash: flash('success', 'Team member updated.') });
});
const deleteTeamMember = asyncHandler(async (req, res) => {
  const member = await TnpTeamMember.findById(req.params.id);
  if (!member) throw new ApiError(404, 'Team member not found.');
  const user = member.user
    ? await User.findById(member.user)
    : await User.findOne({ email: member.collegeEmail, role: ROLES.TNP_TEAM });
  const mailWarning = user?.phone
    ? await smsTo(user.phone, 'IIIT Bhopal TNP: you are suspended from the TNP team. Your team login has been removed.', 'alert')
    : 'The suspension SMS was not sent because this account has no mobile number.';
  if (user && user.role === ROLES.TNP_TEAM) {
    user.isActive = false;
    await user.save();
  } else if (user?.tnpTeam) {
    user.tnpTeam = false;
    user.permissions = [];
    await user.save();
  }
  await member.deleteOne();
  await audit(req, 'delete', 'TnpTeamMember', member._id);
  const message = mailWarning ? `Team member removed. ${mailWarning}` : 'Team member removed.';
  res.json({ success: true, mailWarning, flash: flash('success', message) });
});
const teamPhoto = asyncHandler(async (req, res) => {
  assertFile(req.file, 'image');
  const member = await TnpTeamMember.findById(req.params.id);
  const result = await uploadBuffer(req.file, { folder: 'tnp/team', resourceType: 'image', accessMode: 'public' });
  if (member.profilePhoto?.publicId) await destroyAsset(member.profilePhoto.publicId, 'image');
  member.profilePhoto = { publicId: result.public_id, url: result.secure_url };
  await member.save();
  res.json({ success: true, member });
});

const criteriaList = listHandler(JoiningCriteria, { searchFields: ['title'] });
const createCriteria = asyncHandler(async (req, res) => {
  const doc = await JoiningCriteria.create({ ...req.body, lastUpdatedBy: req.user._id });
  res.status(201).json({ success: true, criteria: doc, flash: flash('success', 'Joining criteria saved as draft unless published.') });
});
const updateCriteria = asyncHandler(async (req, res) => {
  const doc = await JoiningCriteria.findByIdAndUpdate(
    req.params.id,
    { ...req.body, lastUpdatedBy: req.user._id },
    { new: true }
  );
  res.json({ success: true, criteria: doc, flash: flash('success', 'Joining criteria updated.') });
});

const announcements = listHandler(Announcement, { searchFields: ['title'] });
const createAnnouncement = asyncHandler(async (req, res) => {
  const doc = await Announcement.create({ ...req.body, createdBy: req.user._id, publishedAt: req.body.status === 'published' ? new Date() : req.body.publishedAt });
  await cacheDel('home:*');
  res.status(201).json({ success: true, announcement: doc, flash: flash('success', 'Announcement saved.') });
});
const updateAnnouncement = asyncHandler(async (req, res) => {
  const doc = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true });
  await cacheDel('home:*');
  res.json({ success: true, announcement: doc, flash: flash('success', 'Announcement updated.') });
});
const deleteAnnouncement = asyncHandler(async (req, res) => {
  await Announcement.findByIdAndDelete(req.params.id);
  res.json({ success: true, flash: flash('success', 'Announcement deleted.') });
});

const recruiters = listHandler(Recruiter, { searchFields: ['name', 'email'], populate: { path: 'company', select: 'name' } });
const createRecruiter = asyncHandler(async (req, res) => {
  const doc = await Recruiter.create(req.body);
  res.status(201).json({ success: true, recruiter: doc, flash: flash('success', 'Recruiter saved.') });
});
const updateRecruiter = asyncHandler(async (req, res) => {
  const doc = await Recruiter.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, recruiter: doc, flash: flash('success', 'Recruiter updated.') });
});
const deleteRecruiter = asyncHandler(async (req, res) => {
  await Recruiter.findByIdAndDelete(req.params.id);
  res.json({ success: true, flash: flash('success', 'Recruiter deleted.') });
});

const roles = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { role: { $in: [ROLES.ADMIN, ROLES.TNP_TEAM] } };
  const [items, total] = await Promise.all([
    User.find(filter).select('name email role permissions isActive').sort({ role: 1, name: 1 }).skip(skip).limit(limit).lean().maxTimeMS(8000),
    User.countDocuments(filter).maxTimeMS(8000),
  ]);
  res.json({
    success: true,
    ...paginated(
      items.map((user) => ({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions || [],
        isActive: user.isActive,
      })),
      total,
      page,
      limit
    ),
  });
});
const updateRole = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id) && req.body.role && req.body.role !== req.user.role) {
    throw new ApiError(400, 'You cannot change your own role.');
  }
  const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
  await audit(req, 'role_update', 'User', user._id, { role: user.role, permissions: user.permissions });
  res.json({ success: true, user: user.safeJSON(), flash: flash('success', 'Role updated.') });
});

const auditLogs = listHandler(AuditLog, { searchFields: ['action', 'resource'] });

const healthDetail = asyncHandler(async (_req, res) => {
  const mongo = mongoose.connection.readyState === 1;
  res.json({
    success: true,
    mongo,
    redis: isRedisReady(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

const dashboard = asyncHandler(async (req, res) => {
  if (actsAsTeam(req.user)) {
    const assignedDrives = await PlacementDrive.find({ assignedTeamMembers: req.user._id }).select('_id jobTitle applicationDeadline status').lean().maxTimeMS(8000);
    const driveIds = assignedDrives.map((drive) => drive._id);
    const [toReview, applicationCount] = await Promise.all([
      Application.countDocuments({ drive: { $in: driveIds }, status: 'submitted' }).maxTimeMS(8000),
      Application.countDocuments({ drive: { $in: driveIds } }).maxTimeMS(8000),
    ]);
    const recentApps = await Application.find({ drive: { $in: driveIds } })
      .select('student drive status createdAt')
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('student', 'name')
      .populate({ path: 'drive', select: 'jobTitle' })
      .lean()
      .maxTimeMS(8000);
    return res.json({
      success: true,
      stats: { assigned: assignedDrives.length, toReview, apps: applicationCount, openDrives: assignedDrives.filter((drive) => drive.status === 'open').length },
      recentApps,
    });
  }
  const [studentsCount, companiesCount, openDrives, apps, recordsCount] = await Promise.all([
    User.countDocuments({ role: ROLES.STUDENT, isActive: { $ne: false } }).maxTimeMS(8000),
    Company.countDocuments().maxTimeMS(8000),
    PlacementDrive.countDocuments({ status: 'open' }).maxTimeMS(8000),
    Application.countDocuments().maxTimeMS(8000),
    PlacementRecord.countDocuments().maxTimeMS(8000),
  ]);
  const recentApps = await Application.find()
    .select('student drive status createdAt')
    .sort({ createdAt: -1 })
    .limit(8)
    .populate('student', 'name')
    .populate({ path: 'drive', select: 'jobTitle' })
    .lean()
    .maxTimeMS(8000);
  res.json({
    success: true,
    stats: { studentsCount, companiesCount, openDrives, apps, recordsCount },
    recentApps,
  });
});

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  return [keys.join(','), ...rows.map((row) => keys.map((key) => csvCell(row[key])).join(','))].join('\n');
}

const exportData = asyncHandler(async (req, res) => {
  const type = req.query.type || 'companies';
  let rows = [];
  if (type === 'applications') {
    const items = await Application.find()
      .limit(1000)
      .populate('student', 'name email')
      .populate({ path: 'drive', select: 'jobTitle', populate: { path: 'company', select: 'name' } })
      .lean();
    rows = items.map((item) => ({
      student: item.student?.name || '',
      email: item.student?.email || '',
      company: item.drive?.company?.name || '',
      drive: item.drive?.jobTitle || '',
      status: item.status,
      tracker: item.trackerMessage || '',
      interviewAt: item.interviewAt ? new Date(item.interviewAt).toISOString() : '',
    }));
  } else if (type === 'records') {
    const items = await PlacementRecord.find().limit(1000).lean();
    rows = items.map((item) => ({
      batch: item.batch,
      branch: item.branch,
      recordType: item.recordType,
      companyName: item.companyName || '',
      packageAmount: item.packageAmount ?? '',
      averageCtc: item.averageCtc ?? '',
      medianPackage: item.medianPackage ?? '',
      studentsPlaced: item.studentsPlaced ?? '',
      placementPercent: item.placementPercent ?? '',
      sourceDocument: item.sourceDocument || '',
    }));
  } else {
    const map = { companies: Company, drives: PlacementDrive, announcements: Announcement };
    const Model = map[type];
    if (!Model) throw new ApiError(400, 'Unsupported export type.');
    const items = await Model.find().limit(1000).lean();
    rows = items.map((item) => ({
      name: item.name || item.jobTitle || item.title || '',
      status: item.status || '',
      packageLpa: item.packageLpa ?? '',
      deadline: item.applicationDeadline ? new Date(item.applicationDeadline).toISOString() : '',
    }));
  }
  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${type}.csv"`);
    return res.send(toCsv(rows));
  }
  res.json({ success: true, type, items: rows, note: 'Limited to 1000 rows.' });
});

const recruitmentAnalytics = asyncHandler(async (req, res) => {
  const profiles = await StudentProfile.find({ 'placement.status': 'placed' })
    .select('batch branch placement')
    .lean()
    .maxTimeMS(8000);
  const byBatch = new Map();
  const byCompany = new Map();
  for (const profile of profiles) {
    const batchRow = byBatch.get(profile.batch) || { batch: profile.batch, placed: 0, topPackage: null };
    batchRow.placed += 1;
    if (profile.placement?.packageLpa != null) {
      batchRow.topPackage = batchRow.topPackage == null ? profile.placement.packageLpa : Math.max(batchRow.topPackage, profile.placement.packageLpa);
    }
    byBatch.set(profile.batch, batchRow);
    const company = profile.placement?.companyName || 'Unspecified';
    const companyRow = byCompany.get(company) || { company, offers: 0, topPackage: null };
    companyRow.offers += 1;
    if (profile.placement?.packageLpa != null) {
      companyRow.topPackage = companyRow.topPackage == null ? profile.placement.packageLpa : Math.max(companyRow.topPackage, profile.placement.packageLpa);
    }
    byCompany.set(company, companyRow);
  }
  const published = await PlacementRecord.find({ recordType: 'branch_wise' })
    .select('batch branch placementPercent studentsPlaced averageCtc')
    .lean()
    .maxTimeMS(8000);
  res.json({
    success: true,
    liveByBatch: [...byBatch.values()].sort((a, b) => b.batch - a.batch),
    liveByCompany: [...byCompany.values()].sort((a, b) => b.offers - a.offers || (b.topPackage || 0) - (a.topPackage || 0)),
    publishedBranchRows: published,
  });
});

const importData = asyncHandler(async (req, res) => {
  throw new ApiError(400, 'Bulk import accepts JSON { type, items[] } only after admin review. Use create endpoints for now or POST validated items.');
});

const importJson = asyncHandler(async (req, res) => {
  const { type, items } = req.body;
  if (!Array.isArray(items) || items.length > 200) throw new ApiError(400, 'Provide up to 200 items.');
  const map = { companies: Company, records: PlacementRecord };
  const Model = map[type];
  if (!Model) throw new ApiError(400, 'Unsupported import type.');
  const created = await Model.insertMany(items, { ordered: false });
  await audit(req, 'import', type, null, { count: created.length });
  res.json({ success: true, count: created.length, flash: flash('success', `Imported ${created.length} records.`) });
});

module.exports = {
  students,
  studentDetail,
  suspendStudent,
  studentResume,
  companies,
  createCompany,
  updateCompany,
  endCompany,
  deleteCompany,
  companyLogo,
  drives,
  createDrive,
  updateDrive,
  deleteDrive,
  applications,
  updateApplication,
  placementBoards,
  records,
  createRecord,
  updateRecord,
  deleteRecord,
  teamMembers,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  teamPhoto,
  criteriaList,
  createCriteria,
  updateCriteria,
  announcements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  recruiters,
  createRecruiter,
  updateRecruiter,
  deleteRecruiter,
  roles,
  updateRole,
  auditLogs,
  healthDetail,
  dashboard,
  exportData,
  recruitmentAnalytics,
  importData,
  importJson,
};
