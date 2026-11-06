# Free cloud server for the portfolio project

Optional infrastructure notes for hosting the support service on an Ubuntu VM.
The result is a Linux VM with Docker/Compose, a deploy account, key-based SSH,
and application ports closed to the internet. Steps 10 onward deploy the application.

Prepared on 2026-11-04. No cloud account or VM has been created by these files.
The scripts have not been executed on a VM; follow the checkpoints below.

The container examples from section 10 onward assume a `Dockerfile` and
`docker-compose.yml`, which are not included in the current checkout. Treat those
sections as a deployment plan until the container files have been supplied and
verified. For the current application setup, use [the runbook](RUNBOOK.md).

## 1. Create the free account yourself

Start at [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/).
Use the Free Tier account and complete identity/card verification. A temporary
verification hold is possible. Oracle states that billing requires an account
upgrade; this guide does not use a paid account. See [signup details](https://docs.oracle.com/en-us/iaas/Content/GSG/Tasks/signingup_topic-Sign_Up_for_Free_Oracle_Cloud_Promotion.htm).

Select your home region carefully: free compute must be provisioned there.
Choose only resources explicitly eligible for **Always Free**, not services merely
covered by promotional trial credits. [Free-tier conditions](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm).

## 2. Generate the SSH key on Windows

In PowerShell:

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.ssh" | Out-Null
Test-Path "$env:USERPROFILE\.ssh\oracle-support"
```

If the test returns `True`, pick a different key filename throughout this guide.
If it returns `False`, generate the new key:

```powershell
ssh-keygen -t ed25519 -a 100 -f "$env:USERPROFILE\.ssh\oracle-support" -C "ai-support-portfolio"
Get-Content "$env:USERPROFILE\.ssh\oracle-support.pub" | Set-Clipboard
```

Set a passphrase. If that filename already exists, choose a new filename instead
of overwriting a key. Upload only the `.pub` content to Oracle. Keep the private
key on your PC; it does not belong in this repository.

## 3. Create one Ubuntu VM

In OCI Console, open **Compute → Instances → Create instance**.

| Setting | Value |
|---|---|
| Name | `ai-support-portfolio` |
| Image | Official Canonical Ubuntu 24.04 LTS, compatible with ARM |
| Shape | `VM.Standard.A1.Flex`, explicitly Always Free eligible |
| Size | 1 OCPU, 6 GB RAM |
| Boot disk | Default/minimum size, approximately 50 GB |
| Networking | A public subnet, internet-gateway route, public IPv4 |
| SSH public key | Paste `oracle-support.pub` |

Current A1 Always Free totals are 2 OCPUs/12 GB RAM across the tenancy; the
suggested VM uses half. Check the console estimate before creating anything.
Free capacity can be unavailable, and idle instances can be reclaimed. If capacity
is unavailable, try another availability domain in the home region or wait; a
paid-account upgrade is not part of this setup. [Current resource limits](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).

Record the VM's public IPv4. In commands below, replace `YOUR_SERVER_IP` with it.
Do not create an additional database, public load balancer, or NAT gateway for
this project. Your existing Supabase database remains the datastore.

## 4. Restrict SSH at Oracle's network boundary

Find your current public IPv4 in PowerShell:

```powershell
curl.exe -4 https://ifconfig.me
```

For this VM's subnet, edit the SSH ingress rule in its security list:

| Field | Value |
|---|---|
| Direction | Ingress |
| Stateful | Yes |
| Source type | CIDR |
| Source CIDR | Your public IPv4 followed by `/32` |
| Protocol | TCP |
| Source port | All |
| Destination port | `22` |

Remove/replace an existing SSH allow rule from `0.0.0.0/0` or `::/0`.
Review every attached security list and NSG: their allowances are combined, so a
restrictive NSG cannot cancel a broader rule elsewhere. Keep essential default
ICMP rules and outbound access. Leave application ports such as 8080, 8000, 3000, 80,
and 443 closed. [Oracle network-rule behavior](https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/securityrules.htm).

Do not add a home-router port-forwarding rule. The server makes outbound calls
to Gmail, Groq, and Supabase. This project uses Gmail's HTTPS API, not SMTP port 25.

If your home/VPN IP changes, update the OCI source CIDR before reconnecting.
These network changes should target this new project's subnet/VM, not shared infrastructure.

## 5. First SSH connection

Oracle's Ubuntu image uses the initial account `ubuntu`, not `root`.
[Oracle SSH guidance](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/connect-to-linux-instance.htm).

```powershell
ssh -o IdentitiesOnly=yes -i "$env:USERPROFILE\.ssh\oracle-support" ubuntu@YOUR_SERVER_IP
```

On the first connection, validate the server host-key fingerprint against a
trusted console channel or boot diagnostics before accepting it. The fingerprint
for Oracle's serial-console endpoint is a different key from the VM's own host key.
The instance's **Console history** can capture recent boot output; inspect it for
the guest's SSH host-key fingerprints. If they are absent, use trusted console
access to run `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` inside the guest.
[Capturing console history](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/displayingconsole.htm).

On the server:

```bash
whoami
uname -m
cat /etc/os-release
sudo apt-get update
sudo apt-get upgrade -y
```

Expect `ubuntu`, `aarch64` on A1, and Ubuntu 24.04. Reboot if the update requests
one, then reconnect before proceeding.

## 6. Install Docker and create deploy

From a second **Windows PowerShell** window, in the project root:

```powershell
scp -o IdentitiesOnly=yes -i "$env:USERPROFILE\.ssh\oracle-support" scripts/server/bootstrap-ubuntu.sh ubuntu@YOUR_SERVER_IP:/home/ubuntu/ai-support-bootstrap.sh
scp -o IdentitiesOnly=yes -i "$env:USERPROFILE\.ssh\oracle-support" scripts/server/harden-ssh.sh ubuntu@YOUR_SERVER_IP:/home/ubuntu/ai-support-harden-ssh.sh
```

Back in the **ubuntu SSH session**:

```bash
sudo bash /home/ubuntu/ai-support-bootstrap.sh
sudo passwd deploy
```

Set a local password for `sudo`; SSH passwords will be disabled in the next phase.
The bootstrap installs Docker Engine/Compose from Docker's repository, uses the
VM's detected CPU architecture, creates `deploy`, and copies the initial public
key authorization. Existing deploy keys are preserved on reruns.
[Docker installation](https://docs.docker.com/engine/install/ubuntu/).

The Docker group grants powerful host access; protect the deploy key accordingly.
[Docker group behavior](https://docs.docker.com/engine/install/linux-postinstall/).

The scripts leave Oracle's existing host firewall in place. Oracle specifically
advises against enabling UFW on its Ubuntu images; use the network rules above.
[Oracle image guidance](https://docs.oracle.com/en-us/iaas/Content/Compute/References/bestpracticescompute.htm).

## 7. Verify deploy before hardening

Keep the original ubuntu session open. In a **new PowerShell window**:

```powershell
ssh -o IdentitiesOnly=yes -i "$env:USERPROFILE\.ssh\oracle-support" deploy@YOUR_SERVER_IP
```

In this new **deploy SSH session**:

```bash
whoami
id
sudo -v
docker ps
docker compose version
docker run --rm hello-world
```

Expect `deploy`, membership in `sudo` and `docker`, working sudo authentication,
and a successful Docker test. If a group is missing, reconnect after correcting it.
Do not continue until this separate login works.

## 8. Apply and verify key-only SSH

From the tested **deploy SSH session**:

```bash
sudo bash /home/ubuntu/ai-support-harden-ssh.sh
sudo /usr/sbin/sshd -T | grep -E '^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication|pubkeyauthentication) '
```

The script checks syntax and effective settings before reloading SSH, and restores
its previous configuration if validation/reload fails. Required settings are root
login off, password/keyboard-interactive login off, public-key login on. It leaves
the original `ubuntu` key account available for recovery.
[Ubuntu SSH configuration](https://ubuntu.com/server/docs/how-to/security/openssh-server/).

Keep both existing sessions open and test another fresh deploy login. Then verify
that an attempted root login fails. A rejected root login is the expected outcome:

```powershell
ssh -o IdentitiesOnly=yes -i "$env:USERPROFILE\.ssh\oracle-support" deploy@YOUR_SERVER_IP "whoami; docker ps"
ssh -o IdentitiesOnly=yes -i "$env:USERPROFILE\.ssh\oracle-support" root@YOUR_SERVER_IP
```

## 9. Save an SSH alias

Append this block to `%USERPROFILE%\.ssh\config` using your editor. Keep any
existing hosts, and replace `YOUR_SERVER_IP`.

```sshconfig
Host support-vps
    HostName YOUR_SERVER_IP
    User deploy
    IdentityFile ~/.ssh/oracle-support
    IdentitiesOnly yes
    ServerAliveInterval 30
```

Check from PowerShell:

```powershell
ssh support-vps "whoami; docker ps; docker compose version"
```

This completes the server-preparation stage. Later deployment can use
`ssh support-vps`. Installing Docker on this VM does not
require Docker on your Windows PC. Build/run images on the VM with its native
architecture; the existing Windows `.venv` cannot be copied into a Linux container.

For the private API on server port 8080, the access pattern is:

```powershell
ssh -N -L 127.0.0.1:8080:127.0.0.1:8080 support-vps
```

This tunnel only becomes useful after the application is deployed with its server
port bound to loopback. Docker-published ports can bypass a host firewall, so retain
the cloud rules and explicitly bind private services to `127.0.0.1`.

## 10. Prepare the repository on Windows

This deployment plan uses your Oracle alias, Groq models, and existing hosted
database. Supply and verify a `Dockerfile`, `.dockerignore`, and
`docker-compose.yml` before following the container-specific commands below.

The image installs locked production dependencies using uv 0.9.21 (the version
verified locally), then runs as an unprivileged container user. Build on the Oracle
VM so Python and dependencies match its ARM architecture; no `linux/amd64` platform
override is needed. Only the app and dependency metadata enter the build context.
[uv container guidance](https://docs.astral.sh/uv/guides/integration/docker/).

From the project root in **Windows PowerShell**:

```powershell
git status --short
git check-ignore .env credentials.json .venv
git ls-files .env credentials.json
```

The ignore check should list all three paths. The last command must print nothing.
If a secret is already tracked, stop and remove it from tracking before publishing;
rotate exposed credentials if they were pushed. Review staged filenames and changes
before committing. Create an empty private GitHub repository, then use your own URL
in the commands below. A private repo can later be accompanied by a sanitized public
portfolio page or demo recording.

```powershell
git add .
git diff --cached --stat
git diff --cached
git commit -m "Prepare Oracle Docker deployment"
git branch -M main
git remote -v
```

If no `origin` exists, add it; otherwise verify its existing URL instead:

```powershell
git remote add origin https://github.com/YOUR_GITHUB_USER/ai-customer-support.git
git push -u origin main
```

GitHub credentials used on your PC are separate from the server's read-only key.
Do not include tokens in repository URLs.

## 11. Give the server read-only GitHub access

Connect with `ssh support-vps`; all Linux commands from here run as **deploy**.
Generate a different key from the one used to log into Oracle:

```bash
install -d -m 700 ~/.ssh
test ! -e ~/.ssh/github-support
```

Continue only if the test succeeds; otherwise preserve that key and inspect it.

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github-support -N '' -C 'support-repository-read-only'
cat ~/.ssh/github-support.pub
```

In the GitHub repository settings, add this public key as a **Deploy key**, with
write access disabled. Add this host block to the server's `~/.ssh/config`, preserving
any existing blocks:

```sshconfig
Host github-support
    HostName github.com
    User git
    IdentityFile ~/.ssh/github-support
    IdentitiesOnly yes
```

```bash
chmod 600 ~/.ssh/config
ssh -T github-support
```

Validate GitHub's host key against its [published fingerprints](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/githubs-ssh-key-fingerprints).
Successful authentication says GitHub provides no shell; an exit status of 1 is
normal for this authentication test. Then clone:

```bash
cd ~
git clone git@github-support:YOUR_GITHUB_USER/ai-customer-support.git
cd ~/ai-customer-support
git rev-parse --short HEAD
uname -m
```

## 12. Configure secrets and database connectivity

Create `.env` on the server, once, without sending it through Git:

```bash
umask 077
cp -n .env.example .env
chmod 600 .env
nano .env
```

Fill in the Google OAuth credentials and refresh token from your working local
setup. Keep these model settings, using your real Groq key:

```dotenv
GROQ_API_KEY='YOUR_REAL_GROQ_KEY'
CLASSIFIER_MODEL=groq:openai/gpt-oss-20b
AGENT_MODEL=groq:qwen/qwen3.8-27b
POLL_INTERVAL_SECONDS=600
```

Use a strong dashboard password as well, in preparation for the dashboard stage.
Single-quote secret values in this file so Compose treats dollar signs literally.
Do not print `.env` or the expanded Compose configuration in shared logs.

For `DATABASE_URL`, use the **Session pooler** connection string from your Supabase
project's Connect dialog when the VM/container uses IPv4. Use its provided hostname,
username, and port (session mode normally uses 5432), your database password with
reserved characters URL-encoded, and `sslmode=require`. Do not substitute a Supabase
API key. Direct database connections can require IPv6; a public IPv4 on the VM alone
does not provide container IPv6. [Supabase connection options](https://supabase.com/docs/guides/database/connecting-to-postgres).

Existing remote migrations and knowledge-base rows must already be present. Keep
using the working remote migration workflow from Windows; do not create a local
Supabase database on the Oracle VM for this deployment.

If your Supabase plan offers network restrictions, include the server and your PC
before enforcing them. Otherwise keep TLS and strong credentials. RLS does not
make a leaked privileged Postgres password safe; database credentials need protection.

## 13. Build and check the API first

Still on the server, as deploy:

```bash
cd ~/ai-customer-support
docker compose config --quiet
docker compose build
docker compose up -d --wait --wait-timeout 120 api
docker compose ps
curl --fail http://127.0.0.1:8080/health
```

The API should become healthy and return `{"status":"ok"}`. Its health check only
tests HTTP; it does not prove Gmail, Groq, or database access. The poller is not
started by `up -d api`. Compose health checks and process restart policies have
different roles; an unhealthy but running container is not automatically restarted
by `unless-stopped`. [Compose readiness](https://docs.docker.com/compose/how-tos/startup-order/).

Run a read-only configuration/database/Gmail preflight using the same image:

```bash
docker compose run --rm --no-deps poller python -m app.preflight
```

Expect six knowledge-base sections and successful Gmail access. This does not run
the polling loop, send mail, or make an inference request. Agent initialization
checks local configuration; it cannot confirm the key's live quota or model access.

## 14. Move polling from the PC to Oracle

Stop the local watchfiles/poller with Ctrl+C and confirm that no other deployment
is polling this inbox. Use exactly one poller instance. Starting the server poller
will process eligible messages already waiting in the demo inbox.

Then, on the server:

```bash
docker compose up -d poller
docker compose ps
docker compose logs --tail=50 poller
docker compose logs -f poller
```

Ctrl+C while following logs stops the log viewer, not the detached service.
The API publishes only `127.0.0.1:8080`; the poller publishes no port. Logs rotate
within the configured limits. Do not open 8080 in any OCI security list or NSG.

Send one benign test email yourself to the dedicated demo inbox. Check the reply,
poller logs, and Supabase event row. Allow the configured interval plus processing
and Groq backoff time. Container `Up` alone is not proof that mail is being processed:
the loop logs provider failures while staying alive.

## 15. Verify private access from Windows

Open a PowerShell terminal and leave this tunnel running:

```powershell
ssh -N -L 127.0.0.1:8080:127.0.0.1:8080 support-vps
```

In another terminal:

```powershell
curl.exe --fail http://127.0.0.1:8080/health
Test-NetConnection YOUR_SERVER_IP -Port 8080
```

The tunnel health request should succeed. Direct public access to port 8080 should
fail. Close the tunnel when finished. This is a private backend deployment; a
public portfolio can link to code, architecture, and a sanitized demonstration.

## 16. Updates, recovery, and operating checks

After committing/pushing an update from Windows, use the deploy account on Oracle:

```bash
cd ~/ai-customer-support
git status --short
git pull --ff-only
docker compose build
```

Review the build result before restarting. Avoid interrupting active email handling.
When ready, stop the poller, update/check the API, and start one poller again:

```bash
docker compose stop poller
docker compose up -d --wait --wait-timeout 120 api
curl --fail http://127.0.0.1:8080/health
docker compose up -d poller
docker compose ps
docker compose logs --tail=50 poller
```

Changes to `.env` require container recreation, for example
`docker compose up -d --force-recreate poller`; a plain restart does not reload
Compose's environment-file values. Never use `docker compose down -v` as a routine
update command. The authoritative tickets/messages/knowledge base live in Supabase.

For Docker permission errors, reconnect as deploy to refresh group membership.
If groups are actually missing, use the retained **ubuntu** key login and run
`sudo usermod -aG sudo,docker deploy`, then reconnect as deploy. Do not try root SSH.

For a build architecture error, check `uname -m` and rebuild on the VM rather than
copying a Windows virtual environment or forcing an x86 image. For database errors,
check the pooler connection string/TLS and applicable Supabase network restrictions.
For OAuth failures, re-authorize the demo account locally and securely replace its
server refresh token. For Groq 429s, inspect quota/reset details; more polling does
not increase the allowance. Use `docker compose stop poller` to pause email processing.

The deployment files are prepared, but image builds, ARM dependency installation,
provider connectivity, reboots, and mail delivery still require verification on
your actual VM. No cloud resources or email actions were executed while preparing
this guide.

## Portfolio evidence

Save sanitized screenshots of the free VM, restricted network rule, successful
deploy login, Docker/Compose versions, and later application health. Add a diagram,
demo recording, and evaluation results to the portfolio. Keep `.env`, private keys,
credentials, and customer messages out of published material. Describe deployment
on OCI only after you have actually provisioned and verified the server.

Free hosting does not increase Groq's API quota or change Supabase's plan limits.
