# Smoke de rollback do Editor IA Irrestrito

Este arquivo existe apenas para validar o fluxo real de rollback por PR sem tocar em codigo funcional ou em superficies visuais.

Regras de uso:

- o planner pode apontar este arquivo quando o pedido falar de rollback, smoke ou validacao inofensiva;
- o fluxo esperado e criar branch, diff, commit, PR e depois abrir o PR de rollback;
- a mudanca deve permanecer local e sem impacto de produto.

Nao usar este arquivo para alteracoes de produto ou de interface.

Validacao do rollback por PR concluida com sucesso.

## Comportamento de quota

Quando os providers configurados devolvem quota indisponivel, o editor deve expor o estado `blocked_provider_quota`, manter o diff e a auditoria, e orientar o admin a restaurar credito ou trocar para fallback deterministico. Nao deve pedir captura visual quando o alvo ja esta resolvido por baseline gerida.
