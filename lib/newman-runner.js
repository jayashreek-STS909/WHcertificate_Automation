const newman = require('newman');
const fs = require('fs');
const path = require('path');
const { getConfig } = require('../config/config');

class NewmanRunner {
  constructor() {
    this.config = getConfig();
    this.retryCount = 0;
    this.maxRetries = this.config.retry.maxRetries;
  }

  async runTests() {
    try {
      console.log('🚀 Starting Newman test execution...');
      
      // Ensure reports directory exists
      this.ensureReportsDirectory();
      
      // Run Newman with retry logic
      const results = await this.runWithRetry();
      
      console.log('✅ Newman tests completed successfully');
      return results;
      
    } catch (error) {
      console.error('❌ Newman test execution failed:', error.message);
      throw error;
    }
  }

  async runWithRetry() {
    while (this.retryCount <= this.maxRetries) {
      try {
        return await this.executeNewman();
      } catch (error) {
        this.retryCount++;
        
        if (this.retryCount > this.maxRetries) {
          throw new Error(`Newman execution failed after ${this.maxRetries} retries: ${error.message}`);
        }
        
        console.log(`⚠️ Attempt ${this.retryCount} failed. Retrying in ${this.config.retry.retryDelay}ms...`);
        console.log(`Error: ${error.message}`);
        
        await this.delay(this.config.retry.retryDelay);
      }
    }
  }

  executeNewman() {
    return new Promise((resolve, reject) => {
      const options = {
        collection: this.config.newman.collection,
        environment: this.config.newman.environment,
        reporters: this.config.newman.reporters,
        reporter: this.config.newman.reporterOptions,
        iterationCount: this.config.newman.iterationCount,
        timeout: this.config.newman.timeout,
        delayRequest: this.config.newman.delayRequest,
        insecure: true, // Allow self-signed certificates
        suppressExitCode: true // Don't exit process on test failures
      };

      // Add timeout promise to prevent hanging
      const timeoutPromise = new Promise((_, timeoutReject) => {
        setTimeout(() => {
          timeoutReject(new Error(`Newman execution timed out after ${this.config.newman.timeout}ms`));
        }, this.config.newman.timeout);
      });

      const newmanPromise = new Promise((newmanResolve, newmanReject) => {
        newman.run(options, (err, summary) => {
          if (err) {
            newmanReject(err);
            return;
          }

          // Check if there were any test failures
          const hasFailures = summary.run.failures && summary.run.failures.length > 0;
          const hasErrors = summary.run.error && summary.run.error.length > 0;

          if (hasErrors) {
            newmanReject(new Error(`Newman execution errors: ${JSON.stringify(summary.run.error)}`));
            return;
          }

          // Log summary
          this.logSummary(summary);
          
          newmanResolve(summary);
        });
      });

      // Race between Newman execution and timeout
      Promise.race([newmanPromise, timeoutPromise])
        .then(resolve)
        .catch(reject);
    });
  }

  logSummary(summary) {
    const stats = summary.run.stats;
    console.log('\n📊 Test Execution Summary:');
    console.log(`   Iterations: ${stats.iterations.total}`);
    console.log(`   Requests: ${stats.requests.total}`);
    console.log(`   Test Scripts: ${stats.testScripts.total}`);
    console.log(`   Prerequests: ${stats.prerequestScripts.total}`);
    console.log(`   Assertions: ${stats.assertions.total} (${stats.assertions.failed} failed)`);
    
    if (summary.run.failures && summary.run.failures.length > 0) {
      console.log(`   Failures: ${summary.run.failures.length}`);
      summary.run.failures.forEach((failure, index) => {
        console.log(`     ${index + 1}. ${failure.error.message}`);
      });
    }
  }

  ensureReportsDirectory() {
    const reportsDir = path.dirname(this.config.newman.reporterOptions.htmlextra.export);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
      console.log(`📁 Created reports directory: ${reportsDir}`);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = NewmanRunner;
