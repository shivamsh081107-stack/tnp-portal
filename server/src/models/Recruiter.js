const mongoose = require('mongoose');

const recruiterSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true },
    email: String,
    phone: String,
    designation: String,
    isActive: { type: Boolean, default: true },
    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Recruiter', recruiterSchema);
