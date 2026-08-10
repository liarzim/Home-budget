import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BudgetPeriod } from '../lib/types';
import { Calendar, AlertTriangle } from 'lucide-react';

export const BudgetsView: React.FC = () => {
  const { budgets, categories, transactions, activeHousehold } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<BudgetPeriod>('monthly');

  const currency = activeHousehold?.currency === 'ILS' ? '₪' : activeHousehold?.currency || '$';

  const currentBudgets = budgets.filter((b) => b.period_type === selectedPeriod);

  const getCategorySpend = (categoryId: string) => {
    return transactions
      .filter((t) => !t.is_hidden && t.category_id === categoryId && t.transaction_type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const totalLimit = currentBudgets.reduce((sum, b) => sum + b.limit_amount, 0);
  const totalSpend = currentBudgets.reduce(
    (sum, b) => sum + (b.spent_amount ?? getCategorySpend(b.category_id)),
    0
  );
  const totalRemaining = Math.max(0, totalLimit - totalSpend);
  const totalPercent = totalLimit > 0 ? Math.round((totalSpend / totalLimit) * 100) : 0;

  return (
    <div style={styles.container}>
      {/* Top Header & Period Switcher */}
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.title}>Category Budget Limits</h2>
          <p style={styles.subtitle}>
            Strict {selectedPeriod} limits per category with live expense tracking.
          </p>
        </div>

        <div style={styles.periodSwitcher}>
          <button
            style={{
              ...styles.periodBtn,
              ...(selectedPeriod === 'monthly' ? styles.periodBtnActive : {}),
            }}
            onClick={() => setSelectedPeriod('monthly')}
          >
            <Calendar size={13} color={selectedPeriod === 'monthly' ? 'var(--primary)' : 'var(--text-secondary)'} />
            <span>Monthly (Aug 2026)</span>
          </button>
          <button
            style={{
              ...styles.periodBtn,
              ...(selectedPeriod === 'yearly' ? styles.periodBtnActive : {}),
            }}
            onClick={() => setSelectedPeriod('yearly')}
          >
            <Calendar size={13} color={selectedPeriod === 'yearly' ? 'var(--primary)' : 'var(--text-secondary)'} />
            <span>Yearly (2026)</span>
          </button>
        </div>
      </div>

      {/* Aggregate Overview Bar */}
      <div style={styles.aggregateCard}>
        <div style={styles.aggStatColumn}>
          <span style={styles.aggLabel}>Total Budget</span>
          <span style={styles.aggValue}>{currency} {totalLimit.toLocaleString('en-US')}</span>
        </div>

        <div style={styles.aggDivider} />

        <div style={styles.aggStatColumn}>
          <span style={styles.aggLabel}>Total Spent</span>
          <span style={{ ...styles.aggValue, color: totalSpend > totalLimit ? 'var(--danger-text)' : 'var(--text-primary)' }}>
            {currency} {totalSpend.toLocaleString('en-US', { minimumFractionDigits: 1 })}
          </span>
        </div>

        <div style={styles.aggDivider} />

        <div style={styles.aggStatColumn}>
          <span style={styles.aggLabel}>Remaining Buffer</span>
          <span style={{ ...styles.aggValue, color: 'var(--success-text)' }}>
            {currency} {totalRemaining.toLocaleString('en-US', { minimumFractionDigits: 1 })}
          </span>
        </div>

        <div style={styles.aggDivider} />

        <div style={styles.aggStatColumn}>
          <span style={styles.aggLabel}>Total Consumed</span>
          <span style={styles.aggValue}>{totalPercent}%</span>
        </div>
      </div>

      {/* Categories Budget Grid */}
      <div style={styles.budgetsGrid}>
        {currentBudgets.map((budget) => {
          const category = categories.find((c) => c.id === budget.category_id);
          const spent = budget.spent_amount ?? getCategorySpend(budget.category_id);
          const percent = Math.min(100, Math.round((spent / budget.limit_amount) * 100));
          const isOverBudget = spent > budget.limit_amount;
          const remaining = budget.limit_amount - spent;

          let statusColor = 'var(--success)';
          if (percent > 90 || isOverBudget) statusColor = 'var(--danger)';
          else if (percent > 70) statusColor = 'var(--warning)';

          return (
            <div key={budget.id} style={styles.budgetCard}>
              <div style={styles.cardTop}>
                <div style={styles.categoryInfo}>
                  <div
                    style={{
                      ...styles.categoryDot,
                      backgroundColor: category?.color || 'var(--primary)',
                    }}
                  />
                  <span style={styles.categoryName}>{category?.name || 'Category'}</span>
                </div>

                {isOverBudget ? (
                  <div style={styles.alertBadge}>
                    <AlertTriangle size={12} color="var(--danger)" />
                    <span>Over Budget</span>
                  </div>
                ) : (
                  <span style={styles.percentText}>{percent}%</span>
                )}
              </div>

              {/* Progress Bar */}
              <div style={styles.progressTrack}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${percent}%`,
                    backgroundColor: statusColor,
                  }}
                />
              </div>

              {/* Numerical breakdown */}
              <div style={styles.numbersRow}>
                <span style={styles.spentText}>
                  Spent: <strong>{currency} {spent.toLocaleString('en-US')}</strong>
                </span>
                <span style={styles.limitText}>
                  Limit: {currency} {budget.limit_amount.toLocaleString('en-US')}
                </span>
              </div>

              <div style={styles.cardFooter}>
                <span style={styles.remainingText}>
                  {isOverBudget
                    ? `Exceeded by ${currency} ${Math.abs(remaining).toLocaleString('en-US')}`
                    : `Remaining: ${currency} ${remaining.toLocaleString('en-US')}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  periodSwitcher: {
    display: 'flex',
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-sm)',
    padding: '3px',
    border: '1px solid var(--border-main)',
  },
  periodBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.75rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
  },
  periodBtnActive: {
    backgroundColor: 'var(--primary-light)',
    color: 'var(--primary)',
    fontWeight: '700',
  },
  aggregateCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    padding: '18px 20px',
    marginBottom: '24px',
    boxShadow: 'var(--shadow-sm)',
    flexWrap: 'wrap',
    gap: '16px',
  },
  aggStatColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  aggLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    marginBottom: '4px',
  },
  aggValue: {
    fontSize: '1.125rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  aggDivider: {
    width: '1px',
    height: '32px',
    backgroundColor: 'var(--border-subtle)',
  },
  budgetsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '16px',
  },
  budgetCard: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    padding: '18px',
    boxShadow: 'var(--shadow-sm)',
  },
  cardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  categoryInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  categoryDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  categoryName: {
    fontSize: '0.875rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  percentText: {
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
  },
  alertBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 6px',
    backgroundColor: 'var(--danger-light)',
    borderRadius: '4px',
    fontSize: '0.6875rem',
    fontWeight: '700',
    color: 'var(--danger-text)',
  },
  progressTrack: {
    height: '8px',
    backgroundColor: 'var(--bg-surface-subtle)',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '10px',
  },
  progressFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  numbersRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
    fontSize: '0.75rem',
  },
  spentText: {
    color: 'var(--text-secondary)',
  },
  limitText: {
    color: 'var(--text-muted)',
  },
  cardFooter: {
    borderTop: '1px solid var(--border-subtle)',
    paddingTop: '8px',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  remainingText: {},
};
