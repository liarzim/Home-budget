import React, { useEffect } from 'react';
import {
  Menu,
  X,
  PieChart,
  Home,
  Receipt,
  PlusCircle,
  UploadCloud,
  Landmark,
  FileSpreadsheet,
  PiggyBank,
  Sliders,
  TableProperties,
  Database,
  Globe,
  LogOut,
  User,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  Plus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../lib/i18n';

interface SidebarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({ isOpen, onClose }) => {
  const {
    user,
    households,
    activeHousehold,
    activeTab,
    setActiveTab,
    isDemoMode,
    language,
    setLanguage,
    switchHousehold,
    logout,
    dir,
  } = useAuth();

  const [isHouseholdMenuOpen, setIsHouseholdMenuOpen] = React.useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scrolling when open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const navGroups = [
    {
      groupTitle: language === 'he' ? 'פעולות ראשיות' : 'Main Menu',
      items: [
        { id: 'dashboard', label: t('navOverview', language), icon: Home, badge: null },
        { id: 'transactions', label: t('navTransactions', language), icon: Receipt, badge: null },
        { id: 'manual-entry', label: t('navManualEntry', language), icon: PlusCircle, badge: language === 'he' ? 'חדש' : 'New' },
        { id: 'import', label: t('navImport', language), icon: UploadCloud, badge: null },
      ],
    },
    {
      groupTitle: language === 'he' ? 'בנקאות והגדרות מערכת' : 'Banking & System Tables',
      items: [
        { id: 'system-tables', label: t('navSystemTables', language), icon: TableProperties, badge: language === 'he' ? '4 טבלאות' : '4 Tables' },
        { id: 'bank-accounts', label: t('navBankSync', language), icon: Landmark, badge: 'Open Banking' },
        { id: 'migration', label: t('navMigration', language), icon: FileSpreadsheet, badge: language === 'he' ? 'שנתי' : 'Yearly' },
        { id: 'mappings', label: t('navMappings', language), icon: Sliders, badge: null },
      ],
    },
    {
      groupTitle: language === 'he' ? 'תכנון וחיסכון' : 'Planning & Wealth',
      items: [
        { id: 'budgets', label: t('navBudgets', language), icon: PieChart, badge: null },
        { id: 'savings', label: t('navSavings', language), icon: PiggyBank, badge: null },
        { id: 'schema', label: t('navSchema', language), icon: Database, badge: 'SQL' },
      ],
    },
  ] as const;

  const handleSelectTab = (tabId: any) => {
    setActiveTab(tabId);
    onClose();
  };

  return (
    <>
      {/* Backdrop Overlay */}
      <div
        style={{
          ...styles.overlay,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      {/* Slide-out Sidebar Drawer */}
      <aside
        style={{
          ...styles.drawer,
          ...(dir === 'rtl'
            ? { right: 0, transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }
            : { left: 0, transform: isOpen ? 'translateX(0)' : 'translateX(-100%)' }),
        }}
        aria-label="Side Navigation"
      >
        {/* Drawer Header */}
        <div style={styles.drawerHeader}>
          <div style={styles.brandRow}>
            <div style={styles.logoBox}>
              <PieChart size={20} color="var(--primary)" />
            </div>
            <div>
              <div style={styles.brandName}>
                {language === 'he' ? 'ניהול תקציב' : 'HomeBudget'}
              </div>
              <div style={styles.brandSubtitle}>
                {language === 'he' ? 'מערכת ניהול משק בית' : 'Household Budget App'}
              </div>
            </div>
          </div>

          <button
            style={styles.closeBtn}
            onClick={onClose}
            aria-label="Close Sidebar"
          >
            <X size={18} color="var(--text-secondary)" />
          </button>
        </div>

        {/* Quick Action: New Entry Button */}
        <div style={styles.quickActionBox}>
          <button
            style={styles.drawerNewEntryBtn}
            onClick={() => handleSelectTab('manual-entry')}
          >
            <PlusCircle size={16} color="#FFFFFF" />
            <span>{t('newEntryBtn', language)}</span>
          </button>
        </div>

        {/* Household Switcher Card */}
        <div style={styles.householdCard}>
          <div style={styles.householdCardHeader}>
            <span style={styles.householdCardLabel}>
              {language === 'he' ? 'משק בית פעיל:' : 'Active Household:'}
            </span>
            <span style={styles.currencyBadge}>{activeHousehold?.currency || 'ILS'}</span>
          </div>

          <button
            style={styles.householdSelectorBtn}
            onClick={() => setIsHouseholdMenuOpen(!isHouseholdMenuOpen)}
          >
            <div style={styles.householdDot} />
            <span style={styles.householdName}>
              {activeHousehold?.name || (language === 'he' ? 'בחר משק בית' : 'Select Household')}
            </span>
            <ChevronDown size={14} color="var(--text-secondary)" />
          </button>

          {isHouseholdMenuOpen && (
            <div style={styles.householdDropdown}>
              {households.map((h) => (
                <button
                  key={h.id}
                  style={{
                    ...styles.hhItem,
                    ...(h.id === activeHousehold?.id ? styles.hhItemActive : {}),
                  }}
                  onClick={() => {
                    switchHousehold(h.id);
                    setIsHouseholdMenuOpen(false);
                  }}
                >
                  <span>{h.name}</span>
                  <span style={styles.hhRoleTag}>{h.role || 'member'}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation Item Groups */}
        <div style={styles.navScrollArea}>
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} style={styles.navGroup}>
              <div style={styles.groupTitle}>{group.groupTitle}</div>
              <div style={styles.groupItemsList}>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      style={{
                        ...styles.navItemBtn,
                        ...(isActive ? styles.navItemBtnActive : {}),
                      }}
                      onClick={() => handleSelectTab(item.id)}
                    >
                      <div style={styles.navItemLeft}>
                        <Icon
                          size={18}
                          color={isActive ? 'var(--primary)' : 'var(--text-secondary)'}
                          strokeWidth={isActive ? 2.3 : 1.8}
                        />
                        <span
                          style={{
                            ...styles.navItemText,
                            ...(isActive ? styles.navItemTextActive : {}),
                          }}
                        >
                          {item.label}
                        </span>
                      </div>

                      {item.badge && (
                        <span
                          style={{
                            ...styles.itemBadge,
                            ...(isActive ? styles.itemBadgeActive : {}),
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Drawer Footer */}
        <div style={styles.drawerFooter}>
          {/* Language Switcher */}
          <button
            style={styles.footerActionBtn}
            onClick={() => setLanguage(language === 'he' ? 'en' : 'he')}
          >
            <Globe size={16} color="var(--text-secondary)" />
            <span>{language === 'he' ? 'English (LTR)' : 'עברית (RTL)'}</span>
          </button>

          {/* User Profile & Logout */}
          <div style={styles.profileRow}>
            <div style={styles.profileInfo}>
              <div style={styles.avatarWrap}>
                <User size={15} color="var(--primary)" />
              </div>
              <div style={styles.userNameBlock}>
                <div style={styles.userNameText}>
                  {user?.full_name || user?.email?.split('@')[0] || 'משתמש'}
                </div>
                <div style={styles.userEmailText}>{user?.email || 'demo@local'}</div>
              </div>
            </div>

            <button
              style={styles.logoutIconButton}
              onClick={() => {
                onClose();
                logout();
              }}
              title={t('logout', language)}
            >
              <LogOut size={16} color="var(--danger)" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    backdropFilter: 'blur(3px)',
    zIndex: 999,
    transition: 'opacity 0.25s ease',
  },
  drawer: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    width: '300px',
    maxWidth: '85vw',
    backgroundColor: 'var(--bg-surface)',
    borderLeft: '1px solid var(--border-main)',
    borderRight: '1px solid var(--border-main)',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 'var(--shadow-xl)',
    transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
    overflow: 'hidden',
  },
  drawerHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 20px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logoBox: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    backgroundColor: 'var(--primary-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: '1rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    lineHeight: 1.2,
  },
  brandSubtitle: {
    fontSize: '0.6875rem',
    color: 'var(--text-muted)',
  },
  closeBtn: {
    padding: '6px',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  },
  quickActionBox: {
    padding: '14px 18px 6px',
  },
  drawerNewEntryBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 14px',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: '700',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)',
    transition: 'all 0.15s ease',
  },
  householdCard: {
    margin: '10px 18px',
    padding: '10px 12px',
    backgroundColor: 'var(--bg-surface-subtle)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-subtle)',
  },
  householdCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '6px',
  },
  householdCardLabel: {
    fontSize: '0.6875rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  currencyBadge: {
    fontSize: '0.6875rem',
    fontWeight: '700',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-main)',
    padding: '1px 6px',
    borderRadius: '4px',
    color: 'var(--text-secondary)',
  },
  householdSelectorBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 8px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-main)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    textAlign: 'inherit',
  },
  householdDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    backgroundColor: 'var(--success)',
  },
  householdName: {
    flex: 1,
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  householdDropdown: {
    marginTop: '6px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  hhItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 8px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: 'transparent',
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    textAlign: 'inherit',
  },
  hhItemActive: {
    backgroundColor: 'var(--primary-light)',
    color: 'var(--primary)',
    fontWeight: '700',
  },
  hhRoleTag: {
    fontSize: '0.625rem',
    padding: '1px 5px',
    backgroundColor: 'var(--bg-surface)',
    borderRadius: '3px',
    color: 'var(--text-muted)',
  },
  navScrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 14px 20px',
  },
  navGroup: {
    marginBottom: '16px',
  },
  groupTitle: {
    fontSize: '0.6875rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '4px 8px 8px',
  },
  groupItemsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  navItemBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    textAlign: 'inherit',
  },
  navItemBtnActive: {
    backgroundColor: 'var(--primary-light)',
  },
  navItemLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  navItemText: {
    fontSize: '0.875rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
  },
  navItemTextActive: {
    color: 'var(--primary)',
    fontWeight: '700',
  },
  itemBadge: {
    fontSize: '0.625rem',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-surface-subtle)',
    color: 'var(--text-muted)',
  },
  itemBadgeActive: {
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
  },
  drawerFooter: {
    padding: '14px 18px',
    borderTop: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--bg-surface)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  footerActionBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  profileRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: '6px',
  },
  profileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    overflow: 'hidden',
  },
  avatarWrap: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: 'var(--primary-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  userNameBlock: {
    overflow: 'hidden',
  },
  userNameText: {
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userEmailText: {
    fontSize: '0.6875rem',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  logoutIconButton: {
    padding: '7px',
    borderRadius: '6px',
    backgroundColor: 'var(--danger-light)',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
};
