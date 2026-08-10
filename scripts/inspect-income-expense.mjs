import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const sampleFilePath = path.resolve('./Sample/סיכום הכנסות הוצאת - 2026 .xlsx');

if (fs.existsSync(sampleFilePath)) {
  const buf = fs.readFileSync(sampleFilePath);
  const wb = XLSX.read(buf, { type: 'buffer' });
  console.log('All Sheet Names:', wb.SheetNames);

  ['הכנסות', 'הוצאות'].forEach(sheetName => {
    if (wb.Sheets[sheetName]) {
      console.log(`\n=== SHEET: ${sheetName} ===`);
      const ws = wb.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      console.log(`Total Rows: ${data.length}`);
      data.slice(0, 25).forEach((row, i) => {
        if (Array.isArray(row) && row.some(cell => cell !== '')) {
          console.log(`Row ${i + 1}:`, row.slice(0, 15));
        }
      });
    }
  });
}
