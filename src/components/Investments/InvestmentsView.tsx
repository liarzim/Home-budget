import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  InvestmentAsset,
  InvestmentTranche,
  InvestmentTrancheType,
  SecurityType,
  InvestmentPeriodicSnapshot,
  InvestmentSnapshotItem,
  SecurityDailyPrice,
  ManagementPillar,
} from '../../lib/types';
import { supabase } from '../../lib/supabase';
import { calculateAssetMetrics } from './investmentMetrics';
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
  AlertCircle,
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
  Landmark,
  PieChart,
  ArrowUpDown,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { fetchAssetQuote, fetchBatchAssetQuotes, fetchUsdIlsRate, MarketQuoteResult } from '../../lib/quotesService';
import { formatDate, normalizeToISODate, healSnapshotDate, isDuplicateTranche, sortTranchesByDateDesc, sortTranchesByDateAsc } from '../../lib/i18n';
import { IsraeliDateInput } from '../common/IsraeliDateInput';
import { InvestmentsCharts } from './InvestmentsCharts';
import { InvestmentsSnapshotsTree } from './InvestmentsSnapshotsTree';
import { TranchesImportModal } from './TranchesImportModal';
import { BankDepositsView } from './BankDepositsView';
import { PensionFundsView } from './PensionFundsView';
import { InvestmentsOverview } from './InvestmentsOverview';
import * as XLSX from 'xlsx';

const HEBREW_MONTH_NAMES = [
  '',
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

export const getEffectiveSecurityNumber = (asset?: {
  security_number?: string | null;
  ticker?: string;
}): string => {
  if (!asset) return '';
  if (asset.security_number && String(asset.security_number).trim() !== '') {
    return String(asset.security_number).trim();
  }
  const ticker = String(asset.ticker || '').trim();
  if (/^\d+$/.test(ticker)) {
    return ticker;
  }
  return '';
};

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
    updateInvestmentTranche,
    deleteInvestmentTranche,
    saveInvestments,
    isDemoDataCleared,
    activeHousehold,
    language,
    dir,
  } = useAuth();

  const isHe = language === 'he';

  // Currency view toggle: 'original' | 'ILS' | 'USD'
  const [currencyMode, setCurrencyMode] = useState<'original' | 'ILS' | 'USD'>('original');
  const [usdRate, setUsdRate] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('investments_usd_rate');
      return saved ? parseFloat(saved) || 3.70 : 3.70;
    } catch {
      return 3.70;
    }
  }); // 1 USD = X ILS
  const [isRateEditing, setIsRateEditing] = useState<boolean>(false);

  // Active view tab: 'portfolio' (תיק שוטף) | 'snapshots' (סגירות תקופה ודוחות) | 'charts' (גרפים וניתוח תשואות) | 'daily_prices' (שערי סוף יום)
  const [activeSubTab, setActiveSubTab] = useState<'portfolio' | 'snapshots' | 'charts' | 'daily_prices'>('portfolio');

  // Active Management Pillar ('overview' | 'meitav' | 'bank_securities' | 'bank_deposits' | 'pension_provident')
  const [activePillar, setActivePillar] = useState<'overview' | ManagementPillar>('meitav');

  // Filtered lists for each pillar
  const currentSecurities = useMemo(() => {
    if (activePillar === 'bank_securities') {
      return investments.filter((a) => a.management_pillar === 'bank_securities');
    }
    // Default / Pillar 1 (meitav): all assets that are 'meitav' or unspecified
    return investments.filter((a) => !a.management_pillar || a.management_pillar === 'meitav');
  }, [investments, activePillar]);

  const bankDeposits = useMemo(() => {
    return investments.filter((a) => a.management_pillar === 'bank_deposits');
  }, [investments]);

  const pensionFunds = useMemo(() => {
    return investments.filter((a) => a.management_pillar === 'pension_provident');
  }, [investments]);

  // Expanded asset rows (to view purchase tranches)
  const [expandedAssetIds, setExpandedAssetIds] = useState<Record<string, boolean>>({});

  // Additional form state for bank securities
  const [formBankInstitution, setFormBankInstitution] = useState<string>('בנק הפועלים');
  const [formBankCustodyFee, setFormBankCustodyFee] = useState<string>('0.1');

  // Load modal draft synchronously on initial render if user was in the middle of filling
  const initialModalDraft = useMemo(() => {
    try {
      const raw = sessionStorage.getItem('investments_modal_draft');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(() => Boolean(initialModalDraft?.isModalOpen));
  const [modalMode, setModalMode] = useState<'new_asset' | 'edit_asset' | 'add_tranche' | 'edit_tranche'>(() => initialModalDraft?.modalMode || 'new_asset');
  const [selectedAssetIdForTranche, setSelectedAssetIdForTranche] = useState<string>(() => initialModalDraft?.selectedAssetIdForTranche || '');
  const [selectedTrancheId, setSelectedTrancheId] = useState<string>(() => initialModalDraft?.selectedTrancheId || '');
  const [selectedTrancheIndex, setSelectedTrancheIndex] = useState<number>(() => initialModalDraft?.selectedTrancheIndex ?? -1);

  // Snapshot Modal State
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
  const [snapshotPeriodType, setSnapshotPeriodType] = useState<'month' | 'quarter' | 'year' | 'current'>('month');
  const [snapshotLabel, setSnapshotLabel] = useState<string>('');
  const [snapshotDate, setSnapshotDate] = useState<string>(formatDate(new Date()));
  const [snapshotNotes, setSnapshotNotes] = useState<string>('');

  // Form Fields
  const [formTicker, setFormTicker] = useState<string>(() => initialModalDraft?.formTicker || '');
  const [formSecurityNumber, setFormSecurityNumber] = useState<string>(() => initialModalDraft?.formSecurityNumber || '');
  const [formName, setFormName] = useState<string>(() => initialModalDraft?.formName || '');
  const [formCurrency, setFormCurrency] = useState<'USD' | 'ILS'>(() => initialModalDraft?.formCurrency || 'USD');
  const [formAssetType, setFormAssetType] = useState<SecurityType>(() => initialModalDraft?.formAssetType || 'stock');
  const [formCurrentPrice, setFormCurrentPrice] = useState<string>(() => initialModalDraft?.formCurrentPrice || '');
  const [formDate, setFormDate] = useState<string>(() => initialModalDraft?.formDate || formatDate(new Date()));
  const [formShares, setFormShares] = useState<string>(() => initialModalDraft?.formShares || '');
  const [formPricePerShare, setFormPricePerShare] = useState<string>(() => initialModalDraft?.formPricePerShare || '');
  const [formTotalCost, setFormTotalCost] = useState<string>(() => initialModalDraft?.formTotalCost || '');
  const [formFee, setFormFee] = useState<string>(() => initialModalDraft?.formFee || '0');
  const [formNotes, setFormNotes] = useState<string>(() => initialModalDraft?.formNotes || '');
  const [formTrancheType, setFormTrancheType] = useState<InvestmentTrancheType>('buy');
  const [trancheSortOrder, setTrancheSortOrder] = useState<Record<string, 'asc' | 'desc'>>({});
  const [isPriceInAgorot, setIsPriceInAgorot] = useState<boolean>(() => {
    if (initialModalDraft?.isPriceInAgorot !== undefined) {
      return Boolean(initialModalDraft.isPriceInAgorot);
    }
    return (initialModalDraft?.formCurrency || 'USD') === 'ILS';
  });

  // Inline Quick Price Edit
  const [editingPriceAssetId, setEditingPriceAssetId] = useState<string | null>(null);
  const [inlinePriceInput, setInlinePriceInput] = useState<string>('');

  // Inline Quick Date Edit for Tranches
  const [editingDateTrancheKey, setEditingDateTrancheKey] = useState<string | null>(null);
  const [inlineDateInput, setInlineDateInput] = useState<string>('');

  // Tranches Excel / CSV Import Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTargetAsset, setImportTargetAsset] = useState<InvestmentAsset | null>(null);
  const [actionFeedbackMsg, setActionFeedbackMsg] = useState<string | null>(null);

  // Info Accordion toggle
  const [isFormulaExpanded, setIsFormulaExpanded] = useState<boolean>(false);

  // Live Quotes Refresh
  const [isRefreshingQuotes, setIsRefreshingQuotes] = useState<boolean>(false);
  const [quotesRefreshMessage, setQuotesRefreshMessage] = useState<string | null>(null);
  const [lastQuotesRefreshTime, setLastQuotesRefreshTime] = useState<string | null>(() => {
    try {
      return localStorage.getItem('investments_last_quotes_refresh') || null;
    } catch {
      return null;
    }
  });

  const formatLastRefreshTime = (isoStr: string | null): string => {
    if (!isoStr) return isHe ? 'טרם עודכן' : 'Not yet';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const dateStr = d.toLocaleDateString(isHe ? 'he-IL' : 'en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const timeStr = d.toLocaleTimeString(isHe ? 'he-IL' : 'en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return `${dateStr}, ${timeStr}`;
    } catch {
      return isoStr;
    }
  };

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
  const [batchProgress, setBatchProgress] = useState<{
    isRunning: boolean;
    title: string;
    currentMonthName: string;
    currentIndex: number;
    totalCount: number;
  } | null>(null);
  const [expandedSnapshotId, setExpandedSnapshotId] = useState<string | null>(null);
  const [hideZeroSharesInPeriod, setHideZeroSharesInPeriod] = useState<boolean>(true);

  // Periodic Snapshots State (stored in localStorage)
  const [snapshots, setSnapshots] = useState<InvestmentPeriodicSnapshot[]>(() => {
    try {
      const saved = localStorage.getItem('household_investment_snapshots');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Purge any mock/sample/empty snapshots automatically and heal dates
          let hasModified = false;
          const userOnlySnapshots = parsed
            .filter(
              (s: any) =>
                s.id &&
                !s.id.startsWith('snap-2026-') &&
                !s.id.startsWith('snap-2025-') &&
                !s.id.includes('sample') &&
                ((Number(s.total_invested) > 0 || Number(s.total_value) > 0) && (s.items && s.items.length > 0))
            )
            .map((s: any) => {
              const cleanDate = healSnapshotDate(s);
              if (cleanDate !== s.date) {
                hasModified = true;
                return { ...s, date: cleanDate };
              }
              return s;
            });
          if (hasModified || userOnlySnapshots.length !== parsed.length) {
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

  // Dynamically derive the latest refresh timestamp directly from the database objects (investments & snapshots)
  // so that all devices (PC, Mobile, Tablet) always see the actual time the DB was updated!
  const effectiveLastRefreshTime = useMemo(() => {
    let latest: string | null = null;
    for (const inv of (investments || [])) {
      if (inv.updated_at) {
        if (!latest || inv.updated_at.localeCompare(latest) > 0) {
          latest = inv.updated_at;
        }
      }
    }
    for (const snap of (snapshots || [])) {
      const t: string | undefined = (snap as any).updated_at || (snap as any).created_at;
      if (t) {
        if (!latest || t.localeCompare(latest) > 0) {
          latest = t;
        }
      }
    }
    if (lastQuotesRefreshTime) {
      if (!latest || lastQuotesRefreshTime.localeCompare(latest) > 0) {
        latest = lastQuotesRefreshTime;
      }
    }
    return latest;
  }, [investments, snapshots, lastQuotesRefreshTime]);

  const saveSnapshots = async (newList: InvestmentPeriodicSnapshot[]) => {
    const sanitizedList = newList.map((s) => ({
      ...s,
      date: healSnapshotDate(s),
    }));
    setSnapshots(sanitizedList);
    try {
      localStorage.setItem('household_investment_snapshots', JSON.stringify(sanitizedList));
    } catch (e) {
      console.error(e);
    }
    if (activeHousehold?.id) {
      try {
        const toUpsert = sanitizedList.map((s) => ({
          id: s.id,
          household_id: activeHousehold.id,
          period_type: s.period_type,
          period_label: s.period_label,
          date: s.date,
          items: s.items || [],
          total_invested: s.total_invested,
          total_value: s.total_value,
          total_profit: s.total_profit,
          total_return_pct: s.total_return_pct,
          updated_at: new Date().toISOString(),
        }));
        await supabase.from('investment_snapshots').upsert(toUpsert, { onConflict: 'id' });
      } catch (dbErr) {
        console.warn('Could not sync snapshots to Supabase:', dbErr);
      }
    }
  };

  // Daily closing prices state (from security_daily_prices table)
  const [dailyPrices, setDailyPrices] = useState<SecurityDailyPrice[]>([]);
  const [isLoadingDailyPrices, setIsLoadingDailyPrices] = useState<boolean>(false);
  const [isSyncingDailyQuotes, setIsSyncingDailyQuotes] = useState<boolean>(false);
  const [dailySyncStatusMsg, setDailySyncStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [dailyPriceSearch, setDailyPriceSearch] = useState<string>('');

  // Load investments from Supabase on mount / household change / window focus
  const loadDbInvestments = useCallback(async () => {
    if (!activeHousehold?.id) return;
    try {
      const { data: invs, error } = await supabase
        .from('investments')
        .select('*')
        .eq('household_id', activeHousehold.id);

      if (!error && invs && invs.length > 0) {
        const formattedInvs: InvestmentAsset[] = invs.map((inv: any) => {
          const ticker = String(inv.ticker || '').trim();
          const secNum = inv.security_number || (/^\d+$/.test(ticker) ? ticker : null);
          return {
            ...inv,
            security_number: secNum,
            tranches: inv.tranches ? sortTranchesByDateDesc(inv.tranches) : [],
          };
        });
        saveInvestments(formattedInvs);
      }
    } catch (err) {
      console.warn('Error loading investments from Supabase:', err);
    }
  }, [activeHousehold?.id, saveInvestments]);

  // Load snapshots from Supabase on mount / household change
  const loadDbSnapshots = useCallback(async () => {
    if (!activeHousehold?.id) return;
    try {
      const { data, error } = await supabase
        .from('investment_snapshots')
        .select('*')
        .eq('household_id', activeHousehold.id)
        .order('date', { ascending: true });

      if (!error && data && data.length > 0) {
        let hasHealedDb = false;
        const dbSnaps: InvestmentPeriodicSnapshot[] = data.map((d: any) => {
          const cleanDate = healSnapshotDate(d);
          if (cleanDate !== d.date) {
            hasHealedDb = true;
          }
          return {
            id: d.id,
            household_id: d.household_id,
            period_type: d.period_type,
            period_label: d.period_label,
            date: cleanDate,
            items: d.items || [],
            total_invested: Number(d.total_invested) || 0,
            total_value: Number(d.total_value) || 0,
            total_profit: Number(d.total_profit) || 0,
            total_return_pct: Number(d.total_return_pct) || 0,
            assets_count: Array.isArray(d.items) ? d.items.length : 0,
            notes: d.notes || undefined,
            updated_at: d.updated_at || undefined,
          };
        });

        if (hasHealedDb) {
          const toUpdate = dbSnaps.map((s) => ({
            id: s.id,
            household_id: activeHousehold.id,
            date: s.date,
            updated_at: new Date().toISOString(),
          }));
          try {
            await supabase.from('investment_snapshots').upsert(toUpdate, { onConflict: 'id' });
          } catch (healErr) {
            console.warn('Failed to heal snapshot dates in Supabase:', healErr);
          }
        }

        setSnapshots((prev) => {
          const map = new Map<string, InvestmentPeriodicSnapshot>();
          prev.forEach((s) => map.set(s.id, { ...s, date: healSnapshotDate(s) }));
          dbSnaps.forEach((s) => map.set(s.id, s));
          const merged = Array.from(map.values())
            .filter((s) => (Number(s.total_invested) > 0 || Number(s.total_value) > 0) && (s.items && s.items.length > 0))
            .sort((a, b) => a.date.localeCompare(b.date));
          localStorage.setItem('household_investment_snapshots', JSON.stringify(merged));
          return merged;
        });
      }
    } catch (err) {
      console.warn('Error loading snapshots from Supabase:', err);
    }
  }, [activeHousehold?.id]);

  // Load snapshots from DB once on mount or household change (strictly manual refresh on button click)
  useEffect(() => {
    loadDbSnapshots();
  }, [activeHousehold?.id]);

  // Load daily closing prices from security_daily_prices
  const loadDailyPrices = async () => {
    setIsLoadingDailyPrices(true);
    try {
      const { data, error } = await supabase
        .from('security_daily_prices')
        .select('*')
        .order('price_date', { ascending: false })
        .limit(300);

      if (!error && data) {
        setDailyPrices(data);
      }
    } catch (err) {
      console.warn('Error loading daily prices from Supabase:', err);
    } finally {
      setIsLoadingDailyPrices(false);
    }
  };

  useEffect(() => {
    loadDailyPrices();
  }, []);

  const triggerManualDailySync = async (forceMonthEnd: boolean = false) => {
    setIsSyncingDailyQuotes(true);
    setDailySyncStatusMsg({
      type: 'info',
      text: isHe
        ? (forceMonthEnd
            ? 'מבצע סגירת חודש יזומה: מושך שערים, מייצר סגירת חודש בעץ ומנקה נתוני יום מעבר ל-7 ימים...'
            : 'מושך שערי נעילה יומיים עבור כל הניירות הפעילים ומייצר סנפשוט...')
        : 'Fetching end-of-day quotes and generating snapshot...',
    });

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || '';

      const queryParams = new URLSearchParams();
      if (forceMonthEnd) queryParams.set('force_month_end', 'true');

      const res = await fetch(`/api/cron-daily-quotes?${queryParams.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          householdId: activeHousehold?.id,
          investments: investments,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const count = data.securitiesUpdated ?? data.securitiesCount ?? 0;
        let msg = isHe
          ? `✅ סנכרון סוף יום הצליח! עודכנו ${count} ניירות עבור תאריך ${data.date}.`
          : `✅ Daily sync succeeded! Updated ${count} securities for ${data.date}.`;

        if (data.monthlySnapshotsSaved > 0) {
          msg += isHe
            ? ` נוצרה סגירת חודש חדשה שהתווספה ישירות לעץ סגירות התקופה!`
            : ` Monthly snapshot created and added to snapshots tree!`;
        }
        if (data.cleanedOldDailyPrices || data.cleanedOldDailySnapshots) {
          msg += isHe
            ? ` בוצע ניקוי של נתוני עבר (נשמרו 7 הימים האחרונים).`
            : ` Older daily records cleaned (retained last 7 days).`;
        }
        if (data.dailyPricesWarning) {
          msg += isHe
            ? ` (הסנפשוט נשמר בעץ! טבלת security_daily_prices דורשת יצירה ב-Adminer)`
            : ` (Snapshot saved! Table security_daily_prices pending Adminer creation)`;
        }

        setDailySyncStatusMsg({
          type: 'success',
          text: msg,
        });

        await loadDailyPrices();
        const nowIso = new Date().toISOString();
        setLastQuotesRefreshTime(nowIso);
        try {
          localStorage.setItem('investments_last_quotes_refresh', nowIso);
        } catch (err) {
          console.error(err);
        }
        if (activeHousehold?.id) {
          const { data: dbSnaps } = await supabase
            .from('investment_snapshots')
            .select('*')
            .eq('household_id', activeHousehold.id)
            .order('date', { ascending: true });
          if (dbSnaps && dbSnaps.length > 0) {
            const sanitized = dbSnaps.map((d: any) => ({
              ...d,
              date: normalizeToISODate(d.date),
            }));
            setSnapshots(sanitized);
            localStorage.setItem('household_investment_snapshots', JSON.stringify(sanitized));
          }
        }
      } else {
        setDailySyncStatusMsg({
          type: 'error',
          text: isHe
            ? `❌ שגיאה בסנכרון שערים: ${data.error || 'נכשל'}`
            : `❌ Sync error: ${data.error || 'Failed'}`,
        });
      }
    } catch (err: any) {
      setDailySyncStatusMsg({
        type: 'error',
        text: isHe ? `❌ תקלה בתקשורת עם השרת: ${err.message}` : `❌ Network error: ${err.message}`,
      });
    } finally {
      setIsSyncingDailyQuotes(false);
      setTimeout(() => {
        setDailySyncStatusMsg(null);
      }, 10000);
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

  // Helper calculation for an asset with support for sales (FIFO cost basis) delegated to shared module
  // (Uses calculateAssetMetrics from ./investmentMetrics)

  // Portfolio Totals in ILS
  const portfolioSummary = useMemo(() => {
    let totalInvestedILS = 0;
    let currentValueILS = 0;

    currentSecurities.forEach((asset) => {
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
  }, [currentSecurities, usdRate]);

  // Format currency value based on mode
  const formatVal = (
    amount: number,
    assetCurrency: 'USD' | 'ILS',
    forceCurrency?: 'ILS' | 'USD',
    maxDecimals: number = 2
  ) => {
    const targetCurr = forceCurrency || (currencyMode === 'original' ? assetCurrency : currencyMode);
    let convertedAmount = amount;

    if (currencyMode === 'ILS' && assetCurrency === 'USD') {
      convertedAmount = amount * usdRate;
    } else if (currencyMode === 'USD' && assetCurrency === 'ILS') {
      convertedAmount = amount / (usdRate || 1);
    }

    const symbol = targetCurr === 'USD' ? '$' : '₪';
    const isNegative = convertedAmount < 0;
    const absVal = Math.abs(convertedAmount);
    const hasMoreDecimals = maxDecimals > 2 && Math.abs(absVal - Number(absVal.toFixed(2))) > 0.0001;
    const absStr = absVal.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: hasMoreDecimals ? maxDecimals : 2,
    });
    return isNegative ? `-${symbol}${absStr}` : `${symbol}${absStr}`;
  };

  // Synchronize price per share and total cost in form



  // Save modal draft whenever form changes
  useEffect(() => {
    try {
      if (isModalOpen) {
        sessionStorage.setItem(
          'investments_modal_draft',
          JSON.stringify({
            isModalOpen: true,
            modalMode,
            selectedAssetIdForTranche,
            selectedTrancheId,
            selectedTrancheIndex,
            formTicker,
            formSecurityNumber,
            formName,
            formCurrency,
            formAssetType,
            formCurrentPrice,
            formDate,
            formShares,
            formPricePerShare,
            formTotalCost,
            formFee,
            formNotes,
            isPriceInAgorot,
          })
        );
      } else {
        sessionStorage.removeItem('investments_modal_draft');
      }
    } catch (e) {
      console.error('Failed to save modal draft:', e);
    }
  }, [
    isModalOpen,
    modalMode,
    selectedAssetIdForTranche,
    selectedTrancheId,
    selectedTrancheIndex,
    formTicker,
    formSecurityNumber,
    formName,
    formCurrency,
    formAssetType,
    formCurrentPrice,
    formDate,
    formShares,
    formPricePerShare,
    formTotalCost,
    formFee,
    formNotes,
    isPriceInAgorot,
  ]);

  const handleSharesChange = (val: string) => {
    setFormShares(val);
    const s = parseFloat(val);
    const p = parseFloat(formPricePerShare);
    if (s > 0 && p >= 0) {
      const effectiveUnitPrice = (formCurrency === 'ILS' && isPriceInAgorot) ? p / 100 : p;
      setFormTotalCost((s * effectiveUnitPrice).toFixed(2));
    }
  };

  const handlePricePerShareChange = (val: string) => {
    setFormPricePerShare(val);
    const s = parseFloat(formShares);
    const p = parseFloat(val);
    if (s > 0 && p >= 0) {
      const effectiveUnitPrice = (formCurrency === 'ILS' && isPriceInAgorot) ? p / 100 : p;
      setFormTotalCost((s * effectiveUnitPrice).toFixed(2));
    }
  };

  const handleTotalCostChange = (val: string) => {
    setFormTotalCost(val);
    const s = parseFloat(formShares);
    const total = parseFloat(val);
    if (s > 0 && total >= 0) {
      const unitPrice = total / s;
      if (formCurrency === 'ILS' && isPriceInAgorot) {
        setFormPricePerShare((unitPrice * 100).toFixed(2));
      } else {
        setFormPricePerShare(unitPrice.toFixed(2));
      }
    }
  };

  const handleTogglePriceInAgorot = (checked: boolean) => {
    setIsPriceInAgorot(checked);
    const currentPrice = parseFloat(formPricePerShare);
    if (!isNaN(currentPrice) && currentPrice > 0) {
      if (checked) {
        // From Shekels to Agorot: multiply by 100 (e.g. 19.40 -> 1940)
        setFormPricePerShare((currentPrice * 100).toFixed(2));
      } else {
        // From Agorot to Shekels: divide by 100 (e.g. 1940 -> 19.40)
        setFormPricePerShare((currentPrice / 100).toFixed(2));
      }
    }
  };

  const handleOpenAddModal = (mode: 'new_asset' | 'add_tranche', asset?: InvestmentAsset) => {
    setModalMode(mode);
    setSelectedTrancheId('');
    if (mode === 'add_tranche' && asset) {
      setSelectedAssetIdForTranche(asset.id);
      setFormTicker(asset.ticker);
      setFormSecurityNumber(getEffectiveSecurityNumber(asset));
      setFormName(asset.name);
      setFormCurrency(asset.currency);
      setFormCurrentPrice(asset.current_price.toString());
      setFormAssetType(asset.asset_type);
      setIsPriceInAgorot(asset.currency === 'ILS');
    } else {
      setSelectedAssetIdForTranche('');
      setFormTicker('');
      setFormSecurityNumber('');
      setFormName('');
      setFormCurrency('USD');
      setFormAssetType('stock');
      setFormCurrentPrice('');
      setIsPriceInAgorot(false);
    }
    setFormDate(formatDate(new Date()));
    setFormShares('');
    setFormPricePerShare('');
    setFormTotalCost('');
    setFormFee('0');
    setFormNotes('');
    setFormTrancheType('buy');
    setIsModalOpen(true);
  };

  const handleOpenEditAssetModal = (asset: InvestmentAsset) => {
    setModalMode('edit_asset');
    setSelectedAssetIdForTranche(asset.id);
    setSelectedTrancheId('');
    setFormTicker(asset.ticker);
    setFormSecurityNumber(getEffectiveSecurityNumber(asset));
    setFormName(asset.name);
    setFormCurrency(asset.currency);
    setFormAssetType(asset.asset_type);
    setFormCurrentPrice(asset.current_price.toString());
    setIsModalOpen(true);
  };

  const handleOpenEditTrancheModal = (
    asset: InvestmentAsset,
    tranche: InvestmentTranche,
    trancheIndex: number
  ) => {
    setModalMode('edit_tranche');
    setSelectedAssetIdForTranche(asset.id);
    setSelectedTrancheId(tranche.id ? String(tranche.id) : String(trancheIndex));
    setSelectedTrancheIndex(trancheIndex);
    setFormTicker(asset.ticker);
    setFormSecurityNumber(getEffectiveSecurityNumber(asset));
    setFormName(asset.name);
    setFormCurrency(asset.currency);
    setFormAssetType(asset.asset_type);
    setFormCurrentPrice(asset.current_price.toString());

    // Set formDate in user-friendly DD/MM/YYYY
    setFormDate(tranche.date ? formatDate(tranche.date) : formatDate(new Date()));
    setFormShares(Math.abs(tranche.shares).toString());
    setFormTrancheType(tranche.type || (tranche.shares < 0 ? 'sell' : 'buy'));

    // Existing tranches in the database are already stored in Shekels (never auto-toggle Agorot)
    setIsPriceInAgorot(false);
    setFormPricePerShare(tranche.price_per_share.toString());
    const effectiveUnitPrice = tranche.price_per_share;
    const cost = tranche.total_cost !== undefined ? tranche.total_cost : Math.abs(tranche.shares) * effectiveUnitPrice;
    setFormTotalCost(cost.toFixed(2));
    setFormFee((tranche.fee || 0).toString());
    setFormNotes(tranche.notes || '');
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Mode: Edit Asset metadata
    if (modalMode === 'edit_asset' && selectedAssetIdForTranche) {
      if (!formTicker.trim()) {
        alert(isHe ? 'אנא הזן סימול נייר' : 'Please enter a ticker');
        return;
      }
      let curPrice = parseFloat(formCurrentPrice);
      if (formCurrency === 'ILS' && !isNaN(curPrice) && isPriceInAgorot) {
        curPrice = Number((curPrice / 100).toFixed(4));
      }
      const resolvedSecNum = formSecurityNumber.trim() || (/^\d+$/.test(formTicker.trim()) ? formTicker.trim() : undefined);
      updateInvestmentAsset(selectedAssetIdForTranche, {
        ticker: formTicker.trim().toUpperCase(),
        security_number: resolvedSecNum,
        name: formName.trim() || formTicker.trim().toUpperCase(),
        currency: formCurrency,
        asset_type: formAssetType,
        ...(!isNaN(curPrice) && curPrice > 0 ? { current_price: curPrice } : {}),
      });
      setIsModalOpen(false);
      return;
    }

    const sharesNum = parseFloat(formShares);
    const priceNum = parseFloat(formPricePerShare);
    const feeNum = parseFloat(formFee) || 0;
    const effectivePrice = (formCurrency === 'ILS' && isPriceInAgorot) ? priceNum / 100 : priceNum;
    const curPriceInput = parseFloat(formCurrentPrice);
    let currentPriceNum = !isNaN(curPriceInput) && curPriceInput > 0 ? curPriceInput : effectivePrice;
    if (formCurrency === 'ILS' && isPriceInAgorot) {
      currentPriceNum = Number((currentPriceNum / 100).toFixed(4));
    }
    const totalCostNum = parseFloat(formTotalCost) || (sharesNum * effectivePrice);

    if (isNaN(sharesNum) || sharesNum <= 0 || isNaN(priceNum) || priceNum < 0) {
      alert(isHe ? 'אנא הזן כמות מניות ומחיר רכישה תקינים' : 'Please enter valid shares and price');
      return;
    }

    // Ensure date is standardized to YYYY-MM-DD for DB and calculations
    const cleanDate = normalizeToISODate(formDate);

    if (modalMode === 'new_asset') {
      if (!formTicker.trim()) {
        alert(isHe ? 'אנא הזן סימול נייר' : 'Please enter a ticker');
        return;
      }
      const resolvedNewSecNum = formSecurityNumber.trim() || (/^\d+$/.test(formTicker.trim()) ? formTicker.trim() : undefined);
      addInvestmentAsset({
        household_id: activeHousehold?.id || 'hh-main',
        management_pillar: activePillar === 'bank_securities' ? 'bank_securities' : 'meitav',
        institution: activePillar === 'bank_securities' ? formBankInstitution : 'מיטב טרייד',
        bank_custody_fee_pct: activePillar === 'bank_securities' ? parseFloat(formBankCustodyFee) || 0 : undefined,
        ticker: formTicker.trim().toUpperCase(),
        security_number: resolvedNewSecNum,
        name: formName.trim() || formTicker.trim().toUpperCase(),
        currency: formCurrency,
        current_price: currentPriceNum,
        asset_type: formAssetType,
        target_allocation_pct: 0,
        tranches: [
          {
            id: `tr-${Date.now()}`,
            date: cleanDate,
            shares: sharesNum,
            price_per_share: effectivePrice,
            total_cost: totalCostNum,
            fee: feeNum,
            notes: formNotes.trim() || (formCurrency === 'ILS' && isPriceInAgorot ? `שער מקורי: ${priceNum} אג'` : undefined),
          },
        ],
      });

      setActionFeedbackMsg(
        isHe
          ? `הנייר ${formTicker.trim().toUpperCase()} נוסף בהצלחה לתיק!`
          : `Asset ${formTicker.trim().toUpperCase()} added successfully!`
      );
      setTimeout(() => setActionFeedbackMsg(null), 4000);
    } else if (modalMode === 'add_tranche' && selectedAssetIdForTranche) {
      const numShares = Math.abs(sharesNum);
      const finalShares = formTrancheType === 'sell' ? -numShares : numShares;

      addInvestmentTranche(
        selectedAssetIdForTranche,
        {
          date: cleanDate,
          shares: finalShares,
          price_per_share: effectivePrice,
          total_cost: totalCostNum,
          fee: feeNum,
          type: formTrancheType,
          notes: formNotes.trim() || (formCurrency === 'ILS' && isPriceInAgorot ? `שער מקורי: ${priceNum} אג'` : undefined),
        },
        !isNaN(currentPriceNum) && currentPriceNum > 0 ? currentPriceNum : undefined
      );

      // Automatically expand this asset so the user sees their new tranche immediately
      setExpandedAssetIds((prev) => ({
        ...prev,
        [selectedAssetIdForTranche]: true,
      }));

      setActionFeedbackMsg(
        isHe
          ? formTrancheType === 'sell' ? 'פעולת המכירה נרשמה בהצלחה ביומן הנייר!' : 'פעימת הרכישה נוספה בהצלחה לתיק!'
          : formTrancheType === 'sell' ? 'Sale transaction recorded successfully!' : 'Purchase tranche added successfully!'
      );
      setTimeout(() => setActionFeedbackMsg(null), 4000);
    } else if (modalMode === 'edit_tranche' && selectedAssetIdForTranche) {
      const numShares = Math.abs(sharesNum);
      const finalShares = formTrancheType === 'sell' ? -numShares : numShares;
      const targetTrancheKey = selectedTrancheId || (selectedTrancheIndex >= 0 ? String(selectedTrancheIndex) : '0');
      updateInvestmentTranche(
        selectedAssetIdForTranche,
        targetTrancheKey,
        {
          date: cleanDate,
          shares: finalShares,
          price_per_share: effectivePrice,
          total_cost: totalCostNum,
          fee: feeNum,
          type: formTrancheType,
          notes: formNotes.trim() || undefined,
        },
        !isNaN(currentPriceNum) && currentPriceNum > 0 ? currentPriceNum : undefined,
        selectedTrancheIndex >= 0 ? selectedTrancheIndex : undefined
      );

      setExpandedAssetIds((prev) => ({
        ...prev,
        [selectedAssetIdForTranche]: true,
      }));

      setActionFeedbackMsg(
        isHe
          ? `פעולת ${formTrancheType === 'sell' ? 'המכירה' : 'הרכישה'} עודכנה בהצלחה (תאריך: ${formatDate(cleanDate)})`
          : `Tranche updated successfully (Date: ${formatDate(cleanDate)})`
      );
      setTimeout(() => setActionFeedbackMsg(null), 4000);
    }

    setIsModalOpen(false);
  };

  // Detect any ILS tranches that were saved in Agorot (e.g. 40x current market price or astronomical >= 10,000)
  const suspectedAgorotTranches = useMemo(() => {
    const list: {
      assetId: string;
      assetTicker: string;
      assetName: string;
      trancheId: string;
      trancheIndex: number;
      price: number;
      shares: number;
      date: string;
    }[] = [];
    investments.forEach((asset) => {
      if (asset.currency === 'ILS') {
        asset.tranches.forEach((tr, idx) => {
          // If user previously chose NOT to fix this tranche, skip it permanently
          if (tr.ignore_agorot_fix) return;
          // Never flag tranches that were already converted to Shekels
          if (tr.notes?.includes('חולק ב-100') || tr.notes?.includes('תוקן מאגורות')) return;

          const isSuspected =
            (asset.current_price > 0 && tr.price_per_share / asset.current_price >= 40) ||
            tr.price_per_share >= 10000;

          if (isSuspected) {
            list.push({
              assetId: asset.id,
              assetTicker: asset.ticker,
              assetName: asset.name || asset.ticker,
              trancheId: tr.id ? String(tr.id) : String(idx),
              trancheIndex: idx,
              price: tr.price_per_share,
              shares: tr.shares,
              date: tr.date,
            });
          }
        });
      }
    });
    return list;
  }, [investments]);

  // Detect any ILS assets whose current_price appears to be in Agorot (e.g. >= 40x avg buy price or >= 10,000)
  const suspectedAgorotCurrentPrices = useMemo(() => {
    return investments.filter((asset) => {
      if (asset.currency !== 'ILS') return false;
      if (!asset.current_price || asset.current_price <= 0) return false;
      const validTranches = asset.tranches.filter((t) => t.shares > 0 && t.price_per_share > 0);
      const totalCost = validTranches.reduce((sum, t) => sum + t.shares * t.price_per_share, 0);
      const totalShares = validTranches.reduce((sum, t) => sum + t.shares, 0);
      const avgBuy = totalShares > 0 ? totalCost / totalShares : 0;

      if (avgBuy > 0 && asset.current_price / avgBuy >= 40) return true;
      if (avgBuy === 0 && asset.current_price >= 10000) return true;
      return false;
    });
  }, [investments]);

  // Group suspected items by asset for clear display in list
  const suspectedAssetsSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        assetId: string;
        ticker: string;
        name: string;
        currentPriceSuspected: boolean;
        currentPrice: number;
        avgBuyPrice: number;
        tranches: { trancheId: string; trancheIndex: number; date: string; shares: number; price: number }[];
      }
    >();

    suspectedAgorotTranches.forEach((item) => {
      if (!map.has(item.assetId)) {
        const asset = investments.find(a => a.id === item.assetId);
        map.set(item.assetId, {
          assetId: item.assetId,
          ticker: item.assetTicker,
          name: item.assetName,
          currentPriceSuspected: false,
          currentPrice: asset?.current_price || 0,
          avgBuyPrice: 0,
          tranches: [],
        });
      }
      map.get(item.assetId)!.tranches.push({
        trancheId: item.trancheId,
        trancheIndex: item.trancheIndex,
        date: item.date,
        shares: item.shares,
        price: item.price,
      });
    });

    suspectedAgorotCurrentPrices.forEach((asset) => {
      const validTranches = asset.tranches.filter((t) => t.shares > 0 && t.price_per_share > 0);
      const totalCost = validTranches.reduce((sum, t) => sum + t.shares * t.price_per_share, 0);
      const totalShares = validTranches.reduce((sum, t) => sum + t.shares, 0);
      const avgBuy = totalShares > 0 ? totalCost / totalShares : 0;

      if (!map.has(asset.id)) {
        map.set(asset.id, {
          assetId: asset.id,
          ticker: asset.ticker,
          name: asset.name || asset.ticker,
          currentPriceSuspected: true,
          currentPrice: asset.current_price,
          avgBuyPrice: avgBuy,
          tranches: [],
        });
      } else {
        const entry = map.get(asset.id)!;
        entry.currentPriceSuspected = true;
        entry.currentPrice = asset.current_price;
        entry.avgBuyPrice = avgBuy;
      }
    });

    return Array.from(map.values());
  }, [suspectedAgorotTranches, suspectedAgorotCurrentPrices, investments]);

  // One-click batch repair for all suspected Agorot tranches and current prices in existing portfolio
  const handleAutoFixAgorotTranches = () => {
    if (suspectedAgorotTranches.length === 0 && suspectedAgorotCurrentPrices.length === 0) return;
    const updated = investments.map((asset) => {
      if (asset.currency !== 'ILS') return asset;
      const validTranches = asset.tranches.filter((t) => t.shares > 0 && t.price_per_share > 0);
      const totalCost = validTranches.reduce((sum, t) => sum + t.shares * t.price_per_share, 0);
      const totalShares = validTranches.reduce((sum, t) => sum + t.shares, 0);
      const avgBuy = totalShares > 0 ? totalCost / totalShares : 0;

      const newTranches = asset.tranches.map((tr) => {
        const isAlreadyConverted = tr.notes?.includes('חולק ב-100') || tr.notes?.includes('תוקן מאגורות');
        const isSuspected =
          !tr.ignore_agorot_fix &&
          !isAlreadyConverted &&
          ((asset.current_price > 0 && tr.price_per_share / asset.current_price >= 40) || tr.price_per_share >= 10000);

        if (isSuspected) {
          const newPrice = Number((tr.price_per_share / 100).toFixed(4));
          return {
            ...tr,
            price_per_share: newPrice,
            total_cost: Number((tr.shares * newPrice).toFixed(2)),
            notes: tr.notes ? `${tr.notes} | תוקן מאגורות (${tr.price_per_share})` : `שער מקורי: ${tr.price_per_share} אגורות`,
            ignore_agorot_fix: false,
          };
        }
        return tr;
      });

      // Also fix current_price if it was saved in Agorot (>= 40x avgBuy or >= 10,000)
      let newCurrentPrice = asset.current_price;
      if ((avgBuy > 0 && newCurrentPrice / avgBuy >= 40) || (avgBuy === 0 && newCurrentPrice >= 10000)) {
        newCurrentPrice = Number((newCurrentPrice / 100).toFixed(4));
      }

      return {
        ...asset,
        current_price: newCurrentPrice,
        tranches: newTranches,
      };
    });

    saveInvestments(updated);
    setActionFeedbackMsg(
      isHe
        ? `תוקנו בהצלחה שערי השוק והפעימות השקליות (חולקו ב-100 לשקלים)!`
        : `Successfully converted Shekel prices and tranches to ILS (divided by 100)!`
    );
    setTimeout(() => setActionFeedbackMsg(null), 5000);
  };

  // Fix a single asset current price
  const handleFixCurrentPriceOnly = (assetId: string, currentPrice: number) => {
    const newPrice = Number((currentPrice / 100).toFixed(4));
    updateInvestmentAsset(assetId, { current_price: newPrice });
    setActionFeedbackMsg(
      isHe
        ? `שער נוכחי חולק ב-100 ועודכן לשקלים (₪${newPrice.toFixed(2)})!`
        : `Current price divided by 100 to ₪${newPrice.toFixed(2)}!`
    );
    setTimeout(() => setActionFeedbackMsg(null), 4000);
  };

  // Count duplicate tranches in a specific asset
  const getAssetDuplicateCount = (asset: InvestmentAsset): number => {
    const seen: InvestmentTranche[] = [];
    let dups = 0;
    (asset.tranches || []).forEach((t) => {
      if (seen.some((s) => isDuplicateTranche(s, t))) {
        dups++;
      } else {
        seen.push(t);
      }
    });
    return dups;
  };

  // Remove duplicate tranches from a specific asset
  const handleRemoveDuplicateTranches = (assetId: string) => {
    const asset = investments.find((a) => a.id === assetId);
    if (!asset) return;
    const seen: InvestmentTranche[] = [];
    const uniqueTranches: InvestmentTranche[] = [];
    let removedCount = 0;

    (asset.tranches || []).forEach((t) => {
      if (seen.some((s) => isDuplicateTranche(s, t))) {
        removedCount++;
      } else {
        seen.push(t);
        uniqueTranches.push(t);
      }
    });

    if (removedCount === 0) return;

    const updated = investments.map((a) =>
      a.id === assetId ? { ...a, tranches: uniqueTranches } : a
    );
    saveInvestments(updated);
    setActionFeedbackMsg(
      isHe
        ? `נוקו בהצלחה ${removedCount} פעימות כפולות עבור ${asset.ticker}!`
        : `Successfully removed ${removedCount} duplicate tranches for ${asset.ticker}!`
    );
    setTimeout(() => setActionFeedbackMsg(null), 4000);
  };

  // Total duplicate tranches across all assets in portfolio
  const totalDuplicateTranchesCount = useMemo(() => {
    let count = 0;
    investments.forEach((asset) => {
      count += getAssetDuplicateCount(asset);
    });
    return count;
  }, [investments]);

  // Batch remove all duplicate tranches across the whole portfolio
  const handleRemoveAllDuplicateTranches = () => {
    let totalRemoved = 0;
    const updated = investments.map((asset) => {
      const seen: InvestmentTranche[] = [];
      const uniqueTranches: InvestmentTranche[] = [];
      (asset.tranches || []).forEach((t) => {
        if (seen.some((s) => isDuplicateTranche(s, t))) {
          totalRemoved++;
        } else {
          seen.push(t);
          uniqueTranches.push(t);
        }
      });
      return { ...asset, tranches: uniqueTranches };
    });

    if (totalRemoved === 0) return;
    saveInvestments(updated);
    setActionFeedbackMsg(
      isHe
        ? `נוקו בהצלחה ${totalRemoved} פעימות כפולות מכל תיק ההשקעות!`
        : `Successfully removed ${totalRemoved} duplicate tranches from portfolio!`
    );
    setTimeout(() => setActionFeedbackMsg(null), 5000);
  };

  // Fix a single tranche
  const handleFixSingleTranche = (
    assetId: string,
    trancheId: string,
    trancheIndex: number,
    currentPrice: number,
    shares: number
  ) => {
    const newPrice = Number((currentPrice / 100).toFixed(4));
    const targetKey = trancheId || (trancheIndex >= 0 ? String(trancheIndex) : '0');
    updateInvestmentTranche(
      assetId,
      targetKey,
      {
        price_per_share: newPrice,
        total_cost: Number((shares * newPrice).toFixed(2)),
        notes: `שער מקורי: ${currentPrice} אגורות (חולק ב-100)`,
        ignore_agorot_fix: false,
      },
      undefined,
      trancheIndex >= 0 ? trancheIndex : undefined
    );
    setActionFeedbackMsg(
      isHe
        ? `הפעימה חולקה ב-100 ותוקנה בהצלחה לשער ₪${newPrice.toFixed(2)}!`
        : `Tranche converted successfully to ₪${newPrice.toFixed(2)}!`
    );
    setTimeout(() => setActionFeedbackMsg(null), 4000);
  };

  // User chose NOT to fix a specific tranche: mark ignore_agorot_fix = true so it never shows again
  const handleIgnoreSingleTranche = (
    assetId: string,
    trancheId: string,
    trancheIndex: number
  ) => {
    const targetKey = trancheId || (trancheIndex >= 0 ? String(trancheIndex) : '0');
    updateInvestmentTranche(
      assetId,
      targetKey,
      {
        ignore_agorot_fix: true,
      },
      undefined,
      trancheIndex >= 0 ? trancheIndex : undefined
    );
    setActionFeedbackMsg(
      isHe
        ? 'הפעימה סומנה כנכונה ולא תוצג שוב לתיקון.'
        : 'Tranche marked as correct and will not be suggested again.'
    );
    setTimeout(() => setActionFeedbackMsg(null), 4000);
  };

  // User chose NOT to fix all currently identified tranches: mark them all with ignore_agorot_fix = true
  const handleIgnoreAllAgorotTranches = () => {
    if (suspectedAgorotTranches.length === 0) return;
    const updated = investments.map((asset) => {
      if (asset.currency !== 'ILS') return asset;
      const newTranches = asset.tranches.map((tr, idx) => {
        const isSuspected = suspectedAgorotTranches.some(
          (s) =>
            s.assetId === asset.id &&
            (s.trancheId === tr.id || s.trancheIndex === idx || (s.price === tr.price_per_share && s.date === tr.date))
        );
        if (isSuspected) {
          return {
            ...tr,
            ignore_agorot_fix: true,
          };
        }
        return tr;
      });

      return {
        ...asset,
        tranches: newTranches,
      };
    });

    saveInvestments(updated);
    setActionFeedbackMsg(
      isHe
        ? 'כל הפעימות שזוהו סומנו כנכונות ולא יוצגו שוב לתיקון.'
        : 'All identified tranches marked as correct and dismissed.'
    );
    setTimeout(() => setActionFeedbackMsg(null), 4000);
  };

  const handleSaveInlinePrice = (assetId: string) => {
    const num = parseFloat(inlinePriceInput);
    if (!isNaN(num) && num > 0) {
      updateInvestmentAsset(assetId, { current_price: num });
    }
    setEditingPriceAssetId(null);
  };

  // Export current state to CSV / Excel (with UTF-8 BOM or native XLSX)
  const handleExportCurrentStateCSV = (formatOrEvent?: 'xlsx' | 'csv' | React.MouseEvent) => {
    if (investments.length === 0) {
      alert(isHe ? 'אין ניירות ערך בתיק לייצוא' : 'No assets to export');
      return;
    }

    const format: 'xlsx' | 'csv' = formatOrEvent === 'csv' ? 'csv' : 'xlsx';

    if (format === 'xlsx') {
      try {
        const dataForSheet = investments.map((asset) => {
          const { totalShares, totalCost, avgPrice, currentValue, profit, returnPct } =
            calculateAssetMetrics(asset);
          const typeLabel = SECURITY_TYPE_LABELS[asset.asset_type]?.he || asset.asset_type;
          const secNum = getEffectiveSecurityNumber(asset);

          return {
            'שם נייר / חברה': asset.name,
            'מספר נייר': secNum || '—',
            'סימול נייר': asset.ticker,
            'סוג נייר': typeLabel,
            'מטבע': asset.currency,
            'מספר פעימות': asset.tranches.length,
            'כמות כוללת': totalShares,
            'מחיר קנייה ממוצע': Number(avgPrice.toFixed(2)),
            'סך עלות רכישה': Number(totalCost.toFixed(2)),
            'שער שוק נוכחי': Number(asset.current_price.toFixed(2)),
            'שווי נוכחי': Number(currentValue.toFixed(2)),
            'רווח / הפסד נקודתי': Number(profit.toFixed(2)),
            'תשואה נקודתית (%)': `${returnPct.toFixed(2)}%`,
            'תאריך דוח': new Date().toLocaleDateString('he-IL'),
          };
        });

        // Add summary row
        dataForSheet.push({
          'שם נייר / חברה': 'סה״כ תיק',
          'מספר נייר': '',
          'סימול נייר': '',
          'סוג נייר': '',
          'מטבע': 'ILS',
          'מספר פעימות': '' as any,
          'כמות כוללת': '' as any,
          'מחיר קנייה ממוצע': '' as any,
          'סך עלות רכישה': Number(portfolioSummary.totalInvestedILS.toFixed(2)),
          'שער שוק נוכחי': '' as any,
          'שווי נוכחי': Number(portfolioSummary.currentValueILS.toFixed(2)),
          'רווח / הפסד נקודתי': Number(portfolioSummary.totalProfitILS.toFixed(2)),
          'תשואה נקודתית (%)': `${portfolioSummary.totalReturnPct.toFixed(2)}%`,
          'תאריך דוח': new Date().toLocaleDateString('he-IL'),
        });

        const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'מצב תיק השקעות');
        XLSX.writeFile(workbook, `מצב_תיק_השקעות_${new Date().toISOString().split('T')[0]}.xlsx`);
        return;
      } catch (err) {
        console.warn('XLSX export failed, falling back to CSV:', err);
      }
    }

    const BOM = '\uFEFF';
    const headers = [
      'שם נייר / חברה',
      'מספר נייר',
      'סימול נייר',
      'סוג נייר',
      'מטבע',
      'מספר פעימות',
      'כמות כוללת',
      'מחיר קנייה ממוצע',
      'סך עלות רכישה',
      'שער שוק נוכחי',
      'שווי נוכחי',
      'רווח / הפסד נקודתי',
      'תשואה נקודתית (%)',
      'תאריך דוח',
    ];

    const rows = investments.map((asset) => {
      const { totalShares, totalCost, avgPrice, currentValue, profit, returnPct } =
        calculateAssetMetrics(asset);
      const typeLabel = SECURITY_TYPE_LABELS[asset.asset_type]?.he || asset.asset_type;
      const secNum = getEffectiveSecurityNumber(asset);

      return [
        `"${asset.name}"`,
        `"${secNum || '—'}"`,
        `"${asset.ticker}"`,
        `"${typeLabel}"`,
        `"${asset.currency}"`,
        asset.tranches.length,
        totalShares,
        avgPrice.toFixed(2),
        totalCost.toFixed(2),
        asset.current_price.toFixed(2),
        currentValue.toFixed(2),
        profit.toFixed(2),
        `${returnPct.toFixed(2)}%`,
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
      '""',
      portfolioSummary.totalInvestedILS.toFixed(2),
      '""',
      portfolioSummary.currentValueILS.toFixed(2),
      portfolioSummary.totalProfitILS.toFixed(2),
      `${portfolioSummary.totalReturnPct.toFixed(2)}%`,
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

  // 1. Live Quotes & USD Exchange Rate Refresh Handler (main screen)
  const handleRefreshLiveQuotes = async () => {
    setIsRefreshingQuotes(true);
    setQuotesRefreshMessage(null);
    try {
      // 1. Fetch live USD/ILS exchange rate and asset quotes concurrently
      const fxPromise = fetchUsdIlsRate();
      const quotesPromise =
        investments.length > 0
          ? fetchBatchAssetQuotes(investments, { periodType: 'current' })
          : Promise.resolve(new Map<string, MarketQuoteResult>());

      const [fxRes, resultsMap] = await Promise.all([fxPromise, quotesPromise]);

      let updatedCount = 0;
      investments.forEach((asset) => {
        const res = resultsMap.get(asset.id);
        if (res && res.success && res.price > 0) {
          let newPrice = res.price;

          // If asset is ILS, ensure quote is in Shekels (only divide if currency is ILA/ILX or quote came in at ~100x existing price)
          if (asset.currency === 'ILS' || res.currency === 'ILA' || res.currency === 'ILX') {
            if (res.currency === 'ILA' || res.currency === 'ILX') {
              newPrice = newPrice / 100;
            } else if (
              asset.current_price > 0 &&
              newPrice / asset.current_price >= 40
            ) {
              // Quote came in Agorot (~100x existing Shekel current_price)
              newPrice = newPrice / 100;
            } else if (asset.tranches.length > 0) {
              const validTranches = asset.tranches.filter(
                (t) => t.shares > 0 && t.price_per_share > 0
              );
              if (validTranches.length > 0) {
                const totalCost = validTranches.reduce(
                  (sum, t) => sum + t.shares * t.price_per_share,
                  0
                );
                const totalShares = validTranches.reduce((sum, t) => sum + t.shares, 0);
                const avgBuy = totalCost / totalShares;
                if (avgBuy > 0 && newPrice / avgBuy >= 40) {
                  newPrice = newPrice / 100;
                }
              }
            }
          }

          newPrice = Number(newPrice.toFixed(4));
          updateInvestmentAsset(asset.id, { current_price: newPrice });
          updatedCount++;
        }
      });

      let rateUpdated = false;
      if (fxRes && fxRes.success && fxRes.rate > 0) {
        setUsdRate(fxRes.rate);
        try {
          localStorage.setItem('investments_usd_rate', fxRes.rate.toString());
        } catch (e) {
          console.error(e);
        }
        rateUpdated = true;
      }

      // Build informative feedback message
      const parts: string[] = [];
      if (rateUpdated) {
        parts.push(
          isHe
            ? `שער הדולר עודכן ל-₪${fxRes.rate.toFixed(2)}`
            : `USD rate updated to ₪${fxRes.rate.toFixed(2)}`
        );
      }
      if (updatedCount > 0) {
        parts.push(
          isHe
            ? `עודכנו ${updatedCount} ניירות ערך משערי שוק`
            : `${updatedCount} assets updated`
        );
      }

      const finalMsg =
        parts.length > 0
          ? `✓ ${parts.join(' | ')}`
          : isHe
          ? 'שערי השוק ושער הדולר מעודכנים.'
          : 'Market quotes and USD rate are up to date.';

      const nowIso = new Date().toISOString();
      setLastQuotesRefreshTime(nowIso);
      try {
        localStorage.setItem('investments_last_quotes_refresh', nowIso);
      } catch (err) {
        console.error(err);
      }

      setQuotesRefreshMessage(finalMsg);
      setTimeout(() => setQuotesRefreshMessage(null), 6000);
    } catch (e) {
      console.error(e);
      setQuotesRefreshMessage(
        isHe
          ? 'שגיאה ברענון שערי שוק ושער הדולר. אנא נסה שוב מאוחר יותר.'
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

      // Construct descriptive period label and calculate exact period cutoff date
      let periodLabel = '';
      let periodCutoffDate = '';
      const monthNamesHe = [
        '', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
        'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
      ];
      if (fetchPeriodType === 'year_end') {
        periodLabel = `סיום שנת ${fetchYear} (סוף דצמבר)`;
        periodCutoffDate = `${fetchYear}-12-31`;
      } else if (fetchPeriodType === 'quarter_end') {
        const qEnds = ['', 'סוף מרץ', 'סוף יוני', 'סוף ספטמבר', 'סוף דצמבר'];
        periodLabel = `סיום רבעון Q${fetchQuarter} ${fetchYear} (${qEnds[fetchQuarter]})`;
        const qEndMonth = fetchQuarter * 3;
        const lastDayOfQ = new Date(fetchYear, qEndMonth, 0).getDate();
        periodCutoffDate = `${fetchYear}-${String(qEndMonth).padStart(2, '0')}-${String(lastDayOfQ).padStart(2, '0')}`;
      } else if (fetchPeriodType === 'month_end') {
        periodLabel = `סיום חודש ${monthNamesHe[fetchMonth] || fetchMonth} ${fetchYear}`;
        const lastDayOfM = new Date(fetchYear, fetchMonth, 0).getDate();
        periodCutoffDate = `${fetchYear}-${String(fetchMonth).padStart(2, '0')}-${String(lastDayOfM).padStart(2, '0')}`;
      } else {
        periodLabel = `ציטוט שוק נוכחי (${new Date().toLocaleDateString('he-IL')})`;
        periodCutoffDate = new Date().toISOString().split('T')[0];
      }

      let totalInvestedILS = 0;
      let totalValueILS = 0;
      let latestDateFound = '';

      const items: InvestmentSnapshotItem[] = investments.map((asset) => {
        const quote = resultsMap.get(asset.id);
        const quoteDate = quote?.date ? normalizeToISODate(quote.date) : '';

        // Only include tranches that were actually purchased ON OR BEFORE the period cutoff date!
        const validTranches = (asset.tranches || []).filter((t) => {
          if ((Number(t.shares) || 0) <= 0 || (Number(t.price_per_share) || 0) <= 0) return false;
          if (periodCutoffDate) {
            const trancheDate = normalizeToISODate(t.date);
            if (trancheDate > periodCutoffDate) return false;
          }
          return true;
        });

        const totalCost = validTranches.reduce(
          (sum, t) => sum + (Number(t.shares) || 0) * (Number(t.price_per_share) || 0),
          0
        );
        const totalShares = validTranches.reduce((sum, t) => sum + (Number(t.shares) || 0), 0);
        const avgPrice = totalShares > 0 ? totalCost / totalShares : 0;

        let priceToUse = quote && quote.success && quote.price > 0 ? quote.price : asset.current_price;
        if (asset.currency === 'ILS' || quote?.currency === 'ILA' || quote?.currency === 'ILX') {
          if (quote?.currency === 'ILA' || quote?.currency === 'ILX') {
            priceToUse = priceToUse / 100;
          } else if (
            asset.current_price > 0 &&
            priceToUse / asset.current_price >= 40
          ) {
            priceToUse = priceToUse / 100;
          } else if (avgPrice > 0 && priceToUse / avgPrice >= 40) {
            priceToUse = priceToUse / 100;
          }
        }
        priceToUse = Number(priceToUse.toFixed(4));
        // Only accept quoteDate if it belongs to this period (<= periodCutoffDate)
        if (quoteDate && quoteDate <= periodCutoffDate) {
          if (!latestDateFound || quoteDate > latestDateFound) {
            latestDateFound = quoteDate;
          }
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
          security_number: getEffectiveSecurityNumber(asset) || undefined,
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
        date: normalizeToISODate(latestDateFound || periodCutoffDate || new Date().toISOString().split('T')[0]),
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

    // Filter to save only assets that were actually held on that date (shares > 0)
    const activeItems = fetchedPeriodResult.items.filter((it) => it.shares > 0);

    const cleanDate = healSnapshotDate({
      date: fetchedPeriodResult.date,
      period_label: fetchedPeriodResult.periodLabel,
      period_type: fetchedPeriodResult.periodType,
    });

    const newSnapshot: InvestmentPeriodicSnapshot = {
      id: `snap-${Date.now()}`,
      household_id: activeHousehold?.id || 'hh-main',
      period_type: fetchedPeriodResult.periodType,
      period_label: fetchedPeriodResult.periodLabel,
      date: cleanDate,
      total_invested: fetchedPeriodResult.totalInvested,
      total_value: fetchedPeriodResult.totalValue,
      total_profit: fetchedPeriodResult.totalProfit,
      total_return_pct: fetchedPeriodResult.totalReturnPct,
      assets_count: activeItems.length,
      items: activeItems,
      notes: `נמשך אוטומטית מאתרי הבורסה (${fetchedPeriodResult.periodLabel})`,
    };

    // Filter out existing snapshot with same label to avoid duplicate rows
    const filteredOld = snapshots.filter(
      (s) => s.period_label !== fetchedPeriodResult.periodLabel
    );
    saveSnapshots([newSnapshot, ...filteredOld]);
    alert(isHe ? 'צילום המצב נשמר בהצלחה בהיסטוריית התיק!' : 'Snapshot saved successfully!');
  };

  // Helper to fetch and build a single month snapshot
  const fetchAndSaveMonthSnapshot = async (
    year: number,
    month: number,
    currentList: InvestmentPeriodicSnapshot[]
  ): Promise<InvestmentPeriodicSnapshot[] | null> => {
    const q = Math.ceil(month / 3);
    const resultsMap = await fetchBatchAssetQuotes(investments, {
      periodType: 'month_end',
      year,
      month,
      quarter: q,
    });

    const monthName = HEBREW_MONTH_NAMES[month] || `חודש ${month}`;
    const periodLabel = `סיום חודש ${monthName} ${year}`;
    const lastDayOfM = new Date(year, month, 0).getDate();
    const periodCutoffDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfM).padStart(2, '0')}`;

    let totalInvestedILS = 0;
    let totalValueILS = 0;
    let latestDateFound = '';

    const items: InvestmentSnapshotItem[] = investments.map((asset) => {
      const quote = resultsMap.get(asset.id);
      const quoteDate = quote?.date ? normalizeToISODate(quote.date) : '';

      // Only include tranches that were actually purchased ON OR BEFORE the period cutoff date!
      const validTranches = (asset.tranches || []).filter((t) => {
        if ((Number(t.shares) || 0) <= 0 || (Number(t.price_per_share) || 0) <= 0) return false;
        const trancheDate = normalizeToISODate(t.date);
        return trancheDate <= periodCutoffDate;
      });

      const totalCost = validTranches.reduce(
        (sum, t) => sum + (Number(t.shares) || 0) * (Number(t.price_per_share) || 0),
        0
      );
      const totalShares = validTranches.reduce((sum, t) => sum + (Number(t.shares) || 0), 0);
      const avgPrice = totalShares > 0 ? totalCost / totalShares : 0;

      let priceToUse = quote && quote.success && quote.price > 0 ? quote.price : asset.current_price;
      if (asset.currency === 'ILS' || quote?.currency === 'ILA' || quote?.currency === 'ILX') {
        if (quote?.currency === 'ILA' || quote?.currency === 'ILX') {
          priceToUse = priceToUse / 100;
        } else if (
          asset.current_price > 0 &&
          priceToUse / asset.current_price >= 40
        ) {
          priceToUse = priceToUse / 100;
        } else if (avgPrice > 0 && priceToUse / avgPrice >= 40) {
          priceToUse = priceToUse / 100;
        }
      }
      priceToUse = Number(priceToUse.toFixed(4));
      if (quoteDate && quoteDate <= periodCutoffDate) {
        if (!latestDateFound || quoteDate > latestDateFound) {
          latestDateFound = quoteDate;
        }
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
        security_number: getEffectiveSecurityNumber(asset) || undefined,
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

    const activeItems = items.filter((it) => it.shares > 0);
    const totalProfitILS = totalValueILS - totalInvestedILS;
    const totalReturnPct = totalInvestedILS > 0 ? (totalProfitILS / totalInvestedILS) * 100 : 0;

    const cleanDate = healSnapshotDate({
      date: latestDateFound || periodCutoffDate,
      period_label: periodLabel,
      period_type: 'month',
    });

    const newSnapshot: InvestmentPeriodicSnapshot = {
      id: `snap-${year}-${String(month).padStart(2, '0')}-${Date.now()}`,
      household_id: activeHousehold?.id || 'hh-main',
      period_type: 'month',
      period_label: periodLabel,
      date: cleanDate,
      total_invested: Number(totalInvestedILS.toFixed(2)),
      total_value: Number(totalValueILS.toFixed(2)),
      total_profit: Number(totalProfitILS.toFixed(2)),
      total_return_pct: Number(totalReturnPct.toFixed(2)),
      assets_count: activeItems.length,
      items: activeItems,
      notes: `סנכרון רציף אוטומטי (${periodLabel})`,
    };

    const filteredOld = currentList.filter((s) => s.period_label !== periodLabel);
    return [newSnapshot, ...filteredOld];
  };

  // Run Batch Loop across all months of a Year or Quarter
  const handleRunBatchLoop = async (
    type: 'year_end' | 'quarter_end' | 'month_end',
    year: number,
    quarter?: number,
    month?: number
  ) => {
    if (investments.length === 0) {
      alert(isHe ? 'אין ניירות ערך בתיק למשיכת נתונים' : 'No assets in portfolio');
      return;
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    let monthsToFetch: number[] = [];
    let title = '';

    if (type === 'year_end') {
      title = isHe ? `סגירת שנת ${year} בלופ (ינואר - דצמבר)` : `Closing Year ${year} (Jan - Dec)`;
      const maxM = year === currentYear ? Math.min(12, currentMonth) : 12;
      for (let m = 1; m <= maxM; m++) {
        monthsToFetch.push(m);
      }
    } else if (type === 'quarter_end') {
      const q = quarter || fetchQuarter || 1;
      const qStart = (q - 1) * 3 + 1;
      const qEnd = q * 3;
      title = isHe ? `סגירת רבעון Q${q} ${year} בלופ` : `Closing Q${q} ${year}`;
      for (let m = qStart; m <= qEnd; m++) {
        if (year === currentYear && m > currentMonth) continue;
        monthsToFetch.push(m);
      }
    } else {
      const m = month || fetchMonth || 1;
      monthsToFetch = [m];
      title = isHe ? `סגירת חודש ${m}/${year}` : `Closing Month ${m}/${year}`;
    }

    if (monthsToFetch.length === 0) {
      alert(isHe ? 'התקופה המבוקשת היא בעתיד וטרם נסחרה.' : 'Selected period is in the future.');
      return;
    }

    setIsFetchingPeriodQuotes(true);
    setFetchPeriodError(null);

    let currentSnapshots = [...snapshots];
    let successCount = 0;

    try {
      for (let i = 0; i < monthsToFetch.length; i++) {
        const m = monthsToFetch[i];
        const mName = HEBREW_MONTH_NAMES[m] || `חודש ${m}`;

        setBatchProgress({
          isRunning: true,
          title,
          currentMonthName: mName,
          currentIndex: i + 1,
          totalCount: monthsToFetch.length,
        });

        const updated = await fetchAndSaveMonthSnapshot(year, m, currentSnapshots);
        if (updated) {
          currentSnapshots = updated;
          successCount++;
          await saveSnapshots(currentSnapshots);
        }
      }

      setQuotesRefreshMessage(
        isHe
          ? `✓ הושלם בהצלחה! עודכנו ${successCount} חודשים עבור ${title}`
          : `✓ Done! Successfully updated ${successCount} months.`
      );
      setTimeout(() => setQuotesRefreshMessage(null), 7000);
      alert(
        isHe
          ? `✓ הסנכרון בלופ הושלם בהצלחה! עודכנו ${successCount} חודשים בעץ התקופות.`
          : `✓ Batch sync complete! Updated ${successCount} months.`
      );
    } catch (err: any) {
      console.error(err);
      setFetchPeriodError(err?.message || (isHe ? 'שגיאה בסנכרון הרציף' : 'Batch sync error'));
    } finally {
      setIsFetchingPeriodQuotes(false);
      setBatchProgress(null);
    }
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
      `"${getEffectiveSecurityNumber(item) || '—'}"`,
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

    setSnapshotDate(formatDate(now));
    setSnapshotNotes('');
    setIsSnapshotModalOpen(true);
  };

  const handleSaveSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapshotLabel.trim()) {
      alert(isHe ? 'אנא הזן תיאור לתקופה' : 'Please enter period label');
      return;
    }

    const targetIsoDate = normalizeToISODate(snapshotDate);
    let totalInvestedILS = 0;
    let totalValueILS = 0;
    const items: InvestmentSnapshotItem[] = [];

    investments.forEach((asset) => {
      const validTranches = (asset.tranches || []).filter((t) => {
        if ((Number(t.shares) || 0) <= 0 || (Number(t.price_per_share) || 0) <= 0) return false;
        const tDate = normalizeToISODate(t.date);
        return tDate <= targetIsoDate;
      });

      const totalShares = validTranches.reduce((sum, t) => sum + (Number(t.shares) || 0), 0);
      if (totalShares <= 0) return; // Not held on or before this snapshot date

      const totalCost = validTranches.reduce(
        (sum, t) => sum + (Number(t.shares) || 0) * (Number(t.price_per_share) || 0),
        0
      );
      const avgPrice = totalCost / totalShares;
      const val = totalShares * asset.current_price;
      const profit = val - totalCost;
      const returnPct = totalCost > 0 ? (profit / totalCost) * 100 : 0;
      const mult = asset.currency === 'USD' ? usdRate : 1;

      totalInvestedILS += totalCost * mult;
      totalValueILS += val * mult;

      items.push({
        asset_id: asset.id,
        ticker: asset.ticker,
        security_number: getEffectiveSecurityNumber(asset) || undefined,
        name: asset.name,
        currency: asset.currency,
        shares: totalShares,
        avg_cost_price: avgPrice,
        total_cost: totalCost,
        market_price: asset.current_price,
        market_value: val,
        profit,
        return_pct: returnPct,
      });
    });

    const totalProfitILS = totalValueILS - totalInvestedILS;
    const totalReturnPct = totalInvestedILS > 0 ? (totalProfitILS / totalInvestedILS) * 100 : 0;

    const newSnapshot: InvestmentPeriodicSnapshot = {
      id: `snap-${Date.now()}`,
      household_id: activeHousehold?.id || 'hh-main',
      period_type: snapshotPeriodType,
      period_label: snapshotLabel.trim(),
      date: targetIsoDate,
      total_invested: Number(totalInvestedILS.toFixed(2)),
      total_value: Number(totalValueILS.toFixed(2)),
      total_profit: Number(totalProfitILS.toFixed(2)),
      total_return_pct: Number(totalReturnPct.toFixed(2)),
      assets_count: items.length,
      items,
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

  const handleQuickFetchFromTree = async (
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

    if (type === 'year_end') {
      const confirmRun = window.confirm(
        isHe
          ? `האם להריץ סנכרון שערים בלופ עבור כל חודשי שנת ${year} (מינואר עד דצמבר) ולשמור אוטומטית בעץ?`
          : `Run batch loop for all months of ${year} (Jan - Dec) and save automatically?`
      );
      if (confirmRun) {
        await handleRunBatchLoop('year_end', year);
        return;
      }
    } else if (type === 'quarter_end') {
      const q = quarter || 1;
      const confirmRun = window.confirm(
        isHe
          ? `האם להריץ סנכרון שערים בלופ עבור כל חודשי רבעון Q${q} ${year} ולשמור אוטומטית בעץ?`
          : `Run batch loop for all months of Q${q} ${year} and save automatically?`
      );
      if (confirmRun) {
        await handleRunBatchLoop('quarter_end', year, q);
        return;
      }
    }

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
            {activePillar === 'overview' && (isHe ? 'סקירת עושר והון משפחתי כולל' : 'Total Family Wealth Overview')}
            {activePillar === 'meitav' && (isHe ? 'מניות ומדדים — מיטב טרייד' : 'Meitav Trade Equities & ETFs')}
            {activePillar === 'bank_securities' && (isHe ? 'מניות ומדדים — חשבון בנק' : 'Bank Equities & ETFs')}
            {activePillar === 'bank_deposits' && (isHe ? 'פקדונות וחסכונות — מנוהל בבנק' : 'Bank Deposits & Savings')}
            {activePillar === 'pension_provident' && (isHe ? 'קרנות השתלמות ופנסיה' : 'Pensions & Study Funds')}
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
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 3.7;
                  setUsdRate(val);
                  try {
                    localStorage.setItem('investments_usd_rate', val.toString());
                  } catch (err) {
                    console.error(err);
                  }
                }}
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
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px 14px',
              minHeight: '42px',
            }}
            onClick={handleRefreshLiveQuotes}
            disabled={isRefreshingQuotes}
            title={
              isHe
                ? `פנה לאתרים (Yahoo Finance / ביזפורטל) ומשוך שער שוק עדכני${
                    effectiveLastRefreshTime ? `\nרענון אחרון: ${formatLastRefreshTime(effectiveLastRefreshTime)}` : ''
                  }`
                : `Fetch live market quotes${
                    effectiveLastRefreshTime ? `\nLast updated: ${formatLastRefreshTime(effectiveLastRefreshTime)}` : ''
                  }`
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw size={14} color="#059669" className={isRefreshingQuotes ? 'spin-icon' : ''} />
              <span>{isRefreshingQuotes ? (isHe ? 'מעדכן שערים...' : 'Fetching...') : (isHe ? 'רענן שערי שוק' : 'Live Quotes')}</span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '0.6875rem',
                fontWeight: '600',
                color: '#047857',
                opacity: 0.9,
                marginTop: '1px',
              }}
            >
              <Clock size={10} color="#047857" />
              <span>
                {isHe
                  ? `עודכן: ${formatLastRefreshTime(effectiveLastRefreshTime)}`
                  : `Updated: ${formatLastRefreshTime(effectiveLastRefreshTime)}`}
              </span>
            </div>
          </button>


          {/* Import Tranches Excel / CSV Button */}
          <button
            style={styles.importTranchesBtn}
            onClick={() => {
              setImportTargetAsset(null);
              setIsImportModalOpen(true);
            }}
            title={isHe ? 'ייבוא פעימות רכישה מקובץ אקסל או CSV' : 'Import tranches from Excel / CSV'}
          >
            <FileSpreadsheet size={16} color="#0284C7" />
            <span>{isHe ? 'טעינת פעימות מאקסל' : 'Import Excel'}</span>
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

      {/* 4-Pillars Navigation Bar */}
      <div style={styles.pillarsNavBar}>
        <button
          style={{
            ...styles.pillarTabBtn,
            ...(activePillar === 'overview' ? styles.pillarTabBtnActiveOverview : {}),
          }}
          onClick={() => setActivePillar('overview')}
        >
          <PieChart size={17} />
          <span>{isHe ? '🌐 סקירה משולבת' : 'Combined Overview'}</span>
        </button>

        <button
          style={{
            ...styles.pillarTabBtn,
            ...(activePillar === 'meitav' ? styles.pillarTabBtnActiveMeitav : {}),
          }}
          onClick={() => setActivePillar('meitav')}
        >
          <TrendingUp size={17} />
          <span>{isHe ? '📊 1. מיטב טרייד' : '1. Meitav Trade'}</span>
          <span
            style={{
              ...styles.pillarCountBadge,
              backgroundColor: activePillar === 'meitav' ? 'rgba(255,255,255,0.3)' : '#E2E8F0',
              color: activePillar === 'meitav' ? '#FFFFFF' : '#475569',
            }}
          >
            {investments.filter((a) => !a.management_pillar || a.management_pillar === 'meitav').length}
          </span>
        </button>

        <button
          style={{
            ...styles.pillarTabBtn,
            ...(activePillar === 'bank_securities' ? styles.pillarTabBtnActiveBank : {}),
          }}
          onClick={() => setActivePillar('bank_securities')}
        >
          <Landmark size={17} />
          <span>{isHe ? '🏦 2. מניות בנק' : '2. Bank Securities'}</span>
          <span
            style={{
              ...styles.pillarCountBadge,
              backgroundColor: activePillar === 'bank_securities' ? 'rgba(255,255,255,0.3)' : '#E2E8F0',
              color: activePillar === 'bank_securities' ? '#FFFFFF' : '#475569',
            }}
          >
            {investments.filter((a) => a.management_pillar === 'bank_securities').length}
          </span>
        </button>

        <button
          style={{
            ...styles.pillarTabBtn,
            ...(activePillar === 'bank_deposits' ? styles.pillarTabBtnActiveDeposits : {}),
          }}
          onClick={() => setActivePillar('bank_deposits')}
        >
          <Coins size={17} />
          <span>{isHe ? '💰 3. פקדונות בנק' : '3. Bank Deposits'}</span>
          <span
            style={{
              ...styles.pillarCountBadge,
              backgroundColor: activePillar === 'bank_deposits' ? 'rgba(255,255,255,0.3)' : '#E2E8F0',
              color: activePillar === 'bank_deposits' ? '#FFFFFF' : '#475569',
            }}
          >
            {bankDeposits.length}
          </span>
        </button>

        <button
          style={{
            ...styles.pillarTabBtn,
            ...(activePillar === 'pension_provident' ? styles.pillarTabBtnActivePension : {}),
          }}
          onClick={() => setActivePillar('pension_provident')}
        >
          <ShieldCheck size={17} />
          <span>{isHe ? '🛡️ 4. פנסיה והשתלמות' : '4. Pensions & Study'}</span>
          <span
            style={{
              ...styles.pillarCountBadge,
              backgroundColor: activePillar === 'pension_provident' ? 'rgba(255,255,255,0.3)' : '#E2E8F0',
              color: activePillar === 'pension_provident' ? '#FFFFFF' : '#475569',
            }}
          >
            {pensionFunds.length}
          </span>
        </button>
      </div>

      {/* Render Overview */}
      {activePillar === 'overview' && (
        <InvestmentsOverview
          investments={investments}
          usdRate={usdRate}
          onSelectPillar={(p) => setActivePillar(p)}
          isHe={isHe}
          dir={dir}
        />
      )}

      {/* Render Bank Deposits */}
      {activePillar === 'bank_deposits' && (
        <BankDepositsView
          deposits={bankDeposits}
          onAddDeposit={addInvestmentAsset}
          onUpdateDeposit={updateInvestmentAsset}
          onDeleteDeposit={deleteInvestmentAsset}
          isHe={isHe}
          dir={dir}
        />
      )}

      {/* Render Pension & Study Funds */}
      {activePillar === 'pension_provident' && (
        <PensionFundsView
          funds={pensionFunds}
          onAddFund={addInvestmentAsset}
          onUpdateFund={updateInvestmentAsset}
          onDeleteFund={deleteInvestmentAsset}
          isHe={isHe}
          dir={dir}
        />
      )}

      {/* Render Securities Portfolio (Pillar 1: Meitav OR Pillar 2: Bank Securities) */}
      {(activePillar === 'meitav' || activePillar === 'bank_securities') && (
        <>

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
            {isHe ? 'סך עלות הקרן שנרכשה (ללא עמלות)' : 'Total cost basis (excluding fees)'}
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
            <span dir="ltr" style={{ direction: 'ltr', display: 'inline-block' }}>
              {portfolioSummary.totalProfitILS >= 0
                ? `+₪${portfolioSummary.totalProfitILS.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                : `-₪${Math.abs(portfolioSummary.totalProfitILS).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
            </span>
          </div>
          <div style={styles.kpiBadgeYieldRow}>
            <span
              style={{
                ...styles.yieldPill,
                backgroundColor: portfolioSummary.totalProfitILS >= 0 ? '#DCFCE7' : '#FEE2E2',
                color: portfolioSummary.totalProfitILS >= 0 ? '#15803D' : '#B91C1C',
              }}
            >
              <span dir="ltr" style={{ direction: 'ltr', display: 'inline-block' }}>
                {portfolioSummary.totalReturnPct >= 0 ? '+' : '-'}
                {Math.abs(portfolioSummary.totalReturnPct).toFixed(2)}%
              </span>
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

      {/* Sub Tabs Desktop: Active Portfolio vs Periodic Snapshots */}
      <div className="desktop-only" style={styles.subTabNav}>
        <button
          style={{
            ...styles.subTabBtn,
            ...(activeSubTab === 'portfolio' ? styles.subTabBtnActive : {}),
          }}
          onClick={() => setActiveSubTab('portfolio')}
        >
          <Layers size={16} />
          <span>{isHe ? 'ניירות ערך ופוזיציות פעילות' : 'Active Holdings & Tranches'}</span>
          <span style={styles.subTabCountPill}>{currentSecurities.length}</span>
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

        <button
          style={{
            ...styles.subTabBtn,
            ...(activeSubTab === 'daily_prices' ? styles.subTabBtnActive : {}),
          }}
          onClick={() => setActiveSubTab('daily_prices')}
        >
          <Calendar size={16} />
          <span>{isHe ? 'שערי סוף יום (23:55 אוטומטי)' : 'Daily Closing Prices'}</span>
          <span style={styles.subTabCountPill}>{dailyPrices.length}</span>
        </button>
      </div>

      {/* Sub Tabs Mobile: Dropdown List Selector */}
      <div className="mobile-only-block" style={{ marginBottom: '16px', position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1.5px solid var(--primary)',
            boxShadow: '0 2px 8px rgba(79, 70, 229, 0.08)',
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {activeSubTab === 'portfolio' && <Layers size={18} />}
              {activeSubTab === 'snapshots' && <Clock size={18} />}
              {activeSubTab === 'charts' && <TrendingUp size={18} />}
              {activeSubTab === 'daily_prices' && <Calendar size={18} />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {isHe ? 'תצוגת השקעות פעילה:' : 'Active Investment View:'}
              </span>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {activeSubTab === 'portfolio' && (isHe ? 'ניירות ערך ופוזיציות' : 'Active Holdings')}
                {activeSubTab === 'snapshots' && (isHe ? 'עץ סגירות תקופה' : 'Periodic Snapshots')}
                {activeSubTab === 'charts' && (isHe ? 'גרפים ומדדי תשואה' : 'Charts & Performance')}
                {activeSubTab === 'daily_prices' && (isHe ? 'שערי סוף יום (23:55)' : 'Daily Closing Prices')}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {activeSubTab === 'portfolio' && (
              <span style={styles.subTabCountPill}>{currentSecurities.length}</span>
            )}
            {activeSubTab === 'snapshots' && (
              <span style={styles.subTabCountPill}>{snapshots.length}</span>
            )}
            {activeSubTab === 'charts' && (
              <span style={{ ...styles.subTabCountPill, backgroundColor: '#FEF08A', color: '#854D0E' }}>
                {isHe ? 'חדש' : 'New'}
              </span>
            )}
            {activeSubTab === 'daily_prices' && (
              <span style={styles.subTabCountPill}>{dailyPrices.length}</span>
            )}
            <ChevronDown size={18} color="var(--primary)" />
          </div>

          {/* Invisible native select overlay for 100% reliable mobile UX (iOS / Android picker wheel) */}
          <select
            value={activeSubTab}
            onChange={(e) => setActiveSubTab(e.target.value as any)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: 'pointer',
              fontSize: '16px', // Prevents iOS Safari auto-zoom
              WebkitAppearance: 'menulist-button',
            }}
            aria-label={isHe ? 'בחר תצוגת השקעות' : 'Select investment view'}
          >
            <option value="portfolio">
              {isHe ? `💼 ניירות ערך ופוזיציות (${investments.length})` : `💼 Active Holdings (${investments.length})`}
            </option>
            <option value="snapshots">
              {isHe ? `🌳 עץ סגירות תקופה (${snapshots.length})` : `🌳 Periodic Snapshots Tree (${snapshots.length})`}
            </option>
            <option value="charts">
              {isHe ? `📊 גרפים ומדדי תשואה (שווי מול עלות)` : `📊 Charts & Performance`}
            </option>
            <option value="daily_prices">
              {isHe ? `📅 שערי סוף יום (${dailyPrices.length})` : `📅 Daily Closing Prices (${dailyPrices.length})`}
            </option>
          </select>
        </div>
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

            {actionFeedbackMsg && (
              <div
                style={{
                  backgroundColor: '#DCFCE7',
                  border: '1px solid #86EFAC',
                  color: '#15803D',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: '700',
                  fontSize: '0.875rem',
                }}
                className="animate-fade-in"
              >
                <CheckCircle2 size={16} color="#15803D" />
                <span>{actionFeedbackMsg}</span>
              </div>
            )}

            {totalDuplicateTranchesCount > 0 && (
              <div
                style={{
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#991B1B',
                  padding: '12px 18px',
                  borderRadius: '10px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  fontSize: '0.875rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={18} color="#DC2626" />
                  <div>
                    <strong style={{ fontSize: '0.9375rem', color: '#991B1B' }}>
                      {isHe
                        ? `שים לב: זוהו ${totalDuplicateTranchesCount} פעימות רכישה כפולות בתיק ההשקעות!`
                        : `Notice: ${totalDuplicateTranchesCount} duplicate purchase tranches detected in portfolio!`}
                    </strong>
                    <div style={{ fontSize: '0.78rem', color: '#B91C1C', marginTop: '2px' }}>
                      {isHe
                        ? 'ניתן להסיר את הרשומות הכפולות בלחיצה אחת ולשמור רק רשומה מקורית אחת מכל פעימה.'
                        : 'You can remove duplicates with one click, keeping only one original record for each tranche.'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRemoveAllDuplicateTranches}
                  style={{
                    backgroundColor: '#DC2626',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '7px 16px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#B91C1C')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#DC2626')}
                  title={isHe ? 'הסר את כל הפעימות הכפולות ושמור עותק יחיד בלבד' : 'Remove all duplicate tranches'}
                >
                  <Trash2 size={14} color="#FFFFFF" />
                  <span>
                    {isHe ? '🧹 נקה את כל הכפילויות' : '🧹 Remove All Duplicates'}
                  </span>
                </button>
              </div>
            )}

            {(suspectedAgorotTranches.length > 0 || suspectedAgorotCurrentPrices.length > 0) && (
              <div
                style={{
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FCD34D',
                  color: '#92400E',
                  padding: '14px 18px',
                  borderRadius: '10px',
                  marginBottom: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  fontSize: '0.875rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={18} color="#D97706" />
                    <div>
                      <strong style={{ fontSize: '0.9375rem', color: '#78350F' }}>
                        {isHe
                          ? `שים לב: זוהו נתונים שקליים ב-${suspectedAssetsSummary.length} ניירות ערך שמוצגים כנראה באגורות (ללא חלוקה ב-100 לשקלים):`
                          : `Notice: Agorot prices detected in ${suspectedAssetsSummary.length} assets (not divided by 100):`}
                      </strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={handleAutoFixAgorotTranches}
                      style={{
                        backgroundColor: '#D97706',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '7px 16px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        fontSize: '0.8125rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#B45309')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#D97706')}
                      title={isHe ? 'חלק את כל שערי השוק והפעימות המוצגות ב-100 לשקלים' : 'Fix all prices and tranches (divide by 100)'}
                    >
                      <RotateCcw size={14} color="#FFFFFF" />
                      <span>
                        {isHe ? '✓ תקן הכל (חלק ב-100)' : '✓ Fix All (Divide by 100)'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleIgnoreAllAgorotTranches}
                      style={{
                        backgroundColor: '#FFFFFF',
                        color: '#78350F',
                        border: '1px solid #FCD34D',
                        borderRadius: '6px',
                        padding: '7px 14px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        fontSize: '0.8125rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FEF3C7')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                      title={isHe ? 'סמן את כל הפעימות המוצגות כנכונות ולא להציג אותן שוב לתיקון' : 'Mark all as correct and dismiss'}
                    >
                      <X size={14} color="#92400E" />
                      <span>
                        {isHe ? '✕ אל תתקן (השאר כפי שהוא)' : '✕ Don\'t Fix (Keep As Is)'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* List of identified stocks and their tranches */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    backgroundColor: 'rgba(254, 243, 199, 0.65)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    border: '1px solid #FDE68A',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', color: '#92400E', fontSize: '0.8125rem' }}>
                    <Info size={14} color="#B45309" />
                    <span>{isHe ? 'רשימת המניות והשערים שזוהו לבחירתך האם לתקן:' : 'Identified Securities & Prices (Choose to Fix or Keep):'}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {suspectedAssetsSummary.map((assetItem) => (
                      <div
                        key={assetItem.assetId}
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #FCD34D',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              backgroundColor: '#EFF6FF',
                              color: '#1D4ED8',
                              fontWeight: '800',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.8125rem',
                              border: '1px solid #BFDBFE',
                            }}
                          >
                            {assetItem.ticker}
                          </span>
                          <span style={{ fontWeight: '600', color: '#1E293B', fontSize: '0.875rem' }}>
                            {assetItem.name}
                          </span>
                          {assetItem.tranches.length > 0 && (
                            <span style={{ color: '#64748B', fontSize: '0.78rem' }}>
                              ({assetItem.tranches.length} {isHe ? 'פעימות' : 'tranches'})
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          {/* If current_price is suspected in Agorot */}
                          {assetItem.currentPriceSuspected && (
                            <div
                              style={{
                                backgroundColor: '#FEF2F2',
                                border: '1px solid #FECACA',
                                borderRadius: '6px',
                                padding: '5px 10px',
                                fontSize: '0.78rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                flexWrap: 'wrap',
                              }}
                            >
                              <span style={{ color: '#991B1B', fontWeight: '700' }}>
                                {isHe ? 'שער נוכחי:' : 'Current Price:'}
                              </span>
                              <span style={{ color: '#DC2626', fontWeight: '700' }}>
                                ₪{assetItem.currentPrice.toLocaleString('en-US')}
                              </span>
                              <span style={{ color: '#B45309' }}>⬅️</span>
                              <span style={{ color: '#059669', fontWeight: '700' }}>
                                ₪{(assetItem.currentPrice / 100).toFixed(2)}
                              </span>

                              <button
                                type="button"
                                onClick={() => handleFixCurrentPriceOnly(assetItem.assetId, assetItem.currentPrice)}
                                style={{
                                  backgroundColor: '#DC2626',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '2px 8px',
                                  fontSize: '0.72rem',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  marginInlineStart: '4px',
                                }}
                                title={isHe ? 'תקן שער נוכחי (חלק ב-100 לשקלים)' : 'Fix current price (divide by 100)'}
                              >
                                <Check size={11} color="#FFFFFF" />
                                <span>{isHe ? 'תקן שער' : 'Fix Price'}</span>
                              </button>
                            </div>
                          )}

                          {/* Tranches */}
                          {assetItem.tranches.map((tr, trIdx) => (
                            <div
                              key={tr.trancheId || trIdx}
                              style={{
                                backgroundColor: '#FFFBEB',
                                border: '1px solid #FCD34D',
                                borderRadius: '6px',
                                padding: '5px 10px',
                                fontSize: '0.78rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                flexWrap: 'wrap',
                              }}
                            >
                              <span style={{ color: '#64748B', fontWeight: '600' }}>{formatDate(tr.date)}:</span>
                              <span style={{ color: '#DC2626', fontWeight: '700' }}>
                                {tr.price.toLocaleString('en-US')} אג'
                              </span>
                              <span style={{ color: '#B45309' }}>⬅️</span>
                              <span style={{ color: '#059669', fontWeight: '700' }}>
                                ₪{(tr.price / 100).toFixed(2)}
                              </span>

                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginInlineStart: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleFixSingleTranche(assetItem.assetId, tr.trancheId, tr.trancheIndex, tr.price, tr.shares)}
                                  style={{
                                    backgroundColor: '#059669',
                                    color: '#FFFFFF',
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '2px 8px',
                                    fontSize: '0.72rem',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                  }}
                                  title={isHe ? 'תקן פעימה זו (חלק ב-100 לשקלים)' : 'Fix this tranche'}
                                >
                                  <Check size={11} color="#FFFFFF" />
                                  <span>{isHe ? 'תקן' : 'Fix'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleIgnoreSingleTranche(assetItem.assetId, tr.trancheId, tr.trancheIndex)}
                                  style={{
                                    backgroundColor: '#FFFFFF',
                                    color: '#64748B',
                                    border: '1px solid #CBD5E1',
                                    borderRadius: '4px',
                                    padding: '2px 8px',
                                    fontSize: '0.72rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                  }}
                                  title={isHe ? 'אל תתקן פעימה זו, השאר כפי שהיא ואל תציג אותה שוב' : 'Do not fix, mark as correct'}
                                >
                                  <X size={11} color="#64748B" />
                                  <span>{isHe ? 'לא לתקן' : 'Don\'t Fix'}</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div style={styles.tableResponsiveWrap}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.thRow}>
                    <th style={styles.thCell}>{isHe ? 'סימול / שם נייר' : 'Ticker / Asset'}</th>
                    <th style={styles.thCell}>{isHe ? 'מספר נייר' : 'Security No.'}</th>
                    <th style={styles.thCell}>{isHe ? 'סוג נייר' : 'Asset Type'}</th>
                    <th style={styles.thCell}>{isHe ? 'כמות מניות' : 'Quantity'}</th>
                    <th style={styles.thCell}>{isHe ? 'מחיר קנייה ממוצע' : 'Avg. Cost'}</th>
                    <th style={styles.thCell}>{isHe ? 'שער נוכחי' : 'Market Price'}</th>
                    <th style={styles.thCell}>{isHe ? 'סך עלות רכישה' : 'Total Cost'}</th>
                    <th style={styles.thCell}>{isHe ? 'שווי נוכחי' : 'Current Value'}</th>
                    <th style={styles.thCell}>{isHe ? 'רווח / הפסד' : 'P&L'}</th>
                    <th style={styles.thCell}>{isHe ? 'תשואה' : 'Yield'}</th>
                    <th style={{ ...styles.thCell, textAlign: 'center' }}>{isHe ? 'פעימות' : 'Tranches'}</th>
                    <th style={{ ...styles.thCell, textAlign: 'center' }}>{isHe ? 'פעולות' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {currentSecurities.length === 0 ? (
                    <tr>
                      <td colSpan={12} style={styles.emptyTd}>
                        <div style={styles.emptyBox}>
                          <Coins size={36} color="var(--text-muted)" />
                          <div style={styles.emptyTitle}>
                            {activePillar === 'bank_securities'
                              ? isHe ? 'אין עדיין ניירות ערך בחשבון הבנק' : 'No bank securities yet'
                              : isHe ? 'אין עדיין ניירות ערך בתיק' : 'No investment holdings yet'}
                          </div>
                          <p style={styles.emptySub}>
                            {activePillar === 'bank_securities'
                              ? isHe
                                ? 'לחץ על "+ הוסף נייר ערך" כדי להתחיל לעקוב אחרי קרנות נאמנות, אג"ח ומניות בחשבון הבנק.'
                                : 'Click "+ Add Asset" to add mutual funds and stocks in your bank account.'
                              : isHe
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
                    currentSecurities.map((asset) => {
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
                                {getEffectiveSecurityNumber(asset) || '—'}
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
                                {formatVal(metrics.avgPrice, asset.currency, undefined, 4)}
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
                                    {formatVal(asset.current_price, asset.currency, undefined, 4)}
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
                                  {asset.currency === 'ILS' &&
                                    ((metrics.avgPrice > 0 && asset.current_price / metrics.avgPrice >= 40) ||
                                      (metrics.avgPrice === 0 && asset.current_price >= 10000)) && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newPrice = Number((asset.current_price / 100).toFixed(4));
                                          updateInvestmentAsset(asset.id, { current_price: newPrice });
                                          setActionFeedbackMsg(
                                            isHe
                                              ? `שער נוכחי עבור ${asset.ticker} חולק ב-100 ועודכן לשקלים (₪${newPrice.toFixed(2)})!`
                                              : `Current price for ${asset.ticker} divided by 100 to ₪${newPrice.toFixed(2)}!`
                                          );
                                          setTimeout(() => setActionFeedbackMsg(null), 4000);
                                        }}
                                        style={{
                                          fontSize: '0.68rem',
                                          backgroundColor: '#FEF3C7',
                                          color: '#B45309',
                                          border: '1px solid #FCD34D',
                                          borderRadius: '4px',
                                          padding: '1px 5px',
                                          cursor: 'pointer',
                                          fontWeight: 700,
                                          marginInlineStart: '4px',
                                        }}
                                        title={isHe ? 'שער נוכחי זה נראה באגורות - לחץ לחלוקה ב-100' : 'Price appears to be in Agorot - divide by 100'}
                                      >
                                        {isHe ? 'חלק שער ב-100 ⚡' : '➗ 100 ⚡'}
                                      </button>
                                    )}
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
                                dir="ltr"
                                style={{
                                  ...styles.boldCellText,
                                  color: isProfit ? '#059669' : '#DC2626',
                                  direction: 'ltr',
                                  display: 'inline-block',
                                }}
                              >
                                {isProfit ? `+${formatVal(metrics.profit, asset.currency)}` : formatVal(metrics.profit, asset.currency)}
                              </span>
                            </td>

                            {/* Yield % */}
                            <td style={styles.tdCell}>
                              <span
                                dir="ltr"
                                style={{
                                  ...styles.yieldBadge,
                                  backgroundColor: isProfit ? '#DCFCE7' : '#FEE2E2',
                                  color: isProfit ? '#15803D' : '#B91C1C',
                                  direction: 'ltr',
                                  display: 'inline-block',
                                }}
                              >
                                {isProfit ? '+' : '-'}
                                {Math.abs(metrics.returnPct).toFixed(2)}%
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
                                  style={styles.editAssetBtn}
                                  onClick={() => handleOpenEditAssetModal(asset)}
                                  title={isHe ? 'ערוך פרטי נייר' : 'Edit asset'}
                                >
                                  <Edit2 size={13} color="#2563EB" />
                                </button>
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

                          {/* Tranche Drill-Down Sub-Table (Ledger of Purchases & Sales) */}
                          {isExpanded && (
                            <tr style={styles.trancheSubTr}>
                              <td colSpan={12} style={styles.trancheSubTd}>
                                <div style={styles.trancheSubContainer} className="animate-fade-in">
                                  <div style={styles.trancheSubHeader}>
                                    <div style={styles.trancheSubTitle}>
                                      <Calendar size={15} color="#2563EB" />
                                      <span>
                                        {metrics.hasSales
                                          ? isHe
                                            ? `יומן תנועות והשתנות פוזיציה עבור ${asset.ticker} (${asset.name}):`
                                            : `Transaction Ledger & Position History for ${asset.ticker}:`
                                          : isHe
                                          ? `פירוט פעימות רכישה עבור ${asset.ticker} (${asset.name}):`
                                          : `Purchase Tranche History for ${asset.ticker}:`}
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                      {/* Sort direction toggle button */}
                                      <button
                                        type="button"
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          padding: '5px 10px',
                                          backgroundColor: '#FFFFFF',
                                          border: '1px solid #CBD5E1',
                                          borderRadius: '6px',
                                          fontSize: '0.75rem',
                                          fontWeight: '700',
                                          color: '#334155',
                                          cursor: 'pointer',
                                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                                        }}
                                        onClick={() => {
                                          setTrancheSortOrder((prev) => ({
                                            ...prev,
                                            [asset.id]: prev[asset.id] === 'desc' ? 'asc' : 'desc',
                                          }));
                                        }}
                                        title={isHe ? 'החלף סדר הצגת פעולות' : 'Toggle sort order'}
                                      >
                                        <ArrowUpDown size={13} color="#2563EB" />
                                        <span>
                                          {trancheSortOrder[asset.id] === 'desc'
                                            ? isHe ? 'סדר: מהחדש לישן ⬇️' : 'Order: Newest First ⬇️'
                                            : isHe ? 'סדר: מהישן לחדש (השתנות התיק) ⬆️' : 'Order: Chronological ⬆️'}
                                        </span>
                                      </button>

                                      {getAssetDuplicateCount(asset) > 0 && (
                                        <button
                                          type="button"
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '4px 10px',
                                            backgroundColor: '#FEF2F2',
                                            border: '1px solid #FECACA',
                                            borderRadius: '6px',
                                            color: '#DC2626',
                                            fontSize: '0.72rem',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease',
                                          }}
                                          onClick={() => handleRemoveDuplicateTranches(asset.id)}
                                          title={isHe ? 'הסר פעימות כפולות באופן אוטומטי' : 'Remove duplicate tranches'}
                                        >
                                          <Trash2 size={13} color="#DC2626" />
                                          <span>
                                            {isHe
                                              ? `נקה ${getAssetDuplicateCount(asset)} כפילויות 🧹`
                                              : `Remove ${getAssetDuplicateCount(asset)} Duplicates 🧹`}
                                          </span>
                                        </button>
                                      )}
                                      <button
                                        style={styles.importTrancheSubBtn}
                                        onClick={() => {
                                          setImportTargetAsset(asset);
                                          setIsImportModalOpen(true);
                                        }}
                                        title={
                                          isHe
                                            ? `טעינת פעימות מאקסל עבור ${asset.ticker}`
                                            : `Import tranches from Excel for ${asset.ticker}`
                                        }
                                      >
                                        <FileSpreadsheet size={13} color="#0284C7" />
                                        <span>{isHe ? 'טעינת אקסל' : 'Import Excel'}</span>
                                      </button>
                                      <button
                                        style={styles.addTrancheSubBtn}
                                        onClick={() => handleOpenAddModal('add_tranche', asset)}
                                      >
                                        <Plus size={13} color="#2563EB" />
                                        <span>{isHe ? '+ הוסף פעולה (קנייה / מכירה)' : '+ Add Transaction'}</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Summary Metrics Strip */}
                                  {(metrics.hasSales || (asset.tranches && asset.tranches.length > 1)) && (
                                    <div
                                      style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '14px',
                                        alignItems: 'center',
                                        padding: '10px 14px',
                                        backgroundColor: '#F8FAFC',
                                        border: '1px solid #E2E8F0',
                                        borderRadius: '8px',
                                        marginBottom: '12px',
                                        fontSize: '0.78125rem',
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ color: '#64748B' }}>{isHe ? 'יתרה שוטפת כעת:' : 'Current Position:'}</span>
                                        <strong style={{ color: '#0F172A', fontWeight: '800' }}>
                                          {metrics.totalShares.toLocaleString('en-US', { maximumFractionDigits: 2 })} {isHe ? 'יח\'' : 'units'}
                                        </strong>
                                        <span style={{ color: '#475569', fontSize: '0.75rem' }}>
                                          ({formatVal(metrics.currentValue, asset.currency)})
                                        </span>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ color: '#64748B' }}>
                                          {metrics.hasSales ? (isHe ? 'עלות קובעת פתוחה (FIFO):' : 'Open FIFO Cost Basis:') : (isHe ? 'סך עלות השקעה:' : 'Total Cost Basis:')}
                                        </span>
                                        <strong style={{ color: '#0F172A', fontWeight: '800' }}>
                                          {formatVal(metrics.totalCost, asset.currency)}
                                        </strong>
                                        <span style={{ color: '#475569', fontSize: '0.75rem' }}>
                                          ({isHe ? 'שער ממוצע:' : 'Avg:'} {formatVal(metrics.avgPrice, asset.currency, undefined, 4)})
                                        </span>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ color: '#64748B' }}>{isHe ? 'רווח פתוח צבור:' : 'Unrealized P&L:'}</span>
                                        <strong style={{ color: metrics.profit >= 0 ? '#15803D' : '#DC2626', fontWeight: '800' }}>
                                          {metrics.profit >= 0 ? `+${formatVal(metrics.profit, asset.currency)}` : formatVal(metrics.profit, asset.currency)}
                                        </strong>
                                        <span
                                          dir="ltr"
                                          style={{
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontSize: '0.72rem',
                                            fontWeight: '700',
                                            backgroundColor: metrics.profit >= 0 ? '#DCFCE7' : '#FEE2E2',
                                            color: metrics.profit >= 0 ? '#15803D' : '#DC2626',
                                          }}
                                        >
                                          {metrics.profit >= 0 ? '+' : ''}{metrics.returnPct.toFixed(2)}%
                                        </span>
                                      </div>

                                      {metrics.hasSales && (
                                        <>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ color: '#64748B' }}>{isHe ? 'תקבול מצטבר ממכירות:' : 'Total Sale Proceeds:'}</span>
                                            <strong style={{ color: '#2563EB', fontWeight: '800' }}>
                                              {formatVal(metrics.totalProceeds, asset.currency)}
                                            </strong>
                                          </div>

                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ color: '#64748B' }}>{isHe ? 'רווח ממומש שנפדה:' : 'Realized Gain:'}</span>
                                            <strong style={{ color: metrics.realizedProfit >= 0 ? '#15803D' : '#DC2626', fontWeight: '800' }}>
                                              {metrics.realizedProfit >= 0 ? `+${formatVal(metrics.realizedProfit, asset.currency)}` : formatVal(metrics.realizedProfit, asset.currency)}
                                            </strong>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  )}

                                  <table style={styles.trancheTable}>
                                    <thead>
                                      <tr style={styles.trancheThRow}>
                                        <th style={{ ...styles.trancheTh, width: '28px', textAlign: 'center' }}>#</th>
                                        <th style={{ ...styles.trancheTh, minWidth: '95px' }}>{isHe ? 'תאריך' : 'Date'}</th>
                                        <th style={{ ...styles.trancheTh, textAlign: 'center', minWidth: '85px' }}>{isHe ? 'פעולה' : 'Action'}</th>
                                        <th style={{ ...styles.trancheTh, textAlign: 'center', minWidth: '90px' }}>{isHe ? 'כמות (+/-)' : 'Shares (+/-)'}</th>
                                        <th style={{ ...styles.trancheTh, textAlign: 'right', minWidth: '95px' }}>
                                          {isHe ? 'שער ליחידה' : 'Price / Share'}
                                        </th>
                                        <th style={{ ...styles.trancheTh, textAlign: 'right', minWidth: '100px' }}>
                                          {isHe ? 'סכום / תקבול' : 'Amount / Proceeds'}
                                        </th>
                                        <th style={{ ...styles.trancheTh, textAlign: 'center', minWidth: '115px' }}>
                                          {isHe ? 'יתרת מניות רצה (השתנות התיק)' : 'Running Balance'}
                                        </th>
                                        <th style={{ ...styles.trancheTh, textAlign: 'right', minWidth: '95px' }}>
                                          {isHe ? 'שווי / רווח' : 'Value / P&L'}
                                        </th>
                                        <th style={{ ...styles.trancheTh, maxWidth: '240px', minWidth: '130px' }}>{isHe ? 'הערות' : 'Notes'}</th>
                                        <th style={{ ...styles.trancheTh, ...styles.actionsStickyTh }}>
                                          {isHe ? 'פעולות' : 'Actions'}
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(() => {
                                        // 1. Calculate running balance and FIFO lot tracking chronologically
                                        const sortedAsc = sortTranchesByDateAsc(asset.tranches || []);
                                        let runningBal = 0;
                                        const buyLots: { id: string; remainingShares: number; unitCost: number }[] = [];

                                        const computedLedger = sortedAsc.map((tr, chronoIdx) => {
                                          runningBal += tr.shares;
                                          const balanceAfter = Math.round(runningBal * 100) / 100;
                                          const isSale = tr.shares < 0 || tr.type === 'sell';
                                          const isConvert = tr.type === 'convert';
                                          const trType: InvestmentTrancheType = tr.type || (isSale ? 'sell' : isConvert ? 'convert' : 'buy');

                                          let realizedPnl = tr.realized_pnl;

                                          if (!isSale) {
                                            buyLots.push({
                                              id: tr.id || String(chronoIdx),
                                              remainingShares: tr.shares,
                                              unitCost: tr.price_per_share,
                                            });
                                          } else {
                                            let needed = Math.abs(tr.shares);
                                            const proceeds = tr.total_cost !== undefined ? tr.total_cost : needed * tr.price_per_share;
                                            let costOfSold = 0;

                                            while (needed > 0.0001 && buyLots.length > 0) {
                                              const oldest = buyLots[0];
                                              const take = Math.min(needed, oldest.remainingShares);
                                              costOfSold += take * oldest.unitCost;
                                              oldest.remainingShares -= take;
                                              needed -= take;
                                              if (oldest.remainingShares <= 0.0001) {
                                                buyLots.shift();
                                              }
                                            }
                                            if (realizedPnl === undefined) {
                                              realizedPnl = Math.round((proceeds - costOfSold) * 100) / 100;
                                            }
                                          }

                                          return {
                                            tr,
                                            chronoIdx,
                                            balanceAfter,
                                            trType,
                                            isSale,
                                            isConvert,
                                            realizedPnl,
                                          };
                                        });

                                        // 2. Determine display order
                                        const isAsc = trancheSortOrder[asset.id] !== 'desc';
                                        const displayRows = isAsc ? computedLedger : [...computedLedger].reverse();

                                        return displayRows.map(({ tr, chronoIdx, balanceAfter, trType, isSale, isConvert, realizedPnl }, displayIdx) => {
                                          const originalIndex = (asset.tranches || []).findIndex((t) => t.id === tr.id);
                                          const realIdx = originalIndex >= 0 ? originalIndex : chronoIdx;

                                          const trCost = tr.total_cost !== undefined
                                            ? tr.total_cost
                                            : Math.abs(tr.shares) * tr.price_per_share;
                                          const trVal = Math.abs(tr.shares) * asset.current_price;
                                          const trProfit = trVal - trCost;
                                          const isTrProfit = trProfit >= 0;

                                          return (
                                            <tr
                                              key={tr.id || `tr-${realIdx}`}
                                              style={{
                                                ...styles.trancheTr,
                                                backgroundColor: isSale
                                                  ? '#FFF7F7'
                                                  : isConvert
                                                  ? '#FAF5FF'
                                                  : undefined,
                                              }}
                                            >
                                              <td style={styles.trancheTd}>
                                                <span style={styles.trancheIndexPill}>
                                                  {isAsc ? chronoIdx + 1 : displayRows.length - displayIdx}
                                                </span>
                                              </td>
                                              <td style={styles.trancheTd}>
                                                {editingDateTrancheKey === `${asset.id}_${tr.id || realIdx}` ? (
                                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    <IsraeliDateInput
                                                      value={inlineDateInput}
                                                      onChange={(displayVal) => setInlineDateInput(displayVal)}
                                                      placeholder="15/06/2026"
                                                      style={{ width: '135px' }}
                                                      inputStyle={{
                                                        padding: '3px 6px 3px 28px',
                                                        fontSize: '0.8125rem',
                                                        fontWeight: '700',
                                                        borderRadius: '4px',
                                                        border: '1.5px solid #2563EB',
                                                      }}
                                                      autoFocus
                                                    />
                                                    <button
                                                      style={{
                                                        backgroundColor: '#059669',
                                                        color: '#FFFFFF',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        padding: '3px 8px',
                                                        cursor: 'pointer',
                                                        fontWeight: '700',
                                                        fontSize: '0.75rem',
                                                      }}
                                                      onClick={() => {
                                                        const d = inlineDateInput.trim();
                                                        if (d) {
                                                          const isoDate = normalizeToISODate(d);
                                                          updateInvestmentTranche(
                                                            asset.id,
                                                            tr.id ? String(tr.id) : String(realIdx),
                                                            { date: isoDate },
                                                            undefined,
                                                            realIdx
                                                          );
                                                          setActionFeedbackMsg(
                                                            isHe
                                                              ? `תאריך פעולה #${chronoIdx + 1} עודכן בהצלחה ל-${formatDate(isoDate)}`
                                                              : `Transaction #${chronoIdx + 1} date updated to ${formatDate(isoDate)}`
                                                          );
                                                          setTimeout(() => setActionFeedbackMsg(null), 4000);
                                                        }
                                                        setEditingDateTrancheKey(null);
                                                      }}
                                                      title={isHe ? 'שמור תאריך' : 'Save date'}
                                                    >
                                                      ✓
                                                    </button>
                                                    <button
                                                      style={{
                                                        backgroundColor: '#EF4444',
                                                        color: '#FFFFFF',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        padding: '3px 6px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.75rem',
                                                      }}
                                                      onClick={() => setEditingDateTrancheKey(null)}
                                                      title={isHe ? 'ביטול' : 'Cancel'}
                                                    >
                                                      ✕
                                                    </button>
                                                  </div>
                                                ) : (
                                                  <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '2px' }}>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                      <span style={{ fontWeight: '700', color: '#1E293B' }}>{formatDate(tr.date)}</span>
                                                      <button
                                                        style={{
                                                          backgroundColor: '#EFF6FF',
                                                          border: '1px solid #BFDBFE',
                                                          borderRadius: '4px',
                                                          cursor: 'pointer',
                                                          padding: '2px 4px',
                                                          display: 'flex',
                                                          alignItems: 'center',
                                                          gap: '2px',
                                                        }}
                                                        onClick={() => {
                                                          setEditingDateTrancheKey(`${asset.id}_${tr.id || realIdx}`);
                                                          setInlineDateInput(formatDate(tr.date));
                                                        }}
                                                        title={isHe ? 'עריכה מהירה של תאריך הפעולה' : 'Quick edit date'}
                                                      >
                                                        <Edit2 size={11} color="#2563EB" />
                                                      </button>
                                                    </div>
                                                    {tr.orig_date && tr.orig_date !== tr.date && (
                                                      <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
                                                        {isHe ? `רכישה מקורית: ${formatDate(tr.orig_date)}` : `Orig: ${formatDate(tr.orig_date)}`}
                                                      </span>
                                                    )}
                                                  </div>
                                                )}
                                              </td>

                                              {/* Action Type Badge */}
                                              <td style={{ ...styles.trancheTd, textAlign: 'center' }}>
                                                {isSale ? (
                                                  <span
                                                    style={{
                                                      padding: '3px 8px',
                                                      borderRadius: '6px',
                                                      fontSize: '0.75rem',
                                                      fontWeight: 700,
                                                      backgroundColor: '#FEE2E2',
                                                      color: '#B91C1C',
                                                      display: 'inline-flex',
                                                      alignItems: 'center',
                                                      gap: '4px',
                                                    }}
                                                  >
                                                    <ArrowUpRight size={12} color="#DC2626" />
                                                    <span>{isHe ? 'מכירה' : 'Sell'}</span>
                                                  </span>
                                                ) : isConvert ? (
                                                  <span
                                                    style={{
                                                      padding: '3px 8px',
                                                      borderRadius: '6px',
                                                      fontSize: '0.75rem',
                                                      fontWeight: 700,
                                                      backgroundColor: '#F3E8FF',
                                                      color: '#7E22CE',
                                                      display: 'inline-flex',
                                                      alignItems: 'center',
                                                      gap: '4px',
                                                    }}
                                                  >
                                                    <span>🟣</span>
                                                    <span>{isHe ? 'המרה' : 'Convert'}</span>
                                                  </span>
                                                ) : (
                                                  <span
                                                    style={{
                                                      padding: '3px 8px',
                                                      borderRadius: '6px',
                                                      fontSize: '0.75rem',
                                                      fontWeight: 700,
                                                      backgroundColor: '#DCFCE7',
                                                      color: '#15803D',
                                                      display: 'inline-flex',
                                                      alignItems: 'center',
                                                      gap: '4px',
                                                    }}
                                                  >
                                                    <ArrowDownLeft size={12} color="#16A34A" />
                                                    <span>{isHe ? 'קנייה' : 'Buy'}</span>
                                                  </span>
                                                )}
                                              </td>

                                              {/* Shares (+ / -) */}
                                              <td style={{ ...styles.trancheTd, textAlign: 'center' }}>
                                                <strong
                                                  dir="ltr"
                                                  style={{
                                                    color: isSale ? '#DC2626' : '#15803D',
                                                    fontWeight: '800',
                                                    fontSize: '0.85rem',
                                                    direction: 'ltr',
                                                    display: 'inline-block',
                                                  }}
                                                >
                                                  {isSale
                                                    ? `-${Math.abs(tr.shares).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                                                    : `+${tr.shares.toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
                                                </strong>
                                              </td>

                                              {/* Price / Share */}
                                              <td style={styles.trancheTd}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                                                  <span style={{ fontWeight: '600' }}>
                                                    {formatVal(tr.price_per_share, asset.currency, undefined, 4)}
                                                  </span>
                                                  {asset.currency === 'ILS' && (
                                                    <span style={{ fontSize: '0.7rem', color: '#64748B' }}>
                                                      ({Number((tr.price_per_share * 100).toFixed(2)).toLocaleString('en-US')} אג')
                                                    </span>
                                                  )}
                                                  {asset.currency === 'ILS' && !tr.ignore_agorot_fix && !tr.notes?.includes('חולק ב-100') && !tr.notes?.includes('תוקן מאגורות') && ((asset.current_price > 0 && tr.price_per_share / asset.current_price >= 40) || tr.price_per_share >= 10000) && (
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        const newPrice = Number((tr.price_per_share / 100).toFixed(4));
                                                        updateInvestmentTranche(
                                                          asset.id,
                                                          tr.id ? String(tr.id) : String(realIdx),
                                                          {
                                                            price_per_share: newPrice,
                                                            total_cost: Number((Math.abs(tr.shares) * newPrice).toFixed(2)),
                                                            notes: tr.notes ? `${tr.notes} | תוקן מאגורות` : `שער מקורי: ${tr.price_per_share} אגורות`,
                                                          },
                                                          undefined,
                                                          realIdx
                                                        );
                                                        setActionFeedbackMsg(
                                                          isHe
                                                            ? `שער פעולה #${chronoIdx + 1} חולק ב-100 ותוקן לשקלים!`
                                                            : `Transaction #${chronoIdx + 1} divided by 100!`
                                                        );
                                                        setTimeout(() => setActionFeedbackMsg(null), 4000);
                                                      }}
                                                      style={{
                                                        fontSize: '0.68rem',
                                                        backgroundColor: '#FEF3C7',
                                                        color: '#B45309',
                                                        border: '1px solid #FCD34D',
                                                        borderRadius: '4px',
                                                        padding: '1px 5px',
                                                        cursor: 'pointer',
                                                        fontWeight: 700,
                                                        marginTop: '2px',
                                                      }}
                                                      title={isHe ? 'שער זה נראה באגורות - לחץ לחלוקה ב-100' : 'Price appears to be in Agorot - click to divide by 100'}
                                                    >
                                                      {isHe ? 'חלק ב-100 ⚡' : '➗ 100 ⚡'}
                                                    </button>
                                                  )}
                                                </div>
                                              </td>

                                              {/* Total Amount / Proceeds */}
                                              <td style={styles.trancheTd}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                                                  <strong style={{ color: isSale ? '#047857' : '#0F172A' }}>
                                                    {formatVal(trCost, asset.currency)}
                                                  </strong>
                                                  <span style={{ fontSize: '0.68rem', color: isSale ? '#059669' : '#64748B', fontWeight: isSale ? 700 : 400 }}>
                                                    {isSale ? (isHe ? 'תקבול פדיון' : 'Proceeds') : (isHe ? 'עלות רכישה' : 'Cost')}
                                                  </span>
                                                </div>
                                              </td>

                                              {/* Running Balance (השתנות התיק) */}
                                              <td style={{ ...styles.trancheTd, textAlign: 'center' }}>
                                                <div
                                                  dir="ltr"
                                                  style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '5px',
                                                    padding: '4px 10px',
                                                    borderRadius: '6px',
                                                    backgroundColor: '#F1F5F9',
                                                    border: '1px solid #CBD5E1',
                                                    fontWeight: '800',
                                                    fontSize: '0.8125rem',
                                                    color: '#0F172A',
                                                  }}
                                                >
                                                  <span>{balanceAfter.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                                                  <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: '500' }}>
                                                    {isHe ? 'יח\'' : 'units'}
                                                  </span>
                                                </div>
                                              </td>

                                              {/* Value / P&L */}
                                              <td style={styles.trancheTd}>
                                                {isSale ? (
                                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                                                    <span
                                                      dir="ltr"
                                                      style={{
                                                        color: (realizedPnl || 0) >= 0 ? '#15803D' : '#DC2626',
                                                        fontWeight: '800',
                                                        direction: 'ltr',
                                                        display: 'inline-block',
                                                      }}
                                                    >
                                                      {(realizedPnl || 0) >= 0 ? `+${formatVal(realizedPnl || 0, asset.currency)}` : formatVal(realizedPnl || 0, asset.currency)}
                                                    </span>
                                                    <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
                                                      {isHe ? 'רווח ממומש' : 'Realized Gain'}
                                                    </span>
                                                  </div>
                                                ) : (
                                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                                                    <span style={{ fontWeight: '600' }}>
                                                      {formatVal(trVal, asset.currency)}
                                                    </span>
                                                    <span
                                                      dir="ltr"
                                                      style={{
                                                        color: isTrProfit ? '#15803D' : '#DC2626',
                                                        fontWeight: '700',
                                                        fontSize: '0.72rem',
                                                        direction: 'ltr',
                                                        display: 'inline-block',
                                                      }}
                                                    >
                                                      {isTrProfit ? `+${formatVal(trProfit, asset.currency)}` : formatVal(trProfit, asset.currency)}
                                                    </span>
                                                  </div>
                                                )}
                                              </td>

                                              {/* Notes */}
                                              <td style={styles.trancheNotesTd} title={tr.notes || ''}>
                                                <span style={styles.notesText}>{tr.notes || '—'}</span>
                                              </td>

                                              {/* Actions */}
                                              <td style={styles.actionsStickyTd}>
                                                <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                                                  <button
                                                    style={styles.editTrancheBtn}
                                                    onClick={() => handleOpenEditTrancheModal(asset, tr, realIdx)}
                                                    title={isHe ? 'ערוך פעולה (תאריך, שער וסכום)' : 'Edit transaction'}
                                                  >
                                                    <Edit2 size={13} color="#2563EB" />
                                                  </button>
                                                  <button
                                                    style={styles.deleteTrancheBtn}
                                                    onClick={() => {
                                                      if (
                                                        confirm(
                                                          isHe
                                                            ? 'האם למחוק פעולה זו מיומן הנייר?'
                                                            : 'Delete this transaction from ledger?'
                                                        )
                                                      ) {
                                                        deleteInvestmentTranche(asset.id, tr.id ? String(tr.id) : String(realIdx));
                                                      }
                                                    }}
                                                    title={isHe ? 'מחק פעולה' : 'Delete transaction'}
                                                  >
                                                    <Trash2 size={13} color="#EF4444" />
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        });
                                      })()}
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
                  onClick={() => {
                    if (fetchPeriodType === 'year_end') {
                      handleRunBatchLoop('year_end', fetchYear);
                    } else if (fetchPeriodType === 'quarter_end') {
                      handleRunBatchLoop('quarter_end', fetchYear, fetchQuarter);
                    } else {
                      handleFetchPeriodQuotes();
                    }
                  }}
                  disabled={isFetchingPeriodQuotes}
                >
                  <Globe size={18} className={isFetchingPeriodQuotes ? 'spin-icon' : ''} />
                  <span>
                    {isFetchingPeriodQuotes
                      ? batchProgress
                        ? isHe
                          ? `מסנכרן ${batchProgress.currentMonthName} (${batchProgress.currentIndex}/${batchProgress.totalCount})...`
                          : `Syncing ${batchProgress.currentMonthName} (${batchProgress.currentIndex}/${batchProgress.totalCount})...`
                        : isHe
                        ? 'פונה לאתרים ומושך ציטוטי סגירה...'
                        : 'Fetching closing quotes...'
                      : fetchPeriodType === 'year_end'
                      ? isHe
                        ? `סנכרן את כל חודשי שנת ${fetchYear} בלופ (ינואר - דצמבר)`
                        : `Sync Full Year ${fetchYear} Loop (Jan - Dec)`
                      : fetchPeriodType === 'quarter_end'
                      ? isHe
                        ? `סנכרן את כל חודשי רבעון Q${fetchQuarter} ${fetchYear} בלופ`
                        : `Sync Q${fetchQuarter} ${fetchYear} Months Loop`
                      : isHe
                      ? 'פנה לאתרים ומשוך ציטוטים לתקופה זו'
                      : 'Fetch Closing Quotes & Calculate P&L'}
                  </span>
                </button>
              </div>
            </div>

            {/* LIVE BATCH LOOP PROGRESS BAR */}
            {batchProgress && (
              <div
                style={{
                  marginTop: '16px',
                  backgroundColor: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  borderRadius: '10px',
                  padding: '14px 18px',
                  boxShadow: '0 2px 4px rgba(37, 99, 235, 0.08)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#1E40AF',
                      fontWeight: '700',
                      fontSize: '0.9rem',
                    }}
                  >
                    <RefreshCw size={16} className="spin-icon" color="#2563EB" />
                    <span>{batchProgress.title}</span>
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#2563EB' }}>
                    {batchProgress.currentIndex} {isHe ? 'מתוך' : 'of'} {batchProgress.totalCount} (
                    {Math.round((batchProgress.currentIndex / batchProgress.totalCount) * 100)}%)
                  </span>
                </div>

                <div
                  style={{
                    width: '100%',
                    height: '10px',
                    backgroundColor: '#DBEAFE',
                    borderRadius: '999px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${(batchProgress.currentIndex / batchProgress.totalCount) * 100}%`,
                      backgroundColor: '#2563EB',
                      borderRadius: '999px',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>

                <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#1E3A8A' }}>
                  {isHe
                    ? `מעבד כעת: ${batchProgress.currentMonthName} (משיכת שערים וחישוב פעימות לפי מועד רכישה)...`
                    : `Processing: ${batchProgress.currentMonthName}...`}
                </div>
              </div>
            )}

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
                    {(() => {
                      const heldCount = fetchedPeriodResult.items.filter((it) => it.shares > 0).length;
                      const totalCount = fetchedPeriodResult.items.length;
                      return (
                        <p style={styles.fetchedResultSub}>
                          {isHe
                            ? `יום מסחר שנמצא: ${fetchedPeriodResult.date} | ${heldCount} ניירות הוחזקו במועד זה (מתוך ${totalCount} בתיק)`
                            : `Trading date: ${fetchedPeriodResult.date} | ${heldCount} assets held (out of ${totalCount} in portfolio)`}
                        </p>
                      );
                    })()}
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
                      dir="ltr"
                      style={{
                        ...styles.periodKpiVal,
                        color: fetchedPeriodResult.totalProfit >= 0 ? '#059669' : '#DC2626',
                        direction: 'ltr',
                        display: 'inline-block',
                      }}
                    >
                      {fetchedPeriodResult.totalProfit >= 0 ? '+' : '-'}
                      ₪{Math.abs(fetchedPeriodResult.totalProfit).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div style={styles.periodKpiItem}>
                    <span style={styles.periodKpiLabel}>{isHe ? 'תשואה נקודתית' : 'Periodic Yield'}</span>
                    <span
                      dir="ltr"
                      style={{
                        ...styles.periodKpiVal,
                        color: fetchedPeriodResult.totalProfit >= 0 ? '#15803D' : '#B91C1C',
                        direction: 'ltr',
                        display: 'inline-block',
                      }}
                    >
                      {fetchedPeriodResult.totalReturnPct >= 0 ? '+' : '-'}
                      {Math.abs(fetchedPeriodResult.totalReturnPct).toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Detailed Assets Breakdown Table for the Period */}
                {(() => {
                  const heldCount = fetchedPeriodResult.items.filter((it) => it.shares > 0).length;
                  const totalCount = fetchedPeriodResult.items.length;
                  const filteredItems = fetchedPeriodResult.items.filter((item) =>
                    hideZeroSharesInPeriod ? item.shares > 0 : true
                  );

                  return (
                    <>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: '16px',
                          marginBottom: '8px',
                          flexWrap: 'wrap',
                          gap: '8px',
                        }}
                      >
                        <label
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.8125rem',
                            fontWeight: '700',
                            color: '#1E293B',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={hideZeroSharesInPeriod}
                            onChange={(e) => setHideZeroSharesInPeriod(e.target.checked)}
                            style={{ accentColor: '#2563EB', cursor: 'pointer', width: '15px', height: '15px' }}
                          />
                          <span>
                            {isHe
                              ? `הצג רק ניירות שהוחזקו במועד זה (${heldCount})`
                              : `Show only held assets (${heldCount})`}
                          </span>
                        </label>
                        {totalCount - heldCount > 0 && (
                          <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '500' }}>
                            {isHe
                              ? `(${totalCount - heldCount} ניירות נרכשו רק לאחר מועד זה — כמותם חושבה כ-0)`
                              : `(${totalCount - heldCount} assets purchased after this date — calculated as 0 shares)`}
                          </span>
                        )}
                      </div>

                      <div style={{ overflowX: 'auto', marginTop: '6px' }}>
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
                            {filteredItems.map((item) => {
                              const isGain = item.profit >= 0;
                              const hasShares = item.shares > 0;
                              return (
                                <tr
                                  key={item.asset_id}
                                  style={{
                                    ...styles.trRow,
                                    ...(hasShares ? {} : { opacity: 0.65, backgroundColor: '#F8FAFC' }),
                                  }}
                                >
                                  <td style={styles.tdCell}>
                                    <div style={styles.tickerPill}>{item.ticker}</div>
                                    {getEffectiveSecurityNumber(item) && (
                                      <div style={styles.secNumText}>#{getEffectiveSecurityNumber(item)}</div>
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
                                  <td style={styles.tdCell}>{formatDate(item.quote_date) || '—'}</td>
                                  <td style={styles.tdCell}>
                                    {hasShares ? (
                                      <strong>{item.shares}</strong>
                                    ) : (
                                      <span style={{ color: '#94A3B8', fontWeight: '600', fontSize: '0.75rem' }}>
                                        {isHe ? '0 (טרם נרכש)' : '0 (Not owned)'}
                                      </span>
                                    )}
                                  </td>
                                  <td style={styles.tdCell}>
                                    {hasShares ? (
                                      `${item.currency === 'USD' ? '$' : '₪'}${item.total_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                                    ) : (
                                      <span style={{ color: '#94A3B8' }}>—</span>
                                    )}
                                  </td>
                                  <td style={styles.tdCell}>
                                    {hasShares ? (
                                      <strong>
                                        {item.currency === 'USD' ? '$' : '₪'}
                                        {item.market_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                      </strong>
                                    ) : (
                                      <span style={{ color: '#94A3B8' }}>—</span>
                                    )}
                                  </td>
                                  <td style={styles.tdCell}>
                                    {hasShares ? (
                                      <span style={{ color: isGain ? '#059669' : '#DC2626', fontWeight: '700' }}>
                                        {isGain ? '+' : ''}
                                        {item.currency === 'USD' ? '$' : '₪'}
                                        {item.profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                      </span>
                                    ) : (
                                      <span style={{ color: '#94A3B8' }}>—</span>
                                    )}
                                  </td>
                                  <td style={styles.tdCell}>
                                    {hasShares ? (
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
                                    ) : (
                                      <span style={{ color: '#94A3B8' }}>—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  );
                })()}
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

      {/* TAB 4: DAILY CLOSING PRICES (שערי סוף יום אוטומטיים) */}
      {activeSubTab === 'daily_prices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Banner Card */}
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(37, 99, 235, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563EB',
                  flexShrink: 0,
                }}>
                  <Clock size={22} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {isHe ? 'שערי נעילה יומיים (סוף יום 23:55)' : 'Daily Closing Prices (23:55 End-Of-Day)'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '650px', lineHeight: 1.5 }}>
                    {isHe
                      ? 'המערכת מתעדכנת אוטומטית בצד שרת בכל יום ב-23:55 (גם כשהאפליקציה או המחשב סגורים), שומרת את שערי הנעילה של כל ניירות הערך המוחזקים בטבלה נפרדת (security_daily_prices) ומייצרת נקודת מעקב יומית בגרף השווי.'
                      : 'The server updates automatically every day at 23:55 (even when the app or device is offline), recording closing prices into security_daily_prices and generating daily portfolio points on the timeline graph.'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  onClick={loadDailyPrices}
                  disabled={isLoadingDailyPrices}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--card-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                  title={isHe ? 'רענן נתוני טבלה' : 'Refresh table'}
                >
                  <RefreshCw size={14} className={isLoadingDailyPrices ? 'animate-spin' : ''} />
                  <span>{isHe ? 'רענן טבלה' : 'Refresh'}</span>
                </button>

                <button
                  onClick={() => triggerManualDailySync(false)}
                  disabled={isSyncingDailyQuotes}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 18px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                    color: '#FFFFFF',
                    fontSize: '0.88rem',
                    fontWeight: '700',
                    cursor: isSyncingDailyQuotes ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                    opacity: isSyncingDailyQuotes ? 0.7 : 1,
                  }}
                >
                  <Sparkles size={16} />
                  <span>
                    {isSyncingDailyQuotes
                      ? (isHe ? 'מושך שערים ומייצר סנפשוט...' : 'Syncing EOD Quotes...')
                      : (isHe ? 'סנכרן שערים יומיים' : 'Sync EOD Quotes')}
                  </span>
                </button>

                <button
                  onClick={() => triggerManualDailySync(true)}
                  disabled={isSyncingDailyQuotes}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 18px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    color: '#FFFFFF',
                    fontSize: '0.88rem',
                    fontWeight: '700',
                    cursor: isSyncingDailyQuotes ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                    opacity: isSyncingDailyQuotes ? 0.7 : 1,
                  }}
                  title={isHe ? 'סגירת חודש יזומה, עדכון עץ התקופות וניקוי שבועי' : 'Trigger Month-End snapshot and retention cleanup'}
                >
                  <Calendar size={16} />
                  <span>
                    {isSyncingDailyQuotes
                      ? (isHe ? 'מעבד סגירת חודש...' : 'Processing EOM...')
                      : (isHe ? 'בצע סגירת חודש יזומה (בדיקת עץ וניקוי)' : 'Trigger Month-End & Cleanup')}
                  </span>
                </button>
              </div>
            </div>

            {/* Status Feedback Banner */}
            {dailySyncStatusMsg && (
              <div style={{
                marginTop: '16px',
                padding: '12px 16px',
                borderRadius: '10px',
                fontSize: '0.9rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor:
                  dailySyncStatusMsg.type === 'success'
                    ? 'rgba(16, 185, 129, 0.1)'
                    : dailySyncStatusMsg.type === 'error'
                    ? 'rgba(239, 68, 68, 0.1)'
                    : 'rgba(59, 130, 246, 0.1)',
                color:
                  dailySyncStatusMsg.type === 'success'
                    ? '#059669'
                    : dailySyncStatusMsg.type === 'error'
                    ? '#DC2626'
                    : '#2563EB',
                border: `1px solid ${
                  dailySyncStatusMsg.type === 'success'
                    ? '#10B981'
                    : dailySyncStatusMsg.type === 'error'
                    ? '#EF4444'
                    : '#3B82F6'
                }`,
              }}>
                {dailySyncStatusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <Info size={16} />}
                <span>{dailySyncStatusMsg.text}</span>
              </div>
            )}
          </div>

          {/* Table Card */}
          <div style={styles.tableCard}>
            <div style={styles.tableHeaderBar}>
              <div style={styles.tableTitleGroup}>
                <Calendar size={18} color="#2563EB" />
                <h4 style={styles.tableTitle}>
                  {isHe ? 'היסטוריית שערי סגירה יומית שנשמרו' : 'Historical EOD Closing Prices'}
                </h4>
                <span style={styles.tableCountBadge}>
                  {dailyPrices.length} {isHe ? 'שערים רשומים' : 'records'}
                </span>
              </div>

              {/* Search bar */}
              <div style={{ position: 'relative', width: '220px' }}>
                <Search size={14} style={{ position: 'absolute', right: isHe ? '10px' : 'auto', left: isHe ? 'auto' : '10px', top: '10px', color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  placeholder={isHe ? 'חיפוש נייר / סימול...' : 'Search ticker...'}
                  value={dailyPriceSearch}
                  onChange={(e) => setDailyPriceSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: isHe ? '7px 32px 7px 10px' : '7px 10px 7px 32px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--input-bg, var(--card-bg))',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>
            </div>

            {/* Table Content */}
            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>{isHe ? 'תאריך שער' : 'Date'}</th>
                    <th style={styles.th}>{isHe ? 'שם / סימול נייר' : 'Security / Ticker'}</th>
                    <th style={styles.th}>{isHe ? 'מספר נייר' : 'Security No.'}</th>
                    <th style={styles.th}>{isHe ? 'שער נעילה יומי' : 'Closing Price'}</th>
                    <th style={styles.th}>{isHe ? 'מטבע' : 'Currency'}</th>
                    <th style={styles.th}>{isHe ? 'מקור נתונים' : 'Source'}</th>
                    <th style={styles.th}>{isHe ? 'שעת שמירה' : 'Saved At'}</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyPrices.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                          <Clock size={32} color="var(--text-secondary)" style={{ opacity: 0.5 }} />
                          <p style={{ margin: 0, fontWeight: '600', fontSize: '0.95rem' }}>
                            {isHe ? 'טרם נשמרו שערים יומיים בטבלה' : 'No daily closing prices recorded yet'}
                          </p>
                          <p style={{ margin: 0, fontSize: '0.85rem' }}>
                            {isHe
                              ? 'המערכת תדגום אוטומטית ב-23:55 בכל לילה, או שתוכל ללחוץ על "סנכרן שערים עכשיו" לבדיקה מיידית.'
                              : 'The cron will automatically record prices at 23:55, or click "Sync EOD Quotes Now" to test immediately.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    dailyPrices
                      .filter((p) => {
                        if (!dailyPriceSearch) return true;
                        const q = dailyPriceSearch.toLowerCase();
                        return (
                          p.ticker.toLowerCase().includes(q) ||
                          (p.security_number && p.security_number.includes(q)) ||
                          (p.price_date && p.price_date.includes(q))
                        );
                      })
                      .map((p) => (
                        <tr key={p.id || `${p.ticker}-${p.price_date}`} style={styles.tr}>
                          <td style={{ ...styles.td, fontWeight: '700', color: 'var(--text-primary)' }}>
                            {formatDate(p.price_date)}
                          </td>
                          <td style={{ ...styles.td, fontWeight: '600' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(37, 99, 235, 0.1)',
                              color: '#2563EB',
                              fontWeight: '700',
                              fontFamily: 'monospace',
                            }}>
                              {p.ticker}
                            </span>
                          </td>
                          <td style={{ ...styles.td, color: 'var(--text-secondary)' }}>
                            {p.security_number || '—'}
                          </td>
                          <td style={{ ...styles.td, fontWeight: '700', fontSize: '0.95rem', color: '#059669' }}>
                            {p.currency === 'USD' ? '$' : '₪'}
                            {Number(p.closing_price).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 4,
                            })}
                          </td>
                          <td style={styles.td}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              backgroundColor: p.currency === 'USD' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                              color: p.currency === 'USD' ? '#059669' : '#4F46E5',
                            }}>
                              {p.currency}
                            </span>
                          </td>
                          <td style={{ ...styles.td, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {p.source || 'Automated Cron'}
                          </td>
                          <td style={{ ...styles.td, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {p.created_at ? new Date(p.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* MODAL: ADD / EDIT ASSET / TRANCHE */}
      {isModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard} className="animate-fade-in">
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleRow}>
                <Coins size={20} color="#2563EB" />
                <h3 style={styles.modalTitle}>
                  {modalMode === 'new_asset' && (isHe ? 'הוספת נייר ערך חדש ופעימת רכישה' : 'Add New Investment & First Tranche')}
                  {modalMode === 'edit_asset' && (isHe ? `עריכת פרטי נייר ערך (${formTicker || 'נייר'})` : `Edit Asset (${formTicker || 'Asset'})`)}
                  {modalMode === 'add_tranche' && (isHe ? `הוספת פעימת רכישה ל-${formTicker}` : `Add Purchase Tranche to ${formTicker}`)}
                  {modalMode === 'edit_tranche' && (isHe ? `עריכת פעימת רכישה עבור ${formTicker}` : `Edit Purchase Tranche for ${formTicker}`)}
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
              {/* Asset Details Header for Tranche Modes */}
              {(modalMode === 'add_tranche' || modalMode === 'edit_tranche') && (
                <div
                  style={{
                    backgroundColor: '#EFF6FF',
                    borderRadius: '10px',
                    border: '1px solid #BFDBFE',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: '800', color: '#1E3A8A', fontSize: '1.05rem' }}>{formTicker}</span>
                      <span style={{ color: '#64748B' }}>•</span>
                      <span style={{ color: '#1E293B', fontWeight: '600', fontSize: '0.9rem' }}>{formName}</span>
                      {formSecurityNumber && (
                        <span style={{ fontSize: '0.75rem', backgroundColor: '#DBEAFE', color: '#1D4ED8', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                          #{formSecurityNumber}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                      {SECURITY_TYPE_LABELS[formAssetType]?.icon} {isHe ? SECURITY_TYPE_LABELS[formAssetType]?.he : SECURITY_TYPE_LABELS[formAssetType]?.en} • {formCurrency}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                    <label style={{ fontSize: '0.7rem', color: '#475569', fontWeight: '700' }}>
                      {isHe ? 'שער מניה נוכחי בשוק:' : 'Current Market Price:'}
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        step="any"
                        style={{ ...styles.formInput, width: '100px', padding: '4px 8px', fontSize: '0.85rem' }}
                        value={formCurrentPrice}
                        onChange={(e) => setFormCurrentPrice(e.target.value)}
                        placeholder="שער"
                      />
                      <span style={{ fontSize: '0.8125rem', fontWeight: '800', color: '#1E3A8A' }}>
                        {formCurrency === 'USD' ? '$' : '₪'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Asset Details Fields (only shown in new_asset and edit_asset) */}
              {(modalMode === 'new_asset' || modalMode === 'edit_asset') && (
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
                        onChange={(e) => {
                          const newCurr = e.target.value as 'USD' | 'ILS';
                          setFormCurrency(newCurr);
                          setIsPriceInAgorot(newCurr === 'ILS');
                        }}
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

              {/* Tranche Details (Shown in new_asset, add_tranche, and edit_tranche) */}
              {modalMode !== 'edit_asset' && (
                <>
                  <div style={styles.sectionDivider}>
                    <span>
                      {modalMode === 'edit_tranche'
                        ? isHe
                          ? 'עריכת פעולה (תאריך, סוג, כמות ומחיר)'
                          : 'Edit Transaction Details'
                        : isHe
                        ? 'פרטי הפעולה (תאריך, סוג, כמות ומחיר)'
                        : 'Transaction Details'}
                    </span>
                  </div>

                  {/* Transaction Type Selector (Buy / Sell / Convert) */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ ...styles.formLabel, marginBottom: '6px' }}>
                      {isHe ? 'סוג פעולה *' : 'Transaction Type *'}
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      <button
                        type="button"
                        style={{
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: formTrancheType === 'buy' ? '2px solid #16A34A' : '1px solid #CBD5E1',
                          backgroundColor: formTrancheType === 'buy' ? '#DCFCE7' : '#FFFFFF',
                          color: formTrancheType === 'buy' ? '#15803D' : '#475569',
                          fontWeight: 700,
                          fontSize: '0.8125rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                        onClick={() => setFormTrancheType('buy')}
                      >
                        <span>🟢</span>
                        <span>{isHe ? 'קנייה (Buy)' : 'Buy'}</span>
                      </button>

                      <button
                        type="button"
                        style={{
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: formTrancheType === 'sell' ? '2px solid #DC2626' : '1px solid #CBD5E1',
                          backgroundColor: formTrancheType === 'sell' ? '#FEE2E2' : '#FFFFFF',
                          color: formTrancheType === 'sell' ? '#B91C1C' : '#475569',
                          fontWeight: 700,
                          fontSize: '0.8125rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                        onClick={() => setFormTrancheType('sell')}
                      >
                        <span>🔴</span>
                        <span>{isHe ? 'מכירה (Sell)' : 'Sell'}</span>
                      </button>

                      <button
                        type="button"
                        style={{
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: formTrancheType === 'convert' ? '2px solid #7E22CE' : '1px solid #CBD5E1',
                          backgroundColor: formTrancheType === 'convert' ? '#F3E8FF' : '#FFFFFF',
                          color: formTrancheType === 'convert' ? '#7E22CE' : '#475569',
                          fontWeight: 700,
                          fontSize: '0.8125rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                        onClick={() => setFormTrancheType('convert')}
                      >
                        <span>🟣</span>
                        <span>{isHe ? 'המרה / מיזוג' : 'Convert'}</span>
                      </button>
                    </div>
                  </div>

                  <div style={styles.formRow3}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>
                        {formTrancheType === 'sell'
                          ? isHe ? 'תאריך מכירה *' : 'Sale Date *'
                          : isHe ? 'תאריך רכישה *' : 'Purchase Date *'}
                      </label>
                      <IsraeliDateInput
                        value={formDate}
                        onChange={(displayVal) => setFormDate(displayVal)}
                        placeholder="15/06/2026"
                        required
                      />
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>
                        {formTrancheType === 'sell'
                          ? isHe ? 'כמות יחידות למכירה *' : 'Shares to Sell *'
                          : isHe ? 'כמות מניות / יחידות *' : 'Shares / Quantity *'}
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <label style={styles.formLabel}>
                          {isHe
                            ? formCurrency === 'ILS' && isPriceInAgorot
                              ? 'שער ביצוע (באגורות) *'
                              : `${formTrancheType === 'sell' ? 'שער מכירה' : 'מחיר ליחידה'} (${formCurrency === 'USD' ? '$' : '₪'}) *`
                            : formCurrency === 'ILS' && isPriceInAgorot
                            ? 'Price in Agorot *'
                            : `${formTrancheType === 'sell' ? 'Sale Price' : 'Price per Share'} (${formCurrency === 'USD' ? '$' : '₪'}) *`}
                        </label>
                        {formCurrency === 'ILS' && (
                          <label
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.75rem',
                              color: '#2563EB',
                              cursor: 'pointer',
                              fontWeight: 600,
                              userSelect: 'none',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isPriceInAgorot}
                              onChange={(e) => handleTogglePriceInAgorot(e.target.checked)}
                            />
                            <span>{isHe ? 'שער באגורות (➗ 100)' : 'In Agorot (➗ 100)'}</span>
                          </label>
                        )}
                      </div>
                      <input
                        style={styles.formInput}
                        type="number"
                        step="any"
                        placeholder={formCurrency === 'ILS' && isPriceInAgorot ? 'לדוגמה: 1940' : 'e.g. 100'}
                        value={formPricePerShare}
                        onChange={(e) => handlePricePerShareChange(e.target.value)}
                        required
                      />
                      {formCurrency === 'ILS' && isPriceInAgorot && parseFloat(formPricePerShare) > 0 && (
                        <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, marginTop: '2px', display: 'block' }}>
                          = ₪{(parseFloat(formPricePerShare) / 100).toFixed(2)} ליחידה בשקלים
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={styles.formRow2}>
                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>
                        {formTrancheType === 'sell'
                          ? isHe
                            ? `סך תקבול / פדיון (${formCurrency === 'USD' ? '$' : '₪'})`
                            : `Total Sale Proceeds (${formCurrency === 'USD' ? '$' : '₪'})`
                          : isHe
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
                        {formTrancheType === 'sell'
                          ? isHe ? 'תקבול כספי: כמות × שער מכירה' : 'Proceeds: shares × price'
                          : isHe ? 'סכום רכישה (קרן): כמות × מחיר' : 'Cost basis: shares × price'}
                      </span>
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.formLabel}>
                        {formTrancheType === 'sell'
                          ? isHe
                            ? `עמלת מכירה (${formCurrency === 'USD' ? '$' : '₪'})`
                            : `Sale Fee (${formCurrency === 'USD' ? '$' : '₪'})`
                          : isHe
                          ? `עמלת קנייה (${formCurrency === 'USD' ? '$' : '₪'})`
                          : `Trading Fee (${formCurrency === 'USD' ? '$' : '₪'})`}
                      </label>
                      <input
                        style={styles.formInput}
                        type="number"
                        step="any"
                        placeholder="0"
                        value={formFee}
                        onChange={(e) => setFormFee(e.target.value)}
                      />
                      <span style={styles.inputHelper}>
                        {isHe ? 'משולמת בנפרד בחשבון (אינה נכללת בחישוב רווח/הפסד)' : 'Paid separately in account (excluded from P&L)'}
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
                        {(() => {
                          const trShares = parseFloat(formShares);
                          const rawPrice = parseFloat(formPricePerShare);
                          const effectiveUnitPrice = (formCurrency === 'ILS' && isPriceInAgorot) ? rawPrice / 100 : rawPrice;
                          const effectiveCost = trShares * effectiveUnitPrice;
                          const sym = formCurrency === 'USD' ? '$' : '₪';
                          let trCurPrice = parseFloat(formCurrentPrice);
                          if (formCurrency === 'ILS' && isPriceInAgorot) {
                            trCurPrice = trCurPrice / 100;
                          }
                          const hasCurPrice = !isNaN(trCurPrice) && trCurPrice > 0;
                          const trProfit = hasCurPrice ? trShares * (trCurPrice - effectiveUnitPrice) : 0;
                          const isProfit = trProfit >= 0;

                          return (
                            <>
                              <span>
                                {isHe ? 'עלות רכישה (קרן):' : 'Cost Basis:'}{' '}
                                <strong>
                                  {sym}
                                  {effectiveCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </strong>
                              </span>
                              {hasCurPrice && (
                                <span>
                                  {isHe ? 'רווח נוכחי לפעימה:' : 'Current Tranche Gain:'}{' '}
                                  <strong
                                    dir="ltr"
                                    style={{
                                      color: isProfit ? '#059669' : '#DC2626',
                                      direction: 'ltr',
                                      display: 'inline-block',
                                    }}
                                  >
                                    {isProfit
                                      ? `+${sym}${trProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                      : `-${sym}${Math.abs(trProfit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                  </strong>
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </>
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
                  {modalMode === 'new_asset' && (isHe ? 'צור נייר ערך ופעימה ראשונה' : 'Create Asset & First Tranche')}
                  {modalMode === 'edit_asset' && (isHe ? 'שמור פרטי נייר ערך' : 'Save Asset Changes')}
                  {modalMode === 'add_tranche' && (isHe ? 'הוסף פעימת רכישה' : 'Add Purchase Tranche')}
                  {modalMode === 'edit_tranche' && (isHe ? 'שמור שינויים בפעימה' : 'Save Tranche Changes')}
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
                <IsraeliDateInput
                  value={snapshotDate}
                  onChange={(displayVal) => setSnapshotDate(displayVal)}
                  placeholder="DD/MM/YYYY"
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
                  <strong dir="ltr" style={{ color: portfolioSummary.totalProfitILS >= 0 ? '#059669' : '#DC2626', direction: 'ltr', display: 'inline-block' }}>
                    {portfolioSummary.totalProfitILS >= 0
                      ? `+₪${portfolioSummary.totalProfitILS.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                      : `-₪${Math.abs(portfolioSummary.totalProfitILS).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}{' '}
                    ({portfolioSummary.totalReturnPct >= 0 ? '+' : '-'}{Math.abs(portfolioSummary.totalReturnPct).toFixed(2)}%)
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

      {/* MODAL: TRANCHES IMPORT FROM EXCEL / CSV */}
      {isImportModalOpen && (
        <TranchesImportModal
          key={`tranches-import-${importTargetAsset ? importTargetAsset.id : 'all'}-${Date.now()}`}
          isOpen={isImportModalOpen}
          onClose={() => {
            setIsImportModalOpen(false);
            setImportTargetAsset(null);
          }}
          investments={investments}
          defaultTargetAsset={importTargetAsset}
          onImportComplete={(updatedAssets, importedCount, skippedCount) => {
            saveInvestments(updatedAssets);
            setActionFeedbackMsg(
              isHe
                ? skippedCount && skippedCount > 0
                  ? `נקלטו בהצלחה ${importedCount} פעימות חדשות (דולגו ${skippedCount} פעימות כפולות שכבר היו קיימות בתיק).`
                  : `הצלחה! נקלטו ${importedCount} פעימות רכישה בהצלחה לתיק ההשקעות.`
                : skippedCount && skippedCount > 0
                  ? `Successfully imported ${importedCount} new tranches (${skippedCount} duplicates skipped).`
                  : `Successfully imported ${importedCount} purchase tranches into portfolio.`
            );
            setTimeout(() => setActionFeedbackMsg(null), 5000);
          }}
          isHe={isHe}
          usdRate={usdRate}
        />
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
  pillarsNavBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px',
    backgroundColor: 'var(--bg-surface-subtle, #F1F5F9)',
    borderRadius: '14px',
    border: '1px solid var(--border-subtle, #E2E8F0)',
    overflowX: 'auto',
    width: '100%',
  },
  pillarTabBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '9px 16px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary, #64748B)',
    fontSize: '0.875rem',
    fontWeight: '700',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s ease',
  },
  pillarTabBtnActiveOverview: {
    backgroundColor: '#0F172A',
    color: '#FFFFFF',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.25)',
  },
  pillarTabBtnActiveMeitav: {
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
  },
  pillarTabBtnActiveBank: {
    backgroundColor: '#059669',
    color: '#FFFFFF',
    boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)',
  },
  pillarTabBtnActiveDeposits: {
    backgroundColor: '#D97706',
    color: '#FFFFFF',
    boxShadow: '0 2px 8px rgba(217, 119, 6, 0.25)',
  },
  pillarTabBtnActivePension: {
    backgroundColor: '#DB2777',
    color: '#FFFFFF',
    boxShadow: '0 2px 8px rgba(219, 39, 119, 0.25)',
  },
  pillarCountBadge: {
    fontSize: '0.75rem',
    padding: '2px 7px',
    borderRadius: '10px',
    fontWeight: '800',
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
  importTranchesBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 16px',
    backgroundColor: '#F0F9FF',
    border: '1px solid #BAE6FD',
    borderRadius: '10px',
    color: '#0369A1',
    fontSize: '0.875rem',
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
    padding: '10px 8px',
    fontSize: '0.72rem',
    fontWeight: '700',
    color: 'var(--text-secondary, #64748B)',
    whiteSpace: 'normal',
    wordBreak: 'normal',
    lineHeight: '1.25',
    verticalAlign: 'bottom',
  },
  trRow: {
    borderBottom: '1px solid var(--border-main, #E2E8F0)',
    transition: 'background-color 0.15s ease',
  },
  tdCell: {
    padding: '11px 8px',
    fontSize: '0.8125rem',
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
  editAssetBtn: {
    padding: '5px',
    backgroundColor: '#EFF6FF',
    border: '1px solid #BFDBFE',
    cursor: 'pointer',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
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
    padding: '8px 8px 16px',
  },
  trancheSubContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    border: '1px solid #E2E8F0',
    padding: '12px 14px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    width: '100%',
    boxSizing: 'border-box',
  },
  trancheSubHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  trancheSubTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.84rem',
    fontWeight: '800',
    color: '#1E293B',
  },
  importTrancheSubBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    backgroundColor: '#F0F9FF',
    border: '1px solid #BAE6FD',
    borderRadius: '6px',
    color: '#0369A1',
    fontSize: '0.72rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  addTrancheSubBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    backgroundColor: '#EFF6FF',
    border: '1px solid #BFDBFE',
    borderRadius: '6px',
    color: '#2563EB',
    fontSize: '0.72rem',
    fontWeight: '700',
    cursor: 'pointer',
  },
  trancheTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.78125rem',
    tableLayout: 'auto',
  },
  trancheThRow: {
    backgroundColor: '#F1F5F9',
    borderBottom: '1px solid #CBD5E1',
  },
  trancheTh: {
    padding: '7px 5px',
    fontSize: '0.6875rem',
    fontWeight: '700',
    color: '#475569',
    textAlign: 'inherit',
    whiteSpace: 'normal',
    wordBreak: 'normal',
    lineHeight: '1.25',
    verticalAlign: 'bottom',
  },
  actionsStickyTh: {
    position: 'sticky',
    left: 0,
    backgroundColor: '#F1F5F9',
    zIndex: 3,
    boxShadow: '2px 0 6px rgba(0, 0, 0, 0.08)',
    minWidth: '75px',
    width: '75px',
    textAlign: 'center',
  },
  actionsStickyTd: {
    position: 'sticky',
    left: 0,
    backgroundColor: '#FFFFFF',
    zIndex: 2,
    boxShadow: '2px 0 6px rgba(0, 0, 0, 0.08)',
    minWidth: '75px',
    width: '75px',
    textAlign: 'center',
    padding: '7px 6px',
    verticalAlign: 'middle',
  },
  trancheTr: {
    borderBottom: '1px solid #F1F5F9',
  },
  trancheTd: {
    padding: '7px 5px',
    color: '#1E293B',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
  },
  trancheNotesTd: {
    padding: '7px 8px',
    color: '#1E293B',
    verticalAlign: 'middle',
    whiteSpace: 'normal',
    maxWidth: '240px',
    minWidth: '130px',
    wordBreak: 'break-word',
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
    fontSize: '0.73rem',
    color: '#64748B',
    fontStyle: 'italic',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    lineHeight: '1.3',
    wordBreak: 'break-word',
    cursor: 'help',
  },
  editTrancheBtn: {
    padding: '4px 6px',
    backgroundColor: '#EFF6FF',
    border: '1px solid #BFDBFE',
    cursor: 'pointer',
    borderRadius: '4px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#2563EB',
    transition: 'all 0.15s ease',
  },
  deleteTrancheBtn: {
    padding: '4px 6px',
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    cursor: 'pointer',
    borderRadius: '4px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#EF4444',
    transition: 'all 0.15s ease',
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
    alignItems: 'end',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    textAlign: 'inherit',
    justifyContent: 'flex-end',
  },
  formLabel: {
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: '#334155',
    whiteSpace: 'nowrap',
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
