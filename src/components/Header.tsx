import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  PieChart,
  Home,
  ChevronDown,
  Plus,
  Receipt,
  PiggyBank,
  Sparkles,
  Database,
  LogOut,
  Sliders,
  User,
  UploadCloud,
  PlusCircle,
  FileSpreadsheet,
  Landmark,
  Globe,
} from 'lucide-react';
import { t } from '../lib/i18n';

export const Header: React.FC = () => {
  const {
    user,
    households,
    activeHousehold,
    activeTab,
    setActiveTab,
    isDemoMode,
    isSupabaseReady,
    language,
    setLanguage,
    switchHousehold,
    logout,
    addHousehold,
  } = useAuth();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAddHhModalOpen, setIsAddHhModalOpen] = useState(false);
  const [newHhName, setNewHhName] = useState('');
  const [newHhCurrency, setNewHhCurrency] = useState('ILS');

  const handleCreateHousehold = (e: React.FormEvent) => {
    e.preventDefault();
    if (newHhName.trim()) {
      addHousehold(newHhName.trim(), newHhCurrency);
      setNewHhName('');
      setIsAddHhModalOpen(false);
      setIsDropdownOpen(false);
    }
  };

  const navItems = [
    { id: 'dashboard', label: t('navOverview', language), icon: Home },
    { id: 'transactions', label: t('navTransactions', language), icon: Receipt },
    { id: 'manual-entry', label: t('navManualEntry', language), icon: PlusCircle },
    { id: 'import', label: t('navImport', language), icon: UploadCloud },
    { id: 'bank-accounts', label: t('navBankSync', language), icon: Landmark },
    { id: 'migration', label: t('navMigration', language), icon: FileSpreadsheet },
    { id: 'budgets', label: t('navBudgets', language), icon: PieChart },
    { id: 'savings', label: t('navSavings', language), icon: PiggyBank },
    { id: 'mappings', label: t('navMappings', language), icon: Sliders },
    { id: 'schema', label: t('navSchema', language), icon: Database },
  ] as const;

  return (
    <header style={styles.headerContainer}>
      {/* Top Navbar Row */}
      <div style={styles.topRow}>
        <div style={styles.leftSection}>
          <button
            style={styles.brandBadge}
            onClick={() => setActiveTab('dashboard')}
          >
            <div style={styles.logoBox}>
              <PieChart size={18} color="var(--primary)" />
            </div>
            <span style={styles.brandName}>
              {language === 'he' ? 'ניהול תקציב' : 'HomeBudget'}
            </span>
          </button>

          {/* Household Tenant Switcher */}
          <div style={styles.tenantSwitcherWrapper}>
            <button
              style={styles.tenantSelectorBtn}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <div style={styles.tenantIndicatorDot} />
              <span style={styles.tenantName}>
                {activeHousehold?.name || (language === 'he' ? 'בחר משק בית' : 'Select Household')}
              </span>
              <span style={styles.currencyPill}>{activeHousehold?.currency || 'ILS'}</span>
              <ChevronDown size={14} color="var(--text-secondary)" />
            </button>

            {isDropdownOpen && (
              <div style={styles.dropdownMenu} className="animate-fade-in">
                <div style={styles.dropdownHeader}>
                  {language === 'he' ? 'החלף משק בית' : 'Switch Household'}
                </div>
                {households.map((h) => (
                  <button
                    key={h.id}
                    style={{
                      ...styles.dropdownItem,
                      ...(h.id === activeHousehold?.id ? styles.dropdownItemActive : {}),
                    }}
                    onClick={() => {
                      switchHousehold(h.id);
                      setIsDropdownOpen(false);
                    }}
                  >
                    <span
                      style={{
                        ...styles.dropdownItemText,
                        ...(h.id === activeHousehold?.id ? styles.dropdownItemTextActive : {}),
                      }}
                    >
                      {h.name}
                    </span>
                    <span style={styles.dropdownRoleTag}>{h.role || 'member'}</span>
                  </button>
                ))}

                <button
                  style={styles.addHhBtn}
                  onClick={() => {
                    setIsDropdownOpen(false);
                    setIsAddHhModalOpen(true);
                  }}
                >
                  <Plus size={14} color="var(--primary)" />
                  <span style={styles.addHhText}>
                    {language === 'he' ? '+ צור משק בית חדש' : 'Add New Household'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Quick Manual Entry Top Bar Button */}
        <button
          style={styles.topBarNewEntryBtn}
          onClick={() => setActiveTab('manual-entry')}
          title={t('newEntryBtn', language)}
        >
          <PlusCircle size={15} color="#FFFFFF" />
          <span>{t('newEntryBtn', language)}</span>
        </button>

        {/* Right Section */}
        <div style={styles.rightSection}>
          {/* Language Switcher Toggle */}
          <button
            style={styles.langToggleBtn}
            onClick={() => setLanguage(language === 'he' ? 'en' : 'he')}
            title="Toggle Language (עברית / English)"
          >
            <Globe size={14} color="var(--text-secondary)" />
            <span>{language === 'he' ? 'English' : 'עברית'}</span>
          </button>

          {isDemoMode && (
            <div style={styles.demoBadge}>
              <Sparkles size={12} color="var(--warning-text)" />
              <span>{language === 'he' ? 'מצב הדגמה' : 'Demo Mode'}</span>
            </div>
          )}

          <div style={styles.userProfilePill}>
            <div style={styles.avatarCircle}>
              <User size={14} color="var(--primary)" />
            </div>
            <span style={styles.userName}>
              {user?.full_name || user?.email?.split('@')[0] || 'משתמש'}
            </span>
          </div>

          <button
            style={styles.logoutBtn}
            onClick={logout}
            title={t('logout', language)}
          >
            <LogOut size={16} color="var(--text-secondary)" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div style={styles.tabsRow}>
        {navItems.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              style={{
                ...styles.tabButton,
                ...(isActive ? styles.tabButtonActive : {}),
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={15} color={isActive ? 'var(--primary)' : 'var(--text-secondary)'} />
              <span style={{ ...styles.tabText, ...(isActive ? styles.tabTextActive : {}) }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Add Household Modal */}
      {isAddHhModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard} className="animate-fade-in">
            <h3 style={styles.modalTitle}>Create New Household</h3>
            <p style={styles.modalSubtitle}>
              Create a new isolated household tenant with its own categories, budgets, and members.
            </p>

            <form onSubmit={handleCreateHousehold}>
              <div style={styles.formGroup}>
                <label style={styles.inputLabel}>Household Name</label>
                <input
                  style={styles.textInput}
                  type="text"
                  placeholder="e.g. Vacation Home, Apartment 12"
                  value={newHhName}
                  onChange={(e) => setNewHhName(e.target.value)}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.inputLabel}>Default Currency</label>
                <input
                  style={styles.textInput}
                  type="text"
                  placeholder="ILS, USD, EUR..."
                  value={newHhCurrency}
                  onChange={(e) => setNewHhCurrency(e.target.value)}
                  required
                />
              </div>

              <div style={styles.modalActionRow}>
                <button
                  type="button"
                  style={styles.cancelBtn}
                  onClick={() => setIsAddHhModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.submitBtn}>
                  Create Tenant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  headerContainer: {
    backgroundColor: 'var(--bg-surface)',
    borderBottom: '1px solid var(--border-main)',
    position: 'sticky',
    top: 0,
    zIndex: 50,
  },
  topRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 28px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  leftSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  brandBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  logoBox: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    backgroundColor: 'var(--primary-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: '1.125rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
  },
  tenantSwitcherWrapper: {
    position: 'relative',
  },
  tenantSelectorBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'var(--bg-surface-subtle)',
    padding: '6px 14px',
    borderRadius: '20px',
    border: '1px solid var(--border-main)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  tenantIndicatorDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--success)',
  },
  tenantName: {
    maxWidth: '180px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  currencyPill: {
    fontSize: '0.6875rem',
    fontWeight: '800',
    color: 'var(--primary)',
    backgroundColor: 'var(--primary-light)',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  dropdownMenu: {
    position: 'absolute',
    top: '40px',
    left: 0,
    width: '260px',
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-main)',
    padding: '8px',
    boxShadow: 'var(--shadow-xl)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100,
  },
  dropdownHeader: {
    fontSize: '0.6875rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    padding: '4px 8px',
    marginBottom: '4px',
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 10px',
    borderRadius: 'var(--radius-sm)',
    textAlign: 'left',
    width: '100%',
  },
  dropdownItemActive: {
    backgroundColor: 'var(--primary-light)',
  },
  dropdownItemText: {
    fontSize: '0.8125rem',
    fontWeight: '500',
    color: 'var(--text-primary)',
  },
  dropdownItemTextActive: {
    fontWeight: '700',
    color: 'var(--primary)',
  },
  dropdownRoleTag: {
    fontSize: '0.6875rem',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-surface-subtle)',
    padding: '2px 6px',
    borderRadius: '4px',
    textTransform: 'capitalize',
  },
  addHhBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 8px',
    marginTop: '6px',
    borderTop: '1px solid var(--border-subtle)',
    width: '100%',
  },
  addHhText: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--primary)',
  },
  topBarNewEntryBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 14px',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: '700',
    border: 'none',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-sm)',
    transition: 'all 0.15s ease',
  },
  rightSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  langToggleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '5px 10px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-main)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  demoBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    backgroundColor: 'var(--warning-light)',
    padding: '4px 10px',
    borderRadius: '12px',
    border: '1px solid #FDE68A',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--warning-text)',
  },
  userProfilePill: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'var(--bg-surface-subtle)',
    padding: '6px 12px',
    borderRadius: '20px',
  },
  avatarCircle: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    backgroundColor: 'var(--primary-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  logoutBtn: {
    padding: '8px',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-surface-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsRow: {
    display: 'flex',
    padding: '0 28px',
    gap: '6px',
    overflowX: 'auto',
  },
  tabButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '12px 14px',
    borderBottom: '2px solid transparent',
    color: 'var(--text-secondary)',
    fontSize: '0.8125rem',
    fontWeight: '500',
    transition: 'all 0.15s ease',
  },
  tabButtonActive: {
    borderBottom: '2px solid var(--primary)',
    color: 'var(--primary)',
  },
  tabText: {},
  tabTextActive: {
    fontWeight: '700',
    color: 'var(--primary)',
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
    maxWidth: '440px',
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
    marginBottom: '20px',
    lineHeight: '1.4',
  },
  formGroup: {
    marginBottom: '16px',
  },
  inputLabel: {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: '6px',
  },
  textInput: {
    width: '100%',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-sm)',
    padding: '9px 12px',
    color: 'var(--text-primary)',
  },
  modalActionRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '20px',
  },
  cancelBtn: {
    padding: '9px 16px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-surface-subtle)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  submitBtn: {
    padding: '9px 18px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    fontSize: '0.8125rem',
    fontWeight: '600',
  },
};
