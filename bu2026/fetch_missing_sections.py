import json, os, re, tempfile, zipfile, io
from pathlib import Path
import requests
import asn1tools

STATE="ma"
MUNICIPIO="08478"
ZONA="0087"
PLEITO="3220"
PLEITO6="003220"
SECOES=["0043","0055","0150","0191","0195","0210"]
TARGETS={
  6: {"2233":"Aldir Júnior","2522":"Marreca Filho","4040":"Othelino Neto","2222":"Fabiana Vilar"},
  7: {"13013":"Luanna","15444":"Vanessa Marreca","15222":"Florêncio Neto","40123":"Marcos Miranda Júnior"},
}
TECH_ZIP="https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/formato-arquivos-de-bu-rdv-e-assinatura-digital"
BASE="https://resultados.tse.jus.br/oficial/ele2026/arquivo-urna/3220/dados"
OUT=Path("bu2026/missing_sections_100.json")

def get_json(url):
    r=requests.get(url,timeout=30)
    r.raise_for_status()
    return r.json()

def get_bytes(url):
    r=requests.get(url,timeout=60)
    r.raise_for_status()
    return r.content

def choose_hash(aux):
    hs=aux.get("hashes") or []
    if not hs:
        raise RuntimeError("aux sem hashes")
    for h in reversed(hs):
        if "totaliz" in str(h.get("st","")).lower():
            return h
    return hs[-1]

def file_entries(h):
    if isinstance(h.get("arq"),list):
        return h["arq"]
    if isinstance(h.get("nmarq"),list):
        return [{"nm":x,"tp":""} for x in h["nmarq"]]
    return []

def find_bu_name(h):
    for a in file_entries(h):
        nm=a.get("nm","")
        if nm.lower().endswith(".bu"):
            return nm
    raise RuntimeError("arquivo .bu não listado")

def choice_name(v):
    if isinstance(v, tuple) and len(v)==2:
        return v[1]
    return v

CARGO_NAME_TO_NUM={
 "presidente":1,"governador":3,"senador":5,"deputadoFederal":6,"deputadoEstadual":7,"deputadoDistrital":8,
}

def cargo_num(v):
    if isinstance(v,int):
        return v
    if isinstance(v,tuple):
        if len(v)==2:
            x=v[1]
            if isinstance(x,int): return x
            if isinstance(x,str): return CARGO_NAME_TO_NUM.get(x)
    if isinstance(v,str):
        return CARGO_NAME_TO_NUM.get(v)
    return None

def vote_type(v):
    x=choice_name(v)
    if isinstance(x,str): return x
    return str(x)

def locate_asn1(zbytes):
    with zipfile.ZipFile(io.BytesIO(zbytes)) as z:
        names=z.namelist()
        cands=[n for n in names if n.lower().endswith("bu.asn1")]
        if not cands:
            cands=[n for n in names if n.lower().endswith(".asn1") and "bu" in n.lower()]
        if not cands:
            raise RuntimeError("bu.asn1 não encontrado no ZIP técnico")
        td=tempfile.mkdtemp()
        z.extract(cands[0],td)
        return os.path.join(td,cands[0])

def parse_bu(conv,bdata,secao):
    env=conv.decode("EntidadeEnvelopeGenerico",bytearray(bdata))
    content=env["conteudo"]
    bu=conv.decode("EntidadeBoletimUrna",content)
    out={"secao":int(secao),"aptos":0,"comparecimento":0,"federal":{},"estadual":{}}
    # Aptos/comparecimento: usa o maior valor visto para a eleição/cargo local.
    for ele in bu.get("resultadosVotacaoPorEleicao",[]) or []:
        out["aptos"]=max(out["aptos"], int(ele.get("qtdEleitoresAptos") or 0))
        for rv in ele.get("resultadosVotacao",[]) or []:
            comp=int(rv.get("qtdComparecimento") or 0)
            out["comparecimento"]=max(out["comparecimento"],comp)
            for tvc in rv.get("totaisVotosCargo",[]) or []:
                cn=cargo_num(tvc.get("codigoCargo"))
                if cn not in TARGETS: continue
                dest=out["federal"] if cn==6 else out["estadual"]
                for vv in tvc.get("votosVotaveis",[]) or []:
                    if vote_type(vv.get("tipoVoto"))!="nominal": continue
                    ident=vv.get("identificacaoVotavel") or {}
                    code=str(ident.get("codigo",""))
                    if code in TARGETS[cn]:
                        dest[code]=dest.get(code,0)+int(vv.get("quantidadeVotos") or 0)
    for cn,key in [(6,"federal"),(7,"estadual")]:
        for code,name in TARGETS[cn].items():
            out[key].setdefault(code,0)
    return out

def main():
    z=get_bytes(TECH_ZIP)
    asn1_path=locate_asn1(z)
    conv=asn1tools.compile_files([asn1_path],codec="ber")
    rows=[]
    errors=[]
    for sec in SECOES:
        aux_name=f"p{PLEITO6}-{STATE}-m{MUNICIPIO}-z{ZONA}-s{sec}-aux.json"
        base=f"{BASE}/{STATE}/{MUNICIPIO}/{ZONA}/{sec}"
        aux_url=f"{base}/{aux_name}"
        try:
            aux=get_json(aux_url)
            h=choose_hash(aux)
            bu_name=find_bu_name(h)
            hashv=h["hash"]
            bu_url=f"{base}/{hashv}/{bu_name}"
            row=parse_bu(conv,get_bytes(bu_url),sec)
            row.update({"aux_url":aux_url,"bu_url":bu_url,"hash":hashv,"status_secao":aux.get("st"),"status_hash":h.get("st")})
            rows.append(row)
            print(json.dumps({"ok":True,**row},ensure_ascii=False))
        except Exception as e:
            errors.append({"secao":int(sec),"error":repr(e)})
            print(json.dumps({"ok":False,"secao":int(sec),"error":repr(e)},ensure_ascii=False))
    OUT.write_text(json.dumps({"source":"TSE arquivos de urna 2026","municipio":"Olho d'Água das Cunhãs","codigo":"08478","zona":87,"rows":rows,"errors":errors},ensure_ascii=False,indent=2),encoding="utf-8")
    if errors:
        raise SystemExit("Falha em uma ou mais seções: "+json.dumps(errors,ensure_ascii=False))

if __name__=="__main__":
    main()
