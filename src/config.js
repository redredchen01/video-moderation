// src/config.js
import 'dotenv/config';

function requireEnv(key) {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}. Check your .env file.`);
  return val;
}

// === CLI argument parsing ===
function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {
    headless: false,
    maxPages: 50,
    skipCovers: false,
    skipDescriptions: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--headless':
        flags.headless = true;
        break;
      case '--max-pages':
        flags.maxPages = parseInt(args[++i]) || 50;
        break;
      case '--skip-covers':
        flags.skipCovers = true;
        break;
      case '--skip-descriptions':
        flags.skipDescriptions = true;
        break;
      case '--help':
        console.log(`Usage: node src/main.js [options]

Options:
  --headless             Run browser in headless mode
  --max-pages <N>        Maximum pages to scan (default: 50)
  --skip-covers          Skip cover image downloading
  --skip-descriptions    Skip description fetching (Phase 2)
  --help                 Show this help message
`);
        process.exit(0);
    }
  }
  return flags;
}

const flags = parseArgs();

// Generate timestamped report filename
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

export const CONFIG = {
  baseUrl: 'https://dx-112-adm.ympxbys.xyz/admin/index/index',
  credentials: {
    username: requireEnv('ADMIN_ACCOUNT'),
    password: requireEnv('ADMIN_PASSWORD'),
    cardNum: process.env.ADMIN_CARD_NUM || '',
  },
  outputDir: 'output',
  coversDir: 'output/covers',
  reportPath: `output/violations_${timestamp}.csv`,
  jsonReportPath: `output/violations_${timestamp}.json`,
  latestReportPath: 'output/violations.csv',
  latestJsonReportPath: 'output/violations.json',
  maxPages: flags.maxPages,
  coverDownloadConcurrency: 5,
  menuLabel: '视频管理',
  headless: flags.headless,
  skipCovers: flags.skipCovers,
  skipDescriptions: flags.skipDescriptions,
};
