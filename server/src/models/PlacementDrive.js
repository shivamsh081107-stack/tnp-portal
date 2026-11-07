const mongoose = require('mongoose');
const { BRANCHES, DRIVE_STATUSES, JOB_TYPES, WORK_MODES } = require('../utils/constants');

const driveSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    jobTitle: { type: String, required: true, trim: true },
    jobDescription: { type: String, default: '', maxlength: 8000 },
    knowMoreUrl: { type: String, default: '' },
    jobType: { type: String, enum: JOB_TYPES, default: 'full_time' },
    workMode: { type: String, enum: WORK_MODES, default: 'unspecified' },
    location: { type: String, default: '' },
    eligibleBranches: [{ type: String, enum: BRANCHES }],
    eligibleBatches: [Number],
    minCgpa: { type: Number, min: 0, max: 10 },
    maxCgpa: { type: Number, min: 0, max: 10 },
    minBacklogs: { type: Number, min: 0, max: 20 },
    maxBacklogs: { type: Number, min: 0, max: 20 },
    packageDetails: { type: String, default: '' },
    packageLpa: { type: Number, min: 0 },
    requiredSkills: [String],
    applicationOpenAt: Date,
    applicationDeadline: Date,
    requiredDocuments: [String],
    openings: Number,
    additionalRules: { type: String, default: '' },
    status: { type: String, enum: DRIVE_STATUSES, default: 'draft', index: true },
    assignedTeamMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isDemonstration: { type: Boolean, default: false },
  },
  { timestamps: true }
);

driveSchema.index({ jobTitle: 'text' });
driveSchema.index({ status: 1, applicationDeadline: 1 });

module.exports = mongoose.model('PlacementDrive', driveSchema);
