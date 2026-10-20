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
