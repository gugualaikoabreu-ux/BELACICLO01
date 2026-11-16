# BelaCiclo — estado do checkout e preparação para lançamento

Atualizado em 15/11/2026. Esta nota descreve o código local. Nenhuma alteração de schema foi aplicada ao Supabase nesta etapa.

## Implementado nesta etapa

- O pagamento disponível no checkout é PIX manual. O servidor monta o BR Code com a chave e os dados bancários configurados localmente, vincula o valor e o identificador do pedido e mostra QR Code e copia e cola.
- A equipe pode registrar que recebeu um comprovante, marcar um pagamento como não identificado com justificativa, ou confirmar o crédito após conferência no banco. Só a confirmação administrativa aprova o pagamento e baixa o estoque reservado; a operação é transacional e repetida não baixa o estoque duas vezes.
- A confirmação registra usuário, e-mail, data e observação no histórico do pedido. O comprovante por si só nunca marca o pedido como pago.
- A página de pedido mantém o QR Code e os dados de pagamento disponíveis enquanto o status estiver aguardando conferência, e fornece contato pelo e-mail oficial da loja.
- A finalização exige uma cotação com preço válido. Não aceita “frete a combinar” como zero nem cria cobrança PIX sem o valor completo da entrega. Frete continua configurável por regra real ou cotação dos Correios; o navegador não é autoridade do preço.
- O checkout continua recalculando no servidor subtotal, cupom, frete e total, validando estoque e usando chave de idempotência para evitar pedidos duplicados.
- A busca automática de CEP via ViaCEP, a validação dos dados de endereço e o recálculo do frete no servidor permanecem integrados ao checkout.
- Foram removidos do código local os provedores e o webhook de pagamento automático. Nenhuma chamada de cobrança ou confirmação automática está habilitada.
- O e-mail de contato é configurável pela variável pública de contato da loja e usa como padrão o endereço oficial informado pela proprietária. Telefones, endereço físico e perfis sociais sem confirmação foram removidos dos pontos alterados nesta etapa.

## Migrations preparadas, ainda não aplicadas

1. `prisma/migrations/20261114090000_checkout_operations/migration.sql` acrescenta estruturas para resgates de cupom e configuração de frete.
2. `prisma/migrations/20261115090000_manual_pix_review/migration.sql` acrescenta os estados de conferência manual do PIX e os campos de atribuição do administrador ao histórico de eventos.
3. `prisma/migrations/20261115120000_regional_shipping/migration.sql` acrescenta as três tarifas regionais, ativação por modalidade, faixa de prazo, snapshots de prazo e tabela de histórico administrativo.

As três migrations são aditivas. A verificação somente leitura anterior conectou tanto pela URL de runtime quanto pela conexão direta e encontrou 4 migrations aplicadas de 6 locais, antes da criação da terceira migration. As três migrations acima continuam pendentes; as tabelas `coupon_redemptions` e `store_shipping_settings`, a coluna `coupons.minimumSubtotalCents` e os estados de revisão manual de PIX ainda não foram comprovados no banco. Há 23 tabelas públicas, todas com RLS habilitada na leitura anterior. Nenhuma escrita foi feita no Supabase.

O `.env.test` atual não está pronto para integração: sua URL de Supabase é a mesma do projeto da loja e as duas URLs PostgreSQL de teste estão vazias. Os comandos de deploy/teste de banco foram omitidos. Para validar migrations com segurança, primeiro a proprietária precisa criar um projeto Supabase descartável, diferente do projeto da loja, e preencher localmente `.env.test` com as conexões e chaves desse projeto. Depois, revisar o destino, aplicar migrations de teste e executar o teste de integração. Somente após essa validação deve ser planejada uma janela de migration para o banco da loja.

## Integrações externas ainda sem validação de ponta a ponta

- **Frete:** PAC/SEDEX dependem de contrato e credenciais dos Correios. Sem esses dados, o checkout só pode usar tarifa fixa ou regra de frete grátis que a loja tenha configurado com valores reais. Peso e dimensões precisam ser preenchidos no cadastro de cada produto.
- **Catálogo:** a leitura atual encontrou dois produtos reais ativos; ambos têm foto, dimensões de pacote preenchidas e variações disponíveis. Ainda não há preço de entrega: nenhuma credencial dos Correios (0/5) nem tarifa fixa (0/1) está configurada no ambiente. O checkout permanece bloqueado até configurar um preço real.
- **PIX manual:** não existe confirmação bancária automática. A equipe deve conferir o crédito no aplicativo/extrato bancário antes de usar “Confirmar pagamento” no painel. A chave PIX e o titular são lidos do ambiente local/de hospedagem; não devem ser copiados para o código ou para arquivos públicos.
- **E-mails:** faltam configurar/validar chave e remetente verificado do Resend e o segredo do agendador da fila. Não foram enviados e-mails reais.
- **Imagens:** upload de desenvolvimento pode usar armazenamento local; produção precisa de bucket S3 compatível e variáveis privadas de acesso. Nenhuma das cinco variáveis de mídia está configurada. Otimização/compressão e CDN ainda precisam ser definidas e testadas.
- **Identidade comercial:** razão social, CNPJ e endereço da loja ainda não estão configurados. O e-mail oficial já está informado.
- **Administração:** testes unitários cobrem a lógica de estados de pagamento; ainda falta testar CRUD de produtos, estoque, pedidos, cupons e configuração de frete com uma sessão administrativa real no ambiente isolado.
- **Dados comerciais:** informar endereço de devolução, políticas finais, tarifa e prazo de entrega, pesos/dimensões corretos e demais dados legais antes do lançamento. Nenhum dado ausente deve ser inventado.

## Validações locais desta etapa

- `pnpm db:generate` — Prisma Client gerado localmente, sem conexão ao banco.
- `pnpm test` — 59 testes passaram.
- `pnpm lint` — passou sem apontamentos.
- `pnpm exec tsc --noEmit` — passou depois de remover dois arquivos de tipos gerados obsoletos do cache `.next` que ainda referenciavam o webhook removido.
- `pnpm exec prisma validate` e `pnpm db:generate` — passaram localmente sem conectar ao banco.
- `pnpm exec next build --webpack` — compilação de produção passou, com geração das páginas e rotas da aplicação.
- Smoke test HTTP do build local — `/`, `/carrinho`, `/checkout`, `/entrega`, `/faq`, `/pagamento`, `/privacidade` e `/termos` responderam 200. A prévia foi reiniciada em `http://127.0.0.1:3001/`.
- Banco real — conexão read-only pelo pooler e pela URL direta passou. Foram confirmados 23/23 tabelas com RLS. Quatro migrations estão aplicadas e duas pendentes. A URL da API de teste coincide com a da loja e os endereços PostgreSQL de teste estão vazios; não foi feita escrita ou migration.
- Ambiente local — `.env.local` contém as variáveis de banco e PIX esperadas e `.gitignore` ignora `.env.*`; nenhum valor secreto foi impresso.
- Integrações — Correios: 0/5 credenciais; frete fixo: ausente; Resend: 0/3 configurações; armazenamento remoto: 0/5 variáveis; razão social/CNPJ/endereço: 0/3 dados. Esses pontos seguem pendentes e não foram preenchidos com valores fictícios.

Os testes são locais e usam mocks/fixtures. Não incluem cobrança real, e-mail real, upload remoto, cotação contratada dos Correios, migration em banco, nem CRUD administrativo autenticado. Não anunciar a loja como pronta para receber pedidos até completar essas validações em ambiente isolado e revisar a configuração de produção.
