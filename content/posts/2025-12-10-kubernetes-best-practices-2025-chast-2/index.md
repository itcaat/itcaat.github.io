---
title: "Лучшие практики конфигурирования Kubernetes в 2025 - Часть 2: Сервисы, метки, конфиги и лимиты"
date: 2025-12-17T13:42:00+03:00
description: "Сеть, метки и конфиги - это то самое место, где “мелочь” превращается в инцидент. Один неверный selector, одна неоднозначная булевка, один случайный hostNetwork - и вот вы уже убеждаете себя, что “DNS опять сломался”"
thumbnail: "images/image.png"
tags: [kubernetes]
---
 **[← В предыдущей части](/posts/2025-12-10-kubernetes-best-practices-2025-chast-1/)** мы говорили про самые основы. Пришло время поговорить про сервисы, метки, конфиги и лимиты и секреты. Ведь это те самые места, где небольшая ошибка превращается в инцидент.

![Best Practice Kubernetes](images/image.png)

<a id="services"></a>

## Services и сеть

### 17. Используйте DNS для Service Discovery

DNS даёт гибкость и устойчивость к изменениям IP/эндпойнтов. 

```yaml
# Обращайтесь к сервисам через DNS
http://my-service.my-namespace.svc.cluster.local
http://my-service.my-namespace  # Сокращённая форма
http://my-service              # В пределах того же namespace
```

### 18. Избегайте hostPort и hostNetwork

HostNetwork/hostPort ограничивают планирование и расширяют поверхность атаки. Но есть и легитимные use cases в которых это допустимо: DaemonSet мониторинга, CNI plugins, некоторые ingress контроллеры

```yaml
# ИЗБЕГАЙТЕ, если только не крайне необходимо
spec:
  hostNetwork: true
  containers:
  - name: app
    ports:
    - containerPort: 80
      hostPort: 80  # Привязывает pod к конкретной ноде
```

*   Используйте `NodePort` Services для внешнего доступа
*   Используйте `LoadBalancer` Services в облачных окружениях
*   Используйте Ingress контроллеры для HTTP трафика
*   Используйте `kubectl port-forward` для отладки

### 19. Используйте Headless Services для StatefulSet Discovery

Headless Service нужен для stateful discovery и прямых pod-to-pod связей.

**Если не делать:** StatefulSet не получит стабильные DNS-имена, а кластерные протоколы (DB/кворум) станут нестабильными.

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

**Совет:** Для тонкой настройки DNS имён можно использовать поля `subdomain` и `hostname` в pod spec.

<a id="labels"></a>

## Метки, селекторы и аннотации

### 20. Использование меток

Метки - это основа селекторов, автоматизации, биллинга и дебага.

**Если не делать:** Без них вы потеряете управляемость: сложно найти ресурсы, легко случайно удалить "лишнее", трудно строить отчёты.

Метки - это клей, который связывает ресурсы Kubernetes, но и у них есть ограничения (63 символа для value, 253+63 для key с prefix)

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
### 21. Выбор ресурсов по меткам

**Почему важно:** Метки - быстрый способ управлять группами ресурсов без ручного перечисления.

Используйте метки для выбора нужных ресурсов и устранения шума при диагностике:

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
### 22. Используйте аннотации в метаданных

**Почему важно:** Аннотации - место для служебных метаданных, интеграций и автоматизации.

Аннотации (как системные, так и пользовательские) вляются ключевым механизмом для интеграции Kubernetes с внешними системами и для хранения метаданных, необходимых для автоматизации операций. 

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
### 23. Удаляйте метки при отладке

Манипуляция метками - безопасный способ изолировать Pod от трафика для дебага:

```bash
# Изолировать pod (удалить из service endpoints)
kubectl label pod myapp-pod-xyz app-

# Pod продолжает работать, но не получает трафик
# Отладка pod'а
kubectl exec -it myapp-pod-xyz -- /bin/sh

# По завершении удалите изолированный pod
kubectl delete pod myapp-pod-xyz
```

<a id="config"></a>

## Управление ConfigMaps и Secrets

### 24. Используйте ConfigMaps для нечувствительной конфигурации

**Почему важно:** ConfigMap отделяет конфигурацию от образа и упрощает перенос между окружениями.

**Если не делать:** Начнёте вшивать конфиг в image/Deployment; любые правки потребуют ребилда и увеличат шанс ошибок.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
immutable: true  # Тут на ваше усмотрение.
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

**Преимущества immutable ConfigMaps:**

*   Предотвращает случайные изменения конфигурации
*   Лучшая производительность (kubelet не следит за изменениями)
*   Принудительный перезапуск pod'а при изменении конфига
*   Версионирование конфига вместе с развертыванием
*   Снижение нагрузки на kube-apiserver и kubelet

### 25. Безопасно работайте с Secrets

Secrets требуют дисциплины: минимизация доступа, ротация, защита от утечек.

⚠️ **КРИТИЧНО: Base64 — это НЕ шифрование!** Kubernetes Secrets по умолчанию хранятся в base64, что легко декодируется. Это лишь кодирование для передачи бинарных данных.

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
*   Реализуйте RBAC для доступа к Secrets
*   Регулярно ротируйте секреты
*   Никогда не коммитьте секреты в систему контроля версий

**Современные решения:** Для production используйте External Secrets Operator (синхронизация из Vault/AWS Secrets Manager) или Sealed Secrets (безопасное хранение зашифрованных секретов в Git).

<a id="resources"></a>

## Управление ресурсами и лимиты

### 26. Всегда устанавливайте запросы и лимиты ресурсов

Requests/limits - основа планирования, защиты от "шумных соседей", а также автоскейлинга

**Если не делать:** Без лимитов один Pod может уронить ноду; без requests планировщик будет "гадать" и начнутся эвикты/OOM.

Конфигурация ресурсов предотвращает "шумных соседей" и обеспечивает планирование. Устанавливайте `requests` близко к фактическому использованию:

```yaml
spec:
  containers:
  - name: app
    resources:
      requests: # Гарантированные ресурсы (используются для планирования)
        memory: "256Mi"
        cpu: "100m"
      limits: # Максимально разрешённые ресурсы
        memory: "512Mi"
        cpu: "500m"
```

**QoS классы (Quality of Service):**

Kubernetes автоматически назначает один из трёх QoS классов, определяющих порядок эвикции:

*   **Guaranteed** (наивысший приоритет) - когда `requests = limits` для всех ресурсов
*   **Burstable** (средний приоритет) - когда есть requests, но limits отличаются
*   **BestEffort** (низший приоритет) - когда вообще нет requests/limits

**Порядок эвикции при нехватке ресурсов:** BestEffort → Burstable → Guaranteed

⚠️ **Важно**: QoS Guaranteed **НЕ предотвращает OOMKilled**! Если контейнер превышает свой memory limit, он будет убит независимо от QoS. Guaranteed только снижает вероятность эвикции при нехватке памяти на ноде.


### 27. Используйте ResourceQuotas для лимитов namespace

ResourceQuota задаёт границы: чтобы одна команда/сервис не съел весь кластер.

**Если не делать:** Любая нагрузка/ошибка конфигурации может "выжрать" ресурсы и положить соседей.

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

LimitRange помогает ввести безопасные дефолты и стандартизировать ресурсы.

**Если не делать:** Часть Pod’ов окажется без requests/limits, QoS будет хаотичным, а инциденты - сложнее разбирать.

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

## В следующих частях

Если в этой части мы разобрались с сетью, метками, конфигами и ресурсами — то дальше будет больше про production-hardening и эксплуатацию:

**Часть 3: Безопасность, наблюдаемость и образы** — запуск не от root, Network Policies, метрики/логи/трейсы, graceful shutdown, сканирование образов и управление registry.

**Часть 4: Масштабирование и хранилище** — HPA/VPA/KEDA для автомасштабирования, PersistentVolumes и StorageClasses, размещение по нодам/зонам (affinity/taints/spread), контейнерные паттерны (init/sidecar/ephemeral).

**Часть 5: GitOps и платформа** — ArgoCD/FluxCD для управления через Git, service mesh (когда он нужен и как правильно), ingress контроллеры и TLS, RBAC, kubectl плагины и техники отладки.

**Часть 6: Финальные темы** — оптимизация стоимости, управление переменными окружения, lifecycle hooks, policy-as-code (OPA/Kyverno), backup/DR с Velero, продвинутые probes, troubleshooting типовых проблем и антипаттерны.
