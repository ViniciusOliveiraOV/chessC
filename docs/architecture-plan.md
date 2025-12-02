# Plano de Arquitetura - ChessC Next Stack

## Objetivo Geral
Evoluir o protótipo local (HTML + WASM) para uma plataforma multiplayer com autenticação, lobby, partidas online sincronizadas e chat com respostas de IA, mantendo o engine em C/WASM como núcleo de regras.

## Stack Proposta
| Camada | Tecnologia | Observações |
| ------ | ---------- | ----------- |
| Frontend | Next.js 15 (App Router) + React + TypeScript | SSR/ISR para landing; client components para o tabuleiro. |
| UI/Estado | Tailwind ou Radix + Zustand/React Query | Gerenciar seleção de sala, sincronizar dados em tempo real. |
| Backend/API | Next.js Route Handlers (Edge-friendly) + Supabase Functions se preciso | Serviços REST/GraphQL simples para auth, lobby e histórico. |
| Banco/Persistência | Supabase (Postgres + Auth + Realtime) | Tabelas para usuários, salas, partidas, mensagens; Realtime para señales e chat. |
| Realtime | Supabase Realtime (PG listen/notify) ou Pusher Channels | Movimentos de peças e chat sincronizados. |
| Engine | Módulo WASM existente; wrapper Node + bindings TS | Reutilizar em duas frentes: validação no servidor e cálculo local para preview. |
| Chat IA | API gratuita (HuggingFace Inference, Perplexity Labs, Azure free tier) | Priorizar provedor sem custo; fallback local (llama.cpp) se necessário. |
| Deploy | Vercel (frontend + APIs) + Supabase Cloud | CDN + auto deploy; pipelines GitHub/Vercel. |
| Observabilidade | Vercel Analytics, Sentry (JS SDK), Supabase logs | Traçar métricas de uso e erros. |

## Domínios Funcionais
1. **Auth & Perfil**
   - Supabase Auth (email link ou OAuth) para login rápido.
   - Perfil com nickname, rating inicial, preferências (tema, idioma).
2. **Lobby & Matchmaking**
   - CRUD de salas (tabela `matches` com status `waiting/playing/finished`).
   - Lobby mostra salas públicas + opção de criar sala privada (com código).
   - Seeding futuro: matchmaking automático com rating Glicko simplificado.
3. **Motor de Partidas**
   - Engine WASM roda no cliente para pré-visualização.
   - No servidor: importar `dist/chess.wasm` via `@emnapi/runtime` ou `wasm3` + Node API para validar movimentos e garantir integridade.
   - Estrutura de eventos: `match.move`, `match.result`, `match.chat`.
4. **Sincronização em Tempo Real**
   - Cada sala subscribe a `match_moves` (Supabase Realtime) ou canal WS dedicado.
   - Payload mínimo: `matchId`, `move`, `boardHash`, `timestamp`.
   - Regras de turno aplicadas no backend; clientes apenas pedem ação.
5. **Chat + IA**
   - Chat baseado em Realtime com roles (player1, player2, ai, system).
   - Serviço IA recebe contexto: últimos N movimentos + mensagens. Responde como coach/comentator.
   - Moderador automático (classificador zero-shot) bloqueia termos proibidos.
6. **Histórico & Replay**
   - Armazenar PGN simplificado em `match_history`.
   - Endpoint para recuperar partidas e reproduzir no frontend.
7. **Dev Experience**
   - Monorepo (turbo opcional) com pacotes: `packages/engine` (WASM build), `apps/web` (Next), `packages/ui` (design system futuro).
   - Scripts padronizados: `npm run dev`, `npm run build`, `npm run test`, `npm run lint`, `npm run wasm:build`.

## Esquema de Dados (Supabase)
```
users
- id (uuid, supabase auth)
- username (text unique)
- rating (int)
- avatar_url (text)
- created_at

matches
- id (uuid)
- owner_id (uuid ref users)
- guest_id (uuid ref users, null)
- status (enum: waiting|playing|finished)
- visibility (enum: public|private)
- fen (text) -- estado atual
- move_history (jsonb)
- created_at, updated_at

match_moves
- id (uuid)
- match_id (uuid ref matches)
- move (jsonb: from, to, notation)
- board_snapshot (text)
- author_id (uuid ref users)
- created_at

chat_messages
- id (uuid)
- match_id (uuid)
- sender_id (uuid or 'ai')
- role (enum: player|ai|system)
- text (text)
- created_at
```

## Fluxo de Solicitação de Movimento
1. Cliente envia `POST /api/match/{id}/move` com `from`, `to`.
2. API recupera estado da partida, roda validação via WASM server-side.
3. Se válido: atualiza FEN, grava em `match_moves`, emite evento Realtime.
4. Clientes inscritos recebem evento e atualizam board local.
5. IA opcionalmente recebe webhook para comentar lance.

## Roadmap Técnico (Alta Nível)
1. **Infra Base (Dez)**
   - Monorepo + app Next.
   - Configurar Supabase, auth simples, tabelas básicas.
   - Portar build WASM para pasta `packages/engine`.
2. **Lobby + Partidas Locais (Jan)**
   - UI Next replicando protótipo.
   - Persistir salas + estados; movimentos locais ainda sem sync.
3. **Realtime + Chat (Jan/Fev)**
   - WS/Realtime integrado, moves validados no server, chat textual.
4. **IA + Moderação (Fev)**
   - Integrar provedor IA gratuito, moderar mensagens.
5. **Polimento + Deploy (Mar)**
   - Observabilidade, testes E2E, deploy Vercel + Supabase, convite testers.

## Riscos & Mitigações
- **Carregar WASM no backend Next (Edge)**: se `app router` em Edge não suportar nativamente, usar Route Handler em Node runtime (`runtime = "nodejs"`).
- **Custos IA**: iniciar com modelo gratuito (HuggingFace text-generation-inference) ou rodar instância local/Render com quantized model.
- **Latência Realtime**: se Supabase não atender, pivotar para Ably/Pusher ou WebRTC data channels.
- **Sincronização de estado**: usar versionamento (incremental move number) e replays para resolver divergências.

## Próximos Passos
1. Criar estrutura do monorepo (`apps/web`, `packages/engine`).
2. Configurar Next.js + TypeScript + ESLint + Vitest + Playwright inicial.
3. Criar script `npm run wasm:build` integrado ao novo fluxo.
4. Conectar Supabase (chaves via `.env.local`, não versionadas).
5. Migrar UI existente para componente React, mantendo layout do protótipo.
