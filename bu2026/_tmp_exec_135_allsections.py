import json, os, tempfile
from pathlib import Path
import requests, asn1tools

STATE="ma"; MUNICIPIO="08478"; ZONA="0087"; PLEITO6="003220"
SECOES=[1,3,10,12,14,16,18,20,21,23,25,27,29,30,31,32,33,34,35,36,37,41,43,49,50,52,53,54,55,56,67,73,78,143,148,149,150,153,158,180,183,191,192,195,200,206,210,211,215,216,217,222,224]
ASN1_URL="https://raw.githubusercontent.com/alissonlinneker/dataUrnas-br/main/spec/v2/bu.asn1"
BASE="https://resultados.tse.jus.br/oficial/ele2026/arquivo-urna/3220/dados"
OUT=Path("bu2026/_tmp_exec_135_allsections.json")
CARGO_NAME_TO_NUM={"presidente":1,"governador":3,"senador":5,"deputadoFederal":6,"deputadoEstadual":7,"deputadoDistrital":8}

def get_json(url):
    r=requests.get(url,timeout=30,headers={"User-Agent":"Mozilla/5.0"}); r.raise_for_status(); return r.json()
def get_bytes(url):
    r=requests.get(url,timeout=60,headers={"User-Agent":"Mozilla/5.0"}); r.raise_for_status(); return r.content
def choose_hash(aux):
    hs=aux.get("hashes") or []
    if not hs: raise RuntimeError("aux sem hashes")
    for h in reversed(hs):
        if "totaliz" in str(h.get("st","")).lower(): return h
    return hs[-1]
def entries(h):
    if isinstance(h.get("arq"),list): return h["arq"]
    if isinstance(h.get("nmarq"),list): return [{"nm":x,"tp":""} for x in h["nmarq"]]
    return []
def bu_name(h):
    for a in entries(h):
        nm=str(a.get("nm","")); tp=str(a.get("tp","")).lower()
        if nm.lower().endswith(".bu") or tp in ("bu","boletimurna","boletim de urna") or "boletim" in tp: return nm
    raise RuntimeError("BU não listado")
def choice(v):
    return v[1] if isinstance(v,tuple) and len(v)==2 else v
def cargo(v):
    if isinstance(v,int): return v
    if isinstance(v,tuple) and len(v)==2:
        x=v[1]
        if isinstance(x,int): return x
        if isinstance(x,str): return CARGO_NAME_TO_NUM.get(x)
    if isinstance(v,str): return CARGO_NAME_TO_NUM.get(v)
    return None
def vt(v):
    x=choice(v); return x if isinstance(x,str) else str(x)
def load_asn1():
    r=requests.get(ASN1_URL,timeout=30,headers={"User-Agent":"Mozilla/5.0"}); r.raise_for_status()
    td=tempfile.mkdtemp(); p=os.path.join(td,"bu.asn1"); Path(p).write_text(r.text,encoding="utf-8"); return p
def parse(conv,b,sec):
    env=conv.decode("EntidadeEnvelopeGenerico",bytearray(b))
    bu=conv.decode("EntidadeBoletimUrna",env["conteudo"])
    out={"secao":sec,"aptos":0,"comparecimento":0,"presidente":{},"governador":{},"senador":{}}
    for ele in bu.get("resultadosVotacaoPorEleicao",[]) or []:
        out["aptos"]=max(out["aptos"],int(ele.get("qtdEleitoresAptos") or 0))
        for rv in ele.get("resultadosVotacao",[]) or []:
            out["comparecimento"]=max(out["comparecimento"],int(rv.get("qtdComparecimento") or 0))
            for tvc in rv.get("totaisVotosCargo",[]) or []:
                cn=cargo(tvc.get("codigoCargo"))
                if cn not in (1,3,5): continue
                key={1:"presidente",3:"governador",5:"senador"}[cn]
                for vv in tvc.get("votosVotaveis",[]) or []:
                    if vt(vv.get("tipoVoto"))!="nominal": continue
                    ident=vv.get("identificacaoVotavel") or {}
                    code=str(ident.get("codigo","")); qty=int(vv.get("quantidadeVotos") or 0)
                    if code and qty>0: out[key][code]=out[key].get(code,0)+qty
    return out

def main():
    conv=asn1tools.compile_files([load_asn1()],codec="ber")
    rows=[]; errors=[]
    for sec in SECOES:
        ss=f"{sec:04d}"; base=f"{BASE}/{STATE}/{MUNICIPIO}/{ZONA}/{ss}"
        auxn=f"p{PLEITO6}-{STATE}-m{MUNICIPIO}-z{ZONA}-s{ss}-aux.json"
        try:
            aux=get_json(f"{base}/{auxn}"); h=choose_hash(aux); nm=bu_name(h); hv=h["hash"]
            row=parse(conv,get_bytes(f"{base}/{hv}/{nm}"),sec); rows.append(row)
            print(json.dumps({"ok":True,"secao":sec,"p":len(row["presidente"]),"g":len(row["governador"]),"s":len(row["senador"])},ensure_ascii=False))
        except Exception as e:
            errors.append({"secao":sec,"error":repr(e)}); print(json.dumps({"ok":False,"secao":sec,"error":repr(e)},ensure_ascii=False))
    OUT.write_text(json.dumps({"rows":rows,"errors":errors},ensure_ascii=False,indent=2),encoding="utf-8")
    if errors: raise SystemExit(json.dumps(errors,ensure_ascii=False))
if __name__=="__main__": main()
