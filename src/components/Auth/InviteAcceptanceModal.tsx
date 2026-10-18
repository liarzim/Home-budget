import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  verifyToken,
  markInvitationAccepted,
} from '../../lib/services/invitationService';
import { HouseholdInvitation } from '../../lib/types';
import { signUpWithEmail, signInWithEmail, updateUserPassword, supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export const InviteAcceptanceModal: React.FC = () => {
  const { loginDemo, language } = useAuth();
  const isHe = language === 'he';

  const [tokenParam, setTokenParam] = useState<string | null>(null);
  const [tokenType, setTokenType] = useState<'invite' | 'password_reset'>('invite');
  const [isVerifying, setIsVerifying] = useState(true);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<HouseholdInvitation | null>(null);
  const [householdName, setHouseholdName] = useState('משק הבית');

  // Form states
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const inviteToken = urlParams.get('invite');
    const resetToken = urlParams.get('reset');

    if (inviteToken) {
      setTokenParam(inviteToken);
      setTokenType('invite');
      checkToken(inviteToken);
    } else if (resetToken) {
      setTokenParam(resetToken);
      setTokenType('password_reset');
      checkToken(resetToken);
    } else {
      setIsVerifying(false);
    }
  }, []);

  const checkToken = async (token: string) => {
    setIsVerifying(true);
    setVerifyError(null);
    try {
      const res = await verifyToken(token);
      if (res.valid && res.invitation) {
        setInvitation(res.invitation);
        if (res.householdName) {
          setHouseholdName(res.householdName);
        }
      } else {
        setVerifyError(res.error || (isHe ? 'קישור לא תקין או שפג תוקפו' : 'Invalid or expired link'));
      }
    } catch (err: any) {
      setVerifyError(err.message || (isHe ? 'שגיאה באימות הקישור' : 'Error verifying link'));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    // Clear URL query params without reloading
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('invite');
      url.searchParams.delete('reset');
      window.history.replaceState({}, '', url.pathname);
    }
    setTokenParam(null);
    setInvitation(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (password.length < 6) {
      setSubmitError(isHe ? 'הסיסמה חייבת להכיל לפחות 6 תווים' : 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError(isHe ? 'הסיסמאות אינן תואמות' : 'Passwords do not match');
      return;
    }

    if (!invitation) return;

    setIsSubmitting(true);
    try {
      if (tokenType === 'invite') {
        // 1. Sign up user or sign in if already exists
        if (isSupabaseConfigured) {
          const { data: signUpData, error: signUpErr } = await signUpWithEmail(
            invitation.email,
            password,
            invitation.full_name || undefined
          );

          // If user already registered, try sign in with provided password
          if (signUpErr && (signUpErr.message?.includes('already registered') || signUpErr.message?.includes('User already registered'))) {
            const { error: signInErr } = await signInWithEmail(invitation.email, password);
            if (signInErr) {
              setSubmitError(
                isHe
                  ? 'משתמש עם אימייל זה כבר רשום במערכת, אך הסיסמה שהוזנה שגויה. באפשרותך לבקש איפוס סיסמה.'
                  : 'User with this email already exists, but password was incorrect.'
              );
              setIsSubmitting(false);
              return;
            }
          } else if (signUpErr) {
            console.warn('Sign up notice:', signUpErr);
          }

          // 2. Ensure profile & household_members link
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const currentUserId = session?.user?.id || signUpData?.user?.id;

            if (currentUserId) {
              // Upsert profile
              await supabase.from('profiles').upsert({
                id: currentUserId,
                email: invitation.email,
                full_name: invitation.full_name || invitation.email.split('@')[0],
              });

              // Add to household_members
              await supabase.from('household_members').upsert({
                household_id: invitation.household_id,
                user_id: currentUserId,
                role: invitation.role || 'user',
                is_default: true,
              });
            }
          } catch (dbErr) {
            console.warn('DB association notice:', dbErr);
          }
        }

        // 3. Mark invitation as accepted
        await markInvitationAccepted(invitation.id);
        setSubmitSuccess(true);

        setTimeout(() => {
          handleClose();
          // Reload page to let AuthContext initialize with the active session
          window.location.reload();
        }, 1200);

      } else {
        // Password Reset Flow
        if (isSupabaseConfigured) {
          const { error: resetErr } = await updateUserPassword(password);
          if (resetErr) {
            console.warn('Password update notice:', resetErr);
          }
        }

        await markInvitationAccepted(invitation.id);
        setSubmitSuccess(true);

        setTimeout(() => {
          handleClose();
          window.location.reload();
        }, 1200);
      }
    } catch (err: any) {
      setSubmitError(err.message || (isHe ? 'שגיאה בביצוע הפעולה' : 'An error occurred'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!tokenParam) {
    return null;
  }

  return (
    <div style={styles.overlay} dir={isHe ? 'rtl' : 'ltr'}>
      <div style={styles.card} className="animate-scale-in">
        {/* Top Header Badge */}
        <div style={styles.headerIconBox}>
          {tokenType === 'invite' ? (
            <Sparkles size={28} color="var(--primary)" />
          ) : (
            <Lock size={28} color="var(--primary)" />
          )}
        </div>

        {isVerifying ? (
          <div style={styles.stateCenter}>
            <div style={styles.spinner} />
            <h3 style={styles.title}>
              {isHe ? 'מאמת קישור מאובטח...' : 'Verifying secure link...'}
            </h3>
            <p style={styles.subtitle}>
              {isHe ? 'אנא המתן רגע קצר' : 'Please wait a moment'}
            </p>
          </div>
        ) : verifyError ? (
          <div style={styles.stateCenter}>
            <div style={styles.errorIconBox}>
              <AlertCircle size={32} color="#DC2626" />
            </div>
            <h3 style={{ ...styles.title, color: '#DC2626' }}>
              {isHe ? 'קישור אינו תקף' : 'Invalid Link'}
            </h3>
            <p style={styles.subtitle}>{verifyError}</p>
            <button style={styles.primaryBtn} onClick={handleClose}>
              <span>{isHe ? 'חזור למסך הכניסה' : 'Return to Login'}</span>
            </button>
          </div>
        ) : submitSuccess ? (
          <div style={styles.stateCenter}>
            <div style={styles.successIconBox}>
              <CheckCircle2 size={36} color="#059669" />
            </div>
            <h3 style={{ ...styles.title, color: '#059669' }}>
              {tokenType === 'invite'
                ? isHe
                  ? 'ברוך הבא למשפחה!'
                  : 'Welcome to the Family!'
                : isHe
                ? 'הסיסמה עודכנה בהצלחה!'
                : 'Password updated successfully!'}
            </h3>
            <p style={styles.subtitle}>
              {isHe
                ? 'מעביר אותך ישירות לניהול התקציב...'
                : 'Redirecting you to HomeBudget...'}
            </p>
          </div>
        ) : (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <span style={styles.householdPill}>
                <Users size={13} />
                <span>{householdName}</span>
              </span>
              <h2 style={styles.title}>
                {tokenType === 'invite'
                  ? isHe
                    ? `ברוכים הבאים, ${invitation?.full_name || 'חבר יקר'}!`
                    : `Welcome, ${invitation?.full_name || 'Friend'}!`
                  : isHe
                  ? 'הגדרת סיסמה חדשה'
                  : 'Set New Password'}
              </h2>
              <p style={styles.subtitle}>
                {tokenType === 'invite'
                  ? isHe
                    ? `הוזמנת להצטרף לניהול התקציב המשפחתי ב-${householdName}. אנא בחר סיסמה אישית לכניסה.`
                    : `You have been invited to join ${householdName}. Please choose your secure password.`
                  : isHe
                  ? `הגדר סיסמה חדשה עבור החשבון שלך (${invitation?.email})`
                  : `Set a new password for your account (${invitation?.email})`}
              </p>
            </div>

            {/* Email Reminder Badge */}
            <div style={styles.emailBadge}>
              <span style={styles.emailLabel}>{isHe ? 'כתובת אימייל:' : 'Email Address:'}</span>
              <span style={styles.emailValue}>{invitation?.email}</span>
            </div>

            {submitError && (
              <div style={styles.errorAlert}>
                <AlertCircle size={16} color="#DC2626" />
                <span>{submitError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {tokenType === 'invite'
                    ? isHe
                      ? 'בחר סיסמה אישית (לפחות 6 תווים)'
                      : 'Choose Password (min 6 chars)'
                    : isHe
                    ? 'סיסמה חדשה (לפחות 6 תווים)'
                    : 'New Password (min 6 chars)'}
                </label>
                <div style={styles.inputWrap}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    style={styles.textInput}
                    autoFocus
                  />
                  <button
                    type="button"
                    style={styles.showPassBtn}
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  {isHe ? 'אימות סיסמה' : 'Confirm Password'}
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  style={styles.textInput}
                />
              </div>

              <button
                type="submit"
                style={styles.primaryBtn}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span>{isHe ? 'מעדכן חשבון...' : 'Processing...'}</span>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>
                      {tokenType === 'invite'
                        ? isHe
                          ? 'השלם הרשמה והתחבר'
                          : 'Complete Signup & Enter'
                        : isHe
                        ? 'עדכן סיסמה והתחבר'
                        : 'Update Password & Enter'}
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                style={styles.cancelBtn}
                onClick={handleClose}
              >
                {isHe ? 'ביטול וחזרה למסך הראשי' : 'Cancel and return'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 9999,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: '24px',
    border: '1px solid var(--border-main, #E2E8F0)',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    maxWidth: '460px',
    width: '100%',
    padding: '32px 28px',
    position: 'relative',
  },
  headerIconBox: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    backgroundColor: 'var(--primary-light, #EEF2FF)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
  },
  householdPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 12px',
    borderRadius: '20px',
    backgroundColor: '#EFF6FF',
    color: '#2563EB',
    fontSize: '0.75rem',
    fontWeight: '700',
    marginBottom: '8px',
  },
  title: {
    fontSize: '1.375rem',
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: '6px',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#64748B',
    lineHeight: '1.5',
    margin: 0,
  },
  emailBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderRadius: '12px',
    backgroundColor: '#F8FAFC',
    border: '1px solid #E2E8F0',
    marginBottom: '16px',
    fontSize: '0.8125rem',
  },
  emailLabel: {
    color: '#64748B',
    fontWeight: '600',
  },
  emailValue: {
    color: '#0F172A',
    fontWeight: '700',
    direction: 'ltr',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    textAlign: 'inherit',
  },
  label: {
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: '#334155',
  },
  inputWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  textInput: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1.5px solid #CBD5E1',
    fontSize: '0.9375rem',
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s ease',
  },
  showPassBtn: {
    position: 'absolute',
    left: '12px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#64748B',
    display: 'flex',
    alignItems: 'center',
    padding: 0,
  },
  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 20px',
    backgroundColor: 'var(--primary, #4F46E5)',
    color: '#FFFFFF',
    borderRadius: '12px',
    border: 'none',
    fontSize: '0.9375rem',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
    transition: 'all 0.15s ease',
    marginTop: '6px',
    width: '100%',
  },
  cancelBtn: {
    background: 'none',
    border: 'none',
    color: '#64748B',
    fontSize: '0.8125rem',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'center',
    padding: '6px',
  },
  stateCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '12px',
    padding: '20px 0',
  },
  spinner: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: '3px solid #E2E8F0',
    borderTopColor: 'var(--primary, #4F46E5)',
    animation: 'spin 0.8s linear infinite',
  },
  errorIconBox: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: '#FEE2E2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconBox: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: '#DCFCE7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderRadius: '10px',
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    color: '#DC2626',
    fontSize: '0.8125rem',
    fontWeight: '600',
    marginBottom: '14px',
  },
};
