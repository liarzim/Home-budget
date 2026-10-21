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

export const DataAuditScreen: React.FC = () => {
  const {
    activeHousehold,
    categories,
    macroCategories,
    language,
    dir,
    setActiveTab,
  } = useAuth();

  const isHe = language === 'he';

  const [isLoading, setIsLoading] = useState(true);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedIssue, setSelectedIssue] = useState<'all' | 'no_category' | 'no_card' | 'unusual_amount'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Categorize Modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [targetPayee, setTargetPayee] = useState<string>('');
  const [targetCategory, setTargetCategory] = useState<string>('');
  const [applyToAll, setApplyToAll] = useState(true);
  const [isSavingCategory, setIsSavingCategory] = useState(false);

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
      const pageSize = 1000;

      while (true) {
        const { data, error } = await supabase
          .from('transactions')
          .select('id, date, payee_name, amount, transaction_type, category_id, card_last_digits, payment_method, notes')
          .eq('household_id', activeHousehold.id)
          .order('date', { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;
        all = all.concat(data || []);
        if (!data || data.length < pageSize) break;
        from += pageSize;
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
        if (tx.payment_method === 'credit_card' && !tx.card_last_digits) {
          issues.push('no_card');
        }

        // 3. Unusual amounts (<=0 or unexpected)
        if (tx.amount <= 0 || tx.amount >= 100000) {
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
          payment_method: tx.payment_method,
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

  const handleOpenAssignModal = (payee: string) => {
    setTargetPayee(payee);
    setTargetCategory('');
    setApplyToAll(true);
    setAssignModalOpen(true);
  };

  const handleSaveCategoryAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCategory || !targetPayee) return;

    setIsSavingCategory(true);
    try {
      const matchingIds = allTransactions
        .filter((t) => (t.payee_name || '').trim().toLowerCase() === targetPayee.trim().toLowerCase())
        .map((t) => t.id);

      // 1. Update transactions in Supabase
      if (matchingIds.length > 0) {
        await supabase
          .from('transactions')
          .update({
            category_id: targetCategory,
            notes: null, // clear [דורש סיווג] flag
            updated_at: new Date().toISOString(),
          })
          .in('id', applyToAll ? matchingIds : [matchingIds[0]]);
      }

      // 2. Add rule to business_mapping for the future
      if (applyToAll && activeHousehold?.id) {
        await supabase.from('business_mapping').upsert(
          {
            household_id: activeHousehold.id,
            raw_business_name: targetPayee.trim(),
            category_id: targetCategory,
            match_type: 'contains',
          },
          { onConflict: 'household_id,raw_business_name' }
        );
      }

      // Refresh list locally
      setAssignModalOpen(false);
      await fetchTransactions();
    } catch (err) {
      console.error('Error assigning category:', err);
      alert('שגיאה בשמירת הקטגוריה');
    } finally {
      setIsSavingCategory(false);
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
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', backgroundColor: '#FEF3C7', borderRadius: '16px', border: '1px solid #FDE68A', fontSize: '0.75rem', fontWeight: 700, color: '#B45309', marginBottom: '8px' }}>
            <AlertTriangle size={14} color="#D97706" />
            <span>{isHe ? 'מרכז בקרת איכות וסיווג נתונים' : 'Data Audit & Gaps'}</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary, #0F172A)', margin: '0 0 6px 0' }}>
            {isHe ? 'בקרת נתונים, פערים וסיווג תנועות' : 'Data Quality & Gaps Audit'}
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted, #64748B)', margin: 0, maxWidth: '750px' }}>
            {isHe
              ? 'מסך ייעודי לזיהוי וטיפול בעסקאות שלא שויכו לקטגוריה ודאית, כרטיסים ללא 4 ספרות מזוהות, ובתי עסק חדשים שטרם הוגדרו בטבלאות.'
              : 'Review uncategorized transactions, unmapped cards, and data gaps across all loaded years.'}
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
            <span style={kpiLabelStyle}>{isHe ? 'בתי עסק ייחודיים לטיפול' : 'Unique Payees with Gaps'}</span>
            <div style={{ ...iconWrapStyle, backgroundColor: '#FDF2F8' }}>
              <Building2 size={18} color="#DB2777" />
            </div>
          </div>
          <div style={{ ...kpiValueStyle, color: '#BE185D' }}>
            {groupedByPayee.length}
          </div>
          <span style={kpiSubStyle}>{isHe ? 'ניתן לסווג במרוכז בלחיצה אחת' : 'Can be mapped in bulk'}</span>
        </div>
      </div>

      {/* Filter Bar */}
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
          {/* Year Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={15} color="#64748B" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
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
              onChange={(e) => setSelectedIssue(e.target.value as any)}
              style={selectStyle}
            >
              <option value="all">{isHe ? 'כל סוגי הפערים' : 'All Issues'}</option>
              <option value="no_category">{isHe ? 'ללא סיווג קטגוריה' : 'Missing Category'}</option>
              <option value="no_card">{isHe ? 'כרטיס ללא 4 ספרות' : 'Missing Card Digits'}</option>
              <option value="unusual_amount">{isHe ? 'סכומים חריגים / אפס' : 'Unusual Amounts'}</option>
            </select>
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <Search
              size={15}
              color="#94A3B8"
              style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [dir === 'rtl' ? 'right' : 'left']: '10px' }}
            />
            <input
              type="text"
              placeholder={isHe ? 'חיפוש בית עסק, סכום...' : 'Search payee, amount...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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

      {/* Main Content: Grouped by Payee */}
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
            {isHe ? 'מעולה! אין פערים או תנועות לא משויכות' : 'All Clear! No Gaps Found'}
          </h3>
          <p style={{ color: '#64748B', fontSize: '0.875rem', marginTop: '6px' }}>
            {isHe ? 'כל התנועות לשנה זו מסווגות בצורה תקינה לקטגוריות ולכרטיסים.' : 'All transactions are properly categorized.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                          </div>
                        </td>
                        <td style={tdStyle}>{grp.sampleDate}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <button
                            onClick={() => handleOpenAssignModal(grp.payee)}
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
                            <span>{isHe ? 'סווג עסק זה' : 'Assign'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Category Assignment Modal */}
      {assignModalOpen && (
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
              borderRadius: '18px',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            dir={dir}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Tag size={20} color="#2563EB" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0F172A' }}>
                  {isHe ? 'שיוך קטגוריה לבית עסק' : 'Assign Category'}
                </h3>
              </div>
              <button
                onClick={() => setAssignModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCategoryAssignment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '10px', fontSize: '0.85rem' }}>
                <span style={{ color: '#64748B', display: 'block' }}>{isHe ? 'שם בית העסק:' : 'Payee:'}</span>
                <strong style={{ fontSize: '1rem', color: '#0F172A' }}>{targetPayee}</strong>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  {isHe ? 'בחר קטגוריה מתאימה *' : 'Select Category *'}
                </label>
                <select
                  required
                  value={targetCategory}
                  onChange={(e) => setTargetCategory(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.9rem', backgroundColor: '#FFFFFF' }}
                >
                  <option value="">{isHe ? '-- בחר קטגוריה --' : '-- Select --'}</option>
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '6px' }}>
                <input
                  type="checkbox"
                  id="apply_all_check"
                  checked={applyToAll}
                  onChange={(e) => setApplyToAll(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="apply_all_check" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  {isHe ? 'החל על כל התנועות של עסק זה ושמור כחוק מיפוי עתידי' : 'Apply to all transactions and save rule'}
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isHe ? 'ביטול' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSavingCategory}
                  style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', backgroundColor: '#2563EB', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 6px rgba(37,99,235,0.3)' }}
                >
                  {isSavingCategory ? (isHe ? 'שומר...' : 'Saving...') : (isHe ? 'שמור וסווג' : 'Save & Classify')}
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
