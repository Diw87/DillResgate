# Aba Exterior no B.U. 2026

Pedido de Dill: separar os votos do exterior em uma aba.

A aba pública Exterior terá o total oficial ZZ do segundo turno (eleição 6258), os dois candidatos nas cores e ordem já usadas pelo app e consulta por país/território e localidade. O total do exterior vem exclusivamente do arquivo ZZ do TSE; o total nacional continua incluindo o exterior, conforme sua fonte.

Abordagem: uma seção independente, ligada à navegação e ao acesso visitante existentes. Um módulo pequeno consulta somente ZZ e as localidades do país selecionado, com quatro consultas simultâneas no máximo e atualização a cada cinco segundos. Reutiliza os cartões presidenciais; não cria outro sistema visual. Um filtro dentro da tela nacional não atende ao pedido de uma aba; outro site não é necessário.

Localidades e códigos vêm do EA12 oficial. O agrupamento geográfico é do aplicativo, identificado na interface. Um país soma suas localidades consultadas, com cobertura explícita se alguma estiver indisponível. Não usa votos do primeiro turno ou do Brasil como substitutos. Sem publicação, exibe aguardando. Falhas de rede preservam a última parcial; arquivos antigos não substituem dados mais novos.

Verificação: total ZZ independente de BR; agrupamento e percentuais por votos; rejeição de outra eleição/área/simulado; falhas, cobertura incompleta e troca de filtro durante consulta; atualização a cada cinco segundos sem navegação; visitante e histórico; testes existentes e sintaxe; publicação pelo fluxo atual do GitHub Pages.
