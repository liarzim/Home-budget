import React from 'react';
import { useAuth } from '../context/AuthContext';
import { TrendingUp, TrendingDown, Wallet, Target } from 'lucide-react';

export const KPICards: React.FC = () => {
  const { transactions, budgets, activeHousehold } = useAuth();
  const currency = activeHousehold?.currency === 'ILS' ? '₪' : activeHousehold?.currency || '$';

  // Only aggregate active (non-hidden) transactions
  const activeTxs = transactions.filter((t) => !t.is_hidden);

  const totalIncome = activeTxs
    .filter((t) => t.transaction_type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = activeTxs
    .filter((t) => t.transaction_type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? ((netSavings / totalIncome) * 100).toFixed(0) : '0';

  const totalBudgetLimit = budgets
    .filter((b) => b.period_type === 'monthly')
    .reduce((sum, b) => sum + b.limit_amount, 0);

  const budgetUsagePercent = totalBudgetLimit > 0
    ? Math.min(100, Math.round((totalExpense / totalBudgetLimit) * 100))
    : 0;

  return (
    <div style={styles.kpiContainer}>
      {/* Monthly Income */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.cardTitle}>Monthly Income</span>
          <div style={{ ...styles.iconWrap, backgroundColor: 'var(--success-light)' }}>
            <TrendingUp size={16} color="var(--success)" />
          </div>
        </div>
        <div style={{ ...styles.cardValue, color: 'var(--success-text)' }}>
          {currency} {totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        <div style={styles.cardSubtext}>Active income transactions</div>
      </div>

      {/* Total Expenses */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.cardTitle}>Total Expenses</span>
          <div style={{ ...styles.iconWrap, backgroundColor: 'var(--danger-light)' }}>
            <TrendingDown size={16} color="var(--danger)" />
          </div>
        </div>
        <div style={{ ...styles.cardValue, color: 'var(--text-primary)' }}>
          {currency} {totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        <div style={styles.cardSubtext}>Excluding soft-deleted entries</div>
      </div>

      {/* Net Cash Flow */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.cardTitle}>Net Cash Flow</span>
          <div style={{ ...styles.iconWrap, backgroundColor: 'var(--primary-light)' }}>
            <Wallet size={16} color="var(--primary)" />
          </div>
        </div>
        <div
          style={{
            ...styles.cardValue,
            color: netSavings >= 0 ? 'var(--success-text)' : 'var(--danger-text)',
          }}
        >
          {currency} {netSavings.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        <div style={styles.cardSubtext}>{savingsRate}% savings rate</div>
      </div>

      {/* Budget Health */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <span style={styles.cardTitle}>Budget Health</span>
          <div style={{ ...styles.iconWrap, backgroundColor: 'var(--warning-light)' }}>
            <Target size={16} color="var(--warning)" />
          </div>
        </div>
        <div style={styles.cardValue}>{budgetUsagePercent}%</div>
        <div style={styles.progressBarBg}>
          <div
            style={{
              ...styles.progressBarFill,
              width: `${budgetUsagePercent}%`,
              backgroundColor:
                budgetUsagePercent > 90
                  ? 'var(--danger)'
                  : budgetUsagePercent > 70
                  ? 'var(--warning)'
                  : 'var(--success)',
            }}
          />
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  kpiContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  card: {
    backgroundColor: 'var(--bg-surface)',
    padding: '20px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
  },
  cardTitle: {
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  iconWrap: {
    width: '30px',
    height: '30px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardValue: {
    fontSize: '1.5rem',
    fontWeight: '800',
    letterSpacing: '-0.02em',
    marginBottom: '4px',
  },
  cardSubtext: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  progressBarBg: {
    height: '6px',
    backgroundColor: 'var(--bg-surface-subtle)',
    borderRadius: '3px',
    marginTop: '8px',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
};
