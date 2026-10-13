"""Izvoz v JSON in XML."""
import json
import xml.etree.ElementTree as ET
from pathlib import Path


def izvozi_json(zapisi: list[dict], pot: Path) -> None:
    with open(pot, "w", encoding="utf-8") as f:
        json.dump(zapisi, f, ensure_ascii=False, indent=2)


def _v_xml(stars: ET.Element, d: dict) -> None:
    for kljuc, vrednost in d.items():
        if kljuc == "id":
            stars.set("id", str(vrednost))
        elif isinstance(vrednost, dict):
            _v_xml(ET.SubElement(stars, kljuc), vrednost)
        else:
            el = ET.SubElement(stars, kljuc)
            if vrednost is not None:          # None -> prazen element
                el.text = str(vrednost)


def izvozi_xml(zapisi: list[dict], pot: Path) -> None:
    koren = ET.Element("dogodki", stevilo=str(len(zapisi)))
    for z in zapisi:
        _v_xml(ET.SubElement(koren, "dogodek"), z)
    ET.indent(koren, space="  ")
    ET.ElementTree(koren).write(pot, encoding="utf-8", xml_declaration=True)
