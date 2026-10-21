import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  TrendingUp,
  User,
  Plus,
  Trash2,
  Edit2,
  Building2,
  Calendar,
  Wallet,
  Clock,
  Search,
  Filter,
  X,
  PieChart,
  Percent,
} from 'lucide-react';
import { InvestmentAsset } from '../../lib/types';

interface PensionFundsViewProps {
  funds: InvestmentAsset[];
  onAddFund: (asset: Omit<InvestmentAsset, 'id' | 'created_at' | 'updated_at'>) => void;
  onUpdateFund: (id: string, updates: Partial<InvestmentAsset>) => void;
  onDeleteFund: (id: string) => void;
  isHe: boolean;
  dir: 'rtl' | 'ltr';
}

const INSTITUTIONS = [
  'הראל',
  'אלטשולר שחם',
  'מיטב',
  'מנורה מבטחים',
  'הפניקס',
  'מגדל',
  'ילין לפידות',
  'מור',
  'אנליסט',
  'אחר',
];

const FUND_TYPES = [
  { id: 'study', he: 'קרן השתלמות', en: 'Study Fund (Hishtalmut)' },
  { id: 'pension', he: 'קרן פנסיה מקיפה', en: 'Comprehensive Pension' },
  { id: 'provident', he: 'קופת גמל להשקעה', en: 'Provident Fund (Gemel)' },
  { id: 'managers_insurance', he: 'ביטוח מנהלים', en: "Managers' Insurance" },
];

const INVESTMENT_TRACKS = [
  'מחקה מדד S&P 500',
  'מסלול מניות כללי',
  'מסלול כללי (משולב)',
  'מסלול אג"ח ללא מניות',
  'מסלול עוקב מדדים עולמי',
  'מסלול כספי / סולידי',
  'מסלול הלכתי',
  'אחר',
];

export const PensionFundsView: React.FC<PensionFundsViewProps> = ({
  funds,
  onAddFund,
  onUpdateFund,
  onDeleteFund,
  isHe,
  dir,
}) => {
  const [selectedMember, setSelectedMember] = useState<'all' | 'מיכאל' | 'אורנה'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInstitutionFilter, setSelectedInstitutionFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFundId, setEditingFundId] = useState<string | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formInstitution, setFormInstitution] = useState('הראל');
  const [formMember, setFormMember] = useState<'מיכאל' | 'אורנה' | 'משותף'>('מיכאל');
  const [formFundType, setFormFundType] = useState('קרן השתלמות');
  const [formTrack, setFormTrack] = useState('מחקה מדד S&P 500');
  const [formBalance, setFormBalance] = useState('');
  const [formMonthlyDeposit, setFormMonthlyDeposit] = useState('');
  const [formFeeAcc, setFormFeeAcc] = useState('0.6');
  const [formFeeDep, setFormFeeDep] = useState('0');
  const [formLiquidityYear, setFormLiquidityYear] = useState('נזיל כעת');
  const [formIsLiquid, setFormIsLiquid] = useState(true);
  const [formNotes, setFormNotes] = useState('');

  // Filtered funds
  const filteredFunds = useMemo(() => {
    return funds.filter((f) => {
      const member = f.member_name || (f.details && f.details.member_name) || 'מיכאל';
      const matchesMember = selectedMember === 'all' || member === selectedMember;
      const matchesSearch =
        (f.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f.institution || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f.investment_track || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesInstitution = selectedInstitutionFilter === 'all' || f.institution === selectedInstitutionFilter;
      return matchesMember && matchesSearch && matchesInstitution;
    });
  }, [funds, selectedMember, searchTerm, selectedInstitutionFilter]);

  // Aggregate stats
  const stats = useMemo(() => {
    let totalBalance = 0;
    let totalMonthlyDeposit = 0;
    let balanceMichael = 0;
    let balanceOrna = 0;
    let liquidAmount = 0;

    funds.forEach((f) => {
      const bal = f.current_price || f.original_principal || 0;
      const monthly = f.monthly_deposit || 0;
      const member = f.member_name || (f.details && f.details.member_name) || 'מיכאל';
      const isLiquid = f.is_liquid || f.liquidity_year === 'נזיל כעת' || false;

      totalBalance += bal;
      totalMonthlyDeposit += monthly;

      if (member === 'מיכאל') balanceMichael += bal;
      else if (member === 'אורנה') balanceOrna += bal;
      else {
        balanceMichael += bal / 2;
        balanceOrna += bal / 2;
      }

      if (isLiquid) liquidAmount += bal;
    });

    return {
      totalBalance,
      totalMonthlyDeposit,
      balanceMichael,
      balanceOrna,
      liquidAmount,
    };
  }, [funds]);

  const handleOpenAdd = () => {
    setEditingFundId(null);
    setFormName('');
    setFormInstitution('הראל');
    setFormMember('מיכאל');
    setFormFundType('קרן השתלמות');
    setFormTrack('מחקה מדד S&P 500');
    setFormBalance('');
    setFormMonthlyDeposit('');
    setFormFeeAcc('0.6');
    setFormFeeDep('0');
    setFormLiquidityYear('נזיל כעת');
    setFormIsLiquid(true);
    setFormNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (f: any) => {
    setEditingFundId(f.id);
    setFormName(f.name || '');
    setFormInstitution(f.institution || 'הראל');
    setFormMember(f.member_name || (f.details && f.details.member_name) || 'מיכאל');
    setFormFundType(f.details?.fund_type || 'קרן השתלמות');
    setFormTrack(f.investment_track || 'מחקה מדד S&P 500');
    setFormBalance(String(f.current_price || f.original_principal || ''));
    setFormMonthlyDeposit(String(f.monthly_deposit || ''));
    setFormFeeAcc(String(f.management_fee_accumulation ?? '0.6'));
    setFormFeeDep(String(f.management_fee_deposit ?? '0'));
    setFormLiquidityYear(f.liquidity_year || 'נזיל כעת');
    setFormIsLiquid(Boolean(f.is_liquid ?? (f.liquidity_year === 'נזיל כעת')));
    setFormNotes(f.notes || (f.details && f.details.notes) || '');
    setIsModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    const balNum = parseFloat(formBalance) || 0;
    const monthlyNum = parseFloat(formMonthlyDeposit) || 0;
    const feeAccNum = parseFloat(formFeeAcc) || 0;
    const feeDepNum = parseFloat(formFeeDep) || 0;

    const payload: any = {
      management_pillar: 'pension_provident',
      institution: formInstitution,
      ticker: `PEN-${Date.now().toString().slice(-6)}`,
      name: formName || `${formFundType} - ${formInstitution}`,
      currency: 'ILS',
      current_price: balNum,
      asset_type: 'other',
      original_principal: balNum,
      member_name: formMember,
      investment_track: formTrack,
      monthly_deposit: monthlyNum,
      management_fee_accumulation: feeAccNum,
      management_fee_deposit: feeDepNum,
      liquidity_year: formLiquidityYear,
      is_liquid: formIsLiquid,
      tranches: [
        {
          id: `tr-${Date.now()}`,
          date: new Date().toISOString().substring(0, 10),
          shares: 1,
          price_per_share: balNum,
          total_cost: balNum,
          fee: 0,
          notes: formNotes || `עדכון יתרה צבורה - ${formTrack}`,
        },
      ],
      details: {
        fund_type: formFundType,
        notes: formNotes,
      },
    };

    if (editingFundId) {
      onUpdateFund(editingFundId, payload);
    } else {
      onAddFund(payload);
    }
    setIsModalOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardLabelStyle}>{isHe ? 'סך צבירה פנסיונית והשתלמות' : 'Total Pension & Study'}</span>
            <div style={{ ...iconWrapStyle, backgroundColor: '#FDF2F8' }}>
              <ShieldCheck size={18} color="#DB2777" />
            </div>
          </div>
          <div style={{ ...cardValueStyle, color: '#9D174D' }}>
            ₪{stats.totalBalance.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
          </div>
          <span style={cardSubStyle}>{isHe ? `${funds.length} קופות וקרנות רשומות` : `${funds.length} funds`}</span>
        </div>

        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardLabelStyle}>{isHe ? 'חלוקה: מיכאל מול אורנה' : 'Michael vs Orna'}</span>
            <div style={{ ...iconWrapStyle, backgroundColor: '#EFF6FF' }}>
              <User size={18} color="#2563EB" />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: '#2563EB', fontWeight: 600 }}>מיכאל:</span>
              <strong>₪{stats.balanceMichael.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: '#DB2777', fontWeight: 600 }}>אורנה:</span>
              <strong>₪{stats.balanceOrna.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</strong>
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardLabelStyle}>{isHe ? 'הפקדה חודשית שוטפת (סה"כ)' : 'Monthly Deposits'}</span>
            <div style={{ ...iconWrapStyle, backgroundColor: '#ECFDF5' }}>
              <Wallet size={18} color="#059669" />
            </div>
          </div>
          <div style={{ ...cardValueStyle, color: '#059669' }}>
            ₪{stats.totalMonthlyDeposit.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
          </div>
          <span style={cardSubStyle}>{isHe ? 'הפרשות עובד + מעביד בחודש' : 'Employee + Employer per month'}</span>
        </div>

        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={cardLabelStyle}>{isHe ? 'סך הון נזיל כעת' : 'Currently Liquid'}</span>
            <div style={{ ...iconWrapStyle, backgroundColor: '#FEF3C7' }}>
              <Clock size={18} color="#D97706" />
            </div>
          </div>
          <div style={{ ...cardValueStyle, color: '#B45309' }}>
            ₪{stats.liquidAmount.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
          </div>
          <span style={cardSubStyle}>{isHe ? 'קרנות השתלמות וגמל זמינות לפדיון' : 'Liquid funds for withdrawal'}</span>
        </div>
      </div>

      {/* Member Filter Pills & Action Bar */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '4px', backgroundColor: '#F1F5F9', padding: '4px', borderRadius: '10px' }}>
            <button
              onClick={() => setSelectedMember('all')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                backgroundColor: selectedMember === 'all' ? '#FFFFFF' : 'transparent',
                color: selectedMember === 'all' ? '#0F172A' : '#64748B',
                boxShadow: selectedMember === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {isHe ? 'כל המשפחה' : 'All Members'}
            </button>
            <button
              onClick={() => setSelectedMember('מיכאל')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                backgroundColor: selectedMember === 'מיכאל' ? '#2563EB' : 'transparent',
                color: selectedMember === 'מיכאל' ? '#FFFFFF' : '#64748B',
                boxShadow: selectedMember === 'מיכאל' ? '0 1px 3px rgba(37,99,235,0.3)' : 'none',
              }}
            >
              👨 מיכאל
            </button>
            <button
              onClick={() => setSelectedMember('אורנה')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                backgroundColor: selectedMember === 'אורנה' ? '#DB2777' : 'transparent',
                color: selectedMember === 'אורנה' ? '#FFFFFF' : '#64748B',
                boxShadow: selectedMember === 'אורנה' ? '0 1px 3px rgba(219,39,119,0.3)' : 'none',
              }}
            >
              👩 אורנה
            </button>
          </div>

          <div style={{ position: 'relative', minWidth: '180px' }}>
            <Search
              size={15}
              color="#94A3B8"
              style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [dir === 'rtl' ? 'right' : 'left']: '10px' }}
            />
            <input
              type="text"
              placeholder={isHe ? 'חיפוש קופה / מסלול...' : 'Search fund...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px',
                [dir === 'rtl' ? 'paddingRight' : 'paddingLeft']: '30px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.85rem',
                backgroundColor: '#F8FAFC',
                outline: 'none',
              }}
            />
          </div>

          <select
            value={selectedInstitutionFilter}
            onChange={(e) => setSelectedInstitutionFilter(e.target.value)}
            style={{
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              fontSize: '0.85rem',
              backgroundColor: '#F8FAFC',
              cursor: 'pointer',
            }}
          >
            <option value="all">{isHe ? 'כל החברות' : 'All Companies'}</option>
            {INSTITUTIONS.map((inst) => (
              <option key={inst} value={inst}>
                {inst}
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
            padding: '9px 16px',
            backgroundColor: '#DB2777',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '0.875rem',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(219, 39, 119, 0.25)',
          }}
        >
          <Plus size={16} />
          <span>{isHe ? '+ הוסף קופה / קרן' : '+ Add Fund'}</span>
        </button>
      </div>

      {/* Funds Cards */}
      {filteredFunds.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '50px 20px',
            backgroundColor: 'var(--bg-surface, #FFFFFF)',
            borderRadius: '16px',
            border: '1px dashed var(--border-subtle, #CBD5E1)',
          }}
        >
          <Building2 size={44} color="#94A3B8" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary, #0F172A)' }}>
            {isHe ? 'אין קרנות או קופות להצגה' : 'No pension funds to show'}
          </h3>
          <p style={{ color: 'var(--text-muted, #64748B)', fontSize: '0.875rem', marginTop: '6px', maxWidth: '420px', margin: '6px auto 16px' }}>
            {isHe
              ? 'לחץ על "+ הוסף קופה / קרן" כדי להזין קרנות השתלמות, קרנות פנסיה מקיפות וקופות גמל של מיכאל ואורנה.'
              : 'Add study funds and pensions to track balances, tracks and liquidity.'}
          </p>
          <button
            onClick={handleOpenAdd}
            style={{
              padding: '10px 20px',
              backgroundColor: '#DB2777',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {isHe ? '+ הוסף קופה ראשונה' : '+ Add First Fund'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filteredFunds.map((f) => {
            const member = f.member_name || (f.details && f.details.member_name) || 'מיכאל';
            const bal = f.current_price || f.original_principal || 0;
            const isLiquid = f.is_liquid || f.liquidity_year === 'נזיל כעת';

            return (
              <div
                key={f.id}
                style={{
                  backgroundColor: 'var(--bg-surface, #FFFFFF)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-subtle, #E2E8F0)',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                }}
              >
                {/* Header: Member badge, Institution, Actions */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor: member === 'מיכאל' ? '#EFF6FF' : '#FDF2F8',
                        color: member === 'מיכאל' ? '#2563EB' : '#DB2777',
                        border: `1px solid ${member === 'מיכאל' ? '#BFDBFE' : '#FBCFE8'}`,
                      }}
                    >
                      {member === 'מיכאל' ? '👨 מיכאל' : '👩 אורנה'}
                    </div>

                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>
                      {f.institution || 'חברה מנהלת'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      onClick={() => handleOpenEdit(f)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#64748B' }}
                      title={isHe ? 'ערוך קופה' : 'Edit'}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(isHe ? `האם למחוק את "${f.name}"?` : `Delete "${f.name}"?`)) {
                          onDeleteFund(f.id);
                        }
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#EF4444' }}
                      title={isHe ? 'מחק קופה' : 'Delete'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Title & Track */}
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
                    {f.name}
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                    <TrendingUp size={13} color="#059669" />
                    <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 600 }}>
                      {f.investment_track || 'מסלול השקעה'}
                    </span>
                  </div>
                </div>

                {/* Status & Liquidity Pill */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    backgroundColor: isLiquid ? '#DCFCE7' : '#FEF3C7',
                    color: isLiquid ? '#15803D' : '#B45309',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    width: 'fit-content',
                  }}
                >
                  <Clock size={12} />
                  <span>{isLiquid ? (isHe ? 'נזיל כעת' : 'Liquid Now') : `${isHe ? 'נזיל בשנת' : 'Liquid in'} ${f.liquidity_year}`}</span>
                </div>

                {/* Stats Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                    backgroundColor: '#F8FAFC',
                    padding: '12px',
                    borderRadius: '12px',
                    fontSize: '0.82rem',
                  }}
                >
                  <div>
                    <span style={{ color: '#64748B', display: 'block' }}>{isHe ? 'יתרה צבורה:' : 'Balance:'}</span>
                    <strong style={{ fontSize: '1.05rem', color: '#0F172A' }}>
                      ₪{bal.toLocaleString('he-IL')}
                    </strong>
                  </div>

                  <div>
                    <span style={{ color: '#64748B', display: 'block' }}>{isHe ? 'הפקדה חודשית:' : 'Monthly Deposit:'}</span>
                    <strong style={{ fontSize: '0.95rem', color: '#059669' }}>
                      ₪{(f.monthly_deposit || 0).toLocaleString('he-IL')}
                    </strong>
                  </div>

                  <div>
                    <span style={{ color: '#64748B', display: 'block' }}>{isHe ? 'דמי ניהול מצבירה:' : 'Mgmt Fee (Acc):'}</span>
                    <strong>{f.management_fee_accumulation ?? '—'}%</strong>
                  </div>

                  <div>
                    <span style={{ color: '#64748B', display: 'block' }}>{isHe ? 'דמי ניהול מהפקדה:' : 'Mgmt Fee (Dep):'}</span>
                    <strong>{f.management_fee_deposit ?? '—'}%</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add / Edit Pension Fund */}
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
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#FDF2F8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck size={20} color="#DB2777" />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>
                  {editingFundId
                    ? isHe ? 'עריכת קופת גמל / פנסיה' : 'Edit Pension Fund'
                    : isHe ? 'הוספת קרן השתלמות / פנסיה' : 'Add Study / Pension Fund'}
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
                <label style={labelStyle}>{isHe ? 'שם הקופה / תיאור *' : 'Fund Name *'}</label>
                <input
                  type="text"
                  required
                  placeholder={isHe ? 'למשל: הראל השתלמות S&P 500, פנסיה מקיפה מיטב' : 'e.g. Harel S&P 500 Study Fund'}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>{isHe ? 'עמית (בעל הקופה) *' : 'Member *'}</label>
                  <select
                    value={formMember}
                    onChange={(e) => setFormMember(e.target.value as any)}
                    style={inputStyle}
                  >
                    <option value="מיכאל">👨 מיכאל</option>
                    <option value="אורנה">👩 אורנה</option>
                    <option value="משותף">👥 משותף</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>{isHe ? 'חברה מנהלת *' : 'Institution *'}</label>
                  <select
                    value={formInstitution}
                    onChange={(e) => setFormInstitution(e.target.value)}
                    style={inputStyle}
                  >
                    {INSTITUTIONS.map((inst) => (
                      <option key={inst} value={inst}>
                        {inst}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>{isHe ? 'סוג מוצר' : 'Product Type'}</label>
                  <select
                    value={formFundType}
                    onChange={(e) => setFormFundType(e.target.value)}
                    style={inputStyle}
                  >
                    {FUND_TYPES.map((t) => (
                      <option key={t.id} value={t.he}>
                        {t.he}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>{isHe ? 'מסלול השקעה' : 'Track'}</label>
                  <select
                    value={formTrack}
                    onChange={(e) => setFormTrack(e.target.value)}
                    style={inputStyle}
                  >
                    {INVESTMENT_TRACKS.map((tr) => (
                      <option key={tr} value={tr}>
                        {tr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>{isHe ? 'יתרה צבורה מעודכנת (₪) *' : 'Accumulated Balance (₪) *'}</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="250000"
                    value={formBalance}
                    onChange={(e) => setFormBalance(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>{isHe ? 'הפקדה חודשית שוטפת (₪)' : 'Monthly Deposit (₪)'}</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="1571"
                    value={formMonthlyDeposit}
                    onChange={(e) => setFormMonthlyDeposit(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>{isHe ? 'דמי ניהול מצבירה (%)' : 'Mgmt Fee Acc (%)'}</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.6"
                    value={formFeeAcc}
                    onChange={(e) => setFormFeeAcc(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>{isHe ? 'דמי ניהול מהפקדה (%)' : 'Mgmt Fee Dep (%)'}</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={formFeeDep}
                    onChange={(e) => setFormFeeDep(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>{isHe ? 'שנת נזילות' : 'Liquidity Year'}</label>
                  <input
                    type="text"
                    placeholder={isHe ? 'לדוגמה: נזיל כעת / 2027 / 2029' : 'e.g. Liquid Now / 2027'}
                    value={formLiquidityYear}
                    onChange={(e) => setFormLiquidityYear(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '24px' }}>
                  <input
                    type="checkbox"
                    id="is_liquid_check"
                    checked={formIsLiquid}
                    onChange={(e) => setFormIsLiquid(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="is_liquid_check" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                    {isHe ? 'הכסף נזיל לפדיון מיידי' : 'Funds are currently liquid'}
                  </label>
                </div>
              </div>

              <div>
                <label style={labelStyle}>{isHe ? 'הערות נוספות' : 'Notes'}</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder={isHe ? 'מספר עמית, הערות מדוח שנתי...' : 'Policy number, notes...'}
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
                    backgroundColor: '#DB2777',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(219, 39, 119, 0.3)',
                  }}
                >
                  {isHe ? 'שמור קופה' : 'Save Fund'}
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
