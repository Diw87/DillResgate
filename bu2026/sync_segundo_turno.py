#!/usr/bin/env python3
"""Atualiza 2º turno presidencial: Brasil, municípios e 27 UFs, somente pelo TSE."""
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from sync_resultados_tse import fetch_json, summarize

BASE="https://resultados.tse.jus.br/oficial/ele2026/6258/dados"
FOLDER=Path(__file__).resolve().parent
OUT=FOLDER/"resultados-segundo-turno.json"
STATES_OUT=FOLDER/"resultados-estados-segundo-turno.json"
RELEASE=datetime(2026,10,25,20,0,tzinfo=timezone.utc)
SOURCES={
 "presidente_br":("br","br","Brasil + exterior"),
 "presidente_ma":("ma","ma","Maranhão"),
 "presidente_odc":("ma","ma08478","Olho d'Água das Cunhãs"),
 "presidente_vf":("ma","ma09539","Vitorino Freire"),
}
UF_NAMES={
 "ac":"Acre","al":"Alagoas","ap":"Amapá","am":"Amazonas","ba":"Bahia",
 "ce":"Ceará","df":"Distrito Federal","es":"Espírito Santo","go":"Goiás",
 "ma":"Maranhão","mt":"Mato Grosso","ms":"Mato Grosso do Sul","mg":"Minas Gerais",
 "pa":"Pará","pb":"Paraíba","pr":"Paraná","pe":"Pernambuco","pi":"Piauí",
 "rj":"Rio de Janeiro","rn":"Rio Grande do Norte","rs":"Rio Grande do Sul",
 "ro":"Rondônia","rr":"Roraima","sc":"Santa Catarina","sp":"São Paulo",
 "se":"Sergipe","to":"Tocantins",
}

def get(key,source):
 uf,abr,name=source
 url=f"{BASE}/{uf}/{abr}-c0001-e006258-u.json"
 doc=fetch_json(url)
 if doc.get("f") not in (None,"o"):
  raise ValueError("Fonte não é da fase oficial")
 # Metadados do resultado gerados pela função já utilizada pelo aplicativo.
 item=summarize(key,("6258",uf,"0001","006258","Presidente",name),doc,source_url=url)
 return key,item

def save(path,data):
 path.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding="utf-8")

def main():
 now=datetime.now(timezone.utc)
 common={"official":True,"source":"Tribunal Superior Eleitoral","turno":2,
         "eleicao":6258,"dataVotacao":"2026-10-25","generatedAt":now.isoformat()}
 output={"meta":dict(common,loaded=0,available=False),"results":{}}
 states={"meta":dict(common,loaded=0,available=False,totalUFs=27),"results":{}}
 errors=[]
 if now>=RELEASE:
  tasks=[("main",key,val) for key,val in SOURCES.items()]
  tasks += [("uf","presidente_"+uf,(uf,uf,name)) for uf,name in UF_NAMES.items() if uf!="ma"]
  # Maranhão foi consultado junto aos totais gerais e é reutilizado no mapa.
  with ThreadPoolExecutor(max_workers=7) as pool:
   futures={pool.submit(get,key,val):(group,key) for group,key,val in tasks}
   for future in as_completed(futures):
    group,key=futures[future]
    try:
     _,item=future.result()
     if group=="main":output["results"][key]=item
     else:states["results"][key]=item
    except Exception as exc:
     errors.append({"key":key,"error":str(exc)[:180]})
  if "presidente_ma" in output["results"]:
   states["results"]["presidente_ma"]=output["results"]["presidente_ma"]
 output["meta"]["loaded"]=len(output["results"])
 output["meta"]["available"]=any(
  r.get("divulgacao")!="n" and r.get("secoes",{}).get("totalizadas",0)>0
  for r in output["results"].values())
 states["meta"]["loaded"]=len(states["results"])
 states["meta"]["available"]=any(
  r.get("divulgacao")!="n" and r.get("secoes",{}).get("totalizadas",0)>0
  for r in states["results"].values())
 output["meta"]["errors"]=[x for x in errors if x["key"] in SOURCES]
 states["meta"]["errors"]=[x for x in errors if x["key"] not in SOURCES]
 save(OUT,output)
 save(STATES_OUT,states)
 print(json.dumps({"principais":output["meta"]["loaded"],"ufs":states["meta"]["loaded"],
                   "erros":len(errors)},ensure_ascii=False))
 return 0

if __name__=="__main__":
 raise SystemExit(main())
