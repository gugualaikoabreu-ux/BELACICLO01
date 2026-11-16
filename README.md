# BelaCiclo

Loja virtual responsiva de moda feminina e infantil, com identidade azul-marinho e dourada, catálogo editorial, conta de cliente, painel administrativo, reservas de estoque e checkout PIX manual. Os dados do PIX manual foram fornecidos pela BelaCiclo; nenhuma venda é simulada.

## Tecnologia

- Next.js App Router, React e TypeScript.
- Supabase Auth com sessões por cookies e PostgreSQL acessado pelo servidor via Prisma 7.
- Migração inicial do banco, políticas de Row Level Security (RLS) e sincronização de contas do Supabase Auth para `customers`.
- PIX manual no padrão BR Code, com conferência do recebimento no painel. Pagamentos automáticos e webhook não estão habilitados.
- Frete por valor fixo autorizado ou cotação das APIs oficiais de preço e prazo dos Correios.
- Estilos próprios e animações editoriais respeitando `prefers-reduced-motion`.

## Preparar o ambiente

Requisitos: Node.js 24 LTS, pnpm e um projeto Supabase. Não há credenciais de produção neste repositório; o checkout permanece fechado até receber configurações válidas.

1. Crie o projeto Supabase de produção. Em **Authentication → Providers → Email**, habilite cadastro por e-mail e confirmação do endereço. Em **Authentication → URL Configuration**, defina a URL do site e permita `http://localhost:3000/auth/callback` para desenvolvimento e `http://localhost:3003/auth/callback` para esta prévia; inclua o domínio HTTPS de produção depois de publicar. Consulte a [configuração oficial do Supabase Auth](https://supabase.com/docs/guides/auth/general-configuration).
2. No painel Supabase, use **Connect** para copiar o Project URL e a publishable key; a chave secreta fica em **Settings → API Keys**. Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. A chave `SUPABASE_SECRET_KEY` é opcional, exclusivamente de backend; o cliente administrativo fica em `lib/supabase/admin.ts`. O código aceita a antiga `SUPABASE_SERVICE_ROLE_KEY` por compatibilidade, mas prefira a chave secreta atual. Nunca use qualquer chave secreta com prefixo `NEXT_PUBLIC_`. Veja [como localizar e proteger as chaves](https://supabase.com/docs/guides/getting-started/api-keys).
3. No **Connect → Database**, copie uma URL de conexão para `DATABASE_URL`. Use conexão direta se o ambiente puder acessá-la; em redes IPv4 sem acesso direto, use **Session pooler** (porta 5432). Para as migrações, prefira conexão direta em `DIRECT_DATABASE_URL`. A URL de conexão usa a senha do banco, não a publishable key; codifique caracteres especiais da senha na URL. Consulte os [modos oficiais de conexão do PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres).
4. Copie `.env.example` para `.env`; não preencha valores inventados. Instale dependências e gere o cliente do banco:

   ```bash
   pnpm install
   pnpm db:generate
   ```

5. Crie e valide primeiro um projeto Supabase isolado de teste, conforme a seção **Ambiente de testes separado**. Não aplique migrations ao banco da loja até validar todas as migrations pendentes nesse projeto isolado, conferir o plano e preparar backup. Nunca use os dados da loja para testes que criam ou apagam registros.

6. Inicie a loja:

   ```bash
   pnpm dev
   ```

   Abra `http://localhost:3000`.

As migrations criam tabelas, chaves estrangeiras, índices, validações de estoque e pagamentos, políticas RLS para o Data API do Supabase e gatilhos para manter `customers` sincronizado com `auth.users`. A API pública do Supabase bloqueia as colunas de estoque; as páginas da loja recebem somente um indicador de disponibilidade, nunca a quantidade exata. O acesso administrativo acontece pelas rotas do servidor, com checagem de sessão e autorização.

### Ambiente de testes separado

Crie um segundo projeto Supabase exclusivo para testes; não use a URL de produção. Copie `.env.test.example` para `.env.test` e preencha a conexão e as chaves do projeto de teste. O arquivo `.env.test` é ignorado pelo Git.

```bash
pnpm db:deploy:test
pnpm test:db
```

O primeiro comando força o modo de teste, exige `BELACICLO_TEST_DB_CONFIRM`, valida que a URL de API, a conexão de teste e a conexão direta pertençam ao mesmo projeto Supabase e bloqueia um projeto também configurado como produção. O segundo verifica tabelas, restrições, grants e RLS, cria dois usuários temporários no Supabase Auth e registros de prova no banco, confere o isolamento entre clientes, o bloqueio de gravações indevidas, eventos repetidos e disputa simultânea pela última unidade; ao terminar, apaga os registros e usuários de teste. Execute também `pnpm test` para os testes de unidade. Não use transações ou credenciais bancárias reais nos testes.

## Conta e administração

A pessoa que criar uma conta com o e-mail confirmado definido em `STORE_ADMIN_EMAIL` (por padrão `gustavo.alaiko@icloud.com`) recebe o papel `OWNER` no primeiro acesso administrativo. Troque o valor se essa não for a conta autorizada. A loja não configura login com Google. O painel permite administrar produtos, fotos, categorias, variações, estoque, pedidos, entregas, pagamentos e histórico de eventos.

Calça de Alfaiataria (R$ 168,00, P/M/G/XG, com friso) e Blazer (R$ 188,00, P/M/G/XG) ficam cadastrados como preparação, inativos, sem fotos e com estoque zero. O site os apresenta como ilustrações provisórias claramente identificadas; nenhuma compra é habilitada até que fotos e estoque reais sejam adicionados e confirmados. As fotos enviadas exigem armazenamento S3 compatível configurado em `MEDIA_BUCKET_URL`, `MEDIA_PUBLIC_BASE_URL`, `MEDIA_ACCESS_KEY`, `MEDIA_SECRET_KEY` e `MEDIA_REGION`. Também é possível cadastrar URLs HTTPS.

## Estoque e pedidos

- O checkout exige conta com e-mail confirmado e recalcula preços no servidor.
- A quantidade fica reservada durante o prazo definido em `PAYMENT_RESERVATION_MINUTES` (20 minutos por padrão) e a operação de estoque é atômica.
- Um pedido só baixa o estoque depois que a equipe confere a entrada no banco e confirma manualmente o pagamento no painel.
- Um endpoint interno libera reservas vencidas; configure um agendador para chamá-lo com `Authorization: Bearer $RESERVATION_CRON_SECRET`.
- Cancelar pedido ainda não pago libera a reserva. Não há fluxo automatizado de estorno.

## PIX e entrega

O checkout permanece fechado até que `PIX_MODE=manual`, `PIX_STATIC_KEY`, `PIX_MERCHANT_NAME` e `PIX_MERCHANT_CITY` estejam configurados com os dados autorizados da conta. O sistema monta um BR Code por pedido com o valor e o identificador da compra. Antes de ativar, confira o QR Code e o nome do recebedor no aplicativo do banco. Também é necessária uma tarifa real definida no painel/ambiente ou uma cotação dos Correios habilitada; sem preço de entrega, o checkout bloqueia a finalização.

O pagamento é manual. O cliente pode enviar o comprovante para o e-mail oficial da loja, mas isso não confirma o crédito. Uma pessoa administradora deve verificar o extrato e confirmar o pedido no painel; o sistema só então aprova o pagamento e baixa o estoque reservado. Não há provedor automático nem webhook PIX ativo. BR Codes podem continuar aceitando transferências após a reserva expirar; pedidos expirados não são reativados automaticamente. A equipe deve conferir qualquer transferência tardia e resolver o pedido com atendimento antes de reenviar ou estornar valores.

O padrão de campos de QR Code estático segue o [Manual de Padrões para Iniciação do Pix do Banco Central](https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf). O manual exige a chave Pix no código estático e permite omitir o valor; quando omitido, o pagador precisa informá-lo no aplicativo do banco.

O endpoint de cotação consulta as APIs oficiais de preço e prazo quando as credenciais estiverem configuradas. Em `CORREIOS_MODE`, escolha `homologation` ou `production`; preencha `CORREIOS_ID_CORREIOS`, `CORREIOS_API_ACCESS_CODE`, `CORREIOS_POSTING_CARD`, contrato/DR quando aplicáveis, CEP de origem e `CORREIOS_SERVICE_CODES` no formato `código:nome`. O servidor obtém e reaproveita o token até próximo do prazo de validade informado pelos Correios. Mantenha os segredos somente no servidor.

O contrato precisa ter API Preços (38202) e API Prazos (38210) habilitadas, além dos serviços informados. No painel, registre peso e dimensões reais da embalagem de cada produto. Para cotações combinadas, o código soma os comprimentos das unidades, usa a maior largura e a maior altura; valide essa regra com a embalagem final da BelaCiclo antes de abrir vendas. Sem medidas, modalidade autorizada ou credenciais válidas, a cotação retorna indisponível e não inventa preço ou prazo. O valor escolhido é consultado novamente no servidor antes de criar o pedido.

## Campanha e vídeos

Os quatro MP4 fornecidos para o projeto ficam em `public/campaigns/`:

- `editorial-walk-blue.mp4`: banner principal, com modelo caminhando em um macacão azul.
- `editorial-blazer-detail.mp4`: destaque editorial com detalhes do blazer.
- `hero-sunlight.mp4`: vídeo de campanha no lookbook.
- `collection-blazers.mp4`: clipe fornecido para a seleção Alfaiataria.

Os clipes fornecidos foram mantidos como vídeo real, sem geração artificial. O banner carrega primeiro; outros vídeos só entram em reprodução quando estão visíveis. Todos ficam sem som, em loop e inline, com fallback estático e respeito à preferência por movimento reduzido. Fotos de produto e miniaturas permanecem estáticas.

## Banner principal

O banner inicial usa `editorial-walk-blue.mp4`, com a modelo caminhando em um macacão azul. O vídeo inicia sem som, em loop e inline, com uma imagem estática de fallback e respeito à preferência por movimento reduzido.

## Dados comerciais e publicação

Razão social, CNPJ, endereço, tarifa fixa e credenciais dos Correios permanecem pendentes até serem fornecidos pela loja. O contato usa o e-mail oficial configurado. Na cópia personalizada do projeto, os dados do PIX manual ficam em `.env.local` e não são adicionados ao código-fonte; para hospedar, cadastre `PIX_MODE`, `PIX_STATIC_KEY`, `PIX_MERCHANT_NAME` e `PIX_MERCHANT_CITY` no cofre de variáveis da produção. Revise políticas de privacidade, termos, pagamento, entrega e troca; configure remetente e fila de e-mail; verifique backups; e defina `NEXT_PUBLIC_SITE_URL` e o domínio HTTPS antes da publicação. Mantenha `STORE_INDEXING_ENABLED=false` até catálogo e dados comerciais estarem prontos.

### Sequência de publicação

Use uma hospedagem que execute Next.js em Node.js 24 LTS e permita configurar variáveis de ambiente e tarefas agendadas HTTP. Este projeto não é uma exportação estática. O provedor fica a critério da BelaCiclo; confira a documentação dele para comandos de build e inicialização.

1. Mantenha projetos Supabase separados para teste e produção. No projeto de produção, configure autenticação por e-mail e a URL HTTPS do site em **Authentication → URL Configuration**. Inclua `https://SEU-DOMINIO/auth/callback` entre as URLs de redirecionamento permitidas.
2. Cadastre no ambiente de produção da hospedagem `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`, `DIRECT_DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `STORE_ADMIN_EMAIL` e `STORE_INDEXING_ENABLED=false`. Use a senha do banco nas URLs PostgreSQL; `DIRECT_DATABASE_URL` é usada para aplicar migrações e pode ser a mesma conexão direta indicada por Supabase. Se necessário, use uma URL de Session pooler para `DATABASE_URL` e conexão direta para `DIRECT_DATABASE_URL`.
3. Mantenha `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `EMAIL_CRON_SECRET`, `RESERVATION_CRON_SECRET`, credenciais dos Correios e chaves de mídia somente no cofre de segredos do servidor. Configure um segredo aleatório e independente para cada agendador. Nunca coloque chaves secretas em variáveis `NEXT_PUBLIC_`, no repositório, em URLs ou no navegador.
4. Na etapa de release, instale as dependências com `pnpm install --frozen-lockfile`, gere o Prisma Client e aplique as migrações de produção:

   ```bash
   pnpm db:generate
   pnpm db:deploy
   pnpm build
   ```

   A implantação das migrações deve usar as conexões do projeto de produção e ocorrer uma vez por release, antes de direcionar tráfego para a versão que depende delas. Para iniciar o servidor Node, use `pnpm start` e a porta disponibilizada pela hospedagem. Não use `.env.local` nem `.env.test` como configuração de produção.
5. Configure os agendadores HTTP abaixo na hospedagem ou em um serviço de cron confiável. Ambos aceitam somente `POST` com o cabeçalho `Authorization: Bearer <segredo>`; por exemplo, envie o primeiro a cada minuto. O processamento de e-mail é opcional e só funciona após configurar Resend e `EMAIL_FROM`.

   | Tarefa | Endpoint | Variáveis necessárias |
   | --- | --- | --- |
   | Liberar reservas vencidas | `POST https://SEU-DOMINIO/api/internal/stock-reservations/expire` | `RESERVATION_CRON_SECRET` |
   | Processar fila de e-mails | `POST https://SEU-DOMINIO/api/internal/email-outbox` | `EMAIL_CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM` |

6. Antes de abrir a loja, valide login e confirmação de e-mail, acesso do administrador, catálogo com fotos e estoque reais, pedidos e cancelamentos, envio de e-mail, tarefas agendadas e backups. Ative `PIX_MODE=manual` e indexação somente depois de conferir a chave/dados do recebedor, frete, informações comerciais e políticas da loja. Faça um pedido controlado e confirme o crédito diretamente no banco antes de habilitar vendas ao público.

## Verificações

```bash
pnpm db:generate
pnpm test
pnpm test:db
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

`pnpm test:db` requer `.env.test` e um projeto Supabase de teste já migrado; não aponta para produção. Sem credenciais Supabase não é possível validar login por e-mail, sincronização real com `auth.users`, e-mail, uploads ou dados hospedados. Sem uma chave PIX autorizada, dados do recebedor e tarifa de entrega, não é possível criar um QR Code de cobrança da loja nem abrir vendas. Não há confirmação automática nem integração ativa com o Banco Inter.

## Backup

Configure `BELACICLO_BACKUP_DIR` para um destino privado e agende `scripts/backup.ps1` no Windows Task Scheduler ou serviço equivalente. A retenção padrão é de 30 dias. Para testar restauração, use um banco descartável em `DATABASE_URL_RESTORE_TEST` e defina `RESTORE_CONFIRM=RESTORE_TO_TEST_DATABASE` antes de executar `scripts/restore-test.ps1`. Nenhum backup foi executado sem um banco configurado.
