const mongoose = require('mongoose');
const { PERMISSIONS } = require('../utils/constants');

const tnpTeamMemberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fullName: { type: String, required: true, trim: true },
    designation: { type: String, default: '' },
    teamRole: { type: String, default: '' },
    branch: String,
    batch: Number,
    collegeEmail: { type: String, lowercase: true, trim: true },
    responsibilities: { type: String, default: '' },
    contactInfo: { type: String, default: '' },
    showContactPublicly: { type: Boolean, default: false },
    profilePhoto: { publicId: String, url: String },
    isActive: { type: Boolean, default: true },
    joiningDate: Date,
    tenureNote: String,
    permissions: [{ type: String, enum: Object.values(PERMISSIONS) }],
    isPlaceholder: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TnpTeamMember', tnpTeamMemberSchema);
