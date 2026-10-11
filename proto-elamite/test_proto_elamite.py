"""Tests de l'analyseur. Les lignes sont des exemples fabriqués au format ATF, pas de vraies tablettes."""
import unittest

import proto_elamite as pe

EXEMPLE = """\
&P000001 = Exemple fabriqué
#atf: lang qpe
@tablet
@obverse
1. M218 3(N14) 2(N01)
2. M036 M388 1(N34) 1(N14)
3. M376 1(N39b)
$ rest broken
4. [M218]# 2(N01)? M036 4(N01)
"""


class Tests(unittest.TestCase):
    def setUp(self):
        self.t = pe.analyser_atf(EXEMPLE)[0]
        self.e = self.t.entrees

    def test_entete(self):
        self.assertEqual(self.t.id, 'P000001')
        self.assertEqual(self.t.nom, 'Exemple fabriqué')

    def test_objet_puis_nombre(self):
        self.assertEqual(self.e[0].objets, ['M218'])
        self.assertEqual(self.e[0].numeraux, [(3, 'N14'), (2, 'N01')])
        self.assertEqual(self.e[0].valeurs, {'S': 32, 'D': 32})

    def test_systemes_differents(self):
        self.assertEqual(self.e[1].objets, ['M036', 'M388'])
        self.assertEqual(self.e[1].valeurs, {'S': 70, 'D': 110})

    def test_numeral_non_gere(self):
        self.assertEqual(self.e[2].valeurs, {})
        self.assertEqual(self.e[2].inconnus, ['N39b'])

    def test_deux_entrees_sur_une_ligne_et_cassure(self):
        self.assertEqual([x.objets for x in self.e[3:]], [['M218'], ['M036']])
        self.assertTrue(self.e[3].abime)
        self.assertFalse(self.e[4].abime)
        self.assertEqual(self.e[4].valeurs['D'], 4)

    def test_systeme_impose_par_objet(self):
        pe.OBJET_SYSTEME['M388'] = 'D'
        try:
            e = pe.analyser_ligne('1. M388 1(N34)')[0]
            self.assertEqual(e.systeme, 'D')
            self.assertIn('100 (décimal)', pe.rapport([pe.Tablette('x', entrees=[e])]))
        finally:
            pe.OBJET_SYSTEME.clear()

    def test_virgule_et_signe_qualifie(self):
        e = pe.analyser_ligne('12. M36+1(N30d) , 1(N54)')[0]
        self.assertEqual(e.objets, ['M036+1(N30d)'])
        self.assertEqual(e.numeraux, [(1, 'N54')])
        e = pe.analyser_ligne('10. M328b [...] M36+1(N30c) , 1(N34)')[0]
        self.assertEqual(e.objets, ['M328b', 'M036+1(N30c)'])
        self.assertTrue(e.abime)

    def test_cassure_en_debut_de_ligne(self):
        e = pe.analyser_ligne('01. [...] , [...] 4(N39b) 1(N24)')[0]
        self.assertTrue(e.abime)
        self.assertEqual(e.objets, [])
        self.assertEqual(e.numeraux, [(4, 'N39b'), (1, 'N24')])

    def test_normalisation(self):
        self.assertEqual(pe.analyser_ligne('2. M36+M343h M02b , 2(N01)')[0].objets, ['M036+M343h', 'M002b'])

    def test_totaux(self):
        t = pe.analyser_atf('&P1\n1. M288 , 2(N01)\n2. M288 , 3(N01) 1(N24)')[0]
        self.assertEqual(pe.totaux_par_numeral(t), {'N01': 5, 'N24': 1})

if __name__ == '__main__':
    unittest.main()
