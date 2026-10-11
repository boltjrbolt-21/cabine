# Analyseur proto-élamite

Lit des translittérations au format ATF du CDLI (cdli.earth) et sépare, ligne par ligne,
les signes d'objet (M…) des numéraux (N…), puis calcule la quantité.

```
python3 proto_elamite.py tablettes.atf          # rapport lisible
python3 proto_elamite.py tablettes.atf --json   # sortie JSON
python3 -m unittest test_proto_elamite           # tests
```

- Les mêmes numéraux servent à plusieurs systèmes : sans contexte, la valeur est donnée en
  sexagésimal **et** en décimal. Renseigner `OBJET_SYSTEME` (ex. `{'M388': 'D'}`) pour trancher.
- Les tables `SYSTEMES` sont à vérifier sur la liste de signes de J. L. Dahl / CDLI ;
  les numéraux d'autres systèmes (grain, etc., ex. `N39b`) sont signalés « non gérés ».
- Les signes cassés ou douteux (`[ ]`, `#`, `?`, `x`) sont marqués `[abîmé]`.
- Python 3 seul, aucune dépendance. Les exemples des tests sont fabriqués, pas de vraies tablettes.
