#!/usr/bin/env bash
# Run only AFTER a separate SSH login as deploy has been tested.
set -Eeuo pipefail

if [[ $EUID -ne 0 || ${SUDO_USER:-} != deploy ]]; then
    echo 'Log in as deploy, then run this script using sudo.' >&2
    exit 1
fi
if [[ ! -s /home/deploy/.ssh/authorized_keys ]]; then
    echo 'The deploy account has no authorized public key; stopping.' >&2
    exit 1
fi

config=/etc/ssh/sshd_config.d/00-ai-support-hardening.conf
backup=''
if [[ -e $config ]]; then
    backup=$(mktemp /etc/ssh/sshd_config.d/ai-support-backup.XXXXXX)
    cp -p -- "$config" "$backup"
fi

rollback() {
    trap - ERR
    if [[ -n $backup ]]; then
        cp -p -- "$backup" "$config"
    else
        rm -f -- "$config"
    fi
    echo 'SSH validation/reload failed; restored the previous configuration.' >&2
    /usr/sbin/sshd -t && systemctl reload ssh.service || true
    exit 1
}
trap rollback ERR

cat > "$config" <<'CONFIG'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
CONFIG
chmod 0644 "$config"
/usr/sbin/sshd -t
effective=$(/usr/sbin/sshd -T)
for required in 'permitrootlogin no' 'passwordauthentication no' \
                'kbdinteractiveauthentication no' 'pubkeyauthentication yes'; do
    if ! grep -Fxq "$required" <<< "$effective"; then
        echo "Effective SSH setting does not match: $required" >&2
        rollback
    fi
done
systemctl reload ssh.service
trap - ERR
printf '%s\n' 'SSH hardened. Keep this session open and test a fresh deploy login.'
printf '%s\n' 'The original ubuntu key login remains available as a recovery account.'
if [[ -n $backup ]]; then
    printf 'Previous managed configuration: %s\n' "$backup"
fi
