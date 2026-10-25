#!/usr/bin/env python3
"""Gera uma copia consultavel no mesmo dominio dos resultados TSE das localidades ZZ.

Cada linha e identificada pelo codigo oficial EA12. Arquivos ausentes ficam ausentes:
nenhum valor e inventado, e nao ha mistura com o primeiro turno.
"""
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from sync_resultados_tse import fetch_json, summarize

FOLDER = Path(__file__).resolve().parent
OUT = FOLDER / "resultados-exterior-localidades.json"
BASE = "https://resultados.tse.jus.br/oficial/ele2026/6258/dados/zz"
RELEASE = datetime(2026, 10, 25, 20, tzinfo=timezone.utc)

def get(item):
    code = str(item["codigo"])
    url = f"{BASE}/zz{code}-c0001-e006258-u.json"
    doc = fetch_json(url)
    if str(doc.get("ele")) != "6258" or str(doc.get("t")) != "2":
        raise ValueError("Eleicao/turno divergente")
    if doc.get("f") not in (None, "o"):
        raise ValueError("Fase nao oficial")
    area = str(doc.get("cdabr") or "").lower()
    if area and area not in (code, "zz" + code):
        raise ValueError("Localidade divergente: " + area)
    key = "exterior_" + code
    result = summarize(key, ("6258", "zz", "0001", "006258",
                              "Presidente", item["nome"]), doc, source_url=url)
    result.update({"eleicao": 6258, "turno": 2,
                   "codigoAbrangencia": code, "pais": item["pais"]})
    return code, result

def main():
    items = json.loads((FOLDER / "exterior-localidades.json").read_text(encoding="utf-8"))["localidades"]
    data = {
        "meta": {"eleicao": 6258, "turno": 2, "official": True,
                 "source": "Tribunal Superior Eleitoral",
                 "generatedAt": datetime.now(timezone.utc).isoformat(),
                 "totalLocalidades": len(items), "loaded": 0, "errors": 0},
        "results": {},
    }
    if datetime.now(timezone.utc) >= RELEASE:
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = {executor.submit(get, item): item["codigo"] for item in items}
            for future in as_completed(futures):
                try:
                    code, result = future.result()
                    data["results"][code] = result
                except Exception:
                    data["meta"]["errors"] += 1
    data["meta"]["loaded"] = len(data["results"])
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    published = [r for r in data["results"].values()
                 if r.get("fase") == "o"
                 and r.get("divulgacao") != "n"
                 and int(r.get("secoes", {}).get("totalizadas", 0)) > 0]
    data["meta"]["comVotosApurados"] = len(published)
    data["meta"]["votosValidosLocalidades"] = sum(int(r.get("votos", {}).get("validos", 0)) for r in published)
    data["meta"]["paisesComVotos"] = len({r.get("pais") for r in published})
    # Regrava o mesmo snapshot com metadados de cobertura auditáveis.
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(data["meta"], ensure_ascii=False))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
