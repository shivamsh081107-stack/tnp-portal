const STOP = new Set(
  `a an the and or of to for in on with from by at as is are was were be been being this that those these your you we our their its it not no yes into over under about within without per via using use used work working role job company team ability able strong good excellent etc including include required requirement requirements candidate candidates must should will can may have has had our their who which than then also such other any all each both more most some only if when where while after before during through across between both same other both both`
    .split(/\s+/)
);

function keywords(text) {
  const parts = String(text || '')
    .toLowerCase()
    .match(/[a-z][a-z0-9+#]*(?:\.[a-z0-9+#]+)*/g) || [];
  return [...new Set(parts.filter((word) => word.length > 2 && !STOP.has(word.replace(/\./g, ''))))];
}

function covers(resumeTokens, term) {
  const normalized = String(term || '')
    .toLowerCase()
    .trim();
  if (!normalized) return false;
  if (resumeTokens.has(normalized)) return true;
  const pieces = normalized.split(/[^a-z0-9+#.]/).filter((part) => part.length > 2);
  return pieces.length > 0 && pieces.every((part) => resumeTokens.has(part));
}

function skillsFromDescription(jobDescription) {
  const text = String(jobDescription || '');
  const required = text.match(/required skills:\s*([^\n]+)/i);
  const extra = text.match(/good to have:\s*([^\n]+)/i);
  const split = (line) => line.split(/,|\band\b/).map((item) => item.trim()).filter(Boolean);
  if (!required) return [];
  return split(required[1]).concat(extra ? split(extra[1]) : []);
}

function localResumeMatch({ resumeText, jobDescription, requiredSkills = [] }) {
  const resumeTokens = new Set(keywords(resumeText));
  const listed = requiredSkills.map((skill) => String(skill).trim()).filter(Boolean);
  const fromDescription = listed.length ? listed : skillsFromDescription(jobDescription);
  const targets = fromDescription.length ? fromDescription : keywords(jobDescription).slice(0, 24);
  const matched = [];
  const missing = [];
  targets.forEach((term) => {
    if (covers(resumeTokens, term)) matched.push(term);
    else missing.push(term);
  });
  const matchScore = targets.length ? Math.round((matched.length / targets.length) * 100) : 0;
  const summary =
    targets.length === 0
      ? 'The job description has no comparable skills or keywords yet.'
      : `The resume text covers ${matched.length} of ${targets.length} job-description terms (${matchScore}%).`;
  const suggestions = missing.slice(0, 5).map((term) => {
    return `If you have used ${term}, add it with a project, coursework, or tool line. Do not add it if you have not done the work.`;
  });
  return {
    matchScore,
    summary,
    matched: matched.slice(0, 16),
    missing: missing.slice(0, 12),
    suggestions,
  };
}

function localResumeReview(resumeText) {
  const text = String(resumeText || '');
  const strengths = [];
  const improvements = [];
  if (/project/i.test(text)) strengths.push('Projects are mentioned, so a reviewer can see what you have built.');
  else improvements.push('Add a projects section. For each project, name the tools and what you built.');
  if (/skill/i.test(text)) strengths.push('A skills section is present.');
  else improvements.push('Add a skills section with languages and tools you have actually used.');
  if (/education|b\.?\s?tech|cgpa|bachelor/i.test(text)) strengths.push('Education is visible on the resume.');
  else improvements.push('Add education with branch, batch, and CGPA.');
  if (text.length >= 500) strengths.push('The resume has enough detail to review section by section.');
  else improvements.push('The resume text is short. Add bullets under projects and coursework.');
  if (!strengths.length) strengths.push('The resume text was read. Clear headings for Education, Skills, and Projects will make it easier to scan.');
  return {
    summary: 'This is a general resume review. No job description was provided, so there is no ATS match score.',
    strengths: strengths.slice(0, 6),
    improvements: improvements.slice(0, 6),
    suggestions: improvements.slice(0, 5),
  };
}

module.exports = { localResumeMatch, localResumeReview, keywords };
