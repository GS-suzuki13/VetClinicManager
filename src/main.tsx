import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { AppointmentsModalProvider } from './context/AppointmentsModalContext';
import { ClientsModalProvider } from './context/ClientsModalContext';
import { AnimalsModalProvider } from './context/AnimalsModalContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ClientsModalProvider>
          <AnimalsModalProvider>
            <AppointmentsModalProvider>
              <App />
            </AppointmentsModalProvider>
          </AnimalsModalProvider>
        </ClientsModalProvider>
    </BrowserRouter>
  </StrictMode>
);
