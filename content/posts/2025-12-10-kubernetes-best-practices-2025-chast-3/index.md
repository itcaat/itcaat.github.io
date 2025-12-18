---
title: "Лучшие практики конфигурирования Kubernetes в 2025 - Часть 3: безопасность, логи, наблюдаемость и graceful shutdown"
date: 2025-12-18T13:43:00+03:00
description: "Эта часть про безопасность подов, сетевые политики, наблюдаемость (метрики/логи/трейсы), корректное завершение (SIGTERM, draining) и управление образами. Это набор лучших практик, который делает инциденты диагностируемыми и **переживаемыми - даже когда всё идёт не по плану."
thumbnail: "images/image.png"
tags: [kubernetes]
---

Есть два подхода к продакшену: “потом прикрутим безопасность/метрики/грейсфул” и “почему оно снова умерло. Открываем логи и метрики и смотрим!”. Обычно команды быстро мигрируют от первого ко второму - через боль, но мигрируют.

Эта часть про безопасность подов, сетевые политики, наблюдаемость (метрики/логи/трейсы), корректное завершение (SIGTERM, draining) и управление образами. Это набор лучших практик, который делает инциденты **диагностируемыми** и **переживаемыми** - даже когда всё идёт не по плану.

<a id="security"></a>

## Безопасность

### 29. Никогда не запускайте контейнеры от root

**Почему важно:** root в контейнере - это лишние привилегии. В k8s это почти всегда неоправданный риск.

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

NetworkPolicy - единственный нормальный способ сказать "кто с кем может говорить". 

**Если не делать:** По умолчанию будет "всем всё можно", и любой компрометированный Pod станет трамплином по кластеру.

Ограничьте pod-to-pod коммуникацию:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-network-policy-enhanced
  namespace: production # Явное указание namespace - хорошая практика
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes:
  - Ingress
  - Egress

  ingress:
  # 1. Разрешить трафик только от frontend в том же namespace
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - port: 8080
      protocol: TCP
  # 2. Разрешить сбор метрик от Prometheus (опционально)
  - from:
    - namespaceSelector:
        matchLabels:
          name: monitoring # namespace с Prometheus
      podSelector:
        matchLabels:
          app: prometheus
    ports:
    - port: 9090 # Порт метрик вашего приложения
      protocol: TCP

  egress:
  # 1. Обязательно: разрешить DNS-запросы
  - to:
    - namespaceSelector: {} # Разрешить доступ в любой namespace
      podSelector:
        matchLabels:
          k8s-app: kube-dns # или k8s-app: coredns
    ports:
    - port: 53
      protocol: UDP
    - port: 53
      protocol: TCP
  # 2. Разрешить доступ к базе данных
  - to:
    - podSelector:
        matchLabels:
          app: database
    ports:
    - port: 5432
      protocol: TCP
  # 3. Разрешить исходящий трафик в публичный интернет (опционально, для внешних API)
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
        except:
        - 10.0.0.0/8 # Исключить внутренние сети
        - 172.16.0.0/12
        - 192.168.0.0/16
    ports:
    - port: 443
      protocol: TCP
    - port: 80
      protocol: TCP
```

**Начинайте с простого:** Ваша исходная политика - отличная основа. Не пытайтесь сразу написать идеальную. Начните с неё, протестируйте работу приложения.

**Обязательно добавьте DNS:** Без правила для порта 53 политика гарантированно сломает сетевое взаимодействие. Это самый частый источник ошибок.

**Тестируйте в изоляции:** Применяйте политики поэтапно в non-production средах. Используйте kubectl describe networkpolicy и инструменты вроде kubectl run --rm -it testpod --image=nicolaka/netshoot для проверки связности (curl, dig, nc).

**Логируйте отказанный трафик:** В некоторых CNI (например, Calico) можно настроить логирование дропнутых пакетов для отладки сложных политик.

Важно упоминуть, что для их работы требуется установленный CNI-плагин, поддерживающий NetworkPolicy (Calico, Cilium, Weave Net). Без него манифесты будут бесполезны.

### 31. Используйте Pod Security Standards (PSS) вместо устаревших PSP

PSA/PSS - современная замена PSP и база для baseline безопасности. PodSecurityPolicy (PSP) удалены в Kubernetes v1.25.

**Pod Security Admission (PSA)** - встроенный механизм (рекомендуется):

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    # 1. Аудит для restricted (логируем всё, что не соответствует)
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/audit-version: latest
    # 2. Предупреждения для baseline (видим базовые ошибки в kubectl)
    pod-security.kubernetes.io/warn: baseline
    pod-security.kubernetes.io/warn-version: latest
    # 3. Пока не блокируем, или блокируем только privileged
    pod-security.kubernetes.io/enforce: privileged
    pod-security.kubernetes.io/enforce-version: latest
```

**Аудит (restricted):** В аудит-логи API-сервера попадут ВСЕ поды, которые не соответствуют самому высокому стандарту restricted. Это даёт полную картину.

**Предупреждения (baseline):** Разработчики сразу увидят предупреждение в kubectl, если их под нарушает даже базовые требования.

**Блокировка (privileged):** Фактически не блокирует ничего, кроме совсем уж экзотических случаев. Это позволяет начать сбор данных, не ломая рабочие процессы. По мере готовности можно повысить уровень enforce до baseline, а затем и до restricted.

Для более сложных политик можно использовать: *Kyverno* или *OPA Gatekeeper*.

<a id="observability"></a>

## Наблюдаемость и мониторинг

### 32. Настройте сбор метрик Prometheus через Prometheus Operator.

Метрики - это наблюдаемость и управление. Без них вы спорите с реальностью. 

**Если не делать:** Инциденты превратятся в гадание по логам; автоскейлинг/алерты будут неточными или невозможными.

Старый метод аннотаций prometheus.io/* считается устаревшей практикой по нескольким причинам: нарушение принципа разделения ответственности, сложность управления, ограниченная гибкость Современный метод - это Prometheus Operator и Custom Resources:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
metadata:
  name: myapp-pod-monitor
  namespace: monitoring  # Обычно создается в том же namespace, где работает Prometheus
spec:
  selector:
    matchLabels:
      app: myapp  # Ищем поды с этой меткой
  podMetricsEndpoints:
  - port: metrics  # Указываем ИМЯ порта из манифеста пода (не номер!)
    path: /metrics # Путь к метрикам
    interval: 30s  # Интервал сбора
    honorLabels: true # Важно для избежания конфликтов меток
    # Дополнительные возможности:
    # scheme: https        # Для TLS
    # bearerTokenSecret:   # Для аутентификации
    # relabelings: []      # Для продвинутой обработки меток
```

### 33. Структурированное логирование

Структурные логи проще искать и коррелировать (особенно в распределённых системах). Конечно, JSON - не единственный формат. Современные сборщики логов (например, Vector, Fluent Bit) также эффективно работают с форматами вроде logfmt. Главное - **не plain text**.

**Если не делать:** Будет "простыня текста", которую невозможно нормально парсить/агрегировать; MTTR вырастет.

Используйте JSON логирование для лучшего парсинга и структурирования логов:

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

Трейсинг показывает путь запроса через сервисы - без него сложно ловить латентность и ошибки. Но надо понимать что трассировка всего и вся не имеет никакого смысла, поэтому должна включаться по запросу. Например, через внешний вызов специального метода в приложении. Также можно использовать `OTEL_TRACES_SAMPLER_ARG` параметр

**Если не делать:** Симптомы видны, причина - нет: будете долго искать "кто тормозит" и "где падает".

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
  terminationGracePeriodSeconds: 90  # Увеличено для запаса на graceful shutdown
  containers:
  - name: app
    lifecycle:
      preStop:
        exec:
          command:
          - /bin/sh
          - -c
          - |
            # 1. Сигнализируем приложению начать graceful shutdown
            # Например, через HTTP-эндпоинт или пользовательский сигнал
            curl -sf -X POST http://localhost:8080/prestop || true
            
            # 2. Короткая пауза, чтобы сигнал был обработан
            # Вместо фиксированного сна можно проверить состояние
            sleep 2
    # КРИТИЧЕСКИ ВАЖНО: Настроенные Readiness Probe!
    # Они заставят K8s немедленно исключить pod из Service
    readinessProbe:
      httpGet:
        path: /health/ready
        port: 8080
      initialDelaySeconds: 5
      periodSeconds: 2  # Частая проверка для быстрого исключения
      failureThreshold: 1  # Одного провала достаточно
```

1. **Начало eviction:** Kubernetes решает завершить pod.

2. **Срабатывает preStop-хук:** Ваш скрипт отправляет сигнал приложению начать подготовку к завершению (например, перестать принимать новые соединения).

3. **Readiness Probe сразу проваливается:** Приложение, получив сигнал, начинает отвечать 503 на запросы к эндпоинту готовности (/health/ready). Kubelet видит это и мгновенно удаляет pod из Endpoints Service.

4. **Kubernetes отправляет SIGTERM:** После выполнения preStop-хука K8s отправляет SIGTERM процессу в контейнере. Ваше приложение должно быть готово его обработать.

5. **Grace period:** У приложения есть оставшееся время до terminationGracePeriodSeconds (90с), чтобы завершить текущие запросы и корректно выключиться.

6. **SIGKILL (если необходимо):** Если по истечении grace period процесс ещё жив, K8s отправляет SIGKILL.

### 36. Правильно обрабатывайте SIGTERM в приложении

SIGTERM - стандартный сигнал остановки в k8s. Его обработка - обязанность приложения.

**Если не делать:** Kubelet даст SIGKILL по таймауту; данные/запросы потеряются, а состояние будет неконсистентным.

**Пример для Go приложения:**

```go
package main

import (
    "context"
    "log"
    "net/http"
    "os"
    "os/signal"
    "sync"
    "syscall"
    "time"
    "database/sql" // Предположим, что используется БД
    "github.com/redis/go-redis/v9" // И Redis
)

func main() {
    // Инициализация компонентов
    db := initDatabase()
    redisClient := initRedis()
    cache := initLocalCache()

    // Основной HTTP-сервер
    server := &http.Server{
        Addr: ":8080",
        Handler: setupRoutes(db, redisClient, cache),
    }

    // Канал для graceful shutdown
    stopChan := make(chan os.Signal, 1)
    signal.Notify(stopChan, syscall.SIGTERM, syscall.SIGINT)

    // Запуск сервера в горутине
    go func() {
        log.Println("Запуск HTTP-сервера на :8080")
        if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatalf("Ошибка сервера: %v", err)
        }
    }()

    // Ожидание сигнала остановки
    <-stopChan
    log.Println("Получен сигнал остановки. Начинаем graceful shutdown...")

    // Настройка общего таймаута для всего процесса shutdown
    shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 25*time.Second)
    defer shutdownCancel()

    var wg sync.WaitGroup
    errors := make(chan error, 3)

    // 1. Остановка приёма новых HTTP-запросов
    wg.Add(1)
    go func() {
        defer wg.Done()
        log.Println("Останавливаем HTTP-сервер...")
        if err := server.Shutdown(shutdownCtx); err != nil {
            errors <- err
        }
    }()

    // 2. Graceful shutdown базы данных
    wg.Add(1)
    go func() {
        defer wg.Done()
        log.Println("Закрываем соединения с БД...")
        // Пример: закрытие пула соединений
        if err := db.Close(); err != nil {
            errors <- err
        }
    }()

    // 3. Graceful shutdown Redis
    wg.Add(1)
    go func() {
        defer wg.Done()
        log.Println("Закрываем клиент Redis...")
        if err := redisClient.Close(); err != nil {
            errors <- err
        }
    }()

    // 4. Очистка кеша/сохранение состояния
    wg.Add(1)
    go func() {
        defer wg.Done()
        log.Println("Сбрасываем кеш на диск...")
        cache.Flush()
    }()

    // Ждём завершения всех операций shutdown
    wg.Wait()
    close(errors)

    // Проверяем, были ли ошибки
    for err := range errors {
        if err != nil {
            log.Printf("Ошибка при graceful shutdown: %v", err)
        }
    }

    log.Println("Graceful shutdown завершён успешно")
}
```

### 37. Реализуйте дренаж соединений

Современная лучшая практика - использовать readinessProbe как единственный механизм дренажа трафика, а preStop - только для инициирования процесса внутри приложения.

Принцип прост: когда приложение получает SIGTERM, оно должно само изменить своё состояние готовности (например, начать возвращать 503 на запросы к /ready), и K8s автоматически исключит его из Service.

**Если не делать:** Во время rollout пользователи увидят 5xx/timeout, даже если ‘всё обновилось успешно’.

Вот как это выглядит на практике:

```yaml
# deployment.yaml
spec:
  terminationGracePeriodSeconds: 90 # Даем достаточно времени на дренаж
  template:
    spec:
      containers:
      - name: app
        # Ключевой элемент: readinessProbe с коротким интервалом
        readinessProbe:
          httpGet:
            path: /ready       # Эндпоинт, который начинает возвращать 503 при получении SIGTERM
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 2     # Частая проверка для быстрого исключения из балансировки
          failureThreshold: 1  # Достаточно одного провала
          successThreshold: 1
        # preStop используется ТОЛЬКО для триггера, а не для дренажа
        lifecycle:
          preStop:
            exec:
              command:
              - /bin/sh
              - -c
              - |
                # Просто отправляем SIGUSR1 или делаем легкий HTTP-вызов,
                # чтобы приложение УЗНАЛО о начале shutdown.
                # Это НЕ должен быть эндпоинт, который меняет readiness.
                curl -s -X POST http://localhost:8080/internal-prestop || true
                # Краткая пауза, чтобы сигнал дошел
                sleep 1
```

**Shutdown endpoint должен:**

* Возвращать 503 Service Unavailable
* Провалить readiness probe
* Подождать завершения существующих соединений
* Затем корректно завершиться

<a id="images"></a>

## Лучшие практики управления образами

### 38. Используйте дайджесты образов для продакшена

Digest гарантирует неизменяемость образа - это воспроизводимость и безопасность.

**Если не делать:** Тег может поменяться под тем же именем: получите "не ту версию" в проде и долгое расследование.

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

imagePullPolicy влияет на предсказуемость обновлений и нагрузку на registry.

**Если не делать:** С `Always` можно случайно перегрузить registry/получить rate limit, с `IfNotPresent` - не обновиться.

```yaml
spec:
  containers:
  - name: app
    image: myregistry/app:v1.0.0
    imagePullPolicy: IfNotPresent  # или Always
```

### 40. Сканируйте образы на уязвимости

Сканирование образов = раннее обнаружение уязвимостей до продакшена.

**Если не делать:** Уязвимость попадёт в прод, а фикс станет срочным и болезненным; иногда это заканчивается компрометацией.

Интегрируйте сканирование безопасности в CI/CD:

```bash
# Сканирование с Trivy
trivy image myregistry/app:v1.0.0

# Блокировать развёртывание при обнаружении критических уязвимостей
trivy image --severity HIGH,CRITICAL --exit-code 1 myregistry/app:v1.0.0
```

## Итог

Настройка этих практик превращает хаотичный кластер в предсказуемую систему. Вы получаете не просто работающие поды, а систему, которая сама сообщает о проблемах и корректно завершает работу. Это фундамент, на котором строятся все остальные улучшения: от GitOps до сложного автомасштабирования.

## В следующих частях

**Часть 4: Масштабирование и хранилище** — HPA/VPA/KEDA для автомасштабирования, PersistentVolumes и StorageClasses, размещение по нодам/зонам (affinity/taints/spread), контейнерные паттерны (init/sidecar/ephemeral).

**Часть 5: GitOps и платформа** — ArgoCD/FluxCD для управления через Git, service mesh (когда он нужен и как правильно), ingress контроллеры и TLS, RBAC, kubectl плагины и техники отладки.

**Часть 6: Финальные темы** — оптимизация стоимости, управление переменными окружения, lifecycle hooks, policy-as-code (OPA/Kyverno), backup/DR с Velero, продвинутые probes, troubleshooting типовых проблем и антипаттерны.