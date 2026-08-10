import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured, signInWithSocialOAuth, signOutUser, OAuthProvider } from '../lib/supabase';
import {
  Profile,
  Household,
  Category,
  BusinessMapping,
  CardMapping,
  Transaction,
  Budget,
  Savings,
} from '../lib/types';
import {
  mockProfile,
  mockHouseholds,
  mockCategories,
  mockBusinessMappings,
  mockCardMappings,
  mockTransactions,
  mockBudgets,
  mockSavings,
} from '../lib/mockData';

import { Language } from '../lib/i18n';

interface AuthContextType {
  user: Profile | null;
  households: Household[];
  activeHousehold: Household | null;
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
    | 'system-tables';
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
  ) => void;
  loginWithOAuth: (provider: OAuthProvider) => Promise<{ success: boolean; error?: string }>;
  loginDemo: (userName?: string) => void;
  logout: () => Promise<void>;
  switchHousehold: (householdId: string) => void;
  toggleTransactionVisibility: (id: string) => void;
  addTransaction: (tx: Partial<Transaction>) => void;
  addBatchTransactions: (txs: Transaction[]) => void;
  addHousehold: (name: string, currency?: string) => void;
  addCategory: (name: string, type: 'expense' | 'income', color?: string, icon?: string) => void;
  updateCategory: (id: string, name: string, color?: string, icon?: string) => void;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [activeHousehold, setActiveHousehold] = useState<Household | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [businessMappings, setBusinessMappings] = useState<BusinessMapping[]>([]);
  const [cardMappings, setCardMappings] = useState<CardMapping[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [savings, setSavings] = useState<Savings[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<AuthContextType['activeTab']>('dashboard');

  // Language State - Default to Hebrew (RTL)
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language');
    return (saved as Language) || 'he';
  });

  const dir: 'rtl' | 'ltr' = language === 'he' ? 'rtl' : 'ltr';

  const setLanguage = (newLang: Language) => {
    setLanguageState(newLang);
    localStorage.setItem('app_language', newLang);
    document.documentElement.dir = newLang === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
  };

  useEffect(() => {
    document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    checkInitialAuth();
  }, []);

  async function checkInitialAuth() {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await loadSupabaseUserData(session.user.id, session.user.email || '');
          setIsLoading(false);
          return;
        }

        // Listen to auth state changes
        supabase.auth.onAuthStateChange(async (_event, session) => {
          if (session?.user) {
            await loadSupabaseUserData(session.user.id, session.user.email || '');
          } else if (!isDemoMode) {
            setUser(null);
            setHouseholds([]);
            setActiveHousehold(null);
          }
        });
      }
    } catch (e) {
      console.error('Error checking auth:', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSupabaseUserData(userId: string, email: string) {
    try {
      // 1. Fetch Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      setUser(
        profile || {
          id: userId,
          email,
          full_name: email.split('@')[0],
          avatar_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      );

      // 2. Fetch User Households (via RLS)
      const { data: userHouseholds } = await supabase
        .from('households')
        .select('*, household_members(role, is_default)');

      if (userHouseholds && userHouseholds.length > 0) {
        const formattedHouseholds: Household[] = userHouseholds.map((h: any) => ({
          id: h.id,
          name: h.name,
          currency: h.currency,
          created_by: h.created_by,
          created_at: h.created_at,
          updated_at: h.updated_at,
          role: h.household_members?.[0]?.role || 'member',
        }));
        setHouseholds(formattedHouseholds);
        const defaultHh = formattedHouseholds[0];
        setActiveHousehold(defaultHh);
        await loadHouseholdDetails(defaultHh.id);
      }
    } catch (err) {
      console.error('Failed to load user data from Supabase:', err);
    }
  }

  async function loadHouseholdDetails(householdId: string) {
    try {
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
    setUser({ ...mockProfile, full_name: userName });
    setHouseholds(mockHouseholds);
    setActiveHousehold(mockHouseholds[0]);
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
    setActiveHousehold(null);
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

  const addTransaction = (newTxData: Partial<Transaction>) => {
    if (!activeHousehold) return;

    // Check auto-categorization mapping rules if category_id not provided
    let detectedCategoryId = newTxData.category_id || null;
    if (!detectedCategoryId && newTxData.payee_name) {
      const cleanPayee = newTxData.payee_name.toUpperCase();
      const matchedRule = businessMappings.find((rule) =>
        cleanPayee.includes(rule.pattern.toUpperCase())
      );
      if (matchedRule) {
        detectedCategoryId = matchedRule.category_id;
      }
    }

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      household_id: activeHousehold.id,
      date: newTxData.date || new Date().toISOString().split('T')[0],
      amount: newTxData.amount || 0,
      category_id: detectedCategoryId,
      transaction_type: newTxData.transaction_type || 'expense',
      payee_name: newTxData.payee_name || 'Merchant',
      original_description: newTxData.original_description || null,
      payment_method: newTxData.payment_method || 'credit_card',
      card_last_digits: newTxData.card_last_digits || null,
      is_hidden: false,
      notes: newTxData.notes || (detectedCategoryId ? 'Auto-categorized by rule' : null),
      created_by: user?.id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setTransactions((prev) => [newTx, ...prev]);

    if (isSupabaseConfigured && !isDemoMode) {
      supabase.from('transactions').insert(newTx).then();
    }
  };

  const addBatchTransactions = (newTxs: Transaction[]) => {
    setTransactions((prev) => [...newTxs, ...prev]);

    if (isSupabaseConfigured && !isDemoMode && activeHousehold) {
      supabase
        .from('transactions')
        .insert(
          newTxs.map((tx) => ({
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

  const addHousehold = (name: string, currency: string = 'ILS') => {
    const newHh: Household = {
      id: `hh-${Date.now()}`,
      name,
      currency,
      created_by: user?.id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      role: 'owner',
    };
    setHouseholds((prev) => [...prev, newHh]);
    setActiveHousehold(newHh);

    if (isSupabaseConfigured && !isDemoMode) {
      supabase
        .from('households')
        .insert({ name, currency })
        .select()
        .single()
        .then(({ data }) => {
          if (data) {
            loadSupabaseUserData(user!.id, user!.email);
          }
        });
    }
  };

  // Category Management
  const addCategory = (name: string, type: 'expense' | 'income', color?: string, icon?: string) => {
    if (!activeHousehold) return;
    const newCat: Category = {
      id: `cat-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      household_id: activeHousehold.id,
      name: name.trim(),
      type,
      color: color || (type === 'income' ? '#10B981' : '#4F46E5'),
      icon: icon || (type === 'income' ? 'briefcase' : 'tag'),
      is_system: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setCategories((prev) => [...prev, newCat]);

    if (isSupabaseConfigured && !isDemoMode) {
      supabase.from('categories').insert(newCat).then();
    }
  };

  const updateCategory = (id: string, name: string, color?: string, icon?: string) => {
    setCategories((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              name: name.trim(),
              ...(color ? { color } : {}),
              ...(icon ? { icon } : {}),
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
      id: `cat-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
      household_id: activeHousehold.id,
      name: (c.name || '').trim(),
      type: c.type || 'expense',
      color: c.color || (c.type === 'income' ? '#10B981' : '#4F46E5'),
      icon: c.icon || (c.type === 'income' ? 'briefcase' : 'tag'),
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
      id: `bm-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
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
      id: `bm-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
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
      id: `cm-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
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
      id: `cm-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
      household_id: activeHousehold.id,
      raw_pattern: (m.raw_pattern || '').trim(),
      display_name: (m.display_name || '').trim(),
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

  return (
    <AuthContext.Provider
      value={{
        user,
        households,
        activeHousehold,
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
