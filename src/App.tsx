import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Animals from './pages/Animals';
import MedicalRecords from './pages/MedicalRecords';
import Appointments from './pages/Appointments';
import Calendar from './pages/Calendar';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'clients':
        return <Clients />;
      case 'animals':
        return <Animals />;
      case 'medical-records':
        return <MedicalRecords />;
      case 'appointments':
        return <Appointments />;
      case 'calendar':
        return <Calendar />;
      default:
        return <Dashboard />;
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
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <Layout title={getPageTitle()}>{renderPage()}</Layout>
    </div>
  );
}

export default App;
