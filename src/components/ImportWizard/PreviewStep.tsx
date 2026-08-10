import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Layers,
  CreditCard,
  Check,
  Minus,
} from 'lucide-react';
import { TransformedImportRow, Category } from '../../lib/types';

interface PreviewStepProps {
  rows: TransformedImportRow[];
  categories: Category[];
  currencySymbol: string;
  onToggleRow: (rowId: string) => void;
  onToggleAll: (selectAll: boolean) => void;
  onRowCategoryChanged: (rowId: string, categoryId: string) => void;
}

export const PreviewStep: React.FC<PreviewStepProps> = ({
  rows,
  categories,
  currencySymbol,
  onToggleRow,
  onToggleAll,
  onRowCategoryChanged,
}) => {
  const selectedRows = rows.filter((r) => r.selected);
  const validRows = rows.filter((r) => r.isValid);
  const invalidRows = rows.filter((r) => !r.isValid);
  const autoCategorizedRows = rows.filter((r) => r.category_id && r.auto_matched_rule);

  const totalIncome = selectedRows
    .filter((r) => r.transaction_type === 'income')
    .reduce((sum, r) => sum + r.amount, 0);

  const totalExpense = selectedRows
    .filter((r) => r.transaction_type === 'expense')
    .reduce((sum, r) => sum + r.amount, 0);

  const allSelected = rows.length > 0 && rows.every((r) => r.selected);
  const someSelected = rows.some((r) => r.selected) && !allSelected;

  return (
    <div style={styles.container} className="animate-fade-in">
      <div style={styles.header}>
        <h2 style={styles.title}>3. Preview & Validate Transactions</h2>
        <p style={styles.subtitle}>
          Review transformed transactions and verify auto-categorization matching before importing to your household ledger.
        </p>
      </div>

      {/* Summary KPI Cards Bar */}
      <div style={styles.kpiBar}>
        <div style={styles.kpiTile}>
          <span style={styles.kpiLabel}>Total Records</span>
          <span style={styles.kpiValue}>{rows.length}</span>
        </div>

        <div style={styles.kpiDivider} />

        <div style={styles.kpiTile}>
          <span style={styles.kpiLabel}>Selected to Import</span>
          <span style={{ ...styles.kpiValue, color: 'var(--primary)' }}>
            {selectedRows.length} / {rows.length}
          </span>
        </div>

        <div style={styles.kpiDivider} />

        <div style={styles.kpiTile}>
          <span style={styles.kpiLabel}>Auto-Categorized</span>
          <div style={styles.autoMatchedCount}>
            <Sparkles size={14} color="var(--primary)" />
            <span style={{ ...styles.kpiValue, color: 'var(--primary)' }}>
              {autoCategorizedRows.length}
            </span>
          </div>
        </div>

        <div style={styles.kpiDivider} />

        <div style={styles.kpiTile}>
          <span style={styles.kpiLabel}>Batch Expenses</span>
          <div style={styles.amountTile}>
            <TrendingDown size={14} color="var(--danger)" />
            <span style={{ ...styles.kpiValue, color: 'var(--text-primary)' }}>
              {currencySymbol} {totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div style={styles.kpiDivider} />

        <div style={styles.kpiTile}>
          <span style={styles.kpiLabel}>Batch Income</span>
          <div style={styles.amountTile}>
            <TrendingUp size={14} color="var(--success)" />
            <span style={{ ...styles.kpiValue, color: 'var(--success-text)' }}>
              {currencySymbol} {totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Invalid Rows Alert if any */}
      {invalidRows.length > 0 && (
        <div style={styles.invalidAlert}>
          <AlertTriangle size={16} color="var(--warning-text)" />
          <span>
            {invalidRows.length} row(s) contain invalid dates or amounts. These are unselected by default.
          </span>
        </div>
      )}

      {/* Preview Table Card */}
      <div style={styles.tableCard}>
        {/* Table Header */}
        <div style={styles.tableHeaderRow}>
          <div style={{ width: '40px', display: 'flex', alignItems: 'center' }}>
            <input
              type="checkbox"
              style={styles.checkbox}
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected;
              }}
              onChange={(e) => onToggleAll(e.target.checked)}
            />
          </div>
          <div style={{ flex: 1.2 }}>Date</div>
          <div style={{ flex: 3 }}>Payee / Merchant</div>
          <div style={{ flex: 2.4 }}>Assigned Category</div>
          <div style={{ flex: 1.6 }}>Method / Card</div>
          <div style={{ flex: 1.6, textAlign: 'right' }}>Amount</div>
        </div>

        {/* Rows */}
        <div style={styles.rowsContainer}>
          {rows.map((row) => {
            const category = categories.find((c) => c.id === row.category_id);
            const isExpense = row.transaction_type === 'expense';

            return (
              <div
                key={row.id}
                style={{
                  ...styles.tableRow,
                  ...(!row.selected ? styles.tableRowDeselected : {}),
                  ...(!row.isValid ? styles.tableRowInvalid : {}),
                }}
              >
                {/* Checkbox */}
                <div style={{ width: '40px', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    style={styles.checkbox}
                    checked={row.selected}
                    onChange={() => onToggleRow(row.id)}
                  />
                </div>

                {/* Date */}
                <div style={{ flex: 1.2 }}>
                  <div style={styles.dateText}>{row.date}</div>
                  {!row.isValid && row.validationError && (
                    <span style={styles.errorTag}>{row.validationError}</span>
                  )}
                </div>

                {/* Payee */}
                <div style={{ flex: 3 }}>
                  <div style={styles.payeeText}>{row.payee_name}</div>
                  {row.notes && <div style={styles.notesText}>{row.notes}</div>}
                </div>

                {/* Category & Auto-rule */}
                <div style={{ flex: 2.4, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <select
                    style={styles.categorySelect}
                    value={row.category_id || ''}
                    onChange={(e) => onRowCategoryChanged(row.id, e.target.value)}
                  >
                    <option value="">-- Uncategorized --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>

                  {row.auto_matched_rule && (
                    <div style={styles.autoRulePill}>
                      <Sparkles size={11} color="var(--primary)" />
                      <span>Auto: {row.auto_matched_rule}</span>
                    </div>
                  )}
                </div>

                {/* Payment Method / Last 4 */}
                <div style={{ flex: 1.6, display: 'flex', alignItems: 'center', gap: '6px' }}>
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
              </div>
            );
          })}
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
  autoMatchedCount: {
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
  invalidAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    backgroundColor: 'var(--warning-light)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid #FDE68A',
    color: 'var(--warning-text)',
    fontSize: '0.8125rem',
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
    maxHeight: '440px',
    overflowY: 'auto',
  },
  tableRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 20px',
    borderBottom: '1px solid var(--border-subtle)',
    transition: 'background-color 0.15s ease',
  },
  tableRowDeselected: {
    opacity: 0.45,
    backgroundColor: 'var(--bg-surface-subtle)',
  },
  tableRowInvalid: {
    backgroundColor: '#FFF1F2',
  },
  dateText: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    fontWeight: '500',
  },
  errorTag: {
    fontSize: '0.625rem',
    color: 'var(--danger-text)',
    fontWeight: '700',
    textTransform: 'uppercase',
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
    padding: '4px 6px',
    fontSize: '0.75rem',
    color: 'var(--text-primary)',
    width: '100%',
    maxWidth: '180px',
    cursor: 'pointer',
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
    alignSelf: 'flex-start',
  },
  methodText: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
};
