# Telão fixo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** apresentar apuração fixa para TV com mapa entre candidatos.
**Architecture:** reutilizar DOM do mapa e renderização dos cartões. Grade em três colunas, com indicadores e diferença ligados ao resultado selecionado; fullscreen com estilos próprios.
**Tech Stack:** HTML, CSS, JavaScript sem framework, node:test e Playwright para inspeção.
**Spec:** docs/superpowers/specs/2026-10-28-telao-fixo-design.md

## Global Constraints
- Sem alternância automática, dados inventados ou mistura dos turnos.
- Preservar atualização a cada cinco segundos e painel Exterior.
- Sem rolagem em telas horizontais de TV.

## Review Focus
- Sem dados: diferença indisponível e nenhum voto falso.
- Empate: diferença zero, sem vencedor declarado.
- Atualização: manter localidade e tela cheia.
- Nomes e milhões de votos: nenhuma sobreposição.
- Mapa: legenda e abrangência explícitas, segundo turno no telão.

### Task 1: Indicadores e apresentação fixa
**Files:** bu2026/segundo-turno.js, bu2026/index.html, bu2026/telao-fixo.css, bu2026/central-apuracao.js; testes em bu2026/tests/auto-refresh.test.cjs.
**Interfaces:** consome o resultado selecionado existente; produz #turno2Gap, #turno2Progress e #turno2AreaPicker.
- [ ] Testar diferença, empate, ausência de dados, abstenção e persistência da localidade; observar falha.
- [ ] Implementar indicadores no render existente, grade com mapa central e fullscreen fixo.
- [ ] Verificar testes Node e dimensões 720p/1080p/4K e celular no navegador.
- [ ] Atualizar builds e cache, revisar diff e salvar em branch para revisão.

## Registro de execução
- Layout e indicadores implementados. Testes de diferenças, empate, dados ausentes, modo fixo e regressões executados.
- Revisão independente: corrigida precedência do CSS do mapa por folha específica carregada após central-apuracao.css; campos eleitorais ausentes preservados como null.
- Limitação: inspeção visual não executada; instalação do Chromium retornou HTML em vez de binário. Conferência de 720p/1080p/4K permanece pendente.
