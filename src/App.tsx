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
import VaccinationModal from './components/VaccinationModal';
import Vaccinations from './pages/Vaccinations';

function App() {
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
