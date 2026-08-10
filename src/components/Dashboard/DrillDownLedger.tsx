import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Lock,
  ShoppingBag,
  Briefcase,
  Gift,
  CreditCard,
  Edit3,
  EyeOff,
  Sparkles,
  TrendingDown,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { MacroGroup, CategoryDrillDown, Transaction, Category } from '../../lib/types';
import { EditTransactionModal } from './EditTransactionModal';

interface DrillDownLedgerProps {
  macroGroups: MacroGroup[];
  categories: Category[];
  currencySymbol: string;
  isDemoMode: boolean;
  onToggleHideTransaction: (txId: string) => void;
  onTransactionUpdated: (updatedTx: Transaction) => void;
}

export const DrillDownLedger: React.FC<DrillDownLedgerProps> = ({
  macroGroups,
  categories,
  currencySymbol,
  isDemoMode,
  onToggleHideTransaction,
  onTransactionUpdated,
}) => {
  // State for expanded Level 1 (Macro Groups)
  const [expandedMacroIds, setExpandedMacroIds] = useState<Record<string, boolean>>({
    fixed_expenses: true,
    variable_expenses: true,
    income_salary: true,
    income_other: false,
  });

  // State for expanded Level 2 (Categories)
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Record<string, boolean>>({});

  // Editing transaction state for Level 3 modal
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const toggleMacro = (id: string) => {
    setExpandedMacroIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleCategory = (id: string) => {
    setExpandedCategoryIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Helper for macro group icons
  const getMacroIcon = (iconName: string, color: string) => {
    switch (iconName) {
      case 'Lock':
        return <Lock size={18} color={color} />;
      case 'ShoppingBag':
        return <ShoppingBag size={18} color={color} />;
      case 'Briefcase':
        return <Briefcase size={18} color={color} />;
      case 'Gift':
        return <Gift size={18} color={color} />;
      default:
        return <ShoppingBag size={18} color={color} />;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.sectionHeader}>
        <div>
          <h3 style={styles.sectionTitle}>Interactive Financial Drill-Down</h3>
          <p style={styles.sectionSubtitle}>
            Level 1: Macro Buckets → Level 2: Category Budgets → Level 3: Individual Transactions
          </p>
        </div>
      </div>

      <div style={styles.macroList}>
        {macroGroups.map((group) => {
          const isExpanded = Boolean(expandedMacroIds[group.id]);
          const isExpense = group.type === 'expense';
          const iconColor = isExpense
            ? group.id === 'fixed_expenses'
              ? 'var(--primary)'
              : '#F59E0B'
            : 'var(--success)';

          return (
            <div key={group.id} style={styles.macroCard} className="animate-fade-in">
              {/* =======================================================
                  LEVEL 1: MACRO GROUP HEADER
                  ======================================================= */}
              <div
                style={{
                  ...styles.macroHeader,
                  backgroundColor: isExpanded ? 'var(--bg-surface-subtle)' : 'var(--bg-surface)',
                }}
                onClick={() => toggleMacro(group.id)}
              >
                <div style={styles.macroLeft}>
                  <button style={styles.chevronBtn}>
                    {isExpanded ? (
                      <ChevronDown size={18} color="var(--text-secondary)" />
                    ) : (
                      <ChevronRight size={18} color="var(--text-secondary)" />
                    )}
                  </button>

                  <div style={{ ...styles.macroIconWrap, backgroundColor: `${iconColor}15` }}>
                    {getMacroIcon(group.icon, iconColor)}
                  </div>

                  <div>
                    <div style={styles.macroNameRow}>
                      <span style={styles.macroTitle}>{group.name}</span>
                      <span style={styles.macroHebrew}>({group.hebrewName})</span>
                    </div>
                    <div style={styles.macroSub}>
                      {group.categories.length} Categories •{' '}
                      {group.categories.reduce((s, c) => s + c.transactions.length, 0)} Active Transactions
                    </div>
                  </div>
                </div>

                <div style={styles.macroRight}>
                  <div style={styles.macroAmountLabel}>Total {isExpense ? 'Spent' : 'Received'}</div>
                  <div
                    style={{
                      ...styles.macroAmountValue,
                      color: isExpense ? 'var(--text-primary)' : 'var(--success-text)',
                    }}
                  >
                    {isExpense ? '-' : '+'} {currencySymbol}{' '}
                    {group.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  {group.totalBudget > 0 && (
                    <div style={styles.macroBudgetSub}>
                      Budget Target: {currencySymbol} {group.totalBudget.toLocaleString('en-US')}
                    </div>
                  )}
                </div>
              </div>

              {/* =======================================================
                  LEVEL 2: CATEGORIES LIST
                  ======================================================= */}
              {isExpanded && (
                <div style={styles.categoriesContainer}>
                  {group.categories.length === 0 ? (
                    <div style={styles.emptyCategories}>No transactions in this bucket for this month.</div>
                  ) : (
                    group.categories.map((drill) => {
                      const isCatExpanded = Boolean(expandedCategoryIds[drill.category.id]);
                      const isOverBudget =
                        drill.budgetAmount > 0 && drill.actualAmount > drill.budgetAmount;
                      const progressPct = Math.min(100, Math.round(drill.percentageOfBudget));

                      return (
                        <div key={drill.category.id} style={styles.categoryItem}>
                          {/* Category Header Row */}
                          <div
                            style={{
                              ...styles.categoryHeader,
                              ...(isCatExpanded ? styles.categoryHeaderExpanded : {}),
                            }}
                            onClick={() => toggleCategory(drill.category.id)}
                          >
                            <div style={styles.categoryLeft}>
                              <button style={styles.catChevronBtn}>
                                {isCatExpanded ? (
                                  <ChevronDown size={15} color="var(--text-secondary)" />
                                ) : (
                                  <ChevronRight size={15} color="var(--text-secondary)" />
                                )}
                              </button>

                              <div
                                style={{
                                  ...styles.catColorDot,
                                  backgroundColor: drill.category.color || 'var(--primary)',
                                }}
                              />

                              <div>
                                <span style={styles.categoryName}>{drill.category.name}</span>
                                <span style={styles.txCountBadge}>
                                  {drill.transactions.length} txs
                                </span>
                              </div>
                            </div>

                            {/* Budget Progress Bar for expenses */}
                            {drill.budgetAmount > 0 && (
                              <div style={styles.budgetProgressWrap}>
                                <div style={styles.progressTrack}>
                                  <div
                                    style={{
                                      ...styles.progressFill,
                                      width: `${progressPct}%`,
                                      backgroundColor: isOverBudget
                                        ? 'var(--danger)'
                                        : drill.category.color || 'var(--primary)',
                                    }}
                                  />
                                </div>
                                <span
                                  style={{
                                    ...styles.budgetVarianceText,
                                    color: isOverBudget ? 'var(--danger)' : 'var(--text-muted)',
                                  }}
                                >
                                  {progressPct}% of {currencySymbol}{drill.budgetAmount.toLocaleString()}
                                </span>
                              </div>
                            )}

                            {/* Category Spent Amount */}
                            <div style={styles.categoryAmountWrap}>
                              <span
                                style={{
                                  ...styles.categoryAmount,
                                  color: isExpense ? 'var(--text-primary)' : 'var(--success-text)',
                                }}
                              >
                                {isExpense ? '-' : '+'} {currencySymbol}{' '}
                                {drill.actualAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>

                          {/* =======================================================
                              LEVEL 3: INDIVIDUAL TRANSACTIONS
                              ======================================================= */}
                          {isCatExpanded && (
                            <div style={styles.transactionsContainer} className="animate-fade-in">
                              {drill.transactions.length === 0 ? (
                                <div style={styles.noTxsNote}>No transactions recorded for this category.</div>
                              ) : (
                                drill.transactions.map((tx) => (
                                  <div key={tx.id} style={styles.transactionRow}>
                                    <div style={styles.txDate}>{tx.date}</div>

                                    <div style={styles.txPayeeWrap}>
                                      <div style={styles.txPayee}>{tx.payee_name}</div>
                                      {tx.notes && <div style={styles.txNotes}>{tx.notes}</div>}
                                    </div>

                                    <div style={styles.txMethod} className="desktop-only">
                                      <CreditCard size={13} color="var(--text-muted)" />
                                      <span>
                                        {tx.card_last_digits ? `*${tx.card_last_digits}` : tx.payment_method}
                                      </span>
                                    </div>

                                    <div
                                      style={{
                                        ...styles.txAmount,
                                        color: isExpense ? 'var(--text-primary)' : 'var(--success-text)',
                                      }}
                                    >
                                      {isExpense ? '-' : '+'} {currencySymbol}{' '}
                                      {Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </div>

                                    {/* Action Buttons: Edit & Hide */}
                                    <div style={styles.txActions}>
                                      <button
                                        style={styles.actionBtn}
                                        title="Edit transaction details"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingTransaction(tx);
                                        }}
                                      >
                                        <Edit3 size={13} color="var(--primary)" />
                                      </button>
                                      <button
                                        style={{ ...styles.actionBtn, ...styles.actionBtnDanger }}
                                        title="Hide transaction (soft-delete)"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onToggleHideTransaction(tx.id);
                                        }}
                                      >
                                        <EyeOff size={13} color="var(--danger)" />
                                      </button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Transaction Modal */}
      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          categories={categories}
          currencySymbol={currencySymbol}
          isDemoMode={isDemoMode}
          onClose={() => setEditingTransaction(null)}
          onSave={onTransactionUpdated}
          onHide={onToggleHideTransaction}
        />
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  sectionHeader: {
    marginBottom: '4px',
  },
  sectionTitle: {
    fontSize: '1.125rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  sectionSubtitle: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  macroList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  macroCard: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    boxShadow: 'var(--shadow-sm)',
    overflow: 'hidden',
  },
  macroHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'background-color 0.15s ease',
  },
  macroLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  chevronBtn: {
    background: 'none',
    border: 'none',
    padding: '2px',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
  },
  macroIconWrap: {
    width: '38px',
    height: '38px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
  },
  macroTitle: {
    fontSize: '0.9375rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  macroHebrew: {
    fontSize: '0.8125rem',
    color: 'var(--text-muted)',
    fontWeight: '500',
  },
  macroSub: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  macroRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  macroAmountLabel: {
    fontSize: '0.6875rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  macroAmountValue: {
    fontSize: '1.0625rem',
    fontWeight: '800',
  },
  macroBudgetSub: {
    fontSize: '0.6875rem',
    color: 'var(--text-muted)',
    marginTop: '1px',
  },
  categoriesContainer: {
    borderTop: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--bg-surface)',
  },
  emptyCategories: {
    padding: '16px 20px',
    fontSize: '0.8125rem',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  categoryItem: {
    borderBottom: '1px solid var(--border-subtle)',
  },
  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px 12px 36px',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
    backgroundColor: 'var(--bg-surface)',
    flexWrap: 'wrap',
    gap: '12px',
  },
  categoryHeaderExpanded: {
    backgroundColor: 'var(--bg-surface-subtle)',
  },
  categoryLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: '220px',
  },
  catChevronBtn: {
    background: 'none',
    border: 'none',
    padding: '2px',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
  },
  catColorDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  categoryName: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  txCountBadge: {
    marginLeft: '6px',
    padding: '1px 6px',
    borderRadius: '10px',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
    fontSize: '0.6875rem',
    color: 'var(--text-muted)',
  },
  budgetProgressWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    width: '140px',
  },
  progressTrack: {
    height: '6px',
    backgroundColor: 'var(--bg-surface-subtle)',
    borderRadius: '3px',
    overflow: 'hidden',
    border: '1px solid var(--border-subtle)',
  },
  progressFill: {
    height: '100%',
    borderRadius: '3px',
  },
  budgetVarianceText: {
    fontSize: '0.6875rem',
    textAlign: 'right',
  },
  categoryAmountWrap: {
    textAlign: 'right',
  },
  categoryAmount: {
    fontSize: '0.875rem',
    fontWeight: '700',
  },
  transactionsContainer: {
    backgroundColor: 'var(--bg-surface-subtle)',
    padding: '8px 20px 12px 54px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    borderTop: '1px solid var(--border-subtle)',
  },
  noTxsNote: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    padding: '6px 0',
  },
  transactionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-main)',
    fontSize: '0.8125rem',
    gap: '12px',
  },
  txDate: {
    width: '85px',
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
  },
  txPayeeWrap: {
    flex: 1,
    minWidth: '160px',
  },
  txPayee: {
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  txNotes: {
    fontSize: '0.6875rem',
    color: 'var(--text-muted)',
  },
  txMethod: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    width: '80px',
  },
  txAmount: {
    fontWeight: '700',
    width: '95px',
    textAlign: 'right',
  },
  txActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  actionBtn: {
    padding: '4px 6px',
    borderRadius: '4px',
    backgroundColor: 'var(--primary-light)',
    border: '1px solid var(--primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  actionBtnDanger: {
    backgroundColor: 'var(--danger-light)',
    borderColor: '#FECACA',
  },
};
