#!/usr/bin/env python3
import json, urllib.request, urllib.error
from datetime import datetime, timezone
from pathlib import Path

OUT=Path(__file__).with_name("resultados-oficiais.json")
BASE="https://resultados.tse.jus.br/oficial/ele2026"
PLEITO=3220
PLEITO6=f"{PLEITO:06d}"
SOURCES={
  "presidente_br": ("6257","br","0001","006257","Presidente","Brasil + exterior"),
  "governador_ma": ("6259","ma","0003","006259","Governador","Maranhão"),
  "senador_ma": ("6259","ma","0005","006259","Senador","Maranhão"),
  "federal_ma": ("6259","ma","0006","006259","Deputado Federal","Maranhão"),
  "estadual_ma": ("6259","ma","0007","006259","Deputado Estadual","Maranhão"),
}

MUNICIPIO_ODC={"uf":"ma","codigo":"08710","nome":"Olho d'Água das Cunhãs"}
MUNICIPAL_SOURCES={
  "presidente_odc": ("6257","0001","006257","Presidente"),
  "governador_odc": ("6259","0003","006259","Governador"),
  "senador_odc": ("6259","0005","006259","Senador"),
  "federal_odc": ("6259","0006","006259","Deputado Federal"),
  "estadual_odc": ("6259","0007","006259","Deputado Estadual"),
}

def url_for(election, abr, cargo, eid):
    return f"{BASE}/{election}/dados/{abr}/{abr}-c{cargo}-e{eid}-u.json"

def municipal_url_candidates(election, cargo, eid):
    uf=MUNICIPIO_ODC["uf"]
    abr=f'{uf}{MUNICIPIO_ODC["codigo"]}'
    return [
      f"{BASE}/{election}/dados/{uf}/{abr}-c{cargo}-e{eid}-u.json",
      f"{BASE}/{election}/dados/{abr}/{abr}-c{cargo}-e{eid}-u.json",
    ]

def fetch_first(urls):
    last=None
    for url in urls:
        try:
            return fetch_json(url), url
        except Exception as exc:
            last=exc
    raise last or RuntimeError("Nenhuma URL disponível")

def fetch_odc_section_status():
    """
    Consulta EA16 + EA18 para identificar as seções de ODC que já possuem
    arquivo auxiliar no TSE e, quando disponível, a situação da seção.
    Falhas não interrompem a atualização dos resultados agregados.
    """
    uf=MUNICIPIO_ODC["uf"]
    mun=MUNICIPIO_ODC["codigo"]
    zone="0087"
    cfg_url=f"{BASE}/arquivo-urna/{PLEITO}/config/{uf}/{uf}-p{PLEITO6}-cs.json"
    cfg=fetch_json(cfg_url)
    sec_items=[]
    for abr in cfg.get("abr") or []:
        if str(abr.get("cd","")).lower()!=uf:
            continue
        for mu in abr.get("mu") or []:
            if str(mu.get("cd","")).zfill(5)!=mun:
                continue
            for zon in mu.get("zon") or []:
                if str(zon.get("cd","")).zfill(4)!=zone:
                    continue
                sec_items.extend(zon.get("sec") or [])

    out=[]
    for sec in sec_items:
        ns=str(sec.get("ns") or "").zfill(4)
        # Seção agregada não possui auxiliar próprio; a principal a representa.
        if sec.get("nsp"):
            continue
        item={"secao":int(ns or 0),"da":sec.get("da"),"ha":sec.get("ha"),"status":""}
        if sec.get("da") and sec.get("ha"):
            aux_name=f"p{PLEITO6}-{uf}-m{mun}-z{zone}-s{ns}-aux.json"
            aux_url=f"{BASE}/arquivo-urna/{PLEITO}/dados/{uf}/{mun}/{zone}/{ns}/{aux_name}"
            try:
                aux=fetch_json(aux_url)
                item["status"]=str(aux.get("st") or "")
                item["auxUrl"]=aux_url
            except Exception as exc:
                item["status"]="aux-indisponivel"
                item["error"]=str(exc)
        out.append(item)
    return {"configUrl":cfg_url,"sections":out}

def fetch_json(url):
    req=urllib.request.Request(url,headers={
      "User-Agent":"Mozilla/5.0 (compatible; DWTech-BU2026/1.0; +https://github.com/Diw87/DillResgate)",
      "Accept":"application/json,text/plain,*/*",
      "Accept-Language":"pt-BR,pt;q=0.9",
      "Referer":"https://resultados.tse.jus.br/oficial/app/index.html"
    })
    with urllib.request.urlopen(req,timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))

def n(v, default=0):
    try: return int(v)
    except: return default

def dec(v):
    if v is None: return 0.0
    try: return float(str(v).replace(",","."))
    except: return 0.0

def flatten_candidates(doc):
    out=[]
    for cargo in doc.get("carg") or []:
        for agr in cargo.get("agr") or []:
            for par in agr.get("par") or []:
                sigla=par.get("sg") or ""
                partido=par.get("nm") or ""
                for c in par.get("cand") or []:
                    out.append({
                      "numero": str(c.get("n") or ""),
                      "nome": c.get("nmu") or c.get("nm") or "",
                      "nomeCompleto": c.get("nm") or "",
                      "partido": sigla,
                      "partidoNome": partido,
                      "votos": n(c.get("vap")),
                      "percentual": dec(c.get("pvap")),
                      "percentualNominal": dec(c.get("pvapn")),
                      "situacao": c.get("st") or "",
                      "eleito": c.get("e") == "s",
                    })
    out.sort(key=lambda x:(-x["votos"], n(x["numero"],999999)))
    return out

def summarize(key, meta, doc, source_url=None):
    sec=doc.get("s") or {}
    ele=doc.get("e") or {}
    vot=doc.get("v") or {}
    return {
      "key":key,
      "cargo":meta[4],
      "abrangencia":meta[5],
      "sourceUrl":source_url or url_for(*meta[:4]),
      "fase":doc.get("f"),
      "divulgacao":doc.get("dv"),
      "andamento":doc.get("and"),
      "totalizacaoFinal":doc.get("tf"),
      "geradoEm":{"data":doc.get("dg"),"hora":doc.get("hg")},
      "totalizadoEm":{"data":doc.get("dt"),"hora":doc.get("ht")},
      "secoes":{
        "total":n(sec.get("ts")),
        "totalizadas":n(sec.get("st")),
        "percentual":dec(sec.get("pst")),
        "naoTotalizadas":n(sec.get("snt")),
      },
      "eleitores":{
        "total":n(ele.get("te")),
        "comparecimento":n(ele.get("c")),
        "abstencao":n(ele.get("a")),
      },
      "votos":{
        "total":n(vot.get("tv")),
        "validos":n(vot.get("vv")),
        "nominais":n(vot.get("vnom")),
        "legenda":n(vot.get("vl")),
        "brancos":n(vot.get("vb")),
        "nulos":n(vot.get("tvn")),
      },
      "candidatos":flatten_candidates(doc)
    }

def main():
    result={
      "meta":{
        "source":"Tribunal Superior Eleitoral — Resultados 2026",
        "official":True,
        "generatedAt":datetime.now(timezone.utc).isoformat(),
        "available":False,
        "message":"Aguardando divulgação oficial do TSE",
        "electionDate":"2026-10-04",
        "releaseTime":"17:00 America/Sao_Paulo",
        "elections":{"federal":6257,"estadual":6259}
      },
      "results":{}
    }
    errors=[]
    loaded=0
    for key,meta in SOURCES.items():
        url=url_for(*meta[:4])
        try:
            doc=fetch_json(url)
            # Aceita apenas fase oficial e arquivos efetivamente divulgáveis.
            if doc.get("f") not in (None,"o"):
                raise RuntimeError(f"fase não oficial: {doc.get('f')}")
            result["results"][key]=summarize(key,meta,doc,source_url=url)
            loaded+=1
        except Exception as exc:
            errors.append({"key":key,"url":url,"error":str(exc)})

    for key,meta in MUNICIPAL_SOURCES.items():
        election,cargo,eid,label=meta
        urls=municipal_url_candidates(election,cargo,eid)
        try:
            doc,url=fetch_first(urls)
            if doc.get("f") not in (None,"o"):
                raise RuntimeError(f"fase não oficial: {doc.get('f')}")
            fake=(election,MUNICIPIO_ODC["uf"],cargo,eid,label,MUNICIPIO_ODC["nome"])
            result["results"][key]=summarize(key,fake,doc,source_url=url)
            loaded+=1
        except Exception as exc:
            errors.append({"key":key,"urls":urls,"error":str(exc)})

    result["meta"]["municipio"]=MUNICIPIO_ODC
    try:
        sec_info=fetch_odc_section_status()
        result["meta"]["odcSections"]=sec_info
    except Exception as exc:
        result["meta"]["odcSections"]={"sections":[],"error":str(exc)}
    result["meta"]["available"]=loaded>0
    result["meta"]["loaded"]=loaded
    result["meta"]["expected"]=len(SOURCES)+len(MUNICIPAL_SOURCES)
    result["meta"]["errors"]=errors
    if loaded:
        result["meta"]["message"]=f"{loaded} de {len(SOURCES)+len(MUNICIPAL_SOURCES)} resultados oficiais disponíveis"
    OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({"loaded":loaded,"errors":errors},ensure_ascii=False))
    return 0

if __name__=="__main__":
    raise SystemExit(main())
