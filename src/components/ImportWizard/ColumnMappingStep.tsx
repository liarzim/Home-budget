import React from 'react';
import {
  Calendar,
  Store,
  DollarSign,
  Tag,
  CreditCard,
  FileText,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Hash,
  Receipt,
  Globe,
  Layers,
  ArrowRightLeft,
  Sparkles,
  HelpCircle,
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
    Boolean(mapping.dateColumn || mapping.billingDateColumn) &&
    Boolean(mapping.payeeColumn) &&
    (mapping.amountMode === 'single'
      ? Boolean(mapping.amountColumn)
      : Boolean(mapping.debitColumn || mapping.creditColumn));

  return (
    <div style={styles.container} className="animate-fade-in">
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.stepBadge}>שלב 2 • מיפוי עמודות הדוח</div>
        <h2 style={styles.title}>קישור עמודות מקובץ האקסל לשדות המערכת</h2>
        <p style={styles.subtitle}>
          התאימו את עמודות הדוח הפיננסי (כרטיס אשראי, בנק או אפליקציית תשלומים). המערכת זיהתה ושיבצה מראש את העמודות המתאימות ביותר.
        </p>
      </div>

      {/* Top Configuration Bar: Amount Mode & Bulk Card Setting */}
      <div style={styles.topConfigGrid}>
        {/* Card 1: Amount Structure */}
        <div style={styles.configCard}>
          <div style={styles.configCardHeader}>
            <div style={styles.configIconWrap}>
              <Sliders size={16} color="var(--primary)" />
            </div>
            <div>
              <div style={styles.configTitle}>מבנה סכומי החיוב (Amount Structure)</div>
              <div style={styles.configDesc}>
                האם בדוח יש עמודת סכום אחת, או עמודות נפרדות לחיוב וזיכוי (חובה / זכות)?
              </div>
            </div>
          </div>

          <div style={styles.modeButtonGroup}>
            <button
              type="button"
              style={{
                ...styles.modeBtn,
                ...(mapping.amountMode === 'single' ? styles.modeBtnActive : {}),
              }}
              onClick={() => handleFieldChange('amountMode', 'single')}
            >
              עמודת סכום יחידה (Single)
            </button>
            <button
              type="button"
              style={{
                ...styles.modeBtn,
                ...(mapping.amountMode === 'debit_credit' ? styles.modeBtnActive : {}),
              }}
              onClick={() => handleFieldChange('amountMode', 'debit_credit')}
            >
              עמודות נפרדות (חובה / זכות)
            </button>
          </div>
        </div>

        {/* Card 2: Bulk Card Assignment */}
        <div style={styles.configCard}>
          <div style={styles.configCardHeader}>
            <div style={{ ...styles.configIconWrap, backgroundColor: 'rgba(79, 70, 229, 0.12)' }}>
              <CreditCard size={16} color="var(--primary)" />
            </div>
            <div>
              <div style={styles.configTitle}>
                הגדרת שם כרטיס אחיד לכל הקובץ (Bulk Card Name)
              </div>
              <div style={styles.configDesc}>
                אם כל השורות בקובץ שייכות לאותו כרטיס (למשל ויזה כאל 1234), הזינו כאן:
              </div>
            </div>
          </div>

          <div style={styles.bulkCardInputRow}>
            <input
              type="text"
              style={styles.bulkTextInput}
              placeholder="לדוגמה: כרטיס ויזה כאל 5678, מאסטרקארד זהב..."
              value={mapping.bulkPaymentMethod || ''}
              onChange={(e) => handleFieldChange('bulkPaymentMethod', e.target.value)}
            />
            {mapping.bulkPaymentMethod && (
              <button
                type="button"
                style={styles.clearBulkBtn}
                onClick={() => handleFieldChange('bulkPaymentMethod', '')}
              >
                נקה
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Section 1: Core 7 Mandatory & Essential Transaction Fields */}
      <div style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="var(--primary)" />
            <span style={styles.sectionTitle}>שדות התנועה המרכזיים (Core Transaction Fields)</span>
          </div>
          <span style={styles.requiredPill}>שדות מומלצים וחובה</span>
        </div>

        <div style={styles.fieldsGrid}>
          {/* 1. Payee / Merchant Name */}
          <div style={styles.fieldCard}>
            <div style={styles.fieldTop}>
              <div style={{ ...styles.fieldIconBox, backgroundColor: 'rgba(16, 185, 129, 0.12)' }}>
                <Store size={16} color="#10B981" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.fieldLabel}>
                  1. שם בית עסק / ספק (Payee) <span style={{ color: 'var(--danger)' }}>*</span>
                </div>
                <div style={styles.fieldHelper}>שם העסק המשמש לסיווג אוטומטי של קטגוריה</div>
              </div>
            </div>

            <select
              style={styles.fieldSelect}
              value={mapping.payeeColumn}
              onChange={(e) => handleFieldChange('payeeColumn', e.target.value)}
            >
              <option value="">-- בחר עמודת בית עסק / ספק --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h} {sampleRow[h] !== undefined ? `(לדוגמה: "${sampleRow[h]}")` : ''}
                </option>
              ))}
            </select>

            {mapping.payeeColumn && (
              <div style={styles.samplePreview}>
                ערך לדוגמה: <strong>{String(sampleRow[mapping.payeeColumn] ?? '(ריק)')}</strong>
              </div>
            )}
          </div>

          {/* 2. Transaction Date (תאריך עסקה) */}
          <div style={styles.fieldCard}>
            <div style={styles.fieldTop}>
              <div style={{ ...styles.fieldIconBox, backgroundColor: 'rgba(79, 70, 229, 0.12)' }}>
                <Calendar size={16} color="var(--primary)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.fieldLabel}>
                  2. תאריך ביצוע העסקה (Transaction Date) <span style={{ color: 'var(--danger)' }}>*</span>
                </div>
                <div style={styles.fieldHelper}>מועד ביצוע הרכישה בפועל</div>
              </div>
            </div>

            <select
              style={styles.fieldSelect}
              value={mapping.dateColumn}
              onChange={(e) => handleFieldChange('dateColumn', e.target.value)}
            >
              <option value="">-- בחר עמודת תאריך עסקה --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h} {sampleRow[h] !== undefined ? `(לדוגמה: "${sampleRow[h]}")` : ''}
                </option>
              ))}
            </select>

            {mapping.dateColumn && (
              <div style={styles.samplePreview}>
                ערך לדוגמה: <strong>{String(sampleRow[mapping.dateColumn] ?? '(ריק)')}</strong>
              </div>
            )}
          </div>

          {/* 3. Billing Date / Month (תאריך חיוב / מועד הצגה) */}
          <div style={styles.fieldCard}>
            <div style={styles.fieldTop}>
              <div style={{ ...styles.fieldIconBox, backgroundColor: 'rgba(14, 165, 233, 0.12)' }}>
                <Calendar size={16} color="#0EA5E9" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.fieldLabel}>
                  3. תאריך חיוב / מועד הצגת ההוצאה (Billing Date)
                </div>
                <div style={styles.fieldHelper}>מועד החיוב בחשבון הבנק / מחזור התקציב החודשי</div>
              </div>
            </div>

            <select
              style={styles.fieldSelect}
              value={mapping.billingDateColumn || ''}
              onChange={(e) => handleFieldChange('billingDateColumn', e.target.value)}
            >
              <option value="">-- זהה לתאריך העסקה / בחר עמודה --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h} {sampleRow[h] !== undefined ? `(לדוגמה: "${sampleRow[h]}")` : ''}
                </option>
              ))}
            </select>

            {mapping.billingDateColumn && (
              <div style={styles.samplePreview}>
                ערך לדוגמה: <strong>{String(sampleRow[mapping.billingDateColumn] ?? '(ריק)')}</strong>
              </div>
            )}
          </div>

          {/* 4. Billing Amount (סכום חיוב בפועל במטבע משק הבית) */}
          {mapping.amountMode === 'single' ? (
            <div style={styles.fieldCard}>
              <div style={styles.fieldTop}>
                <div style={{ ...styles.fieldIconBox, backgroundColor: 'rgba(245, 158, 11, 0.12)' }}>
                  <DollarSign size={16} color="#F59E0B" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={styles.fieldLabel}>
                    4. סכום החיוב לתשלום בפועל (Billing Amount) <span style={{ color: 'var(--danger)' }}>*</span>
                  </div>
                  <div style={styles.fieldHelper}>הסכום שחויב בפועל במטבע משק הבית (למשל ₪)</div>
                </div>
              </div>

              <select
                style={styles.fieldSelect}
                value={mapping.amountColumn}
                onChange={(e) => handleFieldChange('amountColumn', e.target.value)}
              >
                <option value="">-- בחר עמודת סכום חיוב --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h} {sampleRow[h] !== undefined ? `(לדוגמה: "${sampleRow[h]}")` : ''}
                  </option>
                ))}
              </select>

              {mapping.amountColumn && (
                <div style={styles.samplePreview}>
                  ערך לדוגמה: <strong>{String(sampleRow[mapping.amountColumn] ?? '(ריק)')}</strong>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Debit Column */}
              <div style={styles.fieldCard}>
                <div style={styles.fieldTop}>
                  <div style={{ ...styles.fieldIconBox, backgroundColor: 'rgba(239, 68, 68, 0.12)' }}>
                    <DollarSign size={16} color="#EF4444" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={styles.fieldLabel}>4.א. עמודת חובה / חיוב (Debit Outflow)</div>
                    <div style={styles.fieldHelper}>סכום הוצאה / משיכה</div>
                  </div>
                </div>

                <select
                  style={styles.fieldSelect}
                  value={mapping.debitColumn || ''}
                  onChange={(e) => handleFieldChange('debitColumn', e.target.value)}
                >
                  <option value="">-- בחר עמודת חובה / חיוב --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h} {sampleRow[h] !== undefined ? `(לדוגמה: "${sampleRow[h]}")` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Credit Column */}
              <div style={styles.fieldCard}>
                <div style={styles.fieldTop}>
                  <div style={{ ...styles.fieldIconBox, backgroundColor: 'rgba(16, 185, 129, 0.12)' }}>
                    <DollarSign size={16} color="#10B981" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={styles.fieldLabel}>4.ב. עמודת זכות / הכנסה (Credit Inflow)</div>
                    <div style={styles.fieldHelper}>סכום זיכוי / הפקדה</div>
                  </div>
                </div>

                <select
                  style={styles.fieldSelect}
                  value={mapping.creditColumn || ''}
                  onChange={(e) => handleFieldChange('creditColumn', e.target.value)}
                >
                  <option value="">-- בחר עמודת זכות / הכנסה --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h} {sampleRow[h] !== undefined ? `(לדוגמה: "${sampleRow[h]}")` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* 5. Original Transaction Amount (סכום עסקה מקורי) */}
          <div style={styles.fieldCard}>
            <div style={styles.fieldTop}>
              <div style={{ ...styles.fieldIconBox, backgroundColor: 'rgba(139, 92, 246, 0.12)' }}>
                <DollarSign size={16} color="#8B5CF6" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.fieldLabel}>5. סכום עסקה מקורי (Original Amount)</div>
                <div style={styles.fieldHelper}>סכום העסקה המקורי ברכישות במטבע חוץ או בחו"ל</div>
              </div>
            </div>

            <select
              style={styles.fieldSelect}
              value={mapping.originalAmountColumn || ''}
              onChange={(e) => handleFieldChange('originalAmountColumn', e.target.value)}
            >
              <option value="">-- זהה לסכום החיוב / בחר עמודה --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h} {sampleRow[h] !== undefined ? `(לדוגמה: "${sampleRow[h]}")` : ''}
                </option>
              ))}
            </select>

            {mapping.originalAmountColumn && (
              <div style={styles.samplePreview}>
                ערך לדוגמה: <strong>{String(sampleRow[mapping.originalAmountColumn] ?? '(ריק)')}</strong>
              </div>
            )}
          </div>

          {/* 6. Original Currency (מטבע מקורי) */}
          <div style={styles.fieldCard}>
            <div style={styles.fieldTop}>
              <div style={{ ...styles.fieldIconBox, backgroundColor: 'rgba(6, 182, 212, 0.12)' }}>
                <Globe size={16} color="#06B6D4" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.fieldLabel}>6. מטבע עסקה מקורי (Original Currency)</div>
                <div style={styles.fieldHelper}>עמודת מטבע (USD, EUR, ILS...) או ברירת מחדל</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                style={{ ...styles.fieldSelect, flex: 2 }}
                value={mapping.originalCurrencyColumn || ''}
                onChange={(e) => handleFieldChange('originalCurrencyColumn', e.target.value)}
              >
                <option value="">-- עמודת מטבע מהדוח --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h} {sampleRow[h] !== undefined ? `(לדוגמה: "${sampleRow[h]}")` : ''}
                  </option>
                ))}
              </select>

              <select
                style={{ ...styles.fieldSelect, flex: 1 }}
                value={mapping.defaultOriginalCurrency || 'ILS'}
                onChange={(e) => handleFieldChange('defaultOriginalCurrency', e.target.value)}
                title="ברירת מחדל אם העמודה ריקה"
              >
                <option value="ILS">₪ ILS</option>
                <option value="USD">$ USD</option>
                <option value="EUR">€ EUR</option>
                <option value="GBP">£ GBP</option>
              </select>
            </div>

            {mapping.originalCurrencyColumn && (
              <div style={styles.samplePreview}>
                ערך לדוגמה: <strong>{String(sampleRow[mapping.originalCurrencyColumn] ?? '(ריק)')}</strong>
              </div>
            )}
          </div>

          {/* 7. Card Name / Payment Method (עמודת שם כרטיס) */}
          <div style={styles.fieldCard}>
            <div style={styles.fieldTop}>
              <div style={{ ...styles.fieldIconBox, backgroundColor: 'rgba(99, 102, 241, 0.12)' }}>
                <CreditCard size={16} color="#6366F1" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.fieldLabel}>7. שם כרטיס / אמצעי תשלום (Card Name)</div>
                <div style={styles.fieldHelper}>עמודת שם הכרטיס או סוג התשלום בדוח</div>
              </div>
            </div>

            <select
              style={styles.fieldSelect}
              value={mapping.paymentMethodColumn || ''}
              onChange={(e) => handleFieldChange('paymentMethodColumn', e.target.value)}
            >
              <option value="">-- ללא עמודה / השתמש בהגדרה גורפת --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h} {sampleRow[h] !== undefined ? `(לדוגמה: "${sampleRow[h]}")` : ''}
                </option>
              ))}
            </select>

            {mapping.paymentMethodColumn && (
              <div style={styles.samplePreview}>
                ערך לדוגמה: <strong>{String(sampleRow[mapping.paymentMethodColumn] ?? '(ריק)')}</strong>
              </div>
            )}
          </div>

          {/* 8. Remarks & Notes (הערות ופירוט נוסף) */}
          <div style={styles.fieldCard}>
            <div style={styles.fieldTop}>
              <div style={{ ...styles.fieldIconBox, backgroundColor: 'rgba(100, 116, 139, 0.12)' }}>
                <FileText size={16} color="#64748B" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.fieldLabel}>8. הערות ופירוט נוסף (Remarks / Notes)</div>
                <div style={styles.fieldHelper}>הערות, מידע נוסף או פירוט מהדוח</div>
              </div>
            </div>

            <select
              style={styles.fieldSelect}
              value={mapping.notesColumn || ''}
              onChange={(e) => handleFieldChange('notesColumn', e.target.value)}
            >
              <option value="">-- ללא עמודת הערות --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h} {sampleRow[h] !== undefined ? `(לדוגמה: "${sampleRow[h]}")` : ''}
                </option>
              ))}
            </select>

            {mapping.notesColumn && (
              <div style={styles.samplePreview}>
                ערך לדוגמה: <strong>{String(sampleRow[mapping.notesColumn] ?? '(ריק)')}</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Optional Metadata Fields */}
      <div style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tag size={18} color="var(--text-secondary)" />
            <span style={styles.sectionTitle}>שדות מטא-דאטה נוספים (Optional Metadata)</span>
          </div>
          <span style={styles.optionalPill}>אופציונלי</span>
        </div>

        <div style={styles.fieldsGrid}>
          {/* Card Last 4 Digits */}
          <div style={styles.fieldCard}>
            <div style={styles.fieldTop}>
              <div style={styles.fieldIconBox}>
                <Hash size={16} color="var(--primary)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.fieldLabel}>4 ספרות אחרונות של הכרטיס (Last 4 Digits)</div>
                <div style={styles.fieldHelper}>למשל 7520, 2285</div>
              </div>
            </div>

            <select
              style={styles.fieldSelect}
              value={mapping.cardDigitsColumn || ''}
              onChange={(e) => handleFieldChange('cardDigitsColumn', e.target.value)}
            >
              <option value="">-- זיהוי אוטומטי / ללא עמודה --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h} {sampleRow[h] !== undefined ? `(לדוגמה: "${sampleRow[h]}")` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Reference / Voucher Number */}
          <div style={styles.fieldCard}>
            <div style={styles.fieldTop}>
              <div style={styles.fieldIconBox}>
                <Receipt size={16} color="var(--primary)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.fieldLabel}>מספר שובר / אסמכתא (Voucher / Ref)</div>
                <div style={styles.fieldHelper}>מספר שובר עסקה או אסמכתא בנקאית</div>
              </div>
            </div>

            <select
              style={styles.fieldSelect}
              value={mapping.referenceColumn || ''}
              onChange={(e) => handleFieldChange('referenceColumn', e.target.value)}
            >
              <option value="">-- ללא עמודת שובר --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h} {sampleRow[h] !== undefined ? `(לדוגמה: "${sampleRow[h]}")` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Statement Category / Industry */}
          <div style={styles.fieldCard}>
            <div style={styles.fieldTop}>
              <div style={styles.fieldIconBox}>
                <Tag size={16} color="var(--primary)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.fieldLabel}>ענף / קטגוריה מקורית בדוח (Industry / Category)</div>
                <div style={styles.fieldHelper}>סיווג הענף של חברת האשראי (למשל: סופרמרקטים, דלק)</div>
              </div>
            </div>

            <select
              style={styles.fieldSelect}
              value={mapping.categoryColumn || ''}
              onChange={(e) => handleFieldChange('categoryColumn', e.target.value)}
            >
              <option value="">-- ללא עמודה / השתמש בחוקי סיווג --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h} {sampleRow[h] !== undefined ? `(לדוגמה: "${sampleRow[h]}")` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Validation Status Indicator */}
      <div style={styles.statusFooter}>
        {isFormValid ? (
          <div style={styles.successStatus}>
            <CheckCircle2 size={18} color="#10B981" />
            <span>כל שדות החובה מופו בהצלחה! ניתן להמשיך לשלב התצוגה המקדימה.</span>
          </div>
        ) : (
          <div style={styles.warningStatus}>
            <AlertCircle size={18} color="#F59E0B" />
            <span>אנא ודאו ששדות החובה (בית עסק, תאריך עסקה, וסכום) מופו כראוי.</span>
          </div>
        )}
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
  stepBadge: {
    display: 'inline-block',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--primary)',
    backgroundColor: 'var(--primary-light)',
    padding: '3px 10px',
    borderRadius: '12px',
    marginBottom: '8px',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: '0 0 4px 0',
  },
  subtitle: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    margin: 0,
    lineHeight: 1.4,
  },
  topConfigGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '14px',
  },
  configCard: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-main)',
    borderRadius: 'var(--radius-md)',
    padding: '16px',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '12px',
  },
  configCardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
  },
  configIconWrap: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    backgroundColor: 'var(--primary-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  configTitle: {
    fontSize: '0.875rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  configDesc: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  modeButtonGroup: {
    display: 'flex',
    backgroundColor: 'var(--bg-surface-subtle)',
    padding: '4px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-main)',
    gap: '4px',
  },
  modeBtn: {
    flex: 1,
    padding: '8px 12px',
    fontSize: '0.75rem',
    fontWeight: '700',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  modeBtnActive: {
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    boxShadow: 'var(--shadow-sm)',
  },
  bulkCardInputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  bulkTextInput: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-main)',
    backgroundColor: 'var(--bg-surface-subtle)',
    color: 'var(--text-primary)',
    fontSize: '0.8125rem',
    outline: 'none',
    fontFamily: 'inherit',
  },
  clearBulkBtn: {
    padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-main)',
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--danger)',
    fontSize: '0.75rem',
    fontWeight: '700',
    cursor: 'pointer',
  },
  sectionCard: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-main)',
    borderRadius: 'var(--radius-lg)',
    padding: '18px 20px',
    boxShadow: 'var(--shadow-sm)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
    borderBottom: '1px solid var(--border-main)',
    paddingBottom: '10px',
  },
  sectionTitle: {
    fontSize: '0.9375rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  requiredPill: {
    fontSize: '0.6875rem',
    fontWeight: '800',
    color: 'var(--primary)',
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    padding: '2px 8px',
    borderRadius: '12px',
    border: '1px solid rgba(79, 70, 229, 0.2)',
  },
  optionalPill: {
    fontSize: '0.6875rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    backgroundColor: 'var(--bg-surface-subtle)',
    padding: '2px 8px',
    borderRadius: '12px',
    border: '1px solid var(--border-main)',
  },
  fieldsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '14px',
  },
  fieldCard: {
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
    borderRadius: 'var(--radius-md)',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    transition: 'border-color 0.15s ease',
  },
  fieldTop: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
  },
  fieldIconBox: {
    width: '30px',
    height: '30px',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-main)',
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
    marginTop: '2px',
    lineHeight: 1.3,
  },
  fieldSelect: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-main)',
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    outline: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  samplePreview: {
    fontSize: '0.6875rem',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-surface)',
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid var(--border-main)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  statusFooter: {
    marginTop: '4px',
  },
  successStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    color: '#065F46',
    fontSize: '0.8125rem',
    fontWeight: '600',
    border: '1px solid rgba(16, 185, 129, 0.3)',
  },
  warningStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    color: '#92400E',
    fontSize: '0.8125rem',
    fontWeight: '600',
    border: '1px solid rgba(245, 158, 11, 0.3)',
  },
};
