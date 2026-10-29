// Confirmações, perguntas e avisos no visual do sistema (em vez de
// confirm/prompt/alert do navegador). O DialogHost, montado uma vez no App,
// escuta estes pedidos e mostra o diálogo ou o aviso.

export interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  danger?: boolean;
}

export interface PromptOptions extends ConfirmOptions {
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
}

export type DialogRequest =
  | ({ kind: 'confirm'; message: string; resolve: (ok: boolean) => void } & ConfirmOptions)
  | ({ kind: 'prompt'; message: string; resolve: (value: string | null) => void } & PromptOptions);

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
}

type Listener<T> = (value: T) => void;
let dialogListener: Listener<DialogRequest> | null = null;
let toastListener: Listener<Toast> | null = null;
let toastSeq = 0;

export function registerDialogHost(onDialog: Listener<DialogRequest>, onToast: Listener<Toast>) {
  dialogListener = onDialog;
  toastListener = onToast;
  return () => {
    dialogListener = null;
    toastListener = null;
  };
}

export function askConfirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!dialogListener) resolve(window.confirm(message));
    else dialogListener({ kind: 'confirm', message, resolve, ...options });
  });
}

export function askPrompt(message: string, options: PromptOptions = {}): Promise<string | null> {
  return new Promise((resolve) => {
    if (!dialogListener) resolve(window.prompt(message));
    else dialogListener({ kind: 'prompt', message, resolve, ...options });
  });
}

// Aviso que some sozinho (erros de ação, confirmações de sucesso).
export function notify(message: string, tone: Toast['tone'] = 'error') {
  if (!toastListener) {
    if (tone === 'error') window.alert(message);
    return;
  }
  toastListener({ id: ++toastSeq, message, tone });
}
