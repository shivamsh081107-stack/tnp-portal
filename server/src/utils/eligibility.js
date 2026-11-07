function isEligibleForDrive(profile, drive, now = new Date()) {
  const reasons = [];
  if (!drive || drive.status !== 'open') reasons.push('Drive is not open');
  if (drive?.applicationOpenAt && now < new Date(drive.applicationOpenAt)) {
    reasons.push('Applications have not opened yet');
  }
  if (drive?.applicationDeadline && now > new Date(drive.applicationDeadline)) {
    reasons.push('Application deadline has passed');
  }
  if (Array.isArray(drive?.eligibleBranches) && drive.eligibleBranches.length) {
    if (!drive.eligibleBranches.includes(profile?.branch)) {
      reasons.push('Branch is not listed as eligible');
    }
  }
  if (Array.isArray(drive?.eligibleBatches) && drive.eligibleBatches.length) {
    if (!drive.eligibleBatches.map(String).includes(String(profile?.batch))) {
      reasons.push('Graduation batch is not listed as eligible');
    }
  }
  if (drive?.minCgpa != null && Number(profile?.cgpa || 0) < Number(drive.minCgpa)) {
    reasons.push('CGPA is below the listed minimum');
  }
  if (drive?.maxCgpa != null && Number(profile?.cgpa || 0) > Number(drive.maxCgpa)) {
    reasons.push('CGPA is above the listed maximum');
  }
  if (drive?.minBacklogs != null && Number(profile?.backlogs || 0) < Number(drive.minBacklogs)) {
    reasons.push('Backlogs are below the listed minimum');
  }
  if (drive?.maxBacklogs != null && Number(profile?.backlogs || 0) > Number(drive.maxBacklogs)) {
    reasons.push('Backlogs exceed the listed limit');
  }
  return { eligible: reasons.length === 0, reasons };
}

function cardReason(profile, drive, now = new Date()) {
  const result = isEligibleForDrive(profile, drive, now);
  const cgpaOk = !result.reasons.some((reason) => /CGPA/i.test(reason));
  let code = 'eligible';
  if (result.reasons.some((reason) => /CGPA is above/i.test(reason))) code = 'CGPA above max';
  else if (result.reasons.some((reason) => /CGPA/i.test(reason))) code = 'CGPA short';
  else if (result.reasons.some((reason) => /deadline/i.test(reason))) code = 'deadline passed';
  else if (result.reasons.some((reason) => /branch/i.test(reason))) code = 'branch not allowed';
  else if (result.reasons.some((reason) => /Backlogs exceed/i.test(reason))) code = 'backlogs over limit';
  else if (result.reasons.some((reason) => /Backlogs are below/i.test(reason))) code = 'backlogs below minimum';
  else if (!result.eligible) code = result.reasons[0] || 'not eligible';
  if (code === 'eligible' && !profile?.resume?.publicId) code = 'resume missing';
  return {
    ...result,
    code,
    canApply: cgpaOk && result.eligible && Boolean(profile?.resume?.publicId),
  };
}

module.exports = { isEligibleForDrive, cardReason };
