# Evently – XML in JSON (Naloga 1)


Konzolna aplikacija v Pythonu, ki je del ideje
**Evently** (iskanje dogodkov in načrtovanje obiska). Aplikacija:

1. prebere tri povezane XML datoteke in jih deserializira v Python objekte,
2. poveže dogodke s prizorišči in vremenskimi napovedmi prek ID-jev,
3. filtrira dogodke in jih izpiše v tabeli,
4. rezultate izvozi v `filtrirano.json` in `filtrirano.xml`.

Podatki so izmišljeni primeri, ki posnemajo podatke iz Ticketmaster Discovery API
(dogodki) in Open-Meteo API (vremenska napoved).

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

## Zagon
```bash
python src/main.py --mesto Ljubljana --out primer_izhoda
python src/main.py --po 2026-11-30
python src/main.py --dez --najvec-cena 20
python src/main.py -h
```

## Filtri (kombinirajo se z logičnim IN)
| Parameter | Pomen |
|-----------|-------|
| `--mesto` | mesto prizorišča |
| `--kategorija` | Glasba, Šport, Festival, Kultura, Komedija |
| `--po` / `--pred` | datum dogodka > / < YYYY-MM-DD |
| `--najvec-cena` | cena vstopnice <= N EUR (dogodki z neznano ceno izpadejo) |
| `--prizorisce` | ID ali del naziva prizorišča |
| `--dez` | dogodki z napovedanimi padavinami >= 1 mm |
| `--data`, `--out` | vhodna in izhodna mapa |
