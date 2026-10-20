# Evently – XML in JSON (Naloga 1)


Konzolna aplikacija v Pythonu, ki je del ideje
**Evently** (iskanje dogodkov in načrtovanje obiska). Aplikacija:

1. prebere tri povezane XML datoteke in jih deserializira v Python objekte,
2. poveže dogodke s prizorišči in vremenskimi napovedmi prek ID-jev,
3. filtrira dogodke in jih izpiše v tabeli,
4. rezultate izvozi v `filtrirano.json` in `filtrirano.xml`.

Podatki so izmišljeni primeri, ki posnemajo podatke iz Ticketmaster Discovery API
(dogodki) in Open-Meteo API (vremenska napoved).

## Naloga 2 – Ticketmaster spletni scraper

`src/scraper_ticketmaster.js` s Puppeteerjem odpre javne Ticketmasterjeve
spletne strani, prebere podatke iz HTML-ja in jih združi v JSON. Ne uporablja
Ticketmaster API-ja ali API-ključa. Za vsak dogodek shrani samo izvajalca,
mesto, državo, datum in začetek dogodka.

Namestitev odvisnosti in zagon iz korenske mape projekta:

```powershell
npm install
node src/scraper_ticketmaster.js
```

Scraper na vsakem trgu poišče glavno kategorijo za koncerte/glasbo na 16
evropskih straneh Ticketmaster (Avstrija,
Belgija, Češka, Danska, Finska, Francija, Nemčija, Irska, Italija, Nizozemska,
Norveška, Poljska, Španija, Švedska, Švica in Združeno kraljestvo) in zbere
glasbene dogodke od dneva zagona do treh mesecev naprej; začetni datum pošlje
Ticketmasterju tudi prek parametra `datestart`. Če stran dogodka izrecno
navaja drugo državo, se dogodek ne pripiše trgu, na katerem je bil najden.
JSON se shrani v `data/dogodki_ticketmaster.json` v isti obliki kot prej:
`izvajalec`, `mesto`, `drzava`, `datum` in `zacetek`. Zapisi brez izvajalca,
mesta, datuma ali ure se preskočijo.

## Struktura
- `data/prizorisca.xml` – 12 prizorišč (id: P01–P12)
- `data/dogodki.xml` – 15 dogodkov (id: E001–E015, `prizoriscId` -> prizorišče)
- `data/napovedi.xml` – 15 napovedi (id: W001–W015, `dogodekId` -> dogodek)
- `src/` – izvorna koda (`main.py`, `models.py`, `loader.py`, `filters.py`, `exporter.py`)
- `primer_izhoda/` – primer rezultata (`filtrirano.json`, `filtrirano.xml`, `konzola.txt`)

## Povezave
prizorisca.id <- dogodki.prizoriscId; dogodki.id <- napovedi.dogodekId

## Posebnosti podatkov
- datumi v formatu YYYY-MM-DD
- prazne vrednosti (npr. `<cenaVstopnice></cenaVstopnice>`) in izpuščena polja
  (npr. `povezava`, `veter`) se preberejo kot `None`, v JSON izvozijo kot `null`,
  v XML kot prazen element

## Zagon – Naloga 1 (Python)

Ukaze zaženite v korenski mapi projekta `Evently` (mapi, ki vsebuje `src`,
`data` in `primer_izhoda`). Potrebujete Python 3; dodatnih knjižnic ni treba
nameščati.

```powershell
# Preveri, ali je Python na voljo
python --version

# Prikaži vse možnosti
python src/main.py --help

# Zaženi in izvozi rezultate v primer_izhoda
python src/main.py --out primer_izhoda

# Primeri filtrov
python src/main.py --mesto Ljubljana --out primer_izhoda
python src/main.py --kategorija Glasba --out primer_izhoda
python src/main.py --po 2026-11-30 --out primer_izhoda
python src/main.py --dez --najvec-cena 20 --out primer_izhoda
```

Rezultati se shranijo v `filtrirano.json` in `filtrirano.xml` v izbrani izhodni
map. Vhodne XML datoteke so v `data`; drugo mapo lahko podate z `--data`.

```powershell
python src/main.py --data data --out primer_izhoda
```

## Primeri filtrov – Naloga 1

Filtri se lahko kombinirajo; uporabijo se hkrati (logični IN).

```powershell
python src/main.py --mesto Ljubljana
python src/main.py --kategorija Kultura
python src/main.py --po 2026-11-30 --pred 2026-12-31
python src/main.py --prizorisce P01
python src/main.py --dez
python src/main.py --najvec-cena 20
```

## Možnosti filtrov

| Parameter | Pomen |
|-----------|-------|
| `--mesto` | mesto prizorišča |
| `--kategorija` | Glasba, Šport, Festival, Kultura, Komedija |
| `--po` / `--pred` | dogodek po / pred datumom `YYYY-MM-DD` |
| `--najvec-cena` | največja cena vstopnice v EUR |
| `--prizorisce` | ID ali del naziva prizorišča |
| `--dez` | samo dogodki z napovedanimi padavinami vsaj 1 mm |
| `--data`, `--out` | vhodna in izhodna mapa |
