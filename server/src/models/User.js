const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');
const { ROLES, PERMISSIONS } = require('../utils/constants');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.STUDENT, index: true },
    permissions: [{ type: String, enum: Object.values(PERMISSIONS) }],
    isActive: { type: Boolean, default: true },
    phoneVerified: { type: Boolean, default: false },
    tnpTeam: { type: Boolean, default: false },
    lastLoginAt: Date,
    passwordReset: {
      tokenHash: String,
      expiresAt: Date,
      usedAt: Date,
    },
  },
  { timestamps: true }
);

userSchema.plugin(passportLocalMongoose, {
  usernameField: 'email',
  usernameLowerCase: true,
});

userSchema.index({ role: 1, createdAt: -1 });

userSchema.methods.safeJSON = function safeJSON() {
  return {
    id: this.id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    role: this.role,
    permissions: this.permissions || [],
    isActive: this.isActive,
    phoneVerified: this.phoneVerified,
    tnpTeam: Boolean(this.tnpTeam),
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
