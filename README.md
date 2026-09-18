# Dill Resgate v0.2

Ferramenta de diagnóstico e manutenção para **Windows x64**, com painel local no navegador e rotinas automatizadas de verificação.

## Início rápido

1. Clique em **Code > Download ZIP** ou baixe o arquivo ZIP da branch `main`.
2. Extraia a pasta inteira.
3. Em um computador de testes, execute primeiro `02_SO_DIAGNOSTICO.cmd`.
4. Depois de revisar o diagnóstico, use `01_INICIAR_AUTONOMO.cmd` para executar as correções previstas.

O programa solicita privilégios de administrador quando necessário.

## O que a v0.2 faz

- verifica espaço livre e saúde reportada pelo armazenamento;
- analisa eventos críticos recentes do Windows;
- verifica a imagem do Windows com DISM;
- verifica arquivos protegidos com SFC;
- no modo de reparo, pode executar DISM RestoreHealth e SFC /scannow;
- atualiza aplicativos por winget;
- grava logs e relatório do atendimento em `%ProgramData%\DillResgate`;
- oferece painel local via navegador;
- possui ferramenta para preparar uma imagem WinPE e pendrive de resgate com Windows ADK.

## Atalhos

- `00_ABRIR_TUTORIAL.cmd` — abre o tutorial.
- `01_INICIAR_AUTONOMO.cmd` — diagnóstico + reparos previstos.
- `02_SO_DIAGNOSTICO.cmd` — diagnóstico sem as rotinas principais de reparo.
- `03_ATUALIZAR_APLICATIVOS.cmd` — atualização via winget.
- `04_VER_ULTIMO_RELATORIO.cmd` — abre o atendimento mais recente.
- `05_CRIAR_IMAGEM_RESGATE.cmd` — prepara WinPE (exige ADK + WinPE Add-on).
- `06_GRAVAR_PENDRIVE.cmd` — grava a mídia de resgate em USB.
- `07_VER_DEMONSTRACAO.cmd` — demonstração.

## Segurança

O Dill Resgate não promete corrigir falhas físicas de hardware, BIOS/UEFI, BitLocker ou qualquer cenário ambíguo. A rotina de pendrive exige confirmação explícita antes de apagar uma unidade. Use drivers oficiais e teste em uma máquina não crítica antes de implantação ampla.

## Demonstração online

O arquivo `index.html` é a demonstração pública. Os reparos reais são executados **somente no Windows local**, nunca pelo site.

Projeto: **Dill Resgate** — v0.2.0
