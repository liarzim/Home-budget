import React from 'react';
import {
  Calendar,
  Store,
  DollarSign,
  Tag,
  CreditCard,
  FileText,
  Sparkles,
  ArrowRight,
  Sliders,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { ParsedSheet, ColumnMapping, AmountMappingMode } from '../../lib/types';

interface ColumnMappingStepProps {
  sheet: ParsedSheet;
  mapping: ColumnMapping;
  onMappingChanged: (newMapping: ColumnMapping) => void;
}

export const ColumnMappingStep: React.FC<ColumnMappingStepProps> = ({
  sheet,
  mapping,
  onMappingChanged,
}) => {
  const headers = sheet.headers;
  const sampleRow = sheet.rows[0] || {};

  const handleFieldChange = (field: keyof ColumnMapping, value: any) => {
    onMappingChanged({
      ...mapping,
      [field]: value,
    });
  };

  const isFormValid =
    Boolean(mapping.dateColumn) &&
    Boolean(mapping.payeeColumn) &&
    (mapping.amountMode === 'single'
      ? Boolean(mapping.amountColumn)
      : Boolean(mapping.debitColumn || mapping.creditColumn));

  return (
    <div style={styles.container} className="animate-fade-in">
      <div style={styles.header}>
        <h2 style={styles.title}>2. Column Mapping Wizard</h2>
        <p style={styles.subtitle}>
          Link the columns from your statement to our system transaction fields. Auto-detected matches are pre-selected.
        </p>
      </div>

      {/* Amount Mode Switcher */}
      <div style={styles.modeCard}>
        <div style={styles.modeLeft}>
          <Sliders size={16} color="var(--primary)" />
          <div>
            <div style={styles.modeTitle}>Amount Structure</div>
            <div style={styles.modeDesc}>
              Does your statement have one column for all amounts, or separate Debit & Credit columns?
            </div>
          </div>
        </div>

        <div style={styles.modeButtonGroup}>
          <button
            style={{
              ...styles.modeBtn,
              ...(mapping.amountMode === 'single' ? styles.modeBtnActive : {}),
            }}
            onClick={() => handleFieldChange('amountMode', 'single')}
          >
            Single Amount Column
          </button>
          <button
            style={{
              ...styles.modeBtn,
              ...(mapping.amountMode === 'debit_credit' ? styles.modeBtnActive : {}),
            }}
            onClick={() => handleFieldChange('amountMode', 'debit_credit')}
          >
            Separate Debit / Credit Columns
          </button>
        </div>
      </div>

      {/* Required Mapping Grid */}
      <div style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>Required Transaction Fields</span>
          <span style={styles.requiredPill}>Mandatory</span>
        </div>

        <div style={styles.fieldsGrid}>
          {/* 1. Transaction Date */}
          <div style={styles.fieldCard}>
            <div style={styles.fieldTop}>
              <div style={styles.fieldIconBox}>
                <Calendar size={16} color="var(--primary)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.fieldLabel}>
                  Transaction Date <span style={{ color: 'var(--danger)' }}>*</span>
                </div>
                <div style={styles.fieldHelper}>Matches transaction or posting date</div>
              </div>
            </div>

            <select
              style={styles.fieldSelect}
              value={mapping.dateColumn}
              onChange={(e) => handleFieldChange('dateColumn', e.target.value)}
            >
              <option value="">-- Select Date Column --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h} (e.g. "{sampleRow[h] ?? ''}")
                </option>
              ))}
            </select>

            {mapping.dateColumn && (
              <div style={styles.samplePreview}>
                Sample value: <strong>{String(sampleRow[mapping.dateColumn] ?? '(empty)')}</strong>
              </div>
            )}
          </div>

          {/* 2. Payee / Merchant Name */}
          <div style={styles.fieldCard}>
            <div style={styles.fieldTop}>
              <div style={{ ...styles.fieldIconBox, backgroundColor: 'var(--success-light)' }}>
                <Store size={16} color="var(--success)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.fieldLabel}>
                  Payee / Merchant Name <span style={{ color: 'var(--danger)' }}>*</span>
                </div>
                <div style={styles.fieldHelper}>Business name used for auto-categorization</div>
              </div>
            </div>

            <select
              style={styles.fieldSelect}
              value={mapping.payeeColumn}
              onChange={(e) => handleFieldChange('payeeColumn', e.target.value)}
            >
              <option value="">-- Select Payee Column --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h} (e.g. "{sampleRow[h] ?? ''}")
                </option>
              ))}
            </select>

            {mapping.payeeColumn && (
              <div style={styles.samplePreview}>
                Sample value: <strong>{String(sampleRow[mapping.payeeColumn] ?? '(empty)')}</strong>
              </div>
            )}
          </div>

          {/* 3. Amount Column (Single Mode) */}
          {mapping.amountMode === 'single' ? (
            <div style={styles.fieldCard}>
              <div style={styles.fieldTop}>
                <div style={{ ...styles.fieldIconBox, backgroundColor: 'var(--warning-light)' }}>
                  <DollarSign size={16} color="var(--warning)" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={styles.fieldLabel}>
                    Amount Column <span style={{ color: 'var(--danger)' }}>*</span>
                  </div>
                  <div style={styles.fieldHelper}>Charged amount or transaction sum</div>
                </div>
              </div>

              <select
                style={styles.fieldSelect}
                value={mapping.amountColumn}
                onChange={(e) => handleFieldChange('amountColumn', e.target.value)}
              >
                <option value="">-- Select Amount Column --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h} (e.g. "{sampleRow[h] ?? ''}")
                  </option>
                ))}
              </select>

              {mapping.amountColumn && (
                <div style={styles.samplePreview}>
                  Sample value: <strong>{String(sampleRow[mapping.amountColumn] ?? '(empty)')}</strong>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Debit Column */}
              <div style={styles.fieldCard}>
                <div style={styles.fieldTop}>
                  <div style={{ ...styles.fieldIconBox, backgroundColor: 'var(--danger-light)' }}>
                    <DollarSign size={16} color="var(--danger)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={styles.fieldLabel}>Debit / Expense Column (חובה / חיוב)</div>
                    <div style={styles.fieldHelper}>Outflow / expense charge amount</div>
                  </div>
                </div>

                <select
                  style={styles.fieldSelect}
                  value={mapping.debitColumn || ''}
                  onChange={(e) => handleFieldChange('debitColumn', e.target.value)}
                >
                  <option value="">-- Select Debit Column --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h} (e.g. "{sampleRow[h] ?? ''}")
                    </option>
                  ))}
                </select>
              </div>

              {/* Credit Column */}
              <div style={styles.fieldCard}>
                <div style={styles.fieldTop}>
                  <div style={{ ...styles.fieldIconBox, backgroundColor: 'var(--success-light)' }}>
                    <DollarSign size={16} color="var(--success)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={styles.fieldLabel}>Credit / Income Column (זכות / הכנסה)</div>
                    <div style={styles.fieldHelper}>Inflow / income credit amount</div>
                  </div>
                </div>

                <select
                  style={styles.fieldSelect}
                  value={mapping.creditColumn || ''}
                  onChange={(e) => handleFieldChange('creditColumn', e.target.value)}
                >
                  <option value="">-- Select Credit Column --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h} (e.g. "{sampleRow[h] ?? ''}")
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Optional Metadata Fields */}
      <div style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>Optional Metadata Fields</span>
          <span style={styles.optionalPill}>Optional</span>
        </div>

        <div style={styles.fieldsGrid}>
          {/* Card / Account 4 Digits */}
          <div style={styles.fieldCard}>
            <div style={styles.fieldTop}>
              <div style={styles.fieldIconBox}>
                <CreditCard size={16} color="var(--primary)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.fieldLabel}>Card / Account Last 4 Digits</div>
                <div style={styles.fieldHelper}>Identifies specific credit card (e.g. 2285)</div>
              </div>
            </div>

            <select
              style={styles.fieldSelect}
              value={mapping.cardDigitsColumn || ''}
              onChange={(e) => handleFieldChange('cardDigitsColumn', e.target.value)}
            >
              <option value="">-- None / Auto-detect --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h} (e.g. "{sampleRow[h] ?? ''}")
                </option>
              ))}
            </select>
          </div>

          {/* Statement Category */}
          <div style={styles.fieldCard}>
            <div style={styles.fieldTop}>
              <div style={{ ...styles.fieldIconBox, backgroundColor: 'var(--primary-light)' }}>
                <Tag size={16} color="var(--primary)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.fieldLabel}>Statement Category / Industry</div>
                <div style={styles.fieldHelper}>Original classification from credit card/bank</div>
              </div>
            </div>

            <select
              style={styles.fieldSelect}
              value={mapping.categoryColumn || ''}
              onChange={(e) => handleFieldChange('categoryColumn', e.target.value)}
            >
              <option value="">-- None / Use Auto-Rules --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h} (e.g. "{sampleRow[h] ?? ''}")
                </option>
              ))}
            </select>
          </div>

          {/* Notes / Description */}
          <div style={styles.fieldCard}>
            <div style={styles.fieldTop}>
              <div style={{ ...styles.fieldIconBox, backgroundColor: 'var(--bg-surface-subtle)' }}>
                <FileText size={16} color="var(--text-secondary)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.fieldLabel}>Notes / Extra Memo</div>
                <div style={styles.fieldHelper}>Additional description or memo text</div>
              </div>
            </div>

            <select
              style={styles.fieldSelect}
              value={mapping.notesColumn || ''}
              onChange={(e) => handleFieldChange('notesColumn', e.target.value)}
            >
              <option value="">-- None --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h} (e.g. "{sampleRow[h] ?? ''}")
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!isFormValid && (
        <div style={styles.warningBanner}>
          <AlertCircle size={16} color="var(--warning-text)" />
          <span>Please map at least Date, Payee, and Amount to proceed to the preview step.</span>
        </div>
      )}
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
  modeCard: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
    boxShadow: 'var(--shadow-sm)',
  },
  modeLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  modeTitle: {
    fontSize: '0.875rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  modeDesc: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  modeButtonGroup: {
    display: 'flex',
    backgroundColor: 'var(--bg-surface-subtle)',
    borderRadius: 'var(--radius-sm)',
    padding: '3px',
    border: '1px solid var(--border-main)',
  },
  modeBtn: {
    padding: '7px 14px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.75rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    transition: 'all 0.15s ease',
  },
  modeBtnActive: {
    backgroundColor: 'var(--bg-surface)',
    boxShadow: 'var(--shadow-sm)',
    color: 'var(--primary)',
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    padding: '24px',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: '12px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  sectionTitle: {
    fontSize: '0.9375rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  requiredPill: {
    padding: '2px 8px',
    backgroundColor: 'var(--primary-light)',
    color: 'var(--primary)',
    fontSize: '0.6875rem',
    fontWeight: '700',
    borderRadius: '4px',
    textTransform: 'uppercase',
  },
  optionalPill: {
    padding: '2px 8px',
    backgroundColor: 'var(--bg-surface-subtle)',
    color: 'var(--text-muted)',
    fontSize: '0.6875rem',
    fontWeight: '700',
    borderRadius: '4px',
    textTransform: 'uppercase',
  },
  fieldsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
  },
  fieldCard: {
    backgroundColor: 'var(--bg-surface-subtle)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-main)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  fieldTop: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
  },
  fieldIconBox: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    backgroundColor: 'var(--primary-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  fieldLabel: {
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  fieldHelper: {
    fontSize: '0.6875rem',
    color: 'var(--text-muted)',
    marginTop: '1px',
  },
  fieldSelect: {
    width: '100%',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 10px',
    fontSize: '0.8125rem',
    color: 'var(--text-primary)',
    cursor: 'pointer',
  },
  samplePreview: {
    fontSize: '0.6875rem',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-surface)',
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid var(--border-subtle)',
  },
  warningBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: 'var(--warning-light)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid #FDE68A',
    color: 'var(--warning-text)',
    fontSize: '0.8125rem',
    fontWeight: '500',
  },
};
