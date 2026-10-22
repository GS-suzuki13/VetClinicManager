import { FormEvent, ReactNode, useState } from 'react';
import { AlertCircle, Building2, CheckCircle2, Dog, Loader2, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const inputClass =
  'w-full px-3 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent';

const PASSWORD_HINT = 'Mínimo de 8 caracteres, com letra maiúscula, minúscula e número.';

// Mensagens do Supabase Auth traduzidas; o resto cai no genérico para não vazar detalhes.
function authErrorMessage(message: string) {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (m.includes('already registered')) return 'Este e-mail já está cadastrado.';
  if (m.includes('password')) return `Senha fraca. ${PASSWORD_HINT}`;
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Aguarde um pouco e tente novamente.';
  return 'Não foi possível concluir. Tente novamente.';
}

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50">
      <aside className="hidden lg:flex flex-col justify-between bg-slate-900 text-white p-12">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 p-2 rounded-lg">
            <Dog className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold">VetClinic</span>
        </div>
        <div>
          <h2 className="text-3xl font-bold leading-tight">
            Gestão completa da sua clínica veterinária.
          </h2>
          <p className="mt-4 text-slate-400 max-w-md">
            Tutores, animais, prontuários, vacinas e agenda em um só lugar, com os dados de cada
            clínica isolados e protegidos.
          </p>
        </div>
        <p className="text-xs text-slate-500">© 2026 Suzuki</p>
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div className="bg-emerald-500 p-2 rounded-lg text-white">
              <Dog className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold text-slate-800">VetClinic</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
          <p className="mt-1 mb-6 text-sm text-slate-500">{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Notice({ kind, children }: { kind: 'error' | 'success'; children: ReactNode }) {
  const styles = kind === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
  const Icon = kind === 'error' ? AlertCircle : CheckCircle2;
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`flex gap-2 items-start text-sm border rounded-lg p-3 ${styles}`}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-60 transition-colors font-medium"
    >
      {busy && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Entrar / criar conta / esqueci a senha
// ---------------------------------------------------------------------------

type Mode = 'signin' | 'signup' | 'forgot';

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(authErrorMessage(error.message));
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) setError(authErrorMessage(error.message));
        else if (!data.session) setInfo('Conta criada. Enviamos um link de confirmação para o seu e-mail.');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        // Mesma resposta exista ou não a conta, para não revelar e-mails cadastrados.
        if (error && error.message.toLowerCase().includes('rate')) setError(authErrorMessage(error.message));
        else setInfo('Se houver uma conta com este e-mail, você receberá um link para redefinir a senha.');
      }
    } finally {
      setBusy(false);
    }
  };

  const copy = {
    signin: { title: 'Entrar', subtitle: 'Acesse o painel da sua clínica.', button: 'Entrar' },
    signup: { title: 'Criar conta', subtitle: 'Comece a usar o VetClinic gratuitamente.', button: 'Criar conta' },
    forgot: { title: 'Recuperar senha', subtitle: 'Informe seu e-mail para receber o link.', button: 'Enviar link' },
  }[mode];

  return (
    <AuthShell title={copy.title} subtitle={copy.subtitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Notice kind="error">{error}</Notice>}
        {info && <Notice kind="success">{info}</Notice>}

        <Field label="E-mail">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="voce@clinica.com.br"
          />
        </Field>

        {mode !== 'forgot' && (
          <Field label="Senha">
            <input
              type="password"
              required
              minLength={8}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
            {mode === 'signup' && <span className="block mt-1 text-xs text-slate-500">{PASSWORD_HINT}</span>}
          </Field>
        )}

        {mode === 'signin' && (
          <button type="button" onClick={() => switchMode('forgot')} className="text-sm text-emerald-600 hover:underline">
            Esqueci minha senha
          </button>
        )}

        <SubmitButton busy={busy}>{copy.button}</SubmitButton>
      </form>

      <p className="mt-6 text-sm text-center text-slate-600">
        {mode === 'signin' ? (
          <>
            Não tem conta?{' '}
            <button onClick={() => switchMode('signup')} className="text-emerald-600 font-medium hover:underline">
              Criar conta
            </button>
          </>
        ) : (
          <>
            Já tem conta?{' '}
            <button onClick={() => switchMode('signin')} className="text-emerald-600 font-medium hover:underline">
              Entrar
            </button>
          </>
        )}
      </p>
    </AuthShell>
  );
}

// ---------------------------------------------------------------------------
// Nova senha (após clicar no link de recuperação)
// ---------------------------------------------------------------------------

export function ResetPasswordScreen() {
  const { finishPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(authErrorMessage(error.message));
    else finishPasswordRecovery();
  };

  return (
    <AuthShell title="Definir nova senha" subtitle={PASSWORD_HINT}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Notice kind="error">{error}</Notice>}
        <Field label="Nova senha">
          <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Confirmar senha">
          <input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
        </Field>
        <SubmitButton busy={busy}>Salvar senha</SubmitButton>
      </form>
    </AuthShell>
  );
}

// ---------------------------------------------------------------------------
// Primeira clínica (usuário autenticado sem nenhuma clínica)
// ---------------------------------------------------------------------------

export function CreateClinicScreen() {
  const { user, refreshClinics, setActiveClinicId, signOut } = useAuth();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc('create_clinic', { p_name: name });
    if (error) {
      setBusy(false);
      setError(error.code === '54000' ? 'Limite de clínicas atingido.' : 'Não foi possível criar a clínica.');
      return;
    }
    setActiveClinicId(data.id);
    await refreshClinics();
  };

  return (
    <AuthShell title="Cadastre sua clínica" subtitle={`Conectado como ${user?.email ?? ''}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Notice kind="error">{error}</Notice>}
        <Field label="Nome da clínica">
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} pl-9`} placeholder="Clínica Veterinária Exemplo" />
          </div>
        </Field>
        <SubmitButton busy={busy}>Criar clínica</SubmitButton>
      </form>

      <div className="mt-6 text-sm text-slate-500 space-y-3">
        <p>Foi convidado por uma clínica existente? Peça ao responsável para adicionar o seu e-mail à equipe e recarregue esta página.</p>
        <button onClick={signOut} className="flex items-center gap-2 text-slate-600 hover:text-slate-800">
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </div>
    </AuthShell>
  );
}

export function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500" />
    </div>
  );
}
