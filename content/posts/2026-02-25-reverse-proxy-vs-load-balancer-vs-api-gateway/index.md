---
title: "Reverse proxy vs Load Balancer vs Api Gateway - в чем разница"
date: 2026-02-25T09:00:00+03:00
description: "Термины Reverse Proxy, Load Balancer и API Gateway – давайте разберемся в чем разница с точки зрения реальной эксплуатации и закроем этот вопроc навсегда."
tags: [networking]
thumbnail: "images/image.png"
---

"Reverse Proxy", "Load Balancer" и "API Gateway" – давайте на примерах разберемся в чем разница с точки зрения реальной эксплуатации. Инструменты вроде Nginx, HAProxy или Traefik могут брать на себя разные роли в зависимости от того, как вы их настроите. Тот же Nginx может завести вас очень далеко. Но все же к выбору надо подходить исходя из требований к архитектуре. Давайте разбираться

**Reverse Proxy** cидит перед вашим бэкендом и скрывает его от мира. Зачем? Да потому что тогда вашему приложению придется заниматься тем, чем ему не надо бы заниматься. Например, терминация SSL, отдача статики, включение компрессии gzip и тд. Reverse Proxy берет эту "грязную работу" на себя.

```
# Пример реализации обычного reverse proxy в Nginx
server {
    listen 80;
  
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Балансировщик – ваш оберег от звонков в 4 утра**

Главная фишка здесь не в распределении трафика, а в **Health checks**. Обычный reverse proxy будет слать запросы игнорируя факт, что сервис упал. Неплохим примером будет  использовние пассивных хелсчеков вроде `max_fails=5 fail_timeout=60s` в nginx (активные хелсчеки есть только nginx plus).

```
# Пример балансировки в Nginx
upstream backend {
    server 10.0.0.1:3000 max_fails=5 fail_timeout=60s;
    server 10.0.0.2:3000 max_fails=5 fail_timeout=60s;
}

server {
    listen 80;
    
    location / {
        proxy_pass http://backend;
        proxy_next_upstream error timeout http_502 http_503;
    }
}
```

Есть разные стратегии балансировки трафика:

- **Round Robin:** Простая очередь. Хорошо, если серверы одинаковые.
- **Least Connections:** Отправляет туда, где меньше активных соединений. Идеально для запросов с разным временем обработки.
- **IP Hash:** Привязывает клиента к серверу по IP. Вообще редкий кейс – использовать только если вы заперты в клетке с монолитом 2010 года выпуска
- **Weighted:** Если один сервер – мощный зверь с 64 ГБ RAM, а другой – скромная виртуалка, вы распределяете нагрузку пропорционально их силам.

Ну и не забываем что там есть L4 (TCP/UDP) и L7 (HTTP).

**API Gateway как "полицейский" на границе ваших микросервисов**

API Gateway – это прокси с “высшим образованием”. Он делает вещи, о которых обычный балансировщик даже не догадывается:

- **Аутентификация и авторизация:** Проверка JWT-токенов или API-ключей на самом входе. Вам же не надо чтобы каждый микросервис реализовывал логику проверки каждого запроса? Вот и я так думаю =)
- **Rate Limiting:** Если клиент превысил лимит (например, 100 запросов в минуту), шлюз выкинет `429 Too Many Requests`. Это защищает ваш бэкенд от перегрузки еще до того, как запрос потребит ресурсы приложения.
- **Protocol Translation:** Например, трансформация внешнего REST в более эффективный внутренний gRPC.
- **Request Validation:** Шлюз может проверить структуру JSON и отсечь мусор на входе.
- **Трансформация и версионность:** Добавление заголовков вроде `X-Request-ID` для сквозной трассировки или маршрутизация на `/v2` на основе заголовков.
-  **Service Discovery:**. Современные шлюзы сходят в Consul или Kubernetes, чтобы узнать, где сейчас живут поды сервиса.

```yaml
services:
  - name: orders-backend
    url: http://orders-api.internal:8080
    plugins:
      # 1. AUTH: Проверяем, что заказ делает авторизованный клиент
      - name: jwt
        config:
          secret_is_base64: false
          claims_to_verify:
            - exp

      # 2. RATE LIMITING: Защищаем создание заказов от спам-ботов
      - name: rate-limiting
        config:
          minute: 50
          hour: 500
          policy: local

      # 3. TRANSFORMATION: Добавляем метаданные для логирования заказа
      - name: request-transformer
        config:
          add:
            headers:
              - "X-Order-Trace-ID: $(uuid)"
            querystring:
              - "source: mobile_app"

    routes:
      # 4. ROUTING: Разделяем стандартные и приоритетные заказы
      - name: standard-orders
        paths:
          - /v1/orders
        methods:
          - GET
          - POST

      - name: priority-orders
        paths:
          - /v1/priority-orders
        headers:
          X-Priority-Level: ["Gold", "Platinum"]
```

Самое главное, что надо понять – в основе всего лежит концепция Reverse Proxy:
-   Load Balancer – это тип Reverse Proxy, сфокусированный на распределении.
-   API Gateway – это тип Reverse Proxy, сфокусированный на управлении API.

[PS] Кстати у least_conn есть один интересная побочка. Угадаете, что будет если backend будет отдавать пустые ответы с 200 кодом?