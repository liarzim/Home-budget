import React from 'react';
import {
  Home,
  Receipt,
  Plus,
  UploadCloud,
  PieChart,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { t } from '../lib/i18n';

export const MobileBottomNav: React.FC = () => {
  const { activeTab, setActiveTab, language } = useAuth();

  return (
    <nav style={styles.bottomNavContainer} aria-label="Bottom Navigation">
      <div style={styles.innerNavContent}>
        {/* 1. Overview */}
        <button
          style={{
            ...styles.navTab,
            ...(activeTab === 'dashboard' ? styles.navTabActive : {}),
          }}
          onClick={() => setActiveTab('dashboard')}
        >
        <Home
          size={20}
          color={activeTab === 'dashboard' ? 'var(--primary)' : 'var(--text-muted)'}
        />
        <span
          style={{
            ...styles.tabLabel,
            ...(activeTab === 'dashboard' ? styles.tabLabelActive : {}),
          }}
        >
          {t('tabOverview', language)}
        </span>
      </button>

      {/* 2. Transactions Ledger */}
      <button
        style={{
          ...styles.navTab,
          ...(activeTab === 'transactions' ? styles.navTabActive : {}),
        }}
        onClick={() => setActiveTab('transactions')}
      >
        <Receipt
          size={20}
          color={activeTab === 'transactions' ? 'var(--primary)' : 'var(--text-muted)'}
        />
        <span
          style={{
            ...styles.tabLabel,
            ...(activeTab === 'transactions' ? styles.tabLabelActive : {}),
          }}
        >
          {t('tabLedger', language)}
        </span>
      </button>

      {/* 3. Center Raised Add Action Button */}
      <div style={styles.centerButtonWrap}>
        <button
          style={{
            ...styles.centerAddButton,
            ...(activeTab === 'manual-entry' ? styles.centerAddButtonActive : {}),
          }}
          onClick={() => setActiveTab('manual-entry')}
          aria-label={t('tabAdd', language)}
        >
          <Plus size={24} color="#FFFFFF" strokeWidth={2.5} />
        </button>
      </div>

      {/* 4. Investments & Capital Market */}
      <button
        style={{
          ...styles.navTab,
          ...(activeTab === 'investments' ? styles.navTabActive : {}),
        }}
        onClick={() => setActiveTab('investments')}
      >
        <TrendingUp
          size={20}
          color={activeTab === 'investments' ? 'var(--primary)' : 'var(--text-muted)'}
        />
        <span
          style={{
            ...styles.tabLabel,
            ...(activeTab === 'investments' ? styles.tabLabelActive : {}),
          }}
        >
          {t('tabInvestments', language)}
        </span>
      </button>

      {/* 5. Budgets & Savings */}
      <button
        style={{
          ...styles.navTab,
          ...(activeTab === 'budgets' || activeTab === 'savings' ? styles.navTabActive : {}),
        }}
        onClick={() => setActiveTab('budgets')}
      >
        <PieChart
          size={20}
          color={
            activeTab === 'budgets' || activeTab === 'savings'
              ? 'var(--primary)'
              : 'var(--text-muted)'
          }
        />
        <span
          style={{
            ...styles.tabLabel,
            ...(activeTab === 'budgets' || activeTab === 'savings' ? styles.tabLabelActive : {}),
          }}
        >
          {t('tabBudgets', language)}
        </span>
      </button>
      </div>
    </nav>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  bottomNavContainer: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: '64px',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    backdropFilter: 'blur(16px)',
    borderTop: '1px solid var(--border-main)',
    boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 990,
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  },
  innerNavContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: '680px',
    height: '100%',
    margin: '0 auto',
    padding: '0 8px',
  },
  navTab: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    flex: 1,
    height: '100%',
    padding: '4px 0',
  },
  navTabActive: {
    color: 'var(--primary)',
  },
  tabLabel: {
    fontSize: '0.6875rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
    transition: 'color 0.15s ease',
  },
  tabLabelActive: {
    color: 'var(--primary)',
    fontWeight: '700',
  },
  centerButtonWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    top: '-12px',
  },
  centerAddButton: {
    width: '50px',
    height: '50px',
    borderRadius: '25px',
    backgroundColor: 'var(--primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '3px solid #FFFFFF',
    boxShadow: '0 6px 16px rgba(37, 99, 235, 0.35)',
    cursor: 'pointer',
    transition: 'transform 0.15s ease',
  },
  centerAddButtonActive: {
    transform: 'scale(1.05)',
    boxShadow: '0 8px 20px rgba(37, 99, 235, 0.5)',
  },
};
