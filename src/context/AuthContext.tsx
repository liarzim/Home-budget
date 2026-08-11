import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured, signInWithSocialOAuth, signOutUser, OAuthProvider } from '../lib/supabase';
import {
  Profile,
  Household,
  Category,
  BusinessMapping,
  CardMapping,
  MacroCategory,
  Transaction,
  Budget,
  Savings,
  HouseholdMember,
  MemberRole,
  SUPER_USER_EMAILS,
} from '../lib/types';
import {
  mockProfile,
  mockHouseholds,
  mockHouseholdMembers,
  mockCategories,
  mockMacroCategories,
  mockBusinessMappings,
  mockCardMappings,
  mockTransactions,
  mockBudgets,
  mockSavings,
} from '../lib/mockData';

import { Language } from '../lib/i18n';

// UUID generator helper ensuring 100% valid UUID format for PostgreSQL UUID columns
export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

interface AuthContextType {
  user: Profile | null;
  households: Household[];
  activeHousehold: Household | null;
  householdMembers: HouseholdMember[];
  isSuperUser: boolean;
  currentRole: 'super_admin' | 'owner' | 'admin' | 'user' | 'viewer';
  canManageUsers: boolean;
  canEditRecords: boolean;
  canDeleteRecords: boolean;
  canImportFiles: boolean;
  canManageSystemTables: boolean;
  isReadOnly: boolean;
  allSystemHouseholds: Household[];
  macroCategories: MacroCategory[];
  categories: Category[];
  businessMappings: BusinessMapping[];
  cardMappings: CardMapping[];
  transactions: Transaction[];
  budgets: Budget[];
  savings: Savings[];
  isLoading: boolean;
  isDemoMode: boolean;
  isSupabaseReady: boolean;
  language: Language;
  setLanguage: (lang: Language) => void;
  dir: 'rtl' | 'ltr';
  activeTab:
    | 'dashboard'
    | 'transactions'
    | 'budgets'
    | 'savings'
    | 'mappings'
    | 'schema'
    | 'import'
    | 'manual-entry'
    | 'migration'
    | 'bank-accounts'
    | 'system-tables'
    | 'users';
  setActiveTab: (
    tab:
      | 'dashboard'
      | 'transactions'
      | 'budgets'
      | 'savings'
      | 'mappings'
      | 'schema'
      | 'import'
      | 'manual-entry'
      | 'migration'
      | 'bank-accounts'
      | 'system-tables'
      | 'users'
  ) => void;
  loginWithOAuth: (provider: OAuthProvider) => Promise<{ success: boolean; error?: string }>;
  loginDemo: (userName?: string) => void;
  logout: () => Promise<void>;
  switchHousehold: (householdId: string) => void;
  toggleTransactionVisibility: (id: string) => void;
  addTransaction: (tx: Partial<Transaction>) => void;
  addBatchTransactions: (txs: Transaction[]) => void;
  addHousehold: (name: string, currency?: string, icon?: string, color?: string) => Promise<Household | null>;
  createHouseholdAsSuperUser: (name: string, currency?: string, icon?: string, color?: string) => Promise<Household | null>;
  updateHousehold: (
    householdId: string,
    updates: { name?: string; icon?: string; currency?: string; color?: string }
  ) => Promise<{ success: boolean; error?: string }>;
  fetchHouseholdMembers: (householdId: string) => Promise<HouseholdMember[]>;
  addHouseholdMember: (householdId: string, email: string, role: MemberRole, fullName?: string) => Promise<{ success: boolean; error?: string }>;
  updateMemberRole: (memberId: string, newRole: MemberRole) => Promise<{ success: boolean; error?: string }>;
  removeHouseholdMember: (memberId: string) => Promise<{ success: boolean; error?: string }>;
  addMacroCategory: (name: string, type: 'expense' | 'income', color?: string, icon?: string, displayOrder?: number) => void;
  updateMacroCategory: (id: string, name: string, color?: string, icon?: string, displayOrder?: number) => void;
  deleteMacroCategory: (id: string) => void;
  batchAddMacroCategories: (macros: Partial<MacroCategory>[]) => void;
  addCategory: (name: string, type: 'expense' | 'income', color?: string, icon?: string, macroCategoryId?: string | null) => void;
  updateCategory: (id: string, name: string, color?: string, icon?: string, macroCategoryId?: string | null) => void;
  deleteCategory: (id: string) => void;
  batchAddCategories: (cats: Partial<Category>[]) => void;
  addBusinessMapping: (pattern: string, categoryId: string) => void;
  updateBusinessMapping: (id: string, pattern: string, categoryId: string) => void;
  deleteBusinessMapping: (id: string) => void;
  batchAddBusinessMappings: (mappings: { pattern: string; category_id: string }[]) => void;
  addCardMapping: (rawPattern: string, displayName: string, lastDigits?: string, color?: string) => void;
  updateCardMapping: (id: string, rawPattern: string, displayName: string, lastDigits?: string, color?: string) => void;
  deleteCardMapping: (id: string) => void;
  batchAddCardMappings: (mappings: Partial<CardMapping>[]) => void;
  seedDefaultHouseholdData: (targetHouseholdId?: string) => Promise<void>;
  showHiddenNotice: boolean;
  setShowHiddenNotice: (val: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [allSystemHouseholds, setAllSystemHouseholds] = useState<Household[]>([]);
  const [activeHousehold, setActiveHousehold] = useState<Household | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);
  const [macroCategories, setMacroCategories] = useState<MacroCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [businessMappings, setBusinessMappings] = useState<BusinessMapping[]>([]);
  const [cardMappings, setCardMappings] = useState<CardMapping[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [savings, setSavings] = useState<Savings[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<AuthContextType['activeTab']>('dashboard');

  // Role & Permissions calculation
  const isSuperUser = Boolean(
    user?.email && SUPER_USER_EMAILS.some((e) => e.toLowerCase() === user.email.toLowerCase())
  );

  const currentRole: 'super_admin' | 'owner' | 'admin' | 'user' | 'viewer' = isSuperUser
    ? 'super_admin'
    : activeHousehold?.role === 'owner' || activeHousehold?.created_by === user?.id
    ? 'admin'
    : (activeHousehold?.role as any) === 'admin'
    ? 'admin'
    : (activeHousehold?.role as any) === 'viewer'
    ? 'viewer'
    : 'user';

  const canManageUsers = isSuperUser || currentRole === 'admin' || currentRole === 'super_admin';
  const canEditRecords = isSuperUser || currentRole === 'admin' || currentRole === 'user' || currentRole === 'super_admin';
  const canDeleteRecords = isSuperUser || currentRole === 'admin' || currentRole === 'super_admin';
  const canImportFiles = isSuperUser || currentRole === 'admin' || currentRole === 'super_admin';
  const canManageSystemTables = isSuperUser || currentRole === 'admin' || currentRole === 'super_admin';
  const isReadOnly = currentRole === 'viewer';

  // Show is_hidden exclusion notice banner in dashboard (default: false)
  const [showHiddenNotice, setShowHiddenNoticeState] = useState<boolean>(() => {
    return localStorage.getItem('show_hidden_notice') === 'true';
  });

  const setShowHiddenNotice = (val: boolean) => {
    setShowHiddenNoticeState(val);
    localStorage.setItem('show_hidden_notice', val ? 'true' : 'false');
  };

  // Language & Direction state
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('preferred_language');
    return (saved === 'en' || saved === 'he') ? saved : 'he';
  });

  const dir: 'rtl' | 'ltr' = language === 'he' ? 'rtl' : 'ltr';

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('preferred_language', lang);
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  };

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [language, dir]);

  // Initial Auth Check
  useEffect(() => {
    async function initAuth() {
      try {
        if (!isSupabaseConfigured) {
          // If keys are not configured, auto-load mock demo data
          loginDemo();
          return;
        }

        // Check active session from Supabase
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          await loadSupabaseUserData(session.user.id, session.user.email);
        } else {
          // Default to demo mode if not authenticated
          loginDemo();
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        loginDemo();
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();

    // Listen for auth state changes (OAuth Redirects, Logins, Logouts)
    if (isSupabaseConfigured) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setIsLoading(true);
          await loadSupabaseUserData(session.user.id, session.user.email);
          setIsLoading(false);
        } else if (event === 'SIGNED_OUT') {
          logout();
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  async function loadSupabaseUserData(userId: string, email?: string) {
    try {
      setIsDemoMode(false);
      // Fetch or Create Profile
      let { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!profile && email) {
        const { data: newProf } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: email,
            full_name: email.split('@')[0],
          })
          .select()
          .single();
        profile = newProf;
      }

      setUser(profile || {
        id: userId,
        email: email || '',
        full_name: email?.split('@')[0] || 'User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const isUserSuper = Boolean(
        email && SUPER_USER_EMAILS.some((e) => e.toLowerCase() === email.toLowerCase())
      );

      if (isUserSuper) {
        // Super User: Fetch ALL households in the entire database
        const { data: allHhs } = await supabase.from('households').select('*').order('created_at', { ascending: false });
        if (allHhs && allHhs.length > 0) {
          const formattedAll: Household[] = allHhs.map((h: any) => ({
            id: h.id,
            name: h.name,
            currency: h.currency,
            icon: h.icon || 'Home',
            color: h.color || '#4F46E5',
            created_by: h.created_by,
            created_at: h.created_at,
            updated_at: h.updated_at,
            role: 'super_admin',
          }));
          setHouseholds(formattedAll);
          setAllSystemHouseholds(formattedAll);
          const defaultHh = formattedAll[0];
          setActiveHousehold(defaultHh);
          await loadHouseholdDetails(defaultHh.id);
        }
      } else {
        // Regular user: Fetch member households
        const { data: userHouseholds } = await supabase
          .from('households')
          .select('*, household_members(role, is_default)');

        if (userHouseholds && userHouseholds.length > 0) {
          const formattedHouseholds: Household[] = userHouseholds.map((h: any) => ({
            id: h.id,
            name: h.name,
            currency: h.currency,
            icon: h.icon || 'Home',
            color: h.color || '#4F46E5',
            created_by: h.created_by,
            created_at: h.created_at,
            updated_at: h.updated_at,
            role: h.household_members?.[0]?.role || 'user',
          }));
          setHouseholds(formattedHouseholds);
          const defaultHh = formattedHouseholds[0];
          setActiveHousehold(defaultHh);
          await loadHouseholdDetails(defaultHh.id);
        }
      }
    } catch (err) {
      console.error('Failed to load user data from Supabase:', err);
    }
  }

  async function loadHouseholdDetails(householdId: string) {
    try {
      // Fetch Macro Categories (handle table not found gracefully)
      try {
        const { data: mcs, error: mcErr } = await supabase
          .from('macro_categories')
          .select('*')
          .eq('household_id', householdId)
          .order('display_order', { ascending: true });
        if (!mcErr && mcs) {
          setMacroCategories(mcs);
        }
      } catch (e) {
        console.warn('macro_categories table not queryable yet');
      }

      // Fetch Categories
      const { data: cats } = await supabase
        .from('categories')
        .select('*')
        .eq('household_id', householdId);
      if (cats) setCategories(cats);

      // Fetch Business Mappings
      const { data: bms } = await supabase
        .from('business_mapping')
        .select('*')
        .eq('household_id', householdId);
      if (bms) setBusinessMappings(bms);

      // Fetch Payment Method Mappings
      try {
        const { data: pms, error: pmErr } = await supabase
          .from('payment_method_mappings')
          .select('*')
          .eq('household_id', householdId);
        if (!pmErr && pms) {
          setCardMappings(pms);
        }
      } catch (e) {
        console.warn('payment_method_mappings table not queryable yet');
      }

      // Fetch Transactions
      const { data: txs } = await supabase
        .from('transactions')
        .select('*')
        .eq('household_id', householdId)
        .order('date', { ascending: false });
      if (txs) setTransactions(txs);

      // Fetch Budgets
      const { data: bgs } = await supabase
        .from('budgets')
        .select('*')
        .eq('household_id', householdId);
      if (bgs) setBudgets(bgs);

      // Fetch Savings
      const { data: savs } = await supabase
        .from('savings')
        .select('*')
        .eq('household_id', householdId)
        .order('year', { ascending: false });
      if (savs) setSavings(savs);
    } catch (err) {
      console.error('Error loading household details:', err);
    }
  }

  const loginWithOAuth = async (provider: OAuthProvider) => {
    setIsLoading(true);
    try {
      if (!isSupabaseConfigured) {
        // Fallback to demo mode if keys not entered yet
        loginDemo();
        return { success: true };
      }
      const { error } = await signInWithSocialOAuth(provider);
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'OAuth error' };
    } finally {
      setIsLoading(false);
    }
  };

  const loginDemo = (userName: string = 'Micha') => {
    setIsDemoMode(true);
    setUser({ ...mockProfile, full_name: userName, email: 'michael.liarzi@gmail.com' });
    setHouseholds(mockHouseholds);
    setAllSystemHouseholds(mockHouseholds);
    setActiveHousehold(mockHouseholds[0]);
    setHouseholdMembers(mockHouseholdMembers);
    setMacroCategories(mockMacroCategories);
    setCategories(mockCategories);
    setBusinessMappings(mockBusinessMappings);
    setCardMappings(mockCardMappings);
    setTransactions(mockTransactions);
    setBudgets(mockBudgets);
    setSavings(mockSavings);
    setIsLoading(false);
  };

  const logout = async () => {
    setIsLoading(true);
    if (isSupabaseConfigured) {
      await signOutUser();
    }
    setUser(null);
    setHouseholds([]);
    setAllSystemHouseholds([]);
    setActiveHousehold(null);
    setHouseholdMembers([]);
    setMacroCategories([]);
    setCategories([]);
    setBusinessMappings([]);
    setCardMappings([]);
    setTransactions([]);
    setBudgets([]);
    setSavings([]);
    setIsDemoMode(false);
    setIsLoading(false);
    setActiveTab('dashboard');
  };

  const switchHousehold = (householdId: string) => {
    const target = households.find((h) => h.id === householdId);
    if (target) {
      setActiveHousehold(target);
      if (isSupabaseConfigured && !isDemoMode) {
        loadHouseholdDetails(target.id);
      }
    }
  };

  // Soft delete / hide toggle
  const toggleTransactionVisibility = (id: string) => {
    setTransactions((prev) =>
      prev.map((tx) => (tx.id === id ? { ...tx, is_hidden: !tx.is_hidden } : tx))
    );
    if (isSupabaseConfigured && !isDemoMode) {
      const target = transactions.find((t) => t.id === id);
      if (target) {
        supabase
          .from('transactions')
          .update({ is_hidden: !target.is_hidden })
          .eq('id', id)
          .then();
      }
    }
  };

  const addTransaction = (tx: Partial<Transaction>) => {
    if (!activeHousehold) return;
    const newTx: Transaction = {
      id: tx.id || generateUUID(),
      household_id: activeHousehold.id,
      date: tx.date || new Date().toISOString().split('T')[0],
      amount: tx.amount || 0,
      category_id: tx.category_id || null,
      transaction_type: tx.transaction_type || 'expense',
      payee_name: tx.payee_name || 'Manual Entry',
      original_description: tx.original_description,
      payment_method: tx.payment_method || 'credit_card',
      card_last_digits: tx.card_last_digits,
      is_hidden: tx.is_hidden ?? false,
      notes: tx.notes,
      created_by: user?.id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setTransactions((prev) => [newTx, ...prev]);

    if (isSupabaseConfigured && !isDemoMode) {
      supabase
        .from('transactions')
        .insert({
          id: newTx.id,
          household_id: activeHousehold.id,
          date: newTx.date,
          amount: newTx.amount,
          category_id: newTx.category_id,
          transaction_type: newTx.transaction_type,
          payee_name: newTx.payee_name,
          original_description: newTx.original_description,
          payment_method: newTx.payment_method,
          card_last_digits: newTx.card_last_digits,
          is_hidden: newTx.is_hidden,
          notes: newTx.notes,
        })
        .then();
    }
  };

  const addBatchTransactions = (txs: Transaction[]) => {
    if (!activeHousehold) return;
    const mappedTxs = txs.map((tx) => ({
      ...tx,
      id: tx.id && tx.id.length > 20 ? tx.id : generateUUID(),
      household_id: activeHousehold.id,
      is_hidden: tx.is_hidden ?? false,
    }));

    setTransactions((prev) => [...mappedTxs, ...prev]);

    if (isSupabaseConfigured && !isDemoMode) {
      supabase
        .from('transactions')
        .insert(
          mappedTxs.map((tx) => ({
            id: tx.id,
            household_id: activeHousehold.id,
            date: tx.date,
            amount: tx.amount,
            category_id: tx.category_id,
            transaction_type: tx.transaction_type,
            payee_name: tx.payee_name,
            original_description: tx.original_description,
            payment_method: tx.payment_method,
            card_last_digits: tx.card_last_digits,
            is_hidden: false,
            notes: tx.notes,
          }))
        )
        .then();
    }
  };

  const addHousehold = async (
    name: string,
    currency: string = 'ILS',
    icon: string = 'Home',
    color: string = '#4F46E5'
  ): Promise<Household | null> => {
    const newHh: Household = {
      id: generateUUID(),
      name: name.trim(),
      currency,
      icon,
      color,
      created_by: user?.id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      role: 'owner',
      members_count: 1,
    };
    setHouseholds((prev) => [...prev, newHh]);
    setAllSystemHouseholds((prev) => [...prev, newHh]);
    setActiveHousehold(newHh);

    if (isSupabaseConfigured && !isDemoMode) {
      try {
        const { data, error } = await supabase
          .from('households')
          .insert({ id: newHh.id, name: newHh.name, currency, icon, color })
          .select()
          .single();

        if (error) {
          // If icon/color columns are not yet in Supabase schema, retry with just base fields
          if (error.message?.includes('column')) {
            await supabase
              .from('households')
              .insert({ id: newHh.id, name: newHh.name, currency })
              .select()
              .single();
          } else {
            throw error;
          }
        }

        if (user?.id) {
          await supabase.from('household_members').insert({
            household_id: newHh.id,
            user_id: user.id,
            role: 'owner',
            is_default: false,
          });
        }
        if (data) {
          await loadSupabaseUserData(user!.id, user!.email);
        }
      } catch (err) {
        console.error('Failed to create household in Supabase:', err);
      }
    }
    return newHh;
  };

  const createHouseholdAsSuperUser = async (
    name: string,
    currency: string = 'ILS',
    icon: string = 'Home',
    color: string = '#4F46E5'
  ): Promise<Household | null> => {
    return addHousehold(name, currency, icon, color);
  };

  const updateHousehold = async (
    householdId: string,
    updates: { name?: string; icon?: string; currency?: string; color?: string }
  ): Promise<{ success: boolean; error?: string }> => {
    const updatedName = updates.name !== undefined ? updates.name.trim() : undefined;
    const nowIso = new Date().toISOString();

    setHouseholds((prev) =>
      prev.map((h) =>
        h.id === householdId
          ? { ...h, ...updates, ...(updatedName ? { name: updatedName } : {}), updated_at: nowIso }
          : h
      )
    );
    setAllSystemHouseholds((prev) =>
      prev.map((h) =>
        h.id === householdId
          ? { ...h, ...updates, ...(updatedName ? { name: updatedName } : {}), updated_at: nowIso }
          : h
      )
    );
    setActiveHousehold((prev) =>
      prev && prev.id === householdId
        ? { ...prev, ...updates, ...(updatedName ? { name: updatedName } : {}), updated_at: nowIso }
        : prev
    );

    if (isSupabaseConfigured && !isDemoMode) {
      try {
        const updatePayload: any = { updated_at: nowIso };
        if (updatedName) updatePayload.name = updatedName;
        if (updates.icon) updatePayload.icon = updates.icon;
        if (updates.currency) updatePayload.currency = updates.currency;
        if (updates.color) updatePayload.color = updates.color;

        const { error } = await supabase
          .from('households')
          .update(updatePayload)
          .eq('id', householdId);

        if (error) {
          console.warn('Error updating household in Supabase:', error);
          if (error.message?.includes('column') && updatedName) {
            await supabase
              .from('households')
              .update({ name: updatedName, updated_at: nowIso })
              .eq('id', householdId);
          }
        }
      } catch (err: any) {
        console.error('Failed to update household in Supabase:', err);
        return { success: false, error: err.message || 'Database error' };
      }
    }
    return { success: true };
  };

  // Household Member Management
  const fetchHouseholdMembers = async (householdId: string): Promise<HouseholdMember[]> => {
    if (!isSupabaseConfigured || isDemoMode) {
      const filtered = mockHouseholdMembers.filter((m) => m.household_id === householdId || m.household_id === 'hh-main');
      setHouseholdMembers(filtered);
      return filtered;
    }
    try {
      const { data, error } = await supabase
        .from('household_members')
        .select('*, profiles(id, email, full_name, avatar_url)')
        .eq('household_id', householdId);

      if (error) {
        console.warn('Error fetching household members:', error);
        return [];
      }
      const formatted: HouseholdMember[] = (data || []).map((m: any) => ({
        id: m.id,
        household_id: m.household_id,
        user_id: m.user_id,
        role: m.role || 'user',
        is_default: m.is_default || false,
        joined_at: m.joined_at || m.created_at || new Date().toISOString(),
        email: m.profiles?.email || m.email || '',
        full_name: m.profiles?.full_name || m.full_name || m.profiles?.email?.split('@')[0] || 'User',
      }));
      setHouseholdMembers(formatted);
      return formatted;
    } catch (err) {
      console.error('Failed to fetch household members:', err);
      return [];
    }
  };

  const addHouseholdMember = async (
    householdId: string,
    email: string,
    role: MemberRole,
    fullName?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return { success: false, error: 'Email is required' };

    const newMember: HouseholdMember = {
      id: generateUUID(),
      household_id: householdId,
      user_id: generateUUID(),
      role: role === 'super_admin' ? 'admin' : role,
      is_default: false,
      joined_at: new Date().toISOString(),
      email: trimmedEmail,
      full_name: fullName?.trim() || trimmedEmail.split('@')[0],
    };

    setHouseholdMembers((prev) => [...prev, newMember]);

    if (isSupabaseConfigured && !isDemoMode) {
      try {
        // Check if profile exists with this email
        let targetUserId: string | null = null;
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', trimmedEmail)
          .maybeSingle();

        if (existingProfile) {
          targetUserId = existingProfile.id;
        } else {
          // Insert placeholder profile
          const placeholderId = generateUUID();
          const { data: createdProf, error: profErr } = await supabase
            .from('profiles')
            .insert({
              id: placeholderId,
              email: trimmedEmail,
              full_name: fullName?.trim() || trimmedEmail.split('@')[0],
            })
            .select()
            .maybeSingle();
          if (!profErr && createdProf) {
            targetUserId = createdProf.id;
          }
        }

        if (targetUserId) {
          const { error: insertErr } = await supabase.from('household_members').insert({
            household_id: householdId,
            user_id: targetUserId,
            role: role === 'super_admin' ? 'admin' : role,
          });
          if (insertErr) throw insertErr;
        }
      } catch (err: any) {
        console.error('Error adding household member in Supabase:', err);
        return { success: false, error: err.message || 'Database error' };
      }
    }
    return { success: true };
  };

  const updateMemberRole = async (
    memberId: string,
    newRole: MemberRole
  ): Promise<{ success: boolean; error?: string }> => {
    setHouseholdMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
    );
    if (isSupabaseConfigured && !isDemoMode) {
      try {
        const { error } = await supabase
          .from('household_members')
          .update({ role: newRole })
          .eq('id', memberId);
        if (error) throw error;
      } catch (err: any) {
        console.error('Error updating member role in Supabase:', err);
        return { success: false, error: err.message };
      }
    }
    return { success: true };
  };

  const removeHouseholdMember = async (
    memberId: string
  ): Promise<{ success: boolean; error?: string }> => {
    setHouseholdMembers((prev) => prev.filter((m) => m.id !== memberId));
    if (isSupabaseConfigured && !isDemoMode) {
      try {
        const { error } = await supabase
          .from('household_members')
          .delete()
          .eq('id', memberId);
        if (error) throw error;
      } catch (err: any) {
        console.error('Error removing member from Supabase:', err);
        return { success: false, error: err.message };
      }
    }
    return { success: true };
  };

  // Macro Category Management
  const addMacroCategory = (
    name: string,
    type: 'expense' | 'income',
    color?: string,
    icon?: string,
    displayOrder?: number
  ) => {
    if (!activeHousehold) return;
    const newMacro: MacroCategory = {
      id: generateUUID(),
      household_id: activeHousehold.id,
      name: name.trim(),
      type,
      color: color || (type === 'income' ? '#10B981' : '#4F46E5'),
      icon: icon || (type === 'income' ? 'Briefcase' : 'ShoppingBag'),
      display_order: displayOrder ?? (macroCategories.length + 1),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setMacroCategories((prev) => [...prev, newMacro]);

    if (isSupabaseConfigured && !isDemoMode) {
      supabase.from('macro_categories').insert(newMacro).then();
    }
  };

  const updateMacroCategory = (
    id: string,
    name: string,
    color?: string,
    icon?: string,
    displayOrder?: number
  ) => {
    setMacroCategories((prev) =>
      prev.map((mc) =>
        mc.id === id
          ? {
              ...mc,
              name: name.trim(),
              ...(color ? { color } : {}),
              ...(icon ? { icon } : {}),
              ...(displayOrder !== undefined ? { display_order: displayOrder } : {}),
              updated_at: new Date().toISOString(),
            }
          : mc
      )
    );

    if (isSupabaseConfigured && !isDemoMode) {
      supabase
        .from('macro_categories')
        .update({
          name: name.trim(),
          ...(color ? { color } : {}),
          ...(icon ? { icon } : {}),
          ...(displayOrder !== undefined ? { display_order: displayOrder } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .then();
    }
  };

  const deleteMacroCategory = (id: string) => {
    setMacroCategories((prev) => prev.filter((mc) => mc.id !== id));

    // Clear macro_category_id reference on any categories that had it
    setCategories((prev) =>
      prev.map((c) => (c.macro_category_id === id ? { ...c, macro_category_id: null } : c))
    );

    if (isSupabaseConfigured && !isDemoMode) {
      supabase.from('macro_categories').delete().eq('id', id).then();
    }
  };

  const batchAddMacroCategories = (macros: Partial<MacroCategory>[]) => {
    if (!activeHousehold) return;
    const newMacros: MacroCategory[] = macros.map((m, i) => ({
      id: m.id || generateUUID(),
      household_id: activeHousehold.id,
      name: (m.name || '').trim(),
      type: m.type || 'expense',
      color: m.color || (m.type === 'income' ? '#10B981' : '#4F46E5'),
      icon: m.icon || (m.type === 'income' ? 'Briefcase' : 'ShoppingBag'),
      display_order: m.display_order ?? (macroCategories.length + i + 1),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    setMacroCategories((prev) => [...prev, ...newMacros]);

    if (isSupabaseConfigured && !isDemoMode) {
      supabase.from('macro_categories').insert(newMacros).then();
    }
  };

  // Category Management
  const addCategory = (
    name: string,
    type: 'expense' | 'income',
    color?: string,
    icon?: string,
    macroCategoryId?: string | null
  ) => {
    if (!activeHousehold) return;
    const newCat: Category = {
      id: generateUUID(),
      household_id: activeHousehold.id,
      name: name.trim(),
      type,
      color: color || (type === 'income' ? '#10B981' : '#4F46E5'),
      icon: icon || (type === 'income' ? 'briefcase' : 'tag'),
      macro_category_id: macroCategoryId || null,
      is_system: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setCategories((prev) => [...prev, newCat]);

    if (isSupabaseConfigured && !isDemoMode) {
      supabase.from('categories').insert(newCat).then();
    }
  };

  const updateCategory = (
    id: string,
    name: string,
    color?: string,
    icon?: string,
    macroCategoryId?: string | null
  ) => {
    setCategories((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              name: name.trim(),
              ...(color ? { color } : {}),
              ...(icon ? { icon } : {}),
              macro_category_id: macroCategoryId !== undefined ? macroCategoryId : c.macro_category_id,
              updated_at: new Date().toISOString(),
            }
          : c
      )
    );

    if (isSupabaseConfigured && !isDemoMode) {
      supabase
        .from('categories')
        .update({
          name: name.trim(),
          ...(color ? { color } : {}),
          ...(icon ? { icon } : {}),
          ...(macroCategoryId !== undefined ? { macro_category_id: macroCategoryId } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .then();
    }
  };

  const deleteCategory = (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));

    if (isSupabaseConfigured && !isDemoMode) {
      supabase.from('categories').delete().eq('id', id).then();
    }
  };

  const batchAddCategories = (cats: Partial<Category>[]) => {
    if (!activeHousehold) return;
    const newCats: Category[] = cats.map((c, i) => ({
      id: c.id || generateUUID(),
      household_id: activeHousehold.id,
      name: (c.name || '').trim(),
      type: c.type || 'expense',
      color: c.color || (c.type === 'income' ? '#10B981' : '#4F46E5'),
      icon: c.icon || (c.type === 'income' ? 'briefcase' : 'tag'),
      macro_category_id: c.macro_category_id || null,
      is_system: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    setCategories((prev) => [...prev, ...newCats]);

    if (isSupabaseConfigured && !isDemoMode) {
      supabase.from('categories').insert(newCats).then();
    }
  };

  // Business Mapping Management
  const addBusinessMapping = (pattern: string, categoryId: string) => {
    if (!activeHousehold) return;
    const newMapping: BusinessMapping = {
      id: generateUUID(),
      household_id: activeHousehold.id,
      pattern: pattern.toUpperCase(),
      category_id: categoryId,
      priority: 10,
      is_regex: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setBusinessMappings((prev) => [newMapping, ...prev]);

    if (isSupabaseConfigured && !isDemoMode) {
      supabase.from('business_mapping').insert(newMapping).then();
    }
  };

  const updateBusinessMapping = (id: string, pattern: string, categoryId: string) => {
    setBusinessMappings((prev) =>
      prev.map((bm) =>
        bm.id === id
          ? {
              ...bm,
              pattern: pattern.toUpperCase(),
              category_id: categoryId,
              updated_at: new Date().toISOString(),
            }
          : bm
      )
    );

    if (isSupabaseConfigured && !isDemoMode) {
      supabase
        .from('business_mapping')
        .update({
          pattern: pattern.toUpperCase(),
          category_id: categoryId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .then();
    }
  };

  const deleteBusinessMapping = (id: string) => {
    setBusinessMappings((prev) => prev.filter((bm) => bm.id !== id));

    if (isSupabaseConfigured && !isDemoMode) {
      supabase.from('business_mapping').delete().eq('id', id).then();
    }
  };

  const batchAddBusinessMappings = (mappings: { pattern: string; category_id: string }[]) => {
    if (!activeHousehold) return;
    const newMappings: BusinessMapping[] = mappings.map((m, i) => ({
      id: generateUUID(),
      household_id: activeHousehold.id,
      pattern: m.pattern.toUpperCase().trim(),
      category_id: m.category_id,
      priority: 10,
      is_regex: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    setBusinessMappings((prev) => [...newMappings, ...prev]);

    if (isSupabaseConfigured && !isDemoMode) {
      supabase.from('business_mapping').insert(newMappings).then();
    }
  };

  // Card / Payment Method Mapping Management
  const addCardMapping = (
    rawPattern: string,
    displayName: string,
    lastDigits?: string,
    color?: string
  ) => {
    if (!activeHousehold) return;
    const newCardMapping: CardMapping = {
      id: generateUUID(),
      household_id: activeHousehold.id,
      raw_pattern: rawPattern.trim(),
      display_name: displayName.trim(),
      card_last_digits: lastDigits || null,
      payment_type: 'credit_card',
      color: color || '#4F46E5',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setCardMappings((prev) => [newCardMapping, ...prev]);

    if (isSupabaseConfigured && !isDemoMode) {
      supabase.from('payment_method_mappings').insert(newCardMapping).then();
    }
  };

  const updateCardMapping = (
    id: string,
    rawPattern: string,
    displayName: string,
    lastDigits?: string,
    color?: string
  ) => {
    setCardMappings((prev) =>
      prev.map((cm) =>
        cm.id === id
          ? {
              ...cm,
              raw_pattern: rawPattern.trim(),
              display_name: displayName.trim(),
              card_last_digits: lastDigits || cm.card_last_digits,
              ...(color ? { color } : {}),
              updated_at: new Date().toISOString(),
            }
          : cm
      )
    );

    if (isSupabaseConfigured && !isDemoMode) {
      supabase
        .from('payment_method_mappings')
        .update({
          raw_pattern: rawPattern.trim(),
          display_name: displayName.trim(),
          card_last_digits: lastDigits,
          ...(color ? { color } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .then();
    }
  };

  const deleteCardMapping = (id: string) => {
    setCardMappings((prev) => prev.filter((cm) => cm.id !== id));

    if (isSupabaseConfigured && !isDemoMode) {
      supabase.from('payment_method_mappings').delete().eq('id', id).then();
    }
  };

  const batchAddCardMappings = (mappings: Partial<CardMapping>[]) => {
    if (!activeHousehold) return;
    const newItems: CardMapping[] = mappings.map((m, i) => ({
      id: m.id || generateUUID(),
      household_id: activeHousehold.id,
      raw_pattern: (m.raw_pattern || '').trim(),
      display_name: (m.display_name || m.raw_pattern || '').trim(),
      card_last_digits: m.card_last_digits || null,
      payment_type: m.payment_type || 'credit_card',
      color: m.color || '#4F46E5',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    setCardMappings((prev) => [...newItems, ...prev]);

    if (isSupabaseConfigured && !isDemoMode) {
      supabase.from('payment_method_mappings').insert(newItems).then();
    }
  };

  // Seed default Israeli household classification system tables
  const seedDefaultHouseholdData = async (targetHouseholdId?: string) => {
    const hhId = targetHouseholdId || activeHousehold?.id;
    if (!hhId) return;

    // 1. Create standard Macro Categories with valid UUIDs
    const mcFixedId = generateUUID();
    const mcVarId = generateUUID();
    const mcSeasonId = generateUUID();
    const mcSalaryId = generateUUID();
    const mcExtraId = generateUUID();

    const newMacros: MacroCategory[] = [
      {
        id: mcFixedId,
        household_id: hhId,
        name: 'הוצאות קבועות (דיור, רכב, ביטוח)',
        type: 'expense',
        color: '#4F46E5',
        icon: 'Lock',
        display_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: mcVarId,
        household_id: hhId,
        name: 'הוצאות משתנות (מזון, בילויים, קניות)',
        type: 'expense',
        color: '#F59E0B',
        icon: 'ShoppingBag',
        display_order: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: mcSeasonId,
        household_id: hhId,
        name: 'הוצאות עונתיות, נופש ושנתיות',
        type: 'expense',
        color: '#EC4899',
        icon: 'Calendar',
        display_order: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: mcSalaryId,
        household_id: hhId,
        name: 'משכורות והכנסות עיקריות',
        type: 'income',
        color: '#10B981',
        icon: 'Briefcase',
        display_order: 4,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: mcExtraId,
        household_id: hhId,
        name: 'קצבאות, מענקים והכנסות נוספות',
        type: 'income',
        color: '#06B6D4',
        icon: 'Gift',
        display_order: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    // 2. Create standard Categories linked to Macro Categories
    const catSuper = { id: generateUUID(), household_id: hhId, name: 'Groceries & Supermarket', type: 'expense' as const, color: '#10B981', icon: 'shopping-cart', macro_category_id: mcVarId, is_system: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const catHousing = { id: generateUUID(), household_id: hhId, name: 'Housing & Rent', type: 'expense' as const, color: '#4F46E5', icon: 'home', macro_category_id: mcFixedId, is_system: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const catTrans = { id: generateUUID(), household_id: hhId, name: 'Transportation & Fuel', type: 'expense' as const, color: '#F59E0B', icon: 'car', macro_category_id: mcFixedId, is_system: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const catHealth = { id: generateUUID(), household_id: hhId, name: 'Healthcare & Pharmacy', type: 'expense' as const, color: '#EC4899', icon: 'activity', macro_category_id: mcFixedId, is_system: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const catDining = { id: generateUUID(), household_id: hhId, name: 'Restaurants & Cafes', type: 'expense' as const, color: '#F97316', icon: 'utensils', macro_category_id: mcVarId, is_system: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const catVacation = { id: generateUUID(), household_id: hhId, name: 'Vacation & Flights', type: 'expense' as const, color: '#8B5CF6', icon: 'plane', macro_category_id: mcSeasonId, is_system: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const catShopping = { id: generateUUID(), household_id: hhId, name: 'Shopping & Electronics', type: 'expense' as const, color: '#06B6D4', icon: 'gift', macro_category_id: mcVarId, is_system: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const catSalary = { id: generateUUID(), household_id: hhId, name: 'Salary & Primary Income', type: 'income' as const, color: '#10B981', icon: 'briefcase', macro_category_id: mcSalaryId, is_system: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const catBenefits = { id: generateUUID(), household_id: hhId, name: 'Child Allowance & Grants', type: 'income' as const, color: '#3B82F6', icon: 'dollar-sign', macro_category_id: mcExtraId, is_system: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };

    const newCats: Category[] = [catSuper, catHousing, catTrans, catHealth, catDining, catVacation, catShopping, catSalary, catBenefits];

    // 3. Create Business Mappings
    const newBms: BusinessMapping[] = [
      { id: generateUUID(), household_id: hhId, pattern: 'SHUFERSAL', category_id: catSuper.id, priority: 10, is_regex: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: generateUUID(), household_id: hhId, pattern: 'PAZ', category_id: catTrans.id, priority: 10, is_regex: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: generateUUID(), household_id: hhId, pattern: 'SUPER-PHARM', category_id: catHealth.id, priority: 10, is_regex: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: generateUUID(), household_id: hhId, pattern: 'WOLT', category_id: catDining.id, priority: 10, is_regex: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: generateUUID(), household_id: hhId, pattern: 'AM:PM', category_id: catSuper.id, priority: 10, is_regex: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: generateUUID(), household_id: hhId, pattern: 'VICTORY', category_id: catSuper.id, priority: 10, is_regex: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: generateUUID(), household_id: hhId, pattern: 'TEN', category_id: catTrans.id, priority: 10, is_regex: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: generateUUID(), household_id: hhId, pattern: 'SONOL', category_id: catTrans.id, priority: 10, is_regex: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ];

    // 4. Create Card Mappings
    const newCards: CardMapping[] = [
      { id: generateUUID(), household_id: hhId, raw_pattern: 'כרטיס כאל ויזה 1234', display_name: 'ויזה כאל זהב (אישי)', card_last_digits: '1234', payment_type: 'credit_card', color: '#4F46E5', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: generateUUID(), household_id: hhId, raw_pattern: 'ישראכרט 9876', display_name: 'מאסטרקארד משותף', card_last_digits: '9876', payment_type: 'credit_card', color: '#10B981', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: generateUUID(), household_id: hhId, raw_pattern: 'עו"ש לאומי', display_name: 'עו״ש בנק לאומי', card_last_digits: null, payment_type: 'bank_transfer', color: '#06B6D4', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ];

    setMacroCategories((prev) => [...prev, ...newMacros]);
    setCategories((prev) => [...prev, ...newCats]);
    setBusinessMappings((prev) => [...prev, ...newBms]);
    setCardMappings((prev) => [...prev, ...newCards]);

    if (isSupabaseConfigured && !isDemoMode) {
      try {
        await supabase.from('macro_categories').insert(newMacros);
        await supabase.from('categories').insert(newCats);
        await supabase.from('business_mapping').insert(newBms);
        await supabase.from('payment_method_mappings').insert(newCards);
      } catch (err) {
        console.error('Error seeding to Supabase:', err);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        households,
        activeHousehold,
        householdMembers,
        isSuperUser,
        currentRole,
        canManageUsers,
        canEditRecords,
        canDeleteRecords,
        canImportFiles,
        canManageSystemTables,
        isReadOnly,
        allSystemHouseholds,
        macroCategories,
        categories,
        businessMappings,
        cardMappings,
        transactions,
        budgets,
        savings,
        isLoading,
        isDemoMode,
        isSupabaseReady: isSupabaseConfigured,
        language,
        setLanguage,
        dir,
        activeTab,
        setActiveTab,
        loginWithOAuth,
        loginDemo,
        logout,
        switchHousehold,
        toggleTransactionVisibility,
        addTransaction,
        addBatchTransactions,
        addHousehold,
        createHouseholdAsSuperUser,
        updateHousehold,
        fetchHouseholdMembers,
        addHouseholdMember,
        updateMemberRole,
        removeHouseholdMember,
        addMacroCategory,
        updateMacroCategory,
        deleteMacroCategory,
        batchAddMacroCategories,
        addCategory,
        updateCategory,
        deleteCategory,
        batchAddCategories,
        addBusinessMapping,
        updateBusinessMapping,
        deleteBusinessMapping,
        batchAddBusinessMappings,
        addCardMapping,
        updateCardMapping,
        deleteCardMapping,
        batchAddCardMappings,
        seedDefaultHouseholdData,
        showHiddenNotice,
        setShowHiddenNotice,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
