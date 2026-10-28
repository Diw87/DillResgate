# Telão fixo — desenho aprovado por Dill

Objetivo: leitura à distância em TV, com candidato à esquerda, mapa no centro e candidato à direita. Tela fixa, sem alternância automática; localidade escolhida manualmente. Preto e laranja DW Tech; cores dos candidatos identificam resultados.

Topo: localidade, situação e progresso. Laterais: retrato, nome, partido, percentual e votos. Centro: mapa existente, cores e legenda. Abaixo: diferença de votos e pontos percentuais. Rodapé: seções totalizadas/total, brancos, nulos, comparecimento, abstenção e horário da fonte. Ausência de dados é indicada, nunca tratada como zero.

Abordagens: tela fixa (escolhida, leitura contínua) ou alternância automática (descartada pelo usuário). Implementação proposta: reaproveitar o mapa SVG, os renderizadores e o intervalo existente de cinco segundos; CSS específico para telão, sem alterar o painel Exterior. A consulta detalhada e os relatórios permanecem fora da apresentação fullscreen.

Limites: não criar resultados, não misturar turnos. Mapa e cartões devem identificar suas abrangências. Ao entrar no telão, mapa fica no segundo turno e Brasil; consultas manuais fora dele continuam disponíveis. Ajustar geometria para 1280×720, 1920×1080 e 3840×2160. Celular mantém apresentação empilhada.
