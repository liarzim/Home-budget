import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
  ParsedFile,
  ParsedSheet,
  ColumnMapping,
  TransformedImportRow,
  BusinessMapping,
  Category,
  TransactionType,
} from './types';

/**
 * Parses an Excel (.xlsx, .xls) or CSV file 100% locally in the browser memory.
 * No data or files are transmitted to any server.
 */
export async function parseFileInBrowser(file: File): Promise<ParsedFile> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  if (extension === 'csv') {
    return parseCsvFile(file);
  } else if (extension === 'xlsx' || extension === 'xls') {
    return parseExcelFile(file, extension);
  } else {
    throw new Error(`Unsupported file format (.${extension}). Please upload .xlsx, .xls, or .csv`);
  }
}

/**
 * Parses CSV files with PapaParse
 */
async function parseCsvFile(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      skipEmptyLines: 'greedy',
      encoding: 'UTF-8',
      complete: (results) => {
        try {
          const rawGrid = results.data as any[][];
          if (!rawGrid || rawGrid.length === 0) {
            throw new Error('CSV file is empty');
          }

          const sheet = buildSheetFromGrid('Sheet 1', rawGrid, 0);

          resolve({
            fileName: file.name,
            fileSize: file.size,
            fileType: 'csv',
            sheets: [sheet],
            activeSheetName: sheet.name,
          });
        } catch (err) {
          reject(err);
        }
      },
      error: (error) => {
        reject(new Error(`CSV parsing error: ${error.message}`));
      },
    });
  });
}

/**
 * Parses Excel (.xlsx, .xls) workbooks with SheetJS
 */
async function parseExcelFile(file: File, fileType: 'xlsx' | 'xls'): Promise<ParsedFile> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellDates: true,
    cellNF: false,
    cellText: false,
  });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Excel workbook contains no sheets');
  }

  const sheets: ParsedSheet[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    // Convert worksheet to 2D array matrix
    const rawGrid: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: true,
      defval: '',
      blankrows: false,
    });

    if (rawGrid.length > 0) {
      // Auto-detect header row (skips initial empty or title rows)
      const detectedHeaderIndex = detectHeaderRowIndex(rawGrid);
      const sheet = buildSheetFromGrid(sheetName, rawGrid, detectedHeaderIndex);
      sheets.push(sheet);
    }
  }

  if (sheets.length === 0) {
    throw new Error('No readable data found in the Excel workbook');
  }

  return {
    fileName: file.name,
    fileSize: file.size,
    fileType,
    sheets,
    activeSheetName: sheets[0].name,
  };
}

/**
 * Constructs a ParsedSheet from a raw 2D grid matrix given a header row index
 */
export function buildSheetFromGrid(
  sheetName: string,
  rawGrid: any[][],
  headerRowIndex: number = 0
): ParsedSheet {
  if (!rawGrid || rawGrid.length <= headerRowIndex) {
    return {
      name: sheetName,
      headers: [],
      rows: [],
      rawGrid: rawGrid || [],
      headerRowIndex,
    };
  }

  const rawHeaders = rawGrid[headerRowIndex] || [];
  const headerCounts: Record<string, number> = {};

  // Clean & deduplicate header names
  const headers = rawHeaders.map((h, i) => {
    let clean = String(h ?? '').trim();
    if (!clean) clean = `Column_${i + 1}`;
    if (headerCounts[clean]) {
      headerCounts[clean]++;
      clean = `${clean}_${headerCounts[clean]}`;
    } else {
      headerCounts[clean] = 1;
    }
    return clean;
  });

  const dataGrid = rawGrid.slice(headerRowIndex + 1);
  const rows: Record<string, any>[] = [];

  for (const rowArr of dataGrid) {
    // Skip empty lines
    const hasValues = rowArr.some((val) => val !== '' && val !== null && val !== undefined);
    if (!hasValues) continue;

    const rowObj: Record<string, any> = {};
    headers.forEach((header, colIndex) => {
      rowObj[header] = rowArr[colIndex] ?? '';
    });
    rows.push(rowObj);
  }

  return {
    name: sheetName,
    headers,
    rows,
    rawGrid,
    headerRowIndex,
  };
}

/**
 * Auto-detects header row index by scoring rows for header-like keywords
 */
function detectHeaderRowIndex(rawGrid: any[][]): number {
  const maxSearchRows = Math.min(10, rawGrid.length);
  let bestRowIndex = 0;
  let highestScore = -1;

  const headerKeywords = [
    'תאריך', 'date', 'עסקה', 'שם', 'בית עסק', 'תיאור', 'סכום', 'amount',
    'חובה', 'זכות', 'חיוב', 'payee', 'merchant', 'description', 'total',
    'debit', 'credit', 'category', 'כרטיס', 'card'
  ];

  for (let r = 0; r < maxSearchRows; r++) {
    const row = rawGrid[r];
    if (!Array.isArray(row)) continue;

    let score = 0;
    const nonEmptyCells = row.filter((c) => c !== '' && c !== null && c !== undefined);
    if (nonEmptyCells.length < 2) continue; // single cell title row

    for (const cell of nonEmptyCells) {
      const str = String(cell).toLowerCase();
      for (const kw of headerKeywords) {
        if (str.includes(kw)) {
          score += 2;
        }
      }
      // If text string and not purely numeric, slight boost
      if (isNaN(Number(cell))) {
        score += 0.5;
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestRowIndex = r;
    }
  }

  return bestRowIndex;
}

/**
 * Intelligent heuristic auto-mapper for Hebrew & English financial headers
 */
export function suggestInitialMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    dateColumn: '',
    payeeColumn: '',
    amountMode: 'single',
    amountColumn: '',
    debitColumn: '',
    creditColumn: '',
    categoryColumn: '',
    paymentMethodColumn: '',
    cardDigitsColumn: '',
    notesColumn: '',
    dateFormat: 'auto',
    reverseAmountSign: false,
  };

  const normalize = (s: string) => s.toLowerCase().replace(/[\s_\-:"'()]/g, '');

  const datePatterns = ['תאריךעסקה', 'תאריךחיוב', 'תאריךרכישה', 'תאריך', 'date', 'txdate', 'transdate', 'posted', 'time'];
  const payeePatterns = ['שםביתעסק', 'שםביתיעסק', 'שםהספק', 'שםביתהעסק', 'תיאורעסקה', 'תיאור', 'ביתעסק', 'פירוט', 'payee', 'merchant', 'description', 'vendor', 'name', 'details'];
  const amountPatterns = ['סכוםחיוב', 'סכוםעסקה', 'סכוםמקורי', 'סכום', 'סה"כ', 'amount', 'total', 'charge', 'price', 'sum'];
  const debitPatterns = ['חובה', 'סכוםחובה', 'סכוםחיוב', 'debit', 'expense', 'withdrawal', 'outflow'];
  const creditPatterns = ['זכות', 'סכוםזכות', 'זיכוי', 'הכנסה', 'credit', 'income', 'deposit', 'inflow'];
  const categoryPatterns = ['קטגוריה', 'סיווג', 'ענף', 'category', 'type', 'group'];
  const cardPatterns = ['4ספרות', 'ארבעספרות', 'כרטיס', 'מספרכרטיס', 'ספרות', 'card', 'last4', 'account', 'carddigits'];
  const notesPatterns = ['הערות', 'פרטיםנוספים', 'מידענוסף', 'notes', 'memo', 'comment', 'extra'];

  // Helper to find first matching header
  const findMatch = (patterns: string[]) => {
    return headers.find((h) => {
      const norm = normalize(h);
      return patterns.some((p) => norm.includes(p));
    }) || '';
  };

  mapping.dateColumn = findMatch(datePatterns);
  mapping.payeeColumn = findMatch(payeePatterns);
  mapping.amountColumn = findMatch(amountPatterns);
  mapping.categoryColumn = findMatch(categoryPatterns);
  mapping.cardDigitsColumn = findMatch(cardPatterns);
  mapping.notesColumn = findMatch(notesPatterns);

  const debitMatch = findMatch(debitPatterns);
  const creditMatch = findMatch(creditPatterns);

  // If separate debit and credit columns exist and no single amount column was found
  if (debitMatch && creditMatch && (!mapping.amountColumn || debitMatch !== mapping.amountColumn)) {
    mapping.debitColumn = debitMatch;
    mapping.creditColumn = creditMatch;
  }

  // Fallback default selections if not matched
  if (!mapping.dateColumn && headers.length > 0) mapping.dateColumn = headers[0];
  if (!mapping.payeeColumn && headers.length > 1) mapping.payeeColumn = headers[1];
  if (!mapping.amountColumn && headers.length > 2) mapping.amountColumn = headers[2];

  return mapping;
}

/**
 * Parses and standardizes date strings into ISO format YYYY-MM-DD
 */
export function parseDateValue(raw: any): string | null {
  if (raw === null || raw === undefined || raw === '') return null;

  // 1. If already Date object
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return raw.toISOString().split('T')[0];
  }

  // 2. If Excel serial number (e.g. 45512)
  if (typeof raw === 'number' && raw > 20000 && raw < 80000) {
    try {
      const dateObj = XLSX.SSF.parse_date_code(raw);
      if (dateObj) {
        const y = String(dateObj.y).padStart(4, '0');
        const m = String(dateObj.m).padStart(2, '0');
        const d = String(dateObj.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch {
      // fallback
    }
  }

  const str = String(raw).trim();

  // 3. Match YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // 4. Match DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dmyMatch) {
    let [, d, m, y] = dmyMatch;
    if (y.length === 2) {
      y = parseInt(y, 10) > 70 ? `19${y}` : `20${y}`;
    }
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // 5. Native Date.parse fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Standardizes monetary amounts to numbers, stripping currency symbols and punctuation
 */
export function parseAmountValue(raw: any): number | null {
  if (raw === null || raw === undefined || raw === '') return null;

  if (typeof raw === 'number') {
    return isNaN(raw) ? null : raw;
  }

  let str = String(raw).trim();

  // Handle accounting negative parentheses e.g. (1,234.50) -> -1234.50
  const isParenNegative = /^\(.*\)$/.test(str);
  str = str.replace(/[()]/g, '');

  // Remove currencies, spaces, and commas
  str = str.replace(/[₪$€£,A-Za-z\s]/g, '');

  let val = parseFloat(str);
  if (isNaN(val)) return null;

  if (isParenNegative && val > 0) {
    val = -val;
  }

  return val;
}

/**
 * Transforms raw file rows into normalized TransformedImportRows using the mapping
 */
export function transformRowsWithMapping(
  rows: Record<string, any>[],
  mapping: ColumnMapping,
  businessMappings: BusinessMapping[],
  categories: Category[]
): TransformedImportRow[] {
  return rows.map((row, index) => {
    const rawDate = mapping.dateColumn ? row[mapping.dateColumn] : null;
    const rawPayee = mapping.payeeColumn ? row[mapping.payeeColumn] : '';
    const parsedDate = parseDateValue(rawDate);
    const payeeName = String(rawPayee ?? '').trim() || 'Unknown Payee';

    let amount = 0;
    let transactionType: TransactionType = 'expense';
    let isValid = true;
    let validationError = '';

    if (mapping.amountMode === 'debit_credit') {
      const debitVal = mapping.debitColumn ? parseAmountValue(row[mapping.debitColumn]) : null;
      const creditVal = mapping.creditColumn ? parseAmountValue(row[mapping.creditColumn]) : null;

      if (creditVal && creditVal > 0) {
        amount = creditVal;
        transactionType = 'income';
      } else if (debitVal && debitVal > 0) {
        amount = debitVal;
        transactionType = 'expense';
      } else if (debitVal !== null && debitVal !== 0) {
        amount = Math.abs(debitVal);
        transactionType = debitVal < 0 ? 'income' : 'expense';
      } else {
        amount = 0;
      }
    } else {
      // Single amount column
      const parsedAmount = mapping.amountColumn ? parseAmountValue(row[mapping.amountColumn]) : null;
      if (parsedAmount === null) {
        isValid = false;
        validationError = 'Invalid amount';
      } else {
        let finalAmount = parsedAmount;
        if (mapping.reverseAmountSign) {
          finalAmount = -finalAmount;
        }

        if (finalAmount < 0) {
          // Negative is expense in standard banking or income if reversed
          amount = Math.abs(finalAmount);
          transactionType = 'expense';
        } else {
          // In credit card statements, positive amounts are usually expenses!
          amount = finalAmount;
          transactionType = 'expense';
        }
      }
    }

    if (!parsedDate) {
      isValid = false;
      validationError = validationError ? `${validationError}, Invalid date` : 'Invalid date format';
    }

    // Auto-categorization using Business Mapping rules
    let categoryId: string | null = null;
    let autoMatchedRule: string | undefined;

    if (mapping.categoryColumn && row[mapping.categoryColumn]) {
      const rawCat = String(row[mapping.categoryColumn]).trim().toLowerCase();
      const matchedCat = categories.find((c) => c.name.toLowerCase() === rawCat);
      if (matchedCat) {
        categoryId = matchedCat.id;
      }
    }

    if (!categoryId && payeeName) {
      const cleanPayee = payeeName.toUpperCase();
      const matchedRule = businessMappings.find((rule) =>
        cleanPayee.includes(rule.pattern.toUpperCase())
      );
      if (matchedRule) {
        categoryId = matchedRule.category_id;
        autoMatchedRule = matchedRule.pattern;
      }
    }

    // Card Digits
    let cardDigits: string | null = null;
    if (mapping.cardDigitsColumn && row[mapping.cardDigitsColumn]) {
      const digitsMatch = String(row[mapping.cardDigitsColumn]).match(/\d{4}/);
      if (digitsMatch) {
        cardDigits = digitsMatch[0];
      }
    }

    // Notes
    let notes: string | null = null;
    if (mapping.notesColumn && row[mapping.notesColumn]) {
      notes = String(row[mapping.notesColumn]).trim() || null;
    }

    return {
      id: `imp-${index + 1}-${Date.now()}`,
      originalRowIndex: index + 1,
      date: parsedDate || new Date().toISOString().split('T')[0],
      payee_name: payeeName,
      amount,
      transaction_type: transactionType,
      category_id: categoryId,
      auto_matched_rule: autoMatchedRule,
      payment_method: cardDigits ? 'credit_card' : 'bank_transfer',
      card_last_digits: cardDigits,
      notes,
      is_hidden: false, // Default to active (not hidden)
      isValid,
      validationError,
      selected: isValid, // preselect valid rows
    };
  });
}
