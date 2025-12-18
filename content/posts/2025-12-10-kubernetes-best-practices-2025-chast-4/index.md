---
title: "Лучшие практики конфигурирования Kubernetes в 2025 — Часть 4: Автомасштабирование, storage и планирование (42–55)"
date: 2025-12-10T13:44:00+03:00
description: "Серия заметок: лучшие практики Kubernetes в формате живой статьи. Эта часть — одна из глав; все примеры и команды сохранены."
thumbnail: "images/image.png"
tags: [sre, kubernetes]
draft: true
---

Масштабирование в Kubernetes часто начинают словами “давайте просто replicas побольше”. А заканчивают — разговорами про метрики, стабилизацию, очереди, PV, зоны доступности и почему один Pod не должен жить на единственной ноде, которая “точно надёжная”.

Часть 4 — про то, как система ведёт себя под нагрузкой и при сбоях: HPA/VPA/KEDA, storage и расширение volume, размещение по нодам/зонам (affinity/taints/spread) и контейнерные паттерны (init/sidecar/ephemeral) как практические инструменты, а не модные слова.

<a id="autoscaling"></a>

## Автомасштабирование

### 42. Настройте Horizontal Pod Autoscaler (HPA)

**Почему важно:** HPA держит сервис живым при росте нагрузки, если метрики корректные.

**Если не делать:** Либо перегруз и деградация, либо перерасход ресурсов — и оба сценария неприятны.

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

**Почему важно:** Кастомные метрики нужны, когда CPU не отражает реальную нагрузку (очереди, latency, RPS).

**Если не делать:** HPA будет масштабировать «не туда»: сервис продолжит тонуть или наоборот раздуется без смысла.

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

**Почему важно:** VPA помогает приблизить requests к реальности и снижает ручную настройку.

**Если не делать:** Будете жить с постоянным over/under-provisioning: либо OOM/эвикты, либо пустая трата денег.

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

**Почему важно:** KEDA удобна для event-driven нагрузки: очередь растёт — реплики растут.

**Если не делать:** Сервисы будут отставать от очередей или держать лишние реплики ‘на всякий случай’.

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

<a id="storage"></a>

## Лучшие практики хранилища

### 46. Используйте PersistentVolumes для stateful приложений

**Почему важно:** PV/PVC — правильная абстракция для состояния в k8s.

**Если не делать:** Stateful приложение будет терять данные или зависеть от конкретной ноды/папки (и ломаться при эвиктах).

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

**Почему важно:** StorageClasses позволяют управлять производительностью/стоимостью хранилища.

**Если не делать:** Случайно посадите БД на медленный диск или переплатите за SSD там, где это не нужно.

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

**Почему важно:** Volume expansion спасает от простоев при росте данных.

**Если не делать:** Закончится место — и сервис упадёт; расширение станет аварийной операцией вместо плановой.

```yaml
# Сначала убедитесь, что StorageClass разрешает расширение
allowVolumeExpansion: true

# Затем отредактируйте PVC для запроса большего хранилища
kubectl edit pvc mysql-pvc
# Изменить: storage: 50Gi -> storage: 100Gi
```

**Примечание:** Большинство типов volume поддерживают online расширение без перезапуска pod'а.

<a id="scheduling"></a>

## Продвинутые практики планирования

### 49. Используйте Node Affinity для размещения workloads

**Почему важно:** Node affinity — способ управлять размещением по архитектуре/типам нод/зонам.

**Если не делать:** Поды окажутся на неподходящих нодах (arm/amd, spot/ondemand), и начнутся странные сбои/нестабильность.

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

**Почему важно:** Taints/tolerations позволяют изолировать специальные ноды (GPU, maintenance, системные).

**Если не делать:** Без них критичные pod’ы могут попасть куда не надо, а maintenance начнёт «выпинывать» сервисы неожиданно.

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

**Почему важно:** TopologySpread — современный контроль распределения, часто проще и предсказуемее anti-affinity.

**Если не делать:** Реплики могут скопиться на одной ноде/в одной зоне — и отказ домена заберёт сервис целиком.

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

**Почему важно:** PriorityClass защищает критичные сервисы при нехватке ресурсов.

**Если не делать:** Во время давления на кластер ваш ‘важный’ сервис могут выселить первым — просто потому что он ‘как все’.

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

<a id="patterns"></a>

## Паттерны контейнеров и лучшие практики

### 53. Используйте Init Containers для задач настройки

**Почему важно:** Init containers отделяют подготовку/миграции/ожидания зависимостей от основного контейнера.

**Если не делать:** Приложение будет стартовать раньше зависимостей, падать в цикле и усложнять rollout (CrashLoopBackOff).

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

**Почему важно:** Sidecar — практичный паттерн для логов/метрик/прокси/ротации секретов.

**Если не делать:** Начнёте городить всё в один контейнер или зависеть от внешних костылей; сопровождение усложнится.

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

**Почему важно:** Ephemeral containers — безопасная отладка без пересборки образа.

**Если не делать:** Будете добавлять ‘debug tools’ в прод-образ (плохая идея) или дебажить вслепую по логам.

```bash
# Добавить debug контейнер к работающему pod'у
kubectl debug -it pod-name --image=busybox:1.36 --target=app

# Отладка ноды с ephemeral контейнером
kubectl debug node/node-name -it --image=ubuntu

# Скопировать pod и добавить debug инструменты
kubectl debug pod-name -it --copy-to=debug-pod --container=debug --image=nicolaka/netshoot
```
