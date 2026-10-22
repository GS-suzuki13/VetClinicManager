import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { AppointmentsModalProvider } from './context/AppointmentsModalContext';
import { ClientsModalProvider } from './context/ClientsModalContext';
import { AnimalsModalProvider } from './context/AnimalsModalContext';
import { AuthProvider } from './context/AuthContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ClientsModalProvider>
          <AnimalsModalProvider>
            <AppointmentsModalProvider>
              <App />
            </AppointmentsModalProvider>
          </AnimalsModalProvider>
        </ClientsModalProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
