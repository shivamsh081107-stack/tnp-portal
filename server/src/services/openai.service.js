const OpenAI = require('openai');
const env = require('../config/env');
const Company = require('../models/Company');
const PlacementDrive = require('../models/PlacementDrive');
const PlacementRecord = require('../models/PlacementRecord');
const Announcement = require('../models/Announcement');
const StudentProfile = require('../models/StudentProfile');
const { isEligibleForDrive } = require('../utils/eligibility');
const { localResumeMatch, localResumeReview } = require('../utils/resumeMatch');

let openAiDown = false;
let lastDownTime = 0;

function isOpenAiConfigured() {
  return Boolean(env.openaiApiKey);
}

function canCallOpenAi() {
  if (!isOpenAiConfigured()) return false;
  if (openAiDown) {
    if (Date.now() - lastDownTime > 30000) {
      openAiDown = false;
      return true;
    }
    return false;
  }
  return true;
}

async function gatherContext(user) {
  const [companies, drives, records, announcements] = await Promise.all([
    Company.find({ isActive: true }).select('name industry description').limit(30).lean(),
    PlacementDrive.find({ status: 'open' }).populate('company', 'name').limit(30).lean(),
    PlacementRecord.find().sort({ batch: -1 }).limit(40).lean(),
    Announcement.find({ status: 'published' }).sort({ publishedAt: -1 }).limit(10).lean(),
  ]);
  let profile = null;
  let eligibility = [];
  if (user?.role === 'student') {
    profile = await StudentProfile.findOne({ user: user._id }).lean();
    eligibility = drives.map((drive) => ({
      driveId: String(drive._id),
      jobTitle: drive.jobTitle,
      company: drive.company?.name,
      isDemonstration: Boolean(drive.isDemonstration),
      ...isEligibleForDrive(profile, drive),
    }));
  }
  return { companies, drives, records, announcements, profile, eligibility };
}

function sanitizeProfile(profile) {
  if (!profile) return null;
  return {
    branch: profile.branch,
    batch: profile.batch,
    cgpa: profile.cgpa,
    backlogs: profile.backlogs,
    skills: profile.skills,
  };
}

function publishedLine(records, pick, label, field) {
  const row = pick(records);
  if (!row || row[field] == null) return `${label}: Awaiting published record.`;
  const who = row.companyName ? `${row.companyName}, ` : '';
  const batch = row.batch ? `batch ${row.batch}` : 'batch not listed';
  return `${label}: ${row[field]} ${row.unit || 'LPA'} (${who}${batch}). Source: ${row.sourceDocument || 'published placement record'}.`;
}

function localReply(message, ctx) {
  const text = String(message || '').toLowerCase();
  const lines = [];
  const open = ctx.drives.filter((drive) => drive.status === 'open');

  const asksGreeting = /^(hi|hello|hey|greetings|who are you|help|namaste)/i.test(text.trim());
  const asksDrives = /drive|compan|apply|eligib|deadline|opening|job/.test(text);
  const asksStats = /package|ctc|salary|highest|average|median|statistic|placed|percent|record/.test(text);
  const asksProfile = /profile|cgpa|backlog|branch|batch|my status/.test(text);
  const asksResume = /resume|cv|project|ats|format/.test(text);
  const asksPrep = /prep|interview|dsa|coding|round|question|technical|practice/.test(text);
  const asksProcess = /oops|assessment|status|tracker|offer|select|procedure|rule|policy|timeline/.test(text);

  if (asksGreeting) {
    lines.push('Hello! Welcome to the IIIT Bhopal Training and Placement Assistant.');
    lines.push('I can help you with:');
    lines.push('- Checking active placement drives and your eligibility status');
    lines.push('- Official placement statistics (highest package 85 LPA, average CTC ~18 LPA)');
    lines.push('- Interview preparation tips for technical and HR rounds');
    lines.push('- Application tracking steps (Applied -> Shortlisted -> OA -> Interview -> Offer)');
    lines.push('Feel free to ask any question about drives, packages, or preparation!');
    return lines.join('\n');
  }

  if (asksPrep) {
    lines.push('Technical Interview & Assessment Preparation Guidelines:');
    lines.push('1. Data Structures & Algorithms: Focus on Arrays, HashMaps, Trees, Graphs, Two Pointers, and Dynamic Programming. Practice medium-difficulty LeetCode problems.');
    lines.push('2. Core CS Fundamentals: Revise Operating Systems (process vs thread, deadlock, virtual memory), DBMS (indexing, SQL queries, normalization, ACID), and Computer Networks (TCP/IP, HTTP/HTTPS, DNS).');
    lines.push('3. System Design: Understand OOP design patterns, modular architecture, and basic scalability concepts.');
    lines.push('4. Projects & Resume: Be ready to explain your projects using the STAR technique (Situation, Task, Action, Result) and justify every technology mentioned.');
    return lines.join('\n');
  }

  if (asksResume) {
    lines.push('Resume Guidance for IIIT Bhopal Placements:');
    lines.push('- Ensure your resume is a single-page PDF with clear sections: Education, Skills, Projects, and Experience/Coursework.');
    lines.push('- Use active action verbs (e.g. Developed, Architected, Optimized, Implemented) and quantify metrics (e.g. "reduced latency by 35%").');
    lines.push('- You can also use the Resume Analyzer tool in the student sidebar to match your resume against any drive job description!');
  }

  if (asksDrives) {
    if (!open.length) {
      lines.push('No open placement drives are currently published in the portal.');
    } else {
      lines.push('Open Placement Drives in the Portal:');
      open.slice(0, 8).forEach((drive) => {
        const match = ctx.eligibility.find((item) => item.driveId === String(drive._id));
        const verdict = !match
          ? ''
          : match.eligible
            ? ' [Eligible]'
            : ` [Not eligible: ${(match.reasons || []).join('; ') || 'see drive'}]`;
        const ctc = drive.packageDetails || (drive.packageLpa ? `${drive.packageLpa} LPA` : '');
        const ctcText = ctc ? ` (${ctc})` : '';
        const deadline = drive.applicationDeadline
          ? ` Closes ${new Date(drive.applicationDeadline).toLocaleDateString()}.`
          : '';
        lines.push(`- ${drive.company?.name || 'Company'}: ${drive.jobTitle}${ctcText}.${deadline}${verdict}`);
      });
    }
  }

  if (asksStats) {
    lines.push('Official IIIT Bhopal Placement Highlights:');
    lines.push('• Highest Package: 85 LPA (Atlassian, Batch 2022 & 2025)');
    lines.push('• Branch Highlights: IT - 58 LPA (Cred), ECE - 57 LPA (Meesho), CSE - 41 LPA (Motive)');
    lines.push('• Average CTC: 18.02 LPA for 2026 (in-progress), 16.09 LPA for 2025 (96.59% placed), 20.51 LPA for 2023 (99.25% placed)');
    lines.push('• Prominent Recruiters: Atlassian, Cred, Microsoft, Amazon, Salesforce, Flipkart, LinkedIn, Meesho, Qualcomm, Tekion');
    lines.push('Source: IIIT Bhopal T&P Cell verified records.');
  }

  if (asksProfile) {
    const student = sanitizeProfile(ctx.profile);
    if (!student) {
      lines.push('No student profile is attached to this login.');
    } else {
      lines.push(
        `Profile on file: Branch ${student.branch || 'not set'}, Batch ${student.batch || 'not set'}, CGPA ${student.cgpa ?? 'not set'}, Backlogs ${student.backlogs ?? 0}.`
      );
      if (student.skills && student.skills.length) {
        lines.push(`Recorded Skills: ${student.skills.join(', ')}`);
      }
      lines.push('Remember to upload an updated PDF resume in the Resume section before applying.');
    }
  }

  if (asksProcess) {
    lines.push('IIIT Bhopal Placement Application Timeline:');
    lines.push('1. Applied: Student submits application before drive deadline.');
    lines.push('2. Shortlisted: TNP cell reviews profile against recruiter criteria.');
    lines.push('3. Online Assessment (OA): Coding / aptitude assessment round.');
    lines.push('4. Interview: Technical and HR rounds conducted with the company.');
    lines.push('5. Offer: Final offer letter issued upon successful selection.');
    lines.push('Policy Note: Skipping steps is rejected by the portal workflow.');
  }

  if (!lines.length) {
    lines.push('I can help you with open drives, your eligibility, published highest / average placement statistics, resume review, or interview preparation.');
    lines.push(`The portal currently has ${ctx.companies.length} active companies and ${open.length} open drives.`);
    lines.push('Try asking: "What is the highest package?", "Am I eligible for open drives?", or "How to prepare for technical interviews?"');
  }

  return lines.join('\n');
}

async function chat({ user, message, history }) {
  const ctx = await gatherContext(user);
  if (!canCallOpenAi()) return localReply(message, ctx);
  const client = new OpenAI({ apiKey: env.openaiApiKey, timeout: env.openaiTimeoutMs });
  const system = `You are the IIIT Bhopal Training and Placement assistant.
Never invent official placement packages, eligibility decisions, TNP team members, or college policy.
Use the JSON context and established IIIT Bhopal placement stats (Highest: 85 LPA Atlassian, 58 LPA Cred, 57 LPA Meesho; Average: 18.02 LPA for 2026, 16.09 LPA for 2025; Recruiters: Atlassian, Cred, Microsoft, Amazon, Salesforce, Flipkart, LinkedIn, Meesho, Qualcomm, Tekion).
Distinguish general career advice from official college policy.
Do not request or repeat passwords, OTPs or secrets.
Eligibility decisions in context.eligibility are authoritative.
Application stages: Applied -> Shortlisted -> Online assessment -> Interview -> Offer.

CONTEXT:
${JSON.stringify({
    companies: ctx.companies,
    drives: ctx.drives.map((d) => ({
      id: d._id,
      title: d.jobTitle,
      company: d.company?.name,
      status: d.status,
      isDemonstration: d.isDemonstration,
      eligibleBranches: d.eligibleBranches,
      eligibleBatches: d.eligibleBatches,
      minCgpa: d.minCgpa,
      deadline: d.applicationDeadline,
      packageDetails: d.packageDetails || null,
    })),
    records: ctx.records,
    announcements: ctx.announcements.map((a) => ({ title: a.title, description: a.description })),
    student: sanitizeProfile(ctx.profile),
    eligibility: ctx.eligibility,
  })}`;

  const messages = [
    { role: 'system', content: system },
    ...(history || []).slice(-8),
    { role: 'user', content: message },
  ];

  try {
    const completion = await client.chat.completions.create({
      model: env.openaiModel,
      messages,
      temperature: 0.2,
    });
    return completion.choices[0]?.message?.content || localReply(message, ctx);
  } catch (err) {
    openAiDown = true;
    lastDownTime = Date.now();
    loggerSafe(err);
    return localReply(message, ctx);
  }
}

function loggerSafe(err) {
  const logger = require('../utils/logger');
  logger.error('OpenAI chat failed', { message: err && err.message });
}

function clampList(value, max) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean).slice(0, max);
}

function parseAnalysis(raw, fallback) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }
  const matchScore = Number(parsed.matchScore);
  if (!Number.isFinite(matchScore)) return fallback;
  return {
    matchScore: Math.max(0, Math.min(100, Math.round(matchScore))),
    summary: String(parsed.summary || fallback.summary).slice(0, 600),
    matched: clampList(parsed.matched, 16),
    missing: clampList(parsed.missing, 12),
    suggestions: clampList(parsed.suggestions, 5),
  };
}

function parseReview(raw, fallback) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (!parsed.summary) return fallback;
  return {
    summary: String(parsed.summary).slice(0, 800),
    strengths: clampList(parsed.strengths, 8),
    improvements: clampList(parsed.improvements, 8),
    suggestions: clampList(parsed.suggestions, 6),
  };
}

async function reviewResume({ resumeText, drive }) {
  const local = localResumeReview(resumeText);
  const driveInfo = drive
    ? {
        id: String(drive._id),
        title: drive.jobTitle,
        company: drive.company?.name || '',
        isDemonstration: Boolean(drive.isDemonstration),
      }
    : null;
  if (!canCallOpenAi()) {
    return {
      mode: 'review',
      provider: 'local',
      note: 'No job description was provided, so this is a general resume review with no ATS score.',
      drive: driveInfo,
      analysis: local,
    };
  }
  const client = new OpenAI({ apiKey: env.openaiApiKey, timeout: env.openaiTimeoutMs });
  try {
    const completion = await client.chat.completions.create({
      model: env.openaiModel,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You review a student resume the way ChatGPT would, for IIIT Bhopal TNP preparation.
There is no job description, so do not score ATS match and do not invent a target role.
Return JSON only with keys summary (two or three sentences), strengths (string array), improvements (string array), suggestions (string array, max 6).
Talk about clarity, projects, skills, education, and what a recruiter would ask next. Do not invent employers, metrics, or skills that are not in the text.`,
        },
        { role: 'user', content: JSON.stringify({ resumeText: String(resumeText).slice(0, 12000) }) },
      ],
    });
    return {
      mode: 'review',
      provider: 'openai',
      note: '',
      drive: driveInfo,
      analysis: parseReview(completion.choices[0]?.message?.content || '', local),
    };
  } catch (err) {
    openAiDown = true;
    loggerSafe(err);
    return {
      mode: 'review',
      provider: 'local',
      note: 'The language model did not respond. Showing a general resume review instead.',
      drive: driveInfo,
      analysis: local,
    };
  }
}

async function analyzeResume({ drive, jobDescription, resumeText }) {
  const jd = String(jobDescription || drive?.jobDescription || '').trim();
  if (jd.length < 5) return reviewResume({ resumeText, drive });
  const requiredSkills = drive?.requiredSkills || [];
  const description = [
    drive?.jobTitle,
    drive?.jobDescription,
    jobDescription,
    requiredSkills.length ? `Required skills: ${requiredSkills.join(', ')}` : '',
    drive?.additionalRules,
  ]
    .filter(Boolean)
    .join('\n');
  const local = localResumeMatch({ resumeText, jobDescription: description, requiredSkills });
  const driveInfo = drive
    ? {
        id: String(drive._id),
        title: drive.jobTitle,
        company: drive.company?.name || '',
        isDemonstration: Boolean(drive.isDemonstration),
      }
    : null;

  if (!canCallOpenAi()) {
    return {
      mode: 'ats',
      provider: 'local',
      note: env.openaiApiKey
        ? 'The language model did not respond. Showing a keyword comparison instead.'
        : 'OpenAI is not configured. This is a keyword comparison, not a model review.',
      drive: driveInfo,
      analysis: local,
    };
  }

  const client = new OpenAI({ apiKey: env.openaiApiKey, timeout: env.openaiTimeoutMs });
  try {
    const completion = await client.chat.completions.create({
      model: env.openaiModel,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You compare a student resume with a job description for IIIT Bhopal TNP preparation.
Return JSON only with keys matchScore (0-100 integer), summary (one or two sentences), matched (string array), missing (string array), suggestions (string array, max 5).
Score how much of the job description is evidenced by the resume text. Do not invent projects, employers, metrics, or skills.
Do not decide official eligibility, packages, or selection. If the drive is marked demonstration, say the opening is a sample.
Suggestions must be edits the student can make only when the resume already implies that experience, otherwise tell them not to add the skill.`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            drive: driveInfo,
            jobDescription: description.slice(0, 8000),
            resumeText: String(resumeText).slice(0, 12000),
          }),
        },
      ],
    });
    const analysis = parseAnalysis(completion.choices[0]?.message?.content || '', local);
    return { mode: 'ats', provider: 'openai', note: '', drive: driveInfo, analysis };
  } catch (err) {
    openAiDown = true;
    loggerSafe(err);
    return {
      mode: 'ats',
      provider: 'local',
      note: 'The language model did not respond. Showing a keyword comparison instead.',
      drive: driveInfo,
      analysis: local,
    };
  }
}

module.exports = { chat, analyzeResume, isOpenAiConfigured };
