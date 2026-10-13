"""Filtriranje dogodkov."""
from datetime import date
from typing import Optional


def filtriraj(dogodki, mesto: Optional[str] = None,
              kategorija: Optional[str] = None,
              po: Optional[date] = None, pred: Optional[date] = None,
              najvec_cena: Optional[float] = None,
              prizorisce: Optional[str] = None,
              dez: bool = False):
    rez = dogodki
    if mesto:
        rez = [d for d in rez if d.prizorisce
               and d.prizorisce.mesto.lower() == mesto.lower()]
    if kategorija:
        rez = [d for d in rez if d.kategorija.lower() == kategorija.lower()]
    if po:
        rez = [d for d in rez if d.datum > po]
    if pred:
        rez = [d for d in rez if d.datum < pred]
    if najvec_cena is not None:   # dogodki z neznano ceno izpadejo
        rez = [d for d in rez if d.cena is not None and d.cena <= najvec_cena]
    if prizorisce:
        v = prizorisce.lower()
        rez = [d for d in rez if d.prizorisce
               and (d.prizorisce.id.lower() == v
                    or v in d.prizorisce.naziv.lower())]
    if dez:                       # pričakovane padavine >= 1 mm
        rez = [d for d in rez if d.napoved and d.napoved.padavine is not None
               and d.napoved.padavine >= 1.0]
    return rez
