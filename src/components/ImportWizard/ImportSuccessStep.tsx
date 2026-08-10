import React from 'react';
import {
  CheckCircle2,
  PieChart,
  ArrowRight,
  RefreshCw,
  Sparkles,
  EyeOff,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { ImportBatchSummary } from '../../lib/types';

interface ImportSuccessStepProps {
  summary: ImportBatchSummary;
  currencySymbol: string;
  onViewLedger: () => void;
  onViewBudgets: () => void;
  onImportAnother: () => void;
}

export const ImportSuccessStep: React.FC<ImportSuccessStepProps> = ({
  summary,
  currencySymbol,
  onViewLedger,
  onViewBudgets,
  onImportAnother,
}) => {
  const activeCount = summary.validRows - summary.hiddenRowsCount;

  return (
    <div style={styles.container} className="animate-fade-in">
      <div style={styles.successIconCircle}>
        <CheckCircle2 size={44} color="var(--success)" />
      </div>

      <h2 style={styles.title}>Database Insertion Successful!</h2>
      <p style={styles.subtitle}>
        <strong>{summary.validRows}</strong> transactions have been securely inserted into your Supabase database and ledger.
      </p>

      {/* Summary KPI Cards Grid */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>Inserted Records</span>
          <span style={styles.statValue}>{summary.validRows}</span>
          <span style={styles.statSub}>
            {activeCount} active • {summary.hiddenRowsCount} hidden
          </span>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Auto-Categorized</span>
          <div style={styles.sparkleRow}>
            <Sparkles size={16} color="var(--primary)" />
            <span style={{ ...styles.statValue, color: 'var(--primary)' }}>
              {summary.autoCategorizedCount}
            </span>
          </div>
          <span style={styles.statSub}>Matched business rules</span>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Active Expenses</span>
          <div style={styles.sparkleRow}>
            <TrendingDown size={16} color="var(--danger)" />
            <span style={{ ...styles.statValue, color: 'var(--text-primary)' }}>
              {currencySymbol} {summary.totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <span style={styles.statSub}>Excludes hidden entries</span>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>Active Income</span>
          <div style={styles.sparkleRow}>
            <TrendingUp size={16} color="var(--success)" />
            <span style={{ ...styles.statValue, color: 'var(--success-text)' }}>
              {currencySymbol} {summary.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <span style={styles.statSub}>Added to cash flow</span>
        </div>
      </div>

      {/* Action Navigation Buttons */}
      <div style={styles.actionsRow}>
        <button style={styles.secondaryBtn} onClick={onImportAnother}>
          <RefreshCw size={15} color="var(--text-secondary)" />
          <span>Import Another Statement</span>
        </button>

        <button style={styles.secondaryBtn} onClick={onViewBudgets}>
          <PieChart size={15} color="var(--primary)" />
          <span>Check Category Budgets</span>
        </button>

        <button style={styles.primaryBtn} onClick={onViewLedger}>
          <span>View Ledger</span>
          <ArrowRight size={16} color="#FFFFFF" />
        </button>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    padding: '48px 24px',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  successIconCircle: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: 'var(--success-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
    marginBottom: '6px',
  },
  subtitle: {
    fontSize: '0.9375rem',
    color: 'var(--text-secondary)',
    maxWidth: '540px',
    lineHeight: '1.5',
    marginBottom: '32px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    width: '100%',
    maxWidth: '780px',
    marginBottom: '36px',
  },
  statCard: {
    backgroundColor: 'var(--bg-surface-subtle)',
    padding: '18px 16px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-main)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    marginBottom: '6px',
  },
  statValue: {
    fontSize: '1.25rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  statSub: {
    fontSize: '0.6875rem',
    color: 'var(--text-muted)',
    marginTop: '4px',
  },
  sparkleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  actionsRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  secondaryBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 18px',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 22px',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    boxShadow: 'var(--shadow-sm)',
  },
};
