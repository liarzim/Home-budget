import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { OAuthProvider } from '../lib/supabase';
import {
  ShieldCheck,
  Building2,
  PieChart,
  Layers,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Database,
  Lock,
  Wallet,
} from 'lucide-react';

export const LandingHero: React.FC = () => {
  const { loginWithOAuth, loginDemo, isSupabaseReady, isLoading } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleOAuth = async (provider: OAuthProvider) => {
    setErrorMessage(null);
    const res = await loginWithOAuth(provider);
    if (!res.success && res.error) {
      setErrorMessage(res.error);
    }
  };

  return (
    <div style={styles.container}>
      {/* Top Navbar */}
      <header style={styles.topNav}>
        <div style={styles.brandRow}>
          <div style={styles.logoBadge}>
            <PieChart size={20} color="var(--primary)" />
          </div>
          <span style={styles.brandTitle}>HomeBudget</span>
          <span style={styles.tagBadge}>Multi-Tenant</span>
        </div>

        <div>
          <button
            style={styles.demoPillBtn}
            onClick={() => loginDemo('Micha')}
          >
            <Sparkles size={14} color="var(--primary)" />
            <span>Instant Demo Preview</span>
          </button>
        </div>
      </header>

      {/* Hero Body */}
      <main style={styles.heroSection} className="animate-fade-in">
        <div style={styles.badgeContainer}>
          <ShieldCheck size={14} color="var(--success-text)" />
          <span>Supabase Auth & Strict Row Level Security (RLS)</span>
        </div>

        <h1 style={styles.heroHeading}>
          Multi-Tenant Household Budget Management
        </h1>

        <p style={styles.heroSubheading}>
          Complete financial clarity for families, couples, and shared households.
          Strict data isolation per tenant, automated merchant categorization, strict category budgets, and calendar-year savings ledger.
        </p>

        {/* OAuth Authentication Card */}
        <div style={styles.authBox}>
          <h2 style={styles.authTitle}>Get Started / Sign In</h2>
          <p style={styles.authDescription}>
            Sign in securely using Social OAuth. Your private profile and isolated tenant household will be created automatically.
          </p>

          {errorMessage && (
            <div style={styles.errorAlert}>
              <span>{errorMessage}</span>
            </div>
          )}

          <div style={styles.oauthButtonsRow}>
            {/* Google */}
            <button
              style={styles.oauthButton}
              onClick={() => handleOAuth('google')}
              disabled={isLoading}
            >
              <span style={styles.googleG}>G</span>
              <span style={styles.oauthButtonText}>Continue with Google</span>
            </button>

            {/* Apple */}
            <button
              style={styles.oauthButton}
              onClick={() => handleOAuth('apple')}
              disabled={isLoading}
            >
              <Lock size={16} color="var(--text-primary)" />
              <span style={styles.oauthButtonText}>Continue with Apple</span>
            </button>
          </div>

          <div style={styles.dividerRow}>
            <div style={styles.dividerLine} />
            <span style={styles.dividerText}>or test without credentials</span>
            <div style={styles.dividerLine} />
          </div>

          <button
            style={styles.directDemoButton}
            onClick={() => loginDemo('Micha')}
          >
            <span>Launch Interactive Demo & SQL Inspector</span>
            <ArrowRight size={16} color="#FFFFFF" />
          </button>

          {!isSupabaseReady && (
            <div style={styles.envNotice}>
              <Database size={14} color="var(--text-secondary)" />
              <span>
                Running in Mock & Setup Mode. When you deploy to Vercel or locally, configure <code>VITE_SUPABASE_URL</code> in <code>.env</code>.
              </span>
            </div>
          )}
        </div>

        {/* Feature Grid */}
        <section style={styles.featuresSection}>
          <h2 style={styles.sectionHeaderTitle}>Engineered for Full Tenant Isolation</h2>
          <p style={styles.sectionHeaderSubtitle}>
            Built on PostgreSQL Row Level Security (RLS) with instant web and native APK responsiveness.
          </p>

          <div style={styles.featureGrid}>
            <div style={styles.featureCard}>
              <div style={{ ...styles.featureIconWrap, backgroundColor: 'var(--primary-light)' }}>
                <Building2 size={22} color="var(--primary)" />
              </div>
              <h3 style={styles.featureCardTitle}>Multi-Tenant Households</h3>
              <p style={styles.featureCardDesc}>
                Switch seamlessly between personal, shared family, or rental property households. Members only access data from households they belong to.
              </p>
            </div>

            <div style={styles.featureCard}>
              <div style={{ ...styles.featureIconWrap, backgroundColor: 'var(--success-light)' }}>
                <CheckCircle2 size={22} color="var(--success)" />
              </div>
              <h3 style={styles.featureCardTitle}>Auto Business Mapping</h3>
              <p style={styles.featureCardDesc}>
                Intelligently matches credit card and bank merchant names (e.g. Shufersal, Paz, Netflix, Super-Pharm) to budget categories automatically.
              </p>
            </div>

            <div style={styles.featureCard}>
              <div style={{ ...styles.featureIconWrap, backgroundColor: 'var(--warning-light)' }}>
                <PieChart size={22} color="var(--warning)" />
              </div>
              <h3 style={styles.featureCardTitle}>Monthly & Yearly Budgets</h3>
              <p style={styles.featureCardDesc}>
                Strict per-category limits. Real-time visual progress bars warn you before exceeding limits and track annual spending targets.
              </p>
            </div>

            <div style={styles.featureCard}>
              <div style={{ ...styles.featureIconWrap, backgroundColor: 'var(--danger-light)' }}>
                <Wallet size={22} color="var(--danger)" />
              </div>
              <h3 style={styles.featureCardTitle}>Soft Deletes & Savings Ledger</h3>
              <p style={styles.featureCardDesc}>
                Transactions include <code>is_hidden</code> flag for safe reversible archiving. Track opening and closing balances per calendar year.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: 'var(--bg-app)',
    display: 'flex',
    flexDirection: 'column',
  },
  topNav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 32px',
    backgroundColor: 'var(--bg-surface)',
    borderBottom: '1px solid var(--border-main)',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logoBadge: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    backgroundColor: 'var(--primary-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: '1.25rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.03em',
  },
  tagBadge: {
    padding: '3px 8px',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
    fontSize: '0.6875rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
  },
  demoPillBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    backgroundColor: 'var(--primary-light)',
    borderRadius: '20px',
    color: 'var(--primary)',
    fontSize: '0.8125rem',
    fontWeight: '600',
    transition: 'all 0.15s ease',
  },
  heroSection: {
    maxWidth: '920px',
    margin: '0 auto',
    padding: '48px 24px 60px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  badgeContainer: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    backgroundColor: 'var(--success-light)',
    borderRadius: '20px',
    border: '1px solid #A7F3D0',
    color: 'var(--success-text)',
    fontSize: '0.75rem',
    fontWeight: '700',
    marginBottom: '20px',
  },
  heroHeading: {
    fontSize: '2.5rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.04em',
    lineHeight: '1.15',
    marginBottom: '16px',
  },
  heroSubheading: {
    fontSize: '1.0625rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.6',
    maxWidth: '700px',
    marginBottom: '36px',
  },
  authBox: {
    width: '100%',
    maxWidth: '480px',
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    padding: '28px',
    boxShadow: 'var(--shadow-lg)',
    textAlign: 'left',
  },
  authTitle: {
    fontSize: '1.125rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '6px',
    textAlign: 'center',
  },
  authDescription: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
    textAlign: 'center',
    marginBottom: '20px',
  },
  errorAlert: {
    padding: '10px 14px',
    backgroundColor: 'var(--danger-light)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid #FECACA',
    color: 'var(--danger-text)',
    fontSize: '0.8125rem',
    marginBottom: '16px',
    textAlign: 'center',
  },
  oauthButtonsRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  oauthButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '12px 16px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontWeight: '600',
    fontSize: '0.875rem',
    transition: 'all 0.15s ease',
  },
  googleG: {
    fontSize: '1rem',
    fontWeight: '800',
    color: '#EA4335',
  },
  oauthButtonText: {
    color: 'var(--text-primary)',
  },
  dividerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '18px 0',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    backgroundColor: 'var(--border-main)',
  },
  dividerText: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  directDemoButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '13px 18px',
    backgroundColor: 'var(--primary)',
    borderRadius: 'var(--radius-md)',
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: '0.875rem',
    boxShadow: 'var(--shadow-sm)',
    transition: 'background-color 0.15s ease',
  },
  envNotice: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '16px',
    padding: '10px 12px',
    backgroundColor: 'var(--bg-surface-subtle)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-main)',
    fontSize: '0.6875rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
  },
  featuresSection: {
    marginTop: '64px',
    width: '100%',
  },
  sectionHeaderTitle: {
    fontSize: '1.5rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    marginBottom: '8px',
    letterSpacing: '-0.02em',
  },
  sectionHeaderSubtitle: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    marginBottom: '32px',
  },
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '20px',
    textAlign: 'left',
  },
  featureCard: {
    backgroundColor: 'var(--bg-surface)',
    padding: '24px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    boxShadow: 'var(--shadow-sm)',
  },
  featureIconWrap: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  featureCardTitle: {
    fontSize: '1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '6px',
  },
  featureCardDesc: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
  },
};
