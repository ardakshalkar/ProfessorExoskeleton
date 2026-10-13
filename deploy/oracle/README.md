# The free arrangement: an Oracle Always Free VM behind Cloudflare

[`../cloudflare/README.md`](../cloudflare/README.md)'s route, on a machine that costs nothing:
Oracle's Always Free Ampere A1 VM (up to 4 ARM cores, 24 GB of memory, 200 GB of disk, no
expiry), with Cloudflare Tunnel and Access, which are free for up to 50 users. It replaces
[`../cloudflare/CONTAINERS.md`](../cloudflare/CONTAINERS.md), which needs Workers Paid.
The home is on an ordinary disk, so there is no FUSE and no emulated rename.

## 1. The VM (Oracle console)

- Shape **VM.Standard.A1.Flex**, 2–4 OCPU and 12–24 GB. Image **Ubuntu 24.04** (aarch64).
- Paste your SSH public key. Leave the security list at its default (22 only).
- If the console reports "out of capacity", try another availability domain or try again later.
  Free A1 capacity comes and goes.

## 2. The tunnel (Cloudflare Zero Trust → Networks → Tunnels)

Create a **cloudflared** tunnel and copy its token. Don't add a hostname yet.

## 3. On the VM

```bash
git clone https://github.com/ardakshalkar/ProfessorExoskeleton.git /tmp/exo
sudo TUNNEL_TOKEN='eyJ...' bash /tmp/exo/deploy/oracle/setup.sh ardak
```

It prints four checks. Every one has to read as stated before you go on.

## 4. The hostname

`professor.prof-exo.com` is the Containers Worker's custom domain until you remove it
(Workers → professor-exoskeleton → Domains). After that, add it to the tunnel as a
**Published application** → `http://127.0.0.1:8080`, with **Protect with Access** on. The
existing Access application *Professor Exoskeleton* is attached to the hostname and keeps
protecting it.

Then run the test that matters:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://professor.prof-exo.com/   # 302 to Access, never 200
```

## 5. The course

The workspace and the private roster don't come with the clone. Copy the course folder into
`/srv/dsh/ardak/courses/` and `~/.ainar/` into `/srv/dsh/ardak/.ainar/`, then
`chown -R ardak:ardak` both. Back up the paths listed under *Backing up* in
[`../README.md`](../README.md). Nothing else holds a copy of them.
