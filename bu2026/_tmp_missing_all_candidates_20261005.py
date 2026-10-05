import json, os, tempfile
from pathlib import Path
import requests
import asn1tools

STATE="ma"
MUNICIPIO="08478"
ZONA="0087"
PLEITO6="003220"
SECOES=["0043","0055","0150","0191","0195","0210"]
ASN1_URL="https://raw.githubusercontent.com/alissonlinneker/dataUrnas-br/main/spec/v2/bu.asn1"
BASE="https://resultados.tse.jus.br/oficial/ele2026/arquivo-urna/3220/dados"
OUT=Path("bu2026/_tmp_missing_all_candidates_20261005.json")

def get_json(url):
    r=requests.get(url,timeout=30,headers={"User-Agent":"Mozilla/5.0"})
    r.raise_for_status()
    return r.json()

def get_bytes(url):
    r=requests.get(url,timeout=60,headers={"User-Agent":"Mozilla/5.0"})
    r.raise_for_status()
    return r.content

def choose_hash(aux):
    hs=aux.get("hashes") or []
    if not hs: raise RuntimeError("aux sem hashes")
    for h in reversed(hs):
        if "totaliz" in str(h.get("st","")).lower():
            return h
    return hs[-1]

def file_entries(h):
    if isinstance(h.get("arq"),list): return h["arq"]
    if isinstance(h.get("nmarq"),list): return [{"nm":x,"tp":""} for x in h["nmarq"]]
    return []

def find_bu_name(h):
    entries=file_entries(h)
    for a in entries:
        nm=str(a.get("nm",""))
        tp=str(a.get("tp","")).lower()
        if nm.lower().endswith((".bu",".dat")) or tp in ("bu","boletimurna","boletim de urna") or "boletim" in tp:
            return nm
    raise RuntimeError("arquivo BU não listado: "+json.dumps(entries,ensure_ascii=False))

def choice_name(v):
    if isinstance(v, tuple) and len(v)==2: return v[1]
    return v

CARGO_NAME_TO_NUM={"presidente":1,"governador":3,"senador":5,"deputadoFederal":6,"deputadoEstadual":7,"deputadoDistrital":8}

def cargo_num(v):
    if isinstance(v,int): return v
    if isinstance(v,tuple) and len(v)==2:
        x=v[1]
        if isinstance(x,int): return x
        if isinstance(x,str): return CARGO_NAME_TO_NUM.get(x)
    if isinstance(v,str): return CARGO_NAME_TO_NUM.get(v)
    return None

def vote_type(v):
    x=choice_name(v)
    return x if isinstance(x,str) else str(x)

def load_asn1():
    r=requests.get(ASN1_URL,timeout=30,headers={"User-Agent":"Mozilla/5.0"})
    r.raise_for_status()
    td=tempfile.mkdtemp()
    p=os.path.join(td,"bu.asn1")
    Path(p).write_text(r.text,encoding="utf-8")
    return p

def parse_bu(conv,bdata,secao):
    env=conv.decode("EntidadeEnvelopeGenerico",bytearray(bdata))
    bu=conv.decode("EntidadeBoletimUrna",env["conteudo"])
    out={"secao":int(secao),"aptos":0,"comparecimento":0,"federal":{},"estadual":{}}
    for ele in bu.get("resultadosVotacaoPorEleicao",[]) or []:
        out["aptos"]=max(out["aptos"],int(ele.get("qtdEleitoresAptos") or 0))
        for rv in ele.get("resultadosVotacao",[]) or []:
            out["comparecimento"]=max(out["comparecimento"],int(rv.get("qtdComparecimento") or 0))
            for tvc in rv.get("totaisVotosCargo",[]) or []:
                cn=cargo_num(tvc.get("codigoCargo"))
                if cn not in (6,7): continue
                dest=out["federal"] if cn==6 else out["estadual"]
                for vv in tvc.get("votosVotaveis",[]) or []:
                    if vote_type(vv.get("tipoVoto"))!="nominal": continue
                    ident=vv.get("identificacaoVotavel") or {}
                    code=str(ident.get("codigo",""))
                    qty=int(vv.get("quantidadeVotos") or 0)
                    if code and qty>0:
                        dest[code]=dest.get(code,0)+qty
    return out

def main():
    conv=asn1tools.compile_files([load_asn1()],codec="ber")
    rows=[]; errors=[]
    for sec in SECOES:
        aux_name=f"p{PLEITO6}-{STATE}-m{MUNICIPIO}-z{ZONA}-s{sec}-aux.json"
        base=f"{BASE}/{STATE}/{MUNICIPIO}/{ZONA}/{sec}"
        try:
            aux=get_json(f"{base}/{aux_name}")
            h=choose_hash(aux)
            nm=find_bu_name(h)
            hashv=h["hash"]
            row=parse_bu(conv,get_bytes(f"{base}/{hashv}/{nm}"),sec)
            rows.append(row)
            print(json.dumps({"ok":True,**row},ensure_ascii=False))
        except Exception as e:
            errors.append({"secao":int(sec),"error":repr(e)})
            print(json.dumps({"ok":False,"secao":int(sec),"error":repr(e)},ensure_ascii=False))
    OUT.write_text(json.dumps({"rows":rows,"errors":errors},ensure_ascii=False,indent=2),encoding="utf-8")
    if errors: raise SystemExit(json.dumps(errors,ensure_ascii=False))

if __name__=="__main__":
    main()
