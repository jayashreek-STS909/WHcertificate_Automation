const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// File paths
const reportPath = path.join(__dirname, 'reports', 'report.html');
const jsonPath = path.join(__dirname, 'report.json');

// Validate file existence
if (!fs.existsSync(reportPath) || !fs.existsSync(jsonPath)) {
  console.error("❌ Required report files not found.");
  process.exit(1);
}

// Read JSON report
const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const executions = jsonData.run.executions;
const assertions = executions.flatMap(exec => exec.assertions || []);

// Get test summary
const totalTests = assertions.length;
const failedTests = assertions.filter(a => a.error).length;
const passedTests = totalTests - failedTests;

// Group results by request name
const grouped = {};
executions.forEach(exec => {
  const requestName = exec.item.name;
  if (!grouped[requestName]) grouped[requestName] = { total: 0, failed: 0 };
  if (exec.assertions) {
    grouped[requestName].total += exec.assertions.length;
    grouped[requestName].failed += exec.assertions.filter(a => a.error).length;
  }
});

// Generate table rows
let rows = '';
for (const [name, data] of Object.entries(grouped)) {
  const status = data.failed === 0 ? 'Passed' : 'Failed';
  const statusClass = data.failed === 0 ? 'status-pass' : 'status-fail';
  rows += `
    <tr>
      <td>${name}</td>
      <td>${data.total}</td>
      <td>${data.total - data.failed}</td>
      <td>${data.failed}</td>
      <td class="${statusClass}">${status}</td>
    </tr>`;
}

// Extract dynamic form name from URL path
let formTitle = 'API Test Report';

if (executions.length >= 2) {
  const secondExec = executions[1];
  const fullUrl = secondExec.request?.url;

  if (fullUrl && fullUrl.path && Array.isArray(fullUrl.path)) {
    // Look for 'FormXXX' pattern in the path
    const match = fullUrl.path.find(p => /^Form\d{3,4}$/i.test(p));
    if (match) {
      formTitle = match; // e.g., 'Form941'
    }
  }
}

// Build HTML preview with dynamic title
const htmlPreview = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
    .container { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); max-width: 700px; margin: auto; }
    h2 { color: #333; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { border: 1px solid #ccc; padding: 12px; text-align: left; }
    th { background-color: #007bff; color: white; }
    .footer { margin-top: 20px; font-size: 12px; color: #666; }
    .status-pass { color: green; font-weight: bold; }
    .status-fail { color: red; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <h2>${formTitle} - API Automation Test Report</h2>
    <p>Hi Team,</p>
    <p>Please find below the summary of the latest API test execution:</p>
    <table>
      <thead>
        <tr>
          <th>Test Suite</th>
          <th>Total Tests</th>
          <th>Passed</th>
          <th>Failed</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    <p>Total Tests: <strong>${totalTests}</strong> | Passed: <strong>${passedTests}</strong> | Failed: <strong>${failedTests}</strong></p>
    <p>You can find the complete detailed report attached to this email.</p>
    <div class="footer">
      <p>This is an automated email. Please do not reply directly.</p>
    </div>
  </div>
</body>
</html>`;

// Create email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'harishsanjay.a@spantechnologyservices.com',
    pass: process.env.EMAIL_PASS || 'kioz gokp qzgj enll'
  }
});

// Email options
const mailOptions = {
  from: process.env.EMAIL_USER || 'harishsanjay.a@spantechnologyservices.com',
  to: process.env.EMAIL_TO || 'dharaneesh.v@spantechnologyservices.com',
  subject: `${formTitle} - Newman API Automation Report`,
  html: htmlPreview,
  attachments: [
    {
      filename: 'report.html',
      path: reportPath
    }
  ]
};

// Send email
console.log("📤 Sending email with real-time report summary...");
transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error('❌ Error sending email:', error);
    process.exit(1);
  } else {
    console.log('✅ Email sent successfully:', info.response);
    process.exit(0);
  }
});
