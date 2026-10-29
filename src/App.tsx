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
import AnimalRecord from './pages/AnimalRecord';
import Sales from './pages/Sales';
import Register from './pages/Register';
import Catalog from './pages/Catalog';
import Finance from './pages/Finance';
import Hospitalization from './pages/Hospitalization';
import Relationship from './pages/Relationship';
import PublicRoute from './pages/public/PublicPages';
import GlobalSearch from './components/GlobalSearch';
import MobileNav from './components/MobileNav';
import { isPublicLink } from './lib/messages';

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
  'animal-record': 'Ficha do Animal',
  'medical-records': 'Prontuários Médicos',
  vaccinations: 'Gestão de Vacinas',
  microchips: 'Microchips',
  appointments: 'Agendamentos',
  calendar: 'Calendário',
  team: 'Clínica e Equipe',
  sales: 'Vendas e Orçamentos',
  register: 'Caixa',
  catalog: 'Produtos e Estoque',
  finance: 'Financeiro',
  hospitalization: 'Internação',
  relationship: 'Relacionamento com o Tutor',
};

function App() {
  const { session, loading, passwordRecovery, activeClinic, demoStep } = useAuth();

  // Links do tutor (NPS, agendamento online, cartão do pet) não exigem login.
  if (isPublicLink()) return <PublicRoute />;
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
  // Animal aberto na ficha (página 'animal-record').
  const [recordAnimalId, setRecordAnimalId] = useState<string | null>(null);
  // Menu recolhido fica salvo neste navegador.
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(() => {
    try {
      return localStorage.getItem('vetclinic:sidebar-collapsed') === '1';
    } catch {
      return false;
    }
  });
  const setSidebarCollapsed = (value: boolean) => {
    setSidebarCollapsedState(value);
    try {
      localStorage.setItem('vetclinic:sidebar-collapsed', value ? '1' : '0');
    } catch {
      // Armazenamento indisponível (modo privado): só não lembra a preferência.
    }
  };
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigate = (page: string) => {
    setCurrentPage(page);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0 });
  };

  const openAnimalRecord = (animalId: string) => {
    setRecordAnimalId(animalId);
    navigate('animal-record');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'clients':
        return <Clients />;
      case 'animals':
        return <Animals onOpenRecord={openAnimalRecord} />;
      case 'animal-record':
        return recordAnimalId ? (
          <AnimalRecord key={recordAnimalId} animalId={recordAnimalId} onBack={() => navigate('animals')} />
        ) : (
          <Animals onOpenRecord={openAnimalRecord} />
        );
      case 'medical-records':
        return <MedicalRecords />;
      case 'vaccinations':
        return <Vaccinations onOpenRecord={openAnimalRecord} />;
      case 'microchips':
        return <Microchips />;
      case 'appointments':
        return <Appointments onOpenRecord={openAnimalRecord} />;
      case 'calendar':
        return <Calendar onOpenRecord={openAnimalRecord} />;
      case 'team':
        return <Team />;
      case 'sales':
        return <Sales />;
      case 'register':
        return <Register />;
      case 'catalog':
        return <Catalog />;
      case 'finance':
        return <Finance />;
      case 'hospitalization':
        return <Hospitalization onOpenRecord={openAnimalRecord} />;
      case 'relationship':
        return <Relationship onOpenRecord={openAnimalRecord} />;
      default:
        return <Dashboard onNavigate={navigate} onOpenRecord={openAnimalRecord} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        currentPage={currentPage === 'animal-record' ? 'animals' : currentPage}
        onNavigate={navigate}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <Layout
        title={PAGE_TITLES[currentPage] ?? 'Painel'}
        collapsed={sidebarCollapsed}
        onOpenMenu={() => setMobileMenuOpen(true)}
        menuOpen={mobileMenuOpen}
        search={<GlobalSearch onOpenRecord={openAnimalRecord} onNavigate={navigate} />}
      >
        {/* key: cada troca de tela entra com uma animação curta */}
        <div key={currentPage === 'animal-record' ? `record-${recordAnimalId}` : currentPage} className="animate-page-in">
          {renderPage()}
        </div>
      </Layout>

      <MobileNav currentPage={currentPage === 'animal-record' ? 'animals' : currentPage} onNavigate={navigate} onOpenMenu={() => setMobileMenuOpen(true)} />

      <ClientsModal />
      <AnimalsModal />
      <AppointmentsModal />
    </div>
  );
}

export default App;
