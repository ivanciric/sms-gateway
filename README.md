# SMS Gateway

SMS gateway za Raspberry Pi 4 sa Huawei/ZTE USB modemom. Omogućava slanje SMS poruka preko REST API-ja sa API key autentifikacijom, i prosleđivanje dolaznih poruka na callback URL-ove.

## Funkcionalnosti

- **REST API** za slanje SMS (`POST /api/v1/sms/send`) sa `X-API-Key` ili `Authorization: Bearer`
- **Kontrol panel** — prijava email/lozinka, upravljanje API ključevima i callback adresama
- **Admin panel** — pregled svih korisnika, kreiranje novih, izdavanje/poništavanje ključeva
- **Automatsko enkodiranje** — GSM7 ili UCS2, generisanje `sms_time` formata
- **Inbound SMS** — polling modema i prosleđivanje na callback URL-ove

## Brzi start (rPi)

```bash
# Kloniraj projekat na rPi
cd /home/pi
git clone <repo-url> sms-gateway
cd sms-gateway

# Instaliraj Node.js 20+ (ako nije instaliran)
# curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
# sudo apt install -y nodejs

npm install
cp .env.example .env
# Uredi .env — promeni SECRET_KEY!

npm run seed
npm start
```

Kontrol panel: `http://<rpi-ip>:8080/panel/login`

## Seed korisnici

| Email | Lozinka | Uloga | Projekat |
|-------|---------|-------|----------|
| admin@sms-gateway.local | admin123 | admin | Administracija |
| marko@example.com | marko123 | user | Parking Sistem |
| ana@example.com | ana123 | user | Alarm Notifikacije |

API ključevi se ispisuju prilikom `npm run seed`.

## API

### Slanje SMS

```bash
curl -X POST http://<gateway>:8080/api/v1/sms/send \
  -H "X-API-Key: sgw_..." \
  -H "Content-Type: application/json" \
  -d '{"to":"063308105","message":"test"}'
```

Odgovor:

```json
{
  "success": true,
  "encode_type": "GSM7_default",
  "sms_time": "26;07;30;19;11;11;+2",
  "modem_response": {"result": "success"}
}
```

### Inbound callback

Kada stigne SMS na modem, gateway šalje POST na callback URL svih aktivnih ključeva:

```json
{
  "from": "381631234567",
  "text": "pozar-psnvreoci-veliki",
  "messageId": "123"
}
```

- `from` — broj pošiljaoca (normalizovan, npr. `063308105` → `38163308105`)
- `text` — sadržaj SMS-a
- `messageId` — ID sa modema, za deduplikaciju (opciono)

## Pristup sa interneta

1. **Port forwarding** na ruteru — prosledi port 8080 (ili 443) na rPi
2. **Nginx reverse proxy + Let's Encrypt** (preporučeno):

```nginx
server {
    listen 443 ssl;
    server_name sms.example.com;

    ssl_certificate /etc/letsencrypt/live/sms.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sms.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Postavi `SESSION_COOKIE_SECURE=true` u `.env` kada koristiš HTTPS.

## Systemd servis

```bash
sudo cp deploy/sms-gateway.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable sms-gateway
sudo systemctl start sms-gateway
```

## Konfiguracija (.env)

| Promenljiva | Opis | Default |
|-------------|------|---------|
| SECRET_KEY | JWT secret za sesije | — |
| HOST | Bind adresa | 0.0.0.0 |
| PORT | Port | 8080 |
| MODEM_URL | URL modema | http://192.168.0.1 |
| MODEM_POLL_INTERVAL | Interval polling-a (sek) | 15 |
| DATABASE_PATH | SQLite baza | ./data/sms_gateway.db |

## Struktura

```
src/
  index.js          — Express server
  config.js         — Konfiguracija
  auth/             — Sesije, API key auth
  db/               — SQLite schema
  sms/
    encoder.js      — GSM7/UCS2 enkodiranje, sms_time
    modem.js        — HTTP komunikacija sa modemom
    poller.js       — Inbound SMS polling
  routes/
    api.js          — REST API
    auth.js         — Login/logout
    panel.js        — Admin panel
views/              — EJS templejti
public/             — CSS
```
