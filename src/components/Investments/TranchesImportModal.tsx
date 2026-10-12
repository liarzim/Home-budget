import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
  UploadCloud,
  FileSpreadsheet,
  Check,
  AlertCircle,
  Download,
  X,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  ClipboardList,
  Sparkles,
  Info,
} from 'lucide-react';
import { InvestmentAsset, InvestmentTranche, SecurityType } from '../../lib/types';
import { formatDate, normalizeToISODate } from '../../lib/i18n';

interface ParsedTrancheRow {
  id: string;
  rawDate: string;
  date: string; // ISO YYYY-MM-DD
  action: string;
  securityName: string;
  symbol: string;
  shares: number;
  rawPrice: number; // Raw price from file (Agorot for ILS securities)
  price: number; // Effective price per share in currency units (ILS if converted)
  currency: 'USD' | 'ILS';
  isAgorot: boolean; // Whether raw price is in Agorot and divided by 100
  fee: number;
  totalCost: number;
  notes: string;
  targetAssetId: string; // existing asset id or 'new_asset'
  isDuplicate: boolean;
  selected: boolean;
  error?: string;
}

interface TranchesImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  investments: InvestmentAsset[];
  onImportComplete: (updatedAssets: InvestmentAsset[], importedCount: number) => void;
  defaultTargetAsset?: InvestmentAsset | null;
  isHe: boolean;
  usdRate?: number;
}

export const TranchesImportModal: React.FC<TranchesImportModalProps> = ({
  isOpen,
  onClose,
  investments,
  onImportComplete,
  defaultTargetAsset,
  isHe,
  usdRate = 3.65,
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedTrancheRow[]>([]);
  const [targetAssetMap, setTargetAssetMap] = useState<Record<string, string>>({}); // symbol -> assetId or 'new_asset'
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Helper to parse dates from various formats (DD/MM/YYYY, Excel serial, Date objects)
  const parseAnyDate = (val: any): { isoDate: string; rawStr: string } => {
    if (!val) {
      const today = new Date().toISOString().split('T')[0];
      return { isoDate: today, rawStr: today };
    }

    // 1. Date object
    if (val instanceof Date && !isNaN(val.getTime())) {
      const iso = val.toISOString().split('T')[0];
      return { isoDate: iso, rawStr: formatDate(iso) };
    }

    // 2. Excel numeric date serial
    if (typeof val === 'number' && val > 20000 && val < 90000) {
      try {
        const parsedCode = XLSX.SSF.parse_date_code(val);
        if (parsedCode) {
          const y = parsedCode.y;
          const m = String(parsedCode.m).padStart(2, '0');
          const d = String(parsedCode.d).padStart(2, '0');
          const iso = `${y}-${m}-${d}`;
          return { isoDate: iso, rawStr: `${d}/${m}/${y}` };
        }
      } catch (e) {
        // fallback to standard calculation
        const dateFromSerial = new Date(Math.round((val - 25569) * 86400 * 1000));
        if (!isNaN(dateFromSerial.getTime())) {
          const iso = dateFromSerial.toISOString().split('T')[0];
          return { isoDate: iso, rawStr: formatDate(iso) };
        }
      }
    }

    // 3. String date: DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY, YYYY-MM-DD
    const str = String(val).trim();
    const dmyMatch = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return { isoDate: `${year}-${month}-${day}`, rawStr: `${day}/${month}/${year}` };
    }

    const ymdMatch = str.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
    if (ymdMatch) {
      const year = ymdMatch[1];
      const month = ymdMatch[2].padStart(2, '0');
      const day = ymdMatch[3].padStart(2, '0');
      return { isoDate: `${year}-${month}-${day}`, rawStr: `${day}/${month}/${year}` };
    }

    const iso = normalizeToISODate(str);
    return { isoDate: iso, rawStr: formatDate(iso) };
  };

  // Helper to find matching asset in portfolio
  const findMatchingAsset = (symbol: string, name: string): InvestmentAsset | undefined => {
    if (defaultTargetAsset) return defaultTargetAsset;

    const cleanSymbol = symbol.trim().toUpperCase();
    const cleanName = name.trim().toLowerCase();

    return investments.find((a) => {
      const aTicker = a.ticker.trim().toUpperCase();
      const aSecNum = a.security_number ? a.security_number.trim().toUpperCase() : '';
      const aName = a.name.trim().toLowerCase();

      return (
        aTicker === cleanSymbol ||
        (cleanSymbol && aSecNum === cleanSymbol) ||
        aName === cleanName ||
        (cleanSymbol && aName.includes(cleanSymbol.toLowerCase())) ||
        (cleanName && aTicker.includes(cleanName.toUpperCase()))
      );
    });
  };

  // Check if a tranche is a duplicate of an existing tranche in asset
  const checkIfDuplicate = (
    asset: InvestmentAsset | undefined,
    date: string,
    shares: number,
    price: number
  ): boolean => {
    if (!asset || !asset.tranches) return false;
    return asset.tranches.some((t) => {
      const sameDate = t.date === date;
      const sameShares = Math.abs(t.shares - shares) < 0.0001;
      const samePrice = Math.abs(t.price_per_share - price) < 0.01;
      return sameDate && sameShares && samePrice;
    });
  };

  // Core processing of raw tabular data (array of objects with header keys)
  const processRawData = (rawRows: Record<string, any>[]) => {
    setParseError(null);
    if (!rawRows || rawRows.length === 0) {
      setParseError(isHe ? 'לא נמצאו נתונים בקובץ.' : 'No data found in file.');
      return;
    }

    const newTargetMap: Record<string, string> = {};
    const parsed: ParsedTrancheRow[] = [];

    rawRows.forEach((row, index) => {
      // Find keys case-insensitively / trimmed
      const keys = Object.keys(row);
      const getKey = (patterns: string[]): string | undefined => {
        return keys.find((k) => {
          const cleanK = k.trim().toLowerCase();
          return patterns.some((p) => cleanK.includes(p.toLowerCase()));
        });
      };

      const dateKey = getKey(['תאריך', 'date', 'execution date', 'תאריך עסקה', 'מועד']);
      const actionKey = getKey(['סוג פעולה', 'סוג', 'פעולה', 'action', 'type', 'operation']);
      const nameKey = getKey(['שם נייר', 'שם הנייר', 'שם', 'security name', 'description', 'name']);
      const symbolKey = getKey(["מס' נייר / סימבול", 'סימבול', 'מספר נייר', 'נייר / סימבול', 'symbol', 'ticker', 'security no', 'isin']);
      const sharesKey = getKey(['כמות', 'כמות מניות', 'shares', 'quantity', 'qty']);
      const priceKey = getKey(['שער ביצוע', 'מחיר ביצוע', 'שער', 'מחיר', 'price', 'execution price', 'rate']);
      const currencyKey = getKey(['מטבע', 'currency', 'curr']);
      const feeKey = getKey(['עמלת פעולה', 'עמלה', 'דמי מסחר', 'fee', 'commission']);
      const feeExtraKey = getKey(['עמלות נלוות', 'עמלה נלווית', 'עמלות נוספות', 'other fee', 'additional fee']);
      const foreignCostKey = getKey(['תמורה במט"ח', 'תמורה במטח', 'תמורה במטבע חוץ', 'foreign amount']);
      const ilsCostKey = getKey(['תמורה בשקלים', 'תמורה בש"ח', 'תמורה בשח', 'ils amount']);
      const genericCostKey = getKey(['תמורה', 'סה"כ תמורה', 'סך הכל', 'total cost', 'total', 'amount']);

      const rawDateVal = dateKey ? row[dateKey] : null;
      const { isoDate, rawStr: formattedDate } = parseAnyDate(rawDateVal);

      const action = actionKey ? String(row[actionKey] || '').trim() : 'קניה';
      let name = nameKey ? String(row[nameKey] || '').trim() : '';
      let symbol = symbolKey ? String(row[symbolKey] || '').trim() : '';

      // If symbol is missing but name is provided
      if (!symbol && name) {
        // e.g. "SPCX US" -> symbol "SPCX"
        const parts = name.split(' ');
        symbol = parts[0] || name;
      }
      if (!name && symbol) {
        name = symbol;
      }
      if (!symbol && !name) {
        // Skip row if both symbol and name are empty
        return;
      }

      // Quantity / Shares
      const rawShares = sharesKey !== undefined ? String(row[sharesKey] || '').replace(/,/g, '').trim() : '0';
      const shares = Math.abs(parseFloat(rawShares) || 0);

      // Price
      const rawPriceStr = priceKey !== undefined ? String(row[priceKey] || '').replace(/,/g, '').replace(/[$₪]/g, '').trim() : '0';
      const rawPrice = Math.abs(parseFloat(rawPriceStr) || 0);

      // Skip row if shares and price are zero
      if (shares <= 0 && rawPrice <= 0) {
        return;
      }

      // Currency
      const rawCurrency = currencyKey ? String(row[currencyKey] || '').trim() : '';
      let currency: 'USD' | 'ILS' = 'USD';
      if (rawCurrency.includes('$') || rawCurrency.toUpperCase().includes('USD') || rawCurrency.includes('דולר')) {
        currency = 'USD';
      } else if (rawCurrency.includes('₪') || rawCurrency.toUpperCase().includes('ILS') || rawCurrency.includes('ש"ח') || rawCurrency.includes('שח') || rawCurrency.includes('שקל')) {
        currency = 'ILS';
      } else {
        // Default based on symbol or existing target asset
        const matched = findMatchingAsset(symbol, name);
        if (matched) {
          currency = matched.currency;
        } else if (name.toUpperCase().includes('US') || symbol.toUpperCase().endsWith('US')) {
          currency = 'USD';
        } else if (/^\d{6,8}$/.test(symbol)) {
          // Israeli 6-8 digit TASE security number (e.g. 1159250)
          currency = 'ILS';
        } else {
          currency = 'USD';
        }
      }

      // In Israeli stocks (TASE / Shekel securities), prices in broker reports are quoted in Agorot (100 Agorot = 1 ILS)
      // Therefore, if currency is ILS, default isAgorot = true, meaning price in ILS = rawPrice / 100
      const isAgorot = currency === 'ILS';
      const price = isAgorot ? rawPrice / 100 : rawPrice;

      // Fees
      const feeVal = feeKey ? parseFloat(String(row[feeKey] || '0').replace(/,/g, '').replace(/[$₪]/g, '')) || 0 : 0;
      const feeExtraVal = feeExtraKey ? parseFloat(String(row[feeExtraKey] || '0').replace(/,/g, '').replace(/[$₪]/g, '')) || 0 : 0;
      const totalFee = Math.max(0, feeVal + feeExtraVal);

      // Purchase cost basis of the tranche (fee is tracked separately and excluded from P&L)
      const totalCost = shares * price;

      // Notes
      const notesParts: string[] = [];
      if (action) notesParts.push(`פעולה: ${action}`);
      if (isAgorot) notesParts.push(`שער מקורי: ${rawPrice} אג' (חולק ב-100)`);
      if (row['יתרה שקלית']) notesParts.push(`יתרה שקלית: ${row['יתרה שקלית']}`);

      // Target asset matching
      const symbolKeyNorm = symbol.toUpperCase();
      if (!newTargetMap[symbolKeyNorm]) {
        const matched = findMatchingAsset(symbol, name);
        newTargetMap[symbolKeyNorm] = matched ? matched.id : 'new_asset';
      }

      const assignedAssetId = newTargetMap[symbolKeyNorm];
      const assignedAsset = investments.find((a) => a.id === assignedAssetId);
      const isDup = checkIfDuplicate(assignedAsset, isoDate, shares, price);

      parsed.push({
        id: `parsed-${index}-${Date.now()}`,
        rawDate: formattedDate,
        date: isoDate,
        action,
        securityName: name,
        symbol: symbol.toUpperCase(),
        shares,
        rawPrice,
        price,
        currency,
        isAgorot,
        fee: totalFee,
        totalCost,
        notes: notesParts.join(' | '),
        targetAssetId: assignedAssetId,
        isDuplicate: isDup,
        selected: !isDup, // Pre-select non-duplicates
      });
    });

    if (parsed.length === 0) {
      setParseError(
        isHe
          ? 'לא נמצאו שורות תקינות לפעימות רכישה. אנא ודא שהקובץ כולל עמודות: תאריך, שם/סימבול נייר, כמות, שער ביצוע.'
          : 'No valid tranche rows found. Please check columns: Date, Symbol/Name, Shares, Execution Price.'
      );
      return;
    }

    setTargetAssetMap(newTargetMap);
    setParsedRows(parsed);
  };

  // Handle File Upload (.xlsx, .xls, .csv)
  const handleFileUpload = async (file: File) => {
    setParseError(null);
    setFileName(file.name);
    setIsProcessing(true);

    try {
      const isCsv = file.name.endsWith('.csv');
      let rawData: Record<string, any>[] = [];

      if (isCsv) {
        const text = await file.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: 'greedy' });
        rawData = parsed.data as Record<string, any>[];
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      }

      processRawData(rawData);
    } catch (err: any) {
      console.error(err);
      setParseError(err.message || (isHe ? 'שגיאה בקריאת הקובץ' : 'Error reading file'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Text/Clipboard Parse
  const handlePasteParse = () => {
    if (!pastedText.trim()) return;
    setIsProcessing(true);
    setParseError(null);

    try {
      const parsed = Papa.parse(pastedText.trim(), {
        header: true,
        skipEmptyLines: 'greedy',
      });
      processRawData(parsed.data as Record<string, any>[]);
    } catch (err: any) {
      console.error(err);
      setParseError(err.message || (isHe ? 'שגיאה בניתוח הטקסט' : 'Error parsing text'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Update target asset for a symbol
  const handleTargetAssetChange = (symbol: string, newAssetId: string) => {
    setTargetAssetMap((prev) => ({
      ...prev,
      [symbol]: newAssetId,
    }));

    // Update all parsed rows with this symbol
    setParsedRows((prev) =>
      prev.map((r) => {
        if (r.symbol === symbol) {
          const assignedAsset = investments.find((a) => a.id === newAssetId);
          const isDup = checkIfDuplicate(assignedAsset, r.date, r.shares, r.price);
          return {
            ...r,
            targetAssetId: newAssetId,
            isDuplicate: isDup,
            selected: isDup ? false : r.selected,
          };
        }
        return r;
      })
    );
  };

  // Toggle selection for a single row
  const toggleRowSelect = (rowId: string) => {
    setParsedRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, selected: !r.selected } : r))
    );
  };

  // Selection helpers
  const handleSelectAll = () => {
    setParsedRows((prev) => prev.map((r) => ({ ...r, selected: true })));
  };

  const handleSelectNonDuplicates = () => {
    setParsedRows((prev) => prev.map((r) => ({ ...r, selected: !r.isDuplicate })));
  };

  const handleDeselectAll = () => {
    setParsedRows((prev) => prev.map((r) => ({ ...r, selected: false })));
  };

  // Toggle Agorot (➗ 100) for a single row
  const toggleRowAgorot = (rowId: string) => {
    setParsedRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const newIsAgorot = !r.isAgorot;
        const newPrice = newIsAgorot ? r.rawPrice / 100 : r.rawPrice;
        const newTotalCost = r.shares * newPrice;
        const assignedAsset = investments.find((a) => a.id === r.targetAssetId);
        const isDup = checkIfDuplicate(assignedAsset, r.date, r.shares, newPrice);
        return {
          ...r,
          isAgorot: newIsAgorot,
          price: newPrice,
          totalCost: newTotalCost,
          isDuplicate: isDup,
        };
      })
    );
  };

  // Toggle all ILS rows between Agorot (➗ 100) and Shekels
  const toggleAllIlsAgorot = (agVal: boolean) => {
    setParsedRows((prev) =>
      prev.map((r) => {
        if (r.currency !== 'ILS') return r;
        const newPrice = agVal ? r.rawPrice / 100 : r.rawPrice;
        const newTotalCost = r.shares * newPrice;
        const assignedAsset = investments.find((a) => a.id === r.targetAssetId);
        const isDup = checkIfDuplicate(assignedAsset, r.date, r.shares, newPrice);
        return {
          ...r,
          isAgorot: agVal,
          price: newPrice,
          totalCost: newTotalCost,
          isDuplicate: isDup,
        };
      })
    );
  };

  // Download Sample Template
  const handleDownloadSample = () => {
    const sampleData = [
      {
        'תאריך': '07/10/2026',
        'סוג פעולה': 'קניה חול מטח',
        'שם נייר': 'SPCX US',
        "מס' נייר / סימבול": 'SPCX',
        'כמות': 1,
        'שער ביצוע': 167.5,
        'מטבע': '$ ',
        'עמלת פעולה': 8,
        'עמלות נלוות': 0,
        'תמורה במט"ח': -175.5,
        'תמורה בשקלים': 0,
        'יתרה שקלית': 271.54,
        'אומדן מס רווחי הון': 0,
      },
      {
        'תאריך': '28/09/2026',
        'סוג פעולה': 'קניה חול מטח',
        'שם נייר': 'SPCX US',
        "מס' נייר / סימבול": 'SPCX',
        'כמות': 5,
        'שער ביצוע': 147,
        'מטבע': '$ ',
        'עמלת פעולה': 8,
        'עמלות נלוות': 0,
        'תמורה במט"ח': -743,
        'תמורה בשקלים': 0,
        'יתרה שקלית': 252.57,
        'אומדן מס רווחי הון': 0,
      },
      {
        'תאריך': '15/06/2026',
        'סוג פעולה': 'קניה חול מטח',
        'שם נייר': 'SPCX US',
        "מס' נייר / סימבול": 'SPCX',
        'כמות': 8,
        'שער ביצוע': 173.77,
        'מטבע': '$ ',
        'עמלת פעולה': 8,
        'עמלות נלוות': 0,
        'תמורה במט"ח': -1398.16,
        'תמורה בשקלים': 0,
        'יתרה שקלית': 10038.52,
        'אומדן מס רווחי הון': 0,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tranches');
    XLSX.writeFile(workbook, 'תבנית_פעימות_רכישה_לדוגמה.xlsx');
  };

  // Perform Final Import
  const handleExecuteImport = () => {
    const selectedRows = parsedRows.filter((r) => r.selected);
    if (selectedRows.length === 0) {
      alert(isHe ? 'אנא בחר לפחות פעימה אחת לייבוא.' : 'Please select at least one tranche to import.');
      return;
    }

    // Group selected rows by symbol / targetAssetId
    const groupsBySymbol: Record<string, ParsedTrancheRow[]> = {};
    selectedRows.forEach((r) => {
      if (!groupsBySymbol[r.symbol]) {
        groupsBySymbol[r.symbol] = [];
      }
      groupsBySymbol[r.symbol].push(r);
    });

    let updatedAssets = [...investments];

    Object.entries(groupsBySymbol).forEach(([symbol, rows]) => {
      const targetId = targetAssetMap[symbol] || 'new_asset';
      const latestPrice = rows.reduce((latest, r) => (r.price > 0 ? r.price : latest), 0);

      // Convert rows to InvestmentTranche
      const newTranches: InvestmentTranche[] = rows.map((r, idx) => ({
        id: `tr-imp-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        date: r.date,
        shares: r.shares,
        price_per_share: r.price,
        fee: r.fee,
        total_cost: r.totalCost,
        notes: r.notes || `ייבוא מקובץ: ${r.action}`,
      }));

      if (targetId === 'new_asset') {
        // Create new asset
        const firstRow = rows[0];
        const newAsset: InvestmentAsset = {
          id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          household_id: 'default',
          ticker: symbol,
          name: firstRow.securityName || symbol,
          currency: firstRow.currency || 'USD',
          current_price: latestPrice || firstRow.price || 100,
          asset_type: (firstRow.currency === 'USD' ? 'foreign_security' : 'stock') as SecurityType,
          tranches: newTranches,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        updatedAssets = [newAsset, ...updatedAssets];
      } else {
        // Append to existing asset
        updatedAssets = updatedAssets.map((asset) => {
          if (asset.id === targetId) {
            return {
              ...asset,
              current_price:
                asset.current_price && asset.current_price > 0 ? asset.current_price : latestPrice,
              tranches: [...(asset.tranches || []), ...newTranches],
              updated_at: new Date().toISOString(),
            };
          }
          return asset;
        });
      }
    });

    onImportComplete(updatedAssets, selectedRows.length);
    onClose();
  };

  // Distinct symbols summary
  const distinctSymbols = Array.from(new Set(parsedRows.map((r) => r.symbol)));
  const totalSelectedCount = parsedRows.filter((r) => r.selected).length;
  const duplicatesCount = parsedRows.filter((r) => r.isDuplicate).length;
  const hasIlsRows = parsedRows.some((r) => r.currency === 'ILS');
  const allIlsInAgorot = hasIlsRows && parsedRows.filter((r) => r.currency === 'ILS').every((r) => r.isAgorot);

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()} dir={isHe ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div style={styles.modalHeader}>
          <div style={styles.modalHeaderTitleGroup}>
            <div style={styles.modalIconWrap}>
              <FileSpreadsheet size={24} color="#2563EB" />
            </div>
            <div>
              <h2 style={styles.modalHeading}>
                {isHe ? 'ייבוא פעימות רכישה מאקסל / CSV' : 'Import Purchase Tranches from Excel / CSV'}
              </h2>
              <p style={styles.modalSub}>
                {isHe
                  ? 'העלה דוח תנועות או הדבק שורות לקליטה מרוכזת של מנות רכישה ישירות לתיק ההשקעות'
                  : 'Upload broker transaction statement or paste rows to batch-import purchase tranches'}
              </p>
            </div>
          </div>
          <button style={styles.modalCloseBtn} onClick={onClose} type="button">
            <X size={20} color="#64748B" />
          </button>
        </div>

        {/* If no rows parsed yet: Input Step */}
        {parsedRows.length === 0 ? (
          <div>
            {/* Tabs */}
            <div style={styles.tabBar}>
              <button
                type="button"
                style={{
                  ...styles.tabBtn,
                  ...(activeTab === 'file' ? styles.tabBtnActive : {}),
                }}
                onClick={() => setActiveTab('file')}
              >
                <UploadCloud size={16} />
                <span>{isHe ? 'העלאת קובץ (Excel / CSV)' : 'Upload File (Excel / CSV)'}</span>
              </button>
              <button
                type="button"
                style={{
                  ...styles.tabBtn,
                  ...(activeTab === 'paste' ? styles.tabBtnActive : {}),
                }}
                onClick={() => setActiveTab('paste')}
              >
                <ClipboardList size={16} />
                <span>{isHe ? 'הדבקת טקסט מהלוח' : 'Paste Data from Clipboard'}</span>
              </button>
            </div>

            {/* Tab 1: File Upload */}
            {activeTab === 'file' && (
              <div
                style={{
                  ...styles.dropzone,
                  ...(isDragging ? styles.dropzoneActive : {}),
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
                <div style={styles.dropzoneIconWrap}>
                  <UploadCloud size={40} color="#2563EB" />
                </div>
                <h3 style={styles.dropzoneTitle}>
                  {isHe ? 'גרור ושחרר קובץ אקסל לכאן' : 'Drag and drop Excel or CSV file here'}
                </h3>
                <p style={styles.dropzoneSub}>
                  {isHe
                    ? 'תומך בקבצי .xlsx, .xls או .csv מייצוא הבנק/ברוקר (איביאי, מיטב, בנק הפועלים, לאומי ועוד)'
                    : 'Supports .xlsx, .xls or .csv from broker exports'}
                </p>
                <button
                  type="button"
                  style={styles.browseBtn}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                >
                  <FileSpreadsheet size={16} />
                  <span>{isProcessing ? (isHe ? 'מעבד נתונים...' : 'Processing...') : isHe ? 'בחר קובץ מהמחשב' : 'Browse File'}</span>
                </button>
              </div>
            )}

            {/* Tab 2: Clipboard Paste */}
            {activeTab === 'paste' && (
              <div style={styles.pasteWrap}>
                <label style={styles.pasteLabel}>
                  {isHe
                    ? 'הדבק טבלה שהועתקה מאקסל או קובץ CSV (כולל שורת כותרות):'
                    : 'Paste copied table from Excel or CSV (including header row):'}
                </label>
                <textarea
                  style={styles.pasteTextarea}
                  rows={8}
                  dir="ltr"
                  placeholder={`תאריך,סוג פעולה,שם נייר,מס' נייר / סימבול,כמות,שער ביצוע,מטבע,עמלת פעולה,עמלות נלוות,"תמורה במט""ח"\n07/10/2026,קניה חול מטח,SPCX US,SPCX,1,167.5,$ ,8,0,-175.5\n28/09/2026,קניה חול מטח,SPCX US,SPCX,5,147,$ ,8,0,-743`}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                />
                <div style={styles.pasteActions}>
                  <button
                    type="button"
                    style={styles.parsePasteBtn}
                    onClick={handlePasteParse}
                    disabled={!pastedText.trim() || isProcessing}
                  >
                    <Sparkles size={16} />
                    <span>{isProcessing ? (isHe ? 'מעבד...' : 'Processing...') : isHe ? 'נתח והצג תצוגה מקדימה' : 'Parse & Preview'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Template Download & Info Box */}
            <div style={styles.infoBox}>
              <div style={styles.infoTop}>
                <Info size={16} color="#0284C7" />
                <span style={styles.infoTitle}>
                  {isHe ? 'מבנה עמודות נתמך:' : 'Supported Column Structure:'}
                </span>
              </div>
              <div style={styles.infoPills}>
                <span style={styles.infoPill}>תאריך (DD/MM/YYYY)</span>
                <span style={styles.infoPill}>סוג פעולה</span>
                <span style={styles.infoPill}>שם נייר</span>
                <span style={styles.infoPill}>מס' נייר / סימבול</span>
                <span style={styles.infoPill}>כמות מניות</span>
                <span style={styles.infoPill}>שער ביצוע</span>
                <span style={styles.infoPill}>מטבע ($ / ₪)</span>
                <span style={styles.infoPill}>עמלת פעולה</span>
                <span style={styles.infoPill}>עמלות נלוות</span>
                <span style={styles.infoPill}>תמורה במט"ח / שקלים</span>
              </div>

              <div style={styles.templateRow}>
                <button
                  type="button"
                  style={styles.sampleDownloadBtn}
                  onClick={handleDownloadSample}
                >
                  <Download size={14} color="#0369A1" />
                  <span>{isHe ? 'הורד קובץ אקסל לדוגמה (.xlsx)' : 'Download Sample Excel (.xlsx)'}</span>
                </button>
              </div>
            </div>

            {/* Parse Error Notification */}
            {parseError && (
              <div style={styles.errorBanner}>
                <AlertCircle size={18} color="#DC2626" />
                <span>{parseError}</span>
              </div>
            )}
          </div>
        ) : (
          /* Step 2: Interactive Preview & Asset Mapping */
          <div>
            {/* Top Stats Banner */}
            <div style={styles.previewStatsBanner}>
              <div style={styles.previewStatItem}>
                <span style={styles.previewStatLabel}>{isHe ? 'סה"כ שורות שזוהו:' : 'Total Tranches:'}</span>
                <strong style={styles.previewStatVal}>{parsedRows.length}</strong>
              </div>
              <div style={styles.previewStatItem}>
                <span style={styles.previewStatLabel}>{isHe ? 'ניירות ערך שונים:' : 'Securities:'}</span>
                <strong style={styles.previewStatVal}>{distinctSymbols.length}</strong>
              </div>
              <div style={styles.previewStatItem}>
                <span style={styles.previewStatLabel}>{isHe ? 'נבחרו לייבוא:' : 'Selected for Import:'}</span>
                <strong style={{ ...styles.previewStatVal, color: '#059669' }}>
                  {totalSelectedCount} / {parsedRows.length}
                </strong>
              </div>
              {duplicatesCount > 0 && (
                <div style={styles.previewStatItem}>
                  <span style={styles.previewStatLabel}>{isHe ? 'כפילויות מזוהות:' : 'Duplicates Found:'}</span>
                  <strong style={{ ...styles.previewStatVal, color: '#D97706' }}>
                    {duplicatesCount}
                  </strong>
                </div>
              )}
            </div>

            {/* Securities Association Cards */}
            <div style={styles.mappingSection}>
              <h3 style={styles.mappingSectionTitle}>
                <Layers size={16} color="#2563EB" />
                <span>{isHe ? 'שיוך ניירות ערך בתיק ההשקעות:' : 'Portfolio Asset Mapping:'}</span>
              </h3>
              <div style={styles.mappingGrid}>
                {distinctSymbols.map((sym) => {
                  const symRows = parsedRows.filter((r) => r.symbol === sym);
                  const firstRow = symRows[0];
                  const currentTarget = targetAssetMap[sym] || 'new_asset';
                  const matchedAsset = investments.find((a) => a.id === currentTarget);

                  return (
                    <div key={sym} style={styles.mappingCard}>
                      <div style={styles.mappingCardHeader}>
                        <div style={styles.mappingSymBadge}>{sym}</div>
                        <div style={styles.mappingCardTitle}>
                          <strong>{firstRow.securityName || sym}</strong>
                          <span style={styles.mappingRowCount}>
                            {symRows.length} {isHe ? 'פעימות רכישה' : 'tranches'}
                          </span>
                        </div>
                      </div>

                      <div style={styles.mappingSelectWrap}>
                        <label style={styles.mappingSelectLabel}>
                          {isHe ? 'שייך לנייר ערך בתיק:' : 'Map to Portfolio Asset:'}
                        </label>
                        <select
                          style={styles.mappingSelect}
                          value={currentTarget}
                          onChange={(e) => handleTargetAssetChange(sym, e.target.value)}
                        >
                          <option value="new_asset">
                            {isHe
                              ? `+ צור נייר ערך חדש אוטומטית בתיק (${sym})`
                              : `+ Auto-create new asset in portfolio (${sym})`}
                          </option>
                          {investments.map((asset) => (
                            <option key={asset.id} value={asset.id}>
                              {asset.ticker} - {asset.name} ({asset.currency === 'USD' ? '$' : '₪'}) [
                              {asset.tranches?.length || 0} {isHe ? 'פעימות קיימות' : 'existing'}]
                            </option>
                          ))}
                        </select>
                      </div>

                      {matchedAsset ? (
                        <div style={styles.matchedAssetNotice}>
                          <CheckCircle2 size={13} color="#059669" />
                          <span>
                            {isHe
                              ? `פעימות יתווספו לנייר הקיים: ${matchedAsset.ticker} (${matchedAsset.name})`
                              : `Tranches will append to existing: ${matchedAsset.ticker}`}
                          </span>
                        </div>
                      ) : (
                        <div style={styles.newAssetNotice}>
                          <Sparkles size={13} color="#2563EB" />
                          <span>
                            {isHe
                              ? `ייפתח נייר ערך חדש בתיק: ${sym} (${firstRow.currency})`
                              : `New asset will be created: ${sym} (${firstRow.currency})`}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selection Toolbar */}
            <div style={styles.previewToolbar}>
              <div style={styles.previewToolbarLeft}>
                <span style={styles.previewTableTitle}>
                  <Calendar size={15} color="#2563EB" />
                  <span>{isHe ? 'פירוט פעימות לרכישה:' : 'Tranche Details:'}</span>
                </span>
              </div>
              <div style={styles.previewToolbarRight}>
                {hasIlsRows && (
                  <button
                    type="button"
                    style={{
                      ...styles.miniToolBtn,
                      color: allIlsInAgorot ? '#2563EB' : '#475569',
                      borderColor: allIlsInAgorot ? '#93C5FD' : '#CBD5E1',
                      backgroundColor: allIlsInAgorot ? '#EFF6FF' : '#FFFFFF',
                      fontWeight: 600,
                    }}
                    onClick={() => toggleAllIlsAgorot(!allIlsInAgorot)}
                    title={
                      isHe
                        ? 'החלף לכל השורות השקליות בין שער באגורות (חלוקה ב-100 לשקלים) לשער ישיר בשקלים'
                        : 'Toggle all ILS rows between Agorot (➗ 100 to ILS) and direct Shekels'
                    }
                  >
                    💱{' '}
                    {isHe
                      ? allIlsInAgorot
                        ? 'שערים שקליים: באגורות (חולקו ב-100 ✓)'
                        : 'שערים שקליים: בשקלים (ללא חלוקה)'
                      : allIlsInAgorot
                      ? 'ILS: in Agorot (➗ 100 ✓)'
                      : 'ILS: in Shekels'}
                  </button>
                )}
                <button type="button" style={styles.miniToolBtn} onClick={handleSelectAll}>
                  {isHe ? 'בחר הכל' : 'Select All'}
                </button>
                {duplicatesCount > 0 && (
                  <button
                    type="button"
                    style={{ ...styles.miniToolBtn, color: '#D97706', borderColor: '#FDE68A' }}
                    onClick={handleSelectNonDuplicates}
                  >
                    {isHe ? 'דלג על כפילויות' : 'Skip Duplicates'}
                  </button>
                )}
                <button type="button" style={styles.miniToolBtn} onClick={handleDeselectAll}>
                  {isHe ? 'נקה בחירה' : 'Deselect All'}
                </button>
              </div>
            </div>

            {/* Table Preview */}
            <div style={styles.tableScrollContainer}>
              <table style={styles.previewTable}>
                <thead>
                  <tr style={styles.previewThRow}>
                    <th style={{ ...styles.previewTh, width: '38px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={totalSelectedCount === parsedRows.length}
                        onChange={(e) => (e.target.checked ? handleSelectAll() : handleDeselectAll())}
                      />
                    </th>
                    <th style={{ ...styles.previewTh, width: '36px', textAlign: 'center' }}>#</th>
                    <th style={{ ...styles.previewTh, minWidth: '95px' }}>{isHe ? 'תאריך רכישה' : 'Date'}</th>
                    <th style={styles.previewTh}>{isHe ? 'נייר / סימבול' : 'Asset'}</th>
                    <th style={styles.previewTh}>{isHe ? 'סוג פעולה' : 'Action'}</th>
                    <th style={{ ...styles.previewTh, textAlign: 'center' }}>{isHe ? 'כמות' : 'Shares'}</th>
                    <th style={{ ...styles.previewTh, textAlign: 'right' }}>{isHe ? 'שער ביצוע' : 'Price'}</th>
                    <th style={{ ...styles.previewTh, textAlign: 'center' }}>{isHe ? 'עמלה' : 'Fee'}</th>
                    <th style={{ ...styles.previewTh, textAlign: 'right' }}>{isHe ? 'סך עלות' : 'Total Cost'}</th>
                    <th style={{ ...styles.previewTh, textAlign: 'center' }}>{isHe ? 'סטטוס' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((r, idx) => {
                    const currSymbol = r.currency === 'USD' ? '$' : '₪';
                    return (
                      <tr
                        key={r.id}
                        style={{
                          ...styles.previewTr,
                          ...(r.selected ? styles.previewTrSelected : {}),
                          ...(r.isDuplicate ? styles.previewTrDuplicate : {}),
                        }}
                        onClick={() => toggleRowSelect(r.id)}
                      >
                        <td style={{ ...styles.previewTd, textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={r.selected}
                            onChange={() => toggleRowSelect(r.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td style={{ ...styles.previewTd, textAlign: 'center', color: '#64748B' }}>
                          {idx + 1}
                        </td>
                        <td style={styles.previewTd}>
                          <strong style={{ color: '#1E293B' }}>{r.rawDate}</strong>
                        </td>
                        <td style={styles.previewTd}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: '700', color: '#0F172A' }}>{r.symbol}</span>
                            <span style={{ fontSize: '0.72rem', color: '#64748B' }}>{r.securityName}</span>
                          </div>
                        </td>
                        <td style={styles.previewTd}>
                          <span style={styles.actionBadge}>{r.action || 'קניה'}</span>
                        </td>
                        <td style={{ ...styles.previewTd, textAlign: 'center', fontWeight: '700' }}>
                          {r.shares}
                        </td>
                        <td style={{ ...styles.previewTd, textAlign: 'right' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                            <span dir="ltr" style={{ direction: 'ltr', display: 'inline-block', fontWeight: '700', color: '#0F172A' }}>
                              {currSymbol}
                              {r.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                            </span>
                            {r.currency === 'ILS' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRowAgorot(r.id);
                                }}
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  border: '1px solid',
                                  borderColor: r.isAgorot ? '#93C5FD' : '#CBD5E1',
                                  backgroundColor: r.isAgorot ? '#EFF6FF' : '#F8FAFC',
                                  color: r.isAgorot ? '#1D4ED8' : '#475569',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                }}
                                title={isHe ? 'לחץ להחלפה בין שער באגורות (חלוקה ב-100) לשער ישיר בשקלים' : 'Toggle Agorot (➗ 100) / Shekels'}
                              >
                                {r.isAgorot ? `${r.rawPrice} אג' (➗ 100)` : 'שער ישיר בש"ח'}
                              </button>
                            )}
                          </div>
                        </td>
                        <td style={{ ...styles.previewTd, textAlign: 'center', color: '#64748B' }}>
                          <span dir="ltr" style={{ direction: 'ltr', display: 'inline-block' }}>
                            {r.fee > 0 ? `${currSymbol}${r.fee.toFixed(2)}` : '-'}
                          </span>
                        </td>
                        <td style={{ ...styles.previewTd, textAlign: 'right', fontWeight: '700' }}>
                          <span dir="ltr" style={{ direction: 'ltr', display: 'inline-block', color: '#0F172A' }}>
                            {currSymbol}
                            {r.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td style={{ ...styles.previewTd, textAlign: 'center' }}>
                          {r.isDuplicate ? (
                            <span style={styles.duplicateBadge}>
                              {isHe ? 'כפילות (קיים)' : 'Duplicate'}
                            </span>
                          ) : (
                            <span style={styles.validBadge}>
                              {isHe ? 'חדש לייבוא' : 'Ready'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Actions Bar */}
            <div style={styles.previewActionsBar}>
              <button
                type="button"
                style={styles.cancelBtn}
                onClick={() => {
                  setParsedRows([]);
                  setFileName(null);
                  setPastedText('');
                }}
              >
                {isHe ? 'בחר קובץ אחר' : 'Choose another file'}
              </button>

              <div style={styles.previewActionsRight}>
                <button type="button" style={styles.secondaryBtn} onClick={onClose}>
                  {isHe ? 'ביטול' : 'Cancel'}
                </button>
                <button
                  type="button"
                  style={styles.importSubmitBtn}
                  onClick={handleExecuteImport}
                  disabled={totalSelectedCount === 0}
                >
                  <Check size={16} />
                  <span>
                    {isHe
                      ? `ייבא ${totalSelectedCount} פעימות לתיק ההשקעות`
                      : `Import ${totalSelectedCount} Tranches`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    zIndex: 9999,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '20px',
    border: '1px solid #E2E8F0',
    width: '100%',
    maxWidth: '920px',
    maxHeight: '92vh',
    overflowY: 'auto',
    padding: '24px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid #F1F5F9',
  },
  modalHeaderTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  modalIconWrap: {
    width: '46px',
    height: '46px',
    borderRadius: '12px',
    backgroundColor: '#EFF6FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  modalHeading: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    margin: '4px 0 0 0',
    fontSize: '0.84rem',
    color: '#64748B',
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748B',
  },
  tabBar: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
    borderBottom: '1px solid #E2E8F0',
    paddingBottom: '8px',
  },
  tabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '10px',
    border: '1px solid transparent',
    backgroundColor: 'transparent',
    color: '#64748B',
    fontWeight: '600',
    fontSize: '0.875rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  tabBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    color: '#2563EB',
    fontWeight: '700',
  },
  dropzone: {
    border: '2px dashed #CBD5E1',
    borderRadius: '16px',
    padding: '36px 20px',
    textAlign: 'center',
    backgroundColor: '#F8FAFC',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropzoneActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  dropzoneIconWrap: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: '#EFF6FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '14px',
  },
  dropzoneTitle: {
    fontSize: '1.05rem',
    fontWeight: '700',
    color: '#1E293B',
    margin: '0 0 6px 0',
  },
  dropzoneSub: {
    fontSize: '0.84rem',
    color: '#64748B',
    maxWidth: '460px',
    margin: '0 0 16px 0',
  },
  browseBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 22px',
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '10px',
    fontWeight: '700',
    fontSize: '0.875rem',
    cursor: 'pointer',
    boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)',
  },
  pasteWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  pasteLabel: {
    fontSize: '0.84rem',
    fontWeight: '600',
    color: '#334155',
  },
  pasteTextarea: {
    width: '100%',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid #CBD5E1',
    fontFamily: 'monospace',
    fontSize: '0.8125rem',
    lineHeight: '1.5',
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    boxSizing: 'border-box',
    resize: 'vertical',
  },
  pasteActions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  parsePasteBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 18px',
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '10px',
    fontWeight: '700',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  infoBox: {
    marginTop: '20px',
    padding: '14px 16px',
    backgroundColor: '#F0F9FF',
    borderRadius: '14px',
    border: '1px solid #BAE6FD',
  },
  infoTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  infoTitle: {
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: '#0369A1',
  },
  infoPills: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginBottom: '12px',
  },
  infoPill: {
    fontSize: '0.72rem',
    fontWeight: '600',
    padding: '3px 8px',
    borderRadius: '6px',
    backgroundColor: '#E0F2FE',
    color: '#0369A1',
    border: '1px solid #BAE6FD',
  },
  templateRow: {
    display: 'flex',
    justifyContent: 'flex-start',
  },
  sampleDownloadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #7DD3FC',
    borderRadius: '8px',
    fontSize: '0.78rem',
    fontWeight: '700',
    color: '#0369A1',
    cursor: 'pointer',
  },
  errorBanner: {
    marginTop: '16px',
    padding: '12px 14px',
    backgroundColor: '#FEE2E2',
    border: '1px solid #FCA5A5',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#B91C1C',
    fontSize: '0.84rem',
  },
  previewStatsBanner: {
    display: 'flex',
    gap: '12px',
    padding: '12px 16px',
    backgroundColor: '#F8FAFC',
    borderRadius: '12px',
    border: '1px solid #E2E8F0',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  previewStatItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.8125rem',
    color: '#475569',
  },
  previewStatLabel: {
    fontWeight: '500',
  },
  previewStatVal: {
    fontWeight: '800',
    color: '#0F172A',
  },
  mappingSection: {
    marginBottom: '18px',
    backgroundColor: '#FAFAF9',
    borderRadius: '14px',
    border: '1px solid #E7E5E4',
    padding: '14px',
  },
  mappingSectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '0.9rem',
    fontWeight: '700',
    color: '#1C1917',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  mappingGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  mappingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '10px',
    border: '1px solid #E2E8F0',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  mappingCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  mappingSymBadge: {
    padding: '4px 10px',
    backgroundColor: '#EFF6FF',
    color: '#2563EB',
    borderRadius: '8px',
    fontWeight: '800',
    fontSize: '0.85rem',
  },
  mappingCardTitle: {
    display: 'flex',
    flexDirection: 'column',
  },
  mappingRowCount: {
    fontSize: '0.75rem',
    color: '#64748B',
  },
  mappingSelectWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  mappingSelectLabel: {
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: '#334155',
  },
  mappingSelect: {
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    fontSize: '0.8125rem',
    backgroundColor: '#FFFFFF',
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
    minWidth: '220px',
  },
  matchedAssetNotice: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.75rem',
    color: '#059669',
    fontWeight: '600',
  },
  newAssetNotice: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.75rem',
    color: '#2563EB',
    fontWeight: '600',
  },
  previewToolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
    flexWrap: 'wrap',
    gap: '8px',
  },
  previewToolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  previewTableTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.875rem',
    fontWeight: '700',
    color: '#1E293B',
  },
  previewToolbarRight: {
    display: 'flex',
    gap: '6px',
  },
  miniToolBtn: {
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid #E2E8F0',
    backgroundColor: '#FFFFFF',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#475569',
    cursor: 'pointer',
  },
  tableScrollContainer: {
    maxHeight: '340px',
    overflowY: 'auto',
    borderRadius: '12px',
    border: '1px solid #E2E8F0',
    marginBottom: '18px',
  },
  previewTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.8125rem',
  },
  previewThRow: {
    backgroundColor: '#F8FAFC',
    position: 'sticky',
    top: 0,
    zIndex: 2,
    borderBottom: '1px solid #E2E8F0',
  },
  previewTh: {
    padding: '10px 12px',
    fontWeight: '700',
    color: '#475569',
    whiteSpace: 'nowrap',
  },
  previewTr: {
    borderBottom: '1px solid #F1F5F9',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  previewTrSelected: {
    backgroundColor: '#F8FAFC',
  },
  previewTrDuplicate: {
    backgroundColor: '#FFFBEB',
  },
  previewTd: {
    padding: '9px 12px',
    verticalAlign: 'middle',
  },
  actionBadge: {
    padding: '2px 8px',
    borderRadius: '6px',
    backgroundColor: '#EFF6FF',
    color: '#2563EB',
    fontSize: '0.72rem',
    fontWeight: '700',
  },
  duplicateBadge: {
    padding: '3px 8px',
    borderRadius: '6px',
    backgroundColor: '#FEF3C7',
    color: '#B45309',
    fontSize: '0.72rem',
    fontWeight: '700',
    display: 'inline-block',
  },
  validBadge: {
    padding: '3px 8px',
    borderRadius: '6px',
    backgroundColor: '#DCFCE7',
    color: '#15803D',
    fontSize: '0.72rem',
    fontWeight: '700',
    display: 'inline-block',
  },
  previewActionsBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    paddingTop: '14px',
    borderTop: '1px solid #F1F5F9',
    flexWrap: 'wrap',
  },
  cancelBtn: {
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    backgroundColor: '#FFFFFF',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: '#475569',
    cursor: 'pointer',
  },
  previewActionsRight: {
    display: 'flex',
    gap: '8px',
  },
  secondaryBtn: {
    padding: '9px 18px',
    borderRadius: '10px',
    border: '1px solid #CBD5E1',
    backgroundColor: '#FFFFFF',
    fontSize: '0.84rem',
    fontWeight: '600',
    color: '#475569',
    cursor: 'pointer',
  },
  importSubmitBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 22px',
    backgroundColor: '#059669',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '10px',
    fontWeight: '700',
    fontSize: '0.875rem',
    cursor: 'pointer',
    boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.25)',
  },
};
