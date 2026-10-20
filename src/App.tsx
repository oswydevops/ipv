import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Toast } from './components/Toast';
import { SearchModal } from './components/SearchModal';
import { SaleModal } from './components/SaleModal';
import { DashboardView } from './views/DashboardView';
import { IPVView } from './views/IPVView';
import { StockAlertsView } from './views/StockAlertsView';
import { CashCloseView } from './views/CashCloseView';
import { ReportsView } from './views/ReportsView';
import { ProductsView } from './views/ProductsView';
import { BackupView } from './views/BackupView';
import { SalesHistoryView } from './views/SalesHistoryView';
import { ReturnsView } from './views/ReturnsView';

const MainContent: React.FC = () => {
  const { currentView } = useApp();

  return (
    <div className="bg-surface font-body text-on-surface antialiased min-h-screen">
      <Sidebar />
      <div className="pl-72">
        <Header />
        <main className="relative pt-20 bg-surface min-h-screen p-8">
          {currentView === 'dashboard' && <DashboardView />}
          {currentView === 'ipv-del-dia' && <IPVView />}
          {currentView === 'historial-ventas' && <SalesHistoryView />}
          {currentView === 'devoluciones' && <ReturnsView />}
          {currentView === 'alertas-de-stock' && <StockAlertsView />}
          {currentView === 'cierre-de-caja' && <CashCloseView />}
          {currentView === 'reportes' && <ReportsView />}
          {currentView === 'productos' && <ProductsView />}
          {currentView === 'respaldo-y-exportacion' && <BackupView />}
        </main>
      </div>
      <Toast />
      <SearchModal />
      <SaleModal />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
