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

kubectl Tips for Configuration Management
-----------------------------------------

### 32. Apply Entire Directories

```bash
# Apply all manifests in a directory
kubectl apply -f ./kubernetes/ --recursive

# Use server-side apply for better conflict handling
kubectl apply -f ./kubernetes/ --server-side

# Preview changes before applying
kubectl diff -f ./kubernetes/
```


### 33. Generate Manifests from Running Resources

```bash
# Export running deployment as YAML
kubectl get deployment nginx -o yaml > nginx-deployment.yaml

# Create deployment imperatively, then export
kubectl create deployment nginx --image=nginx --dry-run=client -o yaml > deployment.yaml

```


### 34. Validate Configurations Before Applying

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
