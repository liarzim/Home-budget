import * as XLSX from 'xlsx';

export interface ParsedHistoricalTransaction {
  monthIndex: number; // 1 to 12
  date: string; // YYYY-MM-DD
  payee: string;
  amount: number;
  categoryName: string;
  cardName?: string;
  cardLastDigits?: string;
  notes?: string;
  originalDescription?: string;
}

export interface ParsedHistoricalIncomeRow {
  monthIndex: number; // 1 to 12
  monthName: string;
  sourceName: string;
  amount: number;
}

export interface ParsedHistoricalSavingsAccount {
  accountName: string;
  openingBalance: number;
  closingBalance: number;
  year: number;
}

export interface ParsedHistoricalYearlySummary {
  year: number;
  fileName: string;
  itemizedTransactions: ParsedHistoricalTransaction[];
  incomeRows: ParsedHistoricalIncomeRow[];
  savingsAccounts: ParsedHistoricalSavingsAccount[];
  expenseMatrix: {
    categoryName: string;
    monthlyAmounts: { [month: number]: number };
    total: number;
  }[];
  totalItemizedAmount: number;
  totalIncomeAmount: number;
  monthsPresent: number[];
}

// Hebrew Month Mapping
const HEBREW_MONTHS: { [key: string]: number } = {
  'ינואר': 1,
  'פברואר': 2,
  'מרץ': 3,
  'אפריל': 4,
  'מאי': 5,
  'יוני': 6,
  'יולי': 7,
  'אוגוסט': 8,
  'ספטמבר': 9,
  'אוקטובר': 10,
  'נובמבר': 11,
  'דצמבר': 12,
};

/**
 * Converts Excel Serial Date number (e.g. 46193) or date string to ISO date string (YYYY-MM-DD)
 */
function parseExcelDate(val: any, fallbackYear: number, monthIndex?: number): string {
  if (!val) {
    const mm = monthIndex ? String(monthIndex).padStart(2, '0') : '01';
    return `${fallbackYear}-${mm}-01`;
  }

  // If already a number (Excel Serial Date)
  if (typeof val === 'number') {
    // Excel epoch offset
    const dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split('T')[0];
    }
  }

  const str = String(val).trim();
  // Format DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    let year = dmyMatch[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }

  // Format YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return isoMatch[0];
  }

  const mm = monthIndex ? String(monthIndex).padStart(2, '0') : '01';
  return `${fallbackYear}-${mm}-01`;
}

/**
 * Extracts card 4 digits from string (e.g. 'ויזה 3669' -> '3669')
 */
function extractCardDigits(str: any): string | undefined {
  if (!str) return undefined;
  const match = String(str).match(/(\d{4})/);
  return match ? match[1] : undefined;
}

/**
 * Dedicated parser for multi-sheet historical yearly summary files.
 */
export function parseHistoricalYearlyExcel(
  fileBuffer: ArrayBuffer,
  fileName: string
): ParsedHistoricalYearlySummary {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });

  // 1. Detect Year from filename or default to 2026
  let detectedYear = 2026;
  const yearMatch = fileName.match(/20\d{2}/);
  if (yearMatch) {
    detectedYear = parseInt(yearMatch[0], 10);
  }

  const itemizedTransactions: ParsedHistoricalTransaction[] = [];
  const incomeRows: ParsedHistoricalIncomeRow[] = [];
  const savingsAccounts: ParsedHistoricalSavingsAccount[] = [];
  const expenseMatrix: ParsedHistoricalYearlySummary['expenseMatrix'] = [];
  const monthsPresent: Set<number> = new Set();

  // =========================================================================
  // 2. PARSE MONTHLY ITEMIZED SHEETS ('1' through '12')
  // =========================================================================
  for (let m = 1; m <= 12; m++) {
    const sheetName = String(m);
    const ws = workbook.Sheets[sheetName];
    if (!ws) continue;

    monthsPresent.add(m);
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (rows.length < 2) continue;

    // Detect column indexes from header row (Row 0 or 1)
    const headerRow = rows[0] || [];
    let payeeCol = 1;
    let dateCol = 2;
    let amountCol = 3;
    let chargeDateCol = 7;
    let chargeAmountCol = 8;
    let cardTypeCol = 10;
    let expenseCategoryCol = 11;
    let expenseAmountCol = 12;
    let notesCol = 13;

    headerRow.forEach((col, idx) => {
      const colStr = String(col).trim();
      if (colStr.includes('בית עסק')) payeeCol = idx;
      if (colStr.includes('תאריך עסקה')) dateCol = idx;
      if (colStr.includes('סכום העסקה')) amountCol = idx;
      if (colStr.includes('תאריך החיוב')) chargeDateCol = idx;
      if (colStr.includes('סכום לחיוב')) chargeAmountCol = idx;
      if (colStr.includes('סוג כרטיס')) cardTypeCol = idx;
      if (colStr.includes('סוג הוצאה')) expenseCategoryCol = idx;
      if (colStr.includes('סכום הוצאה')) expenseAmountCol = idx;
      if (colStr.includes('הערות')) notesCol = idx;
    });

    // Parse data rows
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !Array.isArray(row)) continue;

      const payee = String(row[payeeCol] || '').trim();
      if (!payee || payee.includes('סה"כ') || payee.includes('סה״כ')) continue;

      // Extract amount: prefer expenseAmountCol -> chargeAmountCol -> amountCol
      let rawAmount = row[expenseAmountCol] !== '' ? row[expenseAmountCol] : (row[chargeAmountCol] !== '' ? row[chargeAmountCol] : row[amountCol]);
      let amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount).replace(/[^0-9.-]/g, ''));
      if (isNaN(amount) || amount === 0) continue;

      // Ensure amount is positive
      amount = Math.abs(amount);

      const rawDate = row[dateCol] !== '' ? row[dateCol] : row[chargeDateCol];
      const parsedDate = parseExcelDate(rawDate, detectedYear, m);
      const categoryName = String(row[expenseCategoryCol] || 'שונות').trim() || 'שונות';
      const cardRaw = String(row[cardTypeCol] || row[0] || '').trim();
      const notes = String(row[notesCol] || '').trim();

      itemizedTransactions.push({
        monthIndex: m,
        date: parsedDate,
        payee,
        amount,
        categoryName,
        cardName: cardRaw || 'כרטיס אשראי',
        cardLastDigits: extractCardDigits(cardRaw) || extractCardDigits(row[0]),
        notes: notes || undefined,
        originalDescription: `Historical Ingestion Month ${m} (${payee})`,
      });
    }
  }

  // =========================================================================
  // 3. PARSE 'הכנסות' SHEET (INCOME & YEARLY SAVINGS)
  // =========================================================================
  const incomeSheet = workbook.Sheets['הכנסות'];
  if (incomeSheet) {
    const incRows: any[][] = XLSX.utils.sheet_to_json(incomeSheet, { header: 1, defval: '' });

    // Find Header Row for Income Sources (e.g. Row with 'משכורות')
    let incomeHeaderRowIndex = -1;
    let incomeColumns: { name: string; colIdx: number }[] = [];

    for (let r = 0; r < Math.min(10, incRows.length); r++) {
      const row = incRows[r] || [];
      const hasSalary = row.some((c) => String(c).includes('משכורות') || String(c).includes('משכורת'));
      if (hasSalary) {
        incomeHeaderRowIndex = r;
        row.forEach((cell, idx) => {
          const cellStr = String(cell).trim();
          if (cellStr && !cellStr.includes('חודש') && !cellStr.includes('סה"כ') && !cellStr.includes('הוצאה') && !cellStr.includes('פער')) {
            incomeColumns.push({ name: cellStr, colIdx: idx });
          }
        });
        break;
      }
    }

    // Parse Monthly Income rows (Rows under header, matching Hebrew month names)
    if (incomeHeaderRowIndex !== -1) {
      for (let r = incomeHeaderRowIndex + 1; r < incRows.length; r++) {
        const row = incRows[r] || [];
        const monthCell = String(row[0] || '').trim();
        const monthNum = HEBREW_MONTHS[monthCell];

        if (monthNum) {
          incomeColumns.forEach(({ name, colIdx }) => {
            const rawVal = row[colIdx];
            if (rawVal !== '' && rawVal !== undefined) {
              const val = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal).replace(/[^0-9.-]/g, ''));
              if (!isNaN(val) && val > 0) {
                incomeRows.push({
                  monthIndex: monthNum,
                  monthName: monthCell,
                  sourceName: name,
                  amount: val,
                });
              }
            }
          });
        }
      }
    }

    // Parse Savings Section (Rows with 'חיסכון (מיטב/ בנק)' or 'מיטב דש')
    for (let r = 0; r < incRows.length; r++) {
      const row = incRows[r] || [];
      const accountNameCell = String(row[0] || '').trim();

      if (
        accountNameCell.includes('מיטב') ||
        accountNameCell.includes('פקדונות') ||
        accountNameCell.includes('שוק הון') ||
        accountNameCell.includes('חיסכון') ||
        accountNameCell.includes('בנק')
      ) {
        const openVal = typeof row[1] === 'number' ? row[1] : parseFloat(String(row[1] || '0').replace(/[^0-9.-]/g, ''));
        const closeVal = typeof row[2] === 'number' ? row[2] : parseFloat(String(row[2] || '0').replace(/[^0-9.-]/g, ''));

        if (!isNaN(openVal) && openVal > 0) {
          savingsAccounts.push({
            accountName: accountNameCell,
            openingBalance: openVal,
            closingBalance: !isNaN(closeVal) && closeVal > 0 ? closeVal : openVal,
            year: detectedYear,
          });
        }
      }
    }
  }

  // =========================================================================
  // 4. PARSE 'הוצאות' SHEET (CATEGORY MONTHLY AGGREGATE MATRIX)
  // =========================================================================
  const expenseSheet = workbook.Sheets['הוצאות'];
  if (expenseSheet) {
    const expRows: any[][] = XLSX.utils.sheet_to_json(expenseSheet, { header: 1, defval: '' });
    if (expRows.length > 1) {
      // Find month columns from row 0
      const headerRow = expRows[0] || [];
      const monthCols: { monthNum: number; colIdx: number }[] = [];

      headerRow.forEach((cell, idx) => {
        const str = String(cell).trim();
        if (HEBREW_MONTHS[str]) {
          monthCols.push({ monthNum: HEBREW_MONTHS[str], colIdx: idx });
        }
      });

      for (let r = 1; r < expRows.length; r++) {
        const row = expRows[r] || [];
        const catName = String(row[1] || row[0] || '').trim();
        if (!catName || catName.includes('סה"כ') || catName.includes('סוג הוצאה')) continue;

        const monthlyAmounts: { [month: number]: number } = {};
        let catTotal = 0;

        monthCols.forEach(({ monthNum, colIdx }) => {
          const raw = row[colIdx];
          if (raw !== '' && raw !== undefined) {
            const val = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^0-9.-]/g, ''));
            if (!isNaN(val) && val > 0) {
              monthlyAmounts[monthNum] = val;
              catTotal += val;
            }
          }
        });

        if (catTotal > 0) {
          expenseMatrix.push({
            categoryName: catName,
            monthlyAmounts,
            total: catTotal,
          });
        }
      }
    }
  }

  const totalItemizedAmount = itemizedTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  const totalIncomeAmount = incomeRows.reduce((sum, inc) => sum + inc.amount, 0);

  return {
    year: detectedYear,
    fileName,
    itemizedTransactions,
    incomeRows,
    savingsAccounts,
    expenseMatrix,
    totalItemizedAmount,
    totalIncomeAmount,
    monthsPresent: Array.from(monthsPresent).sort((a, b) => a - b),
  };
}
