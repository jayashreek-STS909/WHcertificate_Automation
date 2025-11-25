const path = require('path');

// Configuration management for different environments
const config = {
  // Default configuration
  default: {
    newman: {
      collection: path.join(__dirname, '..', 'Collection.json'),
      environment: path.join(__dirname, '..', 'Environment.json'),
      reporters: ['cli', 'htmlextra', 'json'],
      reporterOptions: {
        htmlextra: {
          export: path.join(__dirname, '..', 'reports', 'report.html'),
          title: 'API Test Report',
          browserTitle: 'Newman Test Report',
          darkTheme: true,
          showOnlyFailed: false,
          skipHeaders: '',
          skipSensitiveData: false,
          requestHeaders: true,
          requestBodies: true,
          responseHeaders: true,
          responseBodies: true,
          testPanes: true,
          logs: true,
          assertions: true,
          scripts: true
        },
        json: {
          export: path.join(__dirname, '..', 'reports', 'report.json')
        }
      },
      iterationCount: 1,
      timeout: 30000,
      delayRequest: 1000
    },
    email: {
      service: 'gmail',
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_TO,
      cc: process.env.EMAIL_CC,
      bcc: process.env.EMAIL_BCC,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    },
    notifications: {
      slack: {
        enabled: process.env.SLACK_WEBHOOK_URL ? true : false,
        webhookUrl: process.env.SLACK_WEBHOOK_URL,
        channel: process.env.SLACK_CHANNEL || '#api-testing'
      },
      teams: {
        enabled: process.env.TEAMS_WEBHOOK_URL ? true : false,
        webhookUrl: process.env.TEAMS_WEBHOOK_URL
      }
    },
    retry: {
      maxRetries: 3,
      retryDelay: 5000,
      retryOnFailure: true
    },
    reporting: {
      includePassedTests: true,
      includeFailedTests: true,
      includeSkippedTests: true,
      generateTrends: true,
      historicalDataPath: path.join(__dirname, '..', 'data', 'test-history.json')
    }
  },

  // Development environment
  development: {
    newman: {
      timeout: 60000,
      delayRequest: 2000
    },
    email: {
      to: process.env.DEV_EMAIL_TO || process.env.EMAIL_TO
    }
  },

  // Staging environment
  staging: {
    newman: {
      iterationCount: 2,
      timeout: 45000
    },
    email: {
      to: process.env.STAGING_EMAIL_TO || process.env.EMAIL_TO
    }
  },

  // Production environment
  production: {
    newman: {
      timeout: 120000,
      delayRequest: 500
    },
    retry: {
      maxRetries: 1,
      retryDelay: 5000
    }
  }
};

// Get configuration for current environment
function getConfig() {
  const env = process.env.NODE_ENV || 'default';
  const envConfig = config[env] || {};
  
  // Deep merge default config with environment-specific config
  return deepMerge(config.default, envConfig);
}

// Deep merge utility function
function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

module.exports = {
  getConfig,
  config
};
