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
- La virgule sépare les signes du nombre (`M288 , 2(N01)`) ; un numéral collé par `+`
  (`M36+1(N30d)`) fait partie du signe. « Total par numéral » additionne chaque numéral de la tablette.
- `exemple_mdp17.atf` : MDP 17, 77+212+226, transmis par l’utilisateur (non revérifié sur le CDLI).
- Les signes cassés ou douteux (`[ ]`, `#`, `?`, `x`) sont marqués `[abîmé]`.
- Python 3 seul, aucune dépendance. Les exemples des tests sont fabriqués, pas de vraies tablettes.
