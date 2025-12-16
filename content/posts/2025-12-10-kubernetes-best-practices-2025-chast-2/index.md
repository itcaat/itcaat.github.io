---
title: "Лучшие практики конфигурирования Kubernetes в 2025 — Часть 2: Сервисы, метки, конфиги и лимиты (16–28)"
date: 2025-12-10T13:42:00+03:00
description: "Серия заметок: лучшие практики Kubernetes в формате живой статьи. Эта часть — одна из глав; все примеры и команды сохранены."
thumbnail: "images/image.png"
tags: [sre, kubernetes]
draft: true
---

Сеть, метки и конфиги — это то самое место, где “мелочь” превращается в инцидент. Один неверный selector, одна неоднозначная булевка, один случайный hostNetwork — и вот вы уже убеждаете себя, что “DNS опять сломался”.

Часть 2 — про связующее: Services и сервис-дискавери, метки/аннотации как контракт между компонентами, ConfigMaps/Secrets как внешняя конфигурация и ресурсы (requests/limits/квоты), чтобы кластер не жил по принципу “кто громче — тот и прав”.

**Серия:** Часть 2 из 6. (Ссылки на остальные части можно проставить после объединения.)

### В этой части
- 16. Создавайте Services перед зависимыми Workloads
- 17. Используйте DNS для Service Discovery
- 18. Избегайте hostPort и hostNetwork
- 19. Используйте Headless Services для StatefulSet Discovery
- 20. Используйте семантические метки последовательно
- 21. Стратегии селекции по меткам
- 22. Используйте аннотации для метаданных
- 23. Отладка с использованием манипуляции метками
- 24. Используйте ConfigMaps для нечувствительной конфигурации
- 25. Безопасно работайте с Secrets
- 26. Всегда устанавливайте запросы и лимиты ресурсов
- 27. Используйте ResourceQuotas для лимитов namespace
- 28. Реализуйте LimitRanges для значений по умолчанию

### 16. Создавайте Services перед зависимыми Workloads

**Почему важно:** Service env vars инжектятся при старте Pod — порядок применения реально важен.

**Если не делать:** Pod стартанёт без нужных переменных/endpoint’ов, начнёт падать/работать в деградированном режиме.

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

**Почему важно:** DNS даёт гибкость и устойчивость к изменениям IP/эндпойнтов.

**Если не делать:** Жёсткие переменные окружения/адреса быстро устареют, а смена Service/endpoint’ов начнёт ломать приложения.

DNS более гибок, чем переменные окружения:

```yaml
# Обращайтесь к сервисам через DNS
http://my-service.my-namespace.svc.cluster.local
http://my-service.my-namespace  # Сокращённая форма
http://my-service              # В пределах того же namespace
```
### 18. Избегайте hostPort и hostNetwork

**Почему важно:** hostNetwork/hostPort ограничивают планирование и расширяют поверхность атаки.

**Если не делать:** Поды будут «не влезать» на ноды, появятся конфликты портов и риск утечек/обхода сетевой изоляции.

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

**Почему важно:** Headless Service нужен для stateful discovery и прямых pod-to-pod связей.

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

Метки, селекторы и аннотации
-----------------------------
### 20. Используйте семантические метки последовательно

**Почему важно:** Семантические метки — это основа селекторов, автоматизации, биллинга и дебага.

**Если не делать:** Без них вы потеряете управляемость: сложно найти ресурсы, легко случайно удалить «лишнее», трудно строить отчёты.

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

**Почему важно:** Селекция по меткам — быстрый способ управлять группами ресурсов без ручного перечисления.

**Если не делать:** Будете делать «kubectl get всё и глазами», что плохо масштабируется и приводит к ошибкам под нагрузкой/в инциденте.

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

**Почему важно:** Аннотации — место для служебных метаданных, интеграций и автоматизации.

**Если не делать:** Инструменты (monitoring, CI/CD, ingress) лишатся настроек; начнутся неочевидные «почему оно не скрейпится».

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

**Почему важно:** Манипуляция метками — безопасный способ изолировать Pod от трафика для дебага.

**Если не делать:** Придётся убивать Pod/дергать ingress, рискуя продом; отладка станет дороже и опаснее.

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

**Почему важно:** ConfigMap отделяет конфигурацию от образа и упрощает перенос между окружениями.

**Если не делать:** Начнёте вшивать конфиг в image/Deployment; любые правки потребуют ребилда и увеличат шанс ошибок.

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

**Почему важно:** Secrets требуют дисциплины: минимизация доступа, ротация, защита от утечек.

**Если не делать:** Секреты окажутся в репозитории/логах/describe, утекут ключи, а последствия будут финансовыми/комплаенсными.

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

**Почему важно:** Requests/limits — основа планирования и защиты от «шумных соседей».

**Если не делать:** Без лимитов один Pod может уронить ноду; без requests планировщик будет «гадать» и начнутся эвикты/OOM.

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

**Почему важно:** ResourceQuota задаёт границы: чтобы одна команда/сервис не съел весь кластер.

**Если не делать:** Любая нагрузка/ошибка конфигурации может «выжрать» ресурсы и положить соседей.

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

**Почему важно:** LimitRange помогает ввести безопасные дефолты и стандартизировать ресурсы.

**Если не делать:** Часть Pod’ов окажется без requests/limits, QoS будет хаотичным, а инциденты — сложнее разбирать.

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

