# VetClinicManager

Sistema de gestão para clínicas veterinárias, do atendimento ao financeiro.

**Demo:** https://vet-clinic-manager.vercel.app

## Módulos

- **Clientes e animais:** cadastro de tutores, ficha do animal e microchips
- **Agenda:** consultas e calendário da equipe
- **Prontuários:** histórico clínico, vacinações e internação
- **Vendas e catálogo:** produtos, serviços e vendas
- **Financeiro:** entradas, saídas e visão geral no dashboard
- **Equipe e relacionamento:** usuários da clínica e contato com clientes

## Stack

React · TypeScript · Vite · Tailwind CSS · Supabase (Postgres, Auth, Storage)

## Rodando localmente

```bash
npm install
npm run dev
```

Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` num arquivo `.env`.
