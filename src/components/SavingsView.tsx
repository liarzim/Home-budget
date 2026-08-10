import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PiggyBank, TrendingUp, Building } from 'lucide-react';

export const SavingsView: React.FC = () => {
  const { savings, activeHousehold } = useAuth();
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  const currency = activeHousehold?.currency === 'ILS' ? '₪' : activeHousehold?.currency || '$';

  const years = Array.from(new Set(savings.map((s) => s.year))).sort((a, b) => b - a);
  if (years.length === 0) years.push(2026);

  const yearSavings = savings.filter((s) => s.year === selectedYear);

  const totalOpening = yearSavings.reduce((sum, s) => sum + s.opening_balance, 0);
  const totalClosing = yearSavings.reduce((sum, s) => sum + s.closing_balance, 0);
  const totalNetGrowth = totalClosing - totalOpening;
  const growthRate = totalOpening > 0 ? ((totalNetGrowth / totalOpening) * 100).toFixed(1) : '0';

  return (
    <div style={styles.container}>
      {/* Header & Year Selector */}
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.title}>Savings & Annual Balance Ledger</h2>
          <p style={styles.subtitle}>
            Opening and closing balances per calendar year across institutions.
          </p>
        </div>

        <div style={styles.yearPickerRow}>
          {years.map((yr) => (
            <button
              key={yr}
              style={{
                ...styles.yearBtn,
                ...(selectedYear === yr ? styles.yearBtnActive : {}),
              }}
              onClick={() => setSelectedYear(yr)}
            >
              {yr}
            </button>
          ))}
        </div>
      </div>

      {/* Aggregate Annual Summary */}
      <div style={styles.summaryCard}>
        <div style={styles.statColumn}>
          <span style={styles.statLabel}>Jan 1 Opening Balance</span>
          <span style={styles.statValue}>{currency} {totalOpening.toLocaleString('en-US')}</span>
        </div>

        <div style={styles.statDivider} />

        <div style={styles.statColumn}>
          <span style={styles.statLabel}>Dec 31 Closing Balance</span>
          <span style={{ ...styles.statValue, color: 'var(--primary)' }}>
            {currency} {totalClosing.toLocaleString('en-US')}
          </span>
        </div>

        <div style={styles.statDivider} />

        <div style={styles.statColumn}>
          <span style={styles.statLabel}>Annual Net Growth</span>
          <div style={styles.growthBadgeRow}>
            <TrendingUp size={16} color="var(--success)" />
            <span style={{ ...styles.statValue, color: 'var(--success-text)' }}>
              +{currency} {totalNetGrowth.toLocaleString('en-US')} ({growthRate}%)
            </span>
          </div>
        </div>
      </div>

      {/* Account Breakdown Cards */}
      <div style={styles.accountsGrid}>
        {yearSavings.map((acc) => {
          const targetPercent = acc.target_amount
            ? Math.min(100, Math.round((acc.closing_balance / acc.target_amount) * 100))
            : null;

          return (
            <div key={acc.id} style={styles.accountCard}>
              <div style={styles.accTop}>
                <div style={styles.accIconBox}>
                  <PiggyBank size={18} color="var(--primary)" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={styles.accName}>{acc.account_name}</div>
                  {acc.institution && (
                    <div style={styles.institutionRow}>
                      <Building size={12} color="var(--text-secondary)" />
                      <span style={styles.institutionText}>{acc.institution}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Balance Comparisons */}
              <div style={styles.balanceRow}>
                <div>
                  <div style={styles.miniLabel}>Opening Balance</div>
                  <div style={styles.openingValue}>
                    {currency} {acc.opening_balance.toLocaleString('en-US')}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={styles.miniLabel}>Closing Balance</div>
                  <div style={styles.closingValue}>
                    {currency} {acc.closing_balance.toLocaleString('en-US')}
                  </div>
                </div>
              </div>

              {/* Target Goal */}
              {acc.target_amount && targetPercent !== null && (
                <div style={styles.targetSection}>
                  <div style={styles.targetHeader}>
                    <span style={styles.targetLabel}>
                      Target: {currency} {acc.target_amount.toLocaleString('en-US')}
                    </span>
                    <span style={styles.targetPercent}>{targetPercent}%</span>
                  </div>
                  <div style={styles.targetTrack}>
                    <div
                      style={{
                        ...styles.targetFill,
                        width: `${targetPercent}%`,
                        backgroundColor:
                          targetPercent >= 100 ? 'var(--success)' : 'var(--primary)',
                      }}
                    />
                  </div>
                </div>
              )}

              {acc.notes && <div style={styles.accNotes}>{acc.notes}</div>}
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
  yearPickerRow: {
    display: 'flex',
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-sm)',
    padding: '3px',
    border: '1px solid var(--border-main)',
  },
  yearBtn: {
    padding: '6px 14px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
  },
  yearBtnActive: {
    backgroundColor: 'var(--primary-light)',
    color: 'var(--primary)',
    fontWeight: '700',
  },
  summaryCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    padding: '20px',
    marginBottom: '24px',
    boxShadow: 'var(--shadow-sm)',
    flexWrap: 'wrap',
    gap: '16px',
  },
  statColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    marginBottom: '4px',
  },
  statValue: {
    fontSize: '1.125rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  growthBadgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  statDivider: {
    width: '1px',
    height: '32px',
    backgroundColor: 'var(--border-subtle)',
  },
  accountsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '16px',
  },
  accountCard: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    padding: '20px',
    boxShadow: 'var(--shadow-sm)',
  },
  accTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  accIconBox: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    backgroundColor: 'var(--primary-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accName: {
    fontSize: '0.9375rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  institutionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginTop: '2px',
  },
  institutionText: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  balanceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    backgroundColor: 'var(--bg-surface-subtle)',
    padding: '12px 14px',
    borderRadius: 'var(--radius-sm)',
    marginBottom: '14px',
  },
  miniLabel: {
    fontSize: '0.6875rem',
    color: 'var(--text-muted)',
    marginBottom: '2px',
  },
  openingValue: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  closingValue: {
    fontSize: '0.9375rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  targetSection: {
    marginBottom: '10px',
  },
  targetHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
    fontSize: '0.6875rem',
  },
  targetLabel: {
    color: 'var(--text-secondary)',
  },
  targetPercent: {
    fontWeight: '700',
    color: 'var(--primary)',
  },
  targetTrack: {
    height: '6px',
    backgroundColor: 'var(--bg-surface-subtle)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  targetFill: {
    height: '100%',
    borderRadius: '3px',
  },
  accNotes: {
    fontSize: '0.6875rem',
    color: 'var(--text-muted)',
    marginTop: '8px',
    fontStyle: 'italic',
  },
};
