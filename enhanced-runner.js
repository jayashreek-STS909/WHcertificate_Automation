// Load environment variables from .env file FIRST
require('dotenv').config();

const NewmanRunner = require('./lib/newman-runner');
const ReportGenerator = require('./lib/report-generator');
const NotificationService = require('./lib/notification-service');
const DataManager = require('./lib/data-manager');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { getConfig } = require('./config/config');

class EnhancedNewmanRunner {
  constructor() {
    this.config = getConfig();
    this.newmanRunner = new NewmanRunner();
    this.reportGenerator = new ReportGenerator();
    this.notificationService = new NotificationService();
    this.dataManager = new DataManager();
  }

  async run() {
    console.log('🚀 Starting Enhanced Newman Test Suite...');
    console.log(`Environment: ${process.env.NODE_ENV || 'default'}`);
    
    try {
      // Initialize data directories and perform cleanup
      await this.dataManager.initializeDataDirectories();
      await this.dataManager.cleanupOldReports(30);
      await this.dataManager.cleanupHistoricalData(100);
      
      // Run Newman tests
      const newmanSummary = await this.newmanRunner.runTests();
      
      // Generate enhanced reports
      const { reportData, trendAnalysis, enhancedHtml } = await this.reportGenerator.generateEnhancedReport(newmanSummary);
      
      // Save enhanced HTML report
      await this.saveEnhancedReport(enhancedHtml);
      
      // Send email with enhanced report
      await this.sendEnhancedEmail(reportData, trendAnalysis, enhancedHtml);
      
      // Send notifications
      await this.notificationService.sendNotifications(reportData, trendAnalysis);
      
      console.log('✅ Enhanced Newman test suite completed successfully!');
      
      // Exit with appropriate code
      process.exit(reportData.stats.assertions.failed > 0 ? 1 : 0);
      
    } catch (error) {
      console.error('❌ Enhanced Newman test suite failed:', error.message);
      
      // Try to generate a failure report
      await this.generateFailureReport(error);
      
      // Send failure notification
      await this.sendFailureNotification(error);
      
      process.exit(1);
    }
  }

  async saveEnhancedReport(enhancedHtml) {
    const reportPath = path.join(__dirname, 'reports', 'enhanced-report.html');
    const reportDir = path.dirname(reportPath);
    
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, enhancedHtml);
    console.log(`📄 Enhanced report saved: ${reportPath}`);
  }

  async sendEnhancedEmail(reportData, trendAnalysis, enhancedHtml) {
    if (!this.config.email.auth.user || !this.config.email.auth.pass) {
      console.log('⚠️ Email credentials not configured, skipping email notification');
      return;
    }

    try {
      const transporter = nodemailer.createTransport({
        service: this.config.email.service,
        auth: this.config.email.auth
      });

      const subject = this.generateEmailSubject(reportData);
      const htmlContent = this.generateEmailContent(reportData, trendAnalysis);

      const mailOptions = {
        from: this.config.email.from,
        to: this.config.email.to,
        cc: this.config.email.cc,
        bcc: this.config.email.bcc,
        subject: subject,
        html: htmlContent,
        attachments: [
          {
            filename: 'enhanced-report.html',
            content: enhancedHtml
          },
          {
            filename: 'report.html',
            path: path.join(__dirname, 'reports', 'report.html')
          }
        ]
      };

      await transporter.sendMail(mailOptions);
      console.log('📧 Enhanced email report sent successfully');
      
    } catch (error) {
      console.error('❌ Failed to send email report:', error.message);
      throw error;
    }
  }

  generateEmailSubject(reportData) {
    const status = reportData.stats.assertions.failed === 0 ? 'PASSED' : 'FAILED';
    const emoji = status === 'PASSED' ? '✅' : '❌';
    return `${emoji} API Tests ${status} - ${reportData.successRate}% Success Rate`;
  }

  generateEmailContent(reportData, trendAnalysis) {
    const timestamp = new Date(reportData.timestamp).toLocaleString();
    const duration = (reportData.duration / 1000).toFixed(2);
    const status = reportData.stats.assertions.failed === 0 ? 'success' : 'failure';

    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
    .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 15px rgba(0,0,0,0.1); max-width: 700px; margin: auto; }
    .header { text-align: center; margin-bottom: 30px; }
    .status-${status} { color: ${status === 'success' ? '#28a745' : '#dc3545'}; }
    .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
    .metric { text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px; }
    .metric-value { font-size: 1.5em; font-weight: bold; margin-bottom: 5px; }
    .metric-label { color: #666; font-size: 0.9em; }
    .trend-summary { background: #e9ecef; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .footer { margin-top: 30px; text-align: center; color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="status-${status}">API Test Results</h1>
      <p>Executed on ${timestamp} | Duration: ${duration}s</p>
    </div>

    <div class="metrics">
      <div class="metric">
        <div class="metric-value status-${status}">${reportData.successRate}%</div>
        <div class="metric-label">Success Rate</div>
      </div>
      <div class="metric">
        <div class="metric-value">${reportData.stats.assertions.total}</div>
        <div class="metric-label">Total Assertions</div>
      </div>
      <div class="metric">
        <div class="metric-value status-${status}">${reportData.stats.assertions.failed}</div>
        <div class="metric-label">Failed Assertions</div>
      </div>
      <div class="metric">
        <div class="metric-value">${reportData.stats.requests.total}</div>
        <div class="metric-label">Total Requests</div>
      </div>
    </div>

    ${trendAnalysis.summary ? `
    <div class="trend-summary">
      <h3>📈 Trend Analysis</h3>
      <p>${trendAnalysis.summary.join(' • ')}</p>
    </div>
    ` : ''}

    ${reportData.failures.length > 0 ? `
    <div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <h3 style="color: #721c24; margin-top: 0;">❌ Failures (${reportData.failures.length})</h3>
      ${reportData.failures.slice(0, 3).map(failure => `
        <div style="margin-bottom: 10px;">
          <strong>${failure.source?.name || 'Unknown Test'}</strong><br>
          <span style="color: #721c24; font-size: 0.9em;">${failure.error?.message || 'Unknown error'}</span>
        </div>
      `).join('')}
      ${reportData.failures.length > 3 ? `<p><em>... and ${reportData.failures.length - 3} more failures</em></p>` : ''}
    </div>
    ` : ''}

    <p>📎 Detailed reports are attached to this email for your review.</p>

    <div class="footer">
      <p>This is an automated email from the Enhanced Newman API Testing Framework</p>
      <p>Please do not reply to this email</p>
    </div>
  </div>
</body>
</html>`;
  }

  async generateFailureReport(error) {
    try {
      console.log('📄 Generating failure report...');
      
      const failureData = {
        timestamp: new Date().toISOString(),
        duration: 0,
        stats: {
          iterations: { total: 0, failed: 0 },
          requests: { total: 0, failed: 0 },
          assertions: { total: 0, failed: 0 },
          testScripts: { total: 0, failed: 1 }
        },
        successRate: '0.00',
        failures: [{
          error: {
            message: error.message,
            stack: error.stack
          },
          source: { name: 'Test Suite Execution' }
        }],
        executions: [],
        error: error.message
      };

      const historicalData = this.reportGenerator.loadHistoricalData();
      historicalData.push(failureData);
      this.reportGenerator.saveHistoricalData(historicalData);
      
      const trendAnalysis = this.reportGenerator.generateTrendAnalysis(historicalData);
      const enhancedHtml = this.reportGenerator.createEnhancedHtmlReport(failureData, trendAnalysis);
      
      await this.saveEnhancedReport(enhancedHtml);
      
      console.log('📄 Failure report generated successfully');
      
    } catch (reportError) {
      console.error('❌ Failed to generate failure report:', reportError.message);
    }
  }

  async sendFailureNotification(error) {
    try {
      if (this.config.email.auth.user && this.config.email.auth.pass) {
        const transporter = nodemailer.createTransport({
          service: this.config.email.service,
          auth: this.config.email.auth
        });

        const mailOptions = {
          from: this.config.email.from,
          to: this.config.email.to,
          subject: '❌ Newman Test Suite - Critical Failure',
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px;">
              <h2 style="color: #721c24;">❌ Newman Test Suite Failed</h2>
              <p><strong>Error:</strong> ${error.message}</p>
              <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
              <p>Please check the logs for more details.</p>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
      }
    } catch (emailError) {
      console.error('❌ Failed to send failure notification:', emailError.message);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new EnhancedNewmanRunner();
  runner.run();
}

module.exports = EnhancedNewmanRunner;
