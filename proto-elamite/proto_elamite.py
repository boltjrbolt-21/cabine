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
FACES = {'obverse': 'o', 'reverse': 'r', 'left': 'g', 'right': 'd', 'top': 'h', 'bottom': 'b', 'edge': 'tr'}

# Système imposé par l'objet compté, quand on le connaît : {'M388': 'D', ...}.
OBJET_SYSTEME = {}

NUMERAL = re.compile(r'^(\d+)\((N\d+[a-z]?)\)$')
NUMERO_LIGNE = re.compile(r"^[a-z]?\s*\d+[a-z']*\.\s*")
SIGNE_COURT = re.compile(r'(?<![\w(])M(\d{1,2})(?!\d)')


def normaliser(signe):
    """M36 → M036, M36+M343h → M036+M343h : le CDLI numérote les signes sur trois chiffres."""
    return SIGNE_COURT.sub(lambda m: 'M' + m.group(1).zfill(3), signe)


@dataclass
class Entree:
    ligne: int
    texte: str
    ref: str = ''                                  # face + numéro, ex. « o 03 »
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
    """Découpe une ligne en entrées « objets , nombre ».

    Dans les translittérations du CDLI, la virgule sépare les signes de la notation
    numérique. Un numéral collé à un signe par « + » (M36+1(N30d)) fait partie du
    signe : c'est une précision sur l'objet, pas la quantité. Sans virgule, chaque
    numéral isolé est compté et un signe qui suit des numéraux ouvre une nouvelle entrée.
    """
    corps = NUMERO_LIGNE.sub('', texte.strip())
    virgule = ',' in corps
    entrees, cur, apres, abime_avant = [], None, False, False
    for brut in corps.replace(',', ' , ').split():
        if brut == ',':
            apres = True
            continue
        jeton, abime = nettoyer(brut)
        if not jeton or jeton == '...':
            if cur:
                cur.abime = True
            else:
                abime_avant = True
            continue
        m = NUMERAL.match(jeton)
        est_nombre = bool(m) and (apres or not virgule)
        if apres and not est_nombre:
            if cur:
                cur.abime |= abime
            continue  # après la virgule, seul compte le nombre
        if cur is None or (not est_nombre and cur.numeraux):
            cur = Entree(ligne=num, texte=texte.strip(), abime=abime_avant)
            abime_avant = False
            entrees.append(cur)
        cur.abime |= abime
        if est_nombre:
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
    tablettes, cur, face = [], None, ''
    for i, ligne in enumerate(texte.splitlines(), 1):
        s = ligne.strip()
        if s.startswith('&'):
            ident, _, nom = s[1:].partition('=')
            cur, face = Tablette(id=ident.strip(), nom=nom.strip()), ''
            tablettes.append(cur)
        elif s.startswith('@'):
            face = FACES.get(s[1:].split()[0], face)
        elif not s or s[0] in '#$>':
            continue  # commentaires, états ($ broken), liens
        else:
            if cur is None:
                cur, face = Tablette(id='(sans identifiant)'), ''
                tablettes.append(cur)
            num = NUMERO_LIGNE.match(s)
            ref = (face + ' ' + num.group(0).strip().rstrip('.')).strip() if num else f'l.{i}'
            for e in analyser_ligne(s, i):
                e.ref = ref
                cur.entrees.append(e)
    return tablettes


def totaux_par_numeral(tablette):
    """Somme de chaque numéral sur la tablette, sans avoir besoin de connaître sa valeur."""
    tot = {}
    for e in tablette.entrees:
        for n, sig in e.numeraux:
            tot[sig] = tot.get(sig, 0) + n
    return dict(sorted(tot.items()))


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
                qte = 'valeur non calculée (' + ', '.join(e.inconnus) + ')'
            marque = ' [abîmé]' if e.abime else ''
            out.append(f'  {e.ref or e.ligne:<6} {objets:<30} {notation(e.numeraux):<22} → {qte}{marque}')
        totaux = totaux_par_numeral(t)
        if totaux:
            out.append('  Total par numéral : ' + ' '.join(f'{n}({s})' for s, n in totaux.items()))
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
