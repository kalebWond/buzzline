# Deploying to Oracle Cloud (Always Free)

One small VM runs the Node server, which serves the web app, the API and the WebSocket on `127.0.0.1:4000`.
Caddy sits in front on ports 80 and 443 and gets a free HTTPS certificate for an
[sslip.io](https://sslip.io) hostname, so no domain is needed.

Games live in memory, so run exactly one server, and know that restarting it ends any game in progress.

## 1. Create the VM

1. Sign up at <https://signup.cloud.oracle.com>. It asks for a card to verify you; Always Free resources are not charged.
   Your **home region** is permanent, and free ARM capacity is scarce in busy regions, so pick a less popular region near you.
2. **Compute → Instances → Create instance**
   - Image: **Canonical Ubuntu 24.04**
   - Shape: **VM.Standard.A1.Flex** (Ampere ARM), 1 OCPU, 6 GB RAM is plenty.
     If it says *Out of host capacity*, try another availability domain, retry later, or use **VM.Standard.E2.1.Micro** (AMD, 1 GB RAM) and add swap (step 3).
   - Networking: keep **Assign a public IPv4 address** on.
   - SSH keys: upload your public key, or download the generated one.
3. Note the **public IP**, e.g. `129.146.10.20`. Your site will be `https://129-146-10-20.sslip.io`.
   The IP stays across reboots, but you lose it if the instance is terminated. To keep it for good, change it to a **reserved** public IP (free) under the VNIC's IPv4 addresses.

## 2. Open ports 80 and 443

Both of these are needed. Missing either one is the most common reason the site does not load.

**In Oracle Cloud:** Networking → Virtual cloud networks → your VCN → Security lists → Default security list → **Add ingress rules**:
source `0.0.0.0/0`, protocol TCP, destination port `80,443`.

**On the VM** (Oracle's Ubuntu images have their own iptables rules that block everything but SSH):

```bash
ssh ubuntu@129.146.10.20
N=$(sudo iptables -L INPUT --line-numbers | awk '/REJECT/ {print $1; exit}')
sudo iptables -I INPUT "$N" -p tcp -m multiport --dports 80,443 -m state --state NEW -j ACCEPT
sudo netfilter-persistent save
```

## 3. Install Node, Caddy and the app

```bash
# Only on the 1 GB E2.1.Micro shape: add 2 GB swap so npm and the build don't run out of memory
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Caddy
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy

# The app
git clone https://github.com/kalebWond/buzzline.git ~/buzzline
cd ~/buzzline
npm ci --include=dev
npm run build
```

If the repo is private, clone it over SSH with a [deploy key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys) instead.

## 4. Run it

```bash
# App as a service
sudo cp ~/buzzline/deploy/buzzline.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now buzzline
curl http://127.0.0.1:4000/api/health      # {"ok":true}

# HTTPS in front
sudo cp ~/buzzline/deploy/Caddyfile /etc/caddy/Caddyfile
echo 'BUZZLINE_HOST=129-146-10-20.sslip.io' | sudo tee /etc/default/caddy   # your IP, with dashes
sudo systemctl restart caddy
```

Open `https://129-146-10-20.sslip.io/host` on the big screen. Players use the same address on their phones.

## Updating

After pushing to `main`, between games:

```bash
ssh ubuntu@129.146.10.20 '~/buzzline/deploy/update.sh'
```

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Browser times out | Step 2: both the security list and iptables must allow 80 and 443 |
| Certificate errors | `sudo journalctl -u caddy -n 50`. Let's Encrypt must reach port 80, and `BUZZLINE_HOST` must match the IP |
| 502 Bad Gateway | `sudo journalctl -u buzzline -n 50`. The app isn't running |
| Page loads but the game never connects | Check the browser console for `/ws` errors, and `sudo journalctl -u caddy -n 50` |

## Keeping the VM

Oracle may reclaim Always Free instances that sit nearly idle for a week.
To avoid that, upgrade the account to **Pay As You Go**: Always Free resources stay free, and only resources outside the free limits are billed.
