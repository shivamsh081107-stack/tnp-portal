const mongoose = require('mongoose');
const { CRITERIA_STATUSES } = require('../utils/constants');

const joiningCriteriaSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    eligibilityRequirements: { type: String, default: '' },
    academicRequirements: { type: String, default: '' },
    expectedResponsibilities: { type: String, default: '' },
    commitmentExpectations: { type: String, default: '' },
    applicationOpensAt: Date,
    applicationClosesAt: Date,
    selectionRounds: [String],
    requiredDocuments: [String],
    faqs: [{ question: String, answer: String }],
    status: { type: String, enum: CRITERIA_STATUSES, default: 'draft' },
    isOfficial: { type: Boolean, default: false },
    lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('JoiningCriteria', joiningCriteriaSchema);
