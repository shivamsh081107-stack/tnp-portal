const asyncHandler = require('../utils/asyncHandler');
const { chat, analyzeResume } = require('../services/openai.service');
const PlacementDrive = require('../models/PlacementDrive');
const { ApiError } = require('../utils/apiError');
const { assertFile } = require('../services/cloudinary.service');
const { extractPdfText } = require('../utils/pdfText');

module.exports.chatHandler = asyncHandler(async (req, res) => {
  const reply = await chat({ user: req.user, message: req.body.message, history: req.body.history });
  res.json({ success: true, reply });
});

module.exports.parseResumeHandler = asyncHandler(async (req, res) => {
  assertFile(req.file, 'resume');
  let text = '';
  try {
    text = await extractPdfText(req.file.buffer);
  } catch {
    text = '';
  }
  if (text.length < 10) {
    throw new ApiError(400, 'Could not read text from this PDF. Paste the resume text instead.');
  }
  res.json({ success: true, text });
});

module.exports.analyzeResumeHandler = asyncHandler(async (req, res) => {
  let drive = null;
  let jobDescription = String(req.body.jobDescription || '').trim();
  if (req.body.driveId) {
    drive = await PlacementDrive.findById(req.body.driveId).populate('company', 'name').lean();
    if (!drive || drive.status === 'draft') throw new ApiError(404, 'Drive not found.');
    jobDescription = String(drive.jobDescription || '').trim();
  }
  const result = await analyzeResume({ drive, jobDescription, resumeText: req.body.resumeText });
  res.json({ success: true, ...result });
});
