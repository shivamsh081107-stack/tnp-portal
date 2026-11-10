const { connectDb, disconnectDb } = require('../config/db');
const env = require('../config/env');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const Company = require('../models/Company');
const PlacementDrive = require('../models/PlacementDrive');
const PlacementRecord = require('../models/PlacementRecord');
const TnpTeamMember = require('../models/TnpTeamMember');
const JoiningCriteria = require('../models/JoiningCriteria');
const Announcement = require('../models/Announcement');
const { ROLES, PERMISSIONS, TEAM_PERMISSION_DEFAULTS } = require('../utils/constants');

const SOURCE = 'IIIT Bhopal T&P Cell placement statistics PDF dated 15 April 2026';

const highest = [
  { batch: 2026, companyName: 'Cred', packageAmount: 58, role: 'Highest package in IT (batch in progress as of source date)', notes: 'IT highlight' },
  { batch: 2026, companyName: 'Meesho', packageAmount: 57, role: 'Highest package in ECE', notes: 'ECE highlight' },
  { batch: 2026, companyName: 'Motive', packageAmount: 41, role: 'Highest package in CSE', notes: 'CSE highlight' },
  { batch: 2025, companyName: 'Atlassian', packageAmount: 85, role: 'Highest package' },
  { batch: 2025, companyName: 'Cred', packageAmount: 58, role: 'Second highest package' },
  { batch: 2025, companyName: 'Microsoft', packageAmount: 45, role: 'Third highest package' },
  { batch: 2024, companyName: 'Amazon', packageAmount: 46, role: 'Highest package' },
  { batch: 2024, companyName: 'Salesforce', packageAmount: 45, role: 'Second highest package' },
  { batch: 2024, companyName: 'Flipkart', packageAmount: 32.5, role: 'Third highest package' },
  { batch: 2023, companyName: 'LinkedIn', packageAmount: 60, role: 'Highest package' },
  { batch: 2023, companyName: 'Cred', packageAmount: 52, role: 'Second highest package' },
  { batch: 2023, companyName: 'Amazon', packageAmount: 45.5, role: 'Third highest; source notes 23 students' },
  { batch: 2022, companyName: 'Atlassian', packageAmount: 85, role: 'Highest package (1 student)' },
  { batch: 2022, companyName: 'Microsoft', packageAmount: 46, role: 'Second highest (2 students)' },
  { batch: 2022, companyName: 'Tekion', packageAmount: 30, role: 'Third highest (14 students)' },
  { batch: 2021, companyName: 'Qualcomm', packageAmount: 26, role: 'Highest package' },
];

const overall = [
  { batch: 2026, averageCtc: 18.02, studentsPlaced: 134, studentsParticipated: 150, placementPercent: 89.33, notes: 'In progress as of 15 April 2026' },
  { batch: 2025, averageCtc: 16.09, studentsPlaced: 142, studentsParticipated: 147, placementPercent: 96.59, notes: 'Completed' },
  { batch: 2024, averageCtc: 12.32, studentsPlaced: 115, studentsParticipated: 135, placementPercent: 85.18, notes: 'Completed' },
  { batch: 2023, averageCtc: 20.51, studentsPlaced: 134, studentsParticipated: 135, placementPercent: 99.25, notes: 'Completed' },
  { batch: 2022, averageCtc: 14.5, studentsPlaced: 103, studentsParticipated: 115, placementPercent: 89.56, notes: 'Completed' },
  { batch: 2021, averageCtc: 9.26, studentsPlaced: 78, studentsParticipated: 90, placementPercent: 86.66, notes: 'Completed' },
];

const branchWise = [
  { batch: 2026, branch: 'ECE', averageCtc: 17.16, studentsPlaced: 39, studentsParticipated: 47, placementPercent: 82.97 },
  { batch: 2026, branch: 'CSE', averageCtc: 19.56, studentsPlaced: 49, studentsParticipated: 51, placementPercent: 96.07 },
  { batch: 2026, branch: 'IT', averageCtc: 17.13, studentsPlaced: 46, studentsParticipated: 52, placementPercent: 88.46 },
  { batch: 2025, branch: 'ECE', averageCtc: 15.41, studentsPlaced: 36, studentsParticipated: 40, placementPercent: 90 },
  { batch: 2025, branch: 'CSE', averageCtc: 19.54, studentsPlaced: 54, studentsParticipated: 55, placementPercent: 98.18 },
  { batch: 2025, branch: 'IT', averageCtc: 13.32, studentsPlaced: 52, studentsParticipated: 52, placementPercent: 100 },
  { batch: 2024, branch: 'ECE', averageCtc: 10.53, studentsPlaced: 26, studentsParticipated: 30, placementPercent: 86.66 },
  { batch: 2024, branch: 'CSE', averageCtc: 15.07, studentsPlaced: 48, studentsParticipated: 53, placementPercent: 88.67 },
  { batch: 2024, branch: 'IT', averageCtc: 11.36, studentsPlaced: 41, studentsParticipated: 52, placementPercent: 78.84 },
  { batch: 2023, branch: 'ECE', averageCtc: 18.03, studentsPlaced: 29, studentsParticipated: 30, placementPercent: 96.66 },
  { batch: 2023, branch: 'CSE', averageCtc: 22.56, studentsPlaced: 53, studentsParticipated: 53, placementPercent: 100 },
  { batch: 2023, branch: 'IT', averageCtc: 23.42, studentsPlaced: 52, studentsParticipated: 52, placementPercent: 100 },
];

const recruiters = [
  { name: 'Atlassian', website: 'https://www.atlassian.com/company' },
  { name: 'Cred', website: 'https://cred.club' },
  { name: 'Microsoft', website: 'https://careers.microsoft.com' },
  { name: 'Amazon', website: 'https://www.amazon.jobs' },
  { name: 'Salesforce', website: 'https://www.salesforce.com/company' },
  { name: 'Flipkart', website: 'https://www.flipkartcareers.com' },
  { name: 'LinkedIn', website: 'https://careers.linkedin.com' },
  { name: 'Motive', website: 'https://gomotive.com' },
  { name: 'Meesho', website: 'https://www.meesho.io' },
  { name: 'Tekion', website: 'https://tekion.com' },
  { name: 'Qualcomm', website: 'https://www.qualcomm.com/company' },
];

async function seed() {
  await connectDb();
  await Promise.all([
    User.deleteMany({}),
    StudentProfile.deleteMany({}),
    Company.deleteMany({}),
    PlacementDrive.deleteMany({}),
    PlacementRecord.deleteMany({}),
    TnpTeamMember.deleteMany({}),
    JoiningCriteria.deleteMany({}),
    Announcement.deleteMany({}),
  ]);

  const admin = await User.register(
    {
      name: 'TNP Administrator',
      email: env.seedAdminEmail,
      phone: env.seedAdminPhone,
      role: ROLES.ADMIN,
      permissions: Object.values(PERMISSIONS),
      phoneVerified: true,
    },
    env.seedAdminPassword
  );

  await User.register(
    {
      name: 'TNP team login',
      email: 'tnp.team@iiitbhopal.ac.in',
      phone: '9888888888',
      role: ROLES.TNP_TEAM,
      permissions: TEAM_PERMISSION_DEFAULTS,
      phoneVerified: true,
    },
    'TeamPass#123'
  );

  const studentUser = await User.register(
    {
      name: 'Demo Student',
      email: 'demo.student@iiitbhopal.ac.in',
      phone: '9777777777',
      role: ROLES.STUDENT,
      phoneVerified: true,
    },
    'StudentPass#123'
  );
  await StudentProfile.create({
    user: studentUser._id,
    enrollmentNumber: 'IIITB-CSE-2027-0001',
    branch: 'CSE',
    batch: 2027,
    cgpa: 8.4,
    backlogs: 0,
    skills: ['JavaScript', 'React', 'Node.js', 'DSA'],
  });

  const createdCompanies = await Company.insertMany(
    recruiters.map((company) => ({
      name: company.name,
      website: company.website,
      isActive: true,
      description: `${company.name} appears in IIIT Bhopal T&P Cell placement highlights. This directory entry does not imply a current opening.`,
      sourceNote: SOURCE,
    }))
  );

  const compMap = new Map(createdCompanies.map((c) => [c.name, c._id]));
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const in25Days = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000);
  const in20Days = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
  const in15Days = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

  await PlacementDrive.insertMany([
    {
      company: compMap.get('Atlassian') || createdCompanies[0]._id,
      jobTitle: 'Software Development Engineer Intern',
      jobDescription: 'Software Development Engineer Intern working on distributed cloud services, Jira/Confluence platform engineering, and high-scale APIs.',
      jobType: 'internship',
      workMode: 'hybrid',
      location: 'Bengaluru',
      eligibleBranches: ['CSE', 'IT'],
      eligibleBatches: [2026, 2027],
      minCgpa: 7.5,
      maxBacklogs: 0,
      packageDetails: '₹1.5 Lakh/month stipend + 85 LPA PPO',
      packageLpa: 85,
      requiredSkills: ['Java', 'Data Structures', 'Algorithms', 'Distributed Systems', 'Git'],
      applicationOpenAt: new Date(),
      applicationDeadline: in30Days,
      status: 'open',
      openings: 5,
    },
    {
      company: compMap.get('Cred') || createdCompanies[1]._id,
      jobTitle: 'Backend Developer - Financial Platform',
      jobDescription: 'Design and build resilient payment gateways, low-latency microservices, and high-throughput transactional backends.',
      jobType: 'full_time',
      workMode: 'onsite',
      location: 'Bengaluru',
      eligibleBranches: ['CSE', 'IT', 'ECE'],
      eligibleBatches: [2026, 2027],
      minCgpa: 7.0,
      maxBacklogs: 0,
      packageDetails: '58 LPA (Fixed + Stocks + Performance Bonus)',
      packageLpa: 58,
      requiredSkills: ['Node.js', 'Go', 'Redis', 'SQL', 'Microservices', 'REST APIs'],
      applicationOpenAt: new Date(),
      applicationDeadline: in15Days,
      status: 'open',
      openings: 8,
    },
    {
      company: compMap.get('Microsoft') || createdCompanies[2]._id,
      jobTitle: 'Software Engineer - Azure Core',
      jobDescription: 'Engineering next-generation hyper-scale cloud platforms, distributed storage, and AI acceleration pipelines.',
      jobType: 'full_time',
      workMode: 'hybrid',
      location: 'Hyderabad / Noida',
      eligibleBranches: ['CSE', 'IT', 'ECE'],
      eligibleBatches: [2026, 2027],
      minCgpa: 7.0,
      maxBacklogs: 0,
      packageDetails: '45 LPA CTC',
      packageLpa: 45,
      requiredSkills: ['C++', 'Data Structures', 'Algorithms', 'Operating Systems', 'Azure', 'Git'],
      applicationOpenAt: new Date(),
      applicationDeadline: in20Days,
      status: 'open',
      openings: 12,
    },
    {
      company: compMap.get('Meesho') || createdCompanies[8]._id,
      jobTitle: 'Software Development Engineer - ECE / Tech',
      jobDescription: 'Building high-scale e-commerce logistics, real-time messaging, and inventory streaming pipelines.',
      jobType: 'full_time',
      workMode: 'onsite',
      location: 'Bengaluru',
      eligibleBranches: ['CSE', 'IT', 'ECE'],
      eligibleBatches: [2026, 2027],
      minCgpa: 7.0,
      maxBacklogs: 0,
      packageDetails: '57 LPA CTC',
      packageLpa: 57,
      requiredSkills: ['Java', 'Python', 'SQL', 'Kafka', 'Problem Solving'],
      applicationOpenAt: new Date(),
      applicationDeadline: in25Days,
      status: 'open',
      openings: 10,
    },
  ]);

  await Announcement.insertMany([
    {
      title: 'Placement Season 2026-27 Officially Commenced',
      description: 'The Training & Placement Cell welcomes all students of batch 2026 and 2027 to the campus recruitment season. Keep your profiles and resumes updated.',
      category: 'General',
      audience: 'all',
      publishedAt: new Date(),
      status: 'published',
    },
    {
      title: 'Drive Announcements: Atlassian, Cred, Microsoft & Meesho',
      description: 'Recruitment drives for software roles have been opened in the portal. Review eligibility criteria and submit applications before the respective deadlines.',
      category: 'Placements',
      audience: 'students',
      publishedAt: new Date(),
      status: 'published',
    },
  ]);

  await JoiningCriteria.insertMany([
    {
      title: 'Student Placement Coordinator Selection 2026-27',
      eligibilityRequirements: 'Full-time B.Tech student of IIIT Bhopal (CSE, IT, ECE) with minimum 7.0 CGPA and no active backlogs.',
      academicRequirements: 'Good academic standing, strong communication, and problem-solving skills.',
      expectedResponsibilities: 'Corporate outreach, drive coordination, student guidance, and logistics management during campus visits.',
      commitmentExpectations: 'Dedication throughout the academic year for on-campus and virtual recruitment sessions.',
      selectionRounds: ['Resume Shortlisting', 'Group Discussion', 'Personal Interview with T&P Faculty'],
      requiredDocuments: ['College ID Card', 'Latest Grade Sheet', 'Updated Resume'],
      status: 'published',
      isOfficial: true,
    },
  ]);

  await TnpTeamMember.insertMany([
    {
      fullName: 'Dr. Faculty Head',
      designation: 'Faculty In-Charge, Training & Placement',
      teamRole: 'Placement Officer',
      collegeEmail: 'pic.tnp@iiitbhopal.ac.in',
      responsibilities: 'Overseeing corporate partnerships, student placement policy, and drive approvals.',
      isActive: true,
      showContactPublicly: true,
      permissions: Object.values(PERMISSIONS),
    },
    {
      fullName: 'Aarav Patel',
      designation: 'Student Coordinator',
      teamRole: 'CSE Placement Coordinator',
      branch: 'CSE',
      batch: 2026,
      collegeEmail: 'aarav.tnp@iiitbhopal.ac.in',
      responsibilities: 'Coordinating CSE drives, online assessments, and interview scheduling.',
      isActive: true,
      showContactPublicly: true,
      permissions: TEAM_PERMISSION_DEFAULTS,
    },
    {
      fullName: 'Priya Verma',
      designation: 'Student Coordinator',
      teamRole: 'IT Placement Coordinator',
      branch: 'IT',
      batch: 2026,
      collegeEmail: 'priya.tnp@iiitbhopal.ac.in',
      responsibilities: 'Managing IT student registrations, logistics, and company coordination.',
      isActive: true,
      showContactPublicly: true,
      permissions: TEAM_PERMISSION_DEFAULTS,
    },
  ]);

  await PlacementRecord.insertMany([
    ...highest.map((row) => ({
      recordType: 'overall_highest',
      ...row,
      currency: 'INR',
      unit: 'LPA',
      metricNote: 'Highest package (not average CTC)',
      sourceDocument: SOURCE,
      sourceDate: '2026-04-15',
      verificationStatus: 'verified',
      branch: 'OVERALL',
    })),
    ...overall.map((row) => ({
      recordType: 'branch_wise',
      branch: 'OVERALL',
      ...row,
      currency: 'INR',
      unit: 'LPA',
      metricNote: 'Average CTC for the batch overall — not highest package',
      sourceDocument: SOURCE,
      sourceDate: '2026-04-15',
      verificationStatus: 'verified',
    })),
    ...branchWise.map((row) => ({
      recordType: 'branch_wise',
      ...row,
      currency: 'INR',
      unit: 'LPA',
      metricNote: 'Branch-wise average CTC from the official table — not highest package',
      sourceDocument: SOURCE,
      sourceDate: '2026-04-15',
      verificationStatus: 'verified',
    })),
  ]);

  console.log(
    JSON.stringify(
      {
        admin: env.seedAdminEmail,
        team: 'tnp.team@iiitbhopal.ac.in',
        student: 'demo.student@iiitbhopal.ac.in',
        note: 'Demo passwords are only for local seed. Change them. Signup and notices use Twilio SMS.',
      },
      null,
      2
    )
  );
  await disconnectDb();
}

async function publishRecordsOnly() {
  const { cacheDel } = require('../services/cache.service');
  await connectDb();
  if ((await PlacementRecord.countDocuments()) === 0) {
    await PlacementRecord.insertMany([
      ...highest.map((row) => ({
        recordType: 'overall_highest',
        ...row,
        currency: 'INR',
        unit: 'LPA',
        metricNote: 'Highest package (not average CTC)',
        sourceDocument: SOURCE,
        sourceDate: '2026-04-15',
        verificationStatus: 'verified',
        branch: 'OVERALL',
      })),
      ...overall.map((row) => ({
        recordType: 'branch_wise',
        branch: 'OVERALL',
        ...row,
        currency: 'INR',
        unit: 'LPA',
        metricNote: 'Average CTC for the batch overall — not highest package',
        sourceDocument: SOURCE,
        sourceDate: '2026-04-15',
        verificationStatus: 'verified',
      })),
      ...branchWise.map((row) => ({
        recordType: 'branch_wise',
        ...row,
        currency: 'INR',
        unit: 'LPA',
        metricNote: 'Branch-wise average CTC from the official table — not highest package',
        sourceDocument: SOURCE,
        sourceDate: '2026-04-15',
        verificationStatus: 'verified',
      })),
    ]);
  }
  if ((await Company.countDocuments()) === 0) {
    await Company.insertMany(
      recruiters.map((company) => ({
        name: company.name,
        website: company.website,
        isActive: true,
        description: `${company.name} appears in IIIT Bhopal T&P Cell placement highlights. This directory entry does not imply a current opening.`,
        sourceNote: SOURCE,
      }))
    );
  }
  await cacheDel('home:*');
  await cacheDel('stats:public');
  console.log(
    JSON.stringify({
      records: await PlacementRecord.countDocuments(),
      companies: await Company.countDocuments(),
      team: await TnpTeamMember.countDocuments(),
    })
  );
  await disconnectDb();
}

if (process.argv.includes('--records-only')) {
  publishRecordsOnly().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  seed().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
