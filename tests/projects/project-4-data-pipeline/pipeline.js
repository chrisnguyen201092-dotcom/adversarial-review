const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { transform } = require('./lib/transform');
const { validate } = require('./lib/validate');
const db = require('./lib/db');

async function importCsv(filePath, tableName) {
  const content = fs.readFileSync(filePath, 'utf8');
  const records = parse(content, { columns: true, skip_empty_lines: true });

  const validated = records.filter(record => {
    const result = validate(record, tableName);
    if (!result.valid) {
      console.log(`Skipping invalid record: ${JSON.stringify(record)}`);
    }
    return result.valid;
  });

  const transformed = validated.map(record => transform(record, tableName));

  for (const record of transformed) {
    const columns = Object.keys(record).join(', ');
    const placeholders = Object.keys(record).map((_, i) => `$${i + 1}`).join(', ');
    await db.query(
      `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`,
      Object.values(record)
    );
  }

  return { imported: transformed.length, skipped: records.length - transformed.length };
}

async function exportCsv(tableName, outputPath, options = {}) {
  const { columns, where, limit } = options;
  let query = `SELECT ${columns ? columns.join(', ') : '*'} FROM ${tableName}`;
  if (where) query += ` WHERE ${where}`;
  if (limit) query += ` LIMIT ${limit}`;

  const result = await db.query(query);

  const csv = stringify(result.rows, { header: true });
  fs.writeFileSync(outputPath, csv);

  return { exported: result.rows.length, path: outputPath };
}

function processScheduled(configPath) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  for (const job of config.jobs) {
    const interval = setInterval(async () => {
      try {
        if (job.type === 'import') {
          await importCsv(job.source, job.table);
        } else if (job.type === 'export') {
          const timestamp = new Date().toISOString().replace(/:/g, '-');
          const outputPath = path.join(job.outputDir, `${job.table}_${timestamp}.csv`);
          await exportCsv(job.table, outputPath, job.options);
        }
      } catch (err) {
        console.log(`Job ${job.name} failed: ${err.message}`);
      }
    }, job.intervalMs);
  }
}

function mergeCsvFiles(inputDir, outputPath) {
  const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.csv'));
  let allRecords = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(inputDir, file));
    const records = parse(content, { columns: true });
    allRecords = allRecords.concat(records);
  }

  const csv = stringify(allRecords, { header: true });
  fs.writeFileSync(outputPath, csv);

  return { merged: allRecords.length, files: files.length };
}

module.exports = { importCsv, exportCsv, processScheduled, mergeCsvFiles };
