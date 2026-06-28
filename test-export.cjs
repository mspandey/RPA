const fs = require('fs');

const rawCsv = fs.readFileSync('public/rpa_database_2026.csv', 'utf8');
const lines = rawCsv.split('\n').filter(l => l.trim());
const headers = lines[0].split(',');
const data = lines.slice(1).map(line => {
    const parts = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h] = parts[i]);
    return obj;
});

const fields = [
      'project_id', 'company_id', 'project_name', 'start_date',
      'completion_date', 'project_status', 'automation_type', 'robots_deployed',
      'budget_usd', 'annual_savings_usd', 'roi_percent', 'department',
      'implementation_partner', 'country', 'industry', 'employee_hours_saved',
      'ai_enabled', 'cloud_deployment'
];

const rows = [fields.join(',')];

for (let i = 0; i < 5; i++) {
    const row = data[i];
    const rowStr = fields.map(f => {
        let val = row[f];
        if (val == null) return '';
        if (typeof val === 'number') return val;
        if (typeof val === 'boolean') return val ? 'true' : 'false';
        
        let str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }).join(',');
    rows.push(rowStr);
}

const csv = rows.join('\n');
console.log(JSON.stringify(csv.slice(0, 500)));
console.log("\nRAW OUTPUT:");
console.log(csv);
