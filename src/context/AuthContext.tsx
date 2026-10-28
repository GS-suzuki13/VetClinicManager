import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, setActiveClinicScope, ClinicRole } from '../lib/supabase';
import { clearDemoFromUrl, createDemoSandbox, demoRequestedInUrl } from '../lib/demo';

export interface ClinicMembership {
  id: string;
  name: string;
  role: ClinicRole;
}

interface AuthContextData {
  session: Session | null;
  user: User | null;
  loading: boolean;
  passwordRecovery: boolean;
  clinics: ClinicMembership[];
  activeClinic: ClinicMembership | null;
  setActiveClinicId: (id: string) => void;
  refreshClinics: () => Promise<void>;
  finishPasswordRecovery: () => void;
  signOut: () => Promise<void>;
  // Demonstração: etapa em andamento (null = parada) e último erro.
  demoStep: string | null;
  demoError: string | null;
  startDemo: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData | null>(null);

const ACTIVE_CLINIC_KEY = 'vetclinic.activeClinicId';

function readStoredClinicId() {
  try {
    return localStorage.getItem(ACTIVE_CLINIC_KEY);
  } catch {
    return null;
  }
}

function storeClinicId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_CLINIC_KEY, id);
    else localStorage.removeItem(ACTIVE_CLINIC_KEY);
  } catch {
    // Armazenamento indisponível (aba anônima etc.): só perde a preferência.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  // Usuário cujas clínicas já foram carregadas; evita exibir "sem clínica" antes do fetch.
  const [clinicsLoadedFor, setClinicsLoadedFor] = useState<string | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [clinics, setClinics] = useState<ClinicMembership[]>([]);
  const [activeClinicId, setActiveClinicIdState] = useState<string | null>(readStoredClinicId);
  const [demoStep, setDemoStep] = useState<string | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);
  const demoAutoStarted = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const loadClinics = useCallback(async (userId: string | null) => {
    if (!userId) {
      setClinics([]);
      setClinicsLoadedFor(null);
      return;
    }

    const { data, error } = await supabase
      .from('clinic_members')
      .select('role, clinics(id, name)')
      .eq('user_id', userId);

    if (error) {
      console.error('Erro ao carregar clínicas:', error);
      setClinics([]);
      setClinicsLoadedFor(userId);
      return;
    }

    const list = (data ?? [])
      .map((row) => {
        const clinic = row.clinics as unknown as { id: string; name: string } | null;
        return clinic ? { id: clinic.id, name: clinic.name, role: row.role as ClinicRole } : null;
      })
      .filter((c): c is ClinicMembership => c !== null)
      .sort((a, b) => a.name.localeCompare(b.name));

    setClinics(list);
    setClinicsLoadedFor(userId);
  }, []);

  const refreshClinics = useCallback(() => loadClinics(userId), [loadClinics, userId]);

  useEffect(() => {
    refreshClinics();
  }, [refreshClinics]);

  const activeClinic = useMemo(() => {
    const clinic = clinics.find((c) => c.id === activeClinicId) ?? clinics[0] ?? null;
    // Síncrono de propósito: as telas filhas já consultam com o escopo certo no primeiro render.
    setActiveClinicScope(clinic?.id ?? null);
    return clinic;
  }, [clinics, activeClinicId]);

  const setActiveClinicId = useCallback((id: string) => {
    setActiveClinicIdState(id);
    storeClinicId(id);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setClinics([]);
    setActiveClinicIdState(null);
    storeClinicId(null);
  }, []);

  const startDemo = useCallback(async () => {
    setDemoError(null);
    try {
      // Sai de uma sessão anterior (ex.: outra demo) para começar do zero.
      await supabase.auth.signOut();
      const { clinicId, userId: demoUserId } = await createDemoSandbox(setDemoStep);
      setActiveClinicIdState(clinicId);
      storeClinicId(clinicId);
      await loadClinics(demoUserId);
    } catch (err) {
      console.error('Erro ao preparar a demonstração:', err);
      const message = err instanceof Error ? err.message.toLowerCase() : '';
      setDemoError(
        message.includes('rate limit') || message.includes('too many')
          ? 'Muitas demonstrações criadas agora há pouco. Aguarde alguns minutos e tente de novo.'
          : 'Não foi possível preparar a demonstração. Tente novamente.',
      );
    } finally {
      setDemoStep(null);
    }
  }, [loadClinics]);

  // Link com ?demo (vindo do portfólio): entra direto, sem tela de login.
  useEffect(() => {
    if (sessionLoading || demoAutoStarted.current || !demoRequestedInUrl()) return;
    demoAutoStarted.current = true;
    clearDemoFromUrl();
    if (!session) startDemo();
  }, [sessionLoading, session, startDemo]);

  const value: AuthContextData = {
    session,
    user: session?.user ?? null,
    loading: sessionLoading || (userId !== null && clinicsLoadedFor !== userId),
    passwordRecovery,
    clinics,
    activeClinic,
    setActiveClinicId,
    refreshClinics,
    finishPasswordRecovery: () => setPasswordRecovery(false),
    signOut,
    demoStep,
    demoError,
    startDemo,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}

// Clínica ativa. Só pode ser usado nas telas internas, que exigem clínica selecionada.
export function useClinic() {
  const { activeClinic } = useAuth();
  if (!activeClinic) throw new Error('Nenhuma clínica selecionada');
  return activeClinic;
}

export function canDeleteClinicalData(role: ClinicRole) {
  return role === 'owner' || role === 'admin' || role === 'veterinarian';
}

// Excluir um chip apaga o histórico; o normal é alterar o status.
export function canDeleteMicrochip(role: ClinicRole) {
  return role === 'owner' || role === 'admin';
}

export function canManageTeam(role: ClinicRole) {
  return role === 'owner' || role === 'admin';
}
