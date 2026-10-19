const XLSX = require('xlsx');

const filePath = 'C:/Users/micha/Downloads/תקציב שנתי/סיכום הכנסות הוצאת - 2025 .xlsx';
const wb = XLSX.readFile(filePath);

console.log('=== בדיקת ואימות נתוני 2025 ===\n');

// 1. משכורות
const incSheet = wb.Sheets['הכנסות'];
const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
let totalM = 0, totalO = 0;

console.log('--- 1. משכורות 2025 (גבוה = מיכאל, שני = אורנה) ---');
for (let m = 0; m < 12; m++) {
  const rowIdx = m + 4;
  const cell = incSheet[XLSX.utils.encode_cell({ r: rowIdx, c: 1 })];
  let val = cell ? cell.v : 0;
  let f = cell ? cell.f : null;
  let mVal = 0, oVal = 0;
  if (f && f.includes('+')) {
    const parts = f.split('+').map(p => parseFloat(p)).filter(p => !isNaN(p));
    if (parts.length >= 2) {
      mVal = Math.max(...parts);
      oVal = Math.min(...parts);
    } else {
      mVal = val;
    }
  } else {
    mVal = val;
  }
  totalM += mVal;
  totalO += oVal;
  console.log(`${months[m]}: מיכאל = ₪${mVal.toLocaleString('he-IL', { minimumFractionDigits: 2 })} | אורנה = ₪${oVal.toLocaleString('he-IL', { minimumFractionDigits: 2 })} (סה"כ = ₪${val.toLocaleString('he-IL', { minimumFractionDigits: 2 })})`);
}
console.log(`\nסיכום שנתי: מיכאל = ₪${totalM.toLocaleString('he-IL', { minimumFractionDigits: 2 })} | אורנה = ₪${totalO.toLocaleString('he-IL', { minimumFractionDigits: 2 })} | סה"כ משכורות = ₪${(totalM + totalO).toLocaleString('he-IL', { minimumFractionDigits: 2 })}`);

// 2. עסקאות אשראי
let countCredit = 0, sumCredit = 0;
for (let m = 1; m <= 12; m++) {
  const s = wb.Sheets[String(m)];
  if (!s) continue;
  const rows = XLSX.utils.sheet_to_json(s, { header: 1, defval: '' });
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[1] || String(r[1]).includes('סה"כ') || String(r[1]).includes('סה״כ')) continue;
    const amt = parseFloat(r[8] || r[12] || r[3]);
    if (!isNaN(amt) && amt !== 0) {
      countCredit++;
      sumCredit += Math.abs(amt);
    }
  }
}
console.log(`\n--- 2. עסקאות אשראי 2025 ---`);
console.log(`כמות עסקאות אשראי שנמצאו: ${countCredit}`);
console.log(`סכום עסקאות אשראי כולל: ₪${sumCredit.toLocaleString('he-IL', { minimumFractionDigits: 2 })}`);

// 3. הוצאות ידניות
const manSheet = wb.Sheets['הוצאות ידני'];
const manRows = XLSX.utils.sheet_to_json(manSheet, { header: 1, defval: '' });
let countMan = 0, sumMan = 0;
console.log(`\n--- 3. דוגמאות להוצאות ידניות עם הערות שחולצו ---`);
for (let r = 1; r < manRows.length; r++) {
  const cat = manRows[r][1];
  if (!cat || String(cat).includes('סה"כ') || String(cat).includes('סה״כ')) continue;
  for (let m = 1; m <= 12; m++) {
    const cell = manSheet[XLSX.utils.encode_cell({ r, c: m + 1 })];
    if (cell && cell.v && parseFloat(cell.v) > 0) {
      countMan++;
      sumMan += parseFloat(cell.v);
      if (cell.c && cell.c[0] && countMan <= 8) {
        console.log(`[${months[m-1]}] ${cat}: ₪${cell.v} -> הערה: ${cell.c[0].t.replace(/[\r\n]+/g, ' ')}`);
      }
    }
  }
}
console.log(`סה"כ סעיפי הוצאות ידניות: ${countMan}`);
console.log(`סכום הוצאות ידניות כולל: ₪${sumMan.toLocaleString('he-IL', { minimumFractionDigits: 2 })}`);

// 4. טבלאות מיפוי
const mapSheet = wb.Sheets['טבלאות'];
if (mapSheet) {
  const mapRows = XLSX.utils.sheet_to_json(mapSheet, { header: 1, defval: '' });
  let merchants = 0, cards = 0;
  for (let i = 1; i < mapRows.length; i++) {
    if (mapRows[i][6]) merchants++;
    if (mapRows[i][9]) cards++;
  }
  console.log(`\n--- 4. כללי מיפוי בלשונית טבלאות ---`);
  console.log(`בתי עסק ממופים: ${merchants}`);
  console.log(`כרטיסים ממופים: ${cards}`);
}
