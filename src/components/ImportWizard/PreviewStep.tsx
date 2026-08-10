import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Eye,
  EyeOff,
  Filter,
  Search,
  Plus,
  Tag,
  Check,
  HelpCircle,
} from 'lucide-react';
import { TransformedImportRow, Category, BusinessMapping } from '../../lib/types';
import { saveBusinessMapping } from '../../lib/services/mappingService';
import { applyClassificationToRows } from '../../lib/classifier';

interface PreviewStepProps {
  rows: TransformedImportRow[];
  categories: Category[];
  businessMappings: BusinessMapping[];
  householdId: string;
  isDemoMode: boolean;
  currencySymbol: string;
  onRowsUpdated: (updatedRows: TransformedImportRow[]) => void;
  onNewMappingCreated: (newMapping: BusinessMapping) => void;
}

export const PreviewStep: React.FC<PreviewStepProps> = ({
  rows,
  categories,
  businessMappings,
  householdId,
  isDemoMode,
  currencySymbol,
  onRowsUpdated,
  onNewMappingCreated,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'hidden' | 'unassigned' | 'auto'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [savingRuleForPayee, setSavingRuleForPayee] = useState<string | null>(null);
  const [bulkCategory, setBulkCategory] = useState<string>('');

  // Row Toggles
  const handleToggleRow = (rowId: string) => {
    const updated = rows.map((r) => (r.id === rowId ? { ...r, selected: !r.selected } : r));
    onRowsUpdated(updated);
  };

  const handleToggleAll = (selectAll: boolean) => {
    const updated = rows.map((r) => ({ ...r, selected: selectAll }));
    onRowsUpdated(updated);
  };

  // Row Hiding Mechanism (is_hidden toggle)
  const handleToggleHidden = (rowId: string) => {
    const updated = rows.map((r) =>
      r.id === rowId ? { ...r, is_hidden: !r.is_hidden } : r
    );
    onRowsUpdated(updated);
  };

  // Category change for a specific row
  const handleCategoryChanged = (rowId: string, categoryId: string) => {
    const updated = rows.map((r) => {
      if (r.id === rowId) {
        return {
          ...r,
          category_id: categoryId || null,
          auto_matched_rule: undefined, // marked as manual assignment
        };
      }
      return r;
    });
    onRowsUpdated(updated);
  };

  // Inline "Save as Auto-Rule" handler
  const handleSaveInlineRule = async (payeeName: string, categoryId: string) => {
    if (!payeeName || !categoryId) return;
    setSavingRuleForPayee(payeeName);

    try {
      // Clean keyword (take first 1-3 clean words or main keyword)
      const cleanKeyword = payeeName
        .replace(/[0-9#*\-_]/g, ' ')
        .trim()
        .split(/\s+/)[0]
        .toUpperCase();

      const newRule = await saveBusinessMapping(
        householdId,
        cleanKeyword || payeeName.toUpperCase(),
        categoryId,
        10,
        isDemoMode
      );

      onNewMappingCreated(newRule);

      // Re-classify all rows in real time with the new rule added!
      const updatedMappings = [newRule, ...businessMappings];
      const reclassifiedRows = applyClassificationToRows(rows, updatedMappings, categories);
      onRowsUpdated(reclassifiedRows);
    } catch (err) {
      console.error('Failed to create auto-rule:', err);
    } finally {
      setSavingRuleForPayee(null);
    }
  };

  // Bulk Actions
  const handleBulkSetHidden = (hide: boolean) => {
    const updated = rows.map((r) => (r.selected ? { ...r, is_hidden: hide } : r));
    onRowsUpdated(updated);
  };

  const handleBulkAssignCategory = (categoryId: string) => {
    if (!categoryId) return;
    const updated = rows.map((r) =>
      r.selected ? { ...r, category_id: categoryId, auto_matched_rule: undefined } : r
    );
    onRowsUpdated(updated);
    setBulkCategory('');
  };

  // Filtering
  const filteredRows = rows.filter((row) => {
    // Mode filter
    if (filterMode === 'active' && row.is_hidden) return false;
    if (filterMode === 'hidden' && !row.is_hidden) return false;
    if (filterMode === 'unassigned' && row.category_id !== null) return false;
    if (filterMode === 'auto' && !row.auto_matched_rule) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const payeeMatch = row.payee_name.toLowerCase().includes(q);
      const cat = categories.find((c) => c.id === row.category_id);
      const catMatch = cat?.name.toLowerCase().includes(q);
      const notesMatch = row.notes?.toLowerCase().includes(q);
      return payeeMatch || catMatch || notesMatch;
    }

    return true;
  });

  const selectedRows = rows.filter((r) => r.selected);
  const hiddenCount = rows.filter((r) => r.is_hidden).length;
  const autoCategorizedCount = rows.filter((r) => r.category_id && r.auto_matched_rule).length;
  const unassignedCount = rows.filter((r) => r.category_id === null).length;

  // Active (non-hidden) selected totals for budget metrics
  const activeSelectedRows = selectedRows.filter((r) => !r.is_hidden);
  const totalIncome = activeSelectedRows
    .filter((r) => r.transaction_type === 'income')
    .reduce((sum, r) => sum + r.amount, 0);

  const totalExpense = activeSelectedRows
    .filter((r) => r.transaction_type === 'expense')
    .reduce((sum, r) => sum + r.amount, 0);

  const allFilteredSelected =
    filteredRows.length > 0 && filteredRows.every((r) => r.selected);
  const someFilteredSelected =
    filteredRows.some((r) => r.selected) && !allFilteredSelected;

  return (
    <div style={styles.container} className="animate-fade-in">
      <div style={styles.header}>
        <h2 style={styles.title}>3. Classification & Row Hiding Preview</h2>
        <p style={styles.subtitle}>
          Review merchant classifications, mark rows as hidden, or save new auto-mapping rules on the fly before database insertion.
        </p>
      </div>

      {/* KPI Stats Bar */}
      <div style={styles.kpiBar}>
        <div style={styles.kpiTile}>
          <span style={styles.kpiLabel}>Total Records</span>
          <span style={styles.kpiValue}>{rows.length}</span>
        </div>

        <div style={styles.kpiDivider} />

        <div style={styles.kpiTile}>
          <span style={styles.kpiLabel}>Selected to Insert</span>
          <span style={{ ...styles.kpiValue, color: 'var(--primary)' }}>
            {selectedRows.length} / {rows.length}
          </span>
        </div>

        <div style={styles.kpiDivider} />

        <div style={styles.kpiTile}>
          <span style={styles.kpiLabel}>Auto-Categorized</span>
          <div style={styles.sparkleTile}>
            <Sparkles size={14} color="var(--primary)" />
            <span style={{ ...styles.kpiValue, color: 'var(--primary)' }}>
              {autoCategorizedCount}
            </span>
          </div>
        </div>

        <div style={styles.kpiDivider} />

        <div style={styles.kpiTile}>
          <span style={styles.kpiLabel}>Unassigned</span>
          <span
            style={{
              ...styles.kpiValue,
              color: unassignedCount > 0 ? 'var(--warning-text)' : 'var(--success-text)',
            }}
          >
            {unassignedCount}
          </span>
        </div>

        <div style={styles.kpiDivider} />

        <div style={styles.kpiTile}>
          <span style={styles.kpiLabel}>Marked Hidden</span>
          <div style={styles.sparkleTile}>
            <EyeOff size={14} color="var(--text-muted)" />
            <span style={{ ...styles.kpiValue, color: 'var(--text-muted)' }}>
              {hiddenCount}
            </span>
          </div>
        </div>

        <div style={styles.kpiDivider} />

        <div style={styles.kpiTile}>
          <span style={styles.kpiLabel}>Active Expenses</span>
          <div style={styles.amountTile}>
            <TrendingDown size={14} color="var(--danger)" />
            <span style={{ ...styles.kpiValue, color: 'var(--text-primary)' }}>
              {currencySymbol} {totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Bulk Action Toolbar */}
      <div style={styles.toolbarCard}>
        <div style={styles.searchWrapper}>
          <Search size={15} color="var(--text-secondary)" />
          <input
            style={styles.searchInput}
            type="text"
            placeholder="Search payee or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter Pills */}
        <div style={styles.filterPillsRow}>
          <button
            style={{
              ...styles.filterPill,
              ...(filterMode === 'all' ? styles.filterPillActive : {}),
            }}
            onClick={() => setFilterMode('all')}
          >
            All ({rows.length})
          </button>
          <button
            style={{
              ...styles.filterPill,
              ...(filterMode === 'active' ? styles.filterPillActive : {}),
            }}
            onClick={() => setFilterMode('active')}
          >
            Active ({rows.length - hiddenCount})
          </button>
          <button
            style={{
              ...styles.filterPill,
              ...(filterMode === 'hidden' ? styles.filterPillActive : {}),
            }}
            onClick={() => setFilterMode('hidden')}
          >
            <EyeOff size={12} />
            Hidden ({hiddenCount})
          </button>
          <button
            style={{
              ...styles.filterPill,
              ...(filterMode === 'auto' ? styles.filterPillActive : {}),
            }}
            onClick={() => setFilterMode('auto')}
          >
            <Sparkles size={12} color="var(--primary)" />
            Auto-Mapped ({autoCategorizedCount})
          </button>
          <button
            style={{
              ...styles.filterPill,
              ...(filterMode === 'unassigned' ? styles.filterPillActive : {}),
            }}
            onClick={() => setFilterMode('unassigned')}
          >
            Unassigned ({unassignedCount})
          </button>
        </div>

        {/* Bulk Actions when rows are selected */}
        {selectedRows.length > 0 && (
          <div style={styles.bulkActionsRow}>
            <span style={styles.selectedCountText}>
              {selectedRows.length} selected:
            </span>
            <button
              style={styles.bulkBtn}
              onClick={() => handleBulkSetHidden(true)}
              title="Mark selected rows as hidden (is_hidden = true)"
            >
              <EyeOff size={13} color="var(--text-secondary)" />
              <span>Hide Selected</span>
            </button>
            <button
              style={styles.bulkBtn}
              onClick={() => handleBulkSetHidden(false)}
              title="Restore selected rows to active (is_hidden = false)"
            >
              <Eye size={13} color="var(--primary)" />
              <span>Unhide Selected</span>
            </button>

            <select
              style={styles.bulkCategorySelect}
              value={bulkCategory}
              onChange={(e) => handleBulkAssignCategory(e.target.value)}
            >
              <option value="">-- Assign Category to Selected --</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Transactions Table Card */}
      <div style={styles.tableCard}>
        {/* Table Header */}
        <div style={styles.tableHeaderRow}>
          <div style={{ width: '40px', display: 'flex', alignItems: 'center' }}>
            <input
              type="checkbox"
              style={styles.checkbox}
              checked={allFilteredSelected}
              ref={(el) => {
                if (el) el.indeterminate = someFilteredSelected;
              }}
              onChange={(e) => handleToggleAll(e.target.checked)}
            />
          </div>
          <div style={{ flex: 1.2 }}>Date</div>
          <div style={{ flex: 3 }}>Payee / Merchant</div>
          <div style={{ flex: 2.8 }}>Category Classification</div>
          <div style={{ flex: 1.4 }}>Method / Card</div>
          <div style={{ flex: 1.6, textAlign: 'right' }}>Amount</div>
          <div style={{ width: '80px', textAlign: 'center' }}>Hide / Soft Delete</div>
        </div>

        {/* Rows */}
        <div style={styles.rowsContainer}>
          {filteredRows.length === 0 ? (
            <div style={styles.emptyFilterState}>
              <HelpCircle size={32} color="var(--text-muted)" />
              <div style={styles.emptyFilterTitle}>No matching transactions</div>
              <div style={styles.emptyFilterDesc}>Try changing your filter mode or search query.</div>
            </div>
          ) : (
            filteredRows.map((row) => {
              const category = categories.find((c) => c.id === row.category_id);
              const isExpense = row.transaction_type === 'expense';
              const hasManualCategory = row.category_id && !row.auto_matched_rule;

              return (
                <div
                  key={row.id}
                  style={{
                    ...styles.tableRow,
                    ...(row.is_hidden ? styles.tableRowHidden : {}),
                    ...(!row.selected ? styles.tableRowDeselected : {}),
                  }}
                >
                  {/* Selection Checkbox */}
                  <div style={{ width: '40px', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      style={styles.checkbox}
                      checked={row.selected}
                      onChange={() => handleToggleRow(row.id)}
                    />
                  </div>

                  {/* Date */}
                  <div style={{ flex: 1.2 }}>
                    <div style={styles.dateText}>{row.date}</div>
                    {row.is_hidden && (
                      <span style={styles.hiddenTag}>Hidden (Soft-Delete)</span>
                    )}
                  </div>

                  {/* Payee */}
                  <div style={{ flex: 3 }}>
                    <div style={styles.payeeText}>{row.payee_name}</div>
                    {row.notes && <div style={styles.notesText}>{row.notes}</div>}
                  </div>

                  {/* Category Assignment & Inline Auto-Rule Creator */}
                  <div style={{ flex: 2.8, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <select
                        style={{
                          ...styles.categorySelect,
                          ...(row.category_id === null ? styles.categorySelectUnassigned : {}),
                        }}
                        value={row.category_id || ''}
                        onChange={(e) => handleCategoryChanged(row.id, e.target.value)}
                      >
                        <option value="">⚠️ Unassigned (Select Category)</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.type})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={styles.ruleStatusRow}>
                      {row.auto_matched_rule ? (
                        <div style={styles.autoRulePill}>
                          <Sparkles size={11} color="var(--primary)" />
                          <span>Matched Rule: {row.auto_matched_rule}</span>
                        </div>
                      ) : row.category_id ? (
                        <button
                          style={styles.saveRuleBtn}
                          disabled={savingRuleForPayee === row.payee_name}
                          onClick={() => handleSaveInlineRule(row.payee_name, row.category_id!)}
                          title="Save this merchant to Business_Mapping in Supabase"
                        >
                          <Plus size={11} color="var(--primary)" />
                          <span>
                            {savingRuleForPayee === row.payee_name
                              ? 'Saving Rule...'
                              : `Save Auto-Rule for "${row.payee_name.split(' ')[0]}"`}
                          </span>
                        </button>
                      ) : (
                        <span style={styles.unassignedPrompt}>Select category to assign</span>
                      )}
                    </div>
                  </div>

                  {/* Payment Method / Last 4 */}
                  <div style={{ flex: 1.4, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CreditCard size={13} color="var(--text-muted)" />
                    <span style={styles.methodText}>
                      {row.card_last_digits ? `*${row.card_last_digits}` : row.payment_method}
                    </span>
                  </div>

                  {/* Amount */}
                  <div
                    style={{
                      flex: 1.6,
                      textAlign: 'right',
                      fontWeight: '700',
                      fontSize: '0.875rem',
                      color: isExpense ? 'var(--text-primary)' : 'var(--success-text)',
                    }}
                  >
                    {isExpense ? '-' : '+'} {currencySymbol}{' '}
                    {row.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>

                  {/* Row Hiding Mechanism (is_hidden toggle) */}
                  <div style={{ width: '80px', display: 'flex', justifyContent: 'center' }}>
                    <button
                      style={{
                        ...styles.hideToggleBtn,
                        ...(row.is_hidden ? styles.hideToggleBtnHidden : {}),
                      }}
                      onClick={() => handleToggleHidden(row.id)}
                      title={row.is_hidden ? 'Restore row to active (is_hidden = false)' : 'Mark row as hidden (is_hidden = true)'}
                    >
                      {row.is_hidden ? (
                        <EyeOff size={15} color="var(--danger)" />
                      ) : (
                        <Eye size={15} color="var(--text-secondary)" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })
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
    gap: '20px',
  },
  header: {
    marginBottom: '4px',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    marginTop: '4px',
    lineHeight: '1.5',
  },
  kpiBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    padding: '18px 20px',
    boxShadow: 'var(--shadow-sm)',
    flexWrap: 'wrap',
    gap: '14px',
  },
  kpiTile: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: '0.6875rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    marginBottom: '4px',
  },
  kpiValue: {
    fontSize: '1.125rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  sparkleTile: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  amountTile: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  kpiDivider: {
    width: '1px',
    height: '32px',
    backgroundColor: 'var(--border-subtle)',
  },
  toolbarCard: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-main)',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
    boxShadow: 'var(--shadow-sm)',
  },
  searchWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'var(--bg-surface-subtle)',
    padding: '6px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-strong)',
    minWidth: '220px',
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    fontSize: '0.8125rem',
    color: 'var(--text-primary)',
    width: '100%',
  },
  filterPillsRow: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  filterPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 12px',
    borderRadius: '16px',
    border: '1px solid var(--border-main)',
    backgroundColor: 'var(--bg-surface-subtle)',
    fontSize: '0.75rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    transition: 'all 0.15s ease',
  },
  filterPillActive: {
    backgroundColor: 'var(--primary-light)',
    borderColor: 'var(--primary)',
    color: 'var(--primary)',
    fontWeight: '700',
  },
  bulkActionsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    paddingLeft: '8px',
    borderLeft: '1px solid var(--border-subtle)',
  },
  selectedCountText: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  bulkBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '6px 10px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  bulkCategorySelect: {
    padding: '5px 8px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-strong)',
    backgroundColor: 'var(--bg-surface)',
    fontSize: '0.75rem',
    color: 'var(--text-primary)',
  },
  tableCard: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    boxShadow: 'var(--shadow-sm)',
    overflow: 'hidden',
  },
  tableHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 20px',
    backgroundColor: 'var(--bg-surface-subtle)',
    borderBottom: '1px solid var(--border-main)',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  checkbox: {
    width: '16px',
    height: '16px',
    cursor: 'pointer',
    accentColor: 'var(--primary)',
  },
  rowsContainer: {
    maxHeight: '460px',
    overflowY: 'auto',
  },
  tableRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 20px',
    borderBottom: '1px solid var(--border-subtle)',
    transition: 'background-color 0.15s ease',
  },
  tableRowHidden: {
    backgroundColor: '#F8FAFC',
    opacity: 0.5,
  },
  tableRowDeselected: {
    opacity: 0.4,
  },
  dateText: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    fontWeight: '500',
  },
  hiddenTag: {
    display: 'inline-block',
    fontSize: '0.625rem',
    color: 'var(--danger-text)',
    backgroundColor: 'var(--danger-light)',
    padding: '1px 5px',
    borderRadius: '4px',
    fontWeight: '700',
    marginTop: '2px',
  },
  payeeText: {
    fontSize: '0.875rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  notesText: {
    fontSize: '0.6875rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  categorySelect: {
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-strong)',
    borderRadius: '4px',
    padding: '5px 8px',
    fontSize: '0.75rem',
    color: 'var(--text-primary)',
    width: '100%',
    maxWidth: '220px',
    cursor: 'pointer',
  },
  categorySelectUnassigned: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    color: '#B91C1C',
    fontWeight: '600',
  },
  ruleStatusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  autoRulePill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 6px',
    backgroundColor: 'var(--primary-light)',
    borderRadius: '4px',
    fontSize: '0.6875rem',
    color: 'var(--primary)',
    fontWeight: '600',
  },
  saveRuleBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    backgroundColor: 'var(--primary-light)',
    border: '1px dashed var(--primary)',
    borderRadius: '4px',
    fontSize: '0.6875rem',
    color: 'var(--primary)',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  unassignedPrompt: {
    fontSize: '0.6875rem',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  methodText: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  hideToggleBtn: {
    padding: '6px 10px',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-surface-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: '1px solid var(--border-main)',
    transition: 'all 0.15s ease',
  },
  hideToggleBtnHidden: {
    backgroundColor: 'var(--danger-light)',
    borderColor: '#FECACA',
  },
  emptyFilterState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 20px',
    gap: '8px',
  },
  emptyFilterTitle: {
    fontSize: '0.9375rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  emptyFilterDesc: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
  },
};
