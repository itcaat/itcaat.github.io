---
title: "Лучшие практики конфигурирования Kubernetes: Полное руководство 2025"
date: 2025-12-10T13:39:35+03:00
description: "Лучшие практики куба в 2025 году"
tags: [sre, kubernetes]
---

# Введение: Почему конфигурация важна в Kubernetes (и как она может испортить вам жизнь)

Конфигурация в Kubernetes — это как игра в русскую рулетку с YAML-файлами. Один лишний пробел вместо таба, забытая буква в версии API, или случайно удалённая метка — и вуаля, ваше приложение лежит мёртвым грузом в продакшене, а вы судорожно гуглите в 3 часа ночи. Неудивительно, что **более 60% инцидентов в Kubernetes** происходят из-за "незначительных" ошибок в конфигурации. Кто бы мог подумать, что отступы важны!

Эта статья — ваш шанс избежать классических граблей, на которые уже наступили тысячи инженеров до вас. Здесь собраны проверенные в боевых условиях практики, которые помогут вам спать спокойно (или хотя бы реже просыпаться от звонков on-call). Неважно, новичок вы, героически разворачивающий свой первый Pod, или бывалый кластер-администратор с тысячей yards stare — эти советы пригодятся всем.

**Что вы узнаете (и чего научитесь избегать):**

*   Как писать YAML так, чтобы он не превращался в спагетти-код (да, отступы имеют значение)
*   Секреты правильных Deployments, StatefulSets и других обитателей k8s-зоопарка
*   Graceful shutdown — чтобы ваши pod'ы умирали красиво, а не падали как подкошенные
*   Image management: почему `:latest` — это зло, а дайджесты — ваши друзья
*   Автомасштабирование (HPA, VPA, KEDA) — пусть Kubernetes работает, пока вы пьёте кофе
*   Storage best practices — потому что потерять данные в StatefulSet'е очень обидно
*   Продвинутое планирование: taints, tolerations и прочие магические заклинания
*   GitOps с ArgoCD — чтобы Git был единственным источником истины (и головной боли)
*   Service Mesh — когда простого Ingress уже недостаточно, а mTLS нужен везде
*   RBAC и Security Contexts — или как не запустить все контейнеры от root'а
*   Observability: мониторинг, логи и трассировка — чтобы знать, что сломалось ДО звонка от клиента
*   Современная отладка с ephemeral containers — потому что `kubectl exec` иногда не работает
*   Cost optimization — как не разориться на облачных ресурсах
*   Lifecycle hooks — искусство корректного запуска и завершения приложений
*   Admission controllers — автоматическая проверка на дурака (и политики компании)
*   Backup и disaster recovery — потому что "это не случится со мной" — это не стратегия
*   Troubleshooting guide — что делать, когда ImagePullBackOff, CrashLoopBackOff и другие -BackOff портят вам день
*   104 практики, проверенные в боевых условиях (и да, некоторые на собственных шишках)
*   Антипаттерны — топ ошибок, которые делают все (чтобы вы хотя бы знали, что делаете не так)
*   Чеклисты перед продом — последняя линия обороны между вами и 3-часовым incident'ом

Общие лучшие практики конфигурирования Kubernetes
--------------------------------------------------

### 1. Всегда используйте актуальную стабильную версию API

Kubernetes API быстро развиваются. Использование устаревших версий API приводит к сломанным развертываниям при обновлении кластера.

**Всегда проверяйте доступные версии API:**

```bash
kubectl api-resources
kubectl api-versions
```

**Совет:** Используйте инструменты вроде `kubent` (Kube No Trouble) для обнаружения устаревших API в ваших манифестах перед обновлением:

```bash
kubent --helm3 --exit-error
```

### 2. Храните всю конфигурацию в системе контроля версий

**Никогда не применяйте манифесты напрямую с локальной машины.** Каждый конфигурационный файл Kubernetes должен находиться в Git (или другой системе контроля версий).

**Преимущества версионируемой конфигурации:**

*   Мгновенный откат при неудачных развертываниях
*   Полный аудит-лог того, кто что и когда изменил
*   Простая совместная работа и код-ревью
*   Воспроизводимые настройки кластера в разных окружениях

**Рекомендуемая структура папок:**

```
kubernetes/
├── base/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── configmap.yaml
├── overlays/
│   ├── development/
│   ├── staging/
│   └── production/
└── README.md
```

### 3. Соблюдайте принцип DRY с Kustomize или Helm

Не повторяйтесь в разных окружениях. Используйте **Kustomize** (встроен в kubectl) или **Helm** для управления вариациями конфигурации для разных окружений.

**Пример Kustomize:**

```yaml
# kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - service.yaml
patches:
  - path: replica-patch.yaml
```


### 4. Используйте Namespaces для логического разделения

Namespaces предоставляют логические границы внутри кластера. Используйте их для:

*   Разделения окружений (dev, staging, prod)
*   Изоляции команд или проектов
*   Применения квот ресурсов и сетевых политик

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    environment: production
    team: platform
```

Стандарты конфигурирования YAML
---------------------------------

### 5. Пишите конфигурацию в YAML, а не JSON

Хотя Kubernetes принимает и YAML, и JSON, **YAML является стандартом сообщества**. Он более читаем, поддерживает комментарии и проще в поддержке.

**Лучшие практики YAML:**

```yaml
# Хорошо: Чистый, читаемый YAML
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-application
  labels:
    app.kubernetes.io/name: web-app
    app.kubernetes.io/component: frontend
spec:
  replicas: 3
  selector:
    matchLabels:
      app.kubernetes.io/name: web-app
```

### 6. Правильно обрабатывайте булевы значения в YAML

YAML имеет хитрый парсинг булевых значений. Разные версии YAML интерпретируют значения по-разному.

**Всегда используйте явные булевы значения:**

```
# ✅ ПРАВИЛЬНО - Всегда используйте true/false
enabled: true
secure: false

# ❌ ИЗБЕГАЙТЕ - Это может вызвать проблемы
enabled: yes    # Может не распарситься корректно
enabled: on     # Неоднозначно
enabled: "yes"  # Это строка, а не булево значение
```

### 7. Держите манифесты минимальными

Не устанавливайте значения, которые Kubernetes обрабатывает по умолчанию. Минимальные манифесты:

*   Проще читать и ревьюить
*   Менее подвержены ошибкам
*   Проще поддерживать

**Пример минимального Deployment:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.25
        ports:
        - containerPort: 80
```

### 8. Группируйте связанные объекты в одном файле

Если ваши Deployment, Service и ConfigMap относятся к одному приложению, поместите их в один файл, разделив через `---`.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  # ... спецификация deployment
---
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  # ... спецификация service
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: myapp-config
data:
  # ... данные конфигурации
```


**Преимущества:**

*   Атомарные развертывания (всё или ничего)
*   Проще управлять связанными ресурсами
*   Лучшая организация в системе контроля версий

Лучшие практики конфигурирования Pod и Workloads
-------------------------------------------------

### 9. Никогда не используйте голые Pod'ы в продакшене

**Голые Pod'ы** (Pod'ы без контроллера) опасны в продакшене, потому что:

*   Они не перепланируются при отказе ноды
*   Они не масштабируются автоматически
*   У них нет возможности rolling update

**Всегда используйте контроллеры:**

|Сценарий использования     |Контроллер  |
|---------------------------|------------|
|Долгоживущие приложения    |Deployment  |
|Stateful приложения        |StatefulSet |
|Демоны на уровне ноды      |DaemonSet   |
|Пакетная обработка         |Job         |
|Запланированные задачи     |CronJob     |

### 10. Используйте Deployments для stateless приложений

Deployments — это стандарт для запуска stateless приложений:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  annotations:
    kubernetes.io/description: "REST API сервер для данных клиентов"
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: api-server
  template:
    metadata:
      labels:
        app: api-server
        version: v2.1.0
    spec:
      containers:
      - name: api
        image: myregistry/api-server:v2.1.0
        ports:
        - containerPort: 8080
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
```

### 11. Используйте Jobs для одноразовых задач

Jobs идеальны для:

*   Миграций баз данных
*   Пакетной обработки
*   Импорта/экспорта данных

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration
spec:
  backoffLimit: 3
  ttlSecondsAfterFinished: 3600
  template:
    spec:
      restartPolicy: OnFailure
      containers:
      - name: migration
        image: myregistry/db-migrate:v1.0
        command: ["./migrate", "--target=latest"]
```


### 12. Всегда настраивайте проверки работоспособности

Проверки работоспособности критичны для надёжности в продакшене:

**Liveness Probe:** Перезапускает зависшие контейнеры **Readiness Probe:** Удаляет pod'ы из service endpoints до готовности **Startup Probe:** Обрабатывает медленно стартующие контейнеры

```yaml
containers:
- name: app
  image: myapp:v1
  livenessProbe:
    httpGet:
      path: /healthz
      port: 8080
    initialDelaySeconds: 30
    periodSeconds: 10
    failureThreshold: 3
  readinessProbe:
    httpGet:
      path: /ready
      port: 8080
    initialDelaySeconds: 5
    periodSeconds: 5
    successThreshold: 1
  startupProbe:
    httpGet:
      path: /healthz
      port: 8080
    failureThreshold: 30
    periodSeconds: 10
```

Стратегии конфигурирования Deployment
--------------------------------------

### 13. Правильно настраивайте Rolling Updates

Rolling updates минимизируют простой, постепенно заменяя старые pod'ы новыми:

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%        # Макс. дополнительных pod'ов во время обновления
      maxUnavailable: 0    # Требование нулевого простоя
```


**Объяснение ключевых настроек:**

*   `maxSurge`: Сколько дополнительных pod'ов может существовать во время развертывания
*   `maxUnavailable`: Сколько pod'ов может быть недоступно во время развертывания

**Для развертывания без простоя:**

```yaml
maxSurge: 1
maxUnavailable: 0
```


### 14. Используйте Pod Disruption Budgets (PDB)

PDB защищают ваше приложение во время плановых нарушений (дренаж нод, обновления кластера):

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-pdb
spec:
  minAvailable: 2    # Или используйте maxUnavailable
  selector:
    matchLabels:
      app: api-server
```

### 15. Реализуйте Pod Anti-Affinity для высокой доступности

Распределяйте pod'ы по нодам и зонам для выживания при отказах:

```yaml
spec:
  affinity:
    podAntiAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchLabels:
              app: api-server
          topologyKey: kubernetes.io/hostname
      - weight: 50
        podAffinityTerm:
          labelSelector:
            matchLabels:
              app: api-server
          topologyKey: topology.kubernetes.io/zone
```

Конфигурация Service и сетей
-----------------------------

### 16. Создавайте Services перед зависимыми Workloads

Kubernetes внедряет переменные окружения Service в Pod'ы при запуске. Создавайте Services первыми, чтобы переменные окружения были доступны:

```yaml
# Разворачивайте в таком порядке:
kubectl apply -f configmap.yaml
kubectl apply -f service.yaml
kubectl apply -f deployment.yaml
```


**Формат переменных окружения:**

```yaml
# Для Service с именем "database"
DATABASE_SERVICE_HOST=10.96.0.10
DATABASE_SERVICE_PORT=5432
```


### 17. Используйте DNS для Service Discovery

DNS более гибок, чем переменные окружения:

```yaml
# Обращайтесь к сервисам через DNS
http://my-service.my-namespace.svc.cluster.local
http://my-service.my-namespace  # Сокращённая форма
http://my-service              # В пределах того же namespace
```

### 18. Избегайте hostPort и hostNetwork

Эти опции ограничивают планирование и создают риски безопасности:

```yaml
# ❌ ИЗБЕГАЙТЕ, если не крайне необходимо
spec:
  hostNetwork: true
  containers:
  - name: app
    ports:
    - containerPort: 80
      hostPort: 80  # Привязывает pod к конкретной ноде
```

**Лучшие альтернативы:**

*   Используйте `NodePort` Services для внешнего доступа
*   Используйте `LoadBalancer` Services в облачных окружениях
*   Используйте Ingress контроллеры для HTTP трафика
*   Используйте `kubectl port-forward` для отладки

### 19. Используйте Headless Services для StatefulSet Discovery

Для прямого pod-to-pod соединения:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mysql
spec:
  clusterIP: None  # Headless service
  selector:
    app: mysql
  ports:
  - port: 3306
```

Это создаёт DNS записи вида:

```
mysql-0.mysql.default.svc.cluster.local
mysql-1.mysql.default.svc.cluster.local
```

Метки, селекторы и аннотации
-----------------------------

### 20. Используйте семантические метки последовательно

Метки — это клей, который связывает ресурсы Kubernetes:

```yaml
metadata:
  labels:
    # Рекомендуемые метки Kubernetes
    app.kubernetes.io/name: web-app
    app.kubernetes.io/instance: web-app-prod
    app.kubernetes.io/version: "2.1.0"
    app.kubernetes.io/component: frontend
    app.kubernetes.io/part-of: ecommerce
    app.kubernetes.io/managed-by: helm
    
    # Пользовательские организационные метки
    team: platform
    environment: production
    cost-center: cc-123
```

### 21. Стратегии селекции по меткам

Используйте метки для мощной селекции ресурсов:

```bash
# Получить все frontend pod'ы
kubectl get pods -l app.kubernetes.io/component=frontend

# Получить все production ресурсы
kubectl get all -l environment=production

# Удалить все тестовые ресурсы
kubectl delete all -l environment=test

# Комбинировать селекторы
kubectl get pods -l 'app=web,environment in (staging,production)'
```

### 22. Используйте аннотации для метаданных

Аннотации хранят не идентифицирующую информацию:

```yaml
metadata:
  annotations:
    kubernetes.io/description: "Основной API сервер, обрабатывающий запросы клиентов"
    prometheus.io/scrape: "true"
    prometheus.io/port: "8080"
    deployment.kubernetes.io/revision: "3"
    kubectl.kubernetes.io/last-applied-configuration: |
      {...}
```


### 23. Отладка с использованием манипуляции метками

Временно удалите pod'ы из сервисов для отладки:

```bash
# Изолировать pod (удалить из service endpoints)
kubectl label pod myapp-pod-xyz app-

# Pod продолжает работать, но не получает трафик
# Отладка pod'а
kubectl exec -it myapp-pod-xyz -- /bin/sh

# По завершении удалите изолированный pod
kubectl delete pod myapp-pod-xyz
```

Управление ConfigMaps и Secrets
--------------------------------

### 24. Используйте ConfigMaps для нечувствительной конфигурации

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  # Простые пары ключ-значение
  LOG_LEVEL: "info"
  MAX_CONNECTIONS: "100"
  
  # Целые конфигурационные файлы
  config.yaml: |
    server:
      port: 8080
      timeout: 30s
    features:
      enable_cache: true
```

**Использование в pod'ах:**

```yaml
spec:
  containers:
  - name: app
    envFrom:
    - configMapRef:
        name: app-config
    volumeMounts:
    - name: config
      mountPath: /etc/config
  volumes:
  - name: config
    configMap:
      name: app-config
```


### 25. Безопасно работайте с Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
type: Opaque
stringData:  # Используйте stringData для plaintext ввода
  username: admin
  password: supersecret123
```


**Рекомендации по безопасности:**

*   Включите шифрование at rest для etcd
*   Используйте внешние менеджеры секретов (Vault, AWS Secrets Manager)
*   Реализуйте RBAC для доступа к Secrets
*   Регулярно ротируйте секреты
*   Никогда не коммитьте секреты в систему контроля версий

Управление ресурсами и лимиты
------------------------------

### 26. Всегда устанавливайте запросы и лимиты ресурсов

Конфигурация ресурсов предотвращает "шумных соседей" и обеспечивает планирование:

```yaml
spec:
  containers:
  - name: app
    resources:
      requests:
        memory: "256Mi"
        cpu: "100m"
      limits:
        memory: "512Mi"
        cpu: "500m"

```

**Руководство:**

*   `requests`: Гарантированные ресурсы (используются для планирования)
*   `limits`: Максимально разрешённые ресурсы
*   Устанавливайте `requests` близко к фактическому использованию
*   Устанавливайте memory `limit` = `request` для предотвращения OOMKilled
*   CPU limits могут быть в 2-4 раза больше requests для burst capacity

### 27. Используйте ResourceQuotas для лимитов namespace

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-quota
  namespace: team-alpha
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    limits.cpu: "20"
    limits.memory: 40Gi
    pods: "50"
```


### 28. Реализуйте LimitRanges для значений по умолчанию

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
spec:
  limits:
  - type: Container
    default:
      memory: "256Mi"
      cpu: "200m"
    defaultRequest:
      memory: "128Mi"
      cpu: "100m"
```

Лучшие практики конфигурирования безопасности
----------------------------------------------

### 29. Запускайте контейнеры не от root

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

### 31. Используйте Pod Security Standards

Применяйте стандарты безопасности на уровне namespace:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/audit: restricted
```

Наблюдаемость и мониторинг
---------------------------

### 32. Настройте сбор метрик Prometheus

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

Graceful Shutdown и управление жизненным циклом
-----------------------------------------------

### 35. Настройте правильный период завершения

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

Лучшие практики управления образами
------------------------------------

### 38. Используйте дайджесты образов для продакшена

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

Интегрируйте сканирование безопасности в CI/CD:

```bash
# Сканирование с Trivy
trivy image myregistry/app:v1.0.0

# Блокировать развёртывание при обнаружении критических уязвимостей
trivy image --severity HIGH,CRITICAL --exit-code 1 myregistry/app:v1.0.0
```

Стратегии автомасштабирования
------------------------------

### 42. Настройте Horizontal Pod Autoscaler (HPA)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 30
```

### 43. Используйте кастомные метрики для HPA

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: queue-worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: queue-worker
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: External
    external:
      metric:
        name: queue_depth
        selector:
          matchLabels:
            queue: orders
      target:
        type: AverageValue
        averageValue: "30"  # Масштабировать при очереди > 30 сообщений на pod
```

### 44. Рассмотрите Vertical Pod Autoscaler (VPA)

VPA автоматически настраивает CPU и memory requests:

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: api-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
  updatePolicy:
    updateMode: "Auto"  # или "Recreate" или "Off"
  resourcePolicy:
    containerPolicies:
    - containerName: api
      minAllowed:
        cpu: 100m
        memory: 128Mi
      maxAllowed:
        cpu: 2
        memory: 2Gi
```

**Предупреждение:** Не используйте HPA и VPA на одной и той же метрике (CPU/memory) одновременно.

### 45. Используйте KEDA для event-driven автомасштабирования

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: redis-scaler
spec:
  scaleTargetRef:
    name: message-processor
  minReplicaCount: 1
  maxReplicaCount: 50
  triggers:
  - type: redis
    metadata:
      address: redis:6379
      listName: message-queue
      listLength: "5"  # Масштабировать при очереди > 5 элементов на pod
```

Лучшие практики хранилища
--------------------------

### 46. Используйте PersistentVolumes для stateful приложений

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mysql-pvc
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: fast-ssd
  resources:
    requests:
      storage: 50Gi
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
spec:
  serviceName: mysql
  replicas: 1
  template:
    spec:
      containers:
      - name: mysql
        image: mysql:8.0
        volumeMounts:
        - name: data
          mountPath: /var/lib/mysql
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 50Gi
```

### 47. Определите StorageClasses для разных уровней производительности

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
  annotations:
    storageclass.kubernetes.io/is-default-class: "false"
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
  encrypted: "true"
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer
---
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: slow-hdd
provisioner: kubernetes.io/aws-ebs
parameters:
  type: st1
allowVolumeExpansion: true
```

### 48. Включите расширение Volume

```yaml
# Сначала убедитесь, что StorageClass разрешает расширение
allowVolumeExpansion: true

# Затем отредактируйте PVC для запроса большего хранилища
kubectl edit pvc mysql-pvc
# Изменить: storage: 50Gi -> storage: 100Gi
```

**Примечание:** Большинство типов volume поддерживают online расширение без перезапуска pod'а.

Продвинутые практики планирования
----------------------------------

### 49. Используйте Node Affinity для размещения workloads

```yaml
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: kubernetes.io/arch
            operator: In
            values:
            - amd64
          - key: node-type
            operator: In
            values:
            - compute-optimized
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 80
        preference:
          matchExpressions:
          - key: topology.kubernetes.io/zone
            operator: In
            values:
            - us-east-1a
```

### 50. Реализуйте Taints и Tolerations

**Taint нод:**

```bash
# Taint ноды для GPU workloads
kubectl taint nodes gpu-node-1 workload=gpu:NoSchedule

# Taint ноды для обслуживания
kubectl taint nodes node-2 maintenance=true:NoExecute
```

**Добавьте tolerations к pod'ам:**

```yaml
spec:
  tolerations:
  - key: "workload"
    operator: "Equal"
    value: "gpu"
    effect: "NoSchedule"
  - key: "maintenance"
    operator: "Exists"
    effect: "NoExecute"
    tolerationSeconds: 300  # Выселить через 5 минут
```

### 51. Используйте Topology Spread Constraints (современная альтернатива)

```yaml
spec:
  topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: kubernetes.io/hostname
    whenUnsatisfiable: DoNotSchedule
    labelSelector:
      matchLabels:
        app: api-server
  - maxSkew: 2
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: ScheduleAnyway
    labelSelector:
      matchLabels:
        app: api-server
```

**Преимущества перед anti-affinity:**

* Более точный контроль
* Лучше для больших развертываний
* Предотвращает дисбаланс зон

### 52. Используйте Priority Classes для критичных workloads

```yaml
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: high-priority
value: 1000000
globalDefault: false
description: "Критичные системные workloads"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: critical-api
spec:
  template:
    spec:
      priorityClassName: high-priority
      containers:
      - name: api
        image: api:v1
```

**Значения приоритетов:**

* Системно-критичные: 2000000000+
* Бизнес-критичные: 1000000
* Нормальные: 0 (по умолчанию)
* Пакетные/фоновые: -1000

Паттерны контейнеров и лучшие практики
--------------------------------------

### 53. Используйте Init Containers для задач настройки

```yaml
spec:
  initContainers:
  - name: wait-for-db
    image: busybox:1.36
    command:
    - sh
    - -c
    - |
      until nc -z postgres 5432; do
        echo "Ожидание базы данных..."
        sleep 2
      done
  - name: run-migrations
    image: myapp:v1
    command: ["./migrate", "--up"]
    env:
    - name: DATABASE_URL
      valueFrom:
        secretKeyRef:
          name: db-credentials
          key: url
  containers:
  - name: app
    image: myapp:v1
```

**Сценарии использования:**

* Ожидание зависимостей
* Запуск миграций базы данных
* Скачивание конфигурационных файлов
* Заполнение shared volumes

### 54. Реализуйте паттерн Sidecar

```yaml
spec:
  containers:
  - name: app
    image: myapp:v1
    ports:
    - containerPort: 8080
  - name: log-shipper
    image: fluent/fluent-bit:2.0
    volumeMounts:
    - name: logs
      mountPath: /var/log/app
  - name: metrics-exporter
    image: prometheus/node-exporter:latest
    ports:
    - containerPort: 9100
  volumes:
  - name: logs
    emptyDir: {}
```

**Распространённые сценарии использования sidecar:**

* Агрегация логов (Fluent Bit, Filebeat)
* Сбор метрик
* Service mesh прокси (Envoy)
* Ротация секретов
* Перезагрузка конфигурации

### 55. Используйте Ephemeral Containers для отладки

```bash
# Добавить debug контейнер к работающему pod'у
kubectl debug -it pod-name --image=busybox:1.36 --target=app

# Отладка ноды с ephemeral контейнером
kubectl debug node/node-name -it --image=ubuntu

# Скопировать pod и добавить debug инструменты
kubectl debug pod-name -it --copy-to=debug-pod --container=debug --image=nicolaka/netshoot
```

GitOps и управление конфигурацией
----------------------------------

### 56. Реализуйте GitOps с ArgoCD

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-application
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/myorg/k8s-manifests
    targetRevision: main
    path: applications/production
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
```

**Преимущества GitOps:**

* Единый источник истины в Git
* Автоматическое обнаружение дрейфа
* Простые откаты через Git revert
* Аудит-лог через историю Git

### 57. Используйте FluxCD для прогрессивной доставки

```yaml
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: api-server
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
  service:
    port: 8080
  analysis:
    interval: 1m
    threshold: 5
    maxWeight: 50
    stepWeight: 10
    metrics:
    - name: request-success-rate
      thresholdRange:
        min: 99
      interval: 1m
    - name: request-duration
      thresholdRange:
        max: 500
      interval: 1m
```

Интеграция Service Mesh
------------------------

### 58. Когда использовать Service Mesh

**Используйте service mesh когда вам нужно:**

* Mutual TLS между всеми сервисами
* Продвинутое управление трафиком (canary, A/B тестирование)
* Распределённая трассировка без изменения кода
* Circuit breaking и повторные попытки
* Детальный контроль доступа

**Не используйте service mesh если:**

* У вас < 20 микросервисов
* Достаточно простого ingress маршрутизации
* Команде не хватает экспертизы в service mesh
* Накладные расходы производительности неприемлемы

### 59. Настройте Istio Virtual Service

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: api-routes
spec:
  hosts:
  - api.example.com
  http:
  - match:
    - headers:
        canary:
          exact: "true"
    route:
    - destination:
        host: api-server
        subset: v2
      weight: 100
  - route:
    - destination:
        host: api-server
        subset: v1
      weight: 90
    - destination:
        host: api-server
        subset: v2
      weight: 10
```

### 60. Включите mTLS с Istio

```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: production
spec:
  mtls:
    mode: STRICT
---
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: api-authz
  namespace: production
spec:
  selector:
    matchLabels:
      app: api-server
  action: ALLOW
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/production/sa/frontend"]
```

Ingress контроллеры и внешний доступ
-------------------------------------

### 61. Настройте Nginx Ingress Controller

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    kubernetes.io/ingress.class: "nginx"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - app.example.com
    secretName: app-tls-cert
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api-server
            port:
              number: 8080
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
```

### 62. Автоматический TLS с cert-manager

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

### 63. Rate Limiting и защита от DDoS

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: protected-api
  annotations:
    nginx.ingress.kubernetes.io/limit-rps: "10"
    nginx.ingress.kubernetes.io/limit-connections: "5"
    nginx.ingress.kubernetes.io/limit-burst-multiplier: "2"
spec:
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-server
            port:
              number: 8080
```

RBAC и Service Accounts
------------------------

### 64. Следуйте принципу минимальных привилегий

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: api-server-sa
  namespace: production
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: api-server-role
  namespace: production
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  resourceNames: ["app-config"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["secrets"]
  resourceNames: ["db-credentials"]
  verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: api-server-binding
  namespace: production
subjects:
- kind: ServiceAccount
  name: api-server-sa
  namespace: production
roleRef:
  kind: Role
  name: api-server-role
  apiGroup: rbac.authorization.k8s.io
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
spec:
  template:
    spec:
      serviceAccountName: api-server-sa
      automountServiceAccountToken: false  # Монтировать только если необходимо
```

### 65. Отключите автомонтирование Service Account по умолчанию

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: default
  namespace: production
automountServiceAccountToken: false
```

**Почему:** Pod'ам не нужен доступ к Kubernetes API по умолчанию - это уменьшает поверхность атаки.

### 66. Включите аудит логирование

```yaml
# /etc/kubernetes/audit-policy.yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
- level: Metadata
  omitStages:
  - RequestReceived
  resources:
  - group: ""
    resources: ["secrets", "configmaps"]
- level: Request
  verbs: ["create", "update", "patch", "delete"]
  resources:
  - group: "apps"
    resources: ["deployments", "statefulsets"]
```

Классы качества обслуживания (QoS)
-----------------------------------

### 67. Понимание QoS классов

**Guaranteed (наивысший приоритет):**

```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "500m"
  limits:
    memory: "256Mi"  # Должен быть равен request
    cpu: "500m"      # Должен быть равен request
```

**Burstable (средний приоритет):**

```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "100m"
  limits:
    memory: "512Mi"  # Отличается от request
    cpu: "500m"
```

**BestEffort (низший приоритет):**

```yaml
# Не определены requests или limits
```

**Порядок выселения при нехватке ресурсов на ноде:** BestEffort → Burstable → Guaranteed

kubectl советы по управлению конфигурацией
-------------------------------------------

### 68. Применяйте целые директории

```bash
# Применить все манифесты в директории
kubectl apply -f ./kubernetes/ --recursive

# Используйте server-side apply для лучшей обработки конфликтов
kubectl apply -f ./kubernetes/ --server-side

# Предпросмотр изменений перед применением
kubectl diff -f ./kubernetes/
```


### 69. Генерируйте манифесты из работающих ресурсов

```bash
# Экспортировать работающий deployment как YAML
kubectl get deployment nginx -o yaml > nginx-deployment.yaml

# Создать deployment императивно, затем экспортировать
kubectl create deployment nginx --image=nginx --dry-run=client -o yaml > deployment.yaml

```


### 70. Валидируйте конфигурации перед применением

```bash
# Валидация dry-run
kubectl apply -f deployment.yaml --dry-run=server

# Валидация на стороне клиента
kubectl apply -f deployment.yaml --dry-run=client

# Валидация с kubeval
kubeval deployment.yaml

# Валидация с kubeconform (быстрее)
kubeconform -strict deployment.yaml
```

Современные техники отладки
----------------------------

### 71. Используйте kubectl debug с Ephemeral Containers

```bash
# Отладка работающего pod'а добавлением debug контейнера
kubectl debug -it api-pod-xyz \
  --image=nicolaka/netshoot \
  --target=api \
  --share-processes

# Внутри debug контейнера вы можете:
# - Инспектировать сеть (netstat, tcpdump)
# - Проверять процессы (ps, top)
# - Тестировать соединения (curl, ping)
# - Анализировать файловую систему

# Отладка ноды напрямую
kubectl debug node/worker-node-1 -it --image=ubuntu

# Создать debug копию pod'а с другим образом
kubectl debug api-pod-xyz -it \
  --copy-to=debug-api \
  --container=api \
  --image=myapp:debug-version
```

### 72. Стримите логи из нескольких Pod'ов

```bash
# Установить stern для продвинутого стриминга логов
brew install stern

# Смотреть логи всех pod'ов с меткой
stern -l app=api-server

# Включить временные метки и имена pod'ов
stern -l app=api-server -t --tail 50

# Фильтровать логи с grep
stern api-server --exclude-container=istio-proxy | grep ERROR

# Несколько namespaces
stern api-server --all-namespaces
```

### 73. Интерактивные техники отладки

```bash
# Port forward для локального тестирования
kubectl port-forward svc/api-server 8080:80

# Выполнить команды в работающем pod'е
kubectl exec -it pod-name -- /bin/bash

# Копировать файлы из/в pod
kubectl cp pod-name:/var/log/app.log ./app.log
kubectl cp ./config.yaml pod-name:/etc/config/

# Проверить события для отладки
kubectl get events --sort-by='.lastTimestamp' -A

# Описать ресурс для детальной информации
kubectl describe pod api-pod-xyz

# Проверить потребление ресурсов
kubectl top pods
kubectl top nodes
```

### 74. Используйте stern и kubectl плагины

```bash
# Установить kubectl плагины
kubectl krew install tail
kubectl krew install debug-shell
kubectl krew install resource-capacity

# Использовать resource-capacity для анализа кластера
kubectl resource-capacity --pods --util

# Продвинутая фильтрация pod'ов
kubectl get pods --field-selector status.phase=Running
kubectl get pods --field-selector spec.nodeName=node-1
```

Лучшие практики оптимизации затрат
-----------------------------------

### 75. Правильно подбирайте размер ваших Workloads

```bash
# Анализировать фактическое использование ресурсов
kubectl top pods -n production

# Использовать VPA в режиме рекомендаций
kubectl get vpa api-server-vpa -o yaml

# Сравнить requests с фактическим использованием
kubectl get pods -o custom-columns=\
NAME:.metadata.name,\
CPU_REQ:.spec.containers[0].resources.requests.cpu,\
MEM_REQ:.spec.containers[0].resources.requests.memory
```

**Стратегия right-sizing:**

```yaml
# Начать с базовой линии
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "200m"

# Мониторить 1-2 недели, затем настроить на основе:
# - P95 использования памяти + 20% буфер
# - P95 использования CPU для requests
# - P99 использования CPU для limits
```

### 76. Используйте Spot/Preemptible инстансы

```yaml
# Node affinity для spot инстансов
apiVersion: apps/v1
kind: Deployment
metadata:
  name: batch-processor
spec:
  template:
    spec:
      affinity:
        nodeAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            preference:
              matchExpressions:
              - key: node.kubernetes.io/instance-type
                operator: In
                values:
                - spot
                - preemptible
      tolerations:
      - key: "spot"
        operator: "Exists"
```

**Лучше всего для:**

* Stateless workloads
* Пакетная обработка
* CI/CD раннеры
* Окружения разработки

### 77. Реализуйте автомасштабирование кластера

```yaml
# AWS Cluster Autoscaler конфигурация
apiVersion: v1
kind: ConfigMap
metadata:
  name: cluster-autoscaler-config
data:
  scale-down-delay-after-add: "10m"
  scale-down-unneeded-time: "10m"
  skip-nodes-with-local-storage: "false"
  skip-nodes-with-system-pods: "false"
```

### 78. Мониторьте и алертите на аномалии затрат

```yaml
# Пример Prometheus алерта для высокого использования ресурсов
apiVersion: v1
kind: ConfigMap
metadata:
  name: cost-alerts
data:
  alerts.yaml: |
    groups:
    - name: cost-optimization
      rules:
      - alert: HighCPUWaste
        expr: |
          (sum(rate(container_cpu_usage_seconds_total[5m])) by (namespace, pod) /
           sum(kube_pod_container_resource_requests{resource="cpu"}) by (namespace, pod)) < 0.3
        for: 1h
        annotations:
          summary: "Pod {{ $labels.pod }} использует < 30% запрошенного CPU"
      
      - alert: HighMemoryWaste
        expr: |
          (sum(container_memory_working_set_bytes) by (namespace, pod) /
           sum(kube_pod_container_resource_requests{resource="memory"}) by (namespace, pod)) < 0.5
        for: 1h
        annotations:
          summary: "Pod {{ $labels.pod }} использует < 50% запрошенной памяти"
```

Лучшие практики переменных окружения
--------------------------------------

### 79. Понимание приоритета переменных окружения

```yaml
spec:
  containers:
  - name: app
    # Приоритет 3: Индивидуальные env переменные (высший приоритет)
    env:
    - name: LOG_LEVEL
      value: "debug"
    - name: DB_HOST
      valueFrom:
        configMapKeyRef:
          name: app-config
          key: database-host
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: db-secret
          key: password
    
    # Приоритет 2: ConfigMap как envFrom
    envFrom:
    - configMapRef:
        name: app-config
    
    # Приоритет 1: Secret как envFrom (низший приоритет)
    - secretRef:
        name: app-secrets
```

**Порядок приоритета:** `env` > `envFrom` (ConfigMap) > `envFrom` (Secret)

### 80. Используйте неизменяемые ConfigMaps и Secrets

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config-v2
immutable: true
data:
  config.yaml: |
    feature_flags:
      new_feature: enabled
---
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials-v2
immutable: true
stringData:
  password: "newsecretpassword"
```

**Преимущества:**

* Предотвращает случайные изменения
* Лучшая производительность (kubelet не следит за изменениями)
* Принудительный перезапуск pod'а при изменении конфига
* Версионирование конфига вместе с развертыванием

### 81. Триггерите перезапуск Pod при изменении ConfigMap

```yaml
# Добавить аннотацию checksum для принудительного перезапуска при изменении конфига
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
spec:
  template:
    metadata:
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
    spec:
      containers:
      - name: app
        envFrom:
        - configMapRef:
            name: app-config
```

**Или используйте Reloader:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  annotations:
    reloader.stakater.com/auto: "true"
```

Глубокое погружение в Lifecycle Hooks
--------------------------------------

### 82. Используйте postStart Hooks для инициализации

```yaml
spec:
  containers:
  - name: app
    lifecycle:
      postStart:
        exec:
          command:
          - /bin/sh
          - -c
          - |
            # Подождать пока приложение будет готово
            until curl -f http://localhost:8080/health; do
              sleep 1
            done
            
            # Зарегистрироваться во внешнем сервисе
            curl -X POST http://registry/register \
              -d "instance=$HOSTNAME"
```

**Сценарии использования:**

* Регистрация сервиса во внешней системе
* Прогрев кешей приложения
* Скачивание начальных данных
* Настройка runtime параметров

### 83. Продвинутые паттерны preStop Hook

```yaml
spec:
  containers:
  - name: app
    lifecycle:
      preStop:
        exec:
          command:
          - /bin/sh
          - -c
          - |
            # 1. Разрегистрироваться из балансировщика
            curl -X DELETE http://lb/deregister/$HOSTNAME
            
            # 2. Подождать пока LB удалит инстанс (5с)
            sleep 5
            
            # 3. Сигнализировать приложению прекратить принимать новые запросы
            kill -USR1 1
            
            # 4. Подождать завершения обрабатываемых запросов
            while [ $(netstat -an | grep ESTABLISHED | wc -l) -gt 0 ]; do
              sleep 1
            done
            
            # 5. Сбросить метрики/логи
            curl -X POST http://localhost:9090/flush
```

### 84. Комбинируйте Hooks с Probes

```yaml
spec:
  terminationGracePeriodSeconds: 90
  containers:
  - name: app
    readinessProbe:
      httpGet:
        path: /ready
        port: 8080
      periodSeconds: 5
      failureThreshold: 1  # Быстро удалить из endpoints
    
    livenessProbe:
      httpGet:
        path: /health
        port: 8080
      periodSeconds: 10
      failureThreshold: 3
    
    lifecycle:
      preStop:
        httpGet:
          path: /shutdown
          port: 8080
          scheme: HTTP
```

**Последовательность выключения:**

1. preStop hook запускается (вызывает `/shutdown`)
2. Приложение возвращает 503 на `/ready` probe
3. Kubernetes удаляет pod из endpoints (~5-10с)
4. Приложение дренажит соединения
5. SIGTERM отправляется после завершения preStop
6. Приложение корректно завершается

Admission Controllers и применение политик
------------------------------------------

### 85. Используйте OPA Gatekeeper для применения политик

```yaml
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8srequiredlabels
spec:
  crd:
    spec:
      names:
        kind: K8sRequiredLabels
      validation:
        openAPIV3Schema:
          properties:
            labels:
              type: array
              items:
                type: string
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8srequiredlabels
        
        violation[{"msg": msg, "details": {"missing_labels": missing}}] {
          provided := {label | input.review.object.metadata.labels[label]}
          required := {label | label := input.parameters.labels[_]}
          missing := required - provided
          count(missing) > 0
          msg := sprintf("Отсутствуют обязательные метки: %v", [missing])
        }
---
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredLabels
metadata:
  name: pod-required-labels
spec:
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Pod"]
  parameters:
    labels:
      - "app.kubernetes.io/name"
      - "app.kubernetes.io/version"
      - "environment"
```

### 86. Реализуйте Validating Webhooks

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
metadata:
  name: pod-validator
webhooks:
- name: validate.pods.example.com
  admissionReviewVersions: ["v1"]
  clientConfig:
    service:
      name: pod-validator
      namespace: validators
      path: "/validate"
    caBundle: <base64-encoded-ca-cert>
  rules:
  - operations: ["CREATE", "UPDATE"]
    apiGroups: [""]
    apiVersions: ["v1"]
    resources: ["pods"]
  failurePolicy: Fail
  sideEffects: None
```

### 87. Используйте Mutating Webhooks для автоконфигурации

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: MutatingWebhookConfiguration
metadata:
  name: pod-mutator
webhooks:
- name: mutate.pods.example.com
  admissionReviewVersions: ["v1"]
  clientConfig:
    service:
      name: pod-mutator
      namespace: mutators
      path: "/mutate"
  rules:
  - operations: ["CREATE"]
    apiGroups: [""]
    apiVersions: ["v1"]
    resources: ["pods"]
  sideEffects: None
```

**Распространённые сценарии мутации:**

* Внедрение sidecar контейнеров
* Добавление меток/аннотаций по умолчанию
* Установка security contexts
* Настройка лимитов ресурсов
* Добавление init контейнеров

Резервное копирование и аварийное восстановление
------------------------------------------------

### 88. Реализуйте Velero для резервных копий кластера

```bash
# Установить Velero
velero install \
  --provider aws \
  --bucket kubernetes-backups \
  --backup-location-config region=us-east-1 \
  --snapshot-location-config region=us-east-1 \
  --secret-file ./credentials-velero

# Создать расписание резервных копий
velero schedule create daily-backup \
  --schedule="0 2 * * *" \
  --include-namespaces production,staging \
  --ttl 720h
```

**Ресурс Velero backup:**

```yaml
apiVersion: velero.io/v1
kind: Backup
metadata:
  name: production-backup
spec:
  includedNamespaces:
  - production
  includedResources:
  - '*'
  storageLocation: default
  volumeSnapshotLocations:
  - default
  ttl: 720h0m0s
```

### 89. Резервные копии etcd снэпшотов

```bash
# Создать etcd снэпшот
ETCDCTL_API=3 etcdctl snapshot save snapshot.db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# Проверить снэпшот
ETCDCTL_API=3 etcdctl snapshot status snapshot.db -w table

# Восстановить из снэпшота
ETCDCTL_API=3 etcdctl snapshot restore snapshot.db \
  --data-dir=/var/lib/etcd-restore
```

### 90. Создайте Runbook для аварийного восстановления

```yaml
# disaster-recovery-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: dr-runbook
  namespace: kube-system
data:
  runbook.md: |
    # Процедуры аварийного восстановления
    
    ## Сценарий 1: Потеря Control Plane
    1. Восстановить etcd из последнего backup
    2. Проверить подключение к API server
    3. Проверить статус нод
    4. Валидировать здоровье workloads
    
    ## Сценарий 2: Поврежденный Namespace
    1. Список доступных backup'ов: `velero backup get`
    2. Восстановить namespace: `velero restore create --from-backup production-backup`
    3. Проверить восстановленные ресурсы
    
    ## Сценарий 3: Неудачное развертывание
    1. Откатить deployment: `kubectl rollout undo deployment/app`
    2. Проверить статус rollout: `kubectl rollout status deployment/app`
    3. Проверить здоровье приложения
    
    ## RTO и RPO
    - RTO (Recovery Time Objective): 1 час
    - RPO (Recovery Point Objective): 24 часа
```

### 91. Регулярно тестируйте аварийное восстановление

```bash
# Автоматизированный DR тестовый скрипт
#!/bin/bash

# Создать тестовый namespace
kubectl create namespace dr-test

# Развернуть тестовое приложение
kubectl apply -f test-app.yaml -n dr-test

# Создать backup
velero backup create dr-test-backup --include-namespaces dr-test --wait

# Удалить namespace
kubectl delete namespace dr-test

# Подождать и проверить удаление
sleep 30

# Восстановить из backup
velero restore create dr-test-restore --from-backup dr-test-backup --wait

# Проверить восстановление
kubectl get all -n dr-test

# Очистка
velero backup delete dr-test-backup --confirm
kubectl delete namespace dr-test
```

Расширенные проверки работоспособности
---------------------------------------

### 92. Настройте проверки работоспособности для разных типов приложений

**HTTP/REST API:**

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
    httpHeaders:
    - name: X-Health-Check
      value: liveness
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

**gRPC приложение:**

```yaml
livenessProbe:
  grpc:
    port: 9090
    service: health.v1.Health  # Опционально
  initialDelaySeconds: 30
  periodSeconds: 10
```

**TCP Socket:**

```yaml
livenessProbe:
  tcpSocket:
    port: 5432
  initialDelaySeconds: 15
  periodSeconds: 10
```

**Выполнение команды:**

```yaml
livenessProbe:
  exec:
    command:
    - /bin/sh
    - -c
    - |
      pg_isready -U postgres -d mydb -h localhost
  initialDelaySeconds: 30
  periodSeconds: 10
```

### 93. Реализуйте Startup Probes для медленных приложений

```yaml
spec:
  containers:
  - name: slow-app
    startupProbe:
      httpGet:
        path: /healthz
        port: 8080
      failureThreshold: 30  # 30 * 10с = 5 минут макс. запуск
      periodSeconds: 10
    
    livenessProbe:
      httpGet:
        path: /healthz
        port: 8080
      periodSeconds: 10
      failureThreshold: 3
    
    readinessProbe:
      httpGet:
        path: /ready
        port: 8080
      periodSeconds: 5
      successThreshold: 1
```

**Зачем использовать startup probes:**

* Предотвращает преждевременные отказы liveness probe во время запуска
* Позволяет более долгое время инициализации без влияния на runtime проверки
* Лучше для приложений с медленной инициализацией (ML модели, большие кеши)

### 94. Лучшие практики проверок работоспособности

```yaml
# Плохо: Проверка внешних зависимостей в liveness
livenessProbe:
  httpGet:
    path: /health  # Проверяет database, redis и т.д.
  failureThreshold: 1  # Слишком агрессивно

# Хорошо: Разделение ответственности
livenessProbe:
  httpGet:
    path: /alive  # Только проверяет жив ли процесс
  periodSeconds: 10
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /ready  # Проверяет зависимости и готовность
  periodSeconds: 5
  failureThreshold: 2
  successThreshold: 1
```

**Руководство по реализации health endpoints:**

```go
// /alive - Liveness probe (быстрый, простой)
func alive(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
    w.Write([]byte("OK"))
}

// /ready - Readiness probe (всеобъемлющий)
func ready(w http.ResponseWriter, r *http.Request) {
    checks := []func() error{
        checkDatabase,
        checkRedis,
        checkQueue,
    }
    
    for _, check := range checks {
        if err := check(); err != nil {
            w.WriteHeader(http.StatusServiceUnavailable)
            w.Write([]byte(err.Error()))
            return
        }
    }
    
    w.WriteHeader(http.StatusOK)
    w.Write([]byte("Ready"))
}
```

Устранение распространённых проблем
------------------------------------

### 95. Ошибки ImagePullBackOff

```bash
# Проверить статус загрузки образа
kubectl describe pod pod-name | grep -A 10 Events

# Частые причины:
# 1. Образ не существует
docker pull myregistry/app:v1.0.0

# 2. Проблемы с аутентификацией
kubectl get secret registry-credentials -o yaml

# 3. Rate limiting (Docker Hub)
kubectl describe pod pod-name | grep "rate limit"

# Решения:
# - Использовать imagePullSecrets
# - Переключиться на приватный registry
# - Использовать image mirror/cache
```

### 96. Стратегия отладки CrashLoopBackOff

```bash
# Получить последние логи
kubectl logs pod-name --previous

# Проверить exit code
kubectl get pod pod-name -o jsonpath='{.status.containerStatuses[0].lastState.terminated}'

# Распространённые exit коды:
# 0: Нормальное завершение
# 1: Ошибка приложения
# 137: SIGKILL (OOMKilled)
# 143: SIGTERM (Graceful shutdown)

# Отладка с ephemeral контейнером
kubectl debug -it pod-name --image=busybox --target=app

# Проверить лимиты ресурсов
kubectl describe pod pod-name | grep -A 5 Limits
```

### 97. Pending Pod'ы - проблемы планирования

```bash
# Проверить почему pod pending
kubectl describe pod pod-name

# Частые причины:
# 1. Недостаточно ресурсов
kubectl describe nodes | grep -A 5 "Allocated resources"

# 2. Несовпадение node selector
kubectl get nodes --show-labels
kubectl get pod pod-name -o yaml | grep -A 5 nodeSelector

# 3. Taints и tolerations
kubectl describe node node-name | grep Taints
kubectl get pod pod-name -o yaml | grep -A 5 tolerations

# 4. Pod affinity/anti-affinity
kubectl get pod pod-name -o yaml | grep -A 10 affinity

# 5. PVC не привязан
kubectl get pvc
```

### 98. Проблемы подключения к Service

```bash
# Тестировать соединение с сервисом
kubectl run test-pod --rm -it --image=nicolaka/netshoot -- /bin/bash

# Внутри pod'а:
nslookup my-service.my-namespace.svc.cluster.local
curl http://my-service:80

# Проверить endpoints сервиса
kubectl get endpoints my-service

# Проверить совпадение меток pod'а с селектором сервиса
kubectl get pod pod-name --show-labels
kubectl get service my-service -o yaml | grep -A 5 selector

# Проверить сетевые политики
kubectl get networkpolicy -A
kubectl describe networkpolicy my-policy
```

### 99. Высокое использование памяти / OOMKilled

```bash
# Проверить использование памяти
kubectl top pod pod-name

# Получить информацию об OOM
kubectl describe pod pod-name | grep -i oom

# Проверить лимиты памяти
kubectl get pod pod-name -o jsonpath='{.spec.containers[*].resources}'

# Решения:
# 1. Увеличить лимиты памяти
# 2. Исправить утечки памяти в приложении
# 3. Использовать VPA для right-sizing
# 4. Включить memory profiling

# Просмотр метрик памяти
kubectl top pod pod-name --containers
```

### 100. Проблемы разрешения DNS

```bash
# Тестировать DNS из pod'а
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup kubernetes.default

# Проверить CoreDNS pod'ы
kubectl get pods -n kube-system -l k8s-app=kube-dns

# Просмотр логов CoreDNS
kubectl logs -n kube-system -l k8s-app=kube-dns --tail=100

# Проверить конфиг CoreDNS
kubectl get configmap coredns -n kube-system -o yaml

# Частые исправления:
# 1. Перезапустить CoreDNS
kubectl rollout restart deployment coredns -n kube-system

# 2. Проверить настройки DNS на ноде
kubectl get nodes -o wide
```

Антипаттерны, которых следует избегать
---------------------------------------

### 101. Распространённые антипаттерны Kubernetes

**❌ Запуск баз данных в Kubernetes (без экспертизы)**

```yaml
# Не делайте это для production баз данных, если у вас нет:
# - Глубокой экспертизы в Kubernetes
# - Правильных процедур backup/restore
# - StatefulSet с persistent volumes
# - Мониторинга и алертинга
# Лучше: Используйте managed сервисы баз данных (RDS, CloudSQL и т.д.)
```

**❌ Монтирование Host Paths**

```yaml
# Опасный антипаттерн
volumes:
- name: host-data
  hostPath:
    path: /var/data  # Привязывает pod к конкретной ноде, риск безопасности
```

**❌ Использование `:latest` тега в продакшене**

```yaml
# Плохо: Невоспроизводимые развертывания
image: nginx:latest

# Хорошо: Конкретные, неизменяемые версии
image: nginx:1.25.3
# Лучше: Используйте digest
image: nginx@sha256:4c0fdaa8b6341bfdeca5f18f7837462c80cff90527ee35ef185571e1c327beac
```

**❌ Не устанавливать лимиты ресурсов**

```yaml
# Плохо: Нет лимитов = потенциальная нестабильность кластера
containers:
- name: app
  image: app:v1
  # Отсутствуют resources

# Хорошо: Всегда устанавливайте requests и limits
containers:
- name: app
  image: app:v1
  resources:
    requests:
      memory: "256Mi"
      cpu: "100m"
    limits:
      memory: "512Mi"
      cpu: "500m"
```

**❌ Секреты в переменных окружения (видны в describe)**

```yaml
# Плохо: Любой с доступом к describe видит секреты
env:
- name: API_KEY
  value: "super-secret-key-12345"

# Хорошо: Используйте secretKeyRef
env:
- name: API_KEY
  valueFrom:
    secretKeyRef:
      name: api-secrets
      key: api-key

# Лучше: Монтировать как volume (более безопасно)
volumeMounts:
- name: secrets
  mountPath: /etc/secrets
  readOnly: true
volumes:
- name: secrets
  secret:
    secretName: api-secrets
```

**❌ Чрезмерное количество реплик**

```yaml
# Плохо: Растрата ресурсов
replicas: 50  # Для приложения, которое получает 10 запросов/день

# Хорошо: Right-size и используйте HPA
replicas: 2
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  minReplicas: 2
  maxReplicas: 10
```

**❌ Игнорирование Security Contexts**

```yaml
# Плохо: Запуск от root
containers:
- name: app
  image: app:v1

# Хорошо: Явный security context
containers:
- name: app
  image: app:v1
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    readOnlyRootFilesystem: true
    allowPrivilegeEscalation: false
    capabilities:
      drop: ["ALL"]
```

**❌ Один гигантский Namespace**

```yaml
# Плохо: Всё в default namespace
apiVersion: v1
kind: Namespace
metadata:
  name: default  # Не используйте default для всего

# Хорошо: Логическое разделение
---
apiVersion: v1
kind: Namespace
metadata:
  name: production
---
apiVersion: v1
kind: Namespace
metadata:
  name: staging
```

**❌ Жестко закодированная конфигурация**

```yaml
# Плохо: Конфигурация в deployment
env:
- name: DATABASE_URL
  value: "postgres://prod-db.example.com:5432/db"

# Хорошо: Внешняя конфигурация
env:
- name: DATABASE_URL
  valueFrom:
    configMapKeyRef:
      name: app-config
      key: database-url
```

**❌ Отсутствие проверок работоспособности**

```yaml
# Плохо: Нет probes
containers:
- name: app
  image: app:v1

# Хорошо: Всеобъемлющие проверки здоровья
containers:
- name: app
  image: app:v1
  livenessProbe:
    httpGet:
      path: /healthz
      port: 8080
    periodSeconds: 10
  readinessProbe:
    httpGet:
      path: /ready
      port: 8080
    periodSeconds: 5
```

Краткий справочный чеклист
---------------------------

### 102. Чеклист перед развертыванием

**✅ Проверка конфигурации:**

- [ ] API версии актуальны (не устаревшие)
- [ ] Все манифесты в системе контроля версий
- [ ] Установлены resource requests и limits
- [ ] Настроены health probes (liveness, readiness, startup)
- [ ] Применены правильные метки и аннотации
- [ ] Секреты не жестко закодированы
- [ ] Образы используют конкретные теги или дайджесты

**✅ Чеклист безопасности:**

- [ ] Контейнеры запускаются не от root
- [ ] Включён ReadOnlyRootFilesystem
- [ ] Запрещено privilegeEscalation
- [ ] Определены security contexts
- [ ] Настроены network policies
- [ ] Правильно настроен RBAC
- [ ] Применены Pod Security Standards
- [ ] Секреты шифруются at rest

**✅ Чеклист надёжности:**

- [ ] Настроены множественные реплики
- [ ] Определены pod disruption budgets
- [ ] Правила anti-affinity для HA
- [ ] Реализован graceful shutdown
- [ ] Установлены квоты ресурсов для namespace
- [ ] Настроены мониторинг и логирование
- [ ] Запланированы backup'ы (Velero)

**✅ Чеклист производительности:**

- [ ] Resource requests основаны на реальном использовании
- [ ] Настроен HPA для переменной нагрузки
- [ ] Включено кеширование DNS
- [ ] Настроен connection pooling
- [ ] Оптимизирована image pull policy
- [ ] Init containers для тяжёлой инициализации

**✅ Чеклист наблюдаемости:**

- [ ] Экспонированы Prometheus метрики
- [ ] Включено структурированное логирование
- [ ] Настроена распределённая трассировка
- [ ] Созданы дашборды
- [ ] Настроены алерты
- [ ] Интегрирован error tracking

### 103. Справочник распространённых kubectl команд

```bash
# Управление развертываниями
kubectl apply -f deployment.yaml
kubectl rollout status deployment/app
kubectl rollout undo deployment/app
kubectl scale deployment app --replicas=5

# Отладка
kubectl describe pod pod-name
kubectl logs pod-name -f
kubectl logs pod-name --previous
kubectl exec -it pod-name -- /bin/bash
kubectl debug -it pod-name --image=busybox

# Инспекция ресурсов
kubectl get all -n namespace
kubectl top pods
kubectl top nodes
kubectl get events --sort-by='.lastTimestamp'

# Конфигурация
kubectl create configmap app-config --from-file=config.yaml
kubectl create secret generic db-creds --from-literal=password=secret
kubectl get configmap app-config -o yaml

# Сети
kubectl port-forward svc/app 8080:80
kubectl get endpoints
kubectl get ingress

# RBAC
kubectl auth can-i create deployments
kubectl auth can-i --list
kubectl get rolebindings

# Информация о кластере
kubectl cluster-info
kubectl get nodes -o wide
kubectl api-resources
kubectl api-versions
```

### 104. Полезные инструменты и расширения

| Инструмент | Назначение |
|------------|------------|
| **k9s** | Terminal UI для K8s |
| **stern** | Multi-pod log tailing |
| **kubectx/kubens** | Переключение контекста/namespace |
| **kustomize** | Управление конфигурацией |
| **helm** | Менеджер пакетов |
| **krew** | Менеджер плагинов kubectl |
| **kubeval** | YAML валидация |
| **kube-linter** | Проверка лучших практик |
| **velero** | Backup/restore |
| **k6** | Нагрузочное тестирование |
| **kubescape** | Сканирование безопасности |
| **Lens** | Desktop GUI |

Распространённые ошибки конфигурации, которых следует избегать
---------------------------------------------------------------

* Ошибка: Нет лимитов ресурсов
  * Влияние: Нестабильность ноды, OOM kills
  * Решение: Всегда устанавливайте requests и limits
* Ошибка: Отсутствуют проверки здоровья
  * Влияние: Необнаруженные отказы, плохое восстановление
  * Решение: Настройте liveness и readiness probes
* Ошибка: Голые Pod'ы
  * Влияние: Нет автоматического восстановления
  * Решение: Используйте Deployments или другие контроллеры
* Ошибка: Жестко закодированные секреты
  * Влияние: Уязвимости безопасности
  * Решение: Используйте Kubernetes Secrets или внешние хранилища
* Ошибка: Нет PodDisruptionBudgets
  * Влияние: Простой во время обслуживания
  * Решение: Создавайте PDB для критичных workloads
* Ошибка: Неправильные селекторы меток
  * Влияние: Осиротевшие ресурсы, проблемы маршрутизации
  * Решение: Точно совмещайте метки
* Ошибка: Запуск от root
  * Влияние: Риски безопасности
  * Решение: Используйте runAsNonRoot: true
* Ошибка: Нет resource requests
  * Влияние: Плохие решения планирования
  * Решение: Устанавливайте реалистичные requests

Инструменты валидации конфигурации
-----------------------------------

### Рекомендуемые инструменты

1.  **kubeval / kubeconform**: Валидация YAML относительно Kubernetes схем
2.  **kube-linter**: Статический анализ лучших практик
3.  **Datree**: Применение политик и валидация
4.  **OPA/Gatekeeper**: Валидация policy-as-code
5.  **Polaris**: Проверки лучших практик и безопасности
6.  **kubent**: Обнаружение устаревших API

**Пример CI/CD пайплайна валидации:**

```yaml
# .github/workflows/validate.yaml
name: Validate Kubernetes Manifests
on: [pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Validate schemas
      run: kubeconform -strict -summary kubernetes/
    - name: Check best practices
      run: kube-linter lint kubernetes/
    - name: Detect deprecated APIs
      run: kubent -f kubernetes/
```

Заключение
----------

Конфигурация Kubernetes может показаться обыденной, но это основа надёжных развертываний. Следуя этим лучшим практикам, вы создадите кластеры, которые:

*   **Поддерживаемые**: Чистые, версионируемые конфигурации
*   **Надёжные**: Правильные проверки здоровья, лимиты ресурсов и правила anti-affinity
*   **Безопасные**: Контейнеры не от root, сетевые политики и управление секретами
*   **Масштабируемые**: Правильное использование контроллеров и управление ресурсами

**Ключевые выводы:**

1.  Всегда версионируйте ваши конфигурации
2.  Используйте контроллеры (Deployments, StatefulSets) вместо голых Pod'ов
3.  Устанавливайте resource requests и limits на каждый контейнер
4.  Настраивайте проверки здоровья для всех workloads
5.  Используйте последовательные, семантические метки
6.  Валидируйте конфигурации перед применением

Начните применять эти практики сегодня, и ваше будущее я (и ваша команда) скажут вам спасибо, когда отладка в 3 часа ночи станет редким явлением.

**Связанные статьи:**

* [Best Practices for Configuration](https://jamesdefabia.github.io/docs/user-guide/config-best-practices/)
* [Kubernetes Configuration Best Practices: The Ultimate Guide for 2025](https://kubezilla.io/kubernetes-configuration-best-practices-the-ultimate-guide-for-2025/)
* [17 Kubernetes Best Practices Every Developer Should Know](https://spacelift.io/blog/kubernetes-best-practices)
* [Kubernetes Production Readiness Checklist](https://www.ecloudcontrol.com/kubernetes-production-readiness-checklist/)
* [Kubernetes Security Best Practices](https://kubernetes.io/docs/concepts/security/security-checklist/)
* [Monitoring and Observability in Kubernetes](https://www.cncf.io/blog/2023/10/11/monitoring-and-observability-in-kubernetes/)
* [Kubernetes Networking Best Practices](https://kubernetes.io/docs/concepts/services-networking/)
* [Managing StatefulSets in Production](https://kubernetes.io/docs/tutorials/stateful-application/basic-stateful-set/)
* [GitOps Best Practices with ArgoCD](https://argo-cd.readthedocs.io/en/stable/user-guide/best_practices/)
* [Helm Best Practices Guide](https://helm.sh/docs/chart_best_practices/)
* [Kubernetes Cost Optimization Strategies](https://www.kubecost.com/kubernetes-best-practices/)
* [Multi-Tenancy in Kubernetes](https://kubernetes.io/docs/concepts/security/multi-tenancy/)
* [Service Mesh Comparison: Istio vs Linkerd](https://linkerd.io/2021/05/27/linkerd-vs-istio/)
* [Kubernetes Autoscaling Deep Dive](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
* [Troubleshooting Kubernetes Applications](https://kubernetes.io/docs/tasks/debug/)
