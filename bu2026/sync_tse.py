#!/usr/bin/env python3
import csv
import io
import json
import sys
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

SOURCE = "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip"
OUT = Path(__file__).with_name("candidatos.json")

OFFICES = {
    "PRESIDENTE": "presidente",
    "GOVERNADOR": "governador",
    "SENADOR": "senador",
    "DEPUTADO FEDERAL": "federal",
    "DEPUTADO ESTADUAL": "estadual",
}

def clean(value):
    return (value or "").strip()

def download():
    req = urllib.request.Request(
        SOURCE,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; BU2026/1.0; +https://github.com/Diw87/DillResgate)",
            "Accept": "application/zip,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read()

def main():
    try:
        raw = download()
    except Exception as exc:
        if OUT.exists():
            print(f"AVISO: TSE indisponível ({exc}); mantendo candidatos.json existente.")
            return 0
        raise

    data = {k: [] for k in ("federal", "estadual", "senador", "governador", "presidente")}
    seen = {k: set() for k in data}

    with zipfile.ZipFile(io.BytesIO(raw)) as zf:
        csv_names = [n for n in zf.namelist() if n.lower().endswith(".csv")]
        if not csv_names:
            raise RuntimeError("ZIP do TSE não contém arquivos CSV.")

        for name in csv_names:
            with zf.open(name) as fh:
                text = io.TextIOWrapper(fh, encoding="latin-1", newline="")
                reader = csv.DictReader(text, delimiter=";", quotechar='"')
                for raw_row in reader:
                    row = {(k or "").lstrip("\ufeff"): v for k, v in raw_row.items()}
                    cargo = clean(row.get("DS_CARGO")).upper()
                    key = OFFICES.get(cargo)
                    if not key:
                        continue

                    uf = clean(row.get("SG_UF")).upper()
                    if key == "presidente":
                        if uf not in ("BR", "DF"):
                            continue
                    elif uf != "MA":
                        continue

                    numero = clean(row.get("NR_CANDIDATO"))
                    sq = clean(row.get("SQ_CANDIDATO")) or numero
                    if not numero or sq in seen[key]:
                        continue
                    seen[key].add(sq)

                    situacao = (
                        clean(row.get("DS_SITUACAO_CANDIDATO_URNA"))
                        or clean(row.get("DS_SITUACAO_CANDIDATURA"))
                        or clean(row.get("DS_SITUACAO_CANDIDATO_PLEITO"))
                    )

                    data[key].append({
                        "id": sq,
                        "numero": numero,
                        "nome": clean(row.get("NM_URNA_CANDIDATO")) or clean(row.get("NM_CANDIDATO")),
                        "nomeCompleto": clean(row.get("NM_CANDIDATO")),
                        "partido": clean(row.get("SG_PARTIDO")),
                        "partidoNumero": clean(row.get("NR_PARTIDO")),
                        "partidoNome": clean(row.get("NM_PARTIDO")),
                        "situacao": situacao,
                    })

    for key in data:
        data[key].sort(key=lambda x: (int(x["numero"]) if x["numero"].isdigit() else 999999, x["nome"]))

    counts = {k: len(v) for k, v in data.items()}
    if sum(counts.values()) == 0:
        raise RuntimeError("Nenhuma candidatura 2026 foi encontrada no arquivo oficial do TSE.")

    payload = {
        "meta": {
            "source": "Portal de Dados Abertos do TSE",
            "sourceUrl": SOURCE,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "uf": "MA",
            "year": 2026,
            "counts": counts,
        },
        "candidates": data,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(payload["meta"], ensure_ascii=False))
    return 0

if __name__ == "__main__":
    sys.exit(main())
