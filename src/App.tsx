import { useState } from 'react';

import Sidebar from './components/Sidebar';
import Layout from './components/Layout';

import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Animals from './pages/Animals';
import MedicalRecords from './pages/MedicalRecords';
import Appointments from './pages/Appointments';
import Calendar from './pages/Calendar';
import Vaccinations from './pages/Vaccinations';
import Team from './pages/Team';
import Microchips from './pages/Microchips';

import ClientsModal from './components/ClientsModal';
import AnimalsModal from './components/AnimalsModal';
import AppointmentsModal from './components/AppointmentsModal';

import { useAuth } from './context/AuthContext';
import { ClientsModalProvider } from './context/ClientsModalContext';
import { AnimalsModalProvider } from './context/AnimalsModalContext';
import { AppointmentsModalProvider } from './context/AppointmentsModalContext';
import { AuthScreen, CreateClinicScreen, FullScreenLoader, ResetPasswordScreen } from './pages/auth/AuthScreens';

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Visão Geral do Painel',
  clients: 'Gestão de Clientes',
  animals: 'Gestão de Animais',
  'medical-records': 'Prontuários Médicos',
  vaccinations: 'Gestão de Vacinas',
  microchips: 'Microchips',
  appointments: 'Agendamentos',
  calendar: 'Calendário',
  team: 'Clínica e Equipe',
};

function App() {
  const { session, loading, passwordRecovery, activeClinic, demoStep } = useAuth();

  if (demoStep) return <FullScreenLoader message={demoStep} />;
  if (loading) return <FullScreenLoader />;
  if (passwordRecovery) return <ResetPasswordScreen />;
  if (!session) return <AuthScreen />;
  if (!activeClinic) return <CreateClinicScreen />;

  // key: ao trocar de clínica, telas, modais e seus estados remontam e recarregam.
  return (
    <ClientsModalProvider key={activeClinic.id}>
      <AnimalsModalProvider>
        <AppointmentsModalProvider>
          <ClinicApp />
        </AppointmentsModalProvider>
      </AnimalsModalProvider>
    </ClientsModalProvider>
  );
}

function ClinicApp() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigate = (page: string) => {
    setCurrentPage(page);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0 });
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'clients':
        return <Clients />;
      case 'animals':
        return <Animals onNavigate={navigate} />;
      case 'medical-records':
        return <MedicalRecords />;
      case 'vaccinations':
        return <Vaccinations />;
      case 'microchips':
        return <Microchips />;
      case 'appointments':
        return <Appointments />;
      case 'calendar':
        return <Calendar />;
      case 'team':
        return <Team />;
      default:
        return <Dashboard onNavigate={navigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        currentPage={currentPage}
        onNavigate={navigate}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <Layout title={PAGE_TITLES[currentPage] ?? 'Painel'} collapsed={sidebarCollapsed} onOpenMenu={() => setMobileMenuOpen(true)}>
        {renderPage()}
      </Layout>

      <ClientsModal />
      <AnimalsModal />
      <AppointmentsModal />
    </div>
  );
}

export default App;
