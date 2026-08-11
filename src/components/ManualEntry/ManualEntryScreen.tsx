import React, { useState } from 'react';
import {
  PlusCircle,
  TrendingDown,
  TrendingUp,
  PiggyBank,
  Calendar,
  DollarSign,
  Tag,
  Store,
  CreditCard,
  FileText,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { t, formatCategoryName } from '../../lib/i18n';
import { ManualEntryFormData, Category } from '../../lib/types';
import { createManualTransaction } from '../../lib/services/manualEntryService';
import { HistoricalDataModal } from './HistoricalDataModal';

export const ManualEntryScreen: React.FC = () => {
  const {
    activeHousehold,
    categories,
    businessMappings,
    cardMappings,
    setActiveTab,
    addTransaction,
    isDemoMode,
    showHiddenNotice,
    language,
    dir,
  } = useAuth();

  const currencySymbol = activeHousehold?.currency === 'ILS' ? '₪' : activeHousehold?.currency || '$';
  const todayStr = new Date().toISOString().split('T')[0];

  // Form State
  const [formData, setFormData] = useState<ManualEntryFormData>({
    date: todayStr,
    amount: '',
    transaction_type: 'expense',
    category_id: '',
    payee_name: '',
    payment_method: 'credit_card',
    card_last_digits: '',
    notes: '',
    is_hidden: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isHistoricalModalOpen, setIsHistoricalModalOpen] = useState(false);

  // Live Auto-Mapping detector
  const detectedRule = formData.payee_name
    ? businessMappings.find((rule) =>
        formData.payee_name.toUpperCase().includes(rule.pattern.toUpperCase())
      )
    : null;

  const detectedCategory = detectedRule
    ? categories.find((c) => c.id === detectedRule.category_id)
    : null;

  // Filter categories by selected transaction type
  const targetCategoryType = formData.transaction_type === 'income' ? 'income' : 'expense';
  const filteredCategories = categories.filter((c) => c.type === targetCategoryType);

  const handleFieldChange = (field: keyof ManualEntryFormData, value: any) => {
    setFormData((prev) => {
      const updated = {
        ...prev,
        [field]: value,
      };

      if (field === 'payee_name' && typeof value === 'string') {
        const match = businessMappings.find((rule) =>
          value.toUpperCase().includes(rule.pattern.toUpperCase())
        );
        if (match) {
          updated.category_id = match.category_id;
        }
      }

      return updated;
    });
    setErrorMsg(null);
  };

  // Preset Template loader
  const applyPreset = (preset: {
    payee: string;
    amount: string;
    type: 'expense' | 'income' | 'savings';
    categoryNameKw: string;
    method: string;
    digits?: string;
  }) => {
    const matchedCat = categories.find((c) =>
      c.name.toLowerCase().includes(preset.categoryNameKw.toLowerCase())
    );

    setFormData({
      date: todayStr,
      amount: preset.amount,
      transaction_type: preset.type,
      category_id: matchedCat?.id || '',
      payee_name: preset.payee,
      payment_method: preset.method,
      card_last_digits: preset.digits || '',
      notes: '',
      is_hidden: false,
    });
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHousehold) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      const res = await createManualTransaction(
        activeHousehold.id,
        formData,
        categories,
        isDemoMode
      );

      if (!res.success || !res.transaction) {
        throw new Error(res.error || (language === 'he' ? 'שגיאה בשמירת התנועה' : 'Failed to save manual transaction'));
      }

      // Add to local state
      addTransaction(res.transaction);

      setSuccessMsg(
        language === 'he'
          ? `תנועה בסך ${currencySymbol}${parseFloat(formData.amount).toLocaleString('en-US', {
              minimumFractionDigits: 2,
            })} עבור "${formData.payee_name}" נרשמה בהצלחה!`
          : `Transaction of ${currencySymbol}${parseFloat(formData.amount).toLocaleString('en-US', {
              minimumFractionDigits: 2,
            })} for "${formData.payee_name}" recorded successfully!`
      );

      // Reset form
      setFormData({
        date: todayStr,
        amount: '',
        transaction_type: formData.transaction_type,
        category_id: '',
        payee_name: '',
        payment_method: formData.payment_method,
        card_last_digits: formData.card_last_digits,
        notes: '',
        is_hidden: false,
      });
    } catch (err: any) {
      setErrorMsg(err.message || (language === 'he' ? 'שגיאה בשמירת התנועה' : 'An error occurred while saving the transaction'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.container} className="animate-fade-in">
      {/* Header & Quick Action */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>
            {language === 'he' ? 'הזנת תנועה ידנית מהירה' : 'Manual Transaction Entry'}
          </h2>
          <p style={styles.subtitle}>
            {language === 'he'
              ? 'רישום מיידי של הוצאה, הכנסה או הפקדה לחיסכון ישירות לספר החשבונות של משק הבית.'
              : 'Quickly log everyday expenses, income receipts, or savings deposits into your household ledger.'}
          </p>
        </div>

        {/* Historical Aggregated Ingestion Trigger */}
        <button
          style={styles.historicalBtn}
          onClick={() => setIsHistoricalModalOpen(true)}
        >
          <FileSpreadsheet size={15} color="var(--primary)" />
          <span>
            {language === 'he' ? 'שחזור קובץ שנתי (טבלה)' : 'Historical Summary Ingestion'}
          </span>
        </button>
      </div>

      {/* Quick 1-Click Preset Pills */}
      <div style={styles.presetsCard}>
        <div style={styles.presetsHeader}>
          <Sparkles size={14} color="var(--primary)" />
          <span style={styles.presetsTitle}>
            {language === 'he' ? 'תבניות מהירות בלחיצה אחת:' : 'Quick Templates:'}
          </span>
        </div>
        <div style={styles.presetsRow}>
          <button
            style={styles.presetPill}
            onClick={() =>
              applyPreset({
                payee: 'שופרסל דיל',
                amount: '450.00',
                type: 'expense',
                categoryNameKw: 'מזון',
                method: 'credit_card',
                digits: '2285',
              })
            }
          >
            🛒 {language === 'he' ? 'סופרמרקט (₪450)' : 'Supermarket (₪450)'}
          </button>
          <button
            style={styles.presetPill}
            onClick={() =>
              applyPreset({
                payee: 'תחנת דלק פז',
                amount: '320.00',
                type: 'expense',
                categoryNameKw: 'דלק',
                method: 'credit_card',
                digits: '2285',
              })
            }
          >
            ⛽ {language === 'he' ? 'דלק ונסיעות (₪320)' : 'Fuel / Gas (₪320)'}
          </button>
          <button
            style={styles.presetPill}
            onClick={() =>
              applyPreset({
                payee: 'סופר-פארם דיזנגוף',
                amount: '145.00',
                type: 'expense',
                categoryNameKw: 'פארם',
                method: 'credit_card',
                digits: '2285',
              })
            }
          >
            💊 {language === 'he' ? 'סופר-פארם (₪145)' : 'Super-Pharm (₪145)'}
          </button>
          <button
            style={styles.presetPill}
            onClick={() =>
              applyPreset({
                payee: 'משכורת חודשית',
                amount: '24500.00',
                type: 'income',
                categoryNameKw: 'משכורת',
                method: 'bank_transfer',
              })
            }
          >
            💼 {language === 'he' ? 'משכורת חודשית (₪24.5k)' : 'Main Salary (₪24.5k)'}
          </button>
          <button
            style={styles.presetPill}
            onClick={() =>
              applyPreset({
                payee: 'מיטב דש - קופת גמל להשקעה',
                amount: '2500.00',
                type: 'savings',
                categoryNameKw: 'חיסכון',
                method: 'direct_debit',
              })
            }
          >
            🏦 {language === 'he' ? 'הפקדה לחיסכון (₪2,500)' : 'Savings Deposit (₪2,500)'}
          </button>
        </div>
      </div>

      {/* Main Entry Form Card */}
      <div style={styles.formCard}>
        {/* Success Alert Banner */}
        {successMsg && (
          <div style={styles.successBanner} className="animate-fade-in">
            <CheckCircle2 size={20} color="var(--success-text)" />
            <div style={{ flex: 1 }}>
              <div style={styles.successTitle}>Transaction Recorded!</div>
              <div style={styles.successDesc}>{successMsg}</div>
            </div>
            <div style={styles.successActions}>
              <button
                style={styles.successLinkBtn}
                onClick={() => setActiveTab('transactions')}
              >
                View Ledger
              </button>
              <button
                style={styles.successLinkBtn}
                onClick={() => setActiveTab('dashboard')}
              >
                Dashboard
              </button>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div style={styles.errorBanner}>
            <AlertCircle size={18} color="var(--danger-text)" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form} dir={dir}>
          {/* 1. Transaction Type Segmented Toggle */}
          <div style={styles.typeSelectorRow}>
            <label style={styles.fieldLabel}>
              {language === 'he' ? 'סוג תנועה' : 'Transaction Type'}
            </label>
            <div style={styles.segmentedGroup}>
              {/* Expense Option */}
              <button
                type="button"
                style={{
                  ...styles.segmentBtn,
                  ...(formData.transaction_type === 'expense' ? styles.segmentBtnExpenseActive : {}),
                }}
                onClick={() => {
                  handleFieldChange('transaction_type', 'expense');
                  if (formData.payment_method === 'bank_transfer') {
                    handleFieldChange('payment_method', 'credit_card');
                  }
                }}
              >
                <TrendingDown size={16} />
                <span>{language === 'he' ? 'הוצאה' : 'Expense'}</span>
              </button>

              {/* Income Option */}
              <button
                type="button"
                style={{
                  ...styles.segmentBtn,
                  ...(formData.transaction_type === 'income' ? styles.segmentBtnIncomeActive : {}),
                }}
                onClick={() => {
                  handleFieldChange('transaction_type', 'income');
                  if (formData.payment_method === 'credit_card') {
                    handleFieldChange('payment_method', 'bank_transfer');
                  }
                  handleFieldChange('card_last_digits', '');
                }}
              >
                <TrendingUp size={16} />
                <span>{language === 'he' ? 'הכנסה' : 'Income'}</span>
              </button>

              {/* Savings Deposit Option */}
              <button
                type="button"
                style={{
                  ...styles.segmentBtn,
                  ...(formData.transaction_type === 'savings' ? styles.segmentBtnSavingsActive : {}),
                }}
                onClick={() => {
                  handleFieldChange('transaction_type', 'savings');
                  if (formData.payment_method === 'credit_card') {
                    handleFieldChange('payment_method', 'bank_transfer');
                  }
                  handleFieldChange('card_last_digits', '');
                }}
              >
                <PiggyBank size={16} />
                <span>{language === 'he' ? 'הפקדה לחיסכון' : 'Savings Deposit'}</span>
              </button>
            </div>
          </div>

          {/* 2. Amount & Date Row */}
          <div style={styles.formRow}>
            {/* Amount Field */}
            <div style={{ flex: 1.2, ...styles.formGroup }}>
              <label style={styles.fieldLabel}>
                {language === 'he' ? `סכום (${currencySymbol})` : `Amount (${currencySymbol})`}{' '}
                <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div style={styles.inputWrapper}>
                <span style={styles.inputPrefix}>{currencySymbol}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  style={styles.amountInput}
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => handleFieldChange('amount', e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Date Field */}
            <div style={{ flex: 1, ...styles.formGroup }}>
              <label style={styles.fieldLabel}>
                {language === 'he' ? 'תאריך תנועה' : 'Transaction Date'}{' '}
                <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div style={styles.inputWrapper}>
                <Calendar size={16} color="var(--text-secondary)" style={{ marginLeft: '10px' }} />
                <input
                  type="date"
                  style={styles.textInput}
                  value={formData.date}
                  onChange={(e) => handleFieldChange('date', e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* 3. Payee & Category Row */}
          <div style={styles.formRow}>
            {/* Payee / Description Field */}
            <div style={{ flex: 1.3, ...styles.formGroup }}>
              <label style={styles.fieldLabel}>
                {language === 'he' ? 'שם בית עסק / מוטב / תיאור' : 'Payee / Business / Description'}{' '}
                <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div style={styles.inputWrapper}>
                <Store size={16} color="var(--text-secondary)" style={{ marginLeft: '10px' }} />
                <input
                  type="text"
                  style={styles.textInput}
                  placeholder={
                    language === 'he'
                      ? 'לדוגמה: שופרסל דיל, פז, שכירות...'
                      : 'e.g. Shufersal Deal, Paz, Landlord Rent...'
                  }
                  value={formData.payee_name}
                  onChange={(e) => handleFieldChange('payee_name', e.target.value)}
                  required
                />
              </div>
              {detectedCategory && (
                <div style={styles.autoDetectedPill}>
                  <Sparkles size={13} color="var(--primary)" />
                  <span>
                    {language === 'he' ? 'זוהה סיווג אוטומטי לפי הכלל ' : 'Auto-matched rule for '}
                    "{detectedRule?.pattern}": <strong>{formatCategoryName(detectedCategory.name, language)}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Category Dropdown */}
            <div style={{ flex: 1.1, ...styles.formGroup }}>
              <label style={styles.fieldLabel}>
                {language === 'he'
                  ? formData.transaction_type === 'income' ? 'סוג הכנסה (קטגוריה)' : formData.transaction_type === 'savings' ? 'יעד חיסכון / קטגוריה' : 'סוג הוצאה (קטגוריה)'
                  : 'Category'}
              </label>
              <div style={styles.inputWrapper}>
                <Tag size={16} color="var(--text-secondary)" style={{ marginLeft: '10px' }} />
                <select
                  style={styles.selectInput}
                  value={formData.category_id}
                  onChange={(e) => handleFieldChange('category_id', e.target.value)}
                >
                  <option value="">
                    {language === 'he' ? '-- בחר סוג סיווג --' : '-- Select Category --'}
                  </option>
                  {filteredCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatCategoryName(c.name, language)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 4. Payment Method & Card Digits Row */}
          <div style={styles.formRow}>
            <div style={{ flex: 1.2, ...styles.formGroup }}>
              <label style={styles.fieldLabel}>
                {language === 'he'
                  ? formData.transaction_type === 'income' ? 'אופן קבלת התשלום / חשבון יעד' : 'אמצעי תשלום'
                  : formData.transaction_type === 'income' ? 'Receiving Method / Account' : 'Payment Method'}
              </label>
              <div style={styles.inputWrapper}>
                <CreditCard size={16} color="var(--text-secondary)" style={{ marginLeft: '10px' }} />
                <select
                  style={styles.selectInput}
                  value={formData.payment_method}
                  onChange={(e) => handleFieldChange('payment_method', e.target.value)}
                >
                  {formData.transaction_type === 'income' ? (
                    <>
                      <option value="bank_transfer">
                        {language === 'he' ? '🏦 העברה לחשבון בנק' : '🏦 Bank Transfer / Direct Deposit'}
                      </option>
                      <option value="app_payment">
                        {language === 'he' ? '📱 Bit / Paybox / אפליקציה' : '📱 Bit / Paybox / App'}
                      </option>
                      <option value="check">
                        {language === 'he' ? '📑 המחאה (צ\'ק)' : '📑 Check'}
                      </option>
                      <option value="cash">
                        {language === 'he' ? '💵 מזומן' : '💵 Cash'}
                      </option>
                      <option value="other">
                        {language === 'he' ? '🔘 אחר' : '🔘 Other'}
                      </option>
                    </>
                  ) : (
                    <>
                      <option value="credit_card">
                        {language === 'he' ? '💳 כרטיס אשראי' : '💳 Credit Card'}
                      </option>
                      {cardMappings && cardMappings.length > 0 && cardMappings.map((cm) => (
                        <option key={cm.id} value={cm.raw_pattern || cm.display_name}>
                          {cm.display_name} {cm.card_last_digits ? `(•••• ${cm.card_last_digits})` : ''}
                        </option>
                      ))}
                      <option value="bank_transfer">
                        {language === 'he' ? '🏦 העברה בנקאית' : '🏦 Bank Transfer'}
                      </option>
                      <option value="direct_debit">
                        {language === 'he' ? '🔄 הוראת קבע' : '🔄 Direct Debit / Standing Order'}
                      </option>
                      <option value="cash">
                        {language === 'he' ? '💵 מזומן' : '💵 Cash'}
                      </option>
                      <option value="check">
                        {language === 'he' ? '📑 המחאה (צ\'ק)' : '📑 Check'}
                      </option>
                      <option value="app_payment">
                        {language === 'he' ? '📱 Bit / Paybox / אפליקציה' : '📱 Bit / Paybox / App'}
                      </option>
                      <option value="other">
                        {language === 'he' ? '🔘 אחר' : '🔘 Other'}
                      </option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {formData.transaction_type !== 'income' && formData.payment_method === 'credit_card' && (
              <div style={{ flex: 0.8, ...styles.formGroup }}>
                <label style={styles.fieldLabel}>
                  {language === 'he' ? '4 ספרות כרטיס אחרונות' : 'Card Last 4 Digits'}
                </label>
                <input
                  type="text"
                  maxLength={4}
                  style={styles.plainInput}
                  placeholder={language === 'he' ? 'לדוגמה: 2285' : 'e.g. 2285'}
                  value={formData.card_last_digits || ''}
                  onChange={(e) => handleFieldChange('card_last_digits', e.target.value)}
                />
              </div>
            )}
          </div>

          {/* 5. Notes / Memo */}
          <div style={styles.formGroup}>
            <label style={styles.fieldLabel}>
              {language === 'he' ? 'הערות / אסמכתא (אופציונלי)' : 'Notes / Reference (Optional)'}
            </label>
            <div style={styles.inputWrapper}>
              <FileText size={16} color="var(--text-secondary)" style={{ marginLeft: '10px' }} />
              <input
                type="text"
                style={styles.textInput}
                placeholder={
                  language === 'he'
                    ? 'הערות נוספות, מספר חשבונית או פירוט...'
                    : 'Additional details, invoice number, or memo...'
                }
                value={formData.notes || ''}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
              />
            </div>
          </div>

          {/* 6. Soft Delete / Hide Flag Toggle (Only shown if enabled in settings) */}
          {showHiddenNotice && (
            <div style={styles.hideCheckboxRow}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  style={styles.checkbox}
                  checked={Boolean(formData.is_hidden)}
                  onChange={(e) => handleFieldChange('is_hidden', e.target.checked)}
                />
                <span style={styles.checkboxText}>
                  {language === 'he'
                    ? 'שמור כתנועה מוסתרת (לא תיכלל בחישובי התקציב החודשי)'
                    : 'Save as Hidden (Soft-Delete) — Excludes from active monthly budgets'}
                </span>
              </label>
            </div>
          )}

          {/* Submit Action Buttons */}
          <div style={styles.formActions}>
            <button
              type="button"
              style={styles.resetBtn}
              onClick={() =>
                setFormData({
                  date: todayStr,
                  amount: '',
                  transaction_type: 'expense',
                  category_id: '',
                  payee_name: '',
                  payment_method: 'credit_card',
                  card_last_digits: '',
                  notes: '',
                  is_hidden: false,
                })
              }
            >
              <RefreshCw size={14} color="var(--text-secondary)" />
              <span>{language === 'he' ? 'נקה טופס' : 'Clear Form'}</span>
            </button>

            <button
              type="submit"
              style={styles.submitBtn}
              disabled={isSubmitting}
            >
              <PlusCircle size={16} color="#FFFFFF" />
              <span>
                {isSubmitting
                  ? language === 'he' ? 'שומר תנועה...' : 'Saving Transaction...'
                  : language === 'he' ? 'שמור ורשום תנועה' : 'Record Transaction'}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* Historical Data Ingestion Modal */}
      {isHistoricalModalOpen && activeHousehold && (
        <HistoricalDataModal
          householdId={activeHousehold.id}
          categories={categories}
          isDemoMode={isDemoMode}
          onClose={() => setIsHistoricalModalOpen(false)}
          onSuccess={() => {
            setIsHistoricalModalOpen(false);
            setActiveTab('dashboard');
          }}
        />
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    maxWidth: '820px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
  },
  title: {
    fontSize: '1.375rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  },
  historicalBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-main)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--primary)',
    boxShadow: 'var(--shadow-sm)',
  },
  presetsCard: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    padding: '14px 20px',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flexWrap: 'wrap',
  },
  presetsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  presetsTitle: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
  },
  presetsRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    flex: 1,
  },
  presetPill: {
    padding: '6px 12px',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
    borderRadius: '16px',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  formCard: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    padding: '28px',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  successBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '16px 20px',
    backgroundColor: 'var(--success-light)',
    border: '1px solid #A7F3D0',
    borderRadius: 'var(--radius-md)',
    color: 'var(--success-text)',
  },
  successTitle: {
    fontSize: '0.875rem',
    fontWeight: '700',
  },
  successDesc: {
    fontSize: '0.8125rem',
    marginTop: '2px',
  },
  successActions: {
    display: 'flex',
    gap: '8px',
  },
  successLinkBtn: {
    padding: '4px 10px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid #A7F3D0',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--success-text)',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: 'var(--danger-light)',
    border: '1px solid #FECACA',
    borderRadius: 'var(--radius-md)',
    color: 'var(--danger-text)',
    fontSize: '0.8125rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  typeSelectorRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  fieldLabel: {
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  segmentedGroup: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '10px',
  },
  segmentBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-main)',
    backgroundColor: 'var(--bg-surface-subtle)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    transition: 'all 0.15s ease',
    cursor: 'pointer',
  },
  segmentBtnExpenseActive: {
    backgroundColor: '#FEF2F2',
    borderColor: 'var(--danger)',
    color: 'var(--danger-text)',
    fontWeight: '700',
  },
  segmentBtnIncomeActive: {
    backgroundColor: 'var(--success-light)',
    borderColor: 'var(--success)',
    color: 'var(--success-text)',
    fontWeight: '700',
  },
  segmentBtnSavingsActive: {
    backgroundColor: 'var(--primary-light)',
    borderColor: 'var(--primary)',
    color: 'var(--primary)',
    fontWeight: '700',
  },
  formRow: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: '220px',
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
    height: '42px',
  },
  inputPrefix: {
    padding: '0 12px',
    backgroundColor: 'var(--bg-surface-subtle)',
    borderRight: '1px solid var(--border-strong)',
    fontSize: '0.875rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
  },
  amountInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    padding: '0 12px',
    fontSize: '1.0625rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  textInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    padding: '0 10px',
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
  },
  selectInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    padding: '0 10px',
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
    backgroundColor: 'transparent',
    cursor: 'pointer',
  },
  plainInput: {
    height: '42px',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-sm)',
    padding: '0 12px',
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
    outline: 'none',
  },
  hideCheckboxRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 0',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
  },
  checkbox: {
    width: '16px',
    height: '16px',
    accentColor: 'var(--primary)',
    cursor: 'pointer',
  },
  checkboxText: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
  },
  formActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: '16px',
    borderTop: '1px solid var(--border-subtle)',
  },
  resetBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 16px',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '11px 24px',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.875rem',
    fontWeight: '700',
    boxShadow: 'var(--shadow-sm)',
    border: 'none',
    cursor: 'pointer',
  },
  autoDetectedPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '6px',
    padding: '4px 10px',
    backgroundColor: 'var(--primary-light)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.75rem',
    color: 'var(--primary)',
  },
};
