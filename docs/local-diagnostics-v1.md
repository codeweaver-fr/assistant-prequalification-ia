# Diagnostic des échanges V1

Pour le serveur local, définir `PREQUAL_DIAGNOSTICS=1` dans `.env.local`, puis redémarrer `pnpm dev`. Retirer cette variable après le diagnostic. Aucune trace n'est produite par défaut ni en production.

Le terminal serveur affiche deux événements corrélés par `messageId` :

- `A-validation` : champs réellement demandés, sortie structurée de A pour les champs configurés, conversion et observations acceptées/rejetées/ignorées ;
- `turn` : décisions de merge, pending et questions finalement sélectionnées.

`A-error` indique une erreur technique du provider sans afficher son message brut. Aucun prompt, clé ou diagnostic supplémentaire n'est envoyé au navigateur. Les traces contiennent les valeurs et citations du prospect, notamment ses coordonnées : les conserver uniquement pour le diagnostic local.

Le parcours « je veux refaire mon salon » puis « marseille , avant l'été » reproduit actuellement le rejet de la localisation par P10 même avec une sortie A correcte. Les tests documentent ce défaut ; ils ne démontrent pas que le provider avait produit cette sortie lors de l'échange réel. Une réponse introduite par « à marseille » ou une localisation répondant seule à une unique question passe déjà les règles existantes.
