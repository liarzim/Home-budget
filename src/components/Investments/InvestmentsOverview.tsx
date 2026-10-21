import React, { useMemo } from 'react';
import {
  TrendingUp,
  Coins,
  ShieldCheck,
  Landmark,
  PieChart as PieIcon,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  User,
  Users,
  Percent,
  Layers,
  Calendar,
} from 'lucide-react';
import { InvestmentAsset, ManagementPillar } from '../../lib/types';

interface InvestmentsOverviewProps {
  investments: InvestmentAsset[];
  usdRate: number;
  onSelectPillar: (pillar: ManagementPillar) => void;
  isHe: boolean;
  dir: 'rtl' | 'ltr';
}

export const InvestmentsOverview: React.FC<InvestmentsOverviewProps> = ({
  investments,
  usdRate,
  onSelectPillar,
  isHe,
  dir,
}) => {
  const ArrowIcon = dir === 'rtl' ? ChevronLeft : ChevronRight;

  // Breakdown by pillar
  const pillarStats = useMemo(() => {
    let meitavValILS = 0;
    let meitavCostILS = 0;
    let meitavCount = 0;

    let bankSecValILS = 0;
    let bankSecCostILS = 0;
    let bankSecCount = 0;

    let depositsPrincipal = 0;
    let depositsAccrued = 0;
    let depositsCount = 0;

    let pensionTotal = 0;
    let pensionMonthly = 0;
    let pensionMichael = 0;
    let pensionOrna = 0;
    let pensionCount = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    investments.forEach((asset) => {
      const pillar = asset.management_pillar || 'meitav';

      // 1. Meitav & 2. Bank Securities
      if (pillar === 'meitav' || pillar === 'bank_securities') {
        let totalCostILS = 0;
        let totalShares = 0;
        (asset.tranches || []).forEach((tr) => {
          totalShares += tr.shares || 0;
          const cost = tr.total_cost ?? (tr.shares * tr.price_per_share);
          totalCostILS += asset.currency === 'USD' ? cost * usdRate : cost;
        });

        const marketValILS =
          asset.currency === 'USD'
            ? totalShares * (asset.current_price || 0) * usdRate
            : totalShares * (asset.current_price || 0);

        if (pillar === 'meitav') {
          meitavValILS += marketValILS;
          meitavCostILS += totalCostILS;
          meitavCount++;
        } else {
          bankSecValILS += marketValILS;
          bankSecCostILS += totalCostILS;
          bankSecCount++;
        }
      } else if (pillar === 'bank_deposits') {
        const principal = asset.original_principal || asset.current_price || 0;
        const rate = asset.interest_rate || 0;
        const startDate = asset.deposit_start_date ? new Date(asset.deposit_start_date) : null;
        let daysElapsed = 0;
        if (startDate && !isNaN(startDate.getTime())) {
          startDate.setHours(0, 0, 0, 0);
          daysElapsed = Math.max(0, Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
        }
        const grossAccrued = principal * (rate / 100) * (daysElapsed / 365);
        const netAccrued = grossAccrued * 0.85;

        depositsPrincipal += principal;
        depositsAccrued += netAccrued;
        depositsCount++;
      } else if (pillar === 'pension_provident') {
        const bal = asset.current_price || asset.original_principal || 0;
        const monthly = asset.monthly_deposit || 0;
        const member = asset.member_name || (asset.details && asset.details.member_name) || 'מיכאל';

        pensionTotal += bal;
        pensionMonthly += monthly;
        if (member === 'מיכאל') pensionMichael += bal;
        else if (member === 'אורנה') pensionOrna += bal;
        else {
          pensionMichael += bal / 2;
          pensionOrna += bal / 2;
        }
        pensionCount++;
      }
    });

    const depositsTotal = depositsPrincipal + depositsAccrued;
    const totalFamilyWealth = meitavValILS + bankSecValILS + depositsTotal + pensionTotal;

    const meitavProfit = meitavValILS - meitavCostILS;
    const meitavYield = meitavCostILS > 0 ? (meitavProfit / meitavCostILS) * 100 : 0;

    const bankSecProfit = bankSecValILS - bankSecCostILS;
    const bankSecYield = bankSecCostILS > 0 ? (bankSecProfit / bankSecCostILS) * 100 : 0;

    // Allocation percentages
    const pctEquities = totalFamilyWealth > 0 ? ((meitavValILS + bankSecValILS) / totalFamilyWealth) * 100 : 0;
    const pctDeposits = totalFamilyWealth > 0 ? (depositsTotal / totalFamilyWealth) * 100 : 0;
    const pctPension = totalFamilyWealth > 0 ? (pensionTotal / totalFamilyWealth) * 100 : 0;

    return {
      totalFamilyWealth,
      meitavValILS,
      meitavCostILS,
      meitavProfit,
      meitavYield,
      meitavCount,
      bankSecValILS,
      bankSecCostILS,
      bankSecProfit,
      bankSecYield,
      bankSecCount,
      depositsPrincipal,
      depositsAccrued,
      depositsTotal,
      depositsCount,
      pensionTotal,
      pensionMonthly,
      pensionMichael,
      pensionOrna,
      pensionCount,
      pctEquities,
      pctDeposits,
      pctPension,
    };
  }, [investments, usdRate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Total Family Wealth Hero Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          borderRadius: '20px',
          padding: '24px 28px',
          color: '#FFFFFF',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.3)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.25)',
                color: '#93C5FD',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: '1px solid rgba(147, 197, 253, 0.3)',
              }}
            >
              🌐 {isHe ? 'סקירת עושר והון משפחתי כולל' : 'Family Wealth Overview'}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
              {isHe ? `מבוסס שער דולר: ₪${usdRate.toFixed(2)}` : `USD Rate: ₪${usdRate.toFixed(2)}`}
            </span>
          </div>

          <h2 style={{ fontSize: '2.4rem', fontWeight: 900, margin: 0, letterSpacing: '-0.5px' }}>
            ₪{pillarStats.totalFamilyWealth.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
          </h2>
          <p style={{ margin: 0, color: '#94A3B8', fontSize: '0.9rem' }}>
            {isHe
              ? 'שווי כולל משוקלל: מניות ומדדים (מיטב ובנק) + פקדונות וחיסכון + קרנות השתלמות ופנסיה'
              : 'Aggregated total: stocks & ETFs + deposits + pensions & study funds'}
          </p>
        </div>

        {/* Quick Allocation Summary in Hero */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={heroMiniBox}>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{isHe ? 'מניות ומדדים' : 'Equities & ETFs'}</span>
            <strong style={{ fontSize: '1.2rem', color: '#60A5FA' }}>
              {pillarStats.pctEquities.toFixed(1)}%
            </strong>
          </div>
          <div style={heroMiniBox}>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{isHe ? 'פקדונות בנק' : 'Bank Deposits'}</span>
            <strong style={{ fontSize: '1.2rem', color: '#34D399' }}>
              {pillarStats.pctDeposits.toFixed(1)}%
            </strong>
          </div>
          <div style={heroMiniBox}>
            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{isHe ? 'פנסיה והשתלמות' : 'Pensions & Study'}</span>
            <strong style={{ fontSize: '1.2rem', color: '#F472B6' }}>
              {pillarStats.pctPension.toFixed(1)}%
            </strong>
          </div>
        </div>
      </div>

      {/* Visual Asset Allocation Bar */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface, #FFFFFF)',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle, #E2E8F0)',
          padding: '18px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PieIcon size={18} color="#2563EB" />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary, #0F172A)' }}>
              {isHe ? 'פילוח הקצאת נכסים ופיזור סיכונים (Asset Allocation)' : 'Asset Allocation Breakdown'}
            </h3>
          </div>
        </div>

        {/* Colored Bar */}
        <div style={{ width: '100%', height: '14px', borderRadius: '7px', display: 'flex', overflow: 'hidden', backgroundColor: '#E2E8F0' }}>
          <div
            style={{
              width: `${pillarStats.pctEquities}%`,
              backgroundColor: '#2563EB',
              transition: 'width 0.5s ease',
            }}
            title={`מניות ומדדים: ${pillarStats.pctEquities.toFixed(1)}%`}
          />
          <div
            style={{
              width: `${pillarStats.pctDeposits}%`,
              backgroundColor: '#10B981',
              transition: 'width 0.5s ease',
            }}
            title={`פקדונות בנק: ${pillarStats.pctDeposits.toFixed(1)}%`}
          />
          <div
            style={{
              width: `${pillarStats.pctPension}%`,
              backgroundColor: '#EC4899',
              transition: 'width 0.5s ease',
            }}
            title={`פנסיה והשתלמות: ${pillarStats.pctPension.toFixed(1)}%`}
          />
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', fontSize: '0.82rem', marginTop: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#2563EB' }} />
            <span style={{ color: '#475569' }}>
              {isHe ? 'מניות ומדדים (מיטב ובנק): ' : 'Equities & ETFs: '}
              <strong>₪{(pillarStats.meitavValILS + pillarStats.bankSecValILS).toLocaleString('he-IL', { maximumFractionDigits: 0 })}</strong> ({pillarStats.pctEquities.toFixed(1)}%)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10B981' }} />
            <span style={{ color: '#475569' }}>
              {isHe ? 'פקדונות וחסכונות (בנק): ' : 'Bank Deposits: '}
              <strong>₪{pillarStats.depositsTotal.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</strong> ({pillarStats.pctDeposits.toFixed(1)}%)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#EC4899' }} />
            <span style={{ color: '#475569' }}>
              {isHe ? 'קרנות השתלמות ופנסיה: ' : 'Pension & Study: '}
              <strong>₪{pillarStats.pensionTotal.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</strong> ({pillarStats.pctPension.toFixed(1)}%)
            </span>
          </div>
        </div>
      </div>

      {/* 4 Pillars Interactive Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {/* Pillar 1 Card: Meitav Trade */}
        <div style={pillarCardStyle}>
          <div style={pillarHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ ...pillarIconWrap, backgroundColor: '#EFF6FF' }}>
                <TrendingUp size={20} color="#2563EB" />
              </div>
              <div>
                <span style={pillarTagStyle}>{isHe ? 'עוגן 1' : 'Pillar 1'}</span>
                <h4 style={pillarTitleStyle}>{isHe ? 'מניות ומדדים — מיטב טרייד' : 'Meitav Trade Equities'}</h4>
              </div>
            </div>
            <span style={countPillStyle}>{pillarStats.meitavCount} ניירות</span>
          </div>

          <div style={{ marginTop: '12px' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748B' }}>{isHe ? 'שווי שוק נוכחי:' : 'Market Value:'}</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A' }}>
              ₪{pillarStats.meitavValILS.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '0.82rem' }}>
              <span style={{ color: pillarStats.meitavProfit >= 0 ? '#16A34A' : '#DC2626', fontWeight: 700 }}>
                {pillarStats.meitavProfit >= 0 ? '+' : ''}₪{pillarStats.meitavProfit.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
                {' '}({pillarStats.meitavYield.toFixed(2)}%)
              </span>
              <span style={{ color: '#94A3B8' }}>רווח כולל</span>
            </div>
          </div>

          <button
            onClick={() => onSelectPillar('meitav')}
            style={actionPillarBtn}
          >
            <span>{isHe ? 'פתח תיק מיטב (14 ניירות ערך)' : 'Open Meitav Portfolio'}</span>
            <ArrowIcon size={16} />
          </button>
        </div>

        {/* Pillar 2 Card: Bank Securities */}
        <div style={pillarCardStyle}>
          <div style={pillarHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ ...pillarIconWrap, backgroundColor: '#ECFDF5' }}>
                <Landmark size={20} color="#059669" />
              </div>
              <div>
                <span style={{ ...pillarTagStyle, color: '#059669' }}>{isHe ? 'עוגן 2' : 'Pillar 2'}</span>
                <h4 style={pillarTitleStyle}>{isHe ? 'מניות ומדדים — בנק' : 'Bank Securities'}</h4>
              </div>
            </div>
            <span style={countPillStyle}>{pillarStats.bankSecCount} ניירות</span>
          </div>

          <div style={{ marginTop: '12px' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748B' }}>{isHe ? 'שווי שוק נוכחי:' : 'Market Value:'}</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A' }}>
              ₪{pillarStats.bankSecValILS.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '0.82rem' }}>
              <span style={{ color: pillarStats.bankSecProfit >= 0 ? '#16A34A' : '#DC2626', fontWeight: 700 }}>
                {pillarStats.bankSecProfit >= 0 ? '+' : ''}₪{pillarStats.bankSecProfit.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
                {' '}({pillarStats.bankSecYield.toFixed(2)}%)
              </span>
              <span style={{ color: '#94A3B8' }}>רווח כולל</span>
            </div>
          </div>

          <button
            onClick={() => onSelectPillar('bank_securities')}
            style={{ ...actionPillarBtn, color: '#059669' }}
          >
            <span>{isHe ? 'פתח תיק ני"ע בבנק' : 'Open Bank Portfolio'}</span>
            <ArrowIcon size={16} />
          </button>
        </div>

        {/* Pillar 3 Card: Bank Deposits */}
        <div style={pillarCardStyle}>
          <div style={pillarHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ ...pillarIconWrap, backgroundColor: '#FEF3C7' }}>
                <Coins size={20} color="#D97706" />
              </div>
              <div>
                <span style={{ ...pillarTagStyle, color: '#D97706' }}>{isHe ? 'עוגן 3' : 'Pillar 3'}</span>
                <h4 style={pillarTitleStyle}>{isHe ? 'פקדונות וחסכונות — בנק' : 'Bank Deposits'}</h4>
              </div>
            </div>
            <span style={countPillStyle}>{pillarStats.depositsCount} פקדונות</span>
          </div>

          <div style={{ marginTop: '12px' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748B' }}>{isHe ? 'שווי נוכחי נטו לפדיון:' : 'Net Value:'}</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A' }}>
              ₪{pillarStats.depositsTotal.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '0.82rem' }}>
              <span style={{ color: '#16A34A', fontWeight: 700 }}>
                +₪{pillarStats.depositsAccrued.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
              </span>
              <span style={{ color: '#94A3B8' }}>ריבית נצברה נטו</span>
            </div>
          </div>

          <button
            onClick={() => onSelectPillar('bank_deposits')}
            style={{ ...actionPillarBtn, color: '#D97706' }}
          >
            <span>{isHe ? 'ניהול פקדונות ותחנות יציאה' : 'Manage Deposits'}</span>
            <ArrowIcon size={16} />
          </button>
        </div>

        {/* Pillar 4 Card: Pension & Study */}
        <div style={pillarCardStyle}>
          <div style={pillarHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ ...pillarIconWrap, backgroundColor: '#FDF2F8' }}>
                <ShieldCheck size={20} color="#DB2777" />
              </div>
              <div>
                <span style={{ ...pillarTagStyle, color: '#DB2777' }}>{isHe ? 'עוגן 4' : 'Pillar 4'}</span>
                <h4 style={pillarTitleStyle}>{isHe ? 'קרנות השתלמות ופנסיה' : 'Pensions & Study Funds'}</h4>
              </div>
            </div>
            <span style={countPillStyle}>{pillarStats.pensionCount} קופות</span>
          </div>

          <div style={{ marginTop: '12px' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748B' }}>{isHe ? 'סך צבירה פנסיונית:' : 'Total Pension:'}</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A' }}>
              ₪{pillarStats.pensionTotal.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '0.82rem' }}>
              <span style={{ color: '#2563EB', fontWeight: 600 }}>מיכאל: ₪{pillarStats.pensionMichael.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</span>
              <span style={{ color: '#CBD5E1' }}>|</span>
              <span style={{ color: '#DB2777', fontWeight: 600 }}>אורנה: ₪{pillarStats.pensionOrna.toLocaleString('he-IL', { maximumFractionDigits: 0 })}</span>
            </div>
          </div>

          <button
            onClick={() => onSelectPillar('pension_provident')}
            style={{ ...actionPillarBtn, color: '#DB2777' }}
          >
            <span>{isHe ? 'ניהול קופות ומסלולים' : 'Manage Pension Funds'}</span>
            <ArrowIcon size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

const heroMiniBox: React.CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.08)',
  borderRadius: '12px',
  padding: '10px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
};

const pillarCardStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-surface, #FFFFFF)',
  borderRadius: '16px',
  border: '1px solid var(--border-subtle, #E2E8F0)',
  padding: '18px 20px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  gap: '14px',
  boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
};

const pillarHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '8px',
};

const pillarIconWrap: React.CSSProperties = {
  width: '38px',
  height: '38px',
  borderRadius: '10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const pillarTagStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 800,
  color: '#2563EB',
  textTransform: 'uppercase',
};

const pillarTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1rem',
  fontWeight: 800,
  color: 'var(--text-primary, #0F172A)',
};

const countPillStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  padding: '3px 8px',
  borderRadius: '12px',
  backgroundColor: '#F1F5F9',
  color: '#475569',
};

const actionPillarBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 14px',
  borderRadius: '10px',
  border: '1px solid #E2E8F0',
  backgroundColor: '#F8FAFC',
  color: '#2563EB',
  fontWeight: 700,
  fontSize: '0.85rem',
  cursor: 'pointer',
  transition: 'background-color 0.2s',
  marginTop: '4px',
};
