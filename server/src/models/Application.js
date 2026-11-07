const mongoose = require('mongoose');
const { APPLICATION_STATUSES } = require('../utils/constants');

const applicationSchema = new mongoose.Schema(
  {
    drive: { type: mongoose.Schema.Types.ObjectId, ref: 'PlacementDrive', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    profileSnapshot: { type: mongoose.Schema.Types.Mixed },
    resumePublicId: String,
    declarationAccepted: { type: Boolean, required: true },
    status: { type: String, enum: APPLICATION_STATUSES, default: 'submitted', index: true },
    reviewNotes: { type: String, default: '' },
    trackerMessage: { type: String, default: '' },
    oaAt: Date,
    oaMode: { type: String, default: '' },
    oaPlace: { type: String, default: '' },
    interviewAt: Date,
    interviewMode: { type: String, default: '' },
    interviewPlace: { type: String, default: '' },
    submittedAt: { type: Date, default: Date.now },
    statusHistory: [
      {
        status: String,
        at: Date,
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],
  },
  { timestamps: true }
);

applicationSchema.index({ student: 1, drive: 1 }, { unique: true });
applicationSchema.index({ student: 1, status: 1 });
applicationSchema.index({ student: 1, createdAt: -1 });

module.exports = mongoose.model('Application', applicationSchema);
