# PINTOMÈTRE — Phase 1

Application statique, en français, sans installation ni compilation.

## Lancer

Depuis le dossier `pintometre` :

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Ouvrir http://127.0.0.1:8765/ . Le fichier `index.html` peut également être ouvert directement.

## Parcours

- Accueil : exemple partagé, « Surprends-moi », accès à la saisie. Résultat exprimé en 🍷.
- Doser : quatre catégories, volume libre (1–200 cl), degré libre (0–50 %). « AJOUTER À CE SOIR » ajoute le verre ; en modification, chaque changement met la session à jour en direct.
- Ce soir : total animé en 🍷, visuel en verres de vin (au-delà de 6 : « × 7,4 »), pile des verres, « ENCORE UN ? » (LE MÊME / AUTRE VERRE), cartes avec − / + (− à 1 retire le verre), toucher une carte pour la modifier.
- Barre persistante : total, Buzz et « ⚡ REMETTRE À ZÉRO », hors des effets visuels.
- Simulation : la cible suit le Buzz de la session (fantômes, inertie, latence simulée). Score de jeu uniquement.

## Calcul

- Alcool pur (g) = volume (cl) × degré / 100 × 0,8 × 10.
- 🍷 = 10 cl de vin à 12,5 % = 10 g. Équivalent vin = total de la session ÷ 10.
- Session : `drinks = [{id, type, name, volumeCl, abv, quantity}]`. Grammes, équivalent et Buzz sont toujours recalculés, jamais stockés. Affichage à une décimale, calcul exact.

## Moteur Buzz

- Niveau affiché = partie entière de l’équivalent arrondi (0 à 5+) : NET, CHAUD, ÇA BOUGE, ÇA TANGUE, FLOU, 🫠.
- L’intensité continue pilote des variables CSS (`--blur`, `--ghost`, `--drift`, `--tilt`, `--wobble`, `--inertia`) appliquées à l’en-tête et au contenu. Nav, barre de session et dialogues restent nets.
- Fonds op-art cinétiques (`opart.js`, canvas) dans les panneaux de couleur : la boisson elle-même à l’Accueil et dans Doser, toujours visible et générée selon le type (bière + mousse, vin + larmes, cocktail + glaçons et agrume, shot ambré + reflets), avec remplissage animé au changement, anneaux (Ce soir), damier polaire (Simulation). Leur déformation, leur vitesse et leur dédoublement suivent le Buzz. Invisibles tant qu’aucun verre n’est ajouté. Seul le panneau visible est dessiné, à ~30 i/s.
- « Réduire les mouvements » et la préférence système coupent les mouvements ; le flou et les fantômes restent.

Aucun compte, stockage persistant, suivi, estimation d’alcoolémie ou délai avant de conduire. La session vit en mémoire et repart à zéro au rechargement. Seules les polices utilisent un service externe (Google Fonts).

## Vérifications manuelles

- 1 × 33 cl à 8,5 % : 22,44 g → 2,2 🍷 (Buzz 2).
- 2 × 33 cl à 8,5 % : 44,88 g → 4,5 🍷 (Buzz 4).
- 33 cl à 8,5 % + 15 cl de vin à 13 % : 38,04 g → 3,8 🍷 (Buzz 3).
- Remise à zéro : 0 🍷, plus aucun effet.
- Volume nul ou hors limites : message et résultat bloqué.
- Navigation aller/retour : mêmes paramètres et résultat.
- Simulation : termine à cinq touches, peut être arrêtée et rejouée.
- Navigation clavier, zoom autorisé, dialogues fermables avec Échap, préférences de mouvement réduit.

## Progression chaotique — toute l’interface

Au-delà de six équivalents vin (et non six boissons), une intensité logarithmique
continue à croître avec chaque ajout. Le panneau se déforme, le total se dédouble
en cyan/magenta, les cartes dérivent indépendamment et les anneaux deviennent un
vortex. La navigation et la barre de session restent stables. Les effets se
résorbent en retirant des boissons et disparaissent à la remise à zéro.
Le mode « Réduire les mouvements » arrête les animations, mais garde les effets
statiques. Le temps du canvas avance sans saut lors des changements d’intensité.

### Surface liquide et échos

`result-effects.js` ajoute une déformation SVG lente dès huit équivalents, deux
échos décoratifs du total dès six, et une onde de 2,4 secondes à chaque ajout.
Les échos suivent une trajectoire mémorisée avec 330/660 ms de retard. La boucle
est limitée à environ 30 images/s et suspendue en arrière-plan
ou lorsque les mouvements sont réduits. Aucun calcul de session n’est modifié.


### Intensité partagée entre les écrans

Accueil, Doser, Ce soir et Simulation utilisent le total exact de la session pour
les effets liquides, les mouvements et les fonds animés. Les échos décoratifs
suivent le chiffre affiché sur Accueil, Doser et Ce soir ; la Simulation conserve
ses propres cibles fantômes. Seul le panneau visible est animé. Modifier un
nouveau verre avant de l’ajouter ne change pas l’intensité de la soirée.
Navigation et barre de session restent stables sur les quatre écrans.
