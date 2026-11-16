# BelaCiclo — auditoria do frete

Atualizado em 15/11/2026. Escopo: código local e migrations preparadas. Nenhuma migration foi executada no Supabase da loja.

## Regras regionais implementadas

O servidor consulta o ViaCEP com o CEP informado e usa município e UF devolvidos pelo serviço. A tarifa é escolhida no backend; cidade/UF enviados pelo navegador precisam corresponder à resposta do CEP. O preço é selecionado novamente no checkout e comparado com a cotação exibida. Endereço, tarifa, modalidade e prazo ficam registrados no pedido; editar as regras não altera pedidos antigos.

| Destino | Tarifa inicial |
|---|---:|
| Curitiba e os 29 municípios da RMC | R$ 10,00 |
| Interior do Paraná | R$ 20,00 |
| Demais UFs | R$ 30,00 |

A lista da RMC segue a relação oficial da [Agência de Assuntos Metropolitanos do Paraná (AMEP)](https://www.amep.pr.gov.br/FAQ/Municipios-da-Regiao-Metropolitana-de-Curitiba). Nenhuma região foi inferida por distância.

## Auditoria das modalidades

“Disponível no código” não significa habilitada na loja: o frete regional e o histórico administrativo dependem da migration aditiva que foi criada, mas ainda não validada nem aplicada. A consulta somente leitura anterior encontrou as migrations de operações de checkout/frete pendentes no banco da loja. O ambiente `.env.test` aponta para o mesmo projeto Supabase e não tem URLs PostgreSQL de teste, portanto não é seguro usá-lo como banco de teste.

| Modalidade | Já existia / estado | Funciona agora | Serviço/contrato ou custo | Painel / trabalho pendente |
|---|---|---|---|---|
| Frete regional (por município e UF) | Implementado nesta etapa | Lógica coberta por testes locais; ainda não operacional no Supabase | ViaCEP público; sem contrato de frete | Três valores, ativação, prazo e histórico; validar migration em projeto Supabase isolado e só então planejar aplicação no projeto da loja |
| Frete fixo nacional | Regra e configuração já existiam | Só quando há valor real e a regra está habilitada | Sem API; custo é o valor pago pela loja ao transportador | Painel já existente, compatibilidade estendida; migração de settings pendente |
| Frete grátis acima do mínimo | Regra de limite já existia | Só quando habilitado e o subtotal atinge o limite; sempre exige seleção/registro no servidor | A loja absorve o custo real da entrega | Limiar e ativação no painel; migração de settings pendente |
| Correios PAC/SEDEX | Integração de preço e prazo já existe | Não validado: faltam credenciais/contrato, e o ambiente atual informa 0/5 | Contrato e cobrança dos Correios; chamadas requerem credenciais | Painel permite ativar após credenciais; faltam usuário/ID, código CWS, contrato, cartão de postagem, DR, homologação e pacote real |
| Por estado | Não havia tabela genérica de preço estadual | Parcialmente implementado: outros estados formam uma faixa regional de R$ 30 informada pela loja | ViaCEP público; sem contrato | Configuração regional no painel após migration |
| Por cidade | Não havia regra geral | Implementado apenas para classificar os 29 municípios da RMC versus interior do PR | ViaCEP público | Visualização da lista no painel; outras tarifas por município não foram solicitadas |
| Por faixa de CEP | Não havia suporte | Não implementado | Sem custo conhecido até escolher fornecedor | Exige regra e interface específicas; não foi inventada |
| Por peso | Não havia tarifa regional por peso; pesos dos produtos entram na cotação Correios | Correios usa a soma do peso cadastrado no servidor; tarifas regionais não dependem do peso | API/contrato Correios | Peso real continua configurável no cadastro do produto |
| Por dimensões | Não havia tarifa regional por dimensão; dimensões entram na cotação Correios | Correios combina dados reais das embalagens; tarifa regional não depende das dimensões | API/contrato Correios | Três dimensões continuam configuráveis por produto |
| Por distância | Não encontrado | Não | Exigiria serviço de geocodificação/rotas e definir fórmula/custo | Não solicitado e não implementado |
| Frete manual / a combinar | O modo manual existe para status pendente, sem preço numérico | O checkout não cria pedido/PIX sem preço real | Negociação e cobrança fora do sistema não precificadas | Não é opção de checkout ativa; nenhum preço foi presumido |
| Retirada local | Não encontrado | Não | Sem custo de API; requer endereço e operação de retirada a definir | Não implementado |
| Transportadoras além dos Correios | Não encontrado | Não | Contrato/API e custo dependem do fornecedor | Não implementado |
| Plataformas de logística | Não encontrado | Não | Conta/API e tarifas dependem do fornecedor | Não implementado |

O preço por peso/dimensão só existe como cotação contratada dos Correios; a faixa regional usa exclusivamente as três tarifas definidas pela proprietária. Prazo regional é opcional e administrável; vazio significa não exibir prazo. Prazo Correios vem da API.

## Persistência, acesso e histórico

- O servidor constrói as opções a partir do CEP ViaCEP, subtotal e configurações carregadas do banco. O navegador não consegue escolher uma taxa fora das opções do servidor nem enviar um preço diferente.
- O checkout valida novamente o CEP, município/UF, produtos ativos, estoque e tarifa antes de registrar o pedido.
- A configuração só pode ser lida/alterada pelas rotas administrativas autenticadas. O histórico registra autor, e-mail, valores anteriores e novos.
- A migration é aditiva: novos flags/tarifas/prazos, duas colunas opcionais de prazo nos pedidos, e tabela de histórico com RLS e acesso negado aos papéis `anon` e `authenticated`. Ela cria a configuração padrão apenas se não houver linha. Nenhum pedido antigo é regravado.
- O banco local de teste não está isolado. Não foram executadas migrations nem escritas no Supabase.

## Testes e pendências de validação

Testes locais cobrem os nove municípios exigidos, os 29 nomes da RMC, normalização de acentos, PR/fora de PR, limites/tarifas, preço adulterado, CEP inválido/inexistente/falha, edição e troca de CEP. Os testes usam funções e respostas simuladas, não chamadas reais do ViaCEP nem banco.

Não foi possível testar gravação real de pedido, persistência/edição de tarifa autenticada no painel, histórico no Supabase, RLS na prática ou alteração real de um carrinho numa sessão browser: isso exigiria aplicar migrations em ambiente isolado, mas `.env.test` aponta para a loja e não contém conexões PostgreSQL de teste. Não se afirma que o sistema regional esteja pronto para produção até essas validações serem executadas.
