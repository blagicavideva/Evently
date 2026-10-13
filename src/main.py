"""Evently - XML in JSON: branje, povezovanje, filtriranje, izvoz."""
import argparse
import sys
from datetime import date
from pathlib import Path

from exporter import izvozi_json, izvozi_xml
from filters import filtriraj
from loader import nalozi_vse


def datum_arg(s: str) -> date:
    try:
        return date.fromisoformat(s)
    except ValueError:
        raise argparse.ArgumentTypeError(f"'{s}' ni veljaven datum (YYYY-MM-DD)")


def izpisi_tabelo(glave, vrstice) -> None:
    if not vrstice:
        print("(ni zadetkov)")
        return
    sirine = [max(len(str(g)), *(len(str(v[i])) for v in vrstice))
              for i, g in enumerate(glave)]
    print(" | ".join(str(g).ljust(s) for g, s in zip(glave, sirine)))
    print("-+-".join("-" * s for s in sirine))
    for v in vrstice:
        print(" | ".join(str(x).ljust(s) for x, s in zip(v, sirine)))


def main() -> None:
    p = argparse.ArgumentParser(description="Evently: filtriranje dogodkov in izvoz v JSON/XML.")
    p.add_argument("--data", default="data", help="mapa z XML datotekami")
    p.add_argument("--out", default=".", help="mapa za izhodne datoteke")
    p.add_argument("--mesto", help="mesto prizorišča")
    p.add_argument("--kategorija", help="Glasba, Šport, Festival, Kultura, Komedija")
    p.add_argument("--po", type=datum_arg, help="datum dogodka > YYYY-MM-DD")
    p.add_argument("--pred", type=datum_arg, help="datum dogodka < YYYY-MM-DD")
    p.add_argument("--najvec-cena", type=float, help="cena vstopnice <= N EUR")
    p.add_argument("--prizorisce", help="ID ali del naziva prizorišča")
    p.add_argument("--dez", action="store_true", help="samo dogodki z napovedanimi padavinami (>= 1 mm)")
    a = p.parse_args()

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    try:
        prizorisca, dogodki, napovedi = nalozi_vse(Path(a.data))
    except (FileNotFoundError, ValueError) as e:
        sys.exit(f"Napaka pri branju podatkov: {e}")

    print(f"Naloženo: {len(prizorisca)} prizorišč, {len(dogodki)} dogodkov, "
          f"{len(napovedi)} napovedi\n")

    rez = filtriraj(dogodki, a.mesto, a.kategorija, a.po, a.pred,
                    a.najvec_cena, a.prizorisce, a.dez)
    rez.sort(key=lambda d: (d.datum, d.ura))

    def f(x, enota=""):
        return "-" if x is None else f"{x}{enota}"

    izpisi_tabelo(
        ["ID", "Dogodek", "Kategorija", "Datum", "Ura", "Cena", "Prizorišče", "Mesto", "Temp.", "Padavine"],
        [(d.id, d.ime, d.kategorija, d.datum, d.ura,
          f(d.cena, " EUR"),
          d.prizorisce.naziv if d.prizorisce else "-",
          d.prizorisce.mesto if d.prizorisce else "-",
          f(d.napoved.temperatura, " °C") if d.napoved else "-",
          f(d.napoved.padavine, " mm") if d.napoved else "-") for d in rez])

    zapisi = [d.to_dict() for d in rez]
    izvozi_json(zapisi, out / "filtrirano.json")
    izvozi_xml(zapisi, out / "filtrirano.xml")
    print(f"\nZadetkov: {len(rez)}. Shranjeno: {out / 'filtrirano.json'}, {out / 'filtrirano.xml'}")


if __name__ == "__main__":
    main()
