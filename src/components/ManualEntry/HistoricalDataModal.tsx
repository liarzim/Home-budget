import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Database,
} from 'lucide-react';
import { Category, HistoricalYearlySheetData, HistoricalImportResult } from '../../lib/types';
import { ingestHistoricalYearlySummary } from '../../lib/services/historicalIngestionService';

interface HistoricalDataModalProps {
  householdId: string;
  categories: Category[];
  isDemoMode: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const HistoricalDataModal: React.FC<HistoricalDataModalProps> = ({
  householdId,
  categories,
  isDemoMode,
  onClose,
  onSuccess,
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<HistoricalImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sample Aggregated Yearly Matrix Data (derived from 'סיכום הכנסות הוצאות - 2026 .xlsx')
  const sampleYearlyData: HistoricalYearlySheetData = {
    year: selectedYear,
    title: `סיכום הכנסות והוצאות - שנת ${selectedYear}`,
    expenseRows: [
      {
        categoryName: 'שכירות ודיור',
        categoryType: 'expense',
        monthlyAmounts: { 1: 6800, 2: 6800, 3: 6800, 4: 6800, 5: 6800, 6: 6800, 7: 6800, 8: 6800 },
      },
      {
        categoryName: 'ארנונה ומים',
        categoryType: 'expense',
        monthlyAmounts: { 1: 850, 2: 850, 3: 850, 4: 850, 5: 850, 6: 850, 7: 850, 8: 850 },
      },
      {
        categoryName: 'חשמל וגז',
        categoryType: 'expense',
        monthlyAmounts: { 1: 620, 2: 710, 3: 540, 4: 490, 5: 580, 6: 650, 7: 740, 8: 690 },
      },
      {
        categoryName: 'מזון וסופרמרקט',
        categoryType: 'expense',
        monthlyAmounts: { 1: 3400, 2: 3250, 3: 3800, 4: 4100, 5: 3550, 6: 3600, 7: 3900, 8: 3750 },
      },
      {
        categoryName: 'דלק ותחבורה',
        categoryType: 'expense',
        monthlyAmounts: { 1: 1100, 2: 1050, 3: 1200, 4: 1150, 5: 1300, 6: 1250, 7: 1400, 8: 1200 },
      },
      {
        categoryName: 'ביטוחים ובריאות',
        categoryType: 'expense',
        monthlyAmounts: { 1: 950, 2: 950, 3: 950, 4: 950, 5: 950, 6: 950, 7: 950, 8: 950 },
      },
      {
        categoryName: 'מסעדות ובילויים',
        categoryType: 'expense',
        monthlyAmounts: { 1: 1400, 2: 1200, 3: 1600, 4: 1900, 5: 1500, 6: 1750, 7: 2100, 8: 1800 },
      },
    ],
    incomeRows: [
      {
        categoryName: 'משכורת חודשית עיקרית',
        categoryType: 'income',
        monthlyAmounts: { 1: 24500, 2: 24500, 3: 24500, 4: 24500, 5: 24500, 6: 24500, 7: 24500, 8: 24500 },
      },
      {
        categoryName: 'הכנסה מפרילנס / ייעוץ',
        categoryType: 'income',
        monthlyAmounts: { 1: 3200, 2: 2800, 3: 4500, 4: 3100, 5: 3500, 6: 4200, 7: 3800, 8: 4000 },
      },
    ],
    savingsRows: [
      {
        accountName: 'מיטב דש - קופת גמל להשקעה',
        institution: 'Meitav Dash',
        openingBalance: 98000,
        closingBalance: 112000,
      },
      {
        accountName: 'פקדון בנקאי נזיל',
        institution: 'Bank Hapoalim',
        openingBalance: 55000,
        closingBalance: 65000,
      },
      {
        accountName: 'תיק מניות ומדד S&P 500',
        institution: 'Capital Market (IBKR)',
        openingBalance: 78000,
        closingBalance: 95000,
      },
      {
        accountName: 'קרן השתלמות הראל',
        institution: 'Harel Insurance',
        openingBalance: 42000,
        closingBalance: 54000,
      },
    ],
  };

  const handleRunIngestion = async () => {
    setErrorMsg(null);
    setIsProcessing(true);

    try {
      const res = await ingestHistoricalYearlySummary(
        householdId,
        sampleYearlyData,
        categories,
        isDemoMode
      );

      if (!res.success) {
        throw new Error(res.error || 'Ingestion failed');
      }

      setResult(res);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to ingest historical data');
    } finally {
      setIsProcessing(false);
    }
  };

  const totalMonthlyPoints =
    sampleYearlyData.expenseRows.length * 8 + sampleYearlyData.incomeRows.length * 8;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal} className="animate-fade-in">
        <div style={styles.header}>
          <div style={styles.headerTitleWrap}>
            <FileSpreadsheet size={20} color="var(--primary)" />
            <div>
              <h3 style={styles.title}>Historical Aggregated Data Ingestion</h3>
              <span style={styles.subtitle}>
                Transform yearly summary spreadsheets into canonical ledger transactions
              </span>
            </div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>
            <X size={18} color="var(--text-secondary)" />
          </button>
        </div>

        <div style={styles.body}>
          {/* Overview Info Card */}
          <div style={styles.infoCard}>
            <div style={styles.infoTop}>
              <Sparkles size={16} color="var(--primary)" />
              <span style={styles.infoTitle}>Template Engine Structure</span>
            </div>
            <p style={styles.infoDesc}>
              This utility reads monthly summary sheets (e.g. <code>סיכום הכנסות הוצאות - {selectedYear}.xlsx</code>) where categories span horizontal monthly columns. It synthesizes normalized 1st-of-month canonical transactions and initializes yearly savings records.
            </p>
          </div>

          {/* Aggregated Summary Matrix Preview */}
          <div style={styles.previewCard}>
            <div style={styles.previewHeader}>
              <span style={styles.previewTitle}>Detected Matrix Data ({selectedYear}):</span>
              <span style={styles.countBadge}>{totalMonthlyPoints} Monthly Entries</span>
            </div>

            <div style={styles.matrixSummaryList}>
              <div style={styles.summaryRow}>
                <span>Expense Categories (7 categories across 8 months):</span>
                <strong>56 Transactions</strong>
              </div>
              <div style={styles.summaryRow}>
                <span>Income Categories (2 categories across 8 months):</span>
                <strong>16 Transactions</strong>
              </div>
              <div style={styles.summaryRow}>
                <span>Savings & Investment Baselines:</span>
                <strong>4 Portfolio Accounts</strong>
              </div>
            </div>
          </div>

          {/* Result Alert */}
          {result && (
            <div style={styles.successBanner} className="animate-fade-in">
              <CheckCircle2 size={18} color="var(--success-text)" />
              <div>
                <strong>Ingestion Succeeded!</strong>
                <div style={styles.successSub}>
                  Generated {result.transactionsGenerated} transactions and {result.savingsGenerated} savings accounts in Supabase.
                </div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div style={styles.errorBanner}>
              <AlertCircle size={16} color="var(--danger-text)" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onClose}>
            Close
          </button>

          {!result && (
            <button
              style={styles.runBtn}
              onClick={handleRunIngestion}
              disabled={isProcessing}
            >
              <Database size={15} color="#FFFFFF" />
              <span>{isProcessing ? 'Processing Matrix Ingestion...' : `Ingest ${selectedYear} Aggregated Summary`}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modal: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    width: '100%',
    maxWidth: '560px',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border-main)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 24px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  headerTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  title: {
    fontSize: '1.0625rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  subtitle: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  body: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  infoCard: {
    backgroundColor: 'var(--primary-light)',
    border: '1px solid var(--primary)',
    borderRadius: 'var(--radius-md)',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  infoTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  infoTitle: {
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: 'var(--primary)',
  },
  infoDesc: {
    fontSize: '0.75rem',
    color: 'var(--text-primary)',
    lineHeight: '1.5',
  },
  previewCard: {
    backgroundColor: 'var(--bg-surface-subtle)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-main)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  previewHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewTitle: {
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  countBadge: {
    fontSize: '0.6875rem',
    fontWeight: '700',
    color: 'var(--primary)',
    backgroundColor: 'var(--primary-light)',
    padding: '2px 8px',
    borderRadius: '12px',
  },
  matrixSummaryList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontSize: '0.75rem',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    color: 'var(--text-secondary)',
    borderBottom: '1px solid var(--border-subtle)',
    paddingBottom: '4px',
  },
  successBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 18px',
    backgroundColor: 'var(--success-light)',
    border: '1px solid #A7F3D0',
    borderRadius: 'var(--radius-md)',
    color: 'var(--success-text)',
    fontSize: '0.8125rem',
  },
  successSub: {
    fontSize: '0.75rem',
    marginTop: '2px',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: 'var(--danger-light)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--danger-text)',
    fontSize: '0.8125rem',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '10px',
    padding: '16px 24px',
    borderTop: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--bg-surface-subtle)',
  },
  cancelBtn: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-main)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  runBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '9px 18px',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    boxShadow: 'var(--shadow-sm)',
  },
};
