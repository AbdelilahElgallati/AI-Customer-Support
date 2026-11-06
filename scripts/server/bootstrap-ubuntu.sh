#!/usr/bin/env bash
# Run on a NEW Ubuntu 24.04 VM: sudo bash bootstrap-ubuntu.sh
set -Eeuo pipefail

if [[ $EUID -ne 0 ]]; then
    echo 'Run with sudo from the initial ubuntu account.' >&2
    exit 1
fi

source /etc/os-release
if [[ ${ID:-} != ubuntu || ${VERSION_ID:-} != 24.04 ]]; then
    echo 'This bootstrap targets the official Ubuntu 24.04 image.' >&2
    exit 1
fi

initial_user=${SUDO_USER:-}
if [[ $initial_user != ubuntu ]]; then
    echo 'Connect as ubuntu and run sudo bash bootstrap-ubuntu.sh.' >&2
    exit 1
fi
initial_home=$(getent passwd "$initial_user" | cut -d: -f6)
key_source="$initial_home/.ssh/authorized_keys"
if [[ ! -s $key_source ]]; then
    echo 'No SSH public key found on the ubuntu account; stopping.' >&2
    exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git openssh-server

# Official Docker repository; architecture follows the VM (ARM or x86).
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
architecture=$(dpkg --print-architecture)
cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: noble
Components: stable
Architectures: $architecture
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker.service

if ! id deploy >/dev/null 2>&1; then
    adduser --disabled-password --gecos '' deploy
fi
deploy_home=$(getent passwd deploy | cut -d: -f6)
if [[ $deploy_home != /home/deploy ]]; then
    echo 'Existing deploy account has an unexpected home; stopping.' >&2
    exit 1
fi
usermod -aG sudo,docker deploy
install -d -m 0700 -o deploy -g deploy /home/deploy/.ssh
if [[ -e /home/deploy/.ssh/authorized_keys ]]; then
    if ! cmp -s "$key_source" /home/deploy/.ssh/authorized_keys; then
        echo 'Existing deploy keys differ. Preserved them; review before continuing.' >&2
    fi
else
    install -m 0600 -o deploy -g deploy "$key_source" /home/deploy/.ssh/authorized_keys
fi

docker --version
docker compose version
id deploy
cat <<'NEXT'

Bootstrap finished. SSH authentication and the firewall were not changed.
1. Run: sudo passwd deploy
2. Keep this ubuntu session open.
3. Open a NEW SSH session as deploy using your private key.
4. In that new session, check: whoami; sudo -v; docker ps
5. Only then follow the guide's SSH-hardening step.
NEXT
