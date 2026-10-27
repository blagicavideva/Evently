# Evently

Spletna aplikacija za iskanje dogodkov in načrtovanje njihovega obiska.

## Ticketmaster scraper

Scraper z uporabo Puppeteerja bere javno prikazane strani Ticketmasterjevih evropskih trgov. Podatke shrani v `data/dogodki_ticketmaster.json`.

### Zahteve

- Node.js in npm
- Internetna povezava

### Namestitev

V terminalu, v korenski mapi projekta, zaženi:

```cmd
npm install
```

### Zagon

Za branje vseh nastavljenih trgov Ticketmaster zaženi:

```cmd
npm run scrape
```

Enakovreden ukaz je:

```cmd
node src/scraper_ticketmaster.js
```

Scraper zbere dogodke od datuma zagona do treh mesecev naprej. Pri uspešnem zagonu prepiše izhodno datoteko `data/dogodki_ticketmaster.json` z novimi rezultati.

### Podatki v izhodni datoteki

Vsak dogodek vsebuje:

- `izvajalec` – ime izvajalca oziroma naslov dogodka
- `mesto` – mesto dogodka
- `prizorisce` – prizorišče, kadar ga Ticketmaster prikaže
- `drzava` – država Ticketmasterjevega trga
- `datum` – datum v obliki `LLLL-MM-DD`
- `zacetek` – ura začetka v obliki `UU:MM`

Polje `prizorisce` je lahko `null`, če ga scraper na javno prikazani strani ne najde. Število najdenih dogodkov je odvisno od trenutno objavljenih dogodkov in podatkov, ki jih strani prikažejo.

## Naloga 3 – Odprti podatki

Podmapa `public/` vsebuje spletni prikaz uradnega PC-Axis nabora SURS o
prireditvah in obiskovalcih v ustanovah z odrsko dejavnostjo. Ob odprtju strani
strežnik poskusi pridobiti najnovejšo datoteko `.PX` s portala SiStat; če vir
začasno ni dosegljiv, uporabi kopijo `data/prireditve_obiskovalci.px`. Strežnik
razčleni PC-Axis in aplikacija s knjižnico Chart.js prikaže dinamičen graf po
glasbenih zvrsteh ali vseh vrstah prireditev. Uporabnik lahko izbira število
prireditev ali obiskovalcev.

Za zagon iz korenske mape projekta:

```powershell
npm install
npm run open-data
```

Nato v brskalniku odprite `http://localhost:3000`. Vir je [OPSI – Prireditve in
obiskovalci v ustanovah z odrsko dejavnostjo po vrstah prireditve, Slovenija,
annually](https://podatki.gov.si/dataset/surs1080712s), podatke pa objavlja
Statistični urad Republike Slovenije pod licenco CC BY 4.0. Nabor ima referenčno
leto 2025; SURS opozarja, da se je s tem letom spremenil šifrant vrst prireditev.
