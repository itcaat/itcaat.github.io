---
title: "Лучшие практики конфигурирования Kubernetes в 2025 - Часть 1: Это база"
date: 2025-12-10T13:41:00+03:00
description: "Kubernetes обычно выглядит дружелюбным ровно до того момента, пока вы не начнёте обновлять кластер или выкатывать изменения. И вот тогда внезапно выясняется, что 'мелочи' в манифестах - не мелочи. В первой части поговорим про фундамент: версии API, Git как источник истины, YAML и базовый набор привычек для развертывания workloads без 'ну оно же вчера работало'."
thumbnail: "images/image.png"
tags: [sre, kubernetes]
---

Kubernetes обычно выглядит дружелюбным ровно до того момента, пока вы не начнёте обновлять кластер или выкатывать изменения. И вот тогда внезапно выясняется, что "мелочи" в манифестах - не мелочи. В этой серии из 6 частей я соберу лучшие практики конфигурирования Kubernetes.

![Best Practice Kubernetes](images/image.png)

В первой части будем говорить про фундамент: версии API, Git как источник истины, YAML и базовый набор привычек для развертывания workloads без “ну оно же вчера работало”. Это те вещи, которые дают самый быстрый эффект и чаще всего окупаются первым же стабильным релизом. А дальше - прикладная "эксплуатация по-взрослому": сеть/метки/конфиги и ресурсы (часть 2), безопасность+наблюдаемость+graceful shutdown+образы (часть 3), масштабирование/хранилище/планирование и контейнерные паттерны (часть 4), GitOps/mesh/ingress/RBAC и отладка (часть 5), и финально про стоимость, политики, backup/DR, probes и troubleshooting (часть 6).

<a id="fundament"></a>

## Фундамент

### 1. Всегда используйте актуальную стабильную версию API

**Почему важно:** Чтобы апдейты кластера не превращались в лотерею: deprecated API ломаются внезапно и массово.

**Если не делать:** На обновлении Kubernetes получите ошибки apply/rollout и простой, потому что ресурсы перестанут приниматься API-server’ом.

Kubernetes API быстро развиваются. Использование устаревших версий API приводит к сломанным деплойментам при обновлении кластера.

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

**Почему важно:** Git - это аудит, откат и единый источник истины. Без него конфигурация быстро превращается в "у кого на ноутбуке правильнее".

**Если не делать:** Конфиг-дрифт, невозможность воспроизвести состояние, сложный разбор инцидентов и "ручные правки на проде" без следов.

**Не применяйте манифесты напрямую с локальной машины.** Конфигурация Kubernetes должна жить в Git, а в кластер - попадать через автоматизированный процесс (CI/CD или GitOps) после ревью. Ручные изменения оставляйте только для редких аварийных случаев (break-glass) - и потом обязательно фиксируйте их в Git.

**Преимущества версионируемой конфигурации:**

*   Мгновенный откат при неудачных деплоях
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

**Почему важно:** DRY уменьшает вероятность человеческих ошибок и расхождений между окружениями.

**Если не делать:** Dev/stage/prod начнут вести себя по‑разному; правки будут забываться в одном из overlays/values и выстрелят позже.

Не повторяйтесь в разных окружениях. Используйте **Kustomize** (встроен в kubectl) или **Helm** для управления вариациями конфигурации для разных окружений.

**Пример структуры Kustomize:**

```
kubernetes/
├── base/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   └── kustomization.yaml
└── overlays/
    ├── staging/
    │   ├── kustomization.yaml
    │   ├── replica-patch.yaml
    │   └── configmap-patch.yaml
    └── production/
        ├── kustomization.yaml
        ├── replica-patch.yaml
        └── resource-limits.yaml
```

**Base конфигурация (base/deployment.yaml):**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 2  # Базовое значение, переопределяется в overlays
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp
        image: myregistry/myapp:latest
        ports:
        - containerPort: 8080
        env:
        - name: CONFIG_PATH
          value: /etc/config
```

**Base kustomization (base/kustomization.yaml):**

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - service.yaml
  - configmap.yaml
```

**Staging overlay (overlays/staging/kustomization.yaml):**

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: staging
namePrefix: staging-
commonLabels:
  environment: staging
resources:
  - ../../base
patches:
  - path: replica-patch.yaml
  - path: configmap-patch.yaml
images:
  - name: myregistry/myapp
    newTag: v1.2.0-staging
```

**Staging патч реплик (overlays/staging/replica-patch.yaml):**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 2
```

**Production overlay (overlays/production/kustomization.yaml):**

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: production
namePrefix: prod-
commonLabels:
  environment: production
resources:
  - ../../base
patches:
  - path: replica-patch.yaml
  - path: resource-limits.yaml
images:
  - name: myregistry/myapp
    newTag: v1.2.0
```

**Production патч (overlays/production/replica-patch.yaml):**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 5
```

**Production ресурсы (overlays/production/resource-limits.yaml):**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  template:
    spec:
      containers:
      - name: myapp
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 1000m
            memory: 1Gi
```

**Применение конфигурации:**

```bash
# Staging
kubectl apply -k overlays/staging/

# Production
kubectl apply -k overlays/production/

# Просмотр результата без применения
kubectl kustomize overlays/production/
```

Такой подход даёт вам единую базу и чёткие различия между окружениями в overlay'ах.
### 4. Используйте Namespaces для логического разделения

**Почему важно:** Namespaces дают изоляцию по ресурсам, доступам и политиками - это базовая гигиена multi-team кластера.

**Если не делать:** Ресурсы и права смешаются; квоты/политики будет сложно применить; случайные удаления/селекторы станут опаснее.

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

<a id="yaml-standards"></a>

## Стандарты конфигурирования YAML

### 5. Пишите конфигурацию в YAML, а не JSON

**Почему важно:** YAML читается и ревьюится людьми: комментарии, компактность, принятый стандарт экосистемы.

**Если не делать:** Поддержка и ревью усложнятся; возрастёт шанс "незаметных" ошибок и копипасты без понимания.

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

**Почему важно:** Неоднозначные булевы значения - классический источник скрытых багов парсинга.

**Если не делать:** Получите конфиг, который в одном месте трактуется как bool, в другом как string/undefined - и поведение станет непредсказуемым.

YAML имеет хитрый парсинг булевых значений. Разные версии YAML интерпретируют значения по-разному.

**Всегда используйте явные булевы значения:**

```
# ПРАВИЛЬНО - Всегда используйте true/false
enabled: true
secure: false

# ИЗБЕГАЙТЕ - Это может вызвать проблемы
enabled: yes    # Может не распарситься корректно
enabled: on     # Неоднозначно
enabled: "yes"  # Это строка, а не булево значение
```
### 7. Держите манифесты минимальными

**Почему важно:** Минимальные манифесты проще сопровождать и безопаснее менять: вы не фиксируете лишние дефолты.

**Если не делать:** Будете тащить шум в diff’ах, сложнее апгрейдиться и выше риск конфликтов при server-side apply/helm.

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

**Почему важно:** Связанные объекты удобнее деплоить атомарно и ревьюить как единый change-set.

**Если не делать:** Вы начнёте применять ресурсы "в разнобой", ловить гонки (например, Deployment без Service/ConfigMap) и неочевидные зависимости.

Если ваши Deployment, Service и ConfigMap относятся к одному приложению, поместите их в один файл, разделив через `---`. 

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: myapp-config
data:
  # ... данные конфигурации
---
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
```

**Преимущества:**

*   Проще управлять связанными ресурсами
*   Лучшая организация в системе контроля версий

Тут важно понимать, что речь про организационную атомарность (в одном файле/изменении), а не как гарантия Kubernetes “все ресурсы применились или ни один”.

<a id="workloads"></a>

## Pod и Workloads

### 9. Никогда не используйте голые Pod'ы в продакшене

**Почему важно:** Голый Pod не имеет self-healing/rolling update/масштабирования - это одноразовая граната.

**Если не делать:** При падении/эвикте Pod не восстановится как надо; деплой станет ручным; прод быстро превратится в "зоопарк" исключений.

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

### 10. Используйте Deployments для Stateless приложений

**Почему важно:** Deployment - стандартный контроллер для stateless: rollout, стратегии, откат, реплики.

**Если не делать:** Обновления станут опасными; откаты - ручными; стабильность при релизах упадёт.

Deployments - это стандарт для запуска Stateless приложений:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  annotations:
    kubernetes.io/description: "REST API for Client Traffic"
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

**Почему важно:** Job/CronJob дают правильную семантику завершения и ретраев для batch задач.

**Если не делать:** Одноразовые задачи начнут жить как сервисы, зависать, перезапускаться не так и портить данные/миграции.

Jobs идеальны для:

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
### 12. Всегда настраивайте пробы

**Почему важно:** Probes - это контракт готовности и живости. Без них балансировщик и kubelet не знают, что есть проблема.

**Если не делать:** Ловите трафик в неготовые Pod’ы, вечные рестарты, долгие деплои и инциденты "у нас всё поднялось, но не работает".

Пробы критичны для надёжности в продакшене:

**Startup Probe:** Нужно для медленно стартующих контейнеров. Kubernetes начинает проверять startupProbe. После чего включается в работу Liveness Probe и Readiness Probe.
**Liveness Probe:** Перезапускает зависшие контейнеры после failureThreshold подряд неудач
**Readiness Probe:** Чтобы сказать "контейнер запущен, но пока не готов принимать трафик". Когда readinessProbe успешна - Pod добавляется в он добавляется в Service / Endpoints / LoadBalancer.


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

<a id="deployment-strategy"></a>

## Стратегии конфигурирования Deployment

### 13. Правильно настраивайте Rolling Updates

**Почему важно:** RollingUpdate параметры определяют простои и скорость релиза.

**Если не делать:** Слишком агрессивные значения дадут деградацию/простой; слишком осторожные - затянут релиз и усложнят откат.

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

### 14. Используйте Pod Disruption Budgets (PDB)

**Почему важно:** PDB защищает от одновременного выноса всех реплик при дренажах/апгрейдах. Он как бы говорит Kubernetes: "во время плановых операций должно оставаться минимум N рабочих Pod’ов". PDB учитывается при: kubectl drain, node maintenance, cluster autoscaler (scale down), ручном удалении Pod’ов, rolling update Deployment’ов

**Если не делать:** Во время обслуживания можно случайно "выключить" сервис целиком, даже если реплик много.

PDB защищают ваше приложение во время плановых обслуживаний (дренаж нод, обновления кластера):

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

**Почему важно:** Anti-affinity/распределение - это страховка от отказа одной ноды/зоны.

**Если не делать:** Одна нода/зона упала - и вместе с ней упали все реплики, потому что они жили рядом.

Распределяйте pod'ы по нодам и зонам для выживания при отказах:

```yaml
spec:
  affinity:
    # Старайся не размещать поды рядом с другими подами с такими-то лейблами.
    podAntiAffinity:
      # Это soft-правило. scheduler постарается выполнить его но может нарушить, если нет подходящих нод (в отличие от requiredDuringSchedulingIgnoredDuringExecution, которое жёсткое).
      preferredDuringSchedulingIgnoredDuringExecution:
      # Стараться не размещать их на той же ноде потому что topologyKey: kubernetes.io/hostname. weight 100 - Scheduler очень сильно предпочитает разнести поды по разным нодам. Один api-server → одна нода (если возможно).
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchLabels:
              app: api-server
          topologyKey: kubernetes.io/hostname
      # Это значит те же поды app=api-server Scheduler-у желательно распределить их по разным availability zone если кластер мультизональный.
      - weight: 50
        podAffinityTerm:
          labelSelector:
            matchLabels:
              app: api-server
          topologyKey: topology.kubernetes.io/zone
```

По сути это подсказки планировщику Kubernetes, как лучше распределять поды , чтобы повысить отказоустойчивость. 

## Что дальше в серии

Если в этой части мы собрали базу (чтобы деплой не был "приключением"), то дальше будет больше практики про эксплуатацию:

- **Часть 2**: сервисы и сеть, метки/аннотации, ConfigMaps/Secrets, requests/limits и квоты - всё, что делает кластер управляемым, а не “оно как-то само”.
- **Часть 3**: безопасность + наблюдаемость + graceful shutdown + образы - чтобы инциденты хотя бы было чем диагностировать и как переживать.
- **Часть 4**: autoscaling, storage и размещение по нодам/зонам, плюс контейнерные паттерны (init/sidecar/ephemeral) - чтобы нагрузка и сбои не превращались в хаос.
- **Часть 5**: GitOps/service mesh/ingress/RBAC и отладка - про то, как жить с кластером каждый день, а не только “выкатить и забыть”.
- **Часть 6**: стоимость, политики, backup/DR, продвинутые probes и troubleshooting - финальные "страховки", которые спасают время, деньги и нервы.

