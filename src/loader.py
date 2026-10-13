"""Branje XML datotek in povezovanje prek ID-jev."""
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path
from typing import Optional

from models import Dogodek, Napoved, Prizorisce


def _t(el: ET.Element, tag: str) -> Optional[str]:
    """Besedilo podelementa; None, če element manjka ali je prazen."""
    c = el.find(tag)
    if c is None or c.text is None or not c.text.strip():
        return None
    return c.text.strip()


def _num(s: Optional[str], tip=float):
    return tip(s) if s is not None else None


def _datum(s: Optional[str]) -> Optional[date]:
    return date.fromisoformat(s) if s is not None else None


def nalozi_prizorisca(pot: Path) -> list[Prizorisce]:
    return [Prizorisce(e.get("id"), _t(e, "naziv"), _t(e, "mesto"),
                       _t(e, "drzava"), _num(_t(e, "kapaciteta"), int),
                       float(_t(e, "lat")), float(_t(e, "lon")))
            for e in ET.parse(pot).getroot().findall("prizorisce")]


def nalozi_napovedi(pot: Path) -> list[Napoved]:
    return [Napoved(e.get("id"), _t(e, "dogodekId"), _datum(_t(e, "datum")),
                    _num(_t(e, "temperatura")), _num(_t(e, "padavine")),
                    _num(_t(e, "veter")))
            for e in ET.parse(pot).getroot().findall("napoved")]


def nalozi_dogodke(pot: Path) -> list[Dogodek]:
    return [Dogodek(e.get("id"), _t(e, "prizoriscId"), _t(e, "ime"),
                    _t(e, "kategorija"), _datum(_t(e, "datum")), _t(e, "ura"),
                    _num(_t(e, "cenaVstopnice")), _t(e, "opis"),
                    _t(e, "povezava"))
            for e in ET.parse(pot).getroot().findall("dogodek")]


def nalozi_vse(mapa: Path):
    """Naloži vse tri datoteke in jih poveže prek ID-jev."""
    prizorisca = nalozi_prizorisca(mapa / "prizorisca.xml")
    dogodki = nalozi_dogodke(mapa / "dogodki.xml")
    napovedi = nalozi_napovedi(mapa / "napovedi.xml")

    p_po_id = {p.id: p for p in prizorisca}
    w_po_dogodku = {w.dogodek_id: w for w in napovedi}
    for d in dogodki:
        d.prizorisce = p_po_id.get(d.prizorisce_id)
        d.napoved = w_po_dogodku.get(d.id)
    return prizorisca, dogodki, napovedi
