import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  PieChart,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Lock,
  Globe,
  PiggyBank,
  Receipt,
  TrendingUp,
  Users,
  CheckCircle2,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  HelpCircle,
  X,
} from 'lucide-react';

export const LandingHero: React.FC = () => {
  const { loginWithEmail, loginWithOAuth, loginDemo, isSupabaseReady, isLoading, language, setLanguage, dir } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const isHe = language === 'he';

  const handleOAuthLogin = async (provider: 'google' | 'apple') => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const res = await loginWithOAuth(provider);
      if (!res.success && res.error) {
        setErrorMessage(res.error);
      }
    } catch (err: any) {
      setErrorMessage(err.message || (isHe ? 'שגיאה בהתחברות באמצעות Google' : 'Google sign in failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage(isHe ? 'נא להזין כתובת אימייל וסיסמה' : 'Please enter email and password');
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const res = await loginWithEmail(email.trim(), password);
      if (!res.success && res.error) {
        if (res.error.toLowerCase().includes('invalid login credentials')) {
          setErrorMessage(
            isHe
              ? 'פרטי ההתחברות אינם מזוהים במערכת. הכניסה מורשית רק למשתמשים שקיבלו זימון ממנהל המשפחה. לבחינת המערכת, לחצו על כניסה לסביבת דמו למטה.'
              : 'Invalid credentials. Access is restricted to users invited by a Household Admin. To explore the system, launch the Demo sandbox below.'
          );
        } else if (res.error.toLowerCase().includes('email not confirmed')) {
          setErrorMessage(isHe ? 'כתובת המייל טרם אומתה.' : 'Email address not confirmed.');
        } else {
          setErrorMessage(res.error);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || (isHe ? 'שגיאה בהתחברות' : 'Sign in failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleLanguage = () => {
    setLanguage(isHe ? 'en' : 'he');
  };

  return (
    <div style={styles.container} dir={dir}>
      {/* Top Navbar */}
      <header style={styles.topNav}>
        <div style={styles.brandRow}>
          <div style={styles.logoBadge}>
            <img
              src="/app-icon.png?v=2"
              alt="HomeBudget"
              style={styles.logoImg}
            />
          </div>
          <div style={styles.brandTextGroup}>
            <span style={styles.brandTitle}>
              {isHe ? 'ניהול תקציב משפחתי' : 'HomeBudget'}
            </span>
            <span style={styles.tagBadge}>
              {isHe ? 'פרטי ומאובטח' : 'Safe & Private'}
            </span>
          </div>
        </div>

        <div style={styles.topNavActions}>
          {/* Language Switcher */}
          <button
            style={styles.langToggleBtn}
            onClick={toggleLanguage}
            title={isHe ? 'החלף לאנגלית' : 'Switch to Hebrew'}
            aria-label="Toggle Language"
          >
            <Globe size={15} color="var(--text-secondary)" />
            <span>{isHe ? 'English' : 'עברית'}</span>
          </button>

          {/* Quick Demo Preview Button */}
          <button
            style={styles.demoPillBtn}
            onClick={() => loginDemo('Micha')}
          >
            <Sparkles size={14} color="var(--primary)" />
            <span>{isHe ? 'התנסות מהירה בדמו' : 'Instant Demo Preview'}</span>
          </button>
        </div>
      </header>

      {/* Hero Body */}
      <main style={styles.heroSection} className="animate-fade-in">
        {/* Entrance App Icon */}
        <div style={styles.heroIconWrapper}>
          <img
            src="/app-icon.png?v=2"
            alt={isHe ? 'סמל ניהול תקציב משפחתי' : 'Household Budget App Icon'}
            style={styles.heroIconImg}
          />
        </div>

        {/* Reassurance Badge */}
        <div style={styles.badgeContainer}>
          <ShieldCheck size={16} color="#059669" />
          <span>
            {isHe
              ? 'פרטיות מלאה ואבטחה פיננסית מתקדמת'
              : 'Bank-Grade Privacy & Dedicated Isolation'}
          </span>
        </div>

        {/* Main Heading */}
        <h1 style={styles.heroHeading}>
          {isHe
            ? 'ניהול תקציב משפחתי חכם, פשוט ומאובטח'
            : 'Smart, Simple Household Budget Management'}
        </h1>

        {/* Subtitle */}
        <p style={styles.heroSubheading}>
          {isHe
            ? 'שליטה מלאה בהוצאות הבית, מעקב קניות וכרטיסי אשראי, יעדי חיסכון משותפים ושקט נפשי לאורך כל החודש — בלי הפתעות.'
            : 'Take full control of family expenses, credit cards, monthly budget limits, and shared savings goals — with zero surprises.'}
        </p>

        {/* Authentication Card */}
        <div style={styles.authBox}>
          <div style={styles.authHeaderBox}>
            <div style={styles.inviteOnlyBadge}>
              <Lock size={13} color="#059669" />
              <span>{isHe ? 'גישה מורשית בזימון בלבד' : 'Invite-Only Access'}</span>
            </div>
            <h2 style={styles.authTitle}>
              {isHe ? 'כניסה למערכת המשפחתית' : 'Sign In to Household'}
            </h2>
            <p style={styles.authDescription}>
              {isHe
                ? 'הכניסה מורשית למשתמשים שהוזמנו ע״י מנהל. משתמשים לא רשומים יכולים לבחון את המערכת בסביבת הדמו בלבד.'
                : 'Access is restricted to users invited by an admin. Unregistered users can explore via Demo mode only.'}
            </p>
          </div>

          {errorMessage && (
            <div style={styles.errorAlert}>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Google Sign In Button */}
          <div style={styles.oauthButtonsRow}>
            <button
              type="button"
              style={styles.googleButton}
              onClick={() => handleOAuthLogin('google')}
              disabled={isLoading || isSubmitting}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span style={styles.googleButtonText}>
                {isHe ? 'כניסה באמצעות חשבון Google' : 'Sign in with Google'}
              </span>
            </button>
          </div>

          <div style={styles.dividerRow}>
            <div style={styles.dividerLine} />
            <span style={styles.dividerText}>
              {isHe ? 'או כניסה במייל וסיסמה' : 'or sign in with password'}
            </span>
            <div style={styles.dividerLine} />
          </div>

          {/* Email & Password Sign In Form */}
          <form onSubmit={handleEmailSubmit} style={styles.emailForm}>
            <div style={styles.inputGroup}>
              <label style={styles.inputLabel}>
                {isHe ? 'דואר אלקטרוני' : 'Email Address'}
              </label>
              <div style={styles.inputWrapper}>
                <Mail size={16} color="#94A3B8" style={{ flexShrink: 0 }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  disabled={isLoading || isSubmitting}
                  style={styles.textInput}
                  dir="ltr"
                />
              </div>
            </div>

            <div style={styles.inputGroup}>
              <div style={styles.passwordLabelRow}>
                <label style={styles.inputLabel}>
                  {isHe ? 'סיסמה' : 'Password'}
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  style={styles.forgotPassBtn}
                >
                  {isHe ? 'שכחת סיסמה?' : 'Forgot password?'}
                </button>
              </div>
              <div style={styles.inputWrapper}>
                <KeyRound size={16} color="#94A3B8" style={{ flexShrink: 0 }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={isLoading || isSubmitting}
                  style={styles.textInput}
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={16} color="#64748B" /> : <Eye size={16} color="#64748B" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || isSubmitting}
              style={styles.submitButton}
            >
              {isSubmitting ? (
                <span>{isHe ? 'מתחבר למערכת...' : 'Signing in...'}</span>
              ) : (
                <>
                  <span>{isHe ? 'כניסה למערכת' : 'Sign In'}</span>
                  {isHe ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
                </>
              )}
            </button>
          </form>

          <div style={styles.dividerRow}>
            <div style={styles.dividerLine} />
            <span style={styles.dividerText}>
              {isHe ? 'לבחינת המערכת ללא חשבון' : 'Explore Without an Account'}
            </span>
            <div style={styles.dividerLine} />
          </div>

          <div style={styles.demoInviteExplainer}>
            <div style={styles.demoExplainerHeader}>
              <Sparkles size={16} color="var(--primary, #2563EB)" />
              <strong>{isHe ? 'סביבת דמו למשתמשים לא רשומים' : 'Sandbox Demo for Unregistered Users'}</strong>
            </div>
            <p style={styles.demoExplainerText}>
              {isHe
                ? 'הצטרפות למערכת האמיתית מתאפשרת באמצעות זימון ע״י מנהל המשפחה בלבד. משתמשים המעוניינים לבחון את המערכת מוזמנים להתנסות חופשית בסביבת הדמו ללא צורך בהרשמה.'
                : 'Account creation is strictly by admin invitation. Unregistered users can freely test and explore all features via the Demo sandbox.'}
            </p>
          </div>

          {/* Interactive Demo Button */}
          <button
            style={styles.directDemoButton}
            onClick={() => loginDemo('Micha')}
          >
            <Sparkles size={17} color="#FFFFFF" style={{ flexShrink: 0 }} />
            <span>
              {isHe
                ? 'כניסה לסביבת דמו (לבחינת המערכת)'
                : 'Launch Demo Sandbox (Explore App)'}
            </span>
            {isHe ? (
              <ArrowLeft size={16} color="#FFFFFF" style={{ flexShrink: 0 }} />
            ) : (
              <ArrowRight size={16} color="#FFFFFF" style={{ flexShrink: 0 }} />
            )}
          </button>

          <div style={styles.securityFootnote}>
            <CheckCircle2 size={14} color="#059669" style={{ flexShrink: 0 }} />
            <span>
              {isHe
                ? 'המידע האישי מבודד ומוגן בהצפנה מלאה בכל עת'
                : 'Your data is strictly isolated and protected with full encryption'}
            </span>
          </div>
        </div>

        {/* Friendly Feature Section */}
        <section style={styles.featuresSection}>
          <div style={styles.sectionHeaderBox}>
            <h2 style={styles.sectionHeaderTitle}>
              {isHe
                ? 'כל מה שצריך לניהול תקציב המשפחה'
                : 'Everything Your Household Needs'}
            </h2>
            <p style={styles.sectionHeaderSubtitle}>
              {isHe
                ? 'כלים חכמים, פשוטים ומדויקים המעניקים לכם ביטחון כלכלי ושליטה יומיומית'
                : 'Intuitive, powerful tools designed to help your family spend wisely and thrive together.'}
            </p>
          </div>

          <div style={styles.featureGrid}>
            {/* Card 1: Budgets */}
            <div style={styles.featureCard}>
              <div style={{ ...styles.featureIconWrap, backgroundColor: '#EFF6FF' }}>
                <PieChart size={24} color="#2563EB" />
              </div>
              <h3 style={styles.featureCardTitle}>
                {isHe ? 'תקציב חודשי ללא חריגות' : 'Monthly Budget Limits'}
              </h3>
              <p style={styles.featureCardDesc}>
                {isHe
                  ? 'הגדרת גבולות ברורים לפי קטגוריות (סופר, חשבונות, בילויים) עם מחוון חזותי בזמן אמת שמתריע לפני חריגה.'
                  : 'Set clear spending caps for groceries, utilities, and leisure with real-time visual progress bars.'}
              </p>
            </div>

            {/* Card 2: Auto Categorization */}
            <div style={styles.featureCard}>
              <div style={{ ...styles.featureIconWrap, backgroundColor: '#ECFDF5' }}>
                <Receipt size={24} color="#059669" />
              </div>
              <h3 style={styles.featureCardTitle}>
                {isHe ? 'סיווג עסקאות אוטומטי' : 'Smart Auto-Categorization'}
              </h3>
              <p style={styles.featureCardDesc}>
                {isHe
                  ? 'זיהוי חכם של עסקאות אשראי ובנקים (שופרסל, דלק, נטפליקס והוראות קבע) ישירות לקטגוריה הנכונה.'
                  : 'Intelligently sorts credit card and bank transactions to the right budget bucket automatically.'}
              </p>
            </div>

            {/* Card 3: Savings Goals */}
            <div style={styles.featureCard}>
              <div style={{ ...styles.featureIconWrap, backgroundColor: '#FEF3C7' }}>
                <TrendingUp size={24} color="#D97706" />
              </div>
              <h3 style={styles.featureCardTitle}>
                {isHe ? 'יעדי חיסכון וצמיחה' : 'Family Savings Goals'}
              </h3>
              <p style={styles.featureCardDesc}>
                {isHe
                  ? 'מעקב שוטף אחרי קופות חיסכון, קרנות וסגירת חודש חיובית משנה לשנה עבור מטרות המשפחה.'
                  : 'Track emergency funds, vacation pots, and positive annual savings growth with complete peace of mind.'}
              </p>
            </div>

            {/* Card 4: Partner Collaboration */}
            <div style={styles.featureCard}>
              <div style={{ ...styles.featureIconWrap, backgroundColor: '#F5F3FF' }}>
                <Users size={24} color="#7C3AED" />
              </div>
              <h3 style={styles.featureCardTitle}>
                {isHe ? 'שיתוף נוח בין בני הזוג' : 'Real-Time Family Sharing'}
              </h3>
              <p style={styles.featureCardDesc}>
                {isHe
                  ? 'חשבון משותף המסונכרן בזמן אמת בין בני הזוג, עם שקיפות מלאה ושליטה נוחה מהנייד ומהמחשב.'
                  : 'Seamless real-time synchronization between partners and household members across phones and desktop.'}
              </p>
            </div>
          </div>
        </section>

        {/* Simple Friendly Footer */}
        <footer style={styles.footerBox}>
          <span>
            {isHe
              ? 'ניהול תקציב משפחתי © 2026 | מערכת מאובטחת לניהול פיננסי למשק הבית'
              : 'Home Budget © 2026 | Private, Secure Household Finance Platform'}
          </span>
        </footer>
      </main>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div style={styles.modalOverlay} onClick={() => setShowForgotModal(false)}>
          <div style={styles.forgotModalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.forgotModalHeader}>
              <div style={styles.forgotModalIconWrap}>
                <KeyRound size={22} color="#2563EB" />
              </div>
              <button
                onClick={() => setShowForgotModal(false)}
                style={styles.closeModalBtn}
                aria-label="Close"
              >
                <X size={18} color="#64748B" />
              </button>
            </div>

            <h3 style={styles.forgotModalTitle}>
              {isHe ? 'איפוס סיסמה למשתמשי המשפחה' : 'Reset Account Password'}
            </h3>

            <p style={styles.forgotModalDesc}>
              {isHe
                ? 'לשמירה על פרטיות מלאה ואבטחה ברמה הגבוהה ביותר, מנהל/ת המשפחה יכול/ה להפיק עבורך קישור איפוס סיסמה מאובטח ישירות ממסך ניהול המשתמשים ולשלוח לך אותו בוואטסאפ או במייל.'
                : 'For strict family privacy and bank-grade isolation, your Household Admin can generate a secure 24-hour reset link directly from the Users screen and send it to you via WhatsApp or Email.'}
            </p>

            <div style={styles.forgotTipBox}>
              <HelpCircle size={18} color="#2563EB" style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                {isHe
                  ? 'פנה/י למנהל התקציב במשפחה ובקש/י קישור איפוס אישי. בלחיצה על הקישור תוכל/י לקבוע סיסמה חדשה ולהתחבר מיד.'
                  : 'Contact your household budget admin for a direct reset link. With one click you can set your new password and sign in instantly.'}
              </span>
            </div>

            <button
              onClick={() => setShowForgotModal(false)}
              style={styles.forgotCloseButton}
            >
              {isHe ? 'הבנתי, סגור' : 'Got it, close'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: 'var(--bg-app, #F8FAFC)',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'inherit',
  },
  topNav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 28px',
    backgroundColor: '#FFFFFF',
    borderBottom: '1px solid var(--border-main, #E2E8F0)',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoBadge: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.18)',
    flexShrink: 0,
  },
  logoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  },
  brandTextGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  brandTitle: {
    fontSize: '1.2rem',
    fontWeight: '800',
    color: 'var(--text-primary, #0F172A)',
    letterSpacing: '-0.02em',
  },
  tagBadge: {
    padding: '3px 9px',
    borderRadius: '20px',
    backgroundColor: '#ECFDF5',
    border: '1px solid #A7F3D0',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#059669',
  },
  topNavActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  langToggleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 12px',
    backgroundColor: 'var(--bg-surface-subtle, #F1F5F9)',
    border: '1px solid var(--border-main, #E2E8F0)',
    borderRadius: '18px',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-secondary, #475569)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  demoPillBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 14px',
    backgroundColor: 'var(--primary-light, #EFF6FF)',
    border: '1px solid rgba(37, 99, 235, 0.2)',
    borderRadius: '20px',
    color: 'var(--primary, #2563EB)',
    fontSize: '0.8125rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  heroSection: {
    maxWidth: '960px',
    margin: '0 auto',
    padding: '40px 20px 60px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    width: '100%',
  },
  heroIconWrapper: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '20px',
  },
  heroIconImg: {
    width: '104px',
    height: '104px',
    borderRadius: '26px',
    boxShadow: '0 16px 36px rgba(37, 99, 235, 0.22), 0 4px 12px rgba(0, 0, 0, 0.06)',
    objectFit: 'cover' as const,
    transition: 'transform 0.25s ease',
  },
  badgeContainer: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 16px',
    backgroundColor: '#ECFDF5',
    borderRadius: '30px',
    border: '1px solid #A7F3D0',
    color: '#065F46',
    fontSize: '0.8125rem',
    fontWeight: '700',
    marginBottom: '16px',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
  },
  heroHeading: {
    fontSize: '2.5rem',
    fontWeight: '900',
    color: 'var(--text-primary, #0F172A)',
    letterSpacing: '-0.03em',
    lineHeight: '1.2',
    marginBottom: '16px',
    maxWidth: '820px',
  },
  heroSubheading: {
    fontSize: '1.125rem',
    color: 'var(--text-secondary, #475569)',
    lineHeight: '1.65',
    maxWidth: '680px',
    marginBottom: '32px',
    fontWeight: '400',
  },
  authBox: {
    width: '100%',
    maxWidth: '460px',
    backgroundColor: '#FFFFFF',
    borderRadius: '20px',
    border: '1px solid var(--border-main, #E2E8F0)',
    padding: '30px 28px',
    boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.02)',
    marginBottom: '20px',
  },
  authHeaderBox: {
    textAlign: 'center',
    marginBottom: '22px',
  },
  authTitle: {
    fontSize: '1.25rem',
    fontWeight: '800',
    color: 'var(--text-primary, #0F172A)',
    marginBottom: '6px',
  },
  authDescription: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary, #64748B)',
    lineHeight: '1.5',
  },
  errorAlert: {
    padding: '10px 14px',
    backgroundColor: '#FEE2E2',
    borderRadius: '10px',
    border: '1px solid #FECACA',
    color: '#991B1B',
    fontSize: '0.8125rem',
    marginBottom: '16px',
    textAlign: 'center',
  },
  emailForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    marginBottom: '8px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    textAlign: 'start',
  },
  passwordLabelRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputLabel: {
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: 'var(--text-primary, #1E293B)',
  },
  forgotPassBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#2563EB',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    backgroundColor: '#F8FAFC',
    borderRadius: '10px',
    border: '1px solid #CBD5E1',
    transition: 'border-color 0.15s ease',
  },
  textInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    fontSize: '0.875rem',
    color: '#0F172A',
  },
  eyeBtn: {
    background: 'none',
    border: 'none',
    padding: '2px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 18px',
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '10px',
    fontWeight: '700',
    fontSize: '0.9375rem',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
    transition: 'all 0.15s ease',
    marginTop: '4px',
  },
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
  },
  forgotModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '20px',
    maxWidth: '440px',
    width: '100%',
    padding: '28px',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.2)',
    border: '1px solid #E2E8F0',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    textAlign: 'start',
  },
  forgotModalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  forgotModalIconWrap: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    backgroundColor: '#EFF6FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeModalBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgotModalTitle: {
    fontSize: '1.2rem',
    fontWeight: '800',
    color: '#0F172A',
    margin: 0,
  },
  forgotModalDesc: {
    fontSize: '0.875rem',
    color: '#475569',
    lineHeight: '1.6',
    margin: 0,
  },
  forgotTipBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '12px 14px',
    backgroundColor: '#EFF6FF',
    borderRadius: '12px',
    border: '1px solid #BFDBFE',
    fontSize: '0.8125rem',
    color: '#1E40AF',
    lineHeight: '1.5',
  },
  forgotCloseButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#0F172A',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '10px',
    fontWeight: '700',
    fontSize: '0.875rem',
    cursor: 'pointer',
    marginTop: '6px',
  },
  oauthButtonsRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '16px',
    width: '100%',
  },
  googleButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '13px 18px',
    backgroundColor: '#FFFFFF',
    border: '1.5px solid #CBD5E1',
    borderRadius: '12px',
    color: '#0F172A',
    fontWeight: '700',
    fontSize: '0.9375rem',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
    width: '100%',
  },
  googleButtonText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: '0.9375rem',
  },
  inviteOnlyBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 14px',
    backgroundColor: '#ECFDF5',
    borderRadius: '20px',
    border: '1px solid #A7F3D0',
    color: '#065F46',
    fontSize: '0.75rem',
    fontWeight: '700',
    marginBottom: '10px',
  },
  demoInviteExplainer: {
    padding: '12px 14px',
    backgroundColor: '#F8FAFC',
    borderRadius: '12px',
    border: '1px solid #E2E8F0',
    marginBottom: '12px',
    textAlign: 'start',
  },
  demoExplainerHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.8125rem',
    color: '#1E293B',
    marginBottom: '4px',
  },
  demoExplainerText: {
    fontSize: '0.78125rem',
    color: '#64748B',
    lineHeight: '1.45',
    margin: 0,
  },
  dividerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '20px 0',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    backgroundColor: 'var(--border-main, #E2E8F0)',
  },
  dividerText: {
    fontSize: '0.8125rem',
    color: 'var(--text-muted, #94A3B8)',
    fontWeight: '500',
  },
  directDemoButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '14px 20px',
    backgroundColor: 'var(--primary, #2563EB)',
    borderRadius: '12px',
    border: 'none',
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: '0.9375rem',
    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease, transform 0.15s ease',
  },
  securityFootnote: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    marginTop: '18px',
    fontSize: '0.75rem',
    color: 'var(--text-muted, #64748B)',
    textAlign: 'center',
  },
  featuresSection: {
    marginTop: '56px',
    width: '100%',
  },
  sectionHeaderBox: {
    marginBottom: '32px',
    textAlign: 'center',
  },
  sectionHeaderTitle: {
    fontSize: '1.75rem',
    fontWeight: '900',
    color: 'var(--text-primary, #0F172A)',
    marginBottom: '8px',
    letterSpacing: '-0.02em',
  },
  sectionHeaderSubtitle: {
    fontSize: '1rem',
    color: 'var(--text-secondary, #64748B)',
    maxWidth: '620px',
    margin: '0 auto',
  },
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '20px',
  },
  featureCard: {
    backgroundColor: '#FFFFFF',
    padding: '24px',
    borderRadius: '18px',
    border: '1px solid var(--border-main, #E2E8F0)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
    textAlign: 'start',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  featureIconWrap: {
    width: '48px',
    height: '48px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  featureCardTitle: {
    fontSize: '1.0625rem',
    fontWeight: '800',
    color: 'var(--text-primary, #0F172A)',
    marginBottom: '8px',
  },
  featureCardDesc: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary, #475569)',
    lineHeight: '1.6',
  },
  footerBox: {
    marginTop: '60px',
    paddingTop: '24px',
    borderTop: '1px solid var(--border-main, #E2E8F0)',
    width: '100%',
    color: 'var(--text-muted, #94A3B8)',
    fontSize: '0.8125rem',
    textAlign: 'center',
  },
};
