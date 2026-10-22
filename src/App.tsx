import { useState } from 'react';

import Sidebar from './components/Sidebar';
import Layout from './components/Layout';

import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Animals from './pages/Animals';
import MedicalRecords from './pages/MedicalRecords';
import Appointments from './pages/Appointments';
import Calendar from './pages/Calendar';

import AnimalsModalContainer from './containers/AnimalsModalContainer';
import ClientsModalContainer from './containers/ClientsModalContainer';
import AppointmentsModalContainer from './containers/AppointmentsModalContainer';
import Vaccinations from './pages/Vaccinations';
import Team from './pages/Team';

import { useAuth } from './context/AuthContext';
import { AuthScreen, CreateClinicScreen, FullScreenLoader, ResetPasswordScreen } from './pages/auth/AuthScreens';

function App() {
  const { session, loading, passwordRecovery, activeClinic } = useAuth();

  if (loading) return <FullScreenLoader />;
  if (passwordRecovery) return <ResetPasswordScreen />;
  if (!session) return <AuthScreen />;
  if (!activeClinic) return <CreateClinicScreen />;

  // key: ao trocar de clínica, todas as telas e modais remontam e recarregam os dados.
  return <ClinicApp key={activeClinic.id} />;
}

function ClinicApp() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPage} />;
      case 'clients':
        return <Clients />;
      case 'animals':
        return <Animals />;
      case 'medical-records':
        return <MedicalRecords />;
      case 'vaccinations':
        return <Vaccinations />
      case 'appointments':
        return <Appointments />;
      case 'calendar':
        return <Calendar />;
      case 'team':
        return <Team />;
      default:
        return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  const getPageTitle = () => {
    switch (currentPage) {
      case 'dashboard':
        return 'Visão Geral do Painel';
      case 'clients':
        return 'Gestão de Clientes';
      case 'animals':
        return 'Gestão de Animais';
      case 'medical-records':
        return 'Prontuários Médicos';
      case 'vaccinations':
        return 'Gestão de Vacinas';
      case 'appointments':
        return 'Agendamentos';
      case 'calendar':
        return 'Visualização em Calendário';
      case 'team':
        return 'Clínica e Equipe';
      default:
        return 'Painel';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />

      <Layout title={getPageTitle()} collapsed={sidebarCollapsed}>
        {renderPage()}
      </Layout>

      <AnimalsModalContainer />
      <ClientsModalContainer />
      <AppointmentsModalContainer />
    </div>
  );
}

export default App;
