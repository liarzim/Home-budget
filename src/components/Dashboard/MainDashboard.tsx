import React, { useState, useEffect } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  Sparkles,
  ShieldCheck,
  EyeOff,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../lib/i18n';
import {
  fetchMonthlyDashboardData,
  fetchYearlySavingsData,
  fetchAvailableMonths,
  MonthlyDashboardResult,
} from '../../lib/services/dashboardService';
import { SavingsYearlySummary, Transaction } from '../../lib/types';
import { DrillDownLedger } from './DrillDownLedger';
import { SavingsVisualizer } from './SavingsVisualizer';

const HEBREW_MONTHS_LIST = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

export const MainDashboard: React.FC = () => {
  const {
    activeHousehold,
    categories,
    transactions: contextTransactions,
    isDemoMode,
    language,
    toggleTransactionVisibility,
  } = useAuth();

  const [availableMonths, setAvailableMonths] = useState<string[]>(['2026-08', '2026-07']);
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-08');
  const [dashboardData, setDashboardData] = useState<MonthlyDashboardResult | null>(null);
  const [savingsData, setSavingsData] = useState<SavingsYearlySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const currencySymbol = activeHousehold?.currency === 'ILS' ? '₪' : activeHousehold?.currency || '$';

  // Discover available months on load or when context transactions change
  useEffect(() => {
    if (activeHousehold?.id) {
      fetchAvailableMonths(activeHousehold.id, isDemoMode).then((months) => {
        if (months.length > 0) {
          setAvailableMonths(months);
          if (!months.includes(selectedMonth)) {
            setSelectedMonth(months[0]);
          }
        }
      });
    }
  }, [activeHousehold?.id, contextTransactions.length, isDemoMode]);

  // Load monthly dashboard data & yearly savings
  useEffect(() => {
    if (!activeHousehold?.id || !selectedMonth) return;
    setIsLoading(true);

    const year = parseInt(selectedMonth.split('-')[0], 10);

    Promise.all([
      fetchMonthlyDashboardData(activeHousehold.id, selectedMonth, categories, isDemoMode),
      fetchYearlySavingsData(activeHousehold.id, year, isDemoMode),
    ])
      .then(([mResult, sResult]) => {
        setDashboardData(mResult);
        setSavingsData(sResult);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [activeHousehold?.id, selectedMonth, categories, contextTransactions, isDemoMode]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    const currentIndex = availableMonths.indexOf(selectedMonth);
    if (currentIndex < availableMonths.length - 1) {
      setSelectedMonth(availableMonths[currentIndex + 1]);
    } else {
      // Calculate previous calendar month
      const [y, m] = selectedMonth.split('-').map(Number);
      const prevDate = new Date(y, m - 2, 1);
      const prevStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      setSelectedMonth(prevStr);
    }
  };

  const handleNextMonth = () => {
    const currentIndex = availableMonths.indexOf(selectedMonth);
    if (currentIndex > 0) {
      setSelectedMonth(availableMonths[currentIndex - 1]);
    } else {
      // Calculate next calendar month
      const [y, m] = selectedMonth.split('-').map(Number);
      const nextDate = new Date(y, m, 1);
      const nextStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
      setSelectedMonth(nextStr);
    }
  };

  const formatMonthLabel = (mStr: string) => {
    try {
      const [y, m] = mStr.split('-').map(Number);
      if (language === 'he') {
        return `${HEBREW_MONTHS_LIST[m - 1] || m} ${y}`;
      }
      const date = new Date(y, m - 1, 1);
      return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    } catch {
      return mStr;
    }
  };

  // Transaction hide / update handlers from drill-down
  const handleToggleHide = (txId: string) => {
    toggleTransactionVisibility(txId);
  };

  const handleTransactionUpdated = (_updatedTx: Transaction) => {
    // Re-fetch dashboard data
    if (activeHousehold?.id && selectedMonth) {
      fetchMonthlyDashboardData(activeHousehold.id, selectedMonth, categories, isDemoMode).then(
        (mResult) => {
          setDashboardData(mResult);
        }
      );
    }
  };

  return (
    <div style={styles.container} className="animate-fade-in">
      {/* Month Navigation & Controls Bar */}
      <div style={styles.navBar}>
        <div style={styles.navLeft}>
          <Calendar size={18} color="var(--primary)" />
          <span style={styles.navTitle}>
            {language === 'he' ? 'חודש נבחר:' : 'Statement Period:'}
          </span>

          <div style={styles.monthSwitcherWrap}>
            <button
              style={styles.monthNavBtn}
              onClick={handlePrevMonth}
              title={t('monthNavigatorPrev', language)}
            >
              <ChevronRight size={16} color="var(--text-secondary)" />
            </button>

            <select
              style={styles.monthSelect}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>

            <button
              style={styles.monthNavBtn}
              onClick={handleNextMonth}
              title={t('monthNavigatorNext', language)}
            >
              <ChevronLeft size={16} color="var(--text-secondary)" />
            </button>
          </div>
        </div>

        <div style={styles.exclusionNoticePill}>
          <EyeOff size={13} color="var(--text-muted)" />
          <span>
            {language === 'he'
              ? 'שורות מוסתרות (is_hidden) אינן נכללות בחישובים'
              : "Soft-deleted ('is_hidden') rows excluded"}
          </span>
        </div>
      </div>

      {/* Primary KPI Summary Cards */}
      {dashboardData && (
        <div style={styles.kpiGrid}>
          {/* Total Income Card */}
          <div style={styles.kpiCard}>
            <div style={styles.kpiCardTop}>
              <span style={styles.kpiCardLabel}>{t('kpiTotalIncome', language)}</span>
              <div style={{ ...styles.kpiIconWrap, backgroundColor: 'var(--success-light)' }}>
                <TrendingUp size={18} color="var(--success-text)" />
              </div>
            </div>
            <div style={{ ...styles.kpiCardValue, color: 'var(--success-text)' }}>
              +{currencySymbol}{' '}
              {dashboardData.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div style={styles.kpiCardSub}>
              {language === 'he' ? 'משכורות, קצבאות והכנסות נוספות' : 'Salary & side income sources'}
            </div>
          </div>

          {/* Total Expenses Card */}
          <div style={styles.kpiCard}>
            <div style={styles.kpiCardTop}>
              <span style={styles.kpiCardLabel}>{t('kpiTotalExpenses', language)}</span>
              <div style={{ ...styles.kpiIconWrap, backgroundColor: 'var(--danger-light)' }}>
                <TrendingDown size={18} color="var(--danger)" />
              </div>
            </div>
            <div style={{ ...styles.kpiCardValue, color: 'var(--text-primary)' }}>
              -{currencySymbol}{' '}
              {dashboardData.totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div style={styles.kpiCardSub}>
              {language === 'he' ? 'הוצאות קבועות ומשתנות' : 'Fixed & living expense buckets'}
            </div>
          </div>

          {/* Net Cash Flow Card */}
          <div style={styles.kpiCard}>
            <div style={styles.kpiCardTop}>
              <span style={styles.kpiCardLabel}>{t('kpiNetSavings', language)}</span>
              <div
                style={{
                  ...styles.kpiIconWrap,
                  backgroundColor: dashboardData.netCashFlow >= 0 ? 'var(--success-light)' : 'var(--danger-light)',
                }}
              >
                <DollarSign
                  size={18}
                  color={dashboardData.netCashFlow >= 0 ? 'var(--success-text)' : 'var(--danger)'}
                />
              </div>
            </div>
            <div
              style={{
                ...styles.kpiCardValue,
                color: dashboardData.netCashFlow >= 0 ? 'var(--success-text)' : 'var(--danger)',
              }}
            >
              {dashboardData.netCashFlow >= 0 ? '+' : '-'} {currencySymbol}{' '}
              {Math.abs(dashboardData.netCashFlow).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div style={styles.kpiCardSub}>
              {dashboardData.netCashFlow >= 0
                ? (language === 'he' ? 'עודף חודשי זמין לחיסכון' : 'Monthly surplus available to save')
                : (language === 'he' ? 'גירעון תקציבי חודשי' : 'Monthly budget deficit')}
            </div>
          </div>

          {/* Savings Rate Card */}
          <div style={styles.kpiCard}>
            <div style={styles.kpiCardTop}>
              <span style={styles.kpiCardLabel}>{t('kpiSavingsRate', language)}</span>
              <div style={{ ...styles.kpiIconWrap, backgroundColor: 'var(--primary-light)' }}>
                <PieChart size={18} color="var(--primary)" />
              </div>
            </div>
            <div style={{ ...styles.kpiCardValue, color: 'var(--primary)' }}>
              {dashboardData.savingsRate.toFixed(1)}%
            </div>
            <div style={styles.kpiCardSub}>
              {language === 'he' ? 'אחוז הכנסה נטו שנחסך' : 'Percentage of net income saved'}
            </div>
          </div>
        </div>
      )}

      {/* Main Two-Column Dashboard Content */}
      <div style={styles.mainLayoutGrid}>
        {/* Left / Main Column: Multi-Level Drill-Down Ledger */}
        <div style={styles.drillDownColumn}>
          {dashboardData && (
            <DrillDownLedger
              macroGroups={dashboardData.macroGroups}
              categories={categories}
              currencySymbol={currencySymbol}
              isDemoMode={isDemoMode}
              onToggleHideTransaction={handleToggleHide}
              onTransactionUpdated={handleTransactionUpdated}
            />
          )}
        </div>

        {/* Right Column: Savings Status & Asset Distribution Pie Chart */}
        <div style={styles.savingsColumn}>
          {savingsData && (
            <SavingsVisualizer
              summary={savingsData}
              currencySymbol={currencySymbol}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  navBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    padding: '14px 20px',
    boxShadow: 'var(--shadow-sm)',
    flexWrap: 'wrap',
    gap: '12px',
  },
  navLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  navTitle: {
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  monthSwitcherWrap: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'var(--bg-surface-subtle)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-main)',
    padding: '2px',
  },
  monthNavBtn: {
    background: 'none',
    border: 'none',
    padding: '6px 8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  monthSelect: {
    background: 'transparent',
    border: 'none',
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    padding: '4px 8px',
    cursor: 'pointer',
    outline: 'none',
  },
  exclusionNoticePill: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    backgroundColor: 'var(--bg-surface-subtle)',
    padding: '4px 10px',
    borderRadius: '12px',
    border: '1px solid var(--border-subtle)',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  kpiCard: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    padding: '20px',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
  },
  kpiCardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
  },
  kpiCardLabel: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
  },
  kpiIconWrap: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiCardValue: {
    fontSize: '1.375rem',
    fontWeight: '800',
    letterSpacing: '-0.02em',
  },
  kpiCardSub: {
    fontSize: '0.6875rem',
    color: 'var(--text-muted)',
    marginTop: '4px',
  },
  mainLayoutGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: '24px',
    alignItems: 'start',
  },
  drillDownColumn: {
    flex: 1.6,
    minWidth: '340px',
  },
  savingsColumn: {
    flex: 1,
    minWidth: '320px',
  },
};
