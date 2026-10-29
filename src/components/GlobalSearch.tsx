import { useEffect, useRef, useState } from 'react';
import { Dog, Search, User } from 'lucide-react';
import { supabase, Animal, Client } from '../lib/supabase';
import { speciesLabel } from '../lib/format';
import Modal from './Modal';

type ClientHit = Pick<Client, 'id' | 'full_name' | 'phone_number' | 'cpf'> & { animals: Pick<Animal, 'id' | 'name' | 'species'>[] };
type AnimalHit = Pick<Animal, 'id' | 'name' | 'species' | 'breed'> & { clients: Pick<Client, 'full_name'> | null };

// Busca única (Ctrl+K): tutor por nome, CPF ou telefone; animal por nome ou
// microchip. Abre a ficha direto — menos cliques que navegar pelos menus.
export default function GlobalSearch({ onOpenRecord, onNavigate }: { onOpenRecord: (animalId: string) => void; onNavigate: (page: string) => void }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [clients, setClients] = useState<ClientHit[]>([]);
  const [animals, setAnimals] = useState<AnimalHit[]>([]);
  const timer = useRef<number>();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    window.clearTimeout(timer.current);
    const q = term.trim();
    if (q.length < 2) {
      setClients([]);
      setAnimals([]);
      return;
    }
    timer.current = window.setTimeout(async () => {
      const like = `%${q.replace(/[%_,()]/g, ' ')}%`;
      const digits = q.replace(/\D/g, '');
      const clientFilter = [`full_name.ilike.${like}`, digits.length >= 3 ? `cpf.ilike.%${digits}%` : null, digits.length >= 4 ? `phone_number.ilike.%${digits.slice(-4)}%` : null]
        .filter(Boolean)
        .join(',');
      const [c, a, m] = await Promise.all([
        supabase.from('clients').select('id, full_name, phone_number, cpf, animals(id, name, species)').or(clientFilter).limit(8),
        supabase.from('animals').select('id, name, species, breed, clients(full_name)').ilike('name', like).limit(8),
        digits.length >= 6 ? supabase.from('microchips').select('animal_id').ilike('code', `%${digits}%`).not('animal_id', 'is', null).limit(5) : Promise.resolve({ data: [] as { animal_id: string }[] }),
      ]);
      let animalHits = (a.data as unknown as AnimalHit[]) ?? [];
      const chipIds = (m.data ?? []).map((x) => x.animal_id).filter((id) => !animalHits.some((h) => h.id === id));
      if (chipIds.length) {
        const { data } = await supabase.from('animals').select('id, name, species, breed, clients(full_name)').in('id', chipIds);
        animalHits = [...((data as unknown as AnimalHit[]) ?? []), ...animalHits];
      }
      setClients((c.data as unknown as ClientHit[]) ?? []);
      setAnimals(animalHits);
    }, 250);
  }, [term]);

  const go = (animalId: string) => {
    setOpen(false);
    setTerm('');
    onOpenRecord(animalId);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full lg:w-72 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-500 hover:border-emerald-400"
      >
        <Search className="w-4 h-4" />
        <span className="flex-1 text-left">Buscar tutor, pet, CPF, chip...</span>
        <kbd className="hidden lg:inline text-[10px] font-semibold text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">Ctrl K</kbd>
      </button>
      {open && (
        <Modal title="Buscar" onClose={() => setOpen(false)} size="md">
          <div className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                autoFocus
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Nome do tutor ou pet, CPF, telefone ou microchip"
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            {term.trim().length >= 2 && clients.length === 0 && animals.length === 0 && <p className="text-sm text-slate-500 text-center py-4">Nada encontrado.</p>}
            {animals.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500 mb-1">Animais</p>
                <ul>
                  {animals.map((a) => (
                    <li key={a.id}>
                      <button onClick={() => go(a.id)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-emerald-50 text-left">
                        <Dog className="w-4 h-4 text-emerald-600" />
                        <span className="flex-1">
                          <span className="font-medium text-slate-800">{a.name}</span>
                          <span className="text-xs text-slate-500">
                            {' '}
                            • {speciesLabel[a.species]} {a.breed} • {a.clients?.full_name}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {clients.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500 mb-1">Tutores</p>
                <ul>
                  {clients.map((c) => (
                    <li key={c.id} className="px-3 py-2 rounded-lg hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <User className="w-4 h-4 text-slate-500" />
                        <span className="flex-1 text-sm">
                          <span className="font-medium text-slate-800">{c.full_name}</span>
                          <span className="text-xs text-slate-500"> • {c.phone_number}</span>
                        </span>
                        <button
                          onClick={() => {
                            setOpen(false);
                            onNavigate('clients');
                          }}
                          className="text-xs text-slate-500 hover:underline"
                        >
                          Clientes
                        </button>
                      </div>
                      {c.animals.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5 pl-7">
                          {c.animals.map((a) => (
                            <button key={a.id} onClick={() => go(a.id)} className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100">
                              {a.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
