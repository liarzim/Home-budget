import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { InvestmentAsset, InvestmentTranche, SecurityType, InvestmentPeriodicSnapshot, InvestmentSnapshotItem } from '../../lib/types';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronUp,
  Info,
  Calendar,
  Layers,
  ArrowRight,
  Sparkles,
  Download,
  Coins,
  ShieldCheck,
  Scale,
  X,
  FileSpreadsheet,
  Clock,
  CheckCircle2,
  RefreshCw,
  Globe,
  FileDown,
  Check,
  Search,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import { fetchAssetQuote, fetchBatchAssetQuotes, MarketQuoteResult } from '../../lib/quotesService';
import { InvestmentsCharts } from './InvestmentsCharts';
import { InvestmentsSnapshotsTree } from './InvestmentsSnapshotsTree';

export const SECURITY_TYPE_LABELS: Record<SecurityType, { he: string; en: string; icon: string }> = {
  stock: { he: 'מניה', en: 'Stock', icon: '📈' },
  etf: { he: 'קרן סל מחקת מדד', en: 'ETF (Tracker)', icon: '📊' },
  index: { he: 'מדד', en: 'Index', icon: '🎯' },
  mutual_fund: { he: 'קרן נאמנות', en: 'Mutual Fund', icon: '🏦' },
  bond: { he: 'אג״ח ממשלתי / קונצרני', en: 'Government / Corp Bond', icon: '📜' },
  ira_provident: { he: 'קופת גמל / השתלמות מחקה', en: 'IRA / Provident Fund', icon: '🛡️' },
  tbill: { he: 'מק״מ / פיקדון מובנה', en: 'T-Bill / Deposit', icon: '💵' },
  foreign_security: { he: 'נייר ערך זר', en: 'Foreign Security', icon: '🌐' },
  commodity: { he: 'סחורות וזהב', en: 'Commodity / Gold', icon: '🥇' },
  crypto: { he: 'מטבע קריפטוגרפי', en: 'Crypto Asset', icon: '🪙' },
  other: { he: 'נייר ערך אחר', en: 'Other Security', icon: '🏷️' },
};

export const InvestmentsView: React.FC = () => {
  const {
    investments,
    addInvestmentAsset,
    updateInvestmentAsset,
    deleteInvestmentAsset,
    addInvestmentTranche,
    deleteInvestmentTranche,
    clearDemoData,
    restoreDemoData,
    isDemoDataCleared,
    activeHousehold,
    language,
    dir,
  } = useAuth();

  const isHe = language === 'he';

  // Currency view toggle: 'original' | 'ILS' | 'USD'
  const [currencyMode, setCurrencyMode] = useState<'original' | 'ILS' | 'USD'>('original');
  const [usdRate, setUsdRate] = useState<number>(3.70); // 1 USD = 3.70 ILS
  const [isRateEditing, setIsRateEditing] = useState<boolean>(false);

  // Active view tab: 'portfolio' (תיק שוטף) | 'snapshots' (סגירות תקופה ודוחות) | 'charts' (גרפים וניתוח תשואות)
  const [activeSubTab, setActiveSubTab] = useState<'portfolio' | 'snapshots' | 'charts'>('portfolio');

  // Expanded asset rows (to view purchase tranches)
  const [expandedAssetIds, setExpandedAssetIds] = useState<Record<string, boolean>>({});

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'new_asset' | 'add_tranche'>('new_asset');
  const [selectedAssetIdForTranche, setSelectedAssetIdForTranche] = useState<string>('');

  // Snapshot Modal State
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
  const [snapshotPeriodType, setSnapshotPeriodType] = useState<'month' | 'quarter' | 'year' | 'current'>('month');
  const [snapshotLabel, setSnapshotLabel] = useState<string>('');
  const [snapshotDate, setSnapshotDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [snapshotNotes, setSnapshotNotes] = useState<string>('');

  // Form Fields
  const [formTicker, setFormTicker] = useState('');
  const [formSecurityNumber, setFormSecurityNumber] = useState('');
  const [formName, setFormName] = useState('');
  const [formCurrency, setFormCurrency] = useState<'USD' | 'ILS'>('USD');
  const [formAssetType, setFormAssetType] = useState<SecurityType>('stock');
  const [formCurrentPrice, setFormCurrentPrice] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formShares, setFormShares] = useState<string>('');
  const [formPricePerShare, setFormPricePerShare] = useState<string>('');
  const [formTotalCost, setFormTotalCost] = useState<string>('');
  const [formFee, setFormFee] = useState<string>('0');
  const [formNotes, setFormNotes] = useState<string>('');

  // Inline Quick Price Edit
  const [editingPriceAssetId, setEditingPriceAssetId] = useState<string | null>(null);
  const [inlinePriceInput, setInlinePriceInput] = useState<string>('');

  // Info Accordion toggle
  const [isFormulaExpanded, setIsFormulaExpanded] = useState<boolean>(false);

  // Live Quotes Refresh
  const [isRefreshingQuotes, setIsRefreshingQuotes] = useState<boolean>(false);
  const [quotesRefreshMessage, setQuotesRefreshMessage] = useState<string | null>(null);

  // Periodic Market Quote Fetcher (שלב ב' - פנייה לאתרים)
  const [fetchPeriodType, setFetchPeriodType] = useState<'year_end' | 'quarter_end' | 'month_end' | 'current'>('year_end');
  const [fetchYear, setFetchYear] = useState<number>(2025);
  const [fetchQuarter, setFetchQuarter] = useState<number>(4);
  const [fetchMonth, setFetchMonth] = useState<number>(12);
  const [isFetchingPeriodQuotes, setIsFetchingPeriodQuotes] = useState<boolean>(false);
  const [fetchedPeriodResult, setFetchedPeriodResult] = useState<{
    periodLabel: string;
    date: string;
    periodType: 'year' | 'quarter' | 'month' | 'current';
    items: InvestmentSnapshotItem[];
    totalInvested: number;
    totalValue: number;
    totalProfit: number;
    totalReturnPct: number;
  } | null>(null);
  const [fetchPeriodError, setFetchPeriodError] = useState<string | null>(null);
  const [expandedSnapshotId, setExpandedSnapshotId] = useState<string | null>(null);

  // Periodic Snapshots State (stored in localStorage)
  const [snapshots, setSnapshots] = useState<InvestmentPeriodicSnapshot[]>(() => {
    try {
      const saved = localStorage.getItem('household_investment_snapshots');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Purge any mock/sample snapshots automatically
          const userOnlySnapshots = parsed.filter(
            (s: any) =>
              s.id &&
              !s.id.startsWith('snap-2026-') &&
              !s.id.startsWith('snap-2025-') &&
              !s.id.includes('sample')
          );
          if (userOnlySnapshots.length !== parsed.length) {
            localStorage.setItem('household_investment_snapshots', JSON.stringify(userOnlySnapshots));
          }
          return userOnlySnapshots;
        }
      }
    } catch (e) {
      console.error(e);
    }
    // Clean default slate - 0 snapshots by default
    return [];
  });

  const saveSnapshots = (newList: InvestmentPeriodicSnapshot[]) => {
    setSnapshots(newList);
    try {
      localStorage.setItem('household_investment_snapshots', JSON.stringify(newList));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isDemoDataCleared) {
      setSnapshots([]);
    }
  }, [isDemoDataCleared]);

  const toggleExpand = (assetId: string) => {
    setExpandedAssetIds((prev) => ({
      ...prev,
      [assetId]: !prev[assetId],
    }));
  };

  // Helper calculation for an asset
  const calculateAssetMetrics = (asset: InvestmentAsset) => {
    const totalShares = asset.tranches.reduce((sum, tr) => sum + tr.shares, 0);
    const totalCost = asset.tranches.reduce(
      (sum, tr) => sum + tr.shares * tr.price_per_share + (tr.fee || 0),
      0
    );
    const avgPrice = totalShares > 0 ? totalCost / totalShares : 0;
    const currentValue = totalShares * asset.current_price;
    const profit = currentValue - totalCost;
    const returnPct = totalCost > 0 ? (profit / totalCost) * 100 : 0;

    return {
      totalShares,
      totalCost,
      avgPrice,
      currentValue,
      profit,
      returnPct,
    };
  };

  // Portfolio Totals in ILS
  const portfolioSummary = useMemo(() => {
    let totalInvestedILS = 0;
    let currentValueILS = 0;

    investments.forEach((asset) => {
      const { totalCost, currentValue } = calculateAssetMetrics(asset);
      const mult = asset.currency === 'USD' ? usdRate : 1;
      totalInvestedILS += totalCost * mult;
      currentValueILS += currentValue * mult;
    });

    const totalProfitILS = currentValueILS - totalInvestedILS;
    const totalReturnPct = totalInvestedILS > 0 ? (totalProfitILS / totalInvestedILS) * 100 : 0;
    const estimatedTaxILS = Math.max(0, totalProfitILS) * 0.25; // 25% capital gains tax
    const netProfitILS = totalProfitILS - estimatedTaxILS;

    return {
      totalInvestedILS,
      currentValueILS,
      totalProfitILS,
      totalReturnPct,
      estimatedTaxILS,
      netProfitILS,
    };
  }, [investments, usdRate]);

  // Format currency value based on mode
  const formatVal = (amount: number, assetCurrency: 'USD' | 'ILS', forceCurrency?: 'ILS' | 'USD') => {
    const targetCurr = forceCurrency || (currencyMode === 'original' ? assetCurrency : currencyMode);
    let convertedAmount = amount;

    if (currencyMode === 'ILS' && assetCurrency === 'USD') {
      convertedAmount = amount * usdRate;
    } else if (currencyMode === 'USD' && assetCurrency === 'ILS') {
      convertedAmount = amount / (usdRate || 1);
    }

    const symbol = targetCurr === 'USD' ? '$' : '₪';
    return `${symbol}${convertedAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Synchronize price per share and total cost in form
  const handleSharesChange = (val: string) => {
    setFormShares(val);
    const s = parseFloat(val);
    const p = parseFloat(formPricePerShare);
    const f = parseFloat(formFee) || 0;
    if (s > 0 && p >= 0) {
      setFormTotalCost((s * p + f).toFixed(2));
    }
  };

  const handlePricePerShareChange = (val: string) => {
    setFormPricePerShare(val);
    const s = parseFloat(formShares);
    const p = parseFloat(val);
    const f = parseFloat(formFee) || 0;
    if (s > 0 && p >= 0) {
      setFormTotalCost((s * p + f).toFixed(2));
    }
  };

  const handleTotalCostChange = (val: string) => {
    setFormTotalCost(val);
    const s = parseFloat(formShares);
    const total = parseFloat(val);
    const f = parseFloat(formFee) || 0;
    if (s > 0 && total >= 0) {
      const unitPrice = Math.max(0, (total - f) / s);
      setFormPricePerShare(unitPrice.toFixed(2));
    }
  };

  const handleOpenAddModal = (mode: 'new_asset' | 'add_tranche', asset?: InvestmentAsset) => {
    setModalMode(mode);
    if (mode === 'add_tranche' && asset) {
      setSelectedAssetIdForTranche(asset.id);
      setFormTicker(asset.ticker);
      setFormSecurityNumber(asset.security_number || '');
      setFormName(asset.name);
      setFormCurrency(asset.currency);
      setFormCurrentPrice(asset.current_price.toString());
      setFormAssetType(asset.asset_type);
    } else {
      setSelectedAssetIdForTranche('');
      setFormTicker('');
      setFormSecurityNumber('');
      setFormName('');
      setFormCurrency('USD');
      setFormAssetType('stock');
      setFormCurrentPrice('');
    }
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormShares('');
    setFormPricePerShare('');
    setFormTotalCost('');
    setFormFee('0');
    setFormNotes('');
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sharesNum = parseFloat(formShares);
    const priceNum = parseFloat(formPricePerShare);
    const feeNum = parseFloat(formFee) || 0;
    const currentPriceNum = parseFloat(formCurrentPrice) || priceNum;
    const totalCostNum = parseFloat(formTotalCost) || (sharesNum * priceNum + feeNum);

    if (isNaN(sharesNum) || sharesNum <= 0 || isNaN(priceNum) || priceNum < 0) {
      alert(isHe ? 'אנא הזן כמות מניות ומחיר רכישה תקינים' : 'Please enter valid shares and price');
      return;
    }

    if (modalMode === 'new_asset') {
      if (!formTicker.trim()) {
        alert(isHe ? 'אנא הזן סימול נייר' : 'Please enter a ticker');
        return;
      }
      addInvestmentAsset({
        household_id: activeHousehold?.id || 'hh-main',
        ticker: formTicker.trim().toUpperCase(),
        security_number: formSecurityNumber.trim() || undefined,
        name: formName.trim() || formTicker.trim().toUpperCase(),
        currency: formCurrency,
        current_price: currentPriceNum,
        asset_type: formAssetType,
        target_allocation_pct: 0,
        tranches: [
          {
            id: `tr-${Date.now()}`,
            date: formDate,
            shares: sharesNum,
            price_per_share: priceNum,
            total_cost: totalCostNum,
            fee: feeNum,
            notes: formNotes.trim() || undefined,
          },
        ],
      });
    } else if (modalMode === 'add_tranche' && selectedAssetIdForTranche) {
      addInvestmentTranche(selectedAssetIdForTranche, {
        date: formDate,
        shares: sharesNum,
        price_per_share: priceNum,
        total_cost: totalCostNum,
        fee: feeNum,
        notes: formNotes.trim() || undefined,
      });
      if (!isNaN(currentPriceNum) && currentPriceNum > 0) {
        updateInvestmentAsset(selectedAssetIdForTranche, { current_price: currentPriceNum });
      }
    }

    setIsModalOpen(false);
  };

  const handleSaveInlinePrice = (assetId: string) => {
    const num = parseFloat(inlinePriceInput);
    if (!isNaN(num) && num > 0) {
      updateInvestmentAsset(assetId, { current_price: num });
    }
    setEditingPriceAssetId(null);
  };

  // Export current state to CSV / Excel (with UTF-8 BOM)
  const handleExportCurrentStateCSV = () => {
    const BOM = '\uFEFF';
    const headers = [
      'סימול נייר',
      'מספר נייר',
      'שם נייר / חברה',
      'סוג נייר',
      'מטבע',
      'כמות כוללת',
      'מחיר קנייה ממוצע',
      'סך עלות רכישה',
      'שער שוק נוכחי',
      'שווי נוכחי',
      'רווח / הפסד נקודתי',
      'תשואה נקודתית (%)',
      'מספר פעימות',
      'תאריך דוח',
    ];

    const rows = investments.map((asset) => {
      const { totalShares, totalCost, avgPrice, currentValue, profit, returnPct } =
        calculateAssetMetrics(asset);
      const typeLabel = SECURITY_TYPE_LABELS[asset.asset_type]?.he || asset.asset_type;

      return [
        `"${asset.ticker}"`,
        `"${asset.security_number || '—'}"`,
        `"${asset.name}"`,
        `"${typeLabel}"`,
        `"${asset.currency}"`,
        totalShares,
        avgPrice.toFixed(2),
        totalCost.toFixed(2),
        asset.current_price.toFixed(2),
        currentValue.toFixed(2),
        profit.toFixed(2),
        `${returnPct.toFixed(2)}%`,
        asset.tranches.length,
        `"${new Date().toLocaleDateString('he-IL')}"`,
      ].join(',');
    });

    // Summary line
    const summaryRow = [
      '"סה״כ תיק"',
      '""',
      '""',
      '""',
      '"ILS"',
      '""',
      '""',
      portfolioSummary.totalInvestedILS.toFixed(2),
      '""',
      portfolioSummary.currentValueILS.toFixed(2),
      portfolioSummary.totalProfitILS.toFixed(2),
      `${portfolioSummary.totalReturnPct.toFixed(2)}%`,
      '""',
      `"${new Date().toLocaleDateString('he-IL')}"`,
    ].join(',');

    const csvContent = BOM + headers.join(',') + '\n' + rows.join('\n') + '\n' + summaryRow;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `investment_portfolio_snapshot_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1. Live Quotes Refresh Handler (main screen)
  const handleRefreshLiveQuotes = async () => {
    if (investments.length === 0) return;
    setIsRefreshingQuotes(true);
    setQuotesRefreshMessage(null);
    try {
      const resultsMap = await fetchBatchAssetQuotes(investments, { periodType: 'current' });
      let updatedCount = 0;
      investments.forEach((asset) => {
        const res = resultsMap.get(asset.id);
        if (res && res.success && res.price > 0) {
          updateInvestmentAsset(asset.id, { current_price: res.price });
          updatedCount++;
        }
      });
      setQuotesRefreshMessage(
        isHe
          ? `✓ עודכנו בהצלחה ${updatedCount} ניירות לפי שערי שוק עדכניים מאתרי הבורסה!`
          : `✓ Successfully updated ${updatedCount} assets from market sources!`
      );
      setTimeout(() => setQuotesRefreshMessage(null), 6000);
    } catch (e) {
      console.error(e);
      setQuotesRefreshMessage(
        isHe
          ? 'שגיאה במשיכת נתונים מהאתר. אנא נסה שוב מאוחר יותר.'
          : 'Failed to fetch live quotes. Please try again.'
      );
      setTimeout(() => setQuotesRefreshMessage(null), 5000);
    } finally {
      setIsRefreshingQuotes(false);
    }
  };

  // 2. Historical Period Market Quote Fetcher (שלב ב' - פנייה לאתרים בסוף חודש/רבעון/שנה)
  const handleFetchPeriodQuotes = async () => {
    if (investments.length === 0) {
      alert(isHe ? 'אין ניירות ערך בתיק למשיכת נתונים' : 'No assets in portfolio');
      return;
    }

    setIsFetchingPeriodQuotes(true);
    setFetchPeriodError(null);
    setFetchedPeriodResult(null);

    try {
      const resultsMap = await fetchBatchAssetQuotes(investments, {
        periodType: fetchPeriodType,
        year: fetchYear,
        month: fetchMonth,
        quarter: fetchQuarter,
      });

      // Construct descriptive period label
      let periodLabel = '';
      const monthNamesHe = [
        '', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
        'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
      ];
      if (fetchPeriodType === 'year_end') {
        periodLabel = `סיום שנת ${fetchYear} (סוף דצמבר)`;
      } else if (fetchPeriodType === 'quarter_end') {
        const qEnds = ['', 'סוף מרץ', 'סוף יוני', 'סוף ספטמבר', 'סוף דצמבר'];
        periodLabel = `סיום רבעון Q${fetchQuarter} ${fetchYear} (${qEnds[fetchQuarter]})`;
      } else if (fetchPeriodType === 'month_end') {
        periodLabel = `סיום חודש ${monthNamesHe[fetchMonth] || fetchMonth} ${fetchYear}`;
      } else {
        periodLabel = `ציטוט שוק נוכחי (${new Date().toLocaleDateString('he-IL')})`;
      }

      let totalInvestedILS = 0;
      let totalValueILS = 0;
      let latestDateFound = '';

      const items: InvestmentSnapshotItem[] = investments.map((asset) => {
        const quote = resultsMap.get(asset.id);
        const { totalShares, totalCost, avgPrice } = calculateAssetMetrics(asset);
        const priceToUse = quote && quote.success && quote.price > 0 ? quote.price : asset.current_price;
        const quoteDate = quote?.date || new Date().toISOString().split('T')[0];
        if (quoteDate && (!latestDateFound || quoteDate > latestDateFound)) {
          latestDateFound = quoteDate;
        }

        const val = totalShares * priceToUse;
        const profit = val - totalCost;
        const returnPct = totalCost > 0 ? (profit / totalCost) * 100 : 0;

        const mult = asset.currency === 'USD' ? usdRate : 1;
        totalInvestedILS += totalCost * mult;
        totalValueILS += val * mult;

        return {
          asset_id: asset.id,
          ticker: asset.ticker,
          security_number: asset.security_number,
          name: asset.name,
          currency: asset.currency,
          shares: totalShares,
          avg_cost_price: avgPrice,
          total_cost: totalCost,
          market_price: priceToUse,
          market_value: val,
          profit,
          return_pct: returnPct,
          quote_date: quoteDate,
          quote_source: quote?.source || 'ברירת מחדל תיק',
        };
      });

      const totalProfitILS = totalValueILS - totalInvestedILS;
      const totalReturnPct = totalInvestedILS > 0 ? (totalProfitILS / totalInvestedILS) * 100 : 0;

      setFetchedPeriodResult({
        periodLabel,
        date: latestDateFound || new Date().toISOString().split('T')[0],
        periodType: fetchPeriodType === 'year_end' ? 'year' : fetchPeriodType === 'quarter_end' ? 'quarter' : fetchPeriodType === 'month_end' ? 'month' : 'current',
        items,
        totalInvested: totalInvestedILS,
        totalValue: totalValueILS,
        totalProfit: totalProfitILS,
        totalReturnPct,
      });
    } catch (e: any) {
      console.error(e);
      setFetchPeriodError(e?.message || (isHe ? 'שגיאה בפנייה לאתרי השוק' : 'Failed to fetch quotes'));
    } finally {
      setIsFetchingPeriodQuotes(false);
    }
  };

  // 3. Save the fetched periodic snapshot into snapshots state
  const handleSaveFetchedPeriodResult = () => {
    if (!fetchedPeriodResult) return;

    const newSnapshot: InvestmentPeriodicSnapshot = {
      id: `snap-${Date.now()}`,
      household_id: activeHousehold?.id || 'hh-main',
      period_type: fetchedPeriodResult.periodType,
      period_label: fetchedPeriodResult.periodLabel,
      date: fetchedPeriodResult.date,
      total_invested: fetchedPeriodResult.totalInvested,
      total_value: fetchedPeriodResult.totalValue,
      total_profit: fetchedPeriodResult.totalProfit,
      total_return_pct: fetchedPeriodResult.totalReturnPct,
      assets_count: fetchedPeriodResult.items.length,
      items: fetchedPeriodResult.items,
      notes: `נמשך אוטומטית מאתרי הבורסה (${fetchedPeriodResult.periodLabel})`,
    };

    saveSnapshots([newSnapshot, ...snapshots]);
    alert(isHe ? 'צילום המצב נשמר בהצלחה בהיסטוריית התיק!' : 'Snapshot saved successfully!');
  };

  // 4. Export detailed periodic snapshot to CSV (with Hebrew UTF-8 BOM)
  const handleExportFetchedPeriodCSV = (result: {
    periodLabel: string;
    date: string;
    items: InvestmentSnapshotItem[];
    totalInvested: number;
    totalValue: number;
    totalProfit: number;
    totalReturnPct: number;
  }) => {
    if (!result) return;
    const BOM = '\uFEFF';
    const headers = [
      'סימול נייר',
      'מספר נייר',
      'שם נייר / חברה',
      'מטבע',
      'כמות כוללת',
      'מחיר קנייה ממוצע',
      'סך עלות רכישה',
      'שער סגירה בתקופה שנמשך',
      'תאריך יום מסחר',
      'מקור הציטוט (אתר)',
      'שווי במועד זה',
      'רווח / הפסד נקודתי',
      'תשואה נקודתית (%)',
      'שם תקופה',
    ];

    const rows = result.items.map((item) => [
      `"${item.ticker}"`,
      `"${item.security_number || '—'}"`,
      `"${item.name}"`,
      `"${item.currency}"`,
      item.shares,
      item.avg_cost_price.toFixed(2),
      item.total_cost.toFixed(2),
      item.market_price.toFixed(2),
      `"${item.quote_date || ''}"`,
      `"${item.quote_source || ''}"`,
      item.market_value.toFixed(2),
      item.profit.toFixed(2),
      `${item.return_pct.toFixed(2)}%`,
      `"${result.periodLabel}"`,
    ].join(','));

    const summaryRow = [
      '"סה״כ תיק (בשקלים)"',
      '""',
      '""',
      '"ILS"',
      '""',
      '""',
      result.totalInvested.toFixed(2),
      '""',
      `"${result.date}"`,
      '"ציטוטי שוק"',
      result.totalValue.toFixed(2),
      result.totalProfit.toFixed(2),
      `${result.totalReturnPct.toFixed(2)}%`,
      `"${result.periodLabel}"`,
    ].join(',');

    const csvContent = BOM + headers.join(',') + '\n' + rows.join('\n') + '\n' + summaryRow;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const sanitizedLabel = result.periodLabel.replace(/[\/\s:()]+/g, '_');
    link.setAttribute('download', `snapshot_${sanitizedLabel}_${result.date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 5. Export previously saved snapshot to CSV
  const handleExportSavedSnapshotCSV = (snap: InvestmentPeriodicSnapshot) => {
    if (snap.items && snap.items.length > 0) {
      handleExportFetchedPeriodCSV({
        periodLabel: snap.period_label,
        date: snap.date,
        items: snap.items,
        totalInvested: snap.total_invested,
        totalValue: snap.total_value,
        totalProfit: snap.total_profit,
        totalReturnPct: snap.total_return_pct,
      });
    } else {
      handleExportCurrentStateCSV();
    }
  };

  // Open Snapshot Modal with dynamic label default
  const handleOpenSnapshotModal = (type: 'month' | 'quarter' | 'year' | 'current') => {
    setSnapshotPeriodType(type);
    const now = new Date();
    const currentMonth = now.toLocaleString('he-IL', { month: 'long' });
    const currentQuarter = `Q${Math.floor(now.getMonth() / 3) + 1}`;
    const currentYear = now.getFullYear();

    if (type === 'month') {
      setSnapshotLabel(`סיום חודש ${currentMonth} ${currentYear}`);
    } else if (type === 'quarter') {
      setSnapshotLabel(`סיום רבעון ${currentQuarter} ${currentYear}`);
    } else if (type === 'year') {
      setSnapshotLabel(`סיום שנת ${currentYear}`);
    } else {
      setSnapshotLabel(`צילום מצב נקודתי - ${now.toLocaleDateString('he-IL')}`);
    }

    setSnapshotDate(now.toISOString().split('T')[0]);
    setSnapshotNotes('');
    setIsSnapshotModalOpen(true);
  };

  const handleSaveSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapshotLabel.trim()) {
      alert(isHe ? 'אנא הזן תיאור לתקופה' : 'Please enter period label');
      return;
    }

    const newSnapshot: InvestmentPeriodicSnapshot = {
      id: `snap-${Date.now()}`,
      household_id: activeHousehold?.id || 'hh-main',
      period_type: snapshotPeriodType,
      period_label: snapshotLabel.trim(),
      date: snapshotDate,
      total_invested: portfolioSummary.totalInvestedILS,
      total_value: portfolioSummary.currentValueILS,
      total_profit: portfolioSummary.totalProfitILS,
      total_return_pct: portfolioSummary.totalReturnPct,
      assets_count: investments.length,
      notes: snapshotNotes.trim() || undefined,
    };

    saveSnapshots([newSnapshot, ...snapshots]);
    setIsSnapshotModalOpen(false);
    setActiveSubTab('snapshots');
  };

  const handleDeleteSnapshot = (id: string) => {
    if (confirm(isHe ? 'האם למחוק צילום מצב זה?' : 'Delete this snapshot?')) {
      saveSnapshots(snapshots.filter((s) => s.id !== id));
    }
  };

  const handleQuickFetchFromTree = (
    type: 'year_end' | 'quarter_end' | 'month_end',
    year: number,
    quarter?: number,
    month?: number
  ) => {
    setFetchPeriodType(type);
    setFetchYear(year);
    if (quarter) setFetchQuarter(quarter);
    if (month) setFetchMonth(month);
    setActiveSubTab('snapshots');
    setTimeout(() => {
      const el = document.getElementById('market-quotes-fetcher-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  return (
    <div style={styles.container} dir={dir}>
      {/* Top Header */}
      <div style={styles.headerRow}>
        <div>
          <div style={styles.badgeRow}>
            <div style={styles.topicBadge}>
              <TrendingUp size={14} color="#2563EB" />
              <span>{isHe ? 'שוק ההון והשקעות' : 'Capital Markets & Wealth'}</span>
            </div>
          </div>
          <h1 style={styles.title}>
            {isHe ? 'ביצועי תיק השקעות' : 'Investment Portfolio & Yield'}
          </h1>
          <p style={styles.subtitle}>
            {isHe
              ? 'ניהול סימול, מספר נייר, סוג נכס, פעימות רכישה, שווי שוק נוכחי, והורדת צילומי מצב תקופתיים (חודש / רבעון / שנה).'
              : 'Track tickers, security numbers, asset types, purchase tranches, live market valuation, and periodic snapshots.'}
          </p>
        </div>

        {/* Action Controls */}
        <div style={styles.headerActions}>
          {/* Download Current State (שלב ב') */}
          <button
            style={styles.exportCurrentBtn}
            onClick={handleExportCurrentStateCSV}
            title={isHe ? 'הורד קובץ מצב כל נייר בנקודה הנוכחית' : 'Download current portfolio status'}
          >
            <Download size={15} color="#2563EB" />
            <span>{isHe ? 'הורד מצב תיק (Excel)' : 'Export CSV'}</span>
          </button>

          {/* Currency Display Filter */}
          <div style={styles.currencyToggleGroup}>
            <button
              style={{
                ...styles.toggleBtn,
                ...(currencyMode === 'original' ? styles.toggleBtnActive : {}),
              }}
              onClick={() => setCurrencyMode('original')}
            >
              {isHe ? 'מטבע מקור' : 'Original'}
            </button>
            <button
              style={{
                ...styles.toggleBtn,
                ...(currencyMode === 'ILS' ? styles.toggleBtnActive : {}),
              }}
              onClick={() => setCurrencyMode('ILS')}
            >
              ₪ שקלים
            </button>
            <button
              style={{
                ...styles.toggleBtn,
                ...(currencyMode === 'USD' ? styles.toggleBtnActive : {}),
              }}
              onClick={() => setCurrencyMode('USD')}
            >
              $ דולרים
            </button>
          </div>

          {/* USD Exchange Rate Setting */}
          <div style={styles.usdRateBox}>
            <span style={styles.usdRateLabel}>1$ =</span>
            {isRateEditing ? (
              <input
                type="number"
                step="0.01"
                value={usdRate}
                onChange={(e) => setUsdRate(parseFloat(e.target.value) || 3.7)}
                onBlur={() => setIsRateEditing(false)}
                autoFocus
                style={styles.usdRateInput}
              />
            ) : (
              <button
                style={styles.usdRatePill}
                onClick={() => setIsRateEditing(true)}
                title={isHe ? 'לחץ לעדכון שער הדולר' : 'Click to edit USD rate'}
              >
                <span>₪{usdRate.toFixed(2)}</span>
                <Edit2 size={11} color="var(--text-secondary)" />
              </button>
            )}
          </div>

          {/* Live Market Quotes Refresh Button */}
          <button
            style={{
              ...styles.refreshQuotesBtn,
              ...(isRefreshingQuotes ? styles.refreshQuotesBtnLoading : {}),
            }}
            onClick={handleRefreshLiveQuotes}
            disabled={isRefreshingQuotes}
            title={isHe ? 'פנה לאתרים (Yahoo Finance / ביזפורטל) ומשוך שער שוק עדכני' : 'Fetch live market quotes'}
          >
            <RefreshCw size={15} color="#059669" className={isRefreshingQuotes ? 'spin-icon' : ''} />
            <span>{isRefreshingQuotes ? (isHe ? 'מעדכן שערים...' : 'Fetching...') : (isHe ? 'רענן שערי שוק' : 'Live Quotes')}</span>
          </button>

          {/* Clear / Restore Demo Data Button */}
          <button
            style={isDemoDataCleared ? styles.restoreDemoBtn : styles.clearDemoBtn}
            onClick={() => {
              if (isDemoDataCleared) {
                if (confirm(isHe ? 'האם לשחזר את נתוני הדמו להדגמה?' : 'Restore demo data?')) {
                  restoreDemoData();
                }
              } else {
                if (confirm(isHe ? 'האם לנקות את כל נתוני הדמו מהמערכת (כולל עסקאות, תיק השקעות, תקציבים וחסכונות) ולהתחיל מלוח נקי לחלוטין?' : 'Clear all demo data and start fresh?')) {
                  clearDemoData();
                  setSnapshots([]);
                }
              }
            }}
            title={
              isDemoDataCleared
                ? (isHe ? 'שחזר נתוני דמו לדוגמה' : 'Restore demo data')
                : (isHe ? 'נקה את כל נתוני הדמו מהמערכת והתחל מלוח חלק' : 'Clear demo data')
            }
          >
            {isDemoDataCleared ? (
              <>
                <RotateCcw size={15} color="#2563EB" />
                <span>{isHe ? 'שחזר דמו' : 'Restore Demo'}</span>
              </>
            ) : (
              <>
                <Trash2 size={15} color="#DC2626" />
                <span>{isHe ? 'נקה נתוני דמו' : 'Clear Demo'}</span>
              </>
            )}
          </button>

          {/* Add New Stock / Tranche Button */}
          <button
            style={styles.addAssetBtn}
            onClick={() => handleOpenAddModal('new_asset')}
          >
            <Plus size={16} color="#FFFFFF" />
            <span>{isHe ? '+ הוסף נייר ערך' : '+ Add Asset'}</span>
          </button>
        </div>
      </div>

      {/* Live Refresh Status Banner */}
      {quotesRefreshMessage && (
        <div style={styles.quotesBanner} className="animate-fade-in">
          <Check size={16} color="#059669" />
          <span>{quotesRefreshMessage}</span>
        </div>
      )}

      {/* Aggregate Portfolio KPI Cards */}
      <div style={styles.kpiGrid}>
        {/* Card 1: Total Cost */}
        <div style={styles.kpiCard}>
          <div style={styles.kpiTopRow}>
            <span style={styles.kpiLabel}>
              {isHe ? 'סך עלות ההשקעה' : 'Total Cost Basis'}
            </span>
            <div style={{ ...styles.kpiIconWrap, backgroundColor: '#EFF6FF' }}>
              <Coins size={18} color="#2563EB" />
            </div>
          </div>
          <div style={styles.kpiMainValue}>
            ₪{portfolioSummary.totalInvestedILS.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <div style={styles.kpiSubText}>
            {isHe ? 'סך כל פעימות הרכישה כולל עמלות' : 'Sum of all purchase tranches + fees'}
          </div>
        </div>

        {/* Card 2: Current Portfolio Value */}
        <div style={styles.kpiCard}>
          <div style={styles.kpiTopRow}>
            <span style={styles.kpiLabel}>
              {isHe ? 'שווי שוק נוכחי (ערך נוכחי)' : 'Current Market Value'}
            </span>
            <div style={{ ...styles.kpiIconWrap, backgroundColor: '#F0FDF4' }}>
              <DollarSign size={18} color="#16A34A" />
            </div>
          </div>
          <div style={{ ...styles.kpiMainValue, color: '#0F172A' }}>
            ₪{portfolioSummary.currentValueILS.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <div style={styles.kpiSubText}>
            {isHe ? 'מבוסס על שערי השוק המעודכנים' : 'Based on latest market prices'}
          </div>
        </div>

        {/* Card 3: Total Profit & Yield */}
        <div style={styles.kpiCard}>
          <div style={styles.kpiTopRow}>
            <span style={styles.kpiLabel}>
              {isHe ? 'רווח/הפסד כולל (P&L)' : 'Total Gain / Loss'}
            </span>
            <div
              style={{
                ...styles.kpiIconWrap,
                backgroundColor: portfolioSummary.totalProfitILS >= 0 ? '#ECFDF5' : '#FEF2F2',
              }}
            >
              {portfolioSummary.totalProfitILS >= 0 ? (
                <TrendingUp size={18} color="#059669" />
              ) : (
                <TrendingDown size={18} color="#DC2626" />
              )}
            </div>
          </div>
          <div
            style={{
              ...styles.kpiMainValue,
              color: portfolioSummary.totalProfitILS >= 0 ? '#059669' : '#DC2626',
            }}
          >
            {portfolioSummary.totalProfitILS >= 0 ? '+' : ''}
            ₪{portfolioSummary.totalProfitILS.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <div style={styles.kpiBadgeYieldRow}>
            <span
              style={{
                ...styles.yieldPill,
                backgroundColor: portfolioSummary.totalProfitILS >= 0 ? '#DCFCE7' : '#FEE2E2',
                color: portfolioSummary.totalProfitILS >= 0 ? '#15803D' : '#B91C1C',
              }}
            >
              {portfolioSummary.totalProfitILS >= 0 ? '+' : ''}
              {portfolioSummary.totalReturnPct.toFixed(2)}%
            </span>
            <span style={styles.kpiSubText}>
              {isHe ? 'תשואה משוקללת' : 'Total Return'}
            </span>
          </div>
        </div>

        {/* Card 4: Estimated Tax (25% in Israel) */}
        <div style={styles.kpiCard}>
          <div style={styles.kpiTopRow}>
            <span style={styles.kpiLabel}>
              {isHe ? 'מס רווחי הון משוער (25%)' : 'Est. Capital Gains Tax'}
            </span>
            <div style={{ ...styles.kpiIconWrap, backgroundColor: '#FEF3C7' }}>
              <Scale size={18} color="#D97706" />
            </div>
          </div>
          <div style={{ ...styles.kpiMainValue, color: '#B45309' }}>
            ₪{portfolioSummary.estimatedTaxILS.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <div style={styles.kpiSubText}>
            {isHe
              ? `רווח נקי משוער לאחר מס: ₪${portfolioSummary.netProfitILS.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
              : `Net after tax: ₪${portfolioSummary.netProfitILS.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          </div>
        </div>
      </div>

      {/* Sub Tabs: Active Portfolio vs Periodic Snapshots (שלב ב') */}
      <div style={styles.subTabNav}>
        <button
          style={{
            ...styles.subTabBtn,
            ...(activeSubTab === 'portfolio' ? styles.subTabBtnActive : {}),
          }}
          onClick={() => setActiveSubTab('portfolio')}
        >
          <Layers size={16} />
          <span>{isHe ? 'ניירות ערך ופוזיציות פעילות' : 'Active Holdings & Tranches'}</span>
          <span style={styles.subTabCountPill}>{investments.length}</span>
        </button>

        <button
          style={{
            ...styles.subTabBtn,
            ...(activeSubTab === 'snapshots' ? styles.subTabBtnActive : {}),
          }}
          onClick={() => setActiveSubTab('snapshots')}
        >
          <Clock size={16} />
          <span>{isHe ? 'עץ סגירות תקופה (שנה / רבעון / חודש)' : 'Periodic Snapshots Tree'}</span>
          <span style={styles.subTabCountPill}>{snapshots.length}</span>
        </button>

        <button
          style={{
            ...styles.subTabBtn,
            ...(activeSubTab === 'charts' ? styles.subTabBtnActive : {}),
          }}
          onClick={() => setActiveSubTab('charts')}
        >
          <TrendingUp size={16} />
          <span>{isHe ? 'גרפים ומדדי תשואה (שווי מול עלות)' : 'Charts & Performance'}</span>
          <span style={{ ...styles.subTabCountPill, backgroundColor: '#FEF08A', color: '#854D0E' }}>
            {isHe ? 'חדש' : 'New'}
          </span>
        </button>
      </div>

      {/* TAB 1: ACTIVE HOLDINGS TABLE */}
      {activeSubTab === 'portfolio' && (
        <>
          {/* Main Assets Table */}
          <div style={styles.tableCard}>
            <div style={styles.tableHeaderBar}>
              <div style={styles.tableTitleGroup}>
                <Layers size={18} color="#2563EB" />
                <h3 style={styles.tableTitle}>
                  {isHe ? 'פירוט ניירות ערך ופוזיציות' : 'Holdings & Positions'}
                </h3>
                <span style={styles.assetCountBadge}>
                  {investments.length} {isHe ? 'ניירות' : 'Assets'}
                </span>
              </div>

              <div style={styles.tableRightActions}>
                <div style={styles.tableLegend}>
                  <span style={styles.legendItem}>
                    <span style={{ ...styles.legendDot, backgroundColor: '#059669' }} />
                    {isHe ? 'רווח' : 'Gain'}
                  </span>
                  <span style={styles.legendItem}>
                    <span style={{ ...styles.legendDot, backgroundColor: '#DC2626' }} />
                    {isHe ? 'הפסד' : 'Loss'}
                  </span>
                </div>
                <button
                  style={styles.exportSmallBtn}
                  onClick={handleExportCurrentStateCSV}
                  title={isHe ? 'הורד קובץ CSV של מצב התיק הנוכחי' : 'Download CSV'}
                >
                  <Download size={13} color="var(--primary)" />
                  <span>{isHe ? 'הורדת דוח (CSV)' : 'Export CSV'}</span>
                </button>
              </div>
            </div>

            <div style={styles.tableResponsiveWrap}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.thRow}>
                    <th style={styles.thCell}>{isHe ? 'סימול / שם נייר' : 'Ticker / Asset'}</th>
                    <th style={styles.thCell}>{isHe ? 'מספר נייר' : 'Security No.'}</th>
                    <th style={styles.thCell}>{isHe ? 'סוג נייר' : 'Asset Type'}</th>
                    <th style={styles.thCell}>{isHe ? 'כמות מניות' : 'Quantity'}</th>
                    <th style={styles.thCell}>{isHe ? 'מחיר קנייה ממוצע' : 'Avg. Cost'}</th>
                    <th style={styles.thCell}>{isHe ? 'שער נוכחי (ערך נוכחי)' : 'Market Price'}</th>
                    <th style={styles.thCell}>{isHe ? 'סך עלות רכישה' : 'Total Cost'}</th>
                    <th style={styles.thCell}>{isHe ? 'שווי נוכחי' : 'Current Value'}</th>
                    <th style={styles.thCell}>{isHe ? 'רווח / הפסד' : 'P&L'}</th>
                    <th style={styles.thCell}>{isHe ? 'תשואה' : 'Yield'}</th>
                    <th style={{ ...styles.thCell, textAlign: 'center' }}>{isHe ? 'פעימות' : 'Tranches'}</th>
                    <th style={{ ...styles.thCell, textAlign: 'center' }}>{isHe ? 'פעולות' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {investments.length === 0 ? (
                    <tr>
                      <td colSpan={12} style={styles.emptyTd}>
                        <div style={styles.emptyBox}>
                          <Coins size={36} color="var(--text-muted)" />
                          <div style={styles.emptyTitle}>
                            {isHe ? 'אין עדיין ניירות ערך בתיק' : 'No investment holdings yet'}
                          </div>
                          <p style={styles.emptySub}>
                            {isHe
                              ? 'לחץ על "+ הוסף נייר ערך" כדי להתחיל לעקוב אחרי המניות, קרנות הסל והמדדים שלך.'
                              : 'Click "+ Add Asset" to track stocks, ETFs, indices and tranches.'}
                          </p>
                          <button
                            style={styles.addAssetBtn}
                            onClick={() => handleOpenAddModal('new_asset')}
                          >
                            <Plus size={15} color="#FFFFFF" />
                            <span>{isHe ? 'הוסף נייר ערך ראשון' : 'Add First Asset'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    investments.map((asset) => {
                      const metrics = calculateAssetMetrics(asset);
                      const isExpanded = Boolean(expandedAssetIds[asset.id]);
                      const isProfit = metrics.profit >= 0;
                      const typeConfig = SECURITY_TYPE_LABELS[asset.asset_type] || {
                        he: asset.asset_type,
                        en: asset.asset_type,
                        icon: '🏷️',
                      };

                      return (
                        <React.Fragment key={asset.id}>
                          <tr
                            style={{
                              ...styles.trRow,
                              backgroundColor: isExpanded
                                ? 'var(--bg-surface-subtle, #F8FAFC)'
                                : 'transparent',
                            }}
                          >
                            {/* Ticker & Name */}
                            <td style={styles.tdCell}>
                              <div style={styles.assetNameBlock}>
                                <div style={styles.tickerPill}>{asset.ticker}</div>
                                <div>
                                  <div style={styles.assetFullName}>{asset.name}</div>
                                  <span style={styles.currencyTag}>{asset.currency}</span>
                                </div>
                              </div>
                            </td>

                            {/* Security Number (מספר נייר) */}
                            <td style={styles.tdCell}>
                              <span style={styles.securityNumberBadge}>
                                {asset.security_number || '—'}
                              </span>
                            </td>

                            {/* Asset Type (סוג נייר) */}
                            <td style={styles.tdCell}>
                              <span style={styles.typeBadgePill}>
                                <span style={{ marginRight: isHe ? 0 : '4px', marginLeft: isHe ? '4px' : 0 }}>
                                  {typeConfig.icon}
                                </span>
                                <span>{isHe ? typeConfig.he : typeConfig.en}</span>
                              </span>
                            </td>

                            {/* Total Shares (כמות) */}
                            <td style={styles.tdCell}>
                              <span style={styles.boldCellText}>
                                {metrics.totalShares.toLocaleString('en-US', {
                                  maximumFractionDigits: 4,
                                })}
                              </span>
                            </td>

                            {/* Weighted Avg Cost */}
                            <td style={styles.tdCell}>
                              <span style={styles.cellText}>
                                {formatVal(metrics.avgPrice, asset.currency)}
                              </span>
                            </td>

                            {/* Market Price with Quick Edit (שער נוכחי) */}
                            <td style={styles.tdCell}>
                              {editingPriceAssetId === asset.id ? (
                                <div style={styles.inlineEditWrap}>
                                  <input
                                    type="number"
                                    step="any"
                                    value={inlinePriceInput}
                                    onChange={(e) => setInlinePriceInput(e.target.value)}
                                    autoFocus
                                    style={styles.inlinePriceInput}
                                  />
                                  <button
                                    style={styles.inlineSaveBtn}
                                    onClick={() => handleSaveInlinePrice(asset.id)}
                                  >
                                    ✓
                                  </button>
                                  <button
                                    style={styles.inlineCancelBtn}
                                    onClick={() => setEditingPriceAssetId(null)}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <div style={styles.priceDisplayRow}>
                                  <span style={styles.boldCellText}>
                                    {formatVal(asset.current_price, asset.currency)}
                                  </span>
                                  <button
                                    style={styles.inlineEditTriggerBtn}
                                    onClick={() => {
                                      setEditingPriceAssetId(asset.id);
                                      setInlinePriceInput(asset.current_price.toString());
                                    }}
                                    title={isHe ? 'עדכן שער שוק נוכחי' : 'Edit current price'}
                                  >
                                    <Edit2 size={12} color="var(--primary)" />
                                  </button>
                                </div>
                              )}
                            </td>

                            {/* Total Cost (סכום רכישה כולל) */}
                            <td style={styles.tdCell}>
                              <span style={styles.cellText}>
                                {formatVal(metrics.totalCost, asset.currency)}
                              </span>
                            </td>

                            {/* Current Value (שווי נוכחי) */}
                            <td style={styles.tdCell}>
                              <span style={{ ...styles.boldCellText, color: '#0F172A' }}>
                                {formatVal(metrics.currentValue, asset.currency)}
                              </span>
                            </td>

                            {/* Profit / Loss */}
                            <td style={styles.tdCell}>
                              <span
                                style={{
                                  ...styles.boldCellText,
                                  color: isProfit ? '#059669' : '#DC2626',
                                }}
                              >
                                {isProfit ? '+' : ''}
                                {formatVal(metrics.profit, asset.currency)}
                              </span>
                            </td>

                            {/* Yield % */}
                            <td style={styles.tdCell}>
                              <span
                                style={{
                                  ...styles.yieldBadge,
                                  backgroundColor: isProfit ? '#DCFCE7' : '#FEE2E2',
                                  color: isProfit ? '#15803D' : '#B91C1C',
                                }}
                              >
                                {isProfit ? '+' : ''}
                                {metrics.returnPct.toFixed(2)}%
                              </span>
                            </td>

                            {/* Tranches Expand Toggle */}
                            <td style={{ ...styles.tdCell, textAlign: 'center' }}>
                              <button
                                style={{
                                  ...styles.trancheExpandBtn,
                                  ...(isExpanded ? styles.trancheExpandBtnActive : {}),
                                }}
                                onClick={() => toggleExpand(asset.id)}
                                title={isHe ? 'הצג/הסתר פעימות רכישה' : 'Toggle tranches'}
                              >
                                <span>
                                  {asset.tranches.length} {isHe ? 'פעימות' : 'tranches'}
                                </span>
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            </td>

                            {/* Actions */}
                            <td style={{ ...styles.tdCell, textAlign: 'center' }}>
                              <div style={styles.actionsRow}>
                                <button
                                  style={styles.addTrancheSmallBtn}
                                  onClick={() => handleOpenAddModal('add_tranche', asset)}
                                  title={isHe ? 'הוסף פעימת קנייה נוספת' : 'Add purchase tranche'}
                                >
                                  <Plus size={13} color="var(--primary)" />
                                  <span>{isHe ? 'פעימה' : 'Tranche'}</span>
                                </button>
                                <button
                                  style={styles.deleteAssetBtn}
                                  onClick={() => {
                                    if (
                                      confirm(
                                        isHe
                                          ? `האם למחוק את ${asset.ticker} וכל פעימות הרכישה שלו?`
                                          : `Delete ${asset.ticker} and all its tranches?`
                                      )
                                    ) {
                                      deleteInvestmentAsset(asset.id);
                                    }
                                  }}
                                  title={isHe ? 'מחק נייר ערך' : 'Delete asset'}
                                >
                                  <Trash2 size={14} color="#EF4444" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Tranche Drill-Down Sub-Table */}
                          {isExpanded && (
                            <tr style={styles.trancheSubTr}>
                              <td colSpan={12} style={styles.trancheSubTd}>
                                <div style={styles.trancheSubContainer} className="animate-fade-in">
                                  <div style={styles.trancheSubHeader}>
                                    <div style={styles.trancheSubTitle}>
                                      <Calendar size={14} color="#2563EB" />
                                      <span>
                                        {isHe
                                          ? `פירוט פעימות רכישה עבור ${asset.ticker} (${asset.name}):`
                                          : `Purchase Tranche History for ${asset.ticker}:`}
                                      </span>
                                    </div>
                                    <button
                                      style={styles.addTrancheSubBtn}
                                      onClick={() => handleOpenAddModal('add_tranche', asset)}
                                    >
                                      <Plus size={13} color="#2563EB" />
                                      <span>{isHe ? '+ הוסף פעימה חדשה' : '+ Add Tranche'}</span>
                                    </button>
                                  </div>

                                  <table style={styles.trancheTable}>
                                    <thead>
                                      <tr style={styles.trancheThRow}>
                                        <th style={styles.trancheTh}>#</th>
                                        <th style={styles.trancheTh}>{isHe ? 'תאריך רכישה' : 'Date'}</th>
                                        <th style={styles.trancheTh}>{isHe ? 'כמות מניות' : 'Shares'}</th>
                                        <th style={styles.trancheTh}>
                                          {isHe ? 'שער קנייה ליחידה' : 'Price / Share'}
                                        </th>
                                        <th style={styles.trancheTh}>
                                          {isHe ? 'עמלת מסחר' : 'Trading Fee'}
                                        </th>
                                        <th style={styles.trancheTh}>
                                          {isHe ? 'סך סכום רכישה' : 'Total Tranche Cost'}
                                        </th>
                                        <th style={styles.trancheTh}>
                                          {isHe ? 'שווי נוכחי לפעימה' : 'Current Value'}
                                        </th>
                                        <th style={styles.trancheTh}>
                                          {isHe ? 'רווח/הפסד נקודתי' : 'Tranche P&L'}
                                        </th>
                                        <th style={styles.trancheTh}>{isHe ? 'תשואה' : 'Yield'}</th>
                                        <th style={styles.trancheTh}>{isHe ? 'הערות' : 'Notes'}</th>
                                        <th style={{ ...styles.trancheTh, textAlign: 'center' }}>
                                          {isHe ? 'מחק' : 'Delete'}
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {asset.tranches.map((tr, idx) => {
                                        const trCost =
                                          tr.total_cost ||
                                          tr.shares * tr.price_per_share + (tr.fee || 0);
                                        const trVal = tr.shares * asset.current_price;
                                        const trProfit = trVal - trCost;
                                        const trYield =
                                          trCost > 0 ? (trProfit / trCost) * 100 : 0;
                                        const isTrProfit = trProfit >= 0;

                                        return (
                                          <tr key={tr.id} style={styles.trancheTr}>
                                            <td style={styles.trancheTd}>
                                              <span style={styles.trancheIndexPill}>{idx + 1}</span>
                                            </td>
                                            <td style={styles.trancheTd}>{tr.date}</td>
                                            <td style={styles.trancheTd}>
                                              <strong>{tr.shares}</strong>
                                            </td>
                                            <td style={styles.trancheTd}>
                                              {formatVal(tr.price_per_share, asset.currency)}
                                            </td>
                                            <td style={styles.trancheTd}>
                                              {tr.fee ? formatVal(tr.fee, asset.currency) : '—'}
                                            </td>
                                            <td style={styles.trancheTd}>
                                              <strong>{formatVal(trCost, asset.currency)}</strong>
                                            </td>
                                            <td style={styles.trancheTd}>
                                              {formatVal(trVal, asset.currency)}
                                            </td>
                                            <td style={styles.trancheTd}>
                                              <span
                                                style={{
                                                  color: isTrProfit ? '#059669' : '#DC2626',
                                                  fontWeight: '700',
                                                }}
                                              >
                                                {isTrProfit ? '+' : ''}
                                                {formatVal(trProfit, asset.currency)}
                                              </span>
                                            </td>
                                            <td style={styles.trancheTd}>
                                              <span
                                                style={{
                                                  ...styles.yieldPillSmall,
                                                  backgroundColor: isTrProfit
                                                    ? '#DCFCE7'
                                                    : '#FEE2E2',
                                                  color: isTrProfit ? '#15803D' : '#B91C1C',
                                                }}
                                              >
                                                {isTrProfit ? '+' : ''}
                                                {trYield.toFixed(2)}%
                                              </span>
                                            </td>
                                            <td style={styles.trancheTd}>
                                              <span style={styles.notesText}>{tr.notes || '—'}</span>
                                            </td>
                                            <td style={{ ...styles.trancheTd, textAlign: 'center' }}>
                                              <button
                                                style={styles.deleteTrancheBtn}
                                                onClick={() => {
                                                  if (
                                                    confirm(
                                                      isHe
                                                        ? 'האם למחוק פעימת רכישה זו?'
                                                        : 'Delete this purchase tranche?'
                                                    )
                                                  ) {
                                                    deleteInvestmentTranche(asset.id, tr.id);
                                                  }
                                                }}
                                                title={isHe ? 'מחק פעימה' : 'Delete tranche'}
                                              >
                                                <Trash2 size={13} color="#EF4444" />
                                              </button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 2: PERIODIC SNAPSHOTS & HISTORICAL CLOSURES (שלב ב') */}
      {activeSubTab === 'snapshots' && (
        <div style={styles.snapshotsContainer} className="animate-fade-in">
          <div style={styles.snapshotsHeaderBox}>
            <div>
              <h3 style={styles.snapshotsTitle}>
                {isHe
                  ? 'צילומי מצב תקופתיים וסגירת חודש / רבעון / שנה'
                  : 'Periodic Snapshots & End-of-Period Closures'}
              </h3>
              <p style={styles.snapshotsSubtitle}>
                {isHe
                  ? 'שמירת שווי נוכחי בכל נקודת זמן, מעקב ביצועים ורווח/הפסד נקודתי לאורך השנה, והורדת דוחות אקסל מלאים.'
                  : 'Record portfolio value at specific milestones to measure periodic gain/loss and download historical reports.'}
              </p>
            </div>

            <div style={styles.snapshotActionButtons}>
              <button
                style={styles.savePeriodBtn}
                onClick={() => handleOpenSnapshotModal('month')}
              >
                <Calendar size={15} />
                <span>{isHe ? '+ סגירת חודש' : '+ Month End'}</span>
              </button>
              <button
                style={styles.savePeriodBtn}
                onClick={() => handleOpenSnapshotModal('quarter')}
              >
                <Layers size={15} />
                <span>{isHe ? '+ סגירת רבעון' : '+ Quarter End'}</span>
              </button>
              <button
                style={styles.savePeriodBtn}
                onClick={() => handleOpenSnapshotModal('year')}
              >
                <Clock size={15} />
                <span>{isHe ? '+ סגירת שנה' : '+ Year End'}</span>
              </button>
              <button
                style={styles.saveCurrentStateBtn}
                onClick={() => handleOpenSnapshotModal('current')}
              >
                <CheckCircle2 size={15} />
                <span>{isHe ? 'שמור מצב נוכחי כעת' : 'Save Current Point'}</span>
              </button>
            </div>
          </div>

          {/* MARKET QUOTE FETCH & VALUATION BUILDER (פנייה לאתרים) */}
          <div id="market-quotes-fetcher-section" style={styles.quoteFetchCard}>
            <div style={styles.quoteFetchHeader}>
              <div style={styles.quoteFetchIconBadge}>
                <Globe size={22} color="#2563EB" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.quoteFetchTagRow}>
                  <span style={styles.quoteFetchTag}>
                    <Sparkles size={12} color="#2563EB" />
                    {isHe ? 'שלב ב׳ — פנייה לאתרי הבורסה וציטוטים היסטוריים' : 'Market Quotes API'}
                  </span>
                </div>
                <h3 style={styles.quoteFetchTitle}>
                  {isHe
                    ? 'משיכת ציטוט שוק וחישוב שווי בסוף חודש / סוף רבעון / סוף שנה'
                    : 'Fetch Historical Market Quotes & Calculate P&L'}
                </h3>
                <p style={styles.quoteFetchSubtitle}>
                  {isHe
                    ? 'המערכת פונה ישירות לאתרי הבורסה (Yahoo Finance לניירות זרים, וביזפורטל לניירות ישראליים לפי מספר נייר), מביאה את שער הסגירה המדויק ומחשבת שווי, רווח/הפסד נקודתי ותשואה.'
                    : 'Connects to Yahoo Finance & Bizportal TASE to fetch official closing prices at end of month, quarter, or year.'}
                </p>
              </div>
            </div>

            {/* Period Type Selection Tabs */}
            <div style={styles.periodTabsWrap}>
              <button
                type="button"
                style={{
                  ...styles.periodTabItem,
                  ...(fetchPeriodType === 'year_end' ? styles.periodTabItemActive : {}),
                }}
                onClick={() => {
                  setFetchPeriodType('year_end');
                  setFetchMonth(12);
                }}
              >
                <Clock size={15} />
                <span>{isHe ? 'סוף שנה (סוף חודש דצמבר)' : 'Year End (Dec 31)'}</span>
              </button>

              <button
                type="button"
                style={{
                  ...styles.periodTabItem,
                  ...(fetchPeriodType === 'quarter_end' ? styles.periodTabItemActive : {}),
                }}
                onClick={() => setFetchPeriodType('quarter_end')}
              >
                <Layers size={15} />
                <span>{isHe ? 'סוף רבעון (סוף החודש ברבעון)' : 'Quarter End'}</span>
              </button>

              <button
                type="button"
                style={{
                  ...styles.periodTabItem,
                  ...(fetchPeriodType === 'month_end' ? styles.periodTabItemActive : {}),
                }}
                onClick={() => setFetchPeriodType('month_end')}
              >
                <Calendar size={15} />
                <span>{isHe ? 'סוף חודש ספציפי' : 'Month End'}</span>
              </button>

              <button
                type="button"
                style={{
                  ...styles.periodTabItem,
                  ...(fetchPeriodType === 'current' ? styles.periodTabItemActive : {}),
                }}
                onClick={() => setFetchPeriodType('current')}
              >
                <TrendingUp size={15} />
                <span>{isHe ? 'נקודת זמן נוכחית (חי)' : 'Current Live'}</span>
              </button>
            </div>

            {/* Controls Row */}
            <div style={styles.fetchControlsRow}>
              {fetchPeriodType !== 'current' && (
                <div style={styles.fetchSelectGroup}>
                  <label style={styles.fetchSelectLabel}>
                    {isHe ? 'בחר שנת סגירה:' : 'Select Year:'}
                  </label>
                  <select
                    value={fetchYear}
                    onChange={(e) => setFetchYear(parseInt(e.target.value, 10))}
                    style={styles.fetchSelect}
                  >
                    <option value={2026}>2026</option>
                    <option value={2025}>2025</option>
                    <option value={2024}>2024</option>
                    <option value={2023}>2023</option>
                    <option value={2022}>2022</option>
                  </select>
                </div>
              )}

              {fetchPeriodType === 'quarter_end' && (
                <div style={styles.fetchSelectGroup}>
                  <label style={styles.fetchSelectLabel}>
                    {isHe ? 'בחר רבעון (החודש האחרון ברבעון):' : 'Select Quarter:'}
                  </label>
                  <select
                    value={fetchQuarter}
                    onChange={(e) => setFetchQuarter(parseInt(e.target.value, 10))}
                    style={styles.fetchSelect}
                  >
                    <option value={1}>{isHe ? 'רבעון 1 (Q1 - סוף חודש מרץ)' : 'Q1 (End of March)'}</option>
                    <option value={2}>{isHe ? 'רבעון 2 (Q2 - סוף חודש יוני)' : 'Q2 (End of June)'}</option>
                    <option value={3}>{isHe ? 'רבעון 3 (Q3 - סוף חודש ספטמבר)' : 'Q3 (End of September)'}</option>
                    <option value={4}>{isHe ? 'רבעון 4 (Q4 - סוף חודש דצמבר)' : 'Q4 (End of December)'}</option>
                  </select>
                </div>
              )}

              {fetchPeriodType === 'month_end' && (
                <div style={styles.fetchSelectGroup}>
                  <label style={styles.fetchSelectLabel}>
                    {isHe ? 'בחר חודש לסגירה:' : 'Select Month:'}
                  </label>
                  <select
                    value={fetchMonth}
                    onChange={(e) => setFetchMonth(parseInt(e.target.value, 10))}
                    style={styles.fetchSelect}
                  >
                    <option value={1}>{isHe ? 'חודש 1 (סוף ינואר)' : 'January'}</option>
                    <option value={2}>{isHe ? 'חודש 2 (סוף פברואר)' : 'February'}</option>
                    <option value={3}>{isHe ? 'חודש 3 (סוף מרץ)' : 'March'}</option>
                    <option value={4}>{isHe ? 'חודש 4 (סוף אפריל)' : 'April'}</option>
                    <option value={5}>{isHe ? 'חודש 5 (סוף מאי)' : 'May'}</option>
                    <option value={6}>{isHe ? 'חודש 6 (סוף יוני)' : 'June'}</option>
                    <option value={7}>{isHe ? 'חודש 7 (סוף יולי)' : 'July'}</option>
                    <option value={8}>{isHe ? 'חודש 8 (סוף אוגוסט)' : 'August'}</option>
                    <option value={9}>{isHe ? 'חודש 9 (סוף ספטמבר)' : 'September'}</option>
                    <option value={10}>{isHe ? 'חודש 10 (סוף אוקטובר)' : 'October'}</option>
                    <option value={11}>{isHe ? 'חודש 11 (סוף נובמבר)' : 'November'}</option>
                    <option value={12}>{isHe ? 'חודש 12 (סוף דצמבר)' : 'December'}</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-end', flex: 1 }}>
                <button
                  type="button"
                  style={{
                    ...styles.fetchActionBtn,
                    ...(isFetchingPeriodQuotes ? styles.fetchActionBtnLoading : {}),
                  }}
                  onClick={handleFetchPeriodQuotes}
                  disabled={isFetchingPeriodQuotes}
                >
                  <Globe size={18} className={isFetchingPeriodQuotes ? 'spin-icon' : ''} />
                  <span>
                    {isFetchingPeriodQuotes
                      ? isHe
                        ? 'פונה לאתרים ומושך ציטוטי סגירה...'
                        : 'Fetching closing quotes...'
                      : isHe
                      ? 'פנה לאתרים ומשוך ציטוטים לתקופה זו'
                      : 'Fetch Closing Quotes & Calculate P&L'}
                  </span>
                </button>
              </div>
            </div>

            {/* Error Message */}
            {fetchPeriodError && (
              <div style={styles.fetchErrorBox}>
                <Info size={16} color="#DC2626" />
                <span>{fetchPeriodError}</span>
              </div>
            )}

            {/* FETCHED RESULTS PREVIEW CARD */}
            {fetchedPeriodResult && (
              <div style={styles.fetchedResultCard} className="animate-fade-in">
                <div style={styles.fetchedResultHeader}>
                  <div>
                    <div style={styles.fetchedResultBadge}>
                      <CheckCircle2 size={14} color="#16A34A" />
                      <span>{isHe ? 'ציטוטים היסטוריים נמשכו בהצלחה' : 'Quotes Retrieved'}</span>
                    </div>
                    <h4 style={styles.fetchedResultTitle}>{fetchedPeriodResult.periodLabel}</h4>
                    <p style={styles.fetchedResultSub}>
                      {isHe
                        ? `יום מסחר שנמצא: ${fetchedPeriodResult.date} | סה״כ ${fetchedPeriodResult.items.length} ניירות חושבו`
                        : `Trading date: ${fetchedPeriodResult.date} | ${fetchedPeriodResult.items.length} assets`}
                    </p>
                  </div>

                  <div style={styles.fetchedActionsGroup}>
                    <button
                      type="button"
                      style={styles.saveFetchedBtn}
                      onClick={handleSaveFetchedPeriodResult}
                    >
                      <Check size={16} />
                      <span>{isHe ? 'שמור צילום מצב זה בהיסטוריה' : 'Save Snapshot'}</span>
                    </button>
                    <button
                      type="button"
                      style={styles.exportFetchedBtn}
                      onClick={() => handleExportFetchedPeriodCSV(fetchedPeriodResult)}
                    >
                      <Download size={16} />
                      <span>{isHe ? 'הורד דוח לתקופה זו (Excel/CSV)' : 'Export CSV'}</span>
                    </button>
                  </div>
                </div>

                {/* Period KPI Summary */}
                <div style={styles.periodKpiGrid}>
                  <div style={styles.periodKpiItem}>
                    <span style={styles.periodKpiLabel}>{isHe ? 'סך עלות ההשקעה' : 'Total Cost'}</span>
                    <span style={styles.periodKpiVal}>
                      ₪{fetchedPeriodResult.totalInvested.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div style={styles.periodKpiItem}>
                    <span style={styles.periodKpiLabel}>{isHe ? 'שווי תיק במועד זה' : 'Period Valuation'}</span>
                    <span style={{ ...styles.periodKpiVal, color: '#0F172A' }}>
                      ₪{fetchedPeriodResult.totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div style={styles.periodKpiItem}>
                    <span style={styles.periodKpiLabel}>{isHe ? 'רווח/הפסד נקודתי' : 'Periodic P&L'}</span>
                    <span
                      style={{
                        ...styles.periodKpiVal,
                        color: fetchedPeriodResult.totalProfit >= 0 ? '#059669' : '#DC2626',
                      }}
                    >
                      {fetchedPeriodResult.totalProfit >= 0 ? '+' : ''}
                      ₪{fetchedPeriodResult.totalProfit.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div style={styles.periodKpiItem}>
                    <span style={styles.periodKpiLabel}>{isHe ? 'תשואה נקודתית' : 'Periodic Yield'}</span>
                    <span
                      style={{
                        ...styles.periodKpiVal,
                        color: fetchedPeriodResult.totalProfit >= 0 ? '#15803D' : '#B91C1C',
                      }}
                    >
                      {fetchedPeriodResult.totalProfit >= 0 ? '+' : ''}
                      {fetchedPeriodResult.totalReturnPct.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Detailed Assets Breakdown Table for the Period */}
                <div style={{ overflowX: 'auto', marginTop: '14px' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.thRow}>
                        <th style={styles.thCell}>{isHe ? 'סימול / מספר נייר' : 'Ticker / Security No.'}</th>
                        <th style={styles.thCell}>{isHe ? 'שם נייר' : 'Name'}</th>
                        <th style={styles.thCell}>{isHe ? 'מקור הציטוט' : 'Source'}</th>
                        <th style={styles.thCell}>{isHe ? 'שער סגירה בתקופה' : 'Closing Price'}</th>
                        <th style={styles.thCell}>{isHe ? 'תאריך יום מסחר' : 'Trade Date'}</th>
                        <th style={styles.thCell}>{isHe ? 'כמות' : 'Shares'}</th>
                        <th style={styles.thCell}>{isHe ? 'סך עלות' : 'Total Cost'}</th>
                        <th style={styles.thCell}>{isHe ? 'שווי במועד זה' : 'Valuation'}</th>
                        <th style={styles.thCell}>{isHe ? 'רווח/הפסד נקודתי' : 'P&L'}</th>
                        <th style={styles.thCell}>{isHe ? 'תשואה (%)' : 'Yield %'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fetchedPeriodResult.items.map((item) => {
                        const isGain = item.profit >= 0;
                        return (
                          <tr key={item.asset_id} style={styles.trRow}>
                            <td style={styles.tdCell}>
                              <div style={styles.tickerPill}>{item.ticker}</div>
                              {item.security_number && (
                                <div style={styles.secNumText}>#{item.security_number}</div>
                              )}
                            </td>
                            <td style={styles.tdCell}>
                              <span style={styles.boldCellText}>{item.name}</span>
                            </td>
                            <td style={styles.tdCell}>
                              <span style={styles.quoteSourceBadge}>{item.quote_source}</span>
                            </td>
                            <td style={styles.tdCell}>
                              <strong style={{ color: '#2563EB' }}>
                                {item.currency === 'USD' ? '$' : '₪'}
                                {item.market_price.toFixed(2)}
                              </strong>
                            </td>
                            <td style={styles.tdCell}>{item.quote_date || '—'}</td>
                            <td style={styles.tdCell}>{item.shares}</td>
                            <td style={styles.tdCell}>
                              {item.currency === 'USD' ? '$' : '₪'}
                              {item.total_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={styles.tdCell}>
                              <strong>
                                {item.currency === 'USD' ? '$' : '₪'}
                                {item.market_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </strong>
                            </td>
                            <td style={styles.tdCell}>
                              <span style={{ color: isGain ? '#059669' : '#DC2626', fontWeight: '700' }}>
                                {isGain ? '+' : ''}
                                {item.currency === 'USD' ? '$' : '₪'}
                                {item.profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                            </td>
                            <td style={styles.tdCell}>
                              <span
                                style={{
                                  ...styles.yieldBadge,
                                  backgroundColor: isGain ? '#DCFCE7' : '#FEE2E2',
                                  color: isGain ? '#15803D' : '#B91C1C',
                                }}
                              >
                                {isGain ? '+' : ''}
                                {item.return_pct.toFixed(2)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Hierarchical Snapshots Tree (שנה ⟵ רבעונים ⟵ חודשים) */}
          <InvestmentsSnapshotsTree
            snapshots={snapshots}
            onOpenSnapshotModal={handleOpenSnapshotModal}
            onExportSnapshotCSV={handleExportSavedSnapshotCSV}
            onDeleteSnapshot={handleDeleteSnapshot}
            onQuickFetch={handleQuickFetchFromTree}
            isHe={isHe}
          />
        </div>
      )}

      {/* TAB 3: CHARTS & PERFORMANCE ANALYTICS */}
      {activeSubTab === 'charts' && (
        <InvestmentsCharts
          investments={investments}
          snapshots={snapshots}
          portfolioSummary={portfolioSummary}
          usdRate={usdRate}
          isHe={isHe}
        />
      )}

      {/* MODAL: ADD ASSET / TRANCHE */}
      {isModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard} className="animate-fade-in">
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleRow}>
                <Coins size={20} color="#2563EB" />
                <h3 style={styles.modalTitle}>
                  {modalMode === 'new_asset'
                    ? isHe
                      ? 'הוספת נייר ערך חדש ופעימת רכישה'
                      : 'Add New Investment & First Tranche'
                    : isHe
                    ? `הוספת פעימת רכישה ל-${formTicker}`
                    : `Add Purchase Tranche to ${formTicker}`}
                </h3>
              </div>
              <button
                style={styles.modalCloseBtn}
                onClick={() => setIsModalOpen(false)}
              >
                <X size={18} color="var(--text-secondary)" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} style={styles.modalForm}>
              {modalMode === 'new_asset' && (
                <>
                  <div style={styles.formRow2}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>
                        {isHe ? 'סימול נייר (Ticker / Symbol) *' : 'Ticker Symbol *'}
                      </label>
                      <input
                        style={styles.formInput}
                        type="text"
                        placeholder="e.g. AAPL, VOO, TA125, TEVA"
                        value={formTicker}
                        onChange={(e) => setFormTicker(e.target.value)}
                        required
                      />
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>
                        {isHe ? 'מספר נייר בבורסה (Security Number)' : 'Security Number'}
                      </label>
                      <input
                        style={styles.formInput}
                        type="text"
                        placeholder="e.g. 1159250 או ISIN"
                        value={formSecurityNumber}
                        onChange={(e) => setFormSecurityNumber(e.target.value)}
                      />
                      <span style={styles.inputHelper}>
                        {isHe ? 'מספר הנייר כפי שמופיע בחשבון הבנק/ברוקר' : 'Official exchange / ISIN code'}
                      </span>
                    </div>
                  </div>

                  <div style={styles.formRow2}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>
                        {isHe ? 'שם הנייר / החברה' : 'Asset / Company Name'}
                      </label>
                      <input
                        style={styles.formInput}
                        type="text"
                        placeholder="e.g. Vanguard S&P 500 ETF, אפל"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                      />
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>
                        {isHe ? 'סוג נייר (Asset Type) *' : 'Security Type *'}
                      </label>
                      <select
                        style={styles.formSelect}
                        value={formAssetType}
                        onChange={(e) => setFormAssetType(e.target.value as any)}
                      >
                        {Object.entries(SECURITY_TYPE_LABELS).map(([key, labelObj]) => (
                          <option key={key} value={key}>
                            {labelObj.icon} {isHe ? labelObj.he : labelObj.en}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={styles.formRow2}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>
                        {isHe ? 'מטבע הנייר' : 'Currency'}
                      </label>
                      <select
                        style={styles.formSelect}
                        value={formCurrency}
                        onChange={(e) => setFormCurrency(e.target.value as any)}
                      >
                        <option value="USD">USD ($) - דולר ארה״ב</option>
                        <option value="ILS">ILS (₪) - שקל ישראלי</option>
                      </select>
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>
                        {isHe
                          ? `שער מניה נוכחי בשוק (${formCurrency === 'USD' ? '$' : '₪'})`
                          : `Current Market Price (${formCurrency === 'USD' ? '$' : '₪'})`}
                      </label>
                      <input
                        style={styles.formInput}
                        type="number"
                        step="any"
                        placeholder="e.g. 130"
                        value={formCurrentPrice}
                        onChange={(e) => setFormCurrentPrice(e.target.value)}
                      />
                      <span style={styles.inputHelper}>
                        {isHe ? 'אם לא הוזן, ייקבע לפי שער הקנייה' : 'Defaults to purchase price if empty'}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Tranche Details */}
              <div style={styles.sectionDivider}>
                <span>{isHe ? 'פרטי פעימת הרכישה (תאריך, כמות וסכום)' : 'Purchase Tranche Details'}</span>
              </div>

              <div style={styles.formRow3}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    {isHe ? 'תאריך רכישה *' : 'Purchase Date *'}
                  </label>
                  <input
                    style={styles.formInput}
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    {isHe ? 'כמות מניות / יחידות *' : 'Shares / Quantity *'}
                  </label>
                  <input
                    style={styles.formInput}
                    type="number"
                    step="any"
                    placeholder="e.g. 10"
                    value={formShares}
                    onChange={(e) => handleSharesChange(e.target.value)}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    {isHe
                      ? `מחיר ליחידה (${formCurrency === 'USD' ? '$' : '₪'}) *`
                      : `Price per Share (${formCurrency === 'USD' ? '$' : '₪'}) *`}
                  </label>
                  <input
                    style={styles.formInput}
                    type="number"
                    step="any"
                    placeholder="e.g. 100"
                    value={formPricePerShare}
                    onChange={(e) => handlePricePerShareChange(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={styles.formRow2}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    {isHe
                      ? `סך סכום רכישה לפעימה (${formCurrency === 'USD' ? '$' : '₪'})`
                      : `Total Tranche Amount (${formCurrency === 'USD' ? '$' : '₪'})`}
                  </label>
                  <input
                    style={styles.formInput}
                    type="number"
                    step="any"
                    placeholder="e.g. 1000"
                    value={formTotalCost}
                    onChange={(e) => handleTotalCostChange(e.target.value)}
                  />
                  <span style={styles.inputHelper}>
                    {isHe ? 'סכום כולל מחושב אוטומטית (כמות × מחיר + עמלה)' : 'Auto calculated: shares × price + fee'}
                  </span>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    {isHe
                      ? `עמלת קנייה (${formCurrency === 'USD' ? '$' : '₪'})`
                      : `Trading Fee (${formCurrency === 'USD' ? '$' : '₪'})`}
                  </label>
                  <input
                    style={styles.formInput}
                    type="number"
                    step="any"
                    placeholder="0"
                    value={formFee}
                    onChange={(e) => {
                      setFormFee(e.target.value);
                      const s = parseFloat(formShares);
                      const p = parseFloat(formPricePerShare);
                      const f = parseFloat(e.target.value) || 0;
                      if (s > 0 && p >= 0) setFormTotalCost((s * p + f).toFixed(2));
                    }}
                  />
                  <span style={styles.inputHelper}>
                    {isHe ? 'תווסף לעלות הרכישה להקטנת מס רווחי הון' : 'Added to cost basis'}
                  </span>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>
                  {isHe ? 'הערות לפעימה (אופציונלי)' : 'Notes / Remarks (Optional)'}
                </label>
                <input
                  style={styles.formInput}
                  type="text"
                  placeholder="e.g. קנייה בפעימה חודשית"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </div>

              {/* Dynamic Live Calculation Preview */}
              {parseFloat(formShares) > 0 && parseFloat(formPricePerShare) > 0 && (
                <div style={styles.liveCalculationBox}>
                  <div style={styles.calcPreviewTitle}>
                    <Sparkles size={14} color="#2563EB" />
                    <span>{isHe ? 'סיכום פעימה זו:' : 'Tranche Calculation Preview:'}</span>
                  </div>
                  <div style={styles.calcPreviewRow}>
                    <span>
                      {isHe ? 'עלות רכישה כוללת:' : 'Total Cost:'}{' '}
                      <strong>
                        {formCurrency === 'USD' ? '$' : '₪'}
                        {(
                          parseFloat(formShares) * parseFloat(formPricePerShare) +
                          (parseFloat(formFee) || 0)
                        ).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </strong>
                    </span>
                    {parseFloat(formCurrentPrice) > 0 && (
                      <span>
                        {isHe ? 'רווח נוכחי לפעימה:' : 'Current Tranche Gain:'}{' '}
                        <strong
                          style={{
                            color:
                              parseFloat(formCurrentPrice) >= parseFloat(formPricePerShare)
                                ? '#059669'
                                : '#DC2626',
                          }}
                        >
                          {formCurrency === 'USD' ? '$' : '₪'}
                          {(
                            parseFloat(formShares) * parseFloat(formCurrentPrice) -
                            (parseFloat(formShares) * parseFloat(formPricePerShare) +
                              (parseFloat(formFee) || 0))
                          ).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Form Action Buttons */}
              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.modalCancelBtn}
                  onClick={() => setIsModalOpen(false)}
                >
                  {isHe ? 'ביטול' : 'Cancel'}
                </button>
                <button type="submit" style={styles.modalSubmitBtn}>
                  {modalMode === 'new_asset'
                    ? isHe
                      ? 'צור נייר ערך ופעימה ראשונה'
                      : 'Create Asset & First Tranche'
                    : isHe
                    ? 'הוסף פעימת רכישה'
                    : 'Add Purchase Tranche'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PERIODIC SNAPSHOT CLOSURE (שלב ב') */}
      {isSnapshotModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard} className="animate-fade-in">
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleRow}>
                <Clock size={20} color="#2563EB" />
                <h3 style={styles.modalTitle}>
                  {isHe ? 'שמירת צילום מצב וסגירת תקופה' : 'Save Periodic Snapshot Closure'}
                </h3>
              </div>
              <button
                style={styles.modalCloseBtn}
                onClick={() => setIsSnapshotModalOpen(false)}
              >
                <X size={18} color="var(--text-secondary)" />
              </button>
            </div>

            <form onSubmit={handleSaveSnapshot} style={styles.modalForm}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>
                  {isHe ? 'סוג הסגירה' : 'Period Type'}
                </label>
                <select
                  style={styles.formSelect}
                  value={snapshotPeriodType}
                  onChange={(e) => handleOpenSnapshotModal(e.target.value as any)}
                >
                  <option value="month">{isHe ? 'סיום חודש' : 'End of Month'}</option>
                  <option value="quarter">{isHe ? 'סיום רבעון' : 'End of Quarter'}</option>
                  <option value="year">{isHe ? 'סיום שנה' : 'End of Year'}</option>
                  <option value="current">{isHe ? 'צילום נקודתי כעת' : 'Current Point in Time'}</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>
                  {isHe ? 'כותרת / תיאור התקופה *' : 'Period Label *'}
                </label>
                <input
                  style={styles.formInput}
                  type="text"
                  value={snapshotLabel}
                  onChange={(e) => setSnapshotLabel(e.target.value)}
                  placeholder="e.g. סיום רבעון Q1 2026"
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>
                  {isHe ? 'תאריך סגירה *' : 'Snapshot Date *'}
                </label>
                <input
                  style={styles.formInput}
                  type="date"
                  value={snapshotDate}
                  onChange={(e) => setSnapshotDate(e.target.value)}
                  required
                />
              </div>

              {/* Current Snapshot Metrics Preview */}
              <div style={styles.snapshotSummaryPreview}>
                <div style={styles.snapshotPreviewRow}>
                  <span>{isHe ? 'סך עלות מושקעת במועד זה:' : 'Cost Basis at snapshot:'}</span>
                  <strong>₪{portfolioSummary.totalInvestedILS.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>
                </div>
                <div style={styles.snapshotPreviewRow}>
                  <span>{isHe ? 'שווי שוק במועד זה:' : 'Market Valuation:'}</span>
                  <strong>₪{portfolioSummary.currentValueILS.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>
                </div>
                <div style={styles.snapshotPreviewRow}>
                  <span>{isHe ? 'רווח נקודתי לתקופה:' : 'Point-in-Time Gain:'}</span>
                  <strong style={{ color: portfolioSummary.totalProfitILS >= 0 ? '#059669' : '#DC2626' }}>
                    {portfolioSummary.totalProfitILS >= 0 ? '+' : ''}
                    ₪{portfolioSummary.totalProfitILS.toLocaleString('en-US', { maximumFractionDigits: 0 })}{' '}
                    ({portfolioSummary.totalReturnPct.toFixed(2)}%)
                  </strong>
                </div>
                <div style={styles.snapshotPreviewRow}>
                  <span>{isHe ? 'מספר ניירות בתיק:' : 'Assets in Portfolio:'}</span>
                  <strong>{investments.length}</strong>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>
                  {isHe ? 'הערות / סיכום (אופציונלי)' : 'Notes / Remarks'}
                </label>
                <input
                  style={styles.formInput}
                  type="text"
                  value={snapshotNotes}
                  onChange={(e) => setSnapshotNotes(e.target.value)}
                  placeholder="e.g. סגירת תיק לקראת דיווח מס שנתי"
                />
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.modalCancelBtn}
                  onClick={() => setIsSnapshotModalOpen(false)}
                >
                  {isHe ? 'ביטול' : 'Cancel'}
                </button>
                <button type="submit" style={styles.modalSubmitBtn}>
                  {isHe ? 'שמור סגירת תקופה' : 'Save Milestone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    paddingBottom: '40px',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '16px',
  },
  badgeRow: {
    marginBottom: '6px',
  },
  topicBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    backgroundColor: '#EFF6FF',
    borderRadius: '16px',
    border: '1px solid #BFDBFE',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#1D4ED8',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: '800',
    color: 'var(--text-primary, #0F172A)',
    letterSpacing: '-0.02em',
    marginBottom: '6px',
  },
  subtitle: {
    fontSize: '0.9375rem',
    color: 'var(--text-secondary, #64748B)',
    maxWidth: '740px',
    lineHeight: '1.5',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
  },
  exportCurrentBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    backgroundColor: '#EFF6FF',
    border: '1px solid #BFDBFE',
    borderRadius: '10px',
    color: '#2563EB',
    fontSize: '0.8125rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  currencyToggleGroup: {
    display: 'flex',
    backgroundColor: 'var(--bg-surface-subtle, #F1F5F9)',
    padding: '3px',
    borderRadius: '10px',
    border: '1px solid var(--border-main, #E2E8F0)',
  },
  toggleBtn: {
    padding: '6px 12px',
    borderRadius: '7px',
    border: 'none',
    backgroundColor: 'transparent',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-secondary, #64748B)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
    color: 'var(--primary, #2563EB)',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
  },
  usdRateBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#FFFFFF',
    padding: '5px 10px',
    borderRadius: '10px',
    border: '1px solid var(--border-main, #E2E8F0)',
    fontSize: '0.8125rem',
  },
  usdRateLabel: {
    fontWeight: '700',
    color: 'var(--text-secondary, #64748B)',
  },
  usdRatePill: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '700',
    color: '#0F172A',
  },
  usdRateInput: {
    width: '60px',
    padding: '2px 4px',
    borderRadius: '4px',
    border: '1px solid var(--primary, #2563EB)',
    fontSize: '0.8125rem',
    fontWeight: '700',
    textAlign: 'center',
  },
  clearDemoBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: '10px',
    color: '#DC2626',
    fontSize: '0.8125rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  restoreDemoBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    backgroundColor: '#EFF6FF',
    border: '1px solid #BFDBFE',
    borderRadius: '10px',
    color: '#2563EB',
    fontSize: '0.8125rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  addAssetBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 16px',
    backgroundColor: 'var(--primary, #2563EB)',
    color: '#FFFFFF',
    borderRadius: '10px',
    border: 'none',
    fontSize: '0.875rem',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
    transition: 'background-color 0.15s ease',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '16px',
  },
  kpiCard: {
    backgroundColor: '#FFFFFF',
    padding: '20px',
    borderRadius: '16px',
    border: '1px solid var(--border-main, #E2E8F0)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  kpiTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  kpiLabel: {
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: 'var(--text-secondary, #64748B)',
  },
  kpiIconWrap: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiMainValue: {
    fontSize: '1.625rem',
    fontWeight: '800',
    color: 'var(--text-primary, #0F172A)',
    letterSpacing: '-0.02em',
    marginBottom: '6px',
  },
  kpiSubText: {
    fontSize: '0.75rem',
    color: 'var(--text-muted, #94A3B8)',
  },
  kpiBadgeYieldRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  yieldPill: {
    padding: '3px 8px',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: '800',
  },
  subTabNav: {
    display: 'flex',
    gap: '8px',
    borderBottom: '1px solid var(--border-main, #E2E8F0)',
    paddingBottom: '8px',
  },
  subTabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary, #64748B)',
    fontWeight: '700',
    fontSize: '0.875rem',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  subTabBtnActive: {
    backgroundColor: '#EFF6FF',
    color: '#2563EB',
  },
  subTabCountPill: {
    padding: '2px 7px',
    borderRadius: '12px',
    backgroundColor: '#E2E8F0',
    fontSize: '0.6875rem',
    fontWeight: '800',
    color: '#334155',
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid var(--border-main, #E2E8F0)',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
  },
  tableHeaderBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 24px',
    borderBottom: '1px solid var(--border-main, #E2E8F0)',
  },
  tableTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  tableTitle: {
    fontSize: '1.0625rem',
    fontWeight: '800',
    color: '#0F172A',
    margin: 0,
  },
  assetCountBadge: {
    padding: '2px 8px',
    borderRadius: '12px',
    backgroundColor: '#EFF6FF',
    color: '#2563EB',
    fontSize: '0.75rem',
    fontWeight: '700',
  },
  tableRightActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  tableLegend: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '0.75rem',
    color: 'var(--text-secondary, #64748B)',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  legendDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  exportSmallBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '5px 10px',
    backgroundColor: '#F1F5F9',
    border: '1px solid #CBD5E1',
    borderRadius: '7px',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#334155',
    cursor: 'pointer',
  },
  tableResponsiveWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'inherit',
  },
  thRow: {
    backgroundColor: 'var(--bg-surface-subtle, #F8FAFC)',
    borderBottom: '1px solid var(--border-main, #E2E8F0)',
  },
  thCell: {
    padding: '12px 14px',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-secondary, #64748B)',
    whiteSpace: 'nowrap',
  },
  trRow: {
    borderBottom: '1px solid var(--border-main, #E2E8F0)',
    transition: 'background-color 0.15s ease',
  },
  tdCell: {
    padding: '13px 14px',
    fontSize: '0.875rem',
    verticalAlign: 'middle',
  },
  assetNameBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  tickerPill: {
    padding: '3px 7px',
    backgroundColor: '#F1F5F9',
    borderRadius: '6px',
    fontWeight: '800',
    fontSize: '0.8125rem',
    color: '#0F172A',
    border: '1px solid #CBD5E1',
  },
  assetFullName: {
    fontWeight: '700',
    color: '#0F172A',
    fontSize: '0.875rem',
  },
  currencyTag: {
    fontSize: '0.6875rem',
    color: '#64748B',
  },
  securityNumberBadge: {
    padding: '2px 6px',
    backgroundColor: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '5px',
    fontSize: '0.75rem',
    fontFamily: 'monospace',
    color: '#475569',
  },
  typeBadgePill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    backgroundColor: '#F1F5F9',
    borderRadius: '8px',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#334155',
    whiteSpace: 'nowrap',
  },
  boldCellText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  cellText: {
    color: '#334155',
  },
  priceDisplayRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  inlineEditTriggerBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '3px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineEditWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  inlinePriceInput: {
    width: '75px',
    padding: '4px 6px',
    borderRadius: '6px',
    border: '1px solid var(--primary, #2563EB)',
    fontSize: '0.8125rem',
    fontWeight: '700',
  },
  inlineSaveBtn: {
    padding: '4px 6px',
    backgroundColor: '#059669',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: '700',
  },
  inlineCancelBtn: {
    padding: '4px 6px',
    backgroundColor: '#EF4444',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.75rem',
  },
  yieldBadge: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: '6px',
    fontWeight: '800',
    fontSize: '0.75rem',
  },
  trancheExpandBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    backgroundColor: '#F1F5F9',
    border: '1px solid #CBD5E1',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#334155',
    cursor: 'pointer',
  },
  trancheExpandBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
    color: '#2563EB',
  },
  actionsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  addTrancheSmallBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    padding: '4px 8px',
    backgroundColor: '#EFF6FF',
    border: '1px solid #BFDBFE',
    borderRadius: '6px',
    color: '#2563EB',
    fontSize: '0.6875rem',
    fontWeight: '700',
    cursor: 'pointer',
  },
  deleteAssetBtn: {
    padding: '5px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trancheSubTr: {
    backgroundColor: '#F8FAFC',
    borderBottom: '2px solid #CBD5E1',
  },
  trancheSubTd: {
    padding: '12px 16px 20px',
  },
  trancheSubContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    border: '1px solid #E2E8F0',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
  },
  trancheSubHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  trancheSubTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.875rem',
    fontWeight: '800',
    color: '#1E293B',
  },
  addTrancheSubBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '5px 10px',
    backgroundColor: '#EFF6FF',
    border: '1px solid #BFDBFE',
    borderRadius: '6px',
    color: '#2563EB',
    fontSize: '0.75rem',
    fontWeight: '700',
    cursor: 'pointer',
  },
  trancheTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.8125rem',
  },
  trancheThRow: {
    backgroundColor: '#F1F5F9',
    borderBottom: '1px solid #CBD5E1',
  },
  trancheTh: {
    padding: '8px 10px',
    fontSize: '0.6875rem',
    fontWeight: '700',
    color: '#475569',
    textAlign: 'inherit',
  },
  trancheTr: {
    borderBottom: '1px solid #F1F5F9',
  },
  trancheTd: {
    padding: '9px 10px',
    color: '#1E293B',
  },
  trancheIndexPill: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    backgroundColor: '#E2E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.6875rem',
    fontWeight: '800',
    color: '#475569',
  },
  yieldPillSmall: {
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '0.6875rem',
    fontWeight: '800',
  },
  notesText: {
    fontSize: '0.75rem',
    color: '#64748B',
    fontStyle: 'italic',
  },
  deleteTrancheBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
  },
  emptyTd: {
    padding: '40px 20px',
    textAlign: 'center',
  },
  emptyBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    maxWidth: '400px',
    margin: '0 auto',
  },
  emptyTitle: {
    fontSize: '1.125rem',
    fontWeight: '800',
    color: '#0F172A',
  },
  emptySub: {
    fontSize: '0.875rem',
    color: '#64748B',
    margin: 0,
    lineHeight: '1.5',
  },
  snapshotsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  snapshotsHeaderBox: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px',
    backgroundColor: '#FFFFFF',
    padding: '20px 24px',
    borderRadius: '16px',
    border: '1px solid #E2E8F0',
  },
  snapshotsTitle: {
    fontSize: '1.125rem',
    fontWeight: '800',
    color: '#0F172A',
    margin: '0 0 6px 0',
  },
  snapshotsSubtitle: {
    fontSize: '0.875rem',
    color: '#64748B',
    margin: 0,
  },
  snapshotActionButtons: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
  },
  savePeriodBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    backgroundColor: '#F1F5F9',
    border: '1px solid #CBD5E1',
    borderRadius: '10px',
    color: '#334155',
    fontWeight: '700',
    fontSize: '0.8125rem',
    cursor: 'pointer',
  },
  saveCurrentStateBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '10px',
    fontWeight: '700',
    fontSize: '0.8125rem',
    cursor: 'pointer',
  },
  periodTypeBadge: {
    padding: '3px 8px',
    backgroundColor: '#EFF6FF',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#2563EB',
  },
  snapshotSummaryPreview: {
    backgroundColor: '#F8FAFC',
    borderRadius: '12px',
    border: '1px solid #E2E8F0',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  snapshotPreviewRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.8125rem',
    color: '#334155',
  },
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
    padding: '20px',
    zIndex: 9999,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '20px',
    border: '1px solid #E2E8F0',
    width: '100%',
    maxWidth: '580px',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: '24px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '14px',
    borderBottom: '1px solid #F1F5F9',
  },
  modalTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  modalTitle: {
    fontSize: '1.125rem',
    fontWeight: '800',
    color: '#0F172A',
    margin: 0,
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '6px',
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formRow2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  formRow3: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '12px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    textAlign: 'inherit',
  },
  formLabel: {
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: '#334155',
  },
  formInput: {
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #CBD5E1',
    fontSize: '0.875rem',
    outline: 'none',
  },
  formSelect: {
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #CBD5E1',
    fontSize: '0.875rem',
    backgroundColor: '#FFFFFF',
    outline: 'none',
  },
  inputHelper: {
    fontSize: '0.6875rem',
    color: '#64748B',
  },
  sectionDivider: {
    display: 'flex',
    alignItems: 'center',
    margin: '8px 0',
    fontSize: '0.8125rem',
    fontWeight: '800',
    color: '#2563EB',
    backgroundColor: '#EFF6FF',
    padding: '6px 12px',
    borderRadius: '8px',
  },
  liveCalculationBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: '10px',
    border: '1px dashed #93C5FD',
    padding: '12px',
  },
  calcPreviewTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.75rem',
    fontWeight: '800',
    color: '#1E40AF',
    marginBottom: '6px',
  },
  calcPreviewRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.8125rem',
    color: '#334155',
    flexWrap: 'wrap',
    gap: '8px',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '10px',
    paddingTop: '16px',
    borderTop: '1px solid #F1F5F9',
  },
  modalCancelBtn: {
    padding: '10px 16px',
    backgroundColor: '#F1F5F9',
    color: '#475569',
    borderRadius: '10px',
    border: 'none',
    fontWeight: '700',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  modalSubmitBtn: {
    padding: '10px 20px',
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    borderRadius: '10px',
    border: 'none',
    fontWeight: '700',
    fontSize: '0.875rem',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
  },
  refreshQuotesBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    backgroundColor: '#F0FDF4',
    border: '1px solid #BBF7D0',
    borderRadius: '10px',
    color: '#15803D',
    fontWeight: '700',
    fontSize: '0.8125rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  refreshQuotesBtnLoading: {
    opacity: 0.7,
    cursor: 'wait',
  },
  quotesBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#F0FDF4',
    border: '1px solid #86EFAC',
    borderRadius: '12px',
    padding: '10px 16px',
    color: '#166534',
    fontSize: '0.875rem',
    fontWeight: '700',
    marginBottom: '16px',
  },
  quoteFetchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid #BFDBFE',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 4px 16px rgba(37, 99, 235, 0.08)',
  },
  quoteFetchHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
    marginBottom: '18px',
  },
  quoteFetchIconBadge: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    backgroundColor: '#EFF6FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    border: '1px solid #DBEAFE',
  },
  quoteFetchTagRow: {
    display: 'flex',
    marginBottom: '4px',
  },
  quoteFetchTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 8px',
    backgroundColor: '#EFF6FF',
    color: '#2563EB',
    borderRadius: '6px',
    fontSize: '0.6875rem',
    fontWeight: '800',
  },
  quoteFetchTitle: {
    fontSize: '1.125rem',
    fontWeight: '800',
    color: '#0F172A',
    margin: '0 0 4px',
  },
  quoteFetchSubtitle: {
    fontSize: '0.8125rem',
    color: '#475569',
    margin: 0,
    lineHeight: '1.4',
  },
  periodTabsWrap: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '8px',
    marginBottom: '18px',
  },
  periodTabItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 12px',
    backgroundColor: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
    color: '#475569',
    fontWeight: '700',
    fontSize: '0.8125rem',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  periodTabItemActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
    color: '#FFFFFF',
    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
  },
  fetchControlsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    alignItems: 'flex-end',
    backgroundColor: '#F8FAFC',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid #E2E8F0',
  },
  fetchSelectGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: '170px',
  },
  fetchSelectLabel: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#475569',
  },
  fetchSelect: {
    padding: '9px 12px',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    backgroundColor: '#FFFFFF',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: '#0F172A',
    outline: 'none',
  },
  fetchActionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 20px',
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    borderRadius: '10px',
    border: 'none',
    fontWeight: '800',
    fontSize: '0.875rem',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
    width: '100%',
  },
  fetchActionBtnLoading: {
    opacity: 0.75,
    cursor: 'wait',
  },
  fetchErrorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: '10px',
    padding: '10px 14px',
    color: '#991B1B',
    fontSize: '0.8125rem',
    fontWeight: '600',
    marginTop: '12px',
  },
  fetchedResultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '14px',
    border: '2px solid #93C5FD',
    padding: '20px',
    marginTop: '20px',
    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.08)',
  },
  fetchedResultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '16px',
    paddingBottom: '14px',
    borderBottom: '1px solid #E2E8F0',
  },
  fetchedResultBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: '#DCFCE7',
    color: '#166534',
    padding: '3px 8px',
    borderRadius: '6px',
    fontSize: '0.6875rem',
    fontWeight: '800',
    marginBottom: '4px',
  },
  fetchedResultTitle: {
    fontSize: '1.0625rem',
    fontWeight: '800',
    color: '#0F172A',
    margin: '0 0 2px',
  },
  fetchedResultSub: {
    fontSize: '0.75rem',
    color: '#64748B',
    margin: 0,
  },
  fetchedActionsGroup: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  saveFetchedBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 14px',
    backgroundColor: '#16A34A',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '0.8125rem',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)',
  },
  exportFetchedBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 14px',
    backgroundColor: '#EFF6FF',
    color: '#2563EB',
    border: '1px solid #BFDBFE',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '0.8125rem',
    cursor: 'pointer',
  },
  periodKpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: '10px',
    marginBottom: '16px',
  },
  periodKpiItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: '10px',
    border: '1px solid #E2E8F0',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  periodKpiLabel: {
    fontSize: '0.6875rem',
    fontWeight: '700',
    color: '#64748B',
  },
  periodKpiVal: {
    fontSize: '1rem',
    fontWeight: '800',
    color: '#0F172A',
  },
  quoteSourceBadge: {
    display: 'inline-block',
    padding: '2px 6px',
    backgroundColor: '#F1F5F9',
    color: '#334155',
    borderRadius: '4px',
    fontSize: '0.6875rem',
    fontWeight: '600',
  },
  secNumText: {
    fontSize: '0.6875rem',
    color: '#64748B',
    fontWeight: '600',
    marginTop: '2px',
  },
  snapshotItemsSubTr: {
    backgroundColor: '#F8FAFC',
    borderBottom: '2px solid #CBD5E1',
  },
  snapshotItemsSubTd: {
    padding: '12px 16px',
  },
};
