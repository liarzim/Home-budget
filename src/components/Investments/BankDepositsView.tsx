import React, { useState, useMemo } from 'react';
import {
  Coins,
  Calendar,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  Landmark,
  Percent,
  Search,
  ChevronDown,
  X,
  ShieldCheck,
} from 'lucide-react';
import { InvestmentAsset } from '../../lib/types';

interface BankDepositsViewProps {
  deposits: InvestmentAsset[];
  onAddDeposit: (asset: Omit<InvestmentAsset, 'id' | 'created_at' | 'updated_at'>) => void;
  onUpdateDeposit: (id: string, updates: Partial<InvestmentAsset>) => void;
  onDeleteDeposit: (id: string) => void;
  isHe: boolean;
  dir: 'rtl' | 'ltr';
}

const ISRAELI_BANKS = [
  'בנק הפועלים',
  'בנק לאומי',
  'בנק דיסקונט',
  'בנק מזרחי טפחות',
  'הבנק הבינלאומי',
  'בנק יהב',
  'בנק מסד',
  'וואן זירו (One Zero)',
  'בנק ירושלים',
  'אחר',
];

export const BankDepositsView: React.FC<BankDepositsViewProps> = ({
  deposits,
  onAddDeposit,
  onUpdateDeposit,
  onDeleteDeposit,
  isHe,
  dir,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBankFilter, setSelectedBankFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDepositId, setEditingDepositId] = useState<string | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formBank, setFormBank] = useState('בנק הפועלים');
  const [formPrincipal, setFormPrincipal] = useState('');
  const [formInterestType, setFormInterestType] = useState<'fixed' | 'prime' | 'cpi_linked'>('fixed');
  const [formInterestRate, setFormInterestRate] = useState('');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().substring(0, 10));
  const [formMaturityDate, setFormMaturityDate] = useState('');
  const [formNextExitDate, setFormNextExitDate] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Calculations for each deposit
  const calculatedDeposits = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return deposits.map((dep) => {
      const principal = dep.original_principal || dep.current_price || 0;
      const rate = dep.interest_rate || 0;
      const startDate = dep.deposit_start_date ? new Date(dep.deposit_start_date) : null;
      
      let daysElapsed = 0;
      if (startDate && !isNaN(startDate.getTime())) {
        startDate.setHours(0, 0, 0, 0);
        daysElapsed = Math.max(0, Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      }

      // Simple interest formula: Principal * (Rate / 100) * (days / 365)
      const accruedInterestGross = principal * (rate / 100) * (daysElapsed / 365);
      const estimatedTax = accruedInterestGross * 0.15; // 15% nominal tax in Israel
      const accruedInterestNet = Math.max(0, accruedInterestGross - estimatedTax);
      const currentValueGross = principal + accruedInterestGross;
      const currentValueNet = principal + accruedInterestNet;

      // Exit / Maturity status
      let daysToNextExit: number | null = null;
      let exitBadge = { label: 'ללא תחנה מוגדרת', color: '#64748B', bg: '#F1F5F9' };

      if (dep.next_exit_date) {
        const exitDate = new Date(dep.next_exit_date);
        exitDate.setHours(0, 0, 0, 0);
        daysToNextExit = Math.floor((exitDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysToNextExit < 0) {
          exitBadge = { label: 'תחנת יציאה עברה / נזיל', color: '#16A34A', bg: '#DCFCE7' };
        } else if (daysToNextExit <= 7) {
          exitBadge = { label: `תחנת יציאה בעוד ${daysToNextExit} ימים!`, color: '#DC2626', bg: '#FEE2E2' };
        } else if (daysToNextExit <= 30) {
          exitBadge = { label: `תחנת יציאה בעוד ${daysToNextExit} ימים`, color: '#D97706', bg: '#FEF3C7' };
        } else {
          exitBadge = { label: `תחנת יציאה בעוד ${daysToNextExit} ימים`, color: '#2563EB', bg: '#EFF6FF' };
        }
      } else if (dep.maturity_date) {
        const matDate = new Date(dep.maturity_date);
        matDate.setHours(0, 0, 0, 0);
        daysToNextExit = Math.floor((matDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysToNextExit < 0) {
          exitBadge = { label: 'מועד פירעון עבר', color: '#16A34A', bg: '#DCFCE7' };
        } else {
          exitBadge = { label: `פירעון בעוד ${daysToNextExit} ימים`, color: '#475569', bg: '#F8FAFC' };
        }
      }

      return {
        ...dep,
        principal,
        rate,
        daysElapsed,
        accruedInterestGross,
        accruedInterestNet,
        currentValueGross,
        currentValueNet,
        daysToNextExit,
        exitBadge,
      };
    });
  }, [deposits]);

  // Aggregate stats
  const totals = useMemo(() => {
    return calculatedDeposits.reduce(
      (acc, d) => {
        acc.totalPrincipal += d.principal;
        acc.totalAccruedGross += d.accruedInterestGross;
        acc.totalAccruedNet += d.accruedInterestNet;
        acc.totalValueNet += d.currentValueNet;
        return acc;
      },
      { totalPrincipal: 0, totalAccruedGross: 0, totalAccruedNet: 0, totalValueNet: 0 }
    );
  }, [calculatedDeposits]);

  // Filtered deposits
  const filteredDeposits = useMemo(() => {
    return calculatedDeposits.filter((d) => {
      const matchesSearch =
        (d.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.institution || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesBank = selectedBankFilter === 'all' || d.institution === selectedBankFilter;
      return matchesSearch && matchesBank;
    });
  }, [calculatedDeposits, searchTerm, selectedBankFilter]);

  const handleOpenAdd = () => {
    setEditingDepositId(null);
    setFormName('');
    setFormBank('בנק הפועלים');
    setFormPrincipal('');
    setFormInterestType('fixed');
    setFormInterestRate('4.10');
    setFormStartDate(new Date().toISOString().substring(0, 10));
    setFormMaturityDate('');
    setFormNextExitDate('');
    setFormNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (dep: any) => {
    setEditingDepositId(dep.id);
    setFormName(dep.name || '');
    setFormBank(dep.institution || 'בנק הפועלים');
    setFormPrincipal(String(dep.principal || dep.original_principal || ''));
    setFormInterestType(dep.interest_type || 'fixed');
    setFormInterestRate(String(dep.interest_rate || ''));
    setFormStartDate(dep.deposit_start_date || new Date().toISOString().substring(0, 10));
    setFormMaturityDate(dep.maturity_date || '');
    setFormNextExitDate(dep.next_exit_date || '');
    setFormNotes(dep.notes || (dep.details && dep.details.notes) || '');
    setIsModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    const principalNum = parseFloat(formPrincipal) || 0;
    const rateNum = parseFloat(formInterestRate) || 0;

    const depositPayload: any = {
      management_pillar: 'bank_deposits',
      institution: formBank,
      ticker: `DEP-${Date.now().toString().slice(-6)}`,
      name: formName || `פקדון ${formBank}`,
      currency: 'ILS',
      current_price: principalNum,
      asset_type: 'other',
      original_principal: principalNum,
      interest_rate: rateNum,
      interest_type: formInterestType,
      deposit_start_date: formStartDate,
      maturity_date: formMaturityDate || undefined,
      next_exit_date: formNextExitDate || undefined,
      tranches: [
        {
          id: `tr-${Date.now()}`,
          date: formStartDate,
          shares: 1,
          price_per_share: principalNum,
          total_cost: principalNum,
          fee: 0,
          notes: formNotes || `הפקדת קרן מקורית בריבית ${rateNum}%`,
        },
      ],
      details: {
        notes: formNotes,
      },
    };

    if (editingDepositId) {
      onUpdateDeposit(editingDepositId, depositPayload);
    } else {
      onAddDeposit(depositPayload);
    }
    setIsModalOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* KPI Cards for Bank Deposits */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardLabelStyle}>{isHe ? 'סך קרן בפקדונות' : 'Total Principal'}</span>
            <div style={{ ...iconWrapStyle, backgroundColor: '#EFF6FF' }}>
              <Coins size={18} color="#2563EB" />
            </div>
          </div>
          <div style={cardValueStyle}>
            ₪{totals.totalPrincipal.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
          </div>
          <span style={cardSubStyle}>{isHe ? `${deposits.length} פקדונות וחסכונות` : `${deposits.length} accounts`}</span>
        </div>

        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardLabelStyle}>{isHe ? 'ריבית שנצברה (ברוטו)' : 'Accrued Interest (Gross)'}</span>
            <div style={{ ...iconWrapStyle, backgroundColor: '#ECFDF5' }}>
              <Percent size={18} color="#059669" />
            </div>
          </div>
          <div style={{ ...cardValueStyle, color: '#059669' }}>
            +₪{totals.totalAccruedGross.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
          </div>
          <span style={cardSubStyle}>{isHe ? 'חישוב יומי מצטבר ממועד הפקדה' : 'Calculated daily to date'}</span>
        </div>

        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardLabelStyle}>{isHe ? 'שווי נוכחי נטו (לאחר מס משוער)' : 'Net Value After Tax'}</span>
            <div style={{ ...iconWrapStyle, backgroundColor: '#FEF3C7' }}>
              <ShieldCheck size={18} color="#D97706" />
            </div>
          </div>
          <div style={{ ...cardValueStyle, color: '#B45309' }}>
            ₪{totals.totalValueNet.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
          </div>
          <span style={cardSubStyle}>
            {isHe
              ? `ריבית נטו: +₪${totals.totalAccruedNet.toLocaleString('he-IL', { maximumFractionDigits: 0 })} (בניכוי 15% מס)`
              : `Net interest: +₪${totals.totalAccruedNet.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`}
          </span>
        </div>
      </div>

      {/* Action Bar: Search, Bank Filter & Add Button */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={16}
              color="#94A3B8"
              style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [dir === 'rtl' ? 'right' : 'left']: '12px' }}
            />
            <input
              type="text"
              placeholder={isHe ? 'חיפוש פקדון או בנק...' : 'Search deposit or bank...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                [dir === 'rtl' ? 'paddingRight' : 'paddingLeft']: '36px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle, #CBD5E1)',
                fontSize: '0.875rem',
                backgroundColor: 'var(--bg-app, #F8FAFC)',
                outline: 'none',
              }}
            />
          </div>

          <select
            value={selectedBankFilter}
            onChange={(e) => setSelectedBankFilter(e.target.value)}
            style={{
              padding: '9px 12px',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle, #CBD5E1)',
              fontSize: '0.875rem',
              backgroundColor: 'var(--bg-app, #F8FAFC)',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            <option value="all">{isHe ? 'כל הבנקים' : 'All Banks'}</option>
            {ISRAELI_BANKS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleOpenAdd}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            backgroundColor: '#0284C7',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '0.875rem',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
          }}
        >
          <Plus size={16} />
          <span>{isHe ? '+ הוסף פקדון חדש' : '+ Add Bank Deposit'}</span>
        </button>
      </div>

      {/* Deposits List / Cards */}
      {filteredDeposits.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '50px 20px',
            backgroundColor: 'var(--bg-surface, #FFFFFF)',
            borderRadius: '16px',
            border: '1px dashed var(--border-subtle, #CBD5E1)',
          }}
        >
          <Landmark size={44} color="#94A3B8" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary, #0F172A)' }}>
            {isHe ? 'אין פקדונות להצגה' : 'No deposits to show'}
          </h3>
          <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.875rem', marginTop: '6px', maxWidth: '420px', margin: '6px auto 16px' }}>
            {isHe
              ? 'לחץ על "+ הוסף פקדון חדש" כדי להזין פקדונות בנקאיים, תוכניות חיסכון ופח"ק עם חישוב ריבית ותחנות יציאה.'
              : 'Add bank deposits and savings accounts to track interest and exit stations.'}
          </p>
          <button
            onClick={handleOpenAdd}
            style={{
              padding: '10px 20px',
              backgroundColor: '#0284C7',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {isHe ? '+ הוסף פקדון ראשון' : '+ Add First Deposit'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filteredDeposits.map((dep) => (
            <div
              key={dep.id}
              style={{
                backgroundColor: 'var(--bg-surface, #FFFFFF)',
                borderRadius: '16px',
                border: '1px solid var(--border-subtle, #E2E8F0)',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              }}
            >
              {/* Card Top: Bank, Name, Actions */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      backgroundColor: '#EFF6FF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Landmark size={20} color="#0284C7" />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary, #0F172A)' }}>
                      {dep.name}
                    </h4>
                    <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>
                      {dep.institution || 'בנק'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    onClick={() => handleOpenEdit(dep)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#64748B' }}
                    title={isHe ? 'ערוך פקדון' : 'Edit'}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(isHe ? `האם למחוק את הפקדון "${dep.name}"?` : `Delete deposit "${dep.name}"?`)) {
                        onDeleteDeposit(dep.id);
                      }
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#EF4444' }}
                    title={isHe ? 'מחק פקדון' : 'Delete'}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Status Badge: Next exit station */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  backgroundColor: dep.exitBadge.bg,
                  color: dep.exitBadge.color,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  width: 'fit-content',
                }}
              >
                <Clock size={13} />
                <span>{dep.exitBadge.label}</span>
              </div>

              {/* Grid of details */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  backgroundColor: 'var(--bg-app, #F8FAFC)',
                  padding: '12px',
                  borderRadius: '12px',
                  fontSize: '0.82rem',
                }}
              >
                <div>
                  <span style={{ color: '#64748B', display: 'block' }}>{isHe ? 'סכום הקרן:' : 'Principal:'}</span>
                  <strong style={{ fontSize: '0.95rem', color: '#0F172A' }}>
                    ₪{dep.principal.toLocaleString('he-IL')}
                  </strong>
                </div>

                <div>
                  <span style={{ color: '#64748B', display: 'block' }}>{isHe ? 'ריבית שנתית:' : 'Annual Rate:'}</span>
                  <strong style={{ fontSize: '0.95rem', color: '#0284C7' }}>
                    {dep.rate}% ({dep.interest_type === 'prime' ? 'פריים' : dep.interest_type === 'cpi_linked' ? 'צמוד מדד' : 'קבועה'})
                  </strong>
                </div>

                <div>
                  <span style={{ color: '#64748B', display: 'block' }}>{isHe ? 'ריבית נצברה (ברוטו):' : 'Accrued Gross:'}</span>
                  <strong style={{ color: '#16A34A' }}>
                    +₪{dep.accruedInterestGross.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
                  </strong>
                </div>

                <div>
                  <span style={{ color: '#64748B', display: 'block' }}>{isHe ? 'שווי נטו לפדיון:' : 'Net Value:'}</span>
                  <strong style={{ color: '#B45309' }}>
                    ₪{dep.currentValueNet.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
                  </strong>
                </div>
              </div>

              {/* Dates Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748B', borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
                <span>
                  {isHe ? 'תאריך פתיחה: ' : 'Start: '}
                  <strong>{dep.deposit_start_date || '—'}</strong>
                </span>
                {dep.maturity_date && (
                  <span>
                    {isHe ? 'פירעון: ' : 'Maturity: '}
                    <strong>{dep.maturity_date}</strong>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Add / Edit Bank Deposit */}
      {isModalOpen && (
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
              maxWidth: '520px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            dir={dir}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Landmark size={20} color="#0284C7" />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>
                  {editingDepositId
                    ? isHe ? 'עריכת פקדון בנקאי' : 'Edit Bank Deposit'
                    : isHe ? 'הוספת פקדון / חיסכון בנקאי' : 'Add Bank Deposit / Savings'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveModal} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>{isHe ? 'שם הפקדון / תיאור *' : 'Deposit Name *'}</label>
                <input
                  type="text"
                  required
                  placeholder={isHe ? 'לדוגמה: פקדון פריים שנתי, פח"ק חודשי' : 'e.g. 1-Year Prime Deposit'}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>{isHe ? 'בנק מנהל *' : 'Bank *'}</label>
                  <select
                    value={formBank}
                    onChange={(e) => setFormBank(e.target.value)}
                    style={inputStyle}
                  >
                    {ISRAELI_BANKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>{isHe ? 'סכום הקרן המקורית (₪) *' : 'Principal Amount (₪) *'}</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="100000"
                    value={formPrincipal}
                    onChange={(e) => setFormPrincipal(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>{isHe ? 'סוג ריבית' : 'Interest Type'}</label>
                  <select
                    value={formInterestType}
                    onChange={(e) => setFormInterestType(e.target.value as any)}
                    style={inputStyle}
                  >
                    <option value="fixed">{isHe ? 'ריבית קבועה' : 'Fixed Rate'}</option>
                    <option value="prime">{isHe ? 'צמודת פריים (P)' : 'Prime Linked'}</option>
                    <option value="cpi_linked">{isHe ? 'צמודת מדד' : 'CPI Linked'}</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>{isHe ? 'אחוז ריבית שנתית (%) *' : 'Annual Interest (%) *'}</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="4.15"
                    value={formInterestRate}
                    onChange={(e) => setFormInterestRate(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>{isHe ? 'תאריך פתיחה / הפקדה' : 'Start Date'}</label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>{isHe ? 'תחנת יציאה קרובה' : 'Next Exit Date'}</label>
                  <input
                    type="date"
                    value={formNextExitDate}
                    onChange={(e) => setFormNextExitDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>{isHe ? 'מועד פירעון סופי' : 'Maturity Date'}</label>
                <input
                  type="date"
                  value={formMaturityDate}
                  onChange={(e) => setFormMaturityDate(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>{isHe ? 'הערות נוספות' : 'Notes'}</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder={isHe ? 'מספר חשבון, תנאי שבירה מיוחדים...' : 'Account number, conditions...'}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {isHe ? 'ביטול' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 22px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: '#0284C7',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)',
                  }}
                >
                  {isHe ? 'שמור פקדון' : 'Save Deposit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-surface, #FFFFFF)',
  borderRadius: '16px',
  border: '1px solid var(--border-subtle, #E2E8F0)',
  padding: '16px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const cardLabelStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 600,
  color: 'var(--text-muted, #64748B)',
};

const cardValueStyle: React.CSSProperties = {
  fontSize: '1.45rem',
  fontWeight: 800,
  color: 'var(--text-primary, #0F172A)',
};

const cardSubStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-muted, #94A3B8)',
};

const iconWrapStyle: React.CSSProperties = {
  width: '34px',
  height: '34px',
  borderRadius: '10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: '#334155',
  marginBottom: '4px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: '10px',
  border: '1px solid #CBD5E1',
  fontSize: '0.875rem',
  outline: 'none',
  backgroundColor: '#F8FAFC',
};
