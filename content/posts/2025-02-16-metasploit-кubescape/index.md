---
title: "Подружил metasploit и кubescape"
date: 2025-05-01T13:39:35+03:00
description: "Что-то скучный у меня сегодня вечер: жена уехала тусить с подругой, а дети сидят и играют в лего. Штош, тогда надо сделать что-то полезное, но не скучное. Будем писать хацкерский скрипт - это ацкий комбайн из kubescape(k8s) и metasploit."
tags: [Fun]
---

Что-то скучный у меня сегодня вечер: жена уехала тусить с подругой, а дети сидят и играют в лего. Штош, тогда надо сделать что-то полезное, но не скучное. Будем писать хацкерский скрипт - это ацкий комбайн из kubescape(k8s) и metasploit.

![Image alt](images/image.png)

Идея очень простая: сканим кластер k8s через kubescape, сохраняем результаты в json, дергаем оттуда CVE и ищем в metasploit. По итогу получаем список эксплойтов, которые можно заюзать в metasploit. 

Пользуйтесь, друзья.  Все только в образовательных целях, не надо пытаться взламывать кластера работодателя, оно там уголовно-наказуемо и все такое.

```bash
#!/bin/bash

DEFAULT_SCAN_NAME=$(date +"%Y-%m-%d_%H-%M-%S")
read -p "Enter a name for this scan (leave empty for default: $DEFAULT_SCAN_NAME): " SCAN_NAME
SCAN_NAME=${SCAN_NAME:-$DEFAULT_SCAN_NAME}

SCAN_DIR="scans/$SCAN_NAME"
mkdir -p "$SCAN_DIR"
echo "[+] Scan results will be stored in: $SCAN_DIR"

echo "[+] Checking for required tools..."

if ! command -v kubescape &> /dev/null; then
    echo "[-] Kubescape is not installed. Please install it first."
    exit 1
fi

echo "[+] Checking current Kubernetes context..."
CURRENT_CONTEXT=$(kubectl config current-context)
if [ -z "$CURRENT_CONTEXT" ]; then
    echo "[-] No active Kubernetes context found. Please configure your kubeconfig."
    exit 1
fi
echo "[+] You are currently using Kubernetes context: $CURRENT_CONTEXT"

read -p "Do you want to continue with this context? (y/n): " CONTINUE
if [[ "$CONTINUE" != "y" && "$CONTINUE" != "Y" ]]; then
    echo "[-] Exiting script."
    exit 0
fi

read -p "Enter the namespace to scan (leave empty for all namespaces): " NAMESPACE
if [[ -z "$NAMESPACE" ]]; then
    NAMESPACE_FLAG="--all-namespaces"
    echo "[+] Scanning all namespaces..."
else
    NAMESPACE_FLAG="-n $NAMESPACE"
    echo "[+] Scanning namespace: $NAMESPACE"
fi

read -p "Do you want to check Metasploit for available exploits? (y/n): " CHECK_METASPLOIT
if [[ "$CHECK_METASPLOIT" == "y" || "$CHECK_METASPLOIT" == "Y" ]]; then
    SEARCH_METASPLOIT=true
    # Check if Metasploit is installed
    if ! command -v msfconsole &> /dev/null; then
        echo "[-] Metasploit is not installed. Exploit search will be skipped."
        SEARCH_METASPLOIT=false
    fi
else
    SEARCH_METASPLOIT=false
    echo "[+] Skipping Metasploit exploit search."
fi

echo "[+] Retrieving container images..."
kubectl get pods $NAMESPACE_FLAG -o json | jq -r '.items[].spec.containers[].image' | sort -u > "$SCAN_DIR/images.txt"

if [[ ! -s "$SCAN_DIR/images.txt" ]]; then
    echo "[-] No container images found in the selected namespace(s)."
    exit 1
fi

echo "[+] Found $(wc -l < "$SCAN_DIR/images.txt") unique images."

echo "[+] Scanning container images with Kubescape..."
mkdir -p "$SCAN_DIR/results"

while read -r image; do
    echo "[*] Scanning $image..."
    safe_name=$(echo "$image" | tr '/:' '_')
    kubescape scan image "$image" --format json --output "$SCAN_DIR/results/${safe_name}.json"
done < "$SCAN_DIR/images.txt"

echo "[+] Extracting CVEs from Kubescape reports..."
jq -r '.matches[].vulnerability.id' "$SCAN_DIR/results/"*.json | grep CVE > "$SCAN_DIR/cve_list.txt"

if [[ ! -s "$SCAN_DIR/cve_list.txt" ]]; then
    echo "[-] No CVEs found in container images."
    exit 0
fi

echo "[+] Found $(wc -l < "$SCAN_DIR/cve_list.txt") CVEs."

if [[ "$SEARCH_METASPLOIT" == true ]]; then
    echo "[+] Searching for exploits in Metasploit..."
    rm -f "$SCAN_DIR/metasploit_results.txt"

    while read -r cve; do
        echo "[*] Searching for $cve in Metasploit..."
        msfconsole -q -x "search $cve; exit" | tee -a "$SCAN_DIR/metasploit_results.txt"
    done < "$SCAN_DIR/cve_list.txt"

    echo "[+] Search completed. Found exploits:"
    grep -E 'exploit/' "$SCAN_DIR/metasploit_results.txt" || echo "[-] No exploits found for detected CVEs."
else
    echo "[+] Skipping Metasploit exploit search."
fi

echo "[+] Scan completed. Results are stored in: $SCAN_DIR"
```
