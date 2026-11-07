const mongoose = require('mongoose');
const { ANNOUNCEMENT_AUDIENCES } = require('../utils/constants');

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, default: 'general' },
    audience: { type: String, enum: ANNOUNCEMENT_AUDIENCES, default: 'students' },
    publishedAt: Date,
    expiresAt: Date,
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

announcementSchema.index({ status: 1, publishedAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
