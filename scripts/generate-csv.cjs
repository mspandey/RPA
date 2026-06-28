/**
 * generate-csv.js — Generates a 50,000-row RPA projects dataset
 * Run: node scripts/generate-csv.js
 * Output: public/rpa_database_2026.csv
 */

const fs = require('fs');
const path = require('path');

const AUTOMATION_TYPES = [
  'Customer Onboarding', 'Claims Processing', 'Invoice Processing', 'HR Automation',
  'Email Automation', 'Data Entry Automation', 'Supply Chain', 'Compliance Monitoring',
  'Financial Reporting', 'IT Service Management', 'Payroll Processing', 'Audit Automation',
];

const STATUSES = ['Active', 'Completed', 'Paused', 'Failed', 'Cancelled'];
const STATUS_WEIGHTS = [0.35, 0.35, 0.12, 0.10, 0.08];

const DEPARTMENTS = [
  'Finance', 'Operations', 'Human Resources', 'IT', 'Customer Service',
  'Compliance', 'Supply Chain', 'Marketing', 'Legal', 'Procurement',
  'Risk Management', 'Content Moderation', 'Customer Onboarding', 'Audit',
];

const INDUSTRIES = [
  'Banking & Finance', 'Healthcare', 'Insurance', 'Retail & E-Commerce',
  'Manufacturing', 'Government & Public Sector', 'Telecommunications',
  'Energy & Utilities', 'Transportation & Logistics', 'Real Estate',
  'Mining & Metals', 'Technology', 'Pharma & Life Sciences', 'Education',
];

const COUNTRIES = [
  'United States', 'United Kingdom', 'Germany', 'India', 'Australia',
  'Canada', 'France', 'Singapore', 'Japan', 'Netherlands', 'Brazil',
  'Mexico', 'South Africa', 'UAE', 'Vietnam', 'Philippines', 'Malaysia',
];

const PARTNERS = [
  'Accenture', 'Deloitte', 'Infosys', 'TCS', 'Wipro', 'HCL Technologies',
  'Tech Mahindra', 'Cognizant', 'Capgemini', 'IBM', 'PwC', 'EY',
  'Cyient', 'Mphasis', 'Hexaware', 'LTIMindtree',
];

const AI_OPTIONS = ['Yes', 'No'];
const CLOUD_OPTIONS = ['Yes', 'No'];

const PROJECT_PREFIXES = [
  'Prism', 'Sentinel', 'Aurora', 'Nexus', 'Apex', 'Vector', 'Horizon',
  'Atlas', 'Orion', 'Titan', 'Fusion', 'Quantum', 'Eclipse', 'Vertex',
  'Delta', 'Omega', 'Sigma', 'Lambda', 'Phoenix', 'Zenith', 'Cobalt',
];

const PROJECT_SUFFIXES = [
  'Automation Initiative', 'Process Reengineering', 'Digital Transformation',
  'Optimization Program', 'Intelligence Suite', 'Workflow Engine',
  'Efficiency Project', 'Modernization', 'Accelerator', 'Platform',
];

function rng(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickWeighted(arr, weights) {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < arr.length; i++) {
    acc += weights[i];
    if (r < acc) return arr[i];
  }
  return arr[arr.length - 1];
}

function randomDate(start, end) {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString().slice(0, 10);
}

const headers = [
  'project_id', 'company_id', 'project_name', 'start_date', 'completion_date',
  'project_status', 'automation_type', 'robots_deployed', 'budget_usd',
  'annual_savings_usd', 'roi_percent', 'department', 'implementation_partner',
  'country', 'industry', 'employee_hours_saved', 'ai_enabled', 'cloud_deployment',
];

const rows = [headers.join(',')];
const START = new Date('2015-01-01');
const END   = new Date('2025-12-31');

for (let i = 1; i <= 50000; i++) {
  const pid    = `PRJ${String(i).padStart(6, '0')}`;
  const cid    = `CMP${String(rng(1, 9999)).padStart(5, '0')}`;
  const name   = `${pick(PROJECT_PREFIXES)} ${pick(PROJECT_SUFFIXES)}`;
  const status = pickWeighted(STATUSES, STATUS_WEIGHTS);
  const startDate = randomDate(START, END);

  let completionDate = '';
  if (status === 'Completed' || status === 'Cancelled') {
    const sD = new Date(startDate);
    const eD = new Date(sD);
    eD.setMonth(eD.getMonth() + rng(3, 24));
    if (eD < END) completionDate = eD.toISOString().slice(0, 10);
  }

  const budget = rng(5000, 5000000);

  let roi;
  if (status === 'Failed') {
    roi = (Math.random() * 100 - 100).toFixed(1); // -100 to 0, biased negative
  } else {
    roi = (Math.random() * 300 + 10).toFixed(1);  // 10 to 310
  }

  const savings = Math.max(0, Math.round(budget * (parseFloat(roi) / 100)));
  const robots  = rng(1, 200);
  const hours   = rng(500, 200000);
  const dept    = pick(DEPARTMENTS);
  const partner = pick(PARTNERS);
  const country = pick(COUNTRIES);
  const industry = pick(INDUSTRIES);
  const autoType = pick(AUTOMATION_TYPES);
  const ai = pick(AI_OPTIONS);
  const cloud = pick(CLOUD_OPTIONS);

  rows.push([
    pid, cid, name, startDate, completionDate,
    status, autoType, robots, budget,
    savings, roi, dept, partner,
    country, industry, hours, ai, cloud,
  ].join(','));
}

const outputPath = path.join(__dirname, '..', 'public', 'rpa_database_2026.csv');
fs.writeFileSync(outputPath, rows.join('\n'), 'utf8');
console.log(`✅ Generated ${rows.length - 1} rows → ${outputPath}`);
console.log(`   File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
