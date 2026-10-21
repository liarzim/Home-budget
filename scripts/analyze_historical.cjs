const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const filePath2024 = 'C:/Users/micha/Downloads/תקציב שנתי/סיכום הכנסות הוצאת - 2024.xlsx';

function analyze2024() {
  const wb = XLSX.readFile(filePath2024);
  console.log('=== ניתוח קובץ 2024 ===');
  console.log('גיליונות:', wb.SheetNames);

  // 1. משכורות / הכנסות
  const incSheet = wb.Sheets['הכנסות'];
  console.log('\n--- בדיקת גיליון הכנסות 2024 ---');
  let incomeRows = 0;
  for (let r = 0; r <= 30; r++) {
    const a = incSheet[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
    const b = incSheet[XLSX.utils.encode_cell({ r, c: 1 })];
    if (a !== undefined || b !== undefined) {
      incomeRows++;
      if (r >= 3 && r <= 16) {
        console.log(`שורה ${r}: חודש=${a} | ערך=${b?.v} | נוסחה=${b?.f || 'אין'}`);
      }
    }
  }

  // 2. כרטיסי אשראי
  console.log('\n--- בדיקת עסקאות כרטיסי אשראי (חודשים 1 עד 12) ---');
  let totalCreditCount = 0;
  let totalCreditSum = 0;
  let missingCategoryCount = 0;
  let sampleMissing = [];

  for (let m = 1; m <= 12; m++) {
    const s = wb.Sheets[String(m)];
    if (!s) continue;
    const range = XLSX.utils.decode_range(s['!ref'] || 'A1:H1');
    let mCount = 0;
    for (let r = 1; r <= range.e.r; r++) {
      const dateCell = s[XLSX.utils.encode_cell({ r, c: 0 })];
      const payeeCell = s[XLSX.utils.encode_cell({ r, c: 1 })];
      const amountCell = s[XLSX.utils.encode_cell({ r, c: 2 })];
      const catCell = s[XLSX.utils.encode_cell({ r, c: 3 })];
      const cardCell = s[XLSX.utils.encode_cell({ r, c: 4 })];

      if (dateCell && payeeCell && amountCell && amountCell.v !== undefined) {
        mCount++;
        totalCreditCount++;
        totalCreditSum += Number(amountCell.v) || 0;

        const cat = catCell ? String(catCell.v).trim() : '';
        if (!cat || cat === 'אחר' || cat === 'לא סווג') {
          missingCategoryCount++;
          if (sampleMissing.length < 5) {
            sampleMissing.push({
              month: m,
              date: dateCell.v,
              payee: payeeCell.v,
              amount: amountCell.v,
              category: cat || 'ריק',
              card: cardCell?.v || 'אין כרטיס'
            });
          }
        }
      }
    }
    console.log(`חודש ${m}: ${mCount} עסקאות`);
  }

  console.log(`\nסך עסקאות אשראי 2024: ${totalCreditCount}`);
  console.log(`סך הוצאות אשראי 2024: ₪${totalCreditSum.toLocaleString('he-IL', { minimumFractionDigits: 2 })}`);
  console.log(`עסקאות ללא סיווג / סיווג חסר: ${missingCategoryCount}`);
  console.log('דוגמאות לחסרות סיווג:', sampleMissing);

  // 3. הוצאות ידניות
  const manualSheet = wb.Sheets['הוצאות ידני'] || wb.Sheets['הוצאות'];
  console.log('\n--- בדיקת הוצאות ידניות / קבועות ---');
  if (manualSheet) {
    console.log('גיליון הוצאות ידני קיים, טווח:', manualSheet['!ref']);
  }
}

analyze2024();
