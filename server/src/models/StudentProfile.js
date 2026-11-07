const mongoose = require('mongoose');
const { BRANCHES } = require('../utils/constants');

const assetSchema = new mongoose.Schema(
  {
    publicId: String,
    url: String,
    bytes: Number,
    mimeType: String,
    originalName: String,
    accessMode: { type: String, default: 'authenticated' },
    uploadedAt: Date,
  },
  { _id: false }
);

const studentProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, required: true },
    enrollmentNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    branch: { type: String, enum: BRANCHES, required: true },
    batch: { type: Number, required: true, min: 2020, max: 2035 },
    cgpa: { type: Number, min: 0, max: 10, default: 0 },
    backlogs: { type: Number, min: 0, max: 20, default: 0 },
    academicHistory: { type: String, maxlength: 2000, default: '' },
    skills: [{ type: String, trim: true, maxlength: 60 }],
    projects: [{ title: String, description: String, url: String }],
    githubUrl: String,
    linkedinUrl: String,
    codingProfiles: [{ platform: String, url: String }],
    certifications: [{ name: String, issuer: String, url: String }],
    internships: [{ company: String, role: String, duration: String, description: String }],
    profileImage: assetSchema,
    resume: assetSchema,
    resumeText: { type: String, default: '', maxlength: 12000 },
    blockedCompanies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Company' }],
    placement: {
      status: { type: String, enum: ['unplaced', 'placed'], default: 'unplaced' },
      companyName: { type: String, default: '' },
      role: { type: String, default: '' },
      packageLpa: { type: Number, min: 0 },
      drive: { type: mongoose.Schema.Types.ObjectId, ref: 'PlacementDrive' },
      selectedAt: Date,
    },
  },
  { timestamps: true }
);

studentProfileSchema.index({ branch: 1, batch: 1 });
studentProfileSchema.index({ 'placement.status': 1, batch: 1, 'placement.packageLpa': -1 });

module.exports = mongoose.model('StudentProfile', studentProfileSchema);
