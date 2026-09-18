# ChooseMovie

Mini vidéothèque personnelle statique pour choisir rapidement quoi regarder à partir d'un export AI Context Basket.

## V0

- import d'un fichier .txt contenant des lignes [DIR] / [FILE]
- nettoyage des noms de releases et dédoublonnage des copies évidentes
- regroupement des épisodes SxxExx et des saisons sous une seule série
- distinction film, série, collection et titre non identifié
- ligne compacte : titre, année, type, genres, acteurs, mots-clés, note TMDB, durée
- clic sur une ligne : poster, synopsis, réalisation/création, casting et emplacement d'origine
- recherche plein texte et filtres type, genre, note, durée
- tris titre, note, année ou mélange aléatoire
- export du catalogue enrichi en JSON
- reprise automatique de l'enrichissement si on l'arrête

## Démarrage

Le repo ne contient volontairement aucune bibliothèque personnelle. Le dépôt est public et l'import reste côté navigateur.

1. Ouvrir l'app.
2. Cliquer sur Importer et choisir l'export .txt généré par AI Context Basket.
3. Dans TMDB, créer ou récupérer un API Read Access Token.
4. Dans ChooseMovie, cliquer TMDB, coller le token, enregistrer puis Enrichir les titres.

Le token et le catalogue restent dans le localStorage du navigateur et ne sont jamais commités.

## Hébergement

L'app est 100 % statique. Elle peut être publiée directement avec GitHub Pages depuis la branche main, dossier racine /.

Pour tester localement :

```bash
python -m http.server 8080
```

Puis ouvrir http://localhost:8080.

## Données TMDB

ChooseMovie utilise TMDB pour la recherche, les détails, crédits, mots-clés et posters. La note affichée est la moyenne utilisateurs TMDB. Pour une série, la durée affichée correspond à la durée habituelle d'un épisode lorsqu'elle est disponible.

## Limite connue

L'export actuel ne descend pas forcément dans les sous-dossiers. Si un dossier comme JAMES BOND ou STAR WARS ne contient pas la liste de ses films dans l'export, ChooseMovie ne peut pas les inventer et conserve l'entrée comme collection ou titre à vérifier.
