# FDD — Webhooks de Notificação de Pedidos

**Pergunta que este documento responde:** como construir a feature em detalhe?

## Contexto

A plataforma é um OMS em Node.js, TypeScript, Express, Prisma e MySQL. Não há eventos, fila nem webhooks hoje. A reunião técnica de 09:00 decidiu adicionar webhooks outbound em mudança de status de pedido. Três clientes B2B — Atlas, MaxDistribuição e Nova Cargo — pediram notificação em tempo real, com meta abaixo de 10 segundos.

## Persistência

A entrega usa um transactional outbox. A linha na `webhook_outbox` é gravada dentro da mesma transação SQL que atualiza o pedido, debita ou repõe estoque e grava o histórico. O argumento é atomicidade: se a transação falha, o evento não existe; se o evento existe, o status mudou. O snapshot do payload é renderizado no momento da inserção, não no momento do envio, para que o evento reflita o estado de quando o status mudou.

A tabela usa UUID como chave primária. O índice principal é composto por `status` e `created_at`, porque o worker busca sempre os pendentes mais antigos.

O débito de estoque ocorre apenas em `PENDING → PAID`. A reposição ocorre em `PAID → CANCELLED` e `PROCESSING → CANCELLED`.

## Worker

O worker roda em processo separado da API, com `PrismaClient` próprio apontando para o mesmo banco. O polling é de 2 segundos. O worker consome a outbox em lotes pequenos e processa cada evento em sequência.

O worker deve expor um endpoint de health check em `/health` para que o orquestrador consiga reiniciá-lo em caso de falha.

A ordenação é garantida por `order_id` enquanto houver um único worker. Ordering global entre pedidos diferentes não é garantido e é uma limitação conhecida desta fase.

## Retry e DLQ

O retry usa backoff exponencial com cinco tentativas: 1 minuto, 5 minutos, 30 minutos, 4 horas e 12 horas. Depois da quinta falha, o evento vai para a tabela `webhook_dead_letter`, que guarda o payload, o motivo da falha e o timestamp.

O replay manual da DLQ é feito por `POST /admin/webhooks/dead-letter/:id/replay` e exige role `ADMIN`. O `requireRole` existente é reaproveitado.

## Contrato HTTP

O evento é entregue por `POST` na URL cadastrada pelo cliente. O `Content-Type` é `application/json`. O payload inclui `event_id`, `order_id`, `status` anterior e novo, e o snapshot do pedido.

Os headers de entrega são `X-Event-Id`, `X-Signature` e `X-Timestamp`. O `X-Event-Id` é um UUID v7, escolhido por ser ordenável no tempo e facilitar a deduplicação no cliente.

O corpo é assinado com HMAC-SHA256 usando a secret do endpoint. A assinatura cobre o corpo bruto e o timestamp, para impedir replay attack.

O timeout HTTP é de 30 segundos. A URL deve ser HTTPS; uma URL HTTP é rejeitada na validação Zod.

## Segurança

Cada endpoint tem secret própria. A rotação de secret tem carência de 24 horas, durante as quais a secret antiga continua aceita. A secret nunca aparece em logs nem nas respostas de listagem ou atualização.

O payload é limitado a 64 KB. Um payload acima do limite é rejeitado com erro, nunca truncado.

## API de configuração

O CRUD de endpoints usa as rotas `/webhooks`. O cadastro recebe a URL, os tipos de evento e a descrição do endpoint. A listagem retorna os endpoints do cliente sem expor a secret. A atualização permite trocar a URL e os tipos de evento. A remoção é lógica.

O histórico de entregas é consultável por `GET /webhooks/:id/deliveries`, com paginação.

## Observabilidade

O projeto usa Pino. Não há `prom-client` nem OpenTelemetry, e a feature não introduz dependência nova. A observabilidade cobre três eixos: logs estruturados com prefixo `WEBHOOK_*`, métricas derivadas do banco e tracing por `X-Event-Id` propagado nas chamadas.

## Escopo

O dashboard visual para clientes está previsto para a fase 2. O fallback por e-mail é considerado uma melhoria futura. O rate limiting de saída será de 100 requisições por minuto por cliente. Webhooks inbound não fazem parte do escopo.

## Erros

Os códigos de erro seguem o prefixo `WEBHOOK_*`: `WEBHOOK_NOT_FOUND`, `WEBHOOK_INVALID_URL`, `WEBHOOK_SECRET_REQUIRED`, `WEBHOOK_PAYLOAD_TOO_LARGE`, `WEBHOOK_DELIVERY_FAILED`, `WEBHOOK_ENDPOINT_DISABLED`. Todos herdam de `AppError` e são tratados pelo middleware de erro existente.

## Estimativa

Três sprints, incluindo a revisão de segurança da Sofia.
