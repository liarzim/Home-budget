import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  Search,
  CreditCard,
  Tag,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  Building2,
  Calendar,
  DollarSign,
  Download,
  Edit3,
  List,
  CheckSquare,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/i18n';
import * as XLSX from 'xlsx';

interface AuditItem {
  id: string;
  date: string;
  payee_name: string;
  amount: number;
  transaction_type: 'income' | 'expense';
  category_id: string | null;
  category_name?: string;
  card_last_digits: string | null;
  payment_method: string;
  notes: string | null;
  issueTypes: ('no_category' | 'no_card' | 'unusual_amount')[];
}

interface EditModalState {
  isOpen: boolean;
  isBulk: boolean;
  transactionId?: string;
  payeeName: string;
  categoryId: string;
  paymentMethod: string;
  cardLastDigits: string;
  amount: number;
  date: string;
  transactionType: 'income' | 'expense';
  notes: string;
  approveUnusual: boolean;
  applyToAll: boolean;
}

export const DataAuditScreen: React.FC = () => {
  const {
    activeHousehold,
    categories,
    macroCategories,
    cardMappings,
    language,
    dir,
  } = useAuth();

  const isHe = language === 'he';

  const [isLoading, setIsLoading] = useState(true);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedIssue, setSelectedIssue] = useState<'all' | 'no_category' | 'no_card' | 'unusual_amount'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeViewMode, setActiveViewMode] = useState<'transactions' | 'payees'>('transactions');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Edit Modal State
  const [editModal, setEditModal] = useState<EditModalState>({
    isOpen: false,
    isBulk: false,
    payeeName: '',
    categoryId: '',
    paymentMethod: 'credit_card',
    cardLastDigits: '',
    amount: 0,
    date: '',
    transactionType: 'expense',
    notes: '',
    approveUnusual: false,
    applyToAll: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Category Map
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  // Fetch all transactions for this household
  const fetchTransactions = async () => {
    if (!activeHousehold?.id) return;
    setIsLoading(true);
    try {
      let all: any[] = [];
      let from = 0;
      const batchSize = 1000;

      while (true) {
        const { data, error } = await supabase
          .from('transactions')
          .select('id, date, payee_name, amount, transaction_type, category_id, card_last_digits, payment_method, notes')
          .eq('household_id', activeHousehold.id)
          .order('date', { ascending: false })
          .range(from, from + batchSize - 1);

        if (error) throw error;
        all = all.concat(data || []);
        if (!data || data.length < batchSize) break;
        from += batchSize;
      }

      setAllTransactions(all);
    } catch (err) {
      console.error('Error fetching transactions for audit:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [activeHousehold?.id]);

  // Process and flag issues
  const auditedItems = useMemo<AuditItem[]>(() => {
    return allTransactions
      .map((tx) => {
        const catName = tx.category_id ? categoryMap.get(tx.category_id) || 'לא ידוע' : 'ללא שיוך';
        const issues: ('no_category' | 'no_card' | 'unusual_amount')[] = [];

        // 1. Missing or unverified category
        const isDefaultShonot = catName === 'שונות' || catName === 'אחר' || catName === 'ללא שיוך';
        const hasFlagInNotes = tx.notes && tx.notes.includes('[דורש סיווג]');
        if (!tx.category_id || hasFlagInNotes || (isDefaultShonot && tx.transaction_type === 'expense')) {
          issues.push('no_category');
        }

        // 2. Missing credit card 4 digits for credit card payment method
        const isCreditCard = tx.payment_method === 'credit_card' || !tx.payment_method;
        if (isCreditCard && !tx.card_last_digits) {
          issues.push('no_card');
        }

        // 3. Unusual amounts (<=0 or unexpected)
        const isApprovedAmount = tx.notes && (tx.notes.includes('[סכום מאושר]') || tx.notes.includes('[אושר]'));
        if (!isApprovedAmount && (tx.amount <= 0 || tx.amount >= 100000)) {
          issues.push('unusual_amount');
        }

        return {
          id: tx.id,
          date: tx.date,
          payee_name: tx.payee_name || 'ללא שם עסק',
          amount: tx.amount,
          transaction_type: tx.transaction_type,
          category_id: tx.category_id,
          category_name: catName,
          card_last_digits: tx.card_last_digits,
          payment_method: tx.payment_method || 'credit_card',
          notes: tx.notes,
          issueTypes: issues,
        };
      })
      .filter((item) => item.issueTypes.length > 0);
  }, [allTransactions, categoryMap]);

  // Available Years
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    allTransactions.forEach((tx) => {
      if (tx.date && tx.date.length >= 4) {
        years.add(tx.date.substring(0, 4));
      }
    });
    return Array.from(years).sort().reverse();
  }, [allTransactions]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return auditedItems.filter((item) => {
      const year = item.date ? item.date.substring(0, 4) : '';
      const matchesYear = selectedYear === 'all' || year === selectedYear;
      const matchesIssue = selectedIssue === 'all' || item.issueTypes.includes(selectedIssue);
      const matchesSearch =
        (item.payee_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(item.amount).includes(searchQuery);

      return matchesYear && matchesIssue && matchesSearch;
    });
  }, [auditedItems, selectedYear, selectedIssue, searchQuery]);

  // Group by Payee for smart bulk review
  const groupedByPayee = useMemo(() => {
    const map = new Map<string, { count: number; totalAmount: number; sampleDate: string; items: AuditItem[] }>();
    filteredItems.forEach((item) => {
      const key = item.payee_name.trim();
      if (!map.has(key)) {
        map.set(key, { count: 0, totalAmount: 0, sampleDate: item.date, items: [] });
      }
      const entry = map.get(key)!;
      entry.count++;
      entry.totalAmount += item.amount;
      entry.items.push(item);
    });
    return Array.from(map.entries())
      .map(([payee, data]) => ({ payee, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [filteredItems]);

  // Paginated items for the detailed transactions table
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredItems.slice(startIndex, startIndex + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;

  // Overall Statistics
  const stats = useMemo(() => {
    const totalTransactionsCount = allTransactions.length;
    const totalIssuesCount = auditedItems.length;
    const cleanPercentage =
      totalTransactionsCount > 0
        ? (((totalTransactionsCount - totalIssuesCount) / totalTransactionsCount) * 100).toFixed(1)
        : '100';

    const countNoCategory = auditedItems.filter((i) => i.issueTypes.includes('no_category')).length;
    const countNoCard = auditedItems.filter((i) => i.issueTypes.includes('no_card')).length;
    const countUnusual = auditedItems.filter((i) => i.issueTypes.includes('unusual_amount')).length;

    return {
      totalTransactionsCount,
      totalIssuesCount,
      cleanPercentage,
      countNoCategory,
      countNoCard,
      countUnusual,
    };
  }, [allTransactions, auditedItems]);

  const resolveInitialCardDigits = (cardLastDigits?: string | null, notes?: string | null): string => {
    if (cardLastDigits && cardLastDigits.trim()) return cardLastDigits.trim();
    if (!notes) return '';
    if (notes.includes('2285') || notes.includes('שופרסל') || notes.includes('פלטינום')) return '2285';
    if (notes.includes('7520')) return '7520';
    if (notes.includes('0450')) return '0450';
    if (notes.includes('3669')) return '3669';
    if (notes.includes('1618')) return '1618';
    const match = notes.match(/\b(\d{4})\b/);
    return match ? match[1] : '';
  };

  // Open modal for single transaction
  const handleOpenSingleEdit = (item: AuditItem) => {
    const isApproved = item.notes?.includes('[סכום מאושר]') || item.notes?.includes('[אושר]') || false;
    const initialDigits = resolveInitialCardDigits(item.card_last_digits, item.notes);
    setEditModal({
      isOpen: true,
      isBulk: false,
      transactionId: item.id,
      payeeName: item.payee_name,
      categoryId: item.category_id || '',
      paymentMethod: item.payment_method || 'credit_card',
      cardLastDigits: initialDigits,
      amount: item.amount,
      date: item.date,
      transactionType: item.transaction_type,
      notes: (item.notes || '').replace('[דורש סיווג]', '').trim(),
      approveUnusual: isApproved || (item.amount >= 100000 || item.amount <= 0),
      applyToAll: false,
    });
  };

  // Open modal for bulk payee
  const handleOpenBulkEdit = (grp: { payee: string; items: AuditItem[] }) => {
    const first = grp.items[0];
    const initialDigits = resolveInitialCardDigits(first?.card_last_digits, first?.notes);
    setEditModal({
      isOpen: true,
      isBulk: true,
      payeeName: grp.payee,
      categoryId: first?.category_id || '',
      paymentMethod: first?.payment_method || 'credit_card',
      cardLastDigits: initialDigits,
      amount: grp.items.reduce((s, i) => s + i.amount, 0),
      date: first?.date || '',
      transactionType: first?.transaction_type || 'expense',
      notes: (first?.notes || '').replace('[דורש סיווג]', '').trim(),
      approveUnusual: false,
      applyToAll: true,
    });
  };

  // Handle Preset Card selection
  const handleCardSelection = (val: string) => {
    // If user chose a known cardMapping pattern
    const matchedCard = cardMappings?.find((cm) => cm.raw_pattern === val || cm.display_name === val || cm.id === val);
    if (matchedCard) {
      setEditModal((prev) => ({
        ...prev,
        paymentMethod: matchedCard.payment_type || 'credit_card',
        cardLastDigits: matchedCard.card_last_digits || prev.cardLastDigits,
      }));
    } else {
      // It's a standard payment method e.g. bank_transfer, standing_order, cash
      setEditModal((prev) => ({
        ...prev,
        paymentMethod: val,
        cardLastDigits: val === 'credit_card' ? prev.cardLastDigits : '',
      }));
    }
  };

  // Save Transaction Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Calculate notes
      let newNotes = (editModal.notes || '').replace('[דורש סיווג]', '').trim();
      if (editModal.approveUnusual) {
        if (!newNotes.includes('[סכום מאושר]')) {
          newNotes = newNotes ? `${newNotes} [סכום מאושר]` : '[סכום מאושר]';
        }
      } else {
        newNotes = newNotes.replace('[סכום מאושר]', '').replace('[אושר]', '').trim();
      }

      if (editModal.isBulk || editModal.applyToAll) {
        // Bulk update all transactions with matching payee name
        const cleanPayee = editModal.payeeName.trim().toLowerCase();
        const matchingTxs = allTransactions.filter(
          (t) => (t.payee_name || '').trim().toLowerCase() === cleanPayee
        );
        const matchingIds = matchingTxs.map((t) => t.id);

        if (matchingIds.length > 0) {
          const updatePayload: any = {
            updated_at: new Date().toISOString(),
          };
          if (editModal.categoryId) updatePayload.category_id = editModal.categoryId;
          if (editModal.cardLastDigits !== undefined) updatePayload.card_last_digits = editModal.cardLastDigits || null;
          if (editModal.paymentMethod) updatePayload.payment_method = editModal.paymentMethod;
          if (editModal.approveUnusual) updatePayload.notes = newNotes || null;

          const { error: updateErr } = await supabase
            .from('transactions')
            .update(updatePayload)
            .in('id', matchingIds);

          if (updateErr) {
            console.error('Error updating bulk transactions in DB:', updateErr);
            throw updateErr;
          }

          // Also save rule in business_mapping
          if (editModal.categoryId && activeHousehold?.id) {
            await supabase.from('business_mapping').upsert(
              {
                household_id: activeHousehold.id,
                raw_business_name: editModal.payeeName.trim(),
                category_id: editModal.categoryId,
                match_type: 'contains',
              },
              { onConflict: 'household_id,raw_business_name' }
            );
          }

          // Update local state immediately
          setAllTransactions((prev) =>
            prev.map((tx) =>
              matchingIds.includes(tx.id)
                ? {
                    ...tx,
                    ...updatePayload,
                    notes: editModal.approveUnusual ? newNotes : (tx.notes || '').replace('[דורש סיווג]', '').trim(),
                  }
                : tx
            )
          );
        }
      } else {
        // Single transaction update
        if (!editModal.transactionId) return;

        const updatePayload: any = {
          payee_name: editModal.payeeName.trim(),
          category_id: editModal.categoryId || null,
          amount: Number(editModal.amount),
          date: editModal.date,
          transaction_type: editModal.transactionType,
          payment_method: editModal.paymentMethod,
          card_last_digits: editModal.cardLastDigits || null,
          notes: newNotes || null,
          updated_at: new Date().toISOString(),
        };

        const { error: singleErr } = await supabase
          .from('transactions')
          .update(updatePayload)
          .eq('id', editModal.transactionId);

        if (singleErr) {
          console.error('Error updating single transaction in DB:', singleErr);
          throw singleErr;
        }

        // Update local state immediately
        setAllTransactions((prev) =>
          prev.map((tx) =>
            tx.id === editModal.transactionId ? { ...tx, ...updatePayload } : tx
          )
        );
      }

      setSaveSuccessMsg(isHe ? 'הנתונים עודכנו ונשמרו בהצלחה במסד הנתונים!' : 'Transaction updated successfully!');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
      setEditModal((prev) => ({ ...prev, isOpen: false }));

      // Background re-fetch to ensure sync
      fetchTransactions();
    } catch (err: any) {
      console.error('Failed to save audit changes:', err);
      alert(isHe ? `שגיאה בשמירת השינויים: ${err.message || 'אנא נסה שוב'}` : `Error saving: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportGapsCSV = () => {
    const dataForSheet = filteredItems.map((item) => ({
      'תאריך': item.date,
      'בית עסק': item.payee_name,
      'סכום (₪)': item.amount,
      'סוג תנועה': item.transaction_type === 'income' ? 'הכנסה' : 'הוצאה',
      'קטגוריה נוכחית': item.category_name,
      '4 ספרות כרטיס': item.card_last_digits || 'לא מזוהה',
      'אמצעי תשלום': item.payment_method,
      'סוג הבעיה': item.issueTypes
        .map((t) => (t === 'no_category' ? 'דורש סיווג' : t === 'no_card' ? 'כרטיס ללא 4 ספרות' : 'סכום חריג'))
        .join(', '),
      'הערות': item.notes || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'פערי סיווג ונתונים');
    XLSX.writeFile(workbook, `פערי_נתונים_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }} dir={dir}>
      {/* Toast Notification */}
      {saveSuccessMsg && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: '#059669',
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: '10px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 700,
            fontSize: '0.9rem',
          }}
        >
          <CheckCircle2 size={18} />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', backgroundColor: '#FEF3C7', borderRadius: '16px', border: '1px solid #FDE68A', fontSize: '0.75rem', fontWeight: 700, color: '#B45309', marginBottom: '8px' }}>
            <AlertTriangle size={14} color="#D97706" />
            <span>{isHe ? 'מרכז בקרת איכות וסיווג נתונים' : 'Data Audit & Gaps'}</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary, #0F172A)', margin: '0 0 6px 0' }}>
            {isHe ? 'בקרת נתונים, פערים ותיקון תנועות' : 'Data Quality & Gaps Audit'}
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted, #64748B)', margin: 0, maxWidth: '750px' }}>
            {isHe
              ? 'מסך ייעודי לאיתור ותיקון כל סוגי הפערים: סיווג לקטגוריה, שיוך לכרטיס אשראי ספציפי, עדכון פרטי עסקה ואישור סכומים חריגים.'
              : 'Audit and fix uncategorized transactions, unmapped credit cards, and unusual amounts across all years.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={fetchTransactions}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
          >
            <RefreshCw size={14} className={isLoading ? 'spin-icon' : ''} />
            <span>{isHe ? 'רענן נתונים' : 'Refresh'}</span>
          </button>

          <button
            onClick={handleExportGapsCSV}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', border: 'none', backgroundColor: '#2563EB', color: '#FFFFFF', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 6px rgba(37,99,235,0.25)' }}
          >
            <Download size={15} />
            <span>{isHe ? 'ייצוא פערים (Excel)' : 'Export Gaps'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={kpiCardStyle}>
          <div style={kpiTopRowStyle}>
            <span style={kpiLabelStyle}>{isHe ? 'ציון תקינות הנתונים הכולל' : 'Data Quality Score'}</span>
            <div style={{ ...iconWrapStyle, backgroundColor: '#ECFDF5' }}>
              <CheckCircle2 size={18} color="#059669" />
            </div>
          </div>
          <div style={{ ...kpiValueStyle, color: '#059669' }}>
            {stats.cleanPercentage}%
          </div>
          <span style={kpiSubStyle}>
            {isHe
              ? `${stats.totalTransactionsCount - stats.totalIssuesCount} מתוך ${stats.totalTransactionsCount} תנועות מסווגות פיקס`
              : `${stats.totalTransactionsCount - stats.totalIssuesCount} of ${stats.totalTransactionsCount} clean`}
          </span>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiTopRowStyle}>
            <span style={kpiLabelStyle}>{isHe ? 'תנועות ללא סיווג קטגוריה' : 'Uncategorized Transactions'}</span>
            <div style={{ ...iconWrapStyle, backgroundColor: '#FEF3C7' }}>
              <Tag size={18} color="#D97706" />
            </div>
          </div>
          <div style={{ ...kpiValueStyle, color: '#B45309' }}>
            {stats.countNoCategory}
          </div>
          <span style={kpiSubStyle}>{isHe ? 'דורשות שיוך לקטגוריה מדויקת' : 'Require category mapping'}</span>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiTopRowStyle}>
            <span style={kpiLabelStyle}>{isHe ? 'כרטיסים ללא 4 ספרות' : 'Unmapped Card Digits'}</span>
            <div style={{ ...iconWrapStyle, backgroundColor: '#EFF6FF' }}>
              <CreditCard size={18} color="#2563EB" />
            </div>
          </div>
          <div style={{ ...kpiValueStyle, color: '#1D4ED8' }}>
            {stats.countNoCard}
          </div>
          <span style={kpiSubStyle}>{isHe ? 'שמות כלליים כגון "ויזה פלטינום"' : 'E.g. Visa Platinum'}</span>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiTopRowStyle}>
            <span style={kpiLabelStyle}>{isHe ? 'סכומים חריגים / אפס' : 'Unusual Amounts'}</span>
            <div style={{ ...iconWrapStyle, backgroundColor: '#FDF2F8' }}>
              <DollarSign size={18} color="#DB2777" />
            </div>
          </div>
          <div style={{ ...kpiValueStyle, color: '#BE185D' }}>
            {stats.countUnusual}
          </div>
          <span style={kpiSubStyle}>{isHe ? 'מעל 100 אלף ש"ח או אפס' : 'Above 100k or zero'}</span>
        </div>
      </div>

      {/* Filter and View Toggle Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          backgroundColor: 'var(--bg-surface, #FFFFFF)',
          padding: '14px 18px',
          borderRadius: '14px',
          border: '1px solid var(--border-subtle, #E2E8F0)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* View Mode Toggle */}
          <div style={{ display: 'flex', backgroundColor: '#F1F5F9', borderRadius: '10px', padding: '3px', border: '1px solid #E2E8F0' }}>
            <button
              onClick={() => { setActiveViewMode('transactions'); setCurrentPage(1); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeViewMode === 'transactions' ? '#FFFFFF' : 'transparent',
                color: activeViewMode === 'transactions' ? '#2563EB' : '#64748B',
                fontWeight: activeViewMode === 'transactions' ? 700 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
                boxShadow: activeViewMode === 'transactions' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <List size={14} />
              <span>{isHe ? 'פירוט עסקאות בודדות' : 'Individual Transactions'}</span>
            </button>

            <button
              onClick={() => { setActiveViewMode('payees'); setCurrentPage(1); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeViewMode === 'payees' ? '#FFFFFF' : 'transparent',
                color: activeViewMode === 'payees' ? '#2563EB' : '#64748B',
                fontWeight: activeViewMode === 'payees' ? 700 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
                boxShadow: activeViewMode === 'payees' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <Building2 size={14} />
              <span>{isHe ? 'ריכוז לפי בית עסק' : 'Grouped by Payee'}</span>
            </button>
          </div>

          {/* Year Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={15} color="#64748B" />
            <select
              value={selectedYear}
              onChange={(e) => { setSelectedYear(e.target.value); setCurrentPage(1); }}
              style={selectStyle}
            >
              <option value="all">{isHe ? 'כל השנים' : 'All Years'}</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  שנת {y}
                </option>
              ))}
            </select>
          </div>

          {/* Issue Type Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={15} color="#64748B" />
            <select
              value={selectedIssue}
              onChange={(e) => { setSelectedIssue(e.target.value as any); setCurrentPage(1); }}
              style={selectStyle}
            >
              <option value="all">{isHe ? 'כל סוגי הפערים' : 'All Issues'}</option>
              <option value="no_category">{isHe ? 'ללא סיווג קטגוריה' : 'Missing Category'}</option>
              <option value="no_card">{isHe ? 'כרטיס ללא 4 ספרות' : 'Missing Card Digits'}</option>
              <option value="unusual_amount">{isHe ? 'סכומים חריגים / אפס' : 'Unusual Amounts'}</option>
            </select>
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative', minWidth: '200px' }}>
            <Search
              size={15}
              color="#94A3B8"
              style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [dir === 'rtl' ? 'right' : 'left']: '10px' }}
            />
            <input
              type="text"
              placeholder={isHe ? 'חיפוש בית עסק, סכום...' : 'Search payee, amount...'}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              style={{
                width: '100%',
                padding: '8px 12px',
                [dir === 'rtl' ? 'paddingRight' : 'paddingLeft']: '32px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.85rem',
                backgroundColor: '#F8FAFC',
                outline: 'none',
              }}
            />
          </div>
        </div>

        <div style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 600 }}>
          {isHe ? `נמצאו ${filteredItems.length} תנועות עם פערים` : `Found ${filteredItems.length} items`}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <RefreshCw size={32} className="spin-icon" color="#2563EB" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: '#64748B', fontWeight: 600 }}>{isHe ? 'טוען ומנתח תנועות מכל השנים...' : 'Analyzing transactions...'}</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            backgroundColor: 'var(--bg-surface, #FFFFFF)',
            borderRadius: '16px',
            border: '1px solid var(--border-subtle, #E2E8F0)',
          }}
        >
          <CheckCircle2 size={48} color="#059669" style={{ margin: '0 auto 14px' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
            {isHe ? 'מעולה! אין פערים או תנועות לא משויכות בחתך זה' : 'All Clear! No Gaps Found'}
          </h3>
          <p style={{ color: '#64748B', fontSize: '0.875rem', marginTop: '6px' }}>
            {isHe ? 'כל התנועות מסווגות בצורה תקינה לקטגוריות, לכרטיסים ולסכומים מאושרים.' : 'All transactions are properly categorized.'}
          </p>
        </div>
      ) : activeViewMode === 'transactions' ? (
        /* Detailed Transactions Table */
        <div style={{ backgroundColor: 'var(--bg-surface, #FFFFFF)', borderRadius: '16px', border: '1px solid var(--border-subtle, #E2E8F0)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.95rem' }}>
              {isHe ? `פירוט כל העסקאות עם פערים (${filteredItems.length} תנועות)` : `Detailed Transactions (${filteredItems.length})`}
            </span>
            <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
              {isHe ? `עמוד ${currentPage} מתוך ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                  <th style={thStyle}>{isHe ? 'תאריך' : 'Date'}</th>
                  <th style={thStyle}>{isHe ? 'בית עסק' : 'Payee'}</th>
                  <th style={thStyle}>{isHe ? 'סכום' : 'Amount'}</th>
                  <th style={thStyle}>{isHe ? 'קטגוריה נוכחית' : 'Current Category'}</th>
                  <th style={thStyle}>{isHe ? 'כרטיס / אמצעי' : 'Card / Method'}</th>
                  <th style={thStyle}>{isHe ? 'סוגי הפערים' : 'Issues'}</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>{isHe ? 'פעולה' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.map((tx) => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{tx.date}</td>
                    <td style={tdStyle}>
                      <strong>{tx.payee_name}</strong>
                      {tx.notes && (
                        <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>
                          {tx.notes}
                        </div>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <strong style={{ color: tx.transaction_type === 'income' ? '#059669' : '#0F172A' }}>
                        {tx.transaction_type === 'income' ? '+' : '-'}₪{tx.amount.toLocaleString('he-IL', { minimumFractionDigits: 2 })}
                      </strong>
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '8px',
                          backgroundColor: tx.category_name === 'ללא שיוך' ? '#FEE2E2' : '#F1F5F9',
                          color: tx.category_name === 'ללא שיוך' ? '#B91C1C' : '#334155',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                        }}
                      >
                        {tx.category_name}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {tx.card_last_digits ? (
                        <span style={{ padding: '3px 8px', borderRadius: '8px', backgroundColor: '#EFF6FF', color: '#1D4ED8', fontWeight: 600, fontSize: '0.75rem' }}>
                          •••• {tx.card_last_digits}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                          {tx.payment_method === 'bank_transfer'
                            ? (isHe ? 'העברה בנקאית' : 'Bank Transfer')
                            : tx.payment_method || (isHe ? 'לא הוגדר' : 'None')}
                        </span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {tx.issueTypes.map((issue) => (
                          <span
                            key={issue}
                            style={{
                              fontSize: '0.72rem',
                              padding: '2px 6px',
                              borderRadius: '6px',
                              fontWeight: 700,
                              backgroundColor:
                                issue === 'no_category' ? '#FEF3C7' : issue === 'no_card' ? '#EFF6FF' : '#FCE7F3',
                              color:
                                issue === 'no_category' ? '#B45309' : issue === 'no_card' ? '#1D4ED8' : '#BE185D',
                            }}
                          >
                            {issue === 'no_category'
                              ? (isHe ? 'דורש סיווג' : 'No Category')
                              : issue === 'no_card'
                              ? (isHe ? 'ללא 4 ספרות' : 'No Card Digits')
                              : (isHe ? 'סכום חריג' : 'Unusual Amount')}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <button
                        onClick={() => handleOpenSingleEdit(tx)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: '#2563EB',
                          color: '#FFFFFF',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 1px 3px rgba(37,99,235,0.2)',
                        }}
                      >
                        <Edit3 size={13} />
                        <span>{isHe ? 'ערוך ותקן' : 'Edit & Fix'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
              <span style={{ fontSize: '0.82rem', color: '#64748B' }}>
                {isHe
                  ? `מציג ${(currentPage - 1) * pageSize + 1} - ${Math.min(currentPage * pageSize, filteredItems.length)} מתוך ${filteredItems.length} תנועות`
                  : `Showing ${(currentPage - 1) * pageSize + 1} - ${Math.min(currentPage * pageSize, filteredItems.length)} of ${filteredItems.length}`}
              </span>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: currentPage === 1 ? '#F1F5F9' : '#FFFFFF',
                    color: currentPage === 1 ? '#94A3B8' : '#334155',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  {isHe ? 'הקודם' : 'Previous'}
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: currentPage === totalPages ? '#F1F5F9' : '#FFFFFF',
                    color: currentPage === totalPages ? '#94A3B8' : '#334155',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  {isHe ? 'הבא' : 'Next'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Payees Grouped Table */
        <div style={{ backgroundColor: 'var(--bg-surface, #FFFFFF)', borderRadius: '16px', border: '1px solid var(--border-subtle, #E2E8F0)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.95rem' }}>
              {isHe ? 'ריכוז בתי עסק הדורשים סיווג (סיווג במרוכז)' : 'Payees Requiring Classification'}
            </span>
            <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
              {isHe ? `${groupedByPayee.length} בתי עסק שונים` : `${groupedByPayee.length} distinct payees`}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                  <th style={thStyle}>{isHe ? 'בית עסק' : 'Payee'}</th>
                  <th style={thStyle}>{isHe ? 'מספר עסקאות' : 'Count'}</th>
                  <th style={thStyle}>{isHe ? 'סך הכל סכום' : 'Total Amount'}</th>
                  <th style={thStyle}>{isHe ? 'סוגי בעיות' : 'Issues'}</th>
                  <th style={thStyle}>{isHe ? 'תאריך אחרון' : 'Last Date'}</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>{isHe ? 'פעולה מהירה' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {groupedByPayee.map((grp) => {
                  const hasNoCat = grp.items.some((i) => i.issueTypes.includes('no_category'));
                  const hasNoCard = grp.items.some((i) => i.issueTypes.includes('no_card'));
                  const hasUnusual = grp.items.some((i) => i.issueTypes.includes('unusual_amount'));

                  return (
                    <tr key={grp.payee} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={tdStyle}>
                        <strong>{grp.payee}</strong>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ padding: '3px 8px', borderRadius: '12px', backgroundColor: '#EFF6FF', color: '#2563EB', fontWeight: 700, fontSize: '0.78rem' }}>
                          {grp.count} {isHe ? 'תנועות' : 'txs'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <strong style={{ color: '#0F172A' }}>
                          ₪{grp.totalAmount.toLocaleString('he-IL', { minimumFractionDigits: 2 })}
                        </strong>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {hasNoCat && (
                            <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#FEF3C7', color: '#B45309', fontWeight: 700 }}>
                              {isHe ? 'דורש סיווג' : 'No Category'}
                            </span>
                          )}
                          {hasNoCard && (
                            <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#EFF6FF', color: '#2563EB', fontWeight: 700 }}>
                              {isHe ? 'כרטיס כללי' : 'Generic Card'}
                            </span>
                          )}
                          {hasUnusual && (
                            <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#FCE7F3', color: '#BE185D', fontWeight: 700 }}>
                              {isHe ? 'סכום חריג' : 'Unusual Amount'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={tdStyle}>{grp.sampleDate}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <button
                          onClick={() => handleOpenBulkEdit(grp)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: '#2563EB',
                            color: '#FFFFFF',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Tag size={13} />
                          <span>{isHe ? 'סווג עסק במרוכז' : 'Assign'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Comprehensive Full Edit Modal */}
      {editModal.isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              maxWidth: '540px',
              width: '100%',
              padding: '26px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            dir={dir}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit3 size={20} color="#2563EB" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0F172A' }}>
                    {editModal.isBulk
                      ? (isHe ? 'סיווג ועדכון בית עסק במרוכז' : 'Bulk Edit Payee')
                      : (isHe ? 'עריכה ותיקון נתוני עסקה' : 'Edit & Fix Transaction')}
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                    {editModal.isBulk
                      ? (isHe ? 'השינויים יחולו על כל התנועות של עסק זה' : 'Applies to all matching payee transactions')
                      : (isHe ? 'עדכון מלא של סיווג, כרטיס ואישור סכומים' : 'Full update for category, card, and amount')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditModal((prev) => ({ ...prev, isOpen: false }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Payee Name */}
              <div>
                <label style={labelStyle}>{isHe ? 'שם בית העסק *' : 'Payee Name *'}</label>
                <input
                  type="text"
                  required
                  value={editModal.payeeName}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, payeeName: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              {/* Category Selector */}
              <div>
                <label style={labelStyle}>{isHe ? 'קטגוריה מתאימה *' : 'Category *'}</label>
                <select
                  required
                  value={editModal.categoryId}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, categoryId: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">{isHe ? '-- בחר קטגוריה --' : '-- Select Category --'}</option>
                  {macroCategories.map((macro) => {
                    const subCats = categories.filter((c) => c.macro_category_id === macro.id);
                    if (subCats.length === 0) return null;
                    return (
                      <optgroup key={macro.id} label={`${macro.icon || '📁'} ${macro.name}`}>
                        {subCats.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>

              {/* Card / Payment Method Assignment */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>
                    <CreditCard size={13} style={{ display: 'inline', marginInlineEnd: '4px' }} />
                    {isHe ? 'שיוך לכרטיס / אמצעי תשלום' : 'Payment Method / Card'}
                  </label>
                  <select
                    value={
                      cardMappings?.find((cm) => cm.card_last_digits && cm.card_last_digits === editModal.cardLastDigits)?.id ||
                      (editModal.paymentMethod === 'credit_card' ? '' : editModal.paymentMethod)
                    }
                    onChange={(e) => handleCardSelection(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="" disabled>
                      {isHe ? '-- בחר כרטיס או אמצעי תשלום --' : '-- Select Card or Method --'}
                    </option>
                    <optgroup label={isHe ? '💳 כרטיסי אשראי של המשפחה' : '💳 Family Credit Cards'}>
                      {cardMappings?.map((cm) => (
                        <option key={cm.id} value={cm.id}>
                          {cm.display_name} {cm.card_last_digits ? `(•••• ${cm.card_last_digits})` : ''}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label={isHe ? '🏦 אמצעי תשלום אחרים' : '🏦 Other Methods'}>
                      <option value="bank_transfer">{isHe ? '🏦 העברה בנקאית' : '🏦 Bank Transfer'}</option>
                      <option value="standing_order">{isHe ? '🔄 הוראת קבע' : '🔄 Standing Order'}</option>
                      <option value="cash">{isHe ? '💵 מזומן' : '💵 Cash'}</option>
                      <option value="check">{isHe ? '📑 המחאה (צ\'ק)' : '📑 Check'}</option>
                      <option value="bit">{isHe ? '📱 Bit / אפליקציה' : '📱 Bit / App'}</option>
                      <option value="other">{isHe ? '🔘 אחר' : '🔘 Other'}</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>{isHe ? '4 ספרות אחרונות' : 'Last 4 Digits'}</label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder={isHe ? '4 ספרות' : 'Last 4'}
                    value={editModal.cardLastDigits}
                    onChange={(e) => {
                      const val = e.target.value;
                      const matched = cardMappings?.find((cm) => cm.card_last_digits === val);
                      setEditModal((prev) => ({
                        ...prev,
                        cardLastDigits: val,
                        paymentMethod: matched ? matched.payment_type || 'credit_card' : prev.paymentMethod,
                      }));
                    }}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Amount, Type & Date (For single transaction) */}
              {!editModal.isBulk && (
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={labelStyle}>{isHe ? 'סכום (₪)' : 'Amount (₪)'}</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editModal.amount}
                      onChange={(e) => setEditModal((prev) => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>{isHe ? 'סוג תנועה' : 'Type'}</label>
                    <select
                      value={editModal.transactionType}
                      onChange={(e) => setEditModal((prev) => ({ ...prev, transactionType: e.target.value as any }))}
                      style={inputStyle}
                    >
                      <option value="expense">{isHe ? 'הוצאה' : 'Expense'}</option>
                      <option value="income">{isHe ? 'הכנסה' : 'Income'}</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>{isHe ? 'תאריך' : 'Date'}</label>
                    <input
                      type="date"
                      required
                      value={editModal.date}
                      onChange={(e) => setEditModal((prev) => ({ ...prev, date: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label style={labelStyle}>{isHe ? 'הערות' : 'Notes'}</label>
                <input
                  type="text"
                  placeholder={isHe ? 'הערה אישית...' : 'Optional notes...'}
                  value={editModal.notes}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, notes: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              {/* Approve Unusual Amount Checkbox */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '12px',
                  borderRadius: '10px',
                  backgroundColor: '#FEF3C7',
                  border: '1px solid #FDE68A',
                }}
              >
                <input
                  type="checkbox"
                  id="approve_unusual_check"
                  checked={editModal.approveUnusual}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, approveUnusual: e.target.checked }))}
                  style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                />
                <label htmlFor="approve_unusual_check" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#92400E', cursor: 'pointer' }}>
                  <strong>{isHe ? 'אשר סכום זה כתקין ומכוון' : 'Approve Unusual Amount'}</strong>
                  <div style={{ fontSize: '0.75rem', color: '#B45309', marginTop: '2px' }}>
                    {isHe
                      ? 'סמן שורה זו כבדוקה (למשל הפקדת חיסכון, העברה גדולה) כדי להסיר אותה מרשימת הסכומים החריגים.'
                      : 'Mark this amount as verified so it will no longer be flagged as unusual.'}
                  </div>
                </label>
              </div>

              {/* Bulk Apply to all & Save Rule Checkbox */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '12px',
                  borderRadius: '10px',
                  backgroundColor: '#F0FDF4',
                  border: '1px solid #DCFCE7',
                }}
              >
                <input
                  type="checkbox"
                  id="apply_all_check"
                  checked={editModal.applyToAll}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, applyToAll: e.target.checked }))}
                  style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                />
                <label htmlFor="apply_all_check" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#166534', cursor: 'pointer' }}>
                  <strong>{isHe ? 'החל על כל עסקאות העסק וצור חוק מיפוי עתידי' : 'Apply to all payee transactions and save rule'}</strong>
                  <div style={{ fontSize: '0.75rem', color: '#15803D', marginTop: '2px' }}>
                    {isHe
                      ? 'יעדכן את הקטגוריה ואמצעי התשלום בכל התנועות של עסק זה וישמור חוק אוטומטי לייבוא הבא.'
                      : 'Updates all matching transactions and saves rule for future imports.'}
                  </div>
                </label>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid #F1F5F9', paddingTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setEditModal((prev) => ({ ...prev, isOpen: false }))}
                  style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  {isHe ? 'ביטול' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: '#2563EB',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    boxShadow: '0 2px 6px rgba(37,99,235,0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {isSaving ? (
                    <>
                      <RefreshCw size={15} className="spin-icon" />
                      <span>{isHe ? 'שומר ב-DB...' : 'Saving...'}</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>{isHe ? 'שמור ועדכן תנועה' : 'Save Changes'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const kpiCardStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-surface, #FFFFFF)',
  borderRadius: '16px',
  border: '1px solid var(--border-subtle, #E2E8F0)',
  padding: '16px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
};

const kpiTopRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const kpiLabelStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--text-muted, #64748B)',
};

const kpiValueStyle: React.CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 800,
  color: 'var(--text-primary, #0F172A)',
};

const kpiSubStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  color: 'var(--text-muted, #94A3B8)',
};

const iconWrapStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const selectStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid #CBD5E1',
  fontSize: '0.85rem',
  backgroundColor: '#F8FAFC',
  cursor: 'pointer',
  outline: 'none',
};

const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontWeight: 700,
  color: '#475569',
  fontSize: '0.8rem',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  color: '#1E293B',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.82rem',
  fontWeight: 700,
  color: '#334155',
  marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1px solid #CBD5E1',
  fontSize: '0.88rem',
  backgroundColor: '#FFFFFF',
  outline: 'none',
  boxSizing: 'border-box',
};
