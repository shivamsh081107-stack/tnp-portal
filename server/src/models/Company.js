const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    slug: { type: String, unique: true, sparse: true },
    website: String,
    description: { type: String, maxlength: 4000, default: '' },
    industry: { type: String, default: '' },
    recruiterContact: {
      name: String,
      email: String,
      phone: String,
      visibleToTeam: { type: Boolean, default: false },
    },
    logo: {
      publicId: String,
      url: String,
    },
    isActive: { type: Boolean, default: true },
    notes: { type: String, default: '' },
    sourceNote: { type: String, default: 'Listed as a known recruiter; openings are not implied.' },
  },
  { timestamps: true }
);

companySchema.index({ name: 'text', industry: 'text' });

module.exports = mongoose.model('Company', companySchema);
