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

## Naloga 4 – LLM predlogi

Na strani je obrazec, kjer uporabnik vnese kraj in državo, datum, vrsto dogodka
ter po želji svoje interese. Strežnik iz teh vrednosti sestavi dinamičen prompt
in pošlje zahtevo Groq Chat Completions API-ju, ki vrne JSON. Strežnik JSON
razčleni in preveri ter ga deserializira v razreda `OdgovorLLM` in
`PredlogAktivnosti` v `src/llm.js`. Uporabnik izbere od enega do pet predlogov.
Predlogi so ideje, ne potrjeni dogodki ali urniki.

Za uporabo obrazca LLM potrebuješ Groq API ključ. Odpri datoteko `.env` v
korenski mapi projekta in vpiši ključ za `GROQ_API_KEY`:

```env
GROQ_API_KEY=tvoj_groq_api_kljuc
# GROQ_MODEL=openai/gpt-oss-20b
```

Datoteka `.env` je izključena iz Gita. Po shranjevanju zaženi `npm run open-data`;
strežnik ključ naloži ob zagonu, zato ga ni treba vsakič znova vnašati v CMD.
Po spremembi ključa strežnik ustavi s Ctrl+C in ga ponovno zaženi. Vzorec je v
`.env.example`. Za odgovor, ki sledi JSON shemi, je privzeti model
`openai/gpt-oss-20b`; po želji ga lahko spremeniš z okoljsko spremenljivko
`GROQ_MODEL`. Groqov brezplačni paket ima omejitve hitrosti in dnevne porabe.

## Naloga 5 – gRPC

Datoteka `src/evently.proto` definira service `EventlyData` in strukturirana
Protocol Buffers sporočila. Storitev izvede štiri RPC klice: `GetDataset`,
`GetMeasures`, `GetChartData` in strežniško pretakanje `StreamChartData`.
Izbira meritve v grafu sproži običajen RPC, izbira vrste prireditev pa sproži
pretakanje; vrstice se prikažejo sproti. HTTP strežnik v Node.js posreduje
zahteve iz brskalnika do lokalne gRPC storitve.

Za zagon iz korenske mape projekta:

```cmd
npm install
npm run open-data
```

Odpri `http://localhost:3000`. Spletni strežnik posluša na vratih 3000, gRPC
strežnik pa lokalno na `127.0.0.1:50051`.
