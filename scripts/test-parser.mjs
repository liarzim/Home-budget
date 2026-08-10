import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const sampleFilePath = path.resolve('./Sample/סיכום הכנסות הוצאת - 2026 .xlsx');

const HEBREW_MONTHS = {
  'ינואר': 1, 'פברואר': 2, 'מרץ': 3, 'אפריל': 4, 'מאי': 5, 'יוני': 6,
  'יולי': 7, 'אוגוסט': 8, 'ספטמבר': 9, 'אוקטובר': 10, 'נובמבר': 11, 'דצמבר': 12,
};

function parseExcelDate(val, fallbackYear, monthIndex) {
  if (!val) return `${fallbackYear}-${String(monthIndex || 1).padStart(2, '0')}-01`;
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  const dmy = str.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/);
  if (dmy) {
    let yr = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${yr}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return `${fallbackYear}-${String(monthIndex || 1).padStart(2, '0')}-01`;
}

if (fs.existsSync(sampleFilePath)) {
  const buf = fs.readFileSync(sampleFilePath);
  const wb = XLSX.read(buf, { type: 'buffer' });
  console.log('Sheets found:', wb.SheetNames);

  let totalItemized = 0;
  let txCount = 0;
  for (let m = 1; m <= 12; m++) {
    const ws = wb.Sheets[String(m)];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || !row[1]) continue;
      const payee = String(row[1]).trim();
      if (payee.includes('סה"כ')) continue;
      const amt = typeof row[12] === 'number' ? row[12] : (typeof row[8] === 'number' ? row[8] : row[3]);
      if (amt && amt > 0) {
        totalItemized += amt;
        txCount++;
      }
    }
  }
  console.log(`Parsed ${txCount} itemized transactions across sheets 1-12, Total: ₪${totalItemized.toLocaleString()}`);

  // Test income
  const incWs = wb.Sheets['הכנסות'];
  if (incWs) {
    const rows = XLSX.utils.sheet_to_json(incWs, { header: 1, defval: '' });
    console.log('Income sheet rows count:', rows.length);
  }
}
