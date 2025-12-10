---
title: "Kubernetes Configuration Best Practices: The Ultimate Guide for 2025 – Kubezilla"
date: 2025-05-20T13:39:35+03:00
description: "Лучшие практики куба в 2025 году"
tags: [sre]
---

# Introduction: Why Configuration Matters in Kubernetes

Configuration is the backbone of every Kubernetes deployment. A single misplaced YAML indent, an incorrect API version, or a missing label selector can bring your entire application down. According to recent DevOps surveys, **over 60% of Kubernetes incidents are caused by misconfiguration**.

This comprehensive guide brings together production-tested Kubernetes configuration best practices. Whether you’re a beginner deploying your first containerized application or an experienced platform engineer managing enterprise clusters, these practices will help you build more reliable, maintainable, and secure Kubernetes deployments.

**What you’ll learn:**

*   How to write clean, maintainable Kubernetes YAML files
*   Best practices for Pods, Deployments, Services, and other workloads
*   Strategies for managing configuration across environments
*   Security hardening through proper configuration
*   Time-saving kubectl commands and tools

General Kubernetes Configuration Best Practices
-----------------------------------------------

### 1. Always Use the Latest Stable API Version

Kubernetes APIs evolve rapidly. Using deprecated API versions leads to broken deployments when you upgrade your cluster.

**Always check available API versions:**

```bash
kubectl api-resources
kubectl api-versions
```

**Pro tip:** Use tools like `kubent` (Kube No Trouble) to detect deprecated APIs in your manifests before upgrading:

```bash
kubent --helm3 --exit-error
```

### 2. Store All Configuration in Version Control

**Never apply manifests directly from your local machine.** Every Kubernetes configuration file should live in Git (or another version control system).

**Benefits of version-controlled configuration:**

*   Instant rollback capability when deployments fail
*   Complete audit trail of who changed what and when
*   Easy collaboration and code review processes
*   Reproducible cluster setups across environments

**Recommended folder structure:**

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

### 3. Keep Configuration DRY with Kustomize or Helm

Don’t repeat yourself across environments. Use **Kustomize** (built into kubectl) or **Helm** to manage environment-specific variations.

**Kustomize example:**

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


### 4. Use Namespaces for Logical Separation

Namespaces provide logical boundaries within your cluster. Use them to:

*   Separate environments (dev, staging, prod)
*   Isolate teams or projects
*   Apply resource quotas and network policies

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    environment: production
    team: platform
```

YAML Configuration Standards
----------------------------

### 5. Write Configs in YAML, Not JSON

While Kubernetes accepts both YAML and JSON, **YAML is the community standard**. It’s more readable, supports comments, and is easier to maintain.

**YAML best practices:**

```yaml
# Good: Clean, readable YAML
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

### 6. Handle YAML Boolean Values Correctly

YAML has tricky boolean parsing. Different YAML versions interpret values differently.

**Always use explicit boolean values:**

```
# ✅ CORRECT - Always use true/false
enabled: true
secure: false

# ❌ AVOID - These can cause issues
enabled: yes    # May not parse correctly
enabled: on     # Ambiguous
enabled: "yes"  # This is a string, not boolean
```

### 7. Keep Manifests Minimal

Don’t set values that Kubernetes handles by default. Minimal manifests are:

*   Easier to read and review
*   Less prone to errors
*   Simpler to maintain

**Example of a minimal Deployment:**

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

### 8. Group Related Objects in Single Files

If your Deployment, Service, and ConfigMap belong to one application, put them in a single file separated by `---`.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  # ... deployment spec
---
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  # ... service spec
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: myapp-config
data:
  # ... configuration data
```


**Benefits:**

*   Atomic deployments (all or nothing)
*   Easier to manage related resources
*   Better organization in version control

Pod and Workload Configuration Best Practices
---------------------------------------------

### 9. Never Use Naked Pods in Production

**Naked Pods** (Pods not managed by a controller) are dangerous in production because:

*   They don’t reschedule if a node fails
*   They don’t scale automatically
*   They lack rolling update capabilities

**Always use controllers:**

|Use Case          |Controller |
|------------------|-----------|
|Long-running apps |Deployment |
|Stateful apps     |StatefulSet|
|Node-level daemons|DaemonSet  |
|Batch processing  |Job        |
|Scheduled tasks   |CronJob    |

### 10. Use Deployments for Stateless Applications

Deployments are the standard for running stateless applications:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  annotations:
    kubernetes.io/description: "REST API server for customer data"
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

### 11. Use Jobs for One-Time Tasks

Jobs are perfect for:

*   Database migrations
*   Batch processing
*   Data imports/exports

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


### 12. Always Configure Health Checks

Health checks are critical for production reliability:

**Liveness Probe:** Restarts containers that are stuck **Readiness Probe:** Removes pods from service endpoints until ready **Startup Probe:** Handles slow-starting containers

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

Deployment Configuration Strategies
-----------------------------------

### 13. Configure Rolling Updates Properly

Rolling updates minimize downtime by gradually replacing old pods with new ones:

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%        # Max extra pods during update
      maxUnavailable: 0    # Zero downtime requirement
```


**Key settings explained:**

*   `maxSurge`: How many extra pods can exist during rollout
*   `maxUnavailable`: How many pods can be unavailable during rollout

**For zero-downtime deployments:**

```yaml
maxSurge: 1
maxUnavailable: 0
```


### 14. Use Pod Disruption Budgets (PDBs)

PDBs protect your application during voluntary disruptions (node drains, cluster upgrades):

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-pdb
spec:
  minAvailable: 2    # Or use maxUnavailable
  selector:
    matchLabels:
      app: api-server
```

### 15. Implement Pod Anti-Affinity for High Availability

Spread pods across nodes and zones to survive failures:

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

Service and Networking Configuration
------------------------------------

### 16. Create Services Before Dependent Workloads

Kubernetes injects Service environment variables into Pods at startup. Create Services first to ensure environment variables are available:

```yaml
# Deploy in this order:
kubectl apply -f configmap.yaml
kubectl apply -f service.yaml
kubectl apply -f deployment.yaml
```


**Environment variable format:**

```yaml
# For a Service named "database"
DATABASE_SERVICE_HOST=10.96.0.10
DATABASE_SERVICE_PORT=5432
```


### 17. Use DNS for Service Discovery

DNS is more flexible than environment variables:

```yaml
# Access services via DNS
http://my-service.my-namespace.svc.cluster.local
http://my-service.my-namespace  # Shortened form
http://my-service              # Within same namespace
```

### 18. Avoid hostPort and hostNetwork

These options limit scheduling and create security risks:

```yaml
# ❌ AVOID unless absolutely necessary
spec:
  hostNetwork: true
  containers:
  - name: app
    ports:
    - containerPort: 80
      hostPort: 80  # Ties pod to specific node
```

**Better alternatives:**

*   Use `NodePort` Services for external access
*   Use `LoadBalancer` Services in cloud environments
*   Use Ingress controllers for HTTP traffic
*   Use `kubectl port-forward` for debugging

### 19. Use Headless Services for StatefulSet Discovery

For direct pod-to-pod communication:

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

This enables DNS records like:

```
mysql-0.mysql.default.svc.cluster.local
mysql-1.mysql.default.svc.cluster.local
```

Labels, Selectors, and Annotations
----------------------------------

### 20. Use Semantic Labels Consistently

Labels are the glue that connects Kubernetes resources:

```yaml
metadata:
  labels:
    # Recommended Kubernetes labels
    app.kubernetes.io/name: web-app
    app.kubernetes.io/instance: web-app-prod
    app.kubernetes.io/version: "2.1.0"
    app.kubernetes.io/component: frontend
    app.kubernetes.io/part-of: ecommerce
    app.kubernetes.io/managed-by: helm
    
    # Custom organizational labels
    team: platform
    environment: production
    cost-center: cc-123
```

### 21. Label Selection Strategies

Use labels for powerful resource selection:

```bash
# Get all frontend pods
kubectl get pods -l app.kubernetes.io/component=frontend

# Get all production resources
kubectl get all -l environment=production

# Delete all test resources
kubectl delete all -l environment=test

# Combine selectors
kubectl get pods -l 'app=web,environment in (staging,production)'
```

### 22. Use Annotations for Metadata

Annotations store non-identifying information:

```yaml
metadata:
  annotations:
    kubernetes.io/description: "Main API server handling customer requests"
    prometheus.io/scrape: "true"
    prometheus.io/port: "8080"
    deployment.kubernetes.io/revision: "3"
    kubectl.kubernetes.io/last-applied-configuration: |
      {...}
```


### 23. Debug Using Label Manipulation

Temporarily remove pods from services for debugging:

```bash
# Quarantine a pod (remove from service endpoints)
kubectl label pod myapp-pod-xyz app-

# The pod continues running but receives no traffic
# Debug the pod
kubectl exec -it myapp-pod-xyz -- /bin/sh

# When done, delete the isolated pod
kubectl delete pod myapp-pod-xyz
```

ConfigMaps and Secrets Management
---------------------------------

### 24. Use ConfigMaps for Non-Sensitive Configuration

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  # Simple key-value pairs
  LOG_LEVEL: "info"
  MAX_CONNECTIONS: "100"
  
  # Entire configuration files
  config.yaml: |
    server:
      port: 8080
      timeout: 30s
    features:
      enable_cache: true
```

**Consume in pods:**

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


### 25. Handle Secrets Securely

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
type: Opaque
stringData:  # Use stringData for plain text input
  username: admin
  password: supersecret123
```


**Security recommendations:**

*   Enable encryption at rest for etcd
*   Use external secret managers (Vault, AWS Secrets Manager)
*   Implement RBAC for Secret access
*   Rotate secrets regularly
*   Never commit secrets to version control

Resource Management and Limits
------------------------------

### 26. Always Set Resource Requests and Limits

Resource configuration prevents noisy neighbors and ensures scheduling:

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

**Guidelines:**

*   `requests`: Guaranteed resources (used for scheduling)
*   `limits`: Maximum allowed resources
*   Set `requests` close to actual usage
*   Set memory `limit` = `request` to prevent OOMKilled issues
*   CPU limits can be 2-4x requests for burst capacity

### 27. Use ResourceQuotas for Namespace Limits

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


### 28. Implement LimitRanges for Defaults

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

Security Configuration Best Practices
-------------------------------------

### 29. Run Containers as Non-Root

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

### 30. Use Network Policies

Restrict pod-to-pod communication:

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

### 31. Use Pod Security Standards

Apply security standards at the namespace level:

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

Observability and Monitoring
----------------------------

### 32. Configure Prometheus Metrics Scraping

Enable automatic metrics collection with proper annotations:

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

**Best practices:**

* Expose metrics on a dedicated port
* Use standard metric naming conventions (counter, gauge, histogram)
* Include application-specific labels
* Monitor both application and infrastructure metrics

### 33. Implement Structured Logging

Use JSON logging for better parsing and querying:

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

**Example structured log:**

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

### 34. Enable Distributed Tracing

Add OpenTelemetry for request tracing:

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
      value: "0.1"  # Sample 10% of traces
```

Graceful Shutdown and Lifecycle Management
------------------------------------------

### 35. Configure Proper Termination Grace Period

```yaml
spec:
  terminationGracePeriodSeconds: 60  # Default is 30
  containers:
  - name: app
    lifecycle:
      preStop:
        exec:
          command:
          - /bin/sh
          - -c
          - |
            # Wait for load balancer to remove pod from rotation
            sleep 5
            # Gracefully shutdown application
            kill -SIGTERM 1
            # Wait for connections to drain
            wait
```

**Why this matters:**

1. Kubernetes sends SIGTERM to containers
2. preStop hook runs first (blocking)
3. After hook completes, SIGTERM is sent
4. After grace period, SIGKILL is sent

### 36. Handle SIGTERM Properly in Your Application

**Example for Go application:**

```go
// Handle graceful shutdown
sigChan := make(chan os.Signal, 1)
signal.Notify(sigChan, syscall.SIGTERM)

go func() {
    <-sigChan
    log.Println("Received SIGTERM, shutting down gracefully...")
    
    // Stop accepting new requests
    server.SetKeepAlivesEnabled(false)
    
    // Give existing requests time to complete
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    server.Shutdown(ctx)
}()
```

### 37. Implement Connection Draining

For services behind load balancers:

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

**Shutdown endpoint should:**

* Return 503 Service Unavailable
* Fail readiness probe
* Wait for existing connections to complete
* Then exit cleanly

Image Management Best Practices
--------------------------------

### 38. Use Image Digests for Production

**Bad:**

```yaml
image: nginx:1.25
```

**Good:**

```yaml
image: nginx@sha256:4c0fdaa8b6341bfdeca5f18f7837462c80cff90527ee35ef185571e1c327beac
```

**Why:** Tags are mutable, digests are immutable and guarantee exact image versions.

### 39. Configure imagePullPolicy Correctly

```yaml
spec:
  containers:
  - name: app
    image: myregistry/app:v1.0.0
    imagePullPolicy: IfNotPresent  # or Always
```

**Guidelines:**

| Image Tag | Recommended Policy | Reason |
|-----------|-------------------|--------|
| `:latest` | Always | Tag changes frequently |
| `:v1.0.0` | IfNotPresent | Immutable tag |
| `@sha256:...` | IfNotPresent | Immutable digest |
| Development | Always | Rapid iteration |

### 40. Use Private Registry Authentication

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

### 41. Scan Images for Vulnerabilities

Integrate security scanning in CI/CD:

```bash
# Scan with Trivy
trivy image myregistry/app:v1.0.0

# Block deployment if critical vulnerabilities found
trivy image --severity HIGH,CRITICAL --exit-code 1 myregistry/app:v1.0.0
```

Autoscaling Strategies
----------------------

### 42. Configure Horizontal Pod Autoscaler (HPA)

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

### 43. Use Custom Metrics for HPA

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
        averageValue: "30"  # Scale when queue > 30 messages per pod
```

### 44. Consider Vertical Pod Autoscaler (VPA)

VPA automatically adjusts CPU and memory requests:

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
    updateMode: "Auto"  # or "Recreate" or "Off"
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

**Warning:** Don't use HPA and VPA on the same metric (CPU/memory) together.

### 45. Use KEDA for Event-Driven Autoscaling

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
      listLength: "5"  # Scale up when queue > 5 items per pod
```

Storage Best Practices
----------------------

### 46. Use PersistentVolumes for Stateful Applications

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

### 47. Define StorageClasses for Different Performance Tiers

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

### 48. Enable Volume Expansion

```yaml
# First, ensure StorageClass allows expansion
allowVolumeExpansion: true

# Then edit PVC to request more storage
kubectl edit pvc mysql-pvc
# Change: storage: 50Gi -> storage: 100Gi
```

**Note:** Most volume types support online expansion without pod restart.

Advanced Scheduling Best Practices
-----------------------------------

### 49. Use Node Affinity for Workload Placement

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

### 50. Implement Taints and Tolerations

**Taint nodes:**

```bash
# Taint node for GPU workloads
kubectl taint nodes gpu-node-1 workload=gpu:NoSchedule

# Taint node for maintenance
kubectl taint nodes node-2 maintenance=true:NoExecute
```

**Add tolerations to pods:**

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
    tolerationSeconds: 300  # Evict after 5 minutes
```

### 51. Use Topology Spread Constraints (Modern Alternative)

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

**Benefits over anti-affinity:**

* More fine-grained control
* Better for large deployments
* Prevents zone imbalance

### 52. Use Priority Classes for Critical Workloads

```yaml
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: high-priority
value: 1000000
globalDefault: false
description: "Critical system workloads"
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

**Priority values:**

* System critical: 2000000000+
* Business critical: 1000000
* Normal: 0 (default)
* Batch/background: -1000

Container Patterns and Best Practices
--------------------------------------

### 53. Use Init Containers for Setup Tasks

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
        echo "Waiting for database..."
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

**Use cases:**

* Wait for dependencies
* Run database migrations
* Download configuration files
* Populate shared volumes

### 54. Implement Sidecar Pattern

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

**Common sidecar use cases:**

* Log aggregation (Fluent Bit, Filebeat)
* Metrics collection
* Service mesh proxies (Envoy)
* Secret rotation
* Configuration reloading

### 55. Use Ephemeral Containers for Debugging

```bash
# Add debug container to running pod
kubectl debug -it pod-name --image=busybox:1.36 --target=app

# Debug node with ephemeral container
kubectl debug node/node-name -it --image=ubuntu

# Copy pod and add debug tools
kubectl debug pod-name -it --copy-to=debug-pod --container=debug --image=nicolaka/netshoot
```

GitOps and Configuration Management
------------------------------------

### 56. Implement GitOps with ArgoCD

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

**GitOps benefits:**

* Single source of truth in Git
* Automatic drift detection
* Easy rollbacks via Git revert
* Audit trail through Git history

### 57. Use FluxCD for Progressive Delivery

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

Service Mesh Integration
------------------------

### 58. When to Use a Service Mesh

**Use service mesh when you need:**

* Mutual TLS between all services
* Advanced traffic management (canary, A/B testing)
* Distributed tracing without code changes
* Circuit breaking and retries
* Fine-grained access control

**Don't use service mesh if:**

* You have < 20 microservices
* Simple ingress routing is sufficient
* Team lacks service mesh expertise
* Performance overhead is unacceptable

### 59. Configure Istio Virtual Service

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

### 60. Enable mTLS with Istio

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

Ingress Controllers and External Access
----------------------------------------

### 61. Configure Nginx Ingress Controller

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

### 62. Automatic TLS with cert-manager

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

### 63. Rate Limiting and DDoS Protection

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

RBAC and Service Accounts
--------------------------

### 64. Follow Principle of Least Privilege

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
      automountServiceAccountToken: false  # Only mount if needed
```

### 65. Disable Default Service Account Auto-mounting

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: default
  namespace: production
automountServiceAccountToken: false
```

**Why:** Pods don't need Kubernetes API access by default - reduces attack surface.

### 66. Enable Audit Logging

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

Quality of Service (QoS) Classes
---------------------------------

### 67. Understand QoS Classes

**Guaranteed (highest priority):**

```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "500m"
  limits:
    memory: "256Mi"  # Must equal request
    cpu: "500m"      # Must equal request
```

**Burstable (medium priority):**

```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "100m"
  limits:
    memory: "512Mi"  # Different from request
    cpu: "500m"
```

**BestEffort (lowest priority):**

```yaml
# No requests or limits defined
```

**Eviction order during node pressure:** BestEffort → Burstable → Guaranteed

kubectl Tips for Configuration Management
-----------------------------------------

### 68. Apply Entire Directories

```bash
# Apply all manifests in a directory
kubectl apply -f ./kubernetes/ --recursive

# Use server-side apply for better conflict handling
kubectl apply -f ./kubernetes/ --server-side

# Preview changes before applying
kubectl diff -f ./kubernetes/
```


### 69. Generate Manifests from Running Resources

```bash
# Export running deployment as YAML
kubectl get deployment nginx -o yaml > nginx-deployment.yaml

# Create deployment imperatively, then export
kubectl create deployment nginx --image=nginx --dry-run=client -o yaml > deployment.yaml

```


### 70. Validate Configurations Before Applying

```bash
# Dry-run validation
kubectl apply -f deployment.yaml --dry-run=server

# Client-side validation
kubectl apply -f deployment.yaml --dry-run=client

# Validate with kubeval
kubeval deployment.yaml

# Validate with kubeconform (faster)
kubeconform -strict deployment.yaml
```

Modern Debugging Techniques
---------------------------

### 71. Use kubectl debug with Ephemeral Containers

```bash
# Debug running pod by adding debug container
kubectl debug -it api-pod-xyz \
  --image=nicolaka/netshoot \
  --target=api \
  --share-processes

# Inside the debug container, you can:
# - Inspect network (netstat, tcpdump)
# - Check processes (ps, top)
# - Test connectivity (curl, ping)
# - Analyze file system

# Debug node directly
kubectl debug node/worker-node-1 -it --image=ubuntu

# Create debug copy of pod with different image
kubectl debug api-pod-xyz -it \
  --copy-to=debug-api \
  --container=api \
  --image=myapp:debug-version
```

### 72. Stream Logs from Multiple Pods

```bash
# Install stern for advanced log streaming
brew install stern

# Watch logs from all pods with label
stern -l app=api-server

# Include timestamps and pod names
stern -l app=api-server -t --tail 50

# Filter logs with grep
stern api-server --exclude-container=istio-proxy | grep ERROR

# Multiple namespaces
stern api-server --all-namespaces
```

### 73. Interactive Debugging Techniques

```bash
# Port forward for local testing
kubectl port-forward svc/api-server 8080:80

# Execute commands in running pod
kubectl exec -it pod-name -- /bin/bash

# Copy files from/to pod
kubectl cp pod-name:/var/log/app.log ./app.log
kubectl cp ./config.yaml pod-name:/etc/config/

# Check events for debugging
kubectl get events --sort-by='.lastTimestamp' -A

# Describe resource for detailed info
kubectl describe pod api-pod-xyz

# Check resource consumption
kubectl top pods
kubectl top nodes
```

### 74. Use stern and kubectl plugins

```bash
# Install kubectl plugins
kubectl krew install tail
kubectl krew install debug-shell
kubectl krew install resource-capacity

# Use resource-capacity to analyze cluster
kubectl resource-capacity --pods --util

# Advanced pod filtering
kubectl get pods --field-selector status.phase=Running
kubectl get pods --field-selector spec.nodeName=node-1
```

Cost Optimization Best Practices
---------------------------------

### 75. Right-Size Your Workloads

```bash
# Analyze actual resource usage
kubectl top pods -n production

# Use VPA in recommendation mode
kubectl get vpa api-server-vpa -o yaml

# Compare requests vs actual usage
kubectl get pods -o custom-columns=\
NAME:.metadata.name,\
CPU_REQ:.spec.containers[0].resources.requests.cpu,\
MEM_REQ:.spec.containers[0].resources.requests.memory
```

**Right-sizing strategy:**

```yaml
# Start with baseline
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "200m"

# Monitor for 1-2 weeks, then adjust based on:
# - P95 memory usage + 20% buffer
# - P95 CPU usage for requests
# - P99 CPU usage for limits
```

### 76. Use Spot/Preemptible Instances

```yaml
# Node affinity for spot instances
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

**Best for:**

* Stateless workloads
* Batch processing
* CI/CD runners
* Development environments

### 77. Implement Cluster Autoscaling

```yaml
# AWS Cluster Autoscaler configuration
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

### 78. Monitor and Alert on Cost Anomalies

```yaml
# Example Prometheus alert for high resource usage
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
          summary: "Pod {{ $labels.pod }} using < 30% of requested CPU"
      
      - alert: HighMemoryWaste
        expr: |
          (sum(container_memory_working_set_bytes) by (namespace, pod) /
           sum(kube_pod_container_resource_requests{resource="memory"}) by (namespace, pod)) < 0.5
        for: 1h
        annotations:
          summary: "Pod {{ $labels.pod }} using < 50% of requested memory"
```

Environment Variables Best Practices
-------------------------------------

### 79. Understand Environment Variable Precedence

```yaml
spec:
  containers:
  - name: app
    # Priority 3: Individual env vars (highest priority)
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
    
    # Priority 2: ConfigMap as envFrom
    envFrom:
    - configMapRef:
        name: app-config
    
    # Priority 1: Secret as envFrom (lowest priority)
    - secretRef:
        name: app-secrets
```

**Order of precedence:** `env` > `envFrom` (ConfigMap) > `envFrom` (Secret)

### 80. Use Immutable ConfigMaps and Secrets

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

**Benefits:**

* Prevents accidental changes
* Better performance (kubelet doesn't watch for changes)
* Forces pod restart on config change
* Version config with deployment

### 81. Trigger Pod Restart on ConfigMap Changes

```yaml
# Add checksum annotation to force restart on config change
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

**Or use Reloader:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  annotations:
    reloader.stakater.com/auto: "true"
```

Lifecycle Hooks Deep Dive
--------------------------

### 82. Use postStart Hooks for Initialization

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
            # Wait for application to be ready
            until curl -f http://localhost:8080/health; do
              sleep 1
            done
            
            # Register with external service
            curl -X POST http://registry/register \
              -d "instance=$HOSTNAME"
```

**Use cases:**

* Register service with external system
* Warm up application caches
* Download initial data
* Configure runtime settings

### 83. Advanced preStop Hook Patterns

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
            # 1. Deregister from load balancer
            curl -X DELETE http://lb/deregister/$HOSTNAME
            
            # 2. Wait for LB to remove instance (5s)
            sleep 5
            
            # 3. Signal application to stop accepting new requests
            kill -USR1 1
            
            # 4. Wait for in-flight requests to complete
            while [ $(netstat -an | grep ESTABLISHED | wc -l) -gt 0 ]; do
              sleep 1
            done
            
            # 5. Flush metrics/logs
            curl -X POST http://localhost:9090/flush
```

### 84. Combine Hooks with Probes

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
      failureThreshold: 1  # Remove from endpoints quickly
    
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

**Shutdown sequence:**

1. preStop hook starts (calls `/shutdown`)
2. Application returns 503 on `/ready` probe
3. Kubernetes removes pod from endpoints (~5-10s)
4. Application drains connections
5. SIGTERM sent after preStop completes
6. Application exits gracefully

Admission Controllers and Policy Enforcement
---------------------------------------------

### 85. Use OPA Gatekeeper for Policy Enforcement

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
          msg := sprintf("Missing required labels: %v", [missing])
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

### 86. Implement Validating Webhooks

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

### 87. Use Mutating Webhooks for Auto-Configuration

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

**Common mutation use cases:**

* Inject sidecar containers
* Add default labels/annotations
* Set security contexts
* Configure resource limits
* Add init containers

Backup and Disaster Recovery
-----------------------------

### 88. Implement Velero for Cluster Backups

```bash
# Install Velero
velero install \
  --provider aws \
  --bucket kubernetes-backups \
  --backup-location-config region=us-east-1 \
  --snapshot-location-config region=us-east-1 \
  --secret-file ./credentials-velero

# Create backup schedule
velero schedule create daily-backup \
  --schedule="0 2 * * *" \
  --include-namespaces production,staging \
  --ttl 720h
```

**Velero backup resource:**

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

### 89. Backup etcd Snapshots

```bash
# Take etcd snapshot
ETCDCTL_API=3 etcdctl snapshot save snapshot.db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# Verify snapshot
ETCDCTL_API=3 etcdctl snapshot status snapshot.db -w table

# Restore from snapshot
ETCDCTL_API=3 etcdctl snapshot restore snapshot.db \
  --data-dir=/var/lib/etcd-restore
```

### 90. Create Disaster Recovery Runbook

```yaml
# disaster-recovery-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: dr-runbook
  namespace: kube-system
data:
  runbook.md: |
    # Disaster Recovery Procedures
    
    ## Scenario 1: Lost Control Plane
    1. Restore etcd from latest backup
    2. Verify API server connectivity
    3. Check node status
    4. Validate workload health
    
    ## Scenario 2: Corrupted Namespace
    1. List available backups: `velero backup get`
    2. Restore namespace: `velero restore create --from-backup production-backup`
    3. Verify restored resources
    
    ## Scenario 3: Bad Deployment
    1. Rollback deployment: `kubectl rollout undo deployment/app`
    2. Check rollout status: `kubectl rollout status deployment/app`
    3. Verify application health
    
    ## RTO and RPO
    - RTO (Recovery Time Objective): 1 hour
    - RPO (Recovery Point Objective): 24 hours
```

### 91. Test Disaster Recovery Regularly

```bash
# Automated DR test script
#!/bin/bash

# Create test namespace
kubectl create namespace dr-test

# Deploy test application
kubectl apply -f test-app.yaml -n dr-test

# Create backup
velero backup create dr-test-backup --include-namespaces dr-test --wait

# Delete namespace
kubectl delete namespace dr-test

# Wait and verify deletion
sleep 30

# Restore from backup
velero restore create dr-test-restore --from-backup dr-test-backup --wait

# Verify restoration
kubectl get all -n dr-test

# Cleanup
velero backup delete dr-test-backup --confirm
kubectl delete namespace dr-test
```

Enhanced Health Checks
----------------------

### 92. Configure Health Checks for Different Application Types

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

**gRPC Application:**

```yaml
livenessProbe:
  grpc:
    port: 9090
    service: health.v1.Health  # Optional
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

**Command Execution:**

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

### 93. Implement Startup Probes for Slow Applications

```yaml
spec:
  containers:
  - name: slow-app
    startupProbe:
      httpGet:
        path: /healthz
        port: 8080
      failureThreshold: 30  # 30 * 10s = 5 minutes max startup
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

**Why use startup probes:**

* Prevents premature liveness probe failures during startup
* Allows longer initialization time without affecting runtime checks
* Better for applications with slow initialization (ML models, large caches)

### 94. Health Check Best Practices

```yaml
# Bad: Checking external dependencies in liveness
livenessProbe:
  httpGet:
    path: /health  # This checks database, redis, etc.
  failureThreshold: 1  # Too aggressive

# Good: Separate concerns
livenessProbe:
  httpGet:
    path: /alive  # Only checks if process is alive
  periodSeconds: 10
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /ready  # Checks dependencies and readiness
  periodSeconds: 5
  failureThreshold: 2
  successThreshold: 1
```

**Health endpoint implementation guidance:**

```go
// /alive - Liveness probe (fast, simple)
func alive(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
    w.Write([]byte("OK"))
}

// /ready - Readiness probe (comprehensive)
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

Troubleshooting Common Issues
------------------------------

### 95. ImagePullBackOff Errors

```bash
# Check image pull status
kubectl describe pod pod-name | grep -A 10 Events

# Common causes:
# 1. Image doesn't exist
docker pull myregistry/app:v1.0.0

# 2. Authentication issues
kubectl get secret registry-credentials -o yaml

# 3. Rate limiting (Docker Hub)
kubectl describe pod pod-name | grep "rate limit"

# Solutions:
# - Use imagePullSecrets
# - Switch to private registry
# - Use image mirror/cache
```

### 96. CrashLoopBackOff Debug Strategy

```bash
# Get recent logs
kubectl logs pod-name --previous

# Check exit code
kubectl get pod pod-name -o jsonpath='{.status.containerStatuses[0].lastState.terminated}'

# Common exit codes:
# 0: Normal exit
# 1: Application error
# 137: SIGKILL (OOMKilled)
# 143: SIGTERM (Graceful shutdown)

# Debug with ephemeral container
kubectl debug -it pod-name --image=busybox --target=app

# Check resource limits
kubectl describe pod pod-name | grep -A 5 Limits
```

### 97. Pending Pods - Scheduling Issues

```bash
# Check why pod is pending
kubectl describe pod pod-name

# Common reasons:
# 1. Insufficient resources
kubectl describe nodes | grep -A 5 "Allocated resources"

# 2. Node selector mismatch
kubectl get nodes --show-labels
kubectl get pod pod-name -o yaml | grep -A 5 nodeSelector

# 3. Taints and tolerations
kubectl describe node node-name | grep Taints
kubectl get pod pod-name -o yaml | grep -A 5 tolerations

# 4. Pod affinity/anti-affinity
kubectl get pod pod-name -o yaml | grep -A 10 affinity

# 5. PVC not bound
kubectl get pvc
```

### 98. Service Connection Issues

```bash
# Test service connectivity
kubectl run test-pod --rm -it --image=nicolaka/netshoot -- /bin/bash

# Inside pod:
nslookup my-service.my-namespace.svc.cluster.local
curl http://my-service:80

# Check service endpoints
kubectl get endpoints my-service

# Verify pod labels match service selector
kubectl get pod pod-name --show-labels
kubectl get service my-service -o yaml | grep -A 5 selector

# Check network policies
kubectl get networkpolicy -A
kubectl describe networkpolicy my-policy
```

### 99. High Memory Usage / OOMKilled

```bash
# Check memory usage
kubectl top pod pod-name

# Get OOM information
kubectl describe pod pod-name | grep -i oom

# Check memory limits
kubectl get pod pod-name -o jsonpath='{.spec.containers[*].resources}'

# Solutions:
# 1. Increase memory limits
# 2. Fix memory leaks in application
# 3. Use VPA for right-sizing
# 4. Enable memory profiling

# View memory metrics
kubectl top pod pod-name --containers
```

### 100. DNS Resolution Issues

```bash
# Test DNS from pod
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup kubernetes.default

# Check CoreDNS pods
kubectl get pods -n kube-system -l k8s-app=kube-dns

# View CoreDNS logs
kubectl logs -n kube-system -l k8s-app=kube-dns --tail=100

# Check CoreDNS config
kubectl get configmap coredns -n kube-system -o yaml

# Common fixes:
# 1. Restart CoreDNS
kubectl rollout restart deployment coredns -n kube-system

# 2. Check node DNS settings
kubectl get nodes -o wide
```

Anti-Patterns to Avoid
-----------------------

### 101. Common Kubernetes Anti-Patterns

**❌ Running Databases in Kubernetes (Without Expertise)**

```yaml
# Don't do this for production databases unless you have:
# - Deep Kubernetes expertise
# - Proper backup/restore procedures
# - StatefulSet with persistent volumes
# - Monitoring and alerting
# Better: Use managed database services (RDS, CloudSQL, etc.)
```

**❌ Mounting Host Paths**

```yaml
# Dangerous anti-pattern
volumes:
- name: host-data
  hostPath:
    path: /var/data  # Ties pod to specific node, security risk
```

**❌ Using `:latest` Tag in Production**

```yaml
# Bad: Non-reproducible deployments
image: nginx:latest

# Good: Specific, immutable versions
image: nginx:1.25.3
# Better: Use digest
image: nginx@sha256:4c0fdaa8b6341bfdeca5f18f7837462c80cff90527ee35ef185571e1c327beac
```

**❌ Not Setting Resource Limits**

```yaml
# Bad: No limits = potential cluster instability
containers:
- name: app
  image: app:v1
  # Missing resources

# Good: Always set requests and limits
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

**❌ Secrets in Environment Variables (Visible in describe)**

```yaml
# Bad: Anyone with describe access sees secrets
env:
- name: API_KEY
  value: "super-secret-key-12345"

# Good: Use secretKeyRef
env:
- name: API_KEY
  valueFrom:
    secretKeyRef:
      name: api-secrets
      key: api-key

# Better: Mount as volume (more secure)
volumeMounts:
- name: secrets
  mountPath: /etc/secrets
  readOnly: true
volumes:
- name: secrets
  secret:
    secretName: api-secrets
```

**❌ Over-Provisioning Replicas**

```yaml
# Bad: Wasting resources
replicas: 50  # For application that gets 10 requests/day

# Good: Right-size and use HPA
replicas: 2
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  minReplicas: 2
  maxReplicas: 10
```

**❌ Ignoring Security Contexts**

```yaml
# Bad: Running as root
containers:
- name: app
  image: app:v1

# Good: Explicit security context
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

**❌ One Giant Namespace**

```yaml
# Bad: Everything in default namespace
apiVersion: v1
kind: Namespace
metadata:
  name: default  # Don't use default for everything

# Good: Logical separation
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

**❌ Hardcoded Configuration**

```yaml
# Bad: Configuration in deployment
env:
- name: DATABASE_URL
  value: "postgres://prod-db.example.com:5432/db"

# Good: Externalized configuration
env:
- name: DATABASE_URL
  valueFrom:
    configMapKeyRef:
      name: app-config
      key: database-url
```

**❌ Missing Health Checks**

```yaml
# Bad: No probes
containers:
- name: app
  image: app:v1

# Good: Comprehensive health checks
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

Quick Reference Checklist
--------------------------

### 102. Pre-Deployment Checklist

**✅ Configuration Review:**

- [ ] API versions are current (not deprecated)
- [ ] All manifests in version control
- [ ] Resource requests and limits set
- [ ] Health probes configured (liveness, readiness, startup)
- [ ] Proper labels and annotations applied
- [ ] Secrets not hardcoded
- [ ] Images use specific tags or digests

**✅ Security Checklist:**

- [ ] Containers run as non-root
- [ ] ReadOnlyRootFilesystem enabled
- [ ] No privilegeEscalation allowed
- [ ] Security contexts defined
- [ ] Network policies in place
- [ ] RBAC properly configured
- [ ] Pod Security Standards enforced
- [ ] Secrets encrypted at rest

**✅ Reliability Checklist:**

- [ ] Multiple replicas configured
- [ ] Pod disruption budgets defined
- [ ] Anti-affinity rules for HA
- [ ] Graceful shutdown implemented
- [ ] Resource quotas set for namespace
- [ ] Monitoring and logging configured
- [ ] Backups scheduled (Velero)

**✅ Performance Checklist:**

- [ ] Resource requests based on actual usage
- [ ] HPA configured for variable load
- [ ] DNS caching enabled
- [ ] Connection pooling configured
- [ ] Image pull policy optimized
- [ ] Init containers for heavy initialization

**✅ Observability Checklist:**

- [ ] Prometheus metrics exposed
- [ ] Structured logging enabled
- [ ] Distributed tracing configured
- [ ] Dashboards created
- [ ] Alerts configured
- [ ] Error tracking integrated

### 103. Common kubectl Commands Reference

```bash
# Deployment management
kubectl apply -f deployment.yaml
kubectl rollout status deployment/app
kubectl rollout undo deployment/app
kubectl scale deployment app --replicas=5

# Debugging
kubectl describe pod pod-name
kubectl logs pod-name -f
kubectl logs pod-name --previous
kubectl exec -it pod-name -- /bin/bash
kubectl debug -it pod-name --image=busybox

# Resource inspection
kubectl get all -n namespace
kubectl top pods
kubectl top nodes
kubectl get events --sort-by='.lastTimestamp'

# Configuration
kubectl create configmap app-config --from-file=config.yaml
kubectl create secret generic db-creds --from-literal=password=secret
kubectl get configmap app-config -o yaml

# Networking
kubectl port-forward svc/app 8080:80
kubectl get endpoints
kubectl get ingress

# RBAC
kubectl auth can-i create deployments
kubectl auth can-i --list
kubectl get rolebindings

# Cluster info
kubectl cluster-info
kubectl get nodes -o wide
kubectl api-resources
kubectl api-versions
```

### 104. Useful Tools and Extensions

| Tool | Purpose | Installation |
|------|---------|-------------|
| **k9s** | Terminal UI for K8s | `brew install k9s` |
| **stern** | Multi-pod log tailing | `brew install stern` |
| **kubectx/kubens** | Context/namespace switching | `brew install kubectx` |
| **kustomize** | Config management | Built into kubectl |
| **helm** | Package manager | `brew install helm` |
| **krew** | kubectl plugin manager | [krew.sigs.k8s.io](https://krew.sigs.k8s.io) |
| **kubeval** | YAML validation | `brew install kubeval` |
| **kube-linter** | Best practices linting | `brew install kube-linter` |
| **velero** | Backup/restore | [velero.io](https://velero.io) |
| **k6** | Load testing | `brew install k6` |
| **kubescape** | Security scanning | `brew install kubescape` |
| **Lens** | Desktop GUI | [k8slens.dev](https://k8slens.dev) |

Common Configuration Mistakes to Avoid
--------------------------------------

* Mistake: No resource limits
  * Impact: Node instability, OOM kills
  * Solution: Always set requests and limits
* Mistake: Missing health checks
  * Impact: Undetected failures, poor recovery
  * Solution: Configure liveness and readiness probes
* Mistake: Naked Pods
  * Impact: No automatic recovery
  * Solution: Use Deployments or other controllers
* Mistake: Hardcoded secrets
  * Impact: Security vulnerabilities
  * Solution: Use Kubernetes Secrets or external vaults
* Mistake: No PodDisruptionBudgets
  * Impact: Downtime during maintenance
  * Solution: Create PDBs for critical workloads
* Mistake: Incorrect label selectors
  * Impact: Orphaned resources, routing issues
  * Solution: Match labels exactly
* Mistake: Running as root
  * Impact: Security risks
  * Solution: Use runAsNonRoot: true
* Mistake: No resource requests
  * Impact: Poor scheduling decisions
  * Solution: Set realistic requests

Configuration Validation Tools
------------------------------

### Recommended Tools

1.  **kubeval / kubeconform**: Validate YAML against Kubernetes schemas
2.  **kube-linter**: Static analysis for best practices
3.  **Datree**: Policy enforcement and validation
4.  **OPA/Gatekeeper**: Policy-as-code validation
5.  **Polaris**: Best practices and security checks
6.  **kubent**: Detect deprecated APIs

**Example CI/CD validation pipeline:**

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

Conclusion
----------

Kubernetes configuration might seem mundane, but it’s the foundation of reliable deployments. By following these best practices, you’ll build clusters that are:

*   **Maintainable**: Clean, version-controlled configurations
*   **Reliable**: Proper health checks, resource limits, and anti-affinity rules
*   **Secure**: Non-root containers, network policies, and secret management
*   **Scalable**: Proper use of controllers and resource management

**Key takeaways:**

1.  Always version control your configurations
2.  Use controllers (Deployments, StatefulSets) instead of naked Pods
3.  Set resource requests and limits on every container
4.  Configure health checks for all workloads
5.  Use consistent, semantic labels
6.  Validate configurations before applying

Start implementing these practices today, and your future self (and your team) will thank you when debugging at 3 AM becomes a rare occurrence.

**Related Articles:**

*   [Kubernetes Security Best Practices](https://claude.ai/kubernetes-security-best-practices)
*   [Docker to Kubernetes Migration Guide](https://claude.ai/docker-to-kubernetes-migration)
*   [Helm Charts: Complete Tutorial](https://claude.ai/helm-charts-tutorial)
