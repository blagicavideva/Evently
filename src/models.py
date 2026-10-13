"""Podatkovni modeli: deserializacija XML -> objekti."""
from dataclasses import dataclass
from datetime import date
from typing import Optional


@dataclass
class Prizorisce:
    id: str
    naziv: str
    mesto: str
    drzava: str
    kapaciteta: Optional[int]
    lat: float
    lon: float


@dataclass
class Napoved:
    id: str
    dogodek_id: str
    datum: date
    temperatura: Optional[float]
    padavine: Optional[float]   # mm
    veter: Optional[float]      # km/h


@dataclass
class Dogodek:
    id: str
    prizorisce_id: str
    ime: str
    kategorija: str
    datum: date
    ura: str
    cena: Optional[float]
    opis: Optional[str]
    povezava: Optional[str]
    prizorisce: Optional[Prizorisce] = None   # nastavi se pri povezovanju
    napoved: Optional[Napoved] = None         # nastavi se pri povezovanju

    def to_dict(self) -> dict:
        p, w = self.prizorisce, self.napoved
        return {
            "id": self.id,
            "ime": self.ime,
            "kategorija": self.kategorija,
            "datum": self.datum.isoformat(),
            "ura": self.ura,
            "cenaVstopnice": self.cena,
            "opis": self.opis,
            "povezava": self.povezava,
            "prizorisce": ({"id": p.id, "naziv": p.naziv, "mesto": p.mesto,
                            "drzava": p.drzava, "kapaciteta": p.kapaciteta,
                            "lat": p.lat, "lon": p.lon} if p else None),
            "napoved": ({"id": w.id, "temperatura": w.temperatura,
                         "padavine": w.padavine, "veter": w.veter}
                        if w else None),
        }
