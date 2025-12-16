---
title: "Лучшие практики конфигурирования Kubernetes в 2025 — Часть 3: Безопасность+наблюдаемость+graceful shutdown+образы"
date: 2025-12-10T13:43:00+03:00
description: "Серия заметок: лучшие практики Kubernetes в формате живой статьи. Эта часть — одна из глав; все примеры и команды сохранены."
thumbnail: "images/image.png"
tags: [sre, kubernetes]
draft: true
---

Есть два подхода к продакшену: “потом прикрутим безопасность/метрики/грейсфул” и “почему оно снова умерло без логов”. Обычно команды быстро мигрируют от первого ко второму — через боль, но мигрируют.

Часть 3 — про базовый production-hardening: запуск не от root, сетевые политики, наблюдаемость (метрики/логи/трейсы), корректное завершение (SIGTERM, draining) и управление образами. Это набор практик, который делает инциденты **диагностируемыми** и **переживаемыми** — даже когда всё идёт не по плану.

**Серия:** Часть 3 из 6. (Ссылки на остальные части можно проставить после объединения.)

### В этой части
- [Безопасность (29–31)](#security)
- [Наблюдаемость (32–34)](#observability)
- [Graceful shutdown (35–37)](#graceful)
- [Образы (38–41)](#images)

<a id="security"></a>

## Безопасность

### 29. Запускайте контейнеры не от root

**Почему важно:** root в контейнере — это лишние привилегии. В k8s это почти всегда неоправданный риск.

**Если не делать:** Уязвимость в приложении даст более глубокий доступ; возрастёт шанс побега/компрометации ноды.

```yaml
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
  containers:
  - name: app
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
          - ALL
```
### 30. Используйте Network Policies

**Почему важно:** NetworkPolicy — единственный нормальный способ сказать «кто с кем может говорить».

**Если не делать:** По умолчанию будет «всем всё можно», и любой компрометированный Pod станет трамплином по кластеру.

Ограничьте pod-to-pod коммуникацию:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-network-policy
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - port: 8080
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: database
    ports:
    - port: 5432
```
### 31. Используйте Pod Security Standards (PSS) вместо устаревших PSP

**Почему важно:** PSA/PSS — современная замена PSP и база для baseline безопасности.

**Если не делать:** Либо останетесь без enforcement, либо будете пытаться оживить устаревшее; в итоге риск и техдолг.

**Важно:** PodSecurityPolicy (PSP) удалены в Kubernetes v1.25. Используйте современные альтернативы:

**Pod Security Admission (PSA)** - встроенный механизм (рекомендуется):

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    # Применить политику (блокирует нарушения)
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest
    
    # Предупреждения (не блокирует)
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/warn-version: latest
    
    # Аудит (логирует нарушения)
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/audit-version: latest
```

**Уровни Pod Security Standards:**

* `privileged` - без ограничений (не рекомендуется для production)
* `baseline` - минимальные ограничения (запрещает привилегированные контейнеры)
* `restricted` - строгие ограничения (рекомендуется для production)

**Альтернативы для сложных политик:**

* **Kyverno** - декларативные политики на YAML
* **OPA Gatekeeper** - политики на языке Rego (более гибкие)

Пример политики Kyverno:

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-non-root
spec:
  validationFailureAction: enforce
  rules:
  - name: check-runAsNonRoot
    match:
      resources:
        kinds:
        - Pod
    validate:
      message: "Контейнеры должны запускаться не от root"
      pattern:
        spec:
          securityContext:
            runAsNonRoot: true
```

<a id="observability"></a>

## Наблюдаемость и мониторинг

### 32. Настройте сбор метрик Prometheus

**Почему важно:** Метрики — это наблюдаемость и управление. Без них вы спорите с реальностью.

**Если не делать:** Инциденты превратятся в гадание по логам; автоскейлинг/алерты будут неточными или невозможными.

Включите автоматический сбор метрик с правильными аннотациями:

```yaml
apiVersion: v1
kind: Pod
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8080"
    prometheus.io/path: "/metrics"
spec:
  containers:
  - name: app
    image: myapp:v1
    ports:
    - containerPort: 8080
      name: metrics
```

**Лучшие практики:**

* Экспонируйте метрики на выделенном порту
* Используйте стандартные соглашения именования метрик (counter, gauge, histogram)
* Включайте специфичные для приложения метки
* Мониторьте как метрики приложения, так и инфраструктуры
### 33. Реализуйте структурированное логирование

**Почему важно:** Структурные логи проще искать и коррелировать (особенно в распределённых системах).

**Если не делать:** Будет «простыня текста», которую невозможно нормально парсить/агрегировать; MTTR вырастет.

Используйте JSON логирование для лучшего парсинга и запросов:

```yaml
spec:
  containers:
  - name: app
    env:
    - name: LOG_FORMAT
      value: "json"
    - name: LOG_LEVEL
      value: "info"
```

**Пример структурированного лога:**

```json
{
  "timestamp": "2025-05-20T10:30:45Z",
  "level": "error",
  "service": "api-server",
  "trace_id": "abc123",
  "user_id": "user456",
  "message": "Failed to connect to database",
  "error": "connection timeout"
}
```
### 34. Включите распределённую трассировку

**Почему важно:** Трейсинг показывает путь запроса через сервисы — без него сложно ловить латентность и ошибки.

**Если не делать:** Симптомы видны, причина — нет: будете долго искать «кто тормозит» и «где падает».

Добавьте OpenTelemetry для трассировки запросов:

```yaml
spec:
  containers:
  - name: app
    env:
    - name: OTEL_EXPORTER_OTLP_ENDPOINT
      value: "http://jaeger-collector:4317"
    - name: OTEL_SERVICE_NAME
      value: "api-server"
    - name: OTEL_TRACES_SAMPLER
      value: "parentbased_traceidratio"
    - name: OTEL_TRACES_SAMPLER_ARG
      value: "0.1"  # Сэмплировать 10% трейсов
```

<a id="graceful"></a>

## Graceful Shutdown и управление жизненным циклом

### 35. Настройте правильный период завершения

**Почему важно:** Grace period и lifecycle определяют, успеет ли сервис завершить работу корректно.

**Если не делать:** Срезанные запросы, потерянные сообщения, corrupted state и странные ошибки у клиентов при релизах/эвиктах.

```yaml
spec:
  terminationGracePeriodSeconds: 60  # По умолчанию 30
  containers:
  - name: app
    lifecycle:
      preStop:
        exec:
          command:
          - /bin/sh
          - -c
          - |
            # Подождать пока балансировщик удалит pod из ротации
            sleep 5
            # Gracefully завершить приложение
            kill -SIGTERM 1
            # Подождать дренажа соединений
            wait
```

**Почему это важно:**

1. Kubernetes отправляет SIGTERM контейнерам
2. preStop hook выполняется первым (блокирующий)
3. После завершения hook'а отправляется SIGTERM
4. После grace period отправляется SIGKILL
### 36. Правильно обрабатывайте SIGTERM в приложении

**Почему важно:** SIGTERM — стандартный сигнал остановки в k8s. Его обработка — обязанность приложения.

**Если не делать:** Kubelet даст SIGKILL по таймауту; данные/запросы потеряются, а состояние будет неконсистентным.

**Пример для Go приложения:**

```go
// Обработка graceful shutdown
sigChan := make(chan os.Signal, 1)
signal.Notify(sigChan, syscall.SIGTERM)

go func() {
    <-sigChan
    log.Println("Получен SIGTERM, выключение gracefully...")
    
    // Прекратить принимать новые запросы
    server.SetKeepAlivesEnabled(false)
    
    // Дать существующим запросам время завершиться
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    server.Shutdown(ctx)
}()
```
### 37. Реализуйте дренаж соединений

**Почему важно:** Дренаж соединений — ключ к обновлениям без боли и ошибок у клиентов.

**Если не делать:** Во время rollout пользователи увидят 5xx/timeout, даже если ‘всё обновилось успешно’.

Для сервисов за балансировщиками нагрузки:

```yaml
spec:
  containers:
  - name: app
    readinessProbe:
      httpGet:
        path: /ready
        port: 8080
      periodSeconds: 5
    lifecycle:
      preStop:
        httpGet:
          path: /shutdown
          port: 8080
```

**Shutdown endpoint должен:**

* Возвращать 503 Service Unavailable
* Провалить readiness probe
* Подождать завершения существующих соединений
* Затем корректно завершиться

<a id="images"></a>

## Лучшие практики управления образами

### 38. Используйте дайджесты образов для продакшена

**Почему важно:** Digest гарантирует неизменяемость образа — это воспроизводимость и безопасность.

**Если не делать:** Тег может поменяться под тем же именем: получите «не ту версию» в проде и долгое расследование.

**Плохо:**

```yaml
image: nginx:1.25
```

**Хорошо:**

```yaml
image: nginx@sha256:4c0fdaa8b6341bfdeca5f18f7837462c80cff90527ee35ef185571e1c327beac
```

**Почему:** Теги изменяемы, дайджесты неизменяемы и гарантируют точную версию образа.
### 39. Правильно настраивайте imagePullPolicy

**Почему важно:** imagePullPolicy влияет на предсказуемость обновлений и нагрузку на registry.

**Если не делать:** С `Always` можно случайно перегрузить registry/получить rate limit, с `IfNotPresent` — не обновиться.

```yaml
spec:
  containers:
  - name: app
    image: myregistry/app:v1.0.0
    imagePullPolicy: IfNotPresent  # или Always
```

**Руководство:**

| Тег образа | Рекомендуемая политика | Причина |
|-----------|------------------------|---------|
| `:latest` | Always | Тег часто меняется |
| `:v1.0.0` | IfNotPresent | Неизменяемый тег |
| `@sha256:...` | IfNotPresent | Неизменяемый дайджест |
| Development | Always | Быстрые итерации |
### 40. Используйте аутентификацию в приватных реестрах

**Почему важно:** Приватные registry требуют корректной auth-настройки, иначе деплой падает на ровном месте.

**Если не делать:** ImagePullBackOff в самый неподходящий момент (релиз/скейл), плюс риск утечки кредов при плохой настройке.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: registry-credentials
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: <base64-encoded-docker-config>
---
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      imagePullSecrets:
      - name: registry-credentials
      containers:
      - name: app
        image: private-registry.io/myapp:v1
```
### 41. Сканируйте образы на уязвимости

**Почему важно:** Сканирование образов — раннее обнаружение уязвимостей до продакшена.

**Если не делать:** Уязвимость попадёт в прод, а фикс станет срочным и болезненным; иногда это заканчивается компрометацией.

Интегрируйте сканирование безопасности в CI/CD:

```bash
# Сканирование с Trivy
trivy image myregistry/app:v1.0.0

# Блокировать развёртывание при обнаружении критических уязвимостей
trivy image --severity HIGH,CRITICAL --exit-code 1 myregistry/app:v1.0.0
```
