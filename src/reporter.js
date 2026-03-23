import { createObjectCsvWriter } from 'csv-writer';
import { CONFIG } from './config.js';
import fs from 'fs';

const CSV_HEADER = [
  { id: 'severity', title: 'Severity' },
  { id: 'videoId', title: 'Video ID' },
  { id: 'title', title: 'Title' },
  { id: 'tags', title: 'Tags' },
  { id: 'flagType', title: 'Flag Type' },
  { id: 'matchedKeywords', title: 'Matched Keywords' },
  { id: 'categories', title: 'Categories' },
  { id: 'coverPath', title: 'Cover Image Path' },
  { id: 'description', title: 'Description' },
  { id: 'timestamp', title: 'Check Time' },
];

/** Sanitize string for CSV — collapse newlines to spaces */
function sanitize(str) {
  if (!str) return '';
  return str.replace(/[\r\n]+/g, ' ').trim();
}

export function createReporter() {
  fs.mkdirSync('output', { recursive: true });

  const writer = createObjectCsvWriter({
    path: CONFIG.reportPath,
    header: CSV_HEADER,
    append: false,
  });

  const records = [];

  return {
    /**
     * @param {'VIOLATION'|'RISK'|'COVER'} severity
     */
    addRecord(video, flag, severity = 'VIOLATION') {
      records.push({
        severity,
        videoId: video.id,
        title: sanitize(video.title),
        tags: sanitize(video.tags),
        flagType: flag.type,
        matchedKeywords: (flag.keywords || []).join(', '),
        categories: (flag.categories || []).join(', '),
        coverPath: video.coverLocalPath || '',
        description: sanitize(video.description),
        timestamp: new Date().toISOString(),
      });
    },

    async flush() {
      if (records.length === 0) {
        console.log('[reporter] No findings.');
        return;
      }

      // Write CSV
      await writer.writeRecords(records);
      console.log(`[reporter] Wrote ${records.length} records to ${CONFIG.reportPath}`);
      fs.copyFileSync(CONFIG.reportPath, CONFIG.latestReportPath);

      // Write JSON
      fs.writeFileSync(CONFIG.jsonReportPath, JSON.stringify(records, null, 2), 'utf-8');
      console.log(`[reporter] JSON report: ${CONFIG.jsonReportPath}`);
      fs.copyFileSync(CONFIG.jsonReportPath, CONFIG.latestJsonReportPath);
    },

    get count() {
      return records.length;
    },

    get records() {
      return records;
    },
  };
}
