const mongoose = require('mongoose');
const { BRANCHES, RECORD_TYPES, VERIFICATION_STATUSES } = require('../utils/constants');

const placementRecordSchema = new mongoose.Schema(
  {
    recordType: { type: String, enum: RECORD_TYPES, required: true, index: true },
    companyName: String,
    role: String,
    branch: { type: String, enum: [...BRANCHES, 'OVERALL'] },
    batch: Number,
    packageAmount: Number,
    averageCtc: Number,
    medianPackage: Number,
    currency: { type: String, default: 'INR' },
    unit: { type: String, default: 'LPA' },
    metricNote: { type: String, default: '' },
    sourceDocument: { type: String, required: true },
    sourcePage: String,
    sourceDate: String,
    verificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'provisional' },
    notes: { type: String, default: '' },
    studentsPlaced: Number,
    studentsParticipated: Number,
    placementPercent: Number,
  },
  { timestamps: true }
);

placementRecordSchema.index({ batch: 1, recordType: 1, branch: 1 });

module.exports = mongoose.model('PlacementRecord', placementRecordSchema);
