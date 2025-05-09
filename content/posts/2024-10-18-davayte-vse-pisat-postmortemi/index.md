---
title: "Давайте все будем писать посмортемы"
date: 2024-10-18T13:39:35+03:00
description: "Недавно в twitter спрашивал о том, есть ли практика ведения посмортемов. Оказалось, что не такой большой процент заботит эта история. И были даже кейсы, когда просили лида внедрить такую практику, но лид сливался. 😱 Давайте сегодня чуть ближе познакомимся с этим очень важным и нужный инструмент."
tags: [career]
---

Недавно в twitter спрашивал о том, есть ли практика ведения посмортемов. Оказалось, что не такой большой процент заботит эта история. И были даже кейсы, когда просили лида внедрить такую практику, но лид сливался. 😱 Давайте сегодня чуть ближе познакомимся с этим очень важным и нужный инструмент.

Постмортем ([лат.] «после смерти») — это анализ инцидента, произошедшего в системе, и его последствий. В сфере DevOps/SRE равно как и в разработке продукта  постмортемы играют ключевую роль для повышения устойчивости и надежности инфраструктуры. Выделим несколько ключевых моментов о постмортемах и как сделать их полезным инструментом для роста вашей команды.

##  Принципы «Blameless» постмортемов

Ключевое правило постмортемов — это принцип «без обвинений». Цель анализа инцидента — понять, что пошло не так, выявить первопричину и разработать меры для предотвращения подобных случаев в будущем. Важно не сосредотачиваться на том, кто допустил ошибку, а на том, что можно улучшить в процессах и инструментах.

Для создания здоровой культуры в компании постмортемы должны проводиться без поиска виноватых. Это не место для обвинений, а возможность совместного улучшения процессов и повышения надежности всей системы. Такой подход:

- Увеличивает доверие в команде, так как инженеры чувствуют себя безопасно, высказывая свои мысли и идеи.
- Способствует честному анализу инцидентов и их реальных причин.
- Позволяет всей команде извлечь ценные уроки и избежать подобных проблем в будущем.

## Составляющие хорошего постмортема

Успешный постмортем состоит из нескольких важных этапов:

1. Описание инцидента. Кратко и четко изложите, что произошло. Например: «API перестало отвечать на запросы из-за превышения лимита соединений в базе данных».
2. Причины. Опишите, какие факторы привели к инциденту. Это может быть комбинация технических проблем, недоработок в процессах или неожиданного поведения системы.
3. Реакция команды. Зафиксируйте действия, которые предпринимались для устранения проблемы, и как быстро был восстановлен сервис.
4. Уроки. Что можно улучшить в будущем? Нужно ли пересмотреть мониторинг, переработать конфигурации или оптимизировать процессы развертывания?
5. Действия на будущее. Определите конкретные шаги, которые помогут избежать повторения инцидента. Это может включать добавление мониторинга для критичных метрик, улучшение документации или изменение архитектурных решений.

## Автоматизация и инструментальная поддержка

Для постмортемов часто используют автоматизированные системы для сбора данных и логов, чтобы сэкономить время и не упустить важные детали инцидента. Рекомендуется настроить процесс так, чтобы все метрики, логи и события автоматически собирались в едином хранилище, что значительно упростит анализ. Также популярны инструменты для отслеживания выполнения всех шагов плана улучшений, определенных по результатам постмортема. Хотя отсутствие метрик и логов как раз может стать кейпоинтом в одном из ваших первых посмортемов. =)

##  Ретроспективы — следите за прогрессом

Задача лида команды после проведения постмортема провести ретроспективу через определенное время. Это позволит оценить, были ли внедрены предложенные улучшения и помогли ли они. Если ситуация повторилась, это повод углубиться в анализ и пересмотреть ранее принятые меры.

Польза посмортемов для всех:
- Инженеры могут улучшить качество своей работы за счет углубленного анализа причинных факторов инцидентов.
- Помогают выявить недостатки в коде, которые могут вызвать инциденты в будущем, и дают возможность быстро их устранить.
- Это отличная возможность для разработки новых инструментов и процессов, улучшающих стабильность системы.
- Позволяют улучшать процессы мониторинга и алертинга, что предотвращает повторение проблем.
- Дают новые знания о том, как системы ведут себя в реальных условиях, и что можно улучшить в архитектуре и инфраструктуре.
- Помогают повысить общую надежность системы и уверенность в поддержке её работы при высоких нагрузках.
- Анализ инцидентов снижает риски повторных сбоев, что напрямую влияет на качество предоставляемых услуг и удовлетворенность клиентов.
- Понимание корневых причин и внедрение улучшений обеспечивает стабильную работу сервисов, что способствует росту репутации компании. 
- Шаринг знаний между котлегами.

💀💀💀 Кстати, деплой в пятницу, как раз может стать поводом написать свой первый посмотрем 💀💀💀
