const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const { ApiError } = require('../utils/apiError');
const env = require('../config/env');

const LIMITS = {
  image: { mime: ['image/jpeg', 'image/png', 'image/webp'], max: 2 * 1024 * 1024 },
  resume: { mime: ['application/pdf'], max: 5 * 1024 * 1024 },
};

function assertFile(file, kind) {
  const spec = LIMITS[kind];
  if (!file) throw new ApiError(400, 'A file is required.');
  if (!spec.mime.includes(file.mimetype)) throw new ApiError(400, 'Unsupported file type.');
  if (file.size > spec.max) throw new ApiError(400, 'File is too large.');
  if (kind === 'resume' && file.buffer && !file.buffer.subarray(0, 5).toString().startsWith('%PDF')) {
    throw new ApiError(400, 'The file is not a valid PDF.');
  }
}

async function uploadBuffer(file, { folder, resourceType, accessMode }) {
  if (!isCloudinaryConfigured()) {
    throw new ApiError(503, 'File uploads are unavailable until Cloudinary is configured.');
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        type: accessMode === 'authenticated' ? 'authenticated' : 'upload',
        access_mode: accessMode || 'public',
      },
      (err, result) => {
        if (err) reject(new ApiError(502, 'Cloudinary upload failed.'));
        else resolve(result);
      }
    );
    stream.end(file.buffer);
  });
}

function signedResumeUrl(publicId) {
  if (!isCloudinaryConfigured()) throw new ApiError(503, 'Cloudinary is not configured.');
  return cloudinary.url(publicId, {
    resource_type: 'raw',
    type: 'authenticated',
    sign_url: true,
    expires_at: Math.floor(Date.now() / 1000) + 120,
    attachment: true,
  });
}

async function destroyAsset(publicId, resourceType = 'image') {
  if (!publicId || !isCloudinaryConfigured()) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, type: env.resumeAccessMode === 'authenticated' ? 'authenticated' : undefined });
  } catch {
    /* cleanup best-effort */
  }
}

module.exports = { assertFile, uploadBuffer, signedResumeUrl, destroyAsset };
