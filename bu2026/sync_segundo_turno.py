#!/usr/bin/env python3
"""Atualiza separadamente a apuração presidencial do segundo turno (TSE 6258)."""
import json
from datetime import datetime, timezone
from pathlib import Path
from sync_resultados_tse import fetch_json, summarize

BASE="https://resultados.tse.jus.br/oficial/ele2026/6258/dados"
OUT=Path(__file__).with_name("resultados-segundo-turno.json")
SOURCES={
 "presidente_br":("br","br","Brasil + exterior"),
 "presidente_ma":("ma","ma","Maranhão"),
 "presidente_odc":("ma","ma08478","Olho d'Água das Cunhãs"),
 "presidente_vf":("ma","ma09539","Vitorino Freire")
}

def main():
 output={
  "meta":{"official":True,"source":"Tribunal Superior Eleitoral — 2º turno presidencial 2026",
          "turno":2,"eleicao":6258,"dataVotacao":"2026-10-25",
          "generatedAt":datetime.now(timezone.utc).isoformat(),
          "available":False,"loaded":0},
  "results":{}
 }
 errors=[]
 for key,(uf,abr,name) in SOURCES.items():
  url=f"{BASE}/{uf}/{abr}-c0001-e006258-u.json"
  try:
   doc=fetch_json(url)
   if doc.get("f") not in (None,"o"):
    raise ValueError("Arquivo não é da fase oficial")
   meta=("6258",uf,"0001","006258","Presidente",name)
   output["results"][key]=summarize(key,meta,doc,source_url=url)
  except Exception as exc:
   errors.append({"key":key,"error":str(exc)})
 output["meta"]["loaded"]=len(output["results"])
 output["meta"]["available"]=any(
  item.get("divulgacao")!="n" and item.get("secoes",{}).get("totalizadas",0)>0
  for item in output["results"].values()
 )
 output["meta"]["errors"]=errors
 OUT.write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding="utf-8")
 print(json.dumps({"loaded":len(output["results"]),"errors":errors},ensure_ascii=False))
 return 0

if __name__=="__main__":
 raise SystemExit(main())
