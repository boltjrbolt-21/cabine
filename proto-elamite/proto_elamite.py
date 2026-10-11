#!/usr/bin/env python3
"""Analyseur de translittérations proto-élamites au format ATF du CDLI.

Une ligne de compte proto-élamite s'écrit OBJET(S) puis NOMBRE, par exemple
« 1. M218 3(N14) 2(N01) ». Ce module sépare les signes d'objet des numéraux
et calcule la quantité dans chaque système numérique possible.

Les numéraux N01, N14, N34… sont les mêmes graphies dans plusieurs systèmes :
seul le contexte (l'objet compté) dit lequel s'applique. Sans indication dans
OBJET_SYSTEME, on donne donc la valeur dans chaque système compatible.

Usage :
    python3 proto_elamite.py tablettes.atf          # rapport lisible
    python3 proto_elamite.py tablettes.atf --json   # sortie JSON
    python3 proto_elamite.py -                      # lit l'entrée standard
"""
import json
import re
import sys
from dataclasses import dataclass, field, asdict

# Valeur de chaque numéral, en unités du système. À VÉRIFIER sur la liste de signes
# de J. L. Dahl / CDLI avant tout usage savant ; les tables sont faites pour être corrigées.
SYSTEMES = {
    'S': {'N01': 1, 'N14': 10, 'N34': 60, 'N45': 600, 'N48': 3600},     # sexagésimal
    'D': {'N01': 1, 'N14': 10, 'N34': 100, 'N45': 1000, 'N48': 10000},  # décimal
}
NOMS = {'S': 'sexagésimal', 'D': 'décimal'}

# Système imposé par l'objet compté, quand on le connaît : {'M388': 'D', ...}.
OBJET_SYSTEME = {}

NUMERAL = re.compile(r'^(\d+)\((N\d+[a-z]?)\)$')
NUMERO_LIGNE = re.compile(r"^[a-z]?\s*\d+[a-z']*\.\s*")
SIGNE_COURT = re.compile(r'^M(\d{1,2})(?=\D|$)')


def normaliser(signe):
    """M36 → M036 : le CDLI numérote les signes sur trois chiffres."""
    return SIGNE_COURT.sub(lambda m: 'M' + m.group(1).zfill(3), signe)


def jetons(corps):
    """Découpe une ligne ; « M260~a+1(N24) » donne l'objet M260~a puis le numéral 1(N24)."""
    for brut in corps.replace(',', ' ').split():
        if brut.startswith('|'):
            yield brut  # signe composé |…+…| : un seul objet
            continue
        parts = brut.split('+')
        if len(parts) > 1 and any(NUMERAL.match(nettoyer(x)[0]) for x in parts):
            yield from (x for x in parts if x)
        else:
            yield brut


@dataclass
class Entree:
    ligne: int
    texte: str
    objets: list = field(default_factory=list)
    numeraux: list = field(default_factory=list)   # [(nombre, signe), ...]
    valeurs: dict = field(default_factory=dict)    # {'S': 32, 'D': 32}
    systeme: str = ''                              # imposé par OBJET_SYSTEME
    inconnus: list = field(default_factory=list)   # numéraux d'aucun système connu
    abime: bool = False                            # signes cassés, douteux ou illisibles


@dataclass
class Tablette:
    id: str
    nom: str = ''
    entrees: list = field(default_factory=list)


def nettoyer(jeton):
    """Retire crochets de cassure et marques (#, ?, !, *) ; signale si le signe est abîmé."""
    abime = any(c in jeton for c in '[]#?<>') or jeton.lower() in ('x', '...')
    propre = re.sub(r'[\[\]#?!*<>]', '', jeton)
    return propre, abime


def valeurs(numeraux):
    """Valeur totale dans chaque système où tous les numéraux existent."""
    res = {}
    for nom, table in SYSTEMES.items():
        if numeraux and all(s in table for _, s in numeraux):
            res[nom] = sum(n * table[s] for n, s in numeraux)
    return res


def analyser_ligne(texte, num=0):
    """Découpe une ligne de texte en entrées « objets + nombre »."""
    corps = NUMERO_LIGNE.sub('', texte.strip())
    entrees, cur = [], None
    for brut in jetons(corps):
        jeton, abime = nettoyer(brut)
        if not jeton or jeton == '...':
            if cur:
                cur.abime = True
            continue
        m = NUMERAL.match(jeton)
        # Un objet qui suit des numéraux ouvre une nouvelle entrée.
        if cur is None or (not m and cur.numeraux):
            cur = Entree(ligne=num, texte=texte.strip())
            entrees.append(cur)
        cur.abime |= abime
        if m:
            cur.numeraux.append((int(m.group(1)), m.group(2)))
        else:
            cur.objets.append(normaliser(jeton))
    for e in entrees:
        e.valeurs = valeurs(e.numeraux)
        connus = set().union(*SYSTEMES.values())
        e.inconnus = sorted({s for _, s in e.numeraux if s not in connus})
        imposes = {OBJET_SYSTEME[o] for o in e.objets if o in OBJET_SYSTEME}
        if len(imposes) == 1:
            e.systeme = imposes.pop()
    return entrees


def analyser_atf(texte):
    """Lit un fichier ATF (une ou plusieurs tablettes) et renvoie la liste des tablettes."""
    tablettes, cur = [], None
    for i, ligne in enumerate(texte.splitlines(), 1):
        s = ligne.strip()
        if s.startswith('&'):
            ident, _, nom = s[1:].partition('=')
            cur = Tablette(id=ident.strip(), nom=nom.strip())
            tablettes.append(cur)
        elif not s or s[0] in '#@$>':
            continue  # commentaires, structure (@obverse…), états ($ broken), liens
        else:
            if cur is None:
                cur = Tablette(id='(sans identifiant)')
                tablettes.append(cur)
            cur.entrees.extend(analyser_ligne(s, i))
    return tablettes


def notation(numeraux):
    return ' '.join(f'{n}({s})' for n, s in numeraux)


def rapport(tablettes):
    out = []
    for t in tablettes:
        out.append(f'{t.id}' + (f' = {t.nom}' if t.nom else ''))
        for e in t.entrees:
            objets = ' '.join(e.objets) or '—'
            if not e.numeraux:
                qte = 'sans nombre'
            elif e.systeme and e.systeme in e.valeurs:
                qte = f'{e.valeurs[e.systeme]} ({NOMS[e.systeme]})'
            elif e.valeurs:
                vs = sorted(set(e.valeurs.values()))
                qte = (f'{vs[0]} (sexagésimal ou décimal)' if len(vs) == 1 else
                       ' ou '.join(f'{v} ({NOMS[k]})' for k, v in e.valeurs.items()))
            else:
                qte = 'système non géré : ' + ', '.join(e.inconnus)
            marque = ' [abîmé]' if e.abime else ''
            out.append(f'  l.{e.ligne:<4} {objets:<24} {notation(e.numeraux):<22} → {qte}{marque}')
    return '\n'.join(out)


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 1
    texte = sys.stdin.read() if argv[1] == '-' else open(argv[1], encoding='utf-8').read()
    tablettes = analyser_atf(texte)
    if '--json' in argv:
        print(json.dumps([asdict(t) for t in tablettes], ensure_ascii=False, indent=2))
    else:
        print(rapport(tablettes))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
