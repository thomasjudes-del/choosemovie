# ChooseMovie

Mini videotheque personnelle statique : import d'un export AI Context Basket, lecture compacte, filtres, fiches depliables et enrichissement TMDB.

## V0

- importe un fichier .txt AI Context Basket contenant des lignes [DIR] / [FILE]
- nettoie les noms de releases et deduplique les copies evidentes
- distingue film, serie et collection apres enrichissement
- affiche annee, genre, note TMDB, duree, acteurs principaux et mots-cles
- clic sur une ligne : poster, synopsis, realisation/creation, casting et details
- filtres type, genre, note, duree, tri et recherche plein texte
- bouton Au hasard
- donnees personnelles stockees uniquement dans le navigateur

## Confidentialite

Le repo ne contient volontairement aucune bibliotheque personnelle. Le depot est public : l'import reste cote navigateur et les chemins locaux ne sont pas publies.

## TMDB

Dans l'app, renseigner un API Read Access Token TMDB. Le token reste dans le stockage local du navigateur et n'est jamais commite. La note affichee est la moyenne utilisateurs TMDB.

## Limite connue

Un export qui ne liste que le premier niveau d'un dossier ne peut pas connaitre les films caches dans un dossier-collection comme JAMES BOND ou STAR WARS. ChooseMovie marque donc ces entrees comme collections au lieu d'inventer leur contenu.
