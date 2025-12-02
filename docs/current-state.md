# ChessC - Estado Atual (Dez/2025)

## Visão Geral
- Projeto mono-repo leve (sem framework) com engine de xadrez em `src/chess.c`, exposto via WebAssembly.
- Front-end em HTML/JS estático (`chess/`, `scripts/chess-demo.js`) renderiza o tabuleiro, consome o módulo WASM e permite interação local.
- Fluxo de trabalho baseado em npm: `npm run dev` (serve), `npm run build:wasm` (compila C -> WASM via Emscripten), `npm test` (Node `--test`).

## Build / Tooling
- Script principal `scripts/build-wasm.mjs` (Node) resolve `emcc`, gera `dist/chess.js|.wasm` e copia para `chess/`.
- `build-wasm.ps1` agora apenas chama o script Node (mantém compatibilidade com `powershell -File build-wasm.ps1`).
- Dependências dev: `serve`, `chokidar-cli`. Não há framework JS ou bundler.
- Requisitos: Emscripten (`emsdk_env.ps1` precisa ser carregado antes das builds/tests).

## Engine C/WASM (`src/chess.c`)
- Mantém tabuleiro em `g_board` (array 64 chars) e buffer de movimentos.
- Suporta geração de movimentos para: peões, cavalos, bispos, torres e rei.
- Funções expostas: `_chess_reset`, `_chess_generate_moves`, `_chess_get_moves`, `_chess_random_ai`, `_chess_apply_move`, `_chess_get_board`.
- Move generator não contempla rainha, roque, promoção, en passant, verificação de xeque (escopo futuro).

## Front-end atual (`chess/`, `scripts/chess-demo.js`)
- HTML simples com tabuleiro 8x8 em divs, CSS custom básico.
- Script JS usa `cwrap` + `getValue`/`setValue` para ler tabuleiro/movimentos e renderizar peças.
- Interação local: clique para selecionar peça válida, mostra destinos, aplica movimento via WASM.
- Sem autenticação, multiplayer ou backend – tudo roda em single player/local state.

## Testes (`tests/chess-engine.test.mjs`)
- Usa `node:test` + `assert` para validar:
  - Reset inicial (FEN esperado).
  - Número de lances iniciais.
  - Aplicação de movimento.
  - Geração de movimentos do rei, torre, bispo em posições artificiais.
- Testes importam `dist/chess.js` (precisam de build prévia, automatizada via `pretest`).

## Scripts / Outras Pastas
- `build-wasm.ps1` -> delega para Node script.
- `README.md` descreve fluxo atual (WASM build, dev server, testes).
- `scripts/chess-demo.js` contém lógica de UI (render, handlers, chamada ao módulo).

## Pontos Importantes para a Migração
- Engine WASM já encapsula regras básicas -> pode ser reutilizada no backend (Node) e/no frontend.
- Pipeline atual **não** possui bundler/framework; migração para Next exigirá empacotar assets WASM (provavelmente `public/` + dynamic import).
- Não há gestão de estado global nem persistência; toda lógica de usuário/multiplayer precisará ser criada do zero.
- UX atual serve como protótipo visual para validar renderização e interações.

## Próximos Passos
1. Definir arquitetura da stack Next.js + Supabase/Postgres + WebSockets + IA.
2. Criar novo app (monorepo ou pasta `app/`) e portar gradualmente engine + UI.
3. Estabelecer testes/CI no novo contexto (unit + E2E) e plano de migração para features online.
