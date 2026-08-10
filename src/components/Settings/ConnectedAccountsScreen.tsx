import React, { useState, useEffect } from 'react';
import {
  Building2,
  CreditCard,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Zap,
  ArrowRight,
  Trash2,
  Landmark,
  Wallet,
  Code2,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../lib/i18n';
import { BankAccount } from '../../lib/types';
import {
  fetchBankAccounts,
  createBankAccount,
  disconnectBankAccount,
  syncBankAccount,
} from '../../lib/services/openBankingService';

const AVAILABLE_PROVIDERS = [
  { name: 'Bank Leumi (בנק לאומי)', type: 'checking', icon: Landmark, color: '#00529B' },
  { name: 'Bank Hapoalim (בנק הפועלים)', type: 'checking', icon: Landmark, color: '#E10514' },
  { name: 'Discount Bank (בנק דיסקונט)', type: 'checking', icon: Landmark, color: '#00A651' },
  { name: 'Mizrahi Tefahot (מזרחי טפחות)', type: 'checking', icon: Landmark, color: '#F37021' },
  { name: 'One Zero Digital Bank (וואן זירו)', type: 'checking', icon: Landmark, color: '#111827' },
  { name: 'Max Executive (מקס)', type: 'credit_card', icon: CreditCard, color: '#FF3366' },
  { name: 'Isracard Platinum (ישראכרט)', type: 'credit_card', icon: CreditCard, color: '#0072CE' },
  { name: 'Cal Card (כאל)', type: 'credit_card', icon: CreditCard, color: '#FFB800' },
] as const;

export const ConnectedAccountsScreen: React.FC = () => {
  const {
    activeHousehold,
    businessMappings,
    isDemoMode,
    addBatchTransactions,
    language,
  } = useAuth();

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Modal State
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [connectStep, setConnectStep] = useState<'select' | 'details' | 'consent' | 'success'>('select');
  const [selectedProvider, setSelectedProvider] = useState<typeof AVAILABLE_PROVIDERS[number] | null>(null);
  const [customMaskedNumber, setCustomMaskedNumber] = useState('');
  const [customBalance, setCustomBalance] = useState('15000');
  const [isConnecting, setIsConnecting] = useState(false);

  const currencySymbol = activeHousehold?.currency === 'ILS' ? '₪' : activeHousehold?.currency || '$';

  // Load Accounts
  const loadAccounts = async () => {
    if (!activeHousehold) return;
    setIsLoading(true);
    try {
      const data = await fetchBankAccounts(activeHousehold.id, isDemoMode);
      setAccounts(data);
    } catch (e) {
      console.error('Error loading bank accounts:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [activeHousehold?.id]);

  // Handle Sync Account
  const handleSyncAccount = async (account: BankAccount) => {
    setSyncingAccountId(account.id);
    setSyncMessage(null);

    try {
      const result = await syncBankAccount(account, businessMappings, isDemoMode);
      if (result.success) {
        if (result.newTransactions && result.newTransactions.length > 0) {
          addBatchTransactions(result.newTransactions);
        }
        setSyncMessage(
          language === 'he'
            ? `סונכרנו בהצלחה ${result.inserted_count} תנועות חדשות מ-${account.provider_name}!`
            : `Synced ${result.inserted_count} new transactions from ${account.provider_name}!`
        );
        await loadAccounts();
      } else {
        setSyncMessage(
          language === 'he'
            ? `הודעת סנכרון: ${result.error || 'לא נמצאו תנועות חדשות.'}`
            : `Sync notice: ${result.error || 'No new transactions found.'}`
        );
      }
    } catch (err: any) {
      setSyncMessage(
        language === 'he'
          ? `שגיאת סנכרון: ${err?.message || 'הסנכרון נכשל'}`
          : `Sync error: ${err?.message || 'Failed to sync'}`
      );
    } finally {
      setSyncingAccountId(null);
    }
  };

  // Handle Disconnect
  const handleDisconnect = async (accountId: string) => {
    if (!activeHousehold) return;
    const confirmPrompt = language === 'he'
      ? 'האם אתה בטוח שברצונך לנתק מוסד פיננסי זה?'
      : 'Are you sure you want to disconnect this financial institution?';
    if (confirm(confirmPrompt)) {
      await disconnectBankAccount(accountId, activeHousehold.id, isDemoMode);
      await loadAccounts();
    }
  };

  // Handle Submit Connect
  const handleConfirmConnect = async () => {
    if (!activeHousehold || !selectedProvider) return;
    setIsConnecting(true);

    try {
      const res = await createBankAccount(
        {
          household_id: activeHousehold.id,
          provider_name: selectedProvider.name,
          account_number_masked: customMaskedNumber.trim() ? `**** ${customMaskedNumber.trim()}` : `**** ${Math.floor(1000 + Math.random() * 9000)}`,
          account_type: selectedProvider.type,
          currency: activeHousehold.currency || 'ILS',
          initial_balance: parseFloat(customBalance) || 0,
        },
        isDemoMode
      );

      if (res.success) {
        setConnectStep('success');
        await loadAccounts();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsConnecting(false);
    }
  };

  // Totals
  const totalCheckingBalance = accounts
    .filter((a) => a.account_type === 'checking')
    .reduce((sum, a) => sum + Number(a.current_balance), 0);

  const totalCreditDebt = accounts
    .filter((a) => a.account_type === 'credit_card')
    .reduce((sum, a) => sum + Math.abs(Number(a.current_balance)), 0);

  return (
    <div style={styles.container}>
      {/* Header Row */}
      <div style={styles.headerRow}>
        <div>
          <div style={styles.badge}>
            <Zap size={12} color="var(--primary)" />
            <span>{language === 'he' ? 'תשתית בנקאות פתוחה (Open Banking)' : 'Open Banking Infrastructure'}</span>
          </div>
          <h1 style={styles.pageTitle}>{t('bankSyncTitle', language)}</h1>
          <p style={styles.pageSubtitle}>{t('bankSyncSub', language)}</p>
        </div>

        <button
          style={styles.connectPrimaryBtn}
          onClick={() => {
            setSelectedProvider(null);
            setCustomMaskedNumber('');
            setConnectStep('select');
            setIsConnectModalOpen(true);
          }}
        >
          <Plus size={16} />
          <span>{t('btnConnectBank', language)}</span>
        </button>
      </div>

      {/* Sync Message Alert */}
      {syncMessage && (
        <div style={styles.syncAlert}>
          <CheckCircle2 size={18} color="var(--success-text)" />
          <span>{syncMessage}</span>
          <button style={styles.closeAlertBtn} onClick={() => setSyncMessage(null)}>✕</button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <div style={styles.kpiTop}>
            <span style={styles.kpiLabel}>{t('kpiActiveConnections', language)}</span>
            <Building2 size={18} color="var(--primary)" />
          </div>
          <div style={styles.kpiValue}>{accounts.length}</div>
          <div style={styles.kpiSub}>
            {language === 'he' ? 'חשבונות בנק וכרטיסי אשראי' : 'Bank accounts & credit cards'}
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiTop}>
            <span style={styles.kpiLabel}>{t('kpiCheckingBalance', language)}</span>
            <Wallet size={18} color="var(--success-text)" />
          </div>
          <div style={{ ...styles.kpiValue, color: 'var(--success-text)' }}>
            {currencySymbol} {totalCheckingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={styles.kpiSub}>
            {language === 'he' ? 'נזילות כוללת בכל חשבונות העו"ש' : 'Combined liquid checking balance'}
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiTop}>
            <span style={styles.kpiLabel}>{t('kpiCreditDebt', language)}</span>
            <CreditCard size={18} color="var(--danger)" />
          </div>
          <div style={{ ...styles.kpiValue, color: 'var(--danger)' }}>
            {currencySymbol} {totalCreditDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={styles.kpiSub}>
            {language === 'he' ? 'חיובים עתידיים לכרטיסי אשראי' : 'Pending monthly credit charges'}
          </div>
        </div>
      </div>

      {/* Connected Accounts List */}
      <div style={styles.listCard}>
        <div style={styles.listHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} color="var(--primary)" />
            <h3 style={styles.listTitle}>Linked Financial Institutions</h3>
          </div>
          <span style={styles.countPill}>{accounts.length} Connected</span>
        </div>

        {isLoading ? (
          <div style={styles.emptyState}>
            <div style={styles.spinner} />
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading connections...</div>
          </div>
        ) : accounts.length === 0 ? (
          <div style={styles.emptyState}>
            <Building2 size={40} color="var(--text-muted)" />
            <div style={styles.emptyTitle}>No Bank Accounts Connected Yet</div>
            <div style={styles.emptySub}>
              Connect your bank or credit card to automate transaction imports with zero manual entry.
            </div>
            <button
              style={styles.connectPrimaryBtn}
              onClick={() => {
                setSelectedProvider(null);
                setConnectStep('select');
                setIsConnectModalOpen(true);
              }}
            >
              <Plus size={16} />
              <span>Connect First Account</span>
            </button>
          </div>
        ) : (
          <div style={styles.accountsGrid}>
            {accounts.map((acc) => {
              const isSyncing = syncingAccountId === acc.id;
              const isChecking = acc.account_type === 'checking';

              return (
                <div key={acc.id} style={styles.accountCard}>
                  <div style={styles.accountCardTop}>
                    <div style={styles.accountIconWrap}>
                      {isChecking ? (
                        <Landmark size={20} color="var(--primary)" />
                      ) : (
                        <CreditCard size={20} color="#8B5CF6" />
                      )}
                    </div>
                    <div>
                      <div style={styles.providerName}>{acc.provider_name}</div>
                      <div style={styles.accountNumber}>{acc.account_number_masked}</div>
                    </div>
                  </div>

                  <div style={styles.accountBalanceRow}>
                    <span style={styles.balanceLabel}>Reported Balance</span>
                    <span
                      style={{
                        ...styles.balanceAmount,
                        color: acc.current_balance >= 0 ? 'var(--text-primary)' : 'var(--danger)',
                      }}
                    >
                      {currencySymbol}{' '}
                      {Number(acc.current_balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div style={styles.accountCardBottom}>
                    <div style={styles.syncStatusWrap}>
                      <span style={styles.syncDot} />
                      <span style={styles.syncTime}>
                        {acc.last_synced_at
                          ? `Synced ${new Date(acc.last_synced_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          : 'Not synced yet'}
                      </span>
                    </div>

                    <div style={styles.cardActions}>
                      <button
                        style={styles.syncActionBtn}
                        disabled={isSyncing}
                        onClick={() => handleSyncAccount(acc)}
                        title="Fetch latest transactions via Open Banking API"
                      >
                        <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                        <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                      </button>

                      <button
                        style={styles.disconnectBtn}
                        onClick={() => handleDisconnect(acc.id)}
                        title="Disconnect account"
                      >
                        <Trash2 size={13} color="var(--text-muted)" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Developer Webhook Integration Guide Box */}
      <div style={styles.webhookCard}>
        <div style={styles.webhookHeader}>
          <Code2 size={18} color="var(--primary)" />
          <h4 style={styles.webhookTitle}>Automated Webhook Receiver (Supabase Edge Function)</h4>
        </div>
        <p style={styles.webhookSub}>
          External Open Banking aggregators can stream real-time transaction webhooks directly to your secure Edge Function. All incoming feeds are automatically deduplicated using <code>source_reference_id</code> and classified against your <code>Business_Mapping</code> rules.
        </p>
        <div style={styles.webhookEndpointBox}>
          <code>POST /functions/v1/open-banking-webhook</code>
          <span style={styles.secureTag}>
            <ShieldCheck size={12} color="var(--success-text)" />
            HMAC & Secret Protected
          </span>
        </div>
      </div>

      {/* Connect Modal */}
      {isConnectModalOpen && (
        <div style={styles.modalOverlay} onClick={() => setIsConnectModalOpen(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            {/* Step 1: Select Institution */}
            {connectStep === 'select' && (
              <div>
                <h3 style={styles.modalTitle}>Connect Financial Institution</h3>
                <p style={styles.modalSub}>
                  Select your Israeli bank or credit card issuer to initiate automated Open Banking synchronization.
                </p>

                <div style={styles.providersList}>
                  {AVAILABLE_PROVIDERS.map((prov, i) => (
                    <button
                      key={i}
                      style={styles.providerItem}
                      onClick={() => {
                        setSelectedProvider(prov);
                        setConnectStep('details');
                      }}
                    >
                      <div style={{ ...styles.providerIconCircle, backgroundColor: `${prov.color}15` }}>
                        <prov.icon size={18} color={prov.color} />
                      </div>
                      <span style={styles.providerItemName}>{prov.name}</span>
                      <ArrowRight size={16} color="var(--text-muted)" />
                    </button>
                  ))}
                </div>

                <div style={styles.modalFooter}>
                  <button style={styles.cancelModalBtn} onClick={() => setIsConnectModalOpen(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Account Details */}
            {connectStep === 'details' && selectedProvider && (
              <div>
                <h3 style={styles.modalTitle}>Configure {selectedProvider.name}</h3>
                <p style={styles.modalSub}>Enter connection credentials and account details.</p>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Account / Card Masked Last 4 Digits</label>
                  <input
                    style={styles.formInput}
                    type="text"
                    maxLength={4}
                    placeholder="e.g. 4892"
                    value={customMaskedNumber}
                    onChange={(e) => setCustomMaskedNumber(e.target.value)}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Starting Current Balance ({currencySymbol})</label>
                  <input
                    style={styles.formInput}
                    type="number"
                    placeholder="15000"
                    value={customBalance}
                    onChange={(e) => setCustomBalance(e.target.value)}
                  />
                </div>

                <div style={styles.modalFooter}>
                  <button style={styles.cancelModalBtn} onClick={() => setConnectStep('select')}>
                    Back
                  </button>
                  <button
                    style={styles.nextModalBtn}
                    onClick={() => setConnectStep('consent')}
                  >
                    Continue to Consent
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Open Banking Consent */}
            {connectStep === 'consent' && selectedProvider && (
              <div>
                <div style={styles.consentIconWrap}>
                  <ShieldCheck size={40} color="var(--primary)" />
                </div>
                <h3 style={styles.modalTitle}>Open Banking Consent</h3>
                <p style={styles.modalSub}>
                  By proceeding, you grant read-only permission to sync transactions and balances for <strong>{selectedProvider.name}</strong>. Data is end-to-end encrypted in your Supabase database.
                </p>

                <div style={styles.consentBox}>
                  <div style={styles.consentItem}>
                    <CheckCircle2 size={16} color="var(--success-text)" />
                    <span>Read-only account transaction history</span>
                  </div>
                  <div style={styles.consentItem}>
                    <CheckCircle2 size={16} color="var(--success-text)" />
                    <span>Real-time balance synchronization</span>
                  </div>
                  <div style={styles.consentItem}>
                    <CheckCircle2 size={16} color="var(--success-text)" />
                    <span>Encrypted with bank-grade 256-bit AES</span>
                  </div>
                </div>

                <div style={styles.modalFooter}>
                  <button style={styles.cancelModalBtn} onClick={() => setConnectStep('details')}>
                    Back
                  </button>
                  <button
                    style={styles.confirmConsentBtn}
                    disabled={isConnecting}
                    onClick={handleConfirmConnect}
                  >
                    {isConnecting ? 'Authorizing...' : 'Authorize & Connect'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Success */}
            {connectStep === 'success' && selectedProvider && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={styles.successCircle}>
                  <CheckCircle2 size={40} color="var(--success-text)" />
                </div>
                <h3 style={styles.modalTitle}>Account Connected!</h3>
                <p style={styles.modalSub}>
                  <strong>{selectedProvider.name}</strong> is now securely linked. Initial transactions have been synced.
                </p>
                <button
                  style={styles.doneBtn}
                  onClick={() => setIsConnectModalOpen(false)}
                >
                  Done
                </button>
              </div>
            )}
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
    gap: '24px',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    backgroundColor: 'var(--primary-light)',
    color: 'var(--primary)',
    borderRadius: '100px',
    fontSize: '0.75rem',
    fontWeight: '700',
    marginBottom: '8px',
  },
  pageTitle: {
    fontSize: '1.75rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: 0,
    letterSpacing: '-0.02em',
  },
  pageSubtitle: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    margin: '4px 0 0',
  },
  connectPrimaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: '700',
    border: 'none',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-sm)',
  },
  syncAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 18px',
    backgroundColor: 'var(--success-light)',
    color: 'var(--success-text)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: '600',
    position: 'relative',
  },
  closeAlertBtn: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--success-text)',
    fontSize: '1rem',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '16px',
  },
  kpiCard: {
    backgroundColor: 'var(--bg-surface)',
    padding: '18px 20px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    boxShadow: 'var(--shadow-sm)',
  },
  kpiTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  kpiLabel: {
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  kpiValue: {
    fontSize: '1.5rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  kpiSub: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '4px',
  },
  listCard: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    boxShadow: 'var(--shadow-sm)',
    padding: '20px 24px',
  },
  listHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  },
  listTitle: {
    fontSize: '1.0625rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  countPill: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--primary)',
    backgroundColor: 'var(--primary-light)',
    padding: '3px 10px',
    borderRadius: '100px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 20px',
    textAlign: 'center',
    gap: '12px',
  },
  emptyTitle: {
    fontSize: '1.125rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  emptySub: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    maxWidth: '420px',
    marginBottom: '8px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: '3px solid var(--border-main)',
    borderTopColor: 'var(--primary)',
    animation: 'spin 0.8s linear infinite',
  },
  accountsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '16px',
  },
  accountCard: {
    backgroundColor: 'var(--bg-surface-subtle)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-main)',
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  accountCardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  accountIconWrap: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-main)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerName: {
    fontSize: '0.9375rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  accountNumber: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  accountBalanceRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-subtle)',
  },
  balanceLabel: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  balanceAmount: {
    fontSize: '1rem',
    fontWeight: '800',
  },
  accountCardBottom: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  syncStatusWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  syncDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    backgroundColor: 'var(--success-text)',
  },
  syncTime: {
    fontSize: '0.6875rem',
    color: 'var(--text-muted)',
    fontWeight: '500',
  },
  cardActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  syncActionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-main)',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    cursor: 'pointer',
  },
  disconnectBtn: {
    padding: '6px 8px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-main)',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  webhookCard: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    padding: '20px 24px',
  },
  webhookHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  webhookTitle: {
    fontSize: '0.9375rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: 0,
  },
  webhookSub: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    margin: '0 0 14px',
    lineHeight: '1.5',
  },
  webhookEndpointBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    backgroundColor: 'var(--bg-surface-subtle)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-main)',
    fontFamily: 'monospace',
    fontSize: '0.8125rem',
  },
  secureTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.6875rem',
    color: 'var(--success-text)',
    fontWeight: '700',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '16px',
  },
  modalContent: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    maxWidth: '520px',
    width: '100%',
    padding: '24px',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border-main)',
  },
  modalTitle: {
    fontSize: '1.25rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    margin: '0 0 6px',
  },
  modalSub: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    margin: '0 0 18px',
  },
  providersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '320px',
    overflowY: 'auto',
    marginBottom: '18px',
  },
  providerItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
  },
  providerIconCircle: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerItemName: {
    flex: 1,
    fontSize: '0.875rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '14px',
  },
  formLabel: {
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  formInput: {
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-main)',
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    outline: 'none',
  },
  consentIconWrap: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: 'var(--primary-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
  },
  consentBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    backgroundColor: 'var(--bg-surface-subtle)',
    padding: '14px 16px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-main)',
    marginBottom: '20px',
  },
  consentItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '0.8125rem',
    color: 'var(--text-primary)',
    fontWeight: '500',
  },
  modalFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '16px',
  },
  cancelModalBtn: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-main)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  nextModalBtn: {
    padding: '8px 18px',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: '700',
    border: 'none',
    cursor: 'pointer',
  },
  confirmConsentBtn: {
    padding: '10px 22px',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.875rem',
    fontWeight: '700',
    border: 'none',
    cursor: 'pointer',
  },
  successCircle: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: 'var(--success-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
  },
  doneBtn: {
    padding: '10px 24px',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: '700',
    border: 'none',
    cursor: 'pointer',
    marginTop: '16px',
  },
};
