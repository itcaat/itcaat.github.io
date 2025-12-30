---
title: "Bash-скрипт для полной диагностики Linux системы"
date: 2025-12-26T10:00:00+03:00
description: "Универсальный bash-скрипт который проводит комплексную диагностику Linux системы: анализирует ресурсы, температуру, логи, процессы, сетевые подключения и формирует детальный отчет. Работает на всех популярных дистрибутивах без дополнительных зависимостей."
tags: [bash, linux, monitoring, diagnostic, sysadmin, devops]
thumbnail: "images/image.png"
---

Когда ты администрируешь несколько серверов, или просто хочешь быстро понять состояние системы - обычно приходится выполнять десяток команд, анализировать логи, смотреть на метрики. Но что если автоматизировать это всё одним скриптом?

![diagnostic](images/image.png)

Сегодня я покажу вам универсальный bash-скрипт, который проводит полную диагностику Linux системы и формирует понятный отчет прямо в консоли. Скрипт работает на Ubuntu, Debian, CentOS, RHEL, Fedora, Arch и других дистрибутивах.

## Быстрый старт

Хотите попробовать прямо сейчас? Запустите скрипт одной командой:

```bash
# Полная проверка (рекомендуется)
curl -s https://gist.githubusercontent.com/itcaat/45edeaf15f2d508bee766daa9a97400c/raw/linux-diag-script.sh | sudo bash
```

**⚠️ Важно для безопасности:** 
- Всегда проверяйте содержимое скриптов перед запуском через `curl | bash`
- Просмотрите код скрипта: https://gist.github.com/itcaat/45edeaf15f2d508bee766daa9a97400c
- Скрипт только читает данные и не вносит изменений в систему
- Для дополнительной безопасности используйте локальную установку (Способ 2 ниже)

## Что проверяет скрипт

Скрипт выполняет комплексную проверку по следующим категориям:

1. **Системная информация** - версия ОС, ядро, архитектура, uptime, внешний IP
2. **Аппаратные ресурсы** - CPU, RAM, Swap, температура процессоров
3. **Дисковое пространство** - занятое место, inodes, SMART статус
4. **Тест скорости дисков** - скорость записи/чтения (100MB тест)
5. **Сетевые интерфейсы** - статус, ошибки, активные соединения
6. **Тест сети** - ping до шлюза, ya.ru и 8.8.8.8 (по 10 пакетов каждый), скорость интернета
7. **Процессы** - топ по CPU и памяти, zombie процессы
8. **Системные логи** - критические ошибки, OOM события, kernel warnings
9. **Системные службы** - проверка упавших служб
10. **Безопасность** - неудачные входы, активные SSH сессии
11. **Docker** - статус контейнеров и их ресурсы
12. **Telegram уведомления** - автоматическая отправка при обнаружении проблем

## Полный код скрипта

Скрипт полностью автономный, не требует дополнительных зависимостей (кроме стандартных утилит) и работает сразу после копирования:

```bash
#!/bin/bash

#############################################
# Linux System Diagnostic Script
# Universal system diagnostics script
# Version: 1.0
#############################################

# Status symbols
CHECK_OK="✓"
CHECK_WARN="⚠"
CHECK_CRIT="✗"

# Summary variables
WARNINGS=0
CRITICALS=0
PROBLEM_SECTIONS=()  # Array to track sections with problems

# Function for section headers
print_section() {
    echo ""
    echo "═══════════════════════════════════════════════════════"
    echo "  $1"
    echo "═══════════════════════════════════════════════════════"
    echo ""
}

# Function for output with status icons
print_status() {
    local status=$1
    local message=$2
    local section=$3  # Optional: section name for tracking
    
    case $status in
        "ok")
            echo "${CHECK_OK} $message"
            ;;
        "warn")
            echo "${CHECK_WARN} $message"
            ((WARNINGS++))
            # Add section to problem list if provided and not already there
            if [ ! -z "$section" ]; then
                if [[ ! " ${PROBLEM_SECTIONS[@]} " =~ " ${section} " ]]; then
                    PROBLEM_SECTIONS+=("$section")
                fi
            fi
            ;;
        "crit")
            echo "${CHECK_CRIT} $message"
            ((CRITICALS++))
            # Add section to problem list if provided and not already there
            if [ ! -z "$section" ]; then
                if [[ ! " ${PROBLEM_SECTIONS[@]} " =~ " ${section} " ]]; then
                    PROBLEM_SECTIONS+=("$section")
                fi
            fi
            ;;
    esac
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Ping function (10 packets)
do_ping() {
    local host=$1
    local description=$2
    local section=$3
    
    echo "  Testing $description ($host):"
    echo -n "    Ping (10 packets): "
    
    PING_RESULT=$(ping -c 10 -q "$host" 2>/dev/null)
    if [ $? -eq 0 ]; then
        PACKET_LOSS=$(echo "$PING_RESULT" | grep "packet loss" | awk '{print $6}')
        AVG_TIME=$(echo "$PING_RESULT" | grep "rtt" | awk -F'/' '{print $5}')
        
        echo "Loss: $PACKET_LOSS, Avg: ${AVG_TIME}ms"
        
        # Check packet loss
        LOSS_PERCENT=$(echo "$PACKET_LOSS" | sed 's/%//')
        if [ "$LOSS_PERCENT" -gt 20 ]; then
            print_status "crit" "High packet loss to $description!" "$section"
        elif [ "$LOSS_PERCENT" -gt 5 ]; then
            print_status "warn" "Packet loss detected to $description" "$section"
        else
            print_status "ok" "$description is reachable"
        fi
    else
        echo "Failed"
        print_status "crit" "Cannot reach $description!" "$section"
    fi
    echo ""
}

#############################################
# 1. SYSTEM INFORMATION
#############################################
check_system_info() {
    print_section "SYSTEM INFORMATION"
    
    echo "Hostname: $(hostname)"
    echo "OS: $(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'"' -f2 || uname -s)"
    echo "Kernel: $(uname -r)"
    echo "Architecture: $(uname -m)"
    echo "Uptime: $(uptime -p 2>/dev/null || uptime | awk -F'up ' '{print $2}' | awk -F',' '{print $1}')"
    
    # External IP address (using public services)
    if command_exists curl; then
        # Try to get IP from 2ip.ru, fallback to icanhazip.com
        EXTERNAL_IP=$(curl -s --max-time 5 https://2ip.ru 2>/dev/null || curl -s --max-time 5 https://icanhazip.com 2>/dev/null || echo "N/A")
        # Clean result - extract only IPv4 address
        EXTERNAL_IP=$(echo "$EXTERNAL_IP" | grep -oE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | head -1)
        if [ -z "$EXTERNAL_IP" ]; then
            EXTERNAL_IP="N/A"
        fi
        echo "External IP: $EXTERNAL_IP"
    fi
    
    # CPU information
    if [ -f /proc/cpuinfo ]; then
        CPU_MODEL=$(grep "model name" /proc/cpuinfo | head -1 | cut -d':' -f2 | xargs)
        CPU_CORES=$(grep -c "processor" /proc/cpuinfo)
        echo "CPU: $CPU_MODEL ($CPU_CORES cores)"
    fi
    
    # RAM information
    if command_exists free; then
        TOTAL_RAM=$(free -h | awk '/^Mem:/ {print $2}')
        echo "Total RAM: $TOTAL_RAM"
    fi
}

#############################################
# 2. SYSTEM RESOURCES
#############################################
check_resources() {
    print_section "RESOURCE USAGE"
    
    # Load Average
    if [ -f /proc/loadavg ]; then
        LOAD_AVG=$(cat /proc/loadavg | awk '{print $1, $2, $3}')
        CPU_CORES=$(grep -c "processor" /proc/cpuinfo)
        LOAD_1MIN=$(cat /proc/loadavg | awk '{print $1}')
        
        echo "Load Average: $LOAD_AVG (${CPU_CORES} cores)"
        
        # Check load
        if (( $(echo "$LOAD_1MIN > $CPU_CORES * 2" | bc -l) )); then
            print_status "crit" "High CPU load!" "Resources"
        elif (( $(echo "$LOAD_1MIN > $CPU_CORES" | bc -l) )); then
            print_status "warn" "Elevated CPU load" "Resources"
        else
            print_status "ok" "Load is normal"
        fi
    fi
    
    echo ""
    
    # Memory
    if command_exists free; then
        echo "Memory:"
        free -h
        
        # Check memory usage
        MEM_USED_PERCENT=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
        echo ""
        if [ "$MEM_USED_PERCENT" -gt 90 ]; then
            print_status "crit" "Memory usage: ${MEM_USED_PERCENT}% (critical!)" "Resources"
        elif [ "$MEM_USED_PERCENT" -gt 80 ]; then
            print_status "warn" "Memory usage: ${MEM_USED_PERCENT}%" "Resources"
        else
            print_status "ok" "Memory usage: ${MEM_USED_PERCENT}%"
        fi
        
        # Check swap
        SWAP_USED_PERCENT=$(free | grep Swap | awk '{if ($2 > 0) print int($3/$2 * 100); else print 0}')
        if [ "$SWAP_USED_PERCENT" -gt 50 ]; then
            print_status "warn" "Swap usage: ${SWAP_USED_PERCENT}%" "Resources"
        elif [ "$SWAP_USED_PERCENT" -gt 0 ]; then
            print_status "ok" "Swap usage: ${SWAP_USED_PERCENT}%"
        fi
    fi
}

#############################################
# 3. TEMPERATURE
#############################################
check_temperature() {
    print_section "TEMPERATURE"
    
    # Check sensors (lm-sensors)
    if command_exists sensors; then
        sensors 2>/dev/null | grep -E "^(Core|CPU|temp)" | head -10
        
        echo ""
        
        # Check critical temperatures
        HIGH_TEMP=$(sensors 2>/dev/null | grep -oP '\+\K[0-9]+' | awk '{if ($1 > 80) print $1}' | head -1)
        if [ ! -z "$HIGH_TEMP" ]; then
            print_status "crit" "High temperature detected: ${HIGH_TEMP}°C!" "Temperature"
        else
            print_status "ok" "Temperature is normal"
        fi
    else
        print_status "warn" "'sensors' utility not installed" "Temperature"
        echo ""
        echo "To install lm-sensors:"
        echo "  Ubuntu/Debian: sudo apt install lm-sensors && sudo sensors-detect"
        echo "  CentOS/RHEL:   sudo yum install lm_sensors"
        echo "  Fedora:        sudo dnf install lm_sensors"
        echo "  Arch:          sudo pacman -S lm_sensors"
    fi
}

#############################################
# 4. DISK SPACE
#############################################
check_disk_space() {
    print_section "DISK SPACE"
    
    echo "Partition usage:"
    df -h -x tmpfs -x devtmpfs | grep -v "^Filesystem"
    
    echo ""
    
    # Check partition usage
    df -h -x tmpfs -x devtmpfs | grep -v "^Filesystem" | awk '{print $5 " " $6}' | while read line; do
        USAGE=$(echo $line | awk '{print $1}' | sed 's/%//')
        MOUNT=$(echo $line | awk '{print $2}')
        
        if [ "$USAGE" -gt 90 ]; then
            print_status "crit" "Partition $MOUNT is ${USAGE}% full!" "Disk Space"
        elif [ "$USAGE" -gt 80 ]; then
            print_status "warn" "Partition $MOUNT is ${USAGE}% full" "Disk Space"
        fi
    done
    
    # Check inodes
    echo ""
    echo "Inodes usage (top-5 partitions):"
    df -i -x tmpfs -x devtmpfs | grep -v "^Filesystem" | awk '{print $5 " " $6}' | while read line; do
        USAGE_PERCENT=$(echo $line | awk '{print $1}')
        MOUNT=$(echo $line | awk '{print $2}')
        USAGE=$(echo $USAGE_PERCENT | sed 's/%//' | grep -E '^[0-9]+$')
        
        if [ ! -z "$USAGE" ]; then
            echo "  $MOUNT: ${USAGE_PERCENT}"
            
            if [ "$USAGE" -gt 90 ]; then
                print_status "crit" "Inodes on $MOUNT critically full!" "Disk Space"
            elif [ "$USAGE" -gt 80 ]; then
                print_status "warn" "Inodes on $MOUNT need attention" "Disk Space"
            fi
        fi
    done | head -15
    
    # SMART status (if available)
    if command_exists smartctl; then
        echo ""
        echo "SMART disk status:"
        for disk in $(lsblk -d -o name,type 2>/dev/null | awk '$2=="disk" {print $1}'); do
            SMART_STATUS=$(smartctl -H /dev/$disk 2>/dev/null | grep "SMART overall-health")
            
            if [ -z "$SMART_STATUS" ]; then
                echo "  /dev/$disk: N/A"
            else
                echo "  /dev/$disk: $SMART_STATUS"
                
                # Check for FAILED
                if echo "$SMART_STATUS" | grep -qi "FAILED"; then
                    print_status "crit" "Disk /dev/$disk has SMART problems!" "Disk Space"
                fi
            fi
        done
    fi
}

#############################################
# 4.5. DISK SPEED TEST
#############################################
check_disk_speed() {
    print_section "DISK SPEED TEST"
    
    # Check if dd is available
    if ! command_exists dd; then
        print_status "warn" "'dd' utility not found"
        return
    fi
    
    # Get root partition
    ROOT_MOUNT=$(df / | tail -1 | awk '{print $6}')
    TEST_FILE="/tmp/disk_speed_test_$$"
    
    echo "Write/Read speed test for $ROOT_MOUNT:"
    echo "  (using 100MB temporary file)"
    echo ""
    
    # Write speed test
    echo -n "  Write speed: "
    WRITE_SPEED=$(dd if=/dev/zero of="$TEST_FILE" bs=1M count=100 oflag=direct 2>&1 | grep -oP '[0-9.]+ MB/s' | head -1)
    if [ -z "$WRITE_SPEED" ]; then
        # Alternative parsing for different dd versions
        WRITE_SPEED=$(dd if=/dev/zero of="$TEST_FILE" bs=1M count=100 oflag=direct 2>&1 | tail -1 | awk '{print $(NF-1), $NF}')
    fi
    echo "$WRITE_SPEED"
    
    # Clear cache (if permissions allow)
    sync
    if [ -w /proc/sys/vm/drop_caches ]; then
        echo 3 > /proc/sys/vm/drop_caches 2>/dev/null
    fi
    
    # Read speed test
    echo -n "  Read speed:  "
    READ_SPEED=$(dd if="$TEST_FILE" of=/dev/null bs=1M 2>&1 | grep -oP '[0-9.]+ MB/s' | head -1)
    if [ -z "$READ_SPEED" ]; then
        # Alternative parsing for different dd versions
        READ_SPEED=$(dd if="$TEST_FILE" of=/dev/null bs=1M 2>&1 | tail -1 | awk '{print $(NF-1), $NF}')
    fi
    echo "$READ_SPEED"
    
    # Remove test file
    rm -f "$TEST_FILE"
    
    echo ""
    print_status "ok" "Disk speed test completed"
    echo ""
    echo "Note: This is a basic test. For detailed analysis use fio or hdparm."
}

#############################################
# 6. NETWORK DIAGNOSTICS
#############################################
check_network() {
    print_section "NETWORK DIAGNOSTICS"
    
    echo "Network interfaces:"
    if command_exists ip; then
        ip -br addr show | grep -v "^lo"
    else
        ifconfig | grep -E "^[a-z]|inet "
    fi
    
    echo ""
    
    # Check interface errors
    if [ -f /proc/net/dev ]; then
        echo "Interface errors:"
        awk 'NR>2 {print $1, $4, $12}' /proc/net/dev | while read iface rx_errors tx_errors; do
            iface=$(echo $iface | sed 's/:$//')
            if [ "$iface" != "lo" ]; then
                TOTAL_ERRORS=$((rx_errors + tx_errors))
                if [ "$TOTAL_ERRORS" -gt 100 ]; then
                    print_status "warn" "$iface: RX errors: $rx_errors, TX errors: $tx_errors" "Network"
                fi
            fi
        done
    fi
    
    echo ""
    
    # Active connections (external)
    echo "Top-10 external connections (by IP):"
    
    # Get local IP addresses for filtering
    LOCAL_IPS=$(ip addr show 2>/dev/null | grep -oP 'inet \K[\d.]+' | grep -v '^127\.')
    
    if command_exists ss; then
        CONNECTIONS=$(ss -tun state established 2>/dev/null | awk 'NR>1 {print $5}' | grep -v "^$" | sed 's/:[0-9]*$//' | grep -E '^[0-9]+\.' | grep -v "^127\.\|^0\.0\.0\.0")
    else
        CONNECTIONS=$(netstat -tun 2>/dev/null | grep ESTABLISHED | awk '{print $5}' | sed 's/:[0-9]*$//' | grep -E '^[0-9]+\.' | grep -v "^127\.\|^0\.0\.0\.0")
    fi
    
    # Filter local IPs
    FILTERED_CONNECTIONS=""
    for ip in $CONNECTIONS; do
        IS_LOCAL=0
        for local_ip in $LOCAL_IPS; do
            if [ "$ip" = "$local_ip" ]; then
                IS_LOCAL=1
                break
            fi
        done
        if [ $IS_LOCAL -eq 0 ]; then
            FILTERED_CONNECTIONS="$FILTERED_CONNECTIONS$ip\n"
        fi
    done
    
    if [ -z "$FILTERED_CONNECTIONS" ]; then
        echo "  No active external connections"
    else
        echo -e "$FILTERED_CONNECTIONS" | grep -v "^$" | sort | uniq -c | sort -rn | head -10
    fi
    
    # Network connectivity tests
    echo ""
    echo "Network connectivity tests:"
    echo ""
    
    # 1. Ping to gateway
    GATEWAY=$(ip route | grep default | awk '{print $3}' | head -1)
    if [ ! -z "$GATEWAY" ]; then
        do_ping "$GATEWAY" "Gateway" "Network"
    else
        echo "  Gateway: Not found"
        print_status "warn" "No default gateway found" "Network"
        echo ""
    fi
    
    # 2. Ping to ya.ru
    do_ping "ya.ru" "ya.ru (DNS + connectivity)" "Network"
    
    # 3. Ping to 8.8.8.8
    do_ping "8.8.8.8" "Google DNS" "Network"
    
    # Internet speed test (optional)
    echo ""
    if command_exists curl; then
        echo "Internet speed test:"
        echo -n "  Download (testing 100MB file): "
        
        # Test download speed using curl
        # %{speed_download} returns speed in bytes/sec
        DOWNLOAD_SPEED=$(curl -o /dev/null -s -w '%{speed_download}' --max-time 15  http://speedtest.selectel.ru/100MB 2>/dev/null)
        
        if [ ! -z "$DOWNLOAD_SPEED" ] && [ "$DOWNLOAD_SPEED" != "0.000" ] && [ "$DOWNLOAD_SPEED" != "0" ]; then
            # Convert bytes/sec to MB/s (divide by 1048576)
            if command_exists bc; then
                DOWNLOAD_MBPS=$(echo "scale=2; $DOWNLOAD_SPEED / 1048576" | bc 2>/dev/null)
            else
                # Without bc use awk
                DOWNLOAD_MBPS=$(awk "BEGIN {printf \"%.2f\", $DOWNLOAD_SPEED / 1048576}")
            fi
            
            if [ ! -z "$DOWNLOAD_MBPS" ] && [ "$DOWNLOAD_MBPS" != "0.00" ]; then
                echo "${DOWNLOAD_MBPS} MB/s"
            else
                echo "N/A (file too small for measurement)"
            fi
        else
            echo "N/A (check internet connection)"
        fi
    fi
}

#############################################
# 7. PROCESSES
#############################################
check_processes() {
    print_section "PROCESSES"
    
    echo "Top-10 processes by CPU:"
    ps aux --sort=-%cpu | head -11 | tail -10
    
    echo ""
    echo "Top-10 processes by memory:"
    ps aux --sort=-%mem | head -11 | tail -10
    
    # Zombie processes
    echo ""
    ZOMBIE_COUNT=$(ps aux | awk '{if ($8 == "Z") print $0}' | wc -l)
    if [ "$ZOMBIE_COUNT" -gt 0 ]; then
        print_status "warn" "Found zombie processes: $ZOMBIE_COUNT" "Processes"
        ps aux | awk '{if ($8 == "Z") print $0}'
    else
        print_status "ok" "No zombie processes found"
    fi
    
    # Total processes
    echo ""
    TOTAL_PROCESSES=$(ps aux | wc -l)
    echo "Total processes: $TOTAL_PROCESSES"
}

#############################################
# 8. LOG ANALYSIS
#############################################
check_logs() {
    print_section "SYSTEM LOG ANALYSIS"
    
    # Detect logging system
    if command_exists journalctl; then
        echo "Critical errors in last 24 hours (journalctl):"
        journalctl -p err -S "24 hours ago" --no-pager | tail -20
        
        echo ""
        echo "OOM (Out of Memory) events:"
        journalctl -k | grep -i "out of memory\|oom" | tail -10
        
    elif [ -f /var/log/syslog ]; then
        echo "Critical errors (syslog):"
        grep -i "error\|critical\|fail" /var/log/syslog | tail -20
        
        echo ""
        echo "OOM events:"
        grep -i "out of memory\|oom" /var/log/syslog | tail -10
        
    elif [ -f /var/log/messages ]; then
        echo "Critical errors (messages):"
        grep -i "error\|critical\|fail" /var/log/messages | tail -20
        
        echo ""
        echo "OOM events:"
        grep -i "out of memory\|oom" /var/log/messages | tail -10
    fi
    
    # Kernel warnings
    echo ""
    echo "Kernel warnings (dmesg):"
    if command_exists dmesg; then
        # Use -T to show real time (if supported)
        if dmesg -T >/dev/null 2>&1; then
            dmesg -T -l err,crit,alert,emerg 2>/dev/null | tail -15
        else
            # For older versions without -T support
            dmesg -l err,crit,alert,emerg 2>/dev/null | tail -15
        fi
    fi
    
    # Failed SSH attempts
    echo ""
    echo "Failed SSH attempts (last 10):"
    if [ -f /var/log/auth.log ]; then
        grep "Failed password" /var/log/auth.log | tail -10
    elif [ -f /var/log/secure ]; then
        grep "Failed password" /var/log/secure | tail -10
    fi
}

#############################################
# 9. SYSTEM SERVICES
#############################################
check_services() {
    print_section "SYSTEM SERVICES"
    
    if command_exists systemctl; then
        echo "Failed services:"
        FAILED_SERVICES=$(systemctl list-units --state=failed --no-pager --no-legend)
        
        if [ -z "$FAILED_SERVICES" ]; then
            print_status "ok" "No failed services found"
        else
            print_status "crit" "Failed services found:" "Services"
            echo "$FAILED_SERVICES"
        fi
    else
        echo "systemctl not found, check services manually"
    fi
}

#############################################
# 10. SECURITY
#############################################
check_security() {
    print_section "SECURITY"
    
    # Last successful logins
    echo "Last successful logins:"
    if command_exists last; then
        last -n 10 | grep -v "^$\|^wtmp"
    fi
    
    echo ""
    
    # Active SSH sessions
    echo "Active SSH sessions:"
    who | grep -v "^$"
    
    # Check number of active SSH sessions
    SSH_COUNT=$(who | wc -l)
    if [ "$SSH_COUNT" -gt 5 ]; then
        print_status "warn" "Detected $SSH_COUNT active SSH sessions" "Security"
    fi
    
    echo ""
    
    # Sudo activity in last 24 hours
    echo "Sudo activity in last 24 hours:"
    if [ -f /var/log/auth.log ]; then
        grep "sudo.*COMMAND" /var/log/auth.log | tail -10
    elif [ -f /var/log/secure ]; then
        grep "sudo.*COMMAND" /var/log/secure | tail -10
    fi
}

#############################################
# 11. DOCKER (if installed)
#############################################
check_docker() {
    if command_exists docker; then
        print_section "DOCKER"
        
        echo "Container status:"
        docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
        
        echo ""
        
        # Check for exited containers
        EXITED_CONTAINERS=$(docker ps -a --filter "status=exited" --format "{{.Names}}" | wc -l)
        if [ "$EXITED_CONTAINERS" -gt 0 ]; then
            print_status "warn" "Found stopped containers: $EXITED_CONTAINERS" "Docker"
        else
            print_status "ok" "All containers are running"
        fi
        
        echo ""
        echo "Resource usage by containers:"
        docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
    fi
}

#############################################
# FINAL REPORT
#############################################
generate_summary() {
    print_section "DIAGNOSTIC SUMMARY"
    
    echo "Check date and time: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Hostname: $(hostname)"
    echo ""
    
    # Hardware summary
    echo "Hardware Summary:"
    echo ""
    
    # CPU info
    if [ -f /proc/cpuinfo ]; then
        CPU_MODEL=$(grep "model name" /proc/cpuinfo | head -1 | cut -d':' -f2 | xargs)
        CPU_CORES=$(grep -c "processor" /proc/cpuinfo)
        echo "  CPU: $CPU_MODEL"
        echo "  Cores: $CPU_CORES"
    fi
    
    # RAM info
    if command_exists free; then
        TOTAL_RAM=$(free -h | awk '/^Mem:/ {print $2}')
        USED_RAM=$(free -h | awk '/^Mem:/ {print $3}')
        MEM_PERCENT=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
        echo "  RAM: $USED_RAM / $TOTAL_RAM (${MEM_PERCENT}%)"
    fi
    
    # Disk info
    if command_exists df; then
        TOTAL_DISK=$(df -h --total 2>/dev/null | grep total | awk '{print $2}' || df -h / | tail -1 | awk '{print $2}')
        USED_DISK=$(df -h --total 2>/dev/null | grep total | awk '{print $3}' || df -h / | tail -1 | awk '{print $3}')
        echo "  Disk: $USED_DISK / $TOTAL_DISK"
    fi
    
    # Load Average
    if [ -f /proc/loadavg ]; then
        LOAD_AVG=$(cat /proc/loadavg | awk '{print $1, $2, $3}')
        echo "  Load Average: $LOAD_AVG"
    fi
    
    # Uptime
    UPTIME=$(uptime -p 2>/dev/null || uptime | awk -F'up ' '{print $2}' | awk -F',' '{print $1}')
    echo "  Uptime: $UPTIME"
    
    echo ""
    echo "Diagnostic Results:"
    echo ""
    
    if [ "$CRITICALS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
        echo "${CHECK_OK} System is in excellent condition!"
    elif [ "$CRITICALS" -eq 0 ]; then
        echo "${CHECK_WARN} Warnings detected: $WARNINGS"
        echo "Recommended to pay attention to the indicated issues."
    else
        echo "${CHECK_CRIT} ATTENTION! Critical problems detected!"
        echo "Critical: $CRITICALS"
        echo "Warnings: $WARNINGS"
    fi
    
    # Show problem sections if any
    if [ ${#PROBLEM_SECTIONS[@]} -gt 0 ]; then
        echo ""
        echo "Sections with problems:"
        for section in "${PROBLEM_SECTIONS[@]}"; do
            echo "  • $section"
        done
    fi
    
    echo ""
    echo "Recommendations:"
    
    if [ "$CRITICALS" -gt 0 ] || [ "$WARNINGS" -gt 0 ]; then
        echo "  • Review the report above and fix the detected problems"
        echo "  • Check logs for detailed information"
        echo "  • Free up disk space if necessary"
        echo "  • Restart failed services"
    else
        echo "  • Continue regular system monitoring"
        echo "  • Recommended to run this script once a day"
    fi
    
    # Return error code for monitoring systems integration
    if [ "$CRITICALS" -gt 0 ]; then
        return 2  # Critical problems exist
    elif [ "$WARNINGS" -gt 0 ]; then
        return 1  # Warnings exist
    else
        return 0  # All is good
    fi
}

#############################################
# TELEGRAM NOTIFICATION
#############################################
send_telegram_notification() {
    local exit_code=$1
    local report_file=$2
    
    # Check if Telegram credentials are set
    if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ]; then
        return 0
    fi
    
    # Only send if there are problems
    if [ "$exit_code" -eq 0 ]; then
        return 0
    fi
    
    # Check if curl is available
    if ! command_exists curl; then
        echo "Warning: curl not found, cannot send Telegram notification"
        return 1
    fi
    
    # Prepare message
    local hostname=$(hostname)
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local status_emoji=""
    local status_text=""
    
    if [ "$exit_code" -eq 2 ]; then
        status_emoji="🚨"
        status_text="CRITICAL PROBLEMS"
    else
        status_emoji="⚠️"
        status_text="WARNINGS"
    fi
    
    # Build message
    local message="${status_emoji} ${status_text} on ${hostname}!

Time: ${timestamp}
Critical: ${CRITICALS}
Warnings: ${WARNINGS}"
    
    # Add problem sections if any
    if [ ${#PROBLEM_SECTIONS[@]} -gt 0 ]; then
        message="${message}

Sections with problems:"
        for section in "${PROBLEM_SECTIONS[@]}"; do
            message="${message}
  • ${section}"
        done
    fi
    
    message="${message}

Please check the detailed report."
    
    # Send message
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d chat_id="${TELEGRAM_CHAT_ID}" \
        -d text="${message}" >/dev/null 2>&1
    
    # Send report file if it exists
    if [ -f "$report_file" ]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument" \
            -F chat_id="${TELEGRAM_CHAT_ID}" \
            -F document=@"${report_file}" \
            -F caption="Full diagnostic report" >/dev/null 2>&1
    fi
}

#############################################
# MAIN FUNCTION
#############################################
main() {
    # Temporary file for report
    TEMP_REPORT="/tmp/system_diagnostic_$(date +%Y%m%d_%H%M%S).txt"
    TEMP_COUNTERS="/tmp/system_diagnostic_counters_$$.tmp"
    
    # Run diagnostics and capture output
    {
        clear
        echo "╔════════════════════════════════════════════════════════════════╗"
        echo "║                                                                ║"
        echo "║        LINUX SYSTEM DIAGNOSTICS                               ║"
        echo "║        System Diagnostic Script v1.0                          ║"
        echo "║                                                                ║"
        echo "╚════════════════════════════════════════════════════════════════╝"
        echo ""
        
        # Check root privileges (some checks require sudo)
        if [ "$EUID" -ne 0 ]; then 
            echo "${CHECK_WARN} Script running without root privileges. Some checks may be unavailable."
            echo "For full diagnostics run: sudo $0"
            echo ""
        fi
        
        # Run all checks
        check_system_info
        check_resources
        check_temperature
        check_disk_space
        check_disk_speed
        check_network
        check_processes
        check_logs
        check_services
        check_security
        check_docker
        
        # Final summary
        generate_summary
        
        # Save counters and problem sections to file (to survive tee subshell)
        echo "$CRITICALS" > "$TEMP_COUNTERS"
        echo "$WARNINGS" >> "$TEMP_COUNTERS"
        # Save problem sections (one per line)
        for section in "${PROBLEM_SECTIONS[@]}"; do
            echo "$section" >> "$TEMP_COUNTERS"
        done
    } | tee "$TEMP_REPORT"
    
    # Read counters from file
    if [ -f "$TEMP_COUNTERS" ]; then
        CRITICALS=$(sed -n '1p' "$TEMP_COUNTERS")
        WARNINGS=$(sed -n '2p' "$TEMP_COUNTERS")
        # Read problem sections (starting from line 3)
        PROBLEM_SECTIONS=()
        while IFS= read -r section; do
            PROBLEM_SECTIONS+=("$section")
        done < <(tail -n +3 "$TEMP_COUNTERS")
        rm -f "$TEMP_COUNTERS"
    fi
    
    # Determine exit code from counters
    if [ "$CRITICALS" -gt 0 ]; then
        EXIT_CODE=2
    elif [ "$WARNINGS" -gt 0 ]; then
        EXIT_CODE=1
    else
        EXIT_CODE=0
    fi
    
    # Send Telegram notification if configured and there are problems
    send_telegram_notification "$EXIT_CODE" "$TEMP_REPORT"
    
    # Clean up temp files
    if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ]; then
        rm -f "$TEMP_REPORT"
    else
        # Keep report for a short time in case of retry
        (sleep 60 && rm -f "$TEMP_REPORT") &
    fi
    
    # Clean up counter file if exists
    rm -f "$TEMP_COUNTERS"
    
    # Exit with appropriate code
    exit $EXIT_CODE
}

# Run script
main
```

## Как использовать

Самый простой способ - запустить скрипт прямо из [GitHub Gist](https://gist.github.com/itcaat/45edeaf15f2d508bee766daa9a97400c):

```bash
# Полная проверка с правами root
curl -s https://gist.githubusercontent.com/itcaat/45edeaf15f2d508bee766daa9a97400c/raw/linux-diag-script.sh | sudo bash
```

### Сохранение отчета в файл

Чтобы сохранить результат в файл для последующего анализа:

```bash
# При запуске через curl
curl -s https://gist.githubusercontent.com/itcaat/45edeaf15f2d508bee766daa9a97400c/raw/linux-diag-script.sh | sudo bash | tee diagnostic_$(date +%Y%m%d_%H%M%S).txt

# При локальном запуске
sudo ./linux-diag.sh | tee diagnostic_$(date +%Y%m%d_%H%M%S).txt
```

### Что считается проблемой

**Критические проблемы:**
- Load Average превышает количество ядер CPU в 2 раза
- Использование памяти > 90%
- Температура процессора > 80°C
- Диск заполнен > 90%
- Inodes заполнены > 90%
- SMART статус диска: FAILED
- Нет подключения к интернету
- Есть упавшие системные службы

**Предупреждения:**
- Load Average превышает количество ядер CPU
- Использование памяти > 80%
- Использование swap > 50%
- Диск заполнен > 80%
- Inodes заполнены > 80%
- Обнаружены zombie процессы
- Большое количество ошибок на сетевых интерфейсах
- Много активных SSH сессий (> 5)

**В финальном отчете:**

В начале итоговой сводки выводится краткая информация о железе (CPU, RAM, Disk, Load Average, Uptime), а также список секций с обнаруженными проблемами. Это позволяет сразу видеть конфигурацию системы и быстро определить проблемные области.

## Кастомизация скрипта

### Переменные окружения

Скрипт поддерживает настройку через переменные окружения:

**TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID** - автоматическая отправка уведомлений в Telegram

```bash
# Уведомления при обнаружении проблем
export TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
export TELEGRAM_CHAT_ID="987654321"
sudo -E ./linux-diag.sh

# Или в одну строку
TELEGRAM_BOT_TOKEN="your_token" \
TELEGRAM_CHAT_ID="your_chat_id" \
sudo -E ./linux-diag.sh
```


### Изменение порогов

Вы можете изменить пороговые значения в соответствующих секциях. Например, для памяти:

```bash
# Вместо 90% и 80% используйте свои значения
if [ "$MEM_USED_PERCENT" -gt 95 ]; then
    print_status "crit" "Использование памяти: ${MEM_USED_PERCENT}% (критично!)"
elif [ "$MEM_USED_PERCENT" -gt 85 ]; then
    print_status "warn" "Использование памяти: ${MEM_USED_PERCENT}%"
```

### Отключение секций

Если какая-то секция вам не нужна, просто закомментируйте её вызов в функции `main()`:

```bash
main() {
    # ...
    check_system_info
    check_resources
    # check_temperature  # отключили проверку температуры
    check_disk_space
    # ...
}
```

## Exit коды для автоматизации

Скрипт возвращает разные exit коды в зависимости от результата проверки, что позволяет использовать его в автоматизированных системах мониторинга:

| Exit Code | Значение | Описание |
|-----------|----------|----------|
| **0** | Успех | Система в отличном состоянии, проблем не обнаружено |
| **1** | Предупреждение | Обнаружены предупреждения, требуется внимание |
| **2** | Критично | Обнаружены критические проблемы, требуется немедленное вмешательство |

## Уведомления в Telegram

Скрипт автоматически отправляет уведомления в Telegram при обнаружении проблем, если настроены переменные окружения.

### Настройка Telegram бота

**Шаг 1: Создайте бота**

1. Найдите [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте команду `/newbot`
3. Следуйте инструкциям и получите токен бота (например: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

**Шаг 2: Получите Chat ID**

1. Отправьте сообщение вашему боту
2. Откройте в браузере: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Найдите `"chat":{"id":` - это ваш Chat ID (например: `987654321`)

### Использование с Telegram

**Вариант 1: Переменные окружения**

```bash
# Установите переменные и запустите
export TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
export TELEGRAM_CHAT_ID="987654321"

sudo -E ./linux-diag.sh
```

**Вариант 2: В одну строку**

```bash
TELEGRAM_BOT_TOKEN="your_token" TELEGRAM_CHAT_ID="your_chat_id" sudo -E ./linux-diag.sh
```

**Вариант 3: Через cron**

Создайте файл `/etc/cron.d/system-diagnostic`:

```cron
# Проверка каждые 6 часов
0 */6 * * * root TELEGRAM_BOT_TOKEN="your_token" TELEGRAM_CHAT_ID="your_chat_id" /usr/local/bin/linux-diag.sh >/dev/null 2>&1
```

Или добавьте переменные в cron:

```bash
sudo crontab -e
```

```cron
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=987654321

# Проверка каждые 6 часов
0 */6 * * * /usr/local/bin/linux-diag.sh

# Или в конкретное время (6:00, 12:00, 18:00, 00:00)
0 6,12,18,0 * * * /usr/local/bin/linux-diag.sh
```

### Что отправляется

**При обнаружении проблем скрипт отправит:**

1. **Сообщение** с кратким описанием:
   - Уровень проблемы (⚠️ Warnings или 🚨 Critical)
   - Имя хоста
   - Количество критических проблем и предупреждений
   - Список проблемных секций

2. **Файл** с полным отчетом диагностики

**Если проблем нет** - уведомления не отправляются (экономия сообщений).

## Заключение

Этот скрипт - отличный инструмент для быстрой диагностики состояния Linux системы. Он помогает:

- **Сэкономить время** - вместо десятка команд один скрипт
- **Не упустить детали** - проверяет все критичные компоненты системы
- **Быстро реагировать** - понятная цветовая индикация проблем
- **Оценить производительность** - тесты скорости дисков и интернета
- **Автоматизировать мониторинг** - легко настроить в cron с уведомлениями в Telegram
- **Документировать состояние** - сохранение отчетов для анализа

Скрипт полностью бесплатный и open-source. Актуальная версия всегда доступна на [GitHub Gist](https://gist.github.com/itcaat/45edeaf15f2d508bee766daa9a97400c). Вы можете модифицировать его под свои нужды, добавлять новые проверки или интегрировать с вашими системами мониторинга.

**Полезные ссылки:**
- [Скрипт на GitHub Gist](https://gist.github.com/itcaat/45edeaf15f2d508bee766daa9a97400c) - актуальная версия скрипта
- [Документация по systemd](https://www.freedesktop.org/wiki/Software/systemd/)
- [Руководство по bash scripting](https://www.gnu.org/software/bash/manual/)
- [lm-sensors documentation](https://hwmon.wiki.kernel.org/)

И самое главное - скрипт не заменяет полноценного мониторинга и не стоит его использовать как решение, которое его заменит. Но он вполне сгоднится для некритичных и "домашних" серваков.
