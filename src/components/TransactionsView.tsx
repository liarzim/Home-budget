import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { t, formatCategoryName } from '../lib/i18n';
import { TransactionType } from '../lib/types';
import {
  Plus,
  Search,
  Eye,
  EyeOff,
  CreditCard,
  Archive,
  RefreshCw,
  Sparkles,
  UploadCloud,
  PiggyBank,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

export const TransactionsView: React.FC = () => {
  const {
    transactions,
    categories,
    businessMappings,
    cardMappings,
    activeHousehold,
    setActiveTab,
    toggleTransactionVisibility,
    addTransaction,
    language,
    dir,
  } = useAuth();

  const currency = activeHousehold?.currency === 'ILS' ? '₪' : activeHousehold?.currency || '$';
  const currencySymbol = currency;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [showHidden, setShowHidden] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New Transaction Form State
  const [newPayee, setNewPayee] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<'expense' | 'income' | 'savings'>('expense');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newPaymentMethod, setNewPaymentMethod] = useState('credit_card');
  const [newCardDigits, setNewCardDigits] = useState('2285');
  const [newNotes, setNewNotes] = useState('');
  const [newIsHidden, setNewIsHidden] = useState(false);

  // Live Auto-Mapping detector
  const detectedRule = newPayee
    ? businessMappings.find((rule) =>
        newPayee.toUpperCase().includes(rule.pattern.toUpperCase())
      )
    : null;

  const detectedCategory = detectedRule
    ? categories.find((c) => c.id === detectedRule.category_id)
    : null;

  const handlePayeeChange = (text: string) => {
    setNewPayee(text);
    const match = businessMappings.find((rule) =>
      text.toUpperCase().includes(rule.pattern.toUpperCase())
    );
    if (match) {
      setNewCategoryId(match.category_id);
    }
  };

  const applyModalPreset = (preset: {
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

    setNewPayee(preset.payee);
    setNewAmount(preset.amount);
    setNewType(preset.type);
    setNewCategoryId(matchedCat?.id || '');
    setNewPaymentMethod(preset.method);
    setNewCardDigits(preset.digits || '');
    setNewNotes('');
    setNewIsHidden(false);
  };

  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPayee.trim() || !newAmount) return;
    const parsedAmount = parseFloat(newAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    const isSavings = newType === 'savings';
    const effectiveType: TransactionType = newType === 'income' ? 'income' : 'expense';

    let catId = newCategoryId || (detectedCategory ? detectedCategory.id : null);
    if (isSavings && !catId) {
      const savingsCat = categories.find(
        (c) => c.name.includes('חיסכון') || c.name.toLowerCase().includes('savings')
      );
      if (savingsCat) catId = savingsCat.id;
    }

    const notesText = isSavings
      ? `[Savings Deposit] ${newNotes}`.trim()
      : newNotes || (detectedCategory ? `Auto-mapped by rule: ${detectedRule?.pattern}` : undefined);

    addTransaction({
      payee_name: newPayee.trim(),
      amount: parsedAmount,
      transaction_type: effectiveType,
      category_id: catId,
      date: newDate,
      payment_method: newPaymentMethod,
      card_last_digits: newCardDigits || null,
      is_hidden: newIsHidden,
      notes: notesText || undefined,
    });

    // Reset
    setNewPayee('');
    setNewAmount('');
    setNewCategoryId('');
    setNewNotes('');
    setNewIsHidden(false);
    setIsAddModalOpen(false);
  };

  // Filter transactions
  const filteredTransactions = transactions.filter((t) => {
    if (!showHidden && t.is_hidden) return false;
    if (selectedTypeFilter !== 'all' && t.transaction_type !== selectedTypeFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const payeeMatch = t.payee_name.toLowerCase().includes(q);
      const cat = categories.find((c) => c.id === t.category_id);
      const catMatch = cat?.name.toLowerCase().includes(q);
      const notesMatch = t.notes?.toLowerCase().includes(q);
      return payeeMatch || catMatch || notesMatch;
    }

    return true;
  });

  return (
    <div style={styles.container}>
      {/* Top Action & Filter Toolbar */}
      <div style={styles.topBar}>
        <div style={styles.searchWrapper}>
          <Search size={16} color="var(--text-secondary)" />
          <input
            style={styles.searchInput}
            type="text"
            placeholder={t('searchPlaceholder', language)}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={styles.actionsRow}>
          {/* Type Filter Buttons */}
          <div style={styles.filterButtonGroup}>
            <button
              style={{
                ...styles.filterBtn,
                ...(selectedTypeFilter === 'all' ? styles.filterBtnActive : {}),
              }}
              onClick={() => setSelectedTypeFilter('all')}
            >
              {t('filterAll', language)}
            </button>
            <button
              style={{
                ...styles.filterBtn,
                ...(selectedTypeFilter === 'expense' ? styles.filterBtnActive : {}),
              }}
              onClick={() => setSelectedTypeFilter('expense')}
            >
              {t('filterExpenses', language)}
            </button>
            <button
              style={{
                ...styles.filterBtn,
                ...(selectedTypeFilter === 'income' ? styles.filterBtnActive : {}),
              }}
              onClick={() => setSelectedTypeFilter('income')}
            >
              {t('filterIncome', language)}
            </button>
          </div>

          {/* Soft-delete Visibility Toggle */}
          <button
            style={{
              ...styles.hiddenToggleBtn,
              ...(showHidden ? styles.hiddenToggleBtnActive : {}),
            }}
            onClick={() => setShowHidden(!showHidden)}
          >
            {showHidden ? (
              <Eye size={14} color="var(--primary)" />
            ) : (
              <EyeOff size={14} color="var(--text-secondary)" />
            )}
            <span>
              {showHidden
                ? (language === 'he' ? 'מציג מוסתרות' : 'Showing Hidden')
                : (language === 'he' ? 'הצג מוסתרות' : 'Show Hidden')}
            </span>
          </button>

          {/* Import Statement Button */}
          <button
            style={styles.importBtn}
            onClick={() => setActiveTab('import')}
          >
            <UploadCloud size={15} color="var(--primary)" />
            <span>{language === 'he' ? 'ייבוא דוחות' : 'Import Statement'}</span>
          </button>

          {/* Add Transaction Button */}
          <button
            style={styles.addTxBtn}
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus size={16} color="#FFFFFF" />
            <span>{language === 'he' ? '+ הוסף תנועה' : 'Add Transaction'}</span>
          </button>
        </div>
      </div>      {/* Transactions Table Card (Desktop & Mobile Responsive) */}
      <div style={styles.listCard}>
        {/* Desktop Table Header */}
        <div style={styles.tableHeaderRow} className="desktop-only">
          <div style={{ flex: 1.2 }}>{t('colDate', language)}</div>
          <div style={{ flex: 3 }}>{t('colPayee', language)}</div>
          <div style={{ flex: 2.2 }}>{t('colCategory', language)}</div>
          <div style={{ flex: 1.8 }}>{t('colMethod', language)}</div>
          <div style={{ flex: 1.8, textAlign: 'right' }}>{t('colAmount', language)}</div>
          <div style={{ width: '80px', textAlign: 'center' }}>{t('colActions', language)}</div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div style={styles.emptyState}>
            <Archive size={36} color="var(--text-muted)" />
            <div style={styles.emptyStateTitle}>{t('noTransactionsFound', language)}</div>
            <div style={styles.emptyStateDesc}>
              {language === 'he'
                ? 'נסה לשנות את תנאי החיפוש או הסינון, או רשום תנועה חדשה.'
                : 'Try adjusting your search or filters, or record a new transaction.'}
            </div>
          </div>
        ) : (
          filteredTransactions.map((tx) => {
            const category = categories.find((c) => c.id === tx.category_id);
            const isExpense = tx.transaction_type === 'expense';

            return (
              <React.Fragment key={tx.id}>
                {/* Desktop View Row */}
                <div
                  style={{
                    ...styles.tableRow,
                    ...(tx.is_hidden ? styles.tableRowHidden : {}),
                  }}
                  className="desktop-only"
                >
                  {/* Date */}
                  <div style={{ flex: 1.2 }}>
                    <div style={styles.dateText}>{tx.date}</div>
                    {tx.is_hidden && (
                      <span style={styles.hiddenBadge}>Soft-Deleted</span>
                    )}
                  </div>

                  {/* Payee */}
                  <div style={{ flex: 3 }}>
                    <div style={styles.payeeText}>{tx.payee_name}</div>
                    {tx.notes && <div style={styles.notesText}>{tx.notes}</div>}
                  </div>

                  {/* Category Badge */}
                  <div style={{ flex: 2.2 }}>
                    {category ? (
                      <span
                        style={{
                          ...styles.categoryBadge,
                          backgroundColor: `${category.color}15`,
                          borderColor: `${category.color}40`,
                          color: category.color,
                        }}
                      >
                        <span
                          style={{ ...styles.categoryDot, backgroundColor: category.color }}
                        />
                        {category.name}
                      </span>
                    ) : (
                      <span style={styles.uncategorizedBadge}>Uncategorized</span>
                    )}
                  </div>

                  {/* Payment Method */}
                  <div style={{ flex: 1.8, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CreditCard size={14} color="var(--text-muted)" />
                    <span style={styles.methodText}>
                      {tx.card_last_digits ? `*${tx.card_last_digits}` : tx.payment_method || 'Credit Card'}
                    </span>
                  </div>

                  {/* Amount */}
                  <div
                    style={{
                      flex: 1.8,
                      textAlign: 'right',
                      fontWeight: '800',
                      fontSize: '0.9375rem',
                      color: isExpense ? 'var(--text-primary)' : 'var(--success-text)',
                    }}
                  >
                    {isExpense ? '-' : '+'} {currencySymbol}{' '}
                    {Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>

                  {/* Actions */}
                  <div style={{ width: '80px', display: 'flex', justifyContent: 'center' }}>
                    <button
                      style={{
                        ...styles.hideBtn,
                        ...(tx.is_hidden ? styles.hideBtnHidden : {}),
                      }}
                      onClick={() => toggleTransactionVisibility(tx.id)}
                      title={tx.is_hidden ? 'Restore Transaction (is_hidden = false)' : 'Hide Transaction (is_hidden = true)'}
                    >
                      {tx.is_hidden ? (
                        <EyeOff size={14} color="var(--danger)" />
                      ) : (
                        <Eye size={14} color="var(--text-secondary)" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Mobile View Card */}
                <div
                  style={{
                    ...styles.mobileCard,
                    ...(tx.is_hidden ? styles.tableRowHidden : {}),
                  }}
                  className="mobile-only"
                >
                  <div style={styles.mobileCardTop}>
                    <div>
                      <div style={styles.payeeText}>{tx.payee_name}</div>
                      <div style={styles.dateText}>{tx.date}</div>
                    </div>
                    <div
                      style={{
                        textAlign: 'right',
                        fontWeight: '800',
                        fontSize: '1rem',
                        color: isExpense ? 'var(--text-primary)' : 'var(--success-text)',
                      }}
                    >
                      {isExpense ? '-' : '+'} {currencySymbol}{' '}
                      {Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div style={styles.mobileCardBottom}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {category ? (
                        <span
                          style={{
                            ...styles.categoryBadge,
                            backgroundColor: `${category.color}15`,
                            borderColor: `${category.color}40`,
                            color: category.color,
                          }}
                        >
                          {category.name}
                        </span>
                      ) : (
                        <span style={styles.uncategorizedBadge}>Uncategorized</span>
                      )}

                      {tx.card_last_digits && (
                        <span style={styles.cardDigitsPill}>
                          <CreditCard size={11} />
                          *{tx.card_last_digits}
                        </span>
                      )}
                      {tx.is_hidden && (
                        <span style={styles.hiddenBadge}>Soft-Deleted</span>
                      )}
                    </div>

                    <button
                      style={{
                        ...styles.hideBtn,
                        ...(tx.is_hidden ? styles.hideBtnHidden : {}),
                      }}
                      onClick={() => toggleTransactionVisibility(tx.id)}
                    >
                      {tx.is_hidden ? (
                        <EyeOff size={14} color="var(--danger)" />
                      ) : (
                        <Eye size={14} color="var(--text-secondary)" />
                      )}
                    </button>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Add Transaction Modal */}
      {isAddModalOpen && (
        <div style={styles.modalOverlay} dir={dir}>
          <div style={styles.modalCard} className="animate-fade-in">
            <h3 style={styles.modalTitle}>
              {language === 'he' ? 'רישום תנועה חדשה' : 'Record New Transaction'}
            </h3>
            <p style={styles.modalSubtitle}>
              {language === 'he'
                ? 'התנועות נשמרות באופן מאובטח עם זיהוי סיווג אוטומטי לפי בית עסק.'
                : 'Transactions are securely stored in your tenant with auto-categorization matching.'}
            </p>

            {/* Quick 1-Click Preset Templates */}
            <div style={styles.modalPresetsRow}>
              <button
                type="button"
                style={styles.modalPresetPill}
                onClick={() =>
                  applyModalPreset({
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
                type="button"
                style={styles.modalPresetPill}
                onClick={() =>
                  applyModalPreset({
                    payee: 'תחנת דלק פז',
                    amount: '320.00',
                    type: 'expense',
                    categoryNameKw: 'דלק',
                    method: 'credit_card',
                    digits: '2285',
                  })
                }
              >
                ⛽ {language === 'he' ? 'דלק ונסיעות (₪320)' : 'Fuel (₪320)'}
              </button>
              <button
                type="button"
                style={styles.modalPresetPill}
                onClick={() =>
                  applyModalPreset({
                    payee: 'סופר-פארם',
                    amount: '145.00',
                    type: 'expense',
                    categoryNameKw: 'פארם',
                    method: 'credit_card',
                    digits: '2285',
                  })
                }
              >
                💊 {language === 'he' ? 'סופר-פארם (₪145)' : 'Pharm (₪145)'}
              </button>
              <button
                type="button"
                style={styles.modalPresetPill}
                onClick={() =>
                  applyModalPreset({
                    payee: 'משכורת חודשית',
                    amount: '24500.00',
                    type: 'income',
                    categoryNameKw: 'משכורת',
                    method: 'bank_transfer',
                  })
                }
              >
                💼 {language === 'he' ? 'משכורת (₪24.5k)' : 'Salary (₪24.5k)'}
              </button>
              <button
                type="button"
                style={styles.modalPresetPill}
                onClick={() =>
                  applyModalPreset({
                    payee: 'מיטב דש - קופת גמל להשקעה',
                    amount: '2500.00',
                    type: 'savings',
                    categoryNameKw: 'חיסכון',
                    method: 'bank_transfer',
                  })
                }
              >
                🏦 {language === 'he' ? 'הפקדה לחיסכון (₪2,500)' : 'Savings (₪2,500)'}
              </button>
            </div>

            <form onSubmit={handleSaveTransaction}>
              {/* 1. Type Switcher - 3 Options */}
              <div style={styles.typeSelectorRow}>
                <button
                  type="button"
                  style={{
                    ...styles.typeOptionBtn,
                    ...(newType === 'expense' ? styles.typeOptionBtnActiveExpense : {}),
                  }}
                  onClick={() => setNewType('expense')}
                >
                  <TrendingDown size={15} />
                  <span>{language === 'he' ? 'הוצאה' : 'Expense'}</span>
                </button>
                <button
                  type="button"
                  style={{
                    ...styles.typeOptionBtn,
                    ...(newType === 'income' ? styles.typeOptionBtnActiveIncome : {}),
                  }}
                  onClick={() => setNewType('income')}
                >
                  <TrendingUp size={15} />
                  <span>{language === 'he' ? 'הכנסה' : 'Income'}</span>
                </button>
                <button
                  type="button"
                  style={{
                    ...styles.typeOptionBtn,
                    ...(newType === 'savings' ? styles.typeOptionBtnActiveSavings : {}),
                  }}
                  onClick={() => setNewType('savings')}
                >
                  <PiggyBank size={15} />
                  <span>{language === 'he' ? 'הפקדה לחיסכון' : 'Savings Deposit'}</span>
                </button>
              </div>

              {/* 2. Payee with Auto-Mapping */}
              <div style={styles.formGroup}>
                <label style={styles.inputLabel}>
                  {language === 'he' ? 'שם בית עסק / מוטב' : 'Payee / Merchant Name'}
                </label>
                <input
                  style={styles.textInput}
                  type="text"
                  placeholder={
                    language === 'he'
                      ? 'לדוגמה: שופרסל, פז, נטפליקס, משכורת...'
                      : 'e.g. SHUFERSAL, PAZ, NETFLIX, Salary'
                  }
                  value={newPayee}
                  onChange={(e) => handlePayeeChange(e.target.value)}
                  required
                />
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

              {/* 3. Amount & Date */}
              <div style={styles.twoColumnRow}>
                <div style={{ ...styles.formGroup, flex: 1 }}>
                  <label style={styles.inputLabel}>
                    {language === 'he' ? `סכום (${currency})` : `Amount (${currency})`}
                  </label>
                  <input
                    style={styles.textInput}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    required
                  />
                </div>

                <div style={{ ...styles.formGroup, flex: 1 }}>
                  <label style={styles.inputLabel}>
                    {language === 'he' ? 'תאריך' : 'Date'}
                  </label>
                  <input
                    style={styles.textInput}
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* 4. Category Picker */}
              <div style={styles.formGroup}>
                <label style={styles.inputLabel}>
                  {language === 'he'
                    ? newType === 'income' ? 'סוג הכנסה (קטגוריה)' : newType === 'savings' ? 'יעד חיסכון / קטגוריה' : 'סוג הוצאה (קטגוריה)'
                    : 'Category'}
                </label>
                <div style={styles.catPickerScroll}>
                  {categories
                    .filter((c) => (newType === 'income' ? c.type === 'income' : c.type === 'expense'))
                    .map((cat) => {
                      const isSelected = newCategoryId === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          style={{
                            ...styles.catPill,
                            ...(isSelected
                              ? {
                                  backgroundColor: cat.color || 'var(--primary)',
                                  borderColor: cat.color || 'var(--primary)',
                                  color: '#FFFFFF',
                                  fontWeight: '700',
                                }
                              : {}),
                          }}
                          onClick={() => setNewCategoryId(cat.id)}
                        >
                          {formatCategoryName(cat.name, language)}
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* 5. Payment Method & Last 4 Digits */}
              <div style={styles.twoColumnRow}>
                <div style={{ ...styles.formGroup, flex: 1 }}>
                  <label style={styles.inputLabel}>
                    {language === 'he' ? 'אמצעי תשלום / מקור' : 'Payment Method'}
                  </label>
                  <select
                    style={styles.textInput}
                    value={newPaymentMethod}
                    onChange={(e) => setNewPaymentMethod(e.target.value)}
                  >
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
                    <option value="standing_order">
                      {language === 'he' ? '🔄 הוראת קבע' : '🔄 Standing Order'}
                    </option>
                    <option value="cash">
                      {language === 'he' ? '💵 מזומן' : '💵 Cash'}
                    </option>
                    <option value="check">
                      {language === 'he' ? '📑 המחאה (צ\'ק)' : '📑 Check'}
                    </option>
                    <option value="bit">
                      {language === 'he' ? '📱 Bit / אפליקציה' : '📱 Bit / App'}
                    </option>
                    <option value="other">
                      {language === 'he' ? '🔘 אחר' : '🔘 Other'}
                    </option>
                  </select>
                </div>

                <div style={{ ...styles.formGroup, flex: 1 }}>
                  <label style={styles.inputLabel}>
                    {language === 'he' ? '4 ספרות כרטיס אחרונות' : 'Card Last 4 Digits'}
                  </label>
                  <input
                    style={styles.textInput}
                    type="text"
                    maxLength={4}
                    placeholder={language === 'he' ? 'לדוגמה: 2285' : 'e.g. 2285'}
                    value={newCardDigits}
                    onChange={(e) => setNewCardDigits(e.target.value)}
                  />
                </div>
              </div>

              {/* 6. Notes */}
              <div style={styles.formGroup}>
                <label style={styles.inputLabel}>
                  {language === 'he' ? 'הערות (אופציונלי)' : 'Notes (Optional)'}
                </label>
                <input
                  style={styles.textInput}
                  type="text"
                  placeholder={
                    language === 'he' ? 'הערות נוספות...' : 'Additional remarks...'
                  }
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                />
              </div>

              {/* 7. Soft-Delete / Hide Checkbox */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newIsHidden}
                    onChange={(e) => setNewIsHidden(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    {language === 'he'
                      ? 'שמור כתנועה מוסתרת (לא תיכלל בחישובי התקציב החודשי)'
                      : 'Save as Hidden (Soft-Delete) — Excludes from active monthly budgets'}
                  </span>
                </label>
              </div>

              <div style={styles.modalActionRow}>
                <button
                  type="button"
                  style={styles.resetBtn}
                  onClick={() => {
                    setNewPayee('');
                    setNewAmount('');
                    setNewType('expense');
                    setNewCategoryId('');
                    setNewNotes('');
                    setNewIsHidden(false);
                  }}
                >
                  <RefreshCw size={14} color="var(--text-secondary)" />
                  <span>{language === 'he' ? 'נקה טופס' : 'Clear'}</span>
                </button>

                <button
                  type="button"
                  style={styles.cancelBtn}
                  onClick={() => setIsAddModalOpen(false)}
                >
                  {language === 'he' ? 'ביטול' : 'Cancel'}
                </button>

                <button type="submit" style={styles.submitBtn}>
                  {language === 'he' ? 'שמור תנועה' : 'Save Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  searchWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: 'var(--bg-surface)',
    padding: '8px 14px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-main)',
    flex: '1',
    maxWidth: '380px',
    minWidth: '240px',
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    width: '100%',
    color: 'var(--text-primary)',
  },
  actionsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  filterButtonGroup: {
    display: 'flex',
    backgroundColor: 'var(--bg-surface-subtle)',
    borderRadius: 'var(--radius-sm)',
    padding: '3px',
    border: '1px solid var(--border-main)',
  },
  filterBtn: {
    padding: '6px 12px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.75rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
  },
  filterBtnActive: {
    backgroundColor: 'var(--bg-surface)',
    boxShadow: 'var(--shadow-sm)',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  hiddenToggleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 12px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-main)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.75rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
  },
  hiddenToggleBtnActive: {
    borderColor: 'var(--primary)',
    backgroundColor: 'var(--primary-light)',
    color: 'var(--primary)',
    fontWeight: '700',
  },
  importBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    backgroundColor: 'var(--primary-light)',
    border: '1px solid var(--primary)',
    color: 'var(--primary)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    transition: 'all 0.15s ease',
  },
  addTxBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: '600',
  },
  listCard: {
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
    letterSpacing: '0.04em',
  },
  tableRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 20px',
    borderBottom: '1px solid var(--border-subtle)',
    transition: 'background-color 0.15s ease',
  },
  tableRowHidden: {
    backgroundColor: 'var(--bg-surface-subtle)',
    opacity: 0.6,
  },
  dateText: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    fontWeight: '500',
  },
  hiddenBadge: {
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
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  categoryBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 8px',
    borderRadius: '6px',
    border: '1px solid',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  categoryDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
  },
  uncategorizedBadge: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  methodText: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
  },
  hideBtn: {
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
  hideBtnHidden: {
    backgroundColor: 'var(--danger-light)',
    borderColor: '#FECACA',
  },
  mobileCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '14px 16px',
    borderBottom: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--bg-surface)',
  },
  mobileCardTop: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  mobileCardBottom: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardDigitsPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    fontSize: '0.6875rem',
    color: 'var(--text-muted)',
    backgroundColor: 'var(--bg-surface-subtle)',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 20px',
    gap: '8px',
  },
  emptyStateTitle: {
    fontSize: '1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  emptyStateDesc: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    textAlign: 'center',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modalCard: {
    width: '100%',
    maxWidth: '520px',
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
    boxShadow: 'var(--shadow-xl)',
  },
  modalTitle: {
    fontSize: '1.125rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '4px',
  },
  modalSubtitle: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    marginBottom: '16px',
  },
  typeSelectorRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '16px',
  },
  typeOptionBtn: {
    flex: 1,
    padding: '9px',
    textAlign: 'center',
    backgroundColor: 'var(--bg-surface-subtle)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-main)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  typeOptionBtnActiveExpense: {
    backgroundColor: 'var(--danger-light)',
    borderColor: '#FCA5A5',
    color: 'var(--danger-text)',
    fontWeight: '700',
  },
  typeOptionBtnActiveIncome: {
    backgroundColor: 'var(--success-light)',
    borderColor: '#6EE7B7',
    color: 'var(--success-text)',
    fontWeight: '700',
  },
  typeOptionBtnActiveSavings: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderColor: '#67E8F9',
    color: '#0891B2',
    fontWeight: '700',
  },
  modalPresetsRow: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    marginBottom: '16px',
  },
  modalPresetPill: {
    padding: '4px 10px',
    borderRadius: '12px',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  formGroup: {
    marginBottom: '14px',
  },
  twoColumnRow: {
    display: 'flex',
    gap: '12px',
  },
  inputLabel: {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: '4px',
  },
  textInput: {
    width: '100%',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 12px',
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
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
  catPickerScroll: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    padding: '4px 0',
  },
  catPill: {
    padding: '5px 12px',
    borderRadius: '16px',
    border: '1px solid var(--border-main)',
    backgroundColor: 'var(--bg-surface-subtle)',
    fontSize: '0.75rem',
    whiteSpace: 'nowrap',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  modalActionRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '10px',
    marginTop: '20px',
  },
  resetBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 14px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-main)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    marginRight: 'auto',
  },
  cancelBtn: {
    padding: '9px 16px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-surface-subtle)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-main)',
    cursor: 'pointer',
  },
  submitBtn: {
    padding: '9px 18px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    fontSize: '0.8125rem',
    fontWeight: '700',
    border: 'none',
    cursor: 'pointer',
  },
};
