const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const dir = 'C:/Users/micha/Downloads/תקציב שנתי';
const files = [
  'סיכום הכנסות הוצאת - 2024.xlsx',
  'סיכום הכנסות הוצאת - 2023.xlsx',
  'סיכום הכנסות הוצאת - 2022.xlsx',
  'סיכום הכנסות הוצאת - 2021.xlsx',
  'סיכום הכנסות הוצאת - 2020.xlsx',
  'סיכום הכנסות הוצאת - 2019.xlsx',
  'סיכום הכנסות הוצאת - 2018.xlsx',
  'סיכום הכנסות הוצאת - 2017.xlsx',
  'סיכום הכנסות הוצאת - 2016.xlsx'
];

console.log('=== סקירת כל השנים ההיסטוריות (2016-2024) ===\n');

files.forEach(fileName => {
  const full = path.join(dir, fileName);
  if (!fs.existsSync(full)) {
    console.log(`❌ קובץ חסר: ${fileName}`);
    return;
  }

  try {
    const wb = XLSX.readFile(full);
    const yearMatch = fileName.match(/\b(20\d\d)\b/);
    const year = yearMatch ? yearMatch[1] : 'Unknown';

    // Count monthly credit transactions
    let creditCount = 0;
    let creditSum = 0;
    for (let m = 1; m <= 12; m++) {
      const s = wb.Sheets[String(m)];
      if (!s) continue;
      const range = XLSX.utils.decode_range(s['!ref'] || 'A1:H100');
      for (let r = 1; r <= range.e.r; r++) {
        const p = s[XLSX.utils.encode_cell({ r, c: 1 })];
        const a = s[XLSX.utils.encode_cell({ r, c: 3 })];
        if (p && a && a.v !== undefined && !isNaN(Number(a.v))) {
          creditCount++;
          creditSum += Number(a.v);
        }
      }
    }

    // Check income sheet
    const incSheet = wb.Sheets['הכנסות'];
    let incomeSum = 0;
    if (incSheet) {
      for (let r = 4; r <= 15; r++) {
        const val = incSheet[XLSX.utils.encode_cell({ r, c: 1 })]?.v;
        if (val && !isNaN(Number(val))) {
          incomeSum += Number(val);
        }
      }
    }

    console.log(`📅 שנת ${year}:`);
    console.log(`   - עסקאות אשראי: ${creditCount} תנועות (סה"כ ₪${creditSum.toLocaleString('he-IL', { maximumFractionDigits: 0 })})`);
    console.log(`   - הכנסות/משכורות: ₪${incomeSum.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`);
  } catch (err) {
    console.log(`❌ שגיאה בקריאת ${fileName}:`, err.message);
  }
});
