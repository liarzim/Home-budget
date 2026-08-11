import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LandingHero } from './components/LandingHero';
import { Header } from './components/Header';
import { KPICards } from './components/KPICards';
import { TransactionsView } from './components/TransactionsView';
import { BudgetsView } from './components/BudgetsView';
import { SavingsView } from './components/SavingsView';
import { SchemaViewer } from './components/SchemaViewer';
import { ImportWizard } from './components/ImportWizard/ImportWizard';
import { MainDashboard } from './components/Dashboard/MainDashboard';
import { ManualEntryScreen } from './components/ManualEntry/ManualEntryScreen';
import { FloatingActionButton } from './components/ManualEntry/FloatingActionButton';
import { MobileBottomNav } from './components/MobileBottomNav';
import { HistoricalMigrationScreen } from './components/Admin/HistoricalMigrationScreen';
import { ConnectedAccountsScreen } from './components/Settings/ConnectedAccountsScreen';
import { SystemTablesScreen } from './components/Settings/SystemTablesScreen';

const MainScreen: React.FC = () => {
  const { user, isDemoMode, isLoading, activeTab } = useAuth();

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
      </div>
    );
  }

  // If not authenticated or in demo mode, show Landing Page with OAuth login
  if (!user && !isDemoMode) {
    return <LandingHero />;
  }

  return (
    <div style={styles.appContainer}>
      <Header />
      <main style={styles.mainContentContainer} className="animate-fade-in">
        {activeTab === 'dashboard' && <MainDashboard />}
        {activeTab === 'transactions' && <TransactionsView />}
        {activeTab === 'manual-entry' && <ManualEntryScreen />}
        {activeTab === 'import' && <ImportWizard />}
        {(activeTab === 'system-tables' || activeTab === 'mappings') && <SystemTablesScreen />}
        {activeTab === 'bank-accounts' && <ConnectedAccountsScreen />}
        {activeTab === 'migration' && <HistoricalMigrationScreen />}
        {activeTab === 'budgets' && <BudgetsView />}
        {activeTab === 'savings' && <SavingsView />}
        {activeTab === 'schema' && <SchemaViewer />}
      </main>
      {/* Desktop Floating Action Button */}
      <div className="desktop-only">
        <FloatingActionButton />
      </div>
      {/* Mobile Bottom Tab Navigation */}
      <MobileBottomNav />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainScreen />
    </AuthProvider>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  appContainer: {
    minHeight: '100vh',
    backgroundColor: 'var(--bg-app)',
    display: 'flex',
    flexDirection: 'column',
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--bg-app)',
  },
  spinner: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: '3px solid var(--border-main)',
    borderTopColor: 'var(--primary)',
    animation: 'spin 0.8s linear infinite',
  },
  mainContentContainer: {
    maxWidth: '1200px',
    width: '100%',
    margin: '0 auto',
    padding: '28px 24px 60px',
    flex: 1,
  },
};
