import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';

// Ditado por voz no navegador (Web Speech API, pt-BR): o veterinário fala e o
// texto entra no campo, sem custo e sem enviar áudio para servidores da clínica.
// Chrome/Edge usam o serviço de reconhecimento do próprio navegador.

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

type Ctor = new () => SpeechRecognitionLike;

function recognitionCtor(): Ctor | null {
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function DictationButton({ onText }: { onText: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const callback = useRef(onText);
  callback.current = onText;

  useEffect(() => () => recognition.current?.stop(), []);

  const Ctor = recognitionCtor();
  if (!Ctor) return null;

  const toggle = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const r = new Ctor();
    r.lang = 'pt-BR';
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) callback.current(event.results[i][0].transcript.trim());
      }
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recognition.current = r;
    r.start();
    setListening(true);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? 'Parar ditado' : 'Ditar por voz'}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${listening ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
    >
      {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
      {listening ? 'Ouvindo... parar' : 'Ditar'}
    </button>
  );
}
