---
title: "На что влияет evaluation_interval и for в алертах prometheus"
date: 2025-02-26T13:39:35+03:00
description: "Если вы используете prometheus или victoria metrics для настройки алертов, то наверняка встречали функции анализа временных рядов. Их отличительной особенностью является то, что они на вход получают временной интервал ([X]). "
tags: [monitoring, prometheus]
---

Если вы используете prometheus или victoria metrics для настройки алертов, то наверняка встречали функции анализа временных рядов. Их отличительной особенностью является то, что они на вход получают временной интервал ([X]). 

- increase() — считает, на сколько увеличился счётчик.
- rate() — усреднённая скорость изменения в секунду.
- delta() — разница между начальным и конечным значением.
- deriv() — скорость изменения с учётом тренда.

Разберем на примере, где хотим получить все успешные заказы в окружении production. 

```bash
increase(orders_total{environment="production", status="success"}[30m])
```

В данном примере increase(...) рассчитывает, насколько увеличился счётчик orders_total за последние 30 минут. Поскольку это счётчик counter (_total в имени как бы намекает), его значения могут только увеличиваться или сбрасываться на 0, если произошёл рестарт сервиса. Таким образом, increase(...[30m]) показывает, сколько успешных заказов (status="success") было обработано за последние 30 минут.

Теперь пришло время сделать алерт. Мы хотим знать, что конверсия (количество успешных заказов в данном случае) упала и бизнесу плохо. И тут некоторые ошибочно полагают, что не могут использовать for меньше чем 30 минут. Природа ошибки в принципе понятна, чаще всего мы используем в выражении меньший интервал, а for больший. Ну к примеру, increase(...[1m]) с for: 5m. В этом случает никаких вопросов нет и все просто. Но на самом деле все гораздо интереснее. 

Механизм срабатывания алерта в Prometheus зависит от параметра evaluation_interval, который определяет частоту вычислений правил. По-умолчанию он evaluation_interval: 1m . Поэтому prometheus будет вычислять по такому алгоритму:

- В T0 (now) он считает increase(...[30m]), получая данные за диапазон [T-30m, T0].
- В T+1m он снова считает increase(...[30m]), теперь за [T-29m, T+1m].
- В T+2m — за [T-28m, T+2m].
- ...
- В T+5m — за [T-25m, T+5m].

Если значение выражения остаётся выше порога на всех 5 оценках (T0, T+1m, ..., T+5m), то алерт срабатывает.

Предположим, что для бизнеса нормально делать по 100 заказов за 30 минут, в противном случае нам нужен алерт. Пример в данном случае выдуман из головы и в реальной жизни нам был бы интересен for: 0m. Но мы предположим, что при for: 0m у нас будут ложные срабатывания. Ну, например, во время релизов допускается, что возможны просадки. Поэтому мы заложим туда 5 минут и опишем так:

```yaml
  - alert: NoSuccessOrders
    expr: increase(orders_total{environment="production", status="success"}[30m]) < 100
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "No Success Orders"
      description: "Successful orders dropped below 100 in the last 30 minutes"
```

Разбор примера:
- Как мы говорили выше —  функция increase(...[30m]) вычисляет изменение метрики за последние 30 минут.
- Это изменение пересчитывается каждый раз при выполнении запроса в зависимости от настройки evaluation_interval в Prometheus.
- Если условие алерта (expr) остаётся истинным в течение 5 минут подряд (на всех оценках), алерт сработает.
