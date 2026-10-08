# Flux serveur V1

`POST /api/prequalification` reçoit `{ "message": "...", "state": null }` au premier tour, puis le même contrat avec `state` retourné au tour précédent. Aucun cookie, session serveur ni stockage n'est ajouté. L'UI actuelle conserve ce state dans son état React et conserve son design. `/api/test-groq` reste disponible.

Le state contient le `Dossier` existant et, séparément, `askedQuestionsAtStart` : uniquement les questions effectivement affichées. Les pending globaux restent distincts de ce contexte P10.

Le flux réutilise `extractMessage`, la conversion et les validations, puis `applyObservationToField` pour chaque observation ordonnée avec les helpers existants. Le niveau par observation permet d'enregistrer les décisions réelles dans `Dossier.history` sans rejouer le merge. `syncPendingQuestions`, `selectPendingQuestions`, `registerPendingRejection` et `updateStalledTurns` restent responsables de leurs règles respectives. Seuls les rejets attribuables à une question réellement affichée consomment une tentative ; une ambiguïté P10 n'est pas attribuée à une cible.

La configuration réelle est `src/configs/prequalificationV1.ts`. Le socle universel est `demandePrincipale`, `localisation`, `délai`, `budget` et `contact`. `typeProjet` reste déclaré comme texte facultatif dans cette configuration et peut être omis ou défini comme enum dans une configuration sectorielle. Le délai reste textuel pour conserver aussi les délais relatifs sans inventer une date.

Aucune représentation de contact n'existait : V1 ajoute seulement `contact`, un champ `text` contenant un email OU un téléphone. Il ne faut pas les deux. Si plusieurs coordonnées sont exprimées, leur texte est conservé sans choix arbitraire et une seule coordonnée valide suffit. Les coordonnées peuvent être séparées par une virgule, un point-virgule, un slash, « ou » ou « et », avec un label email/téléphone facultatif suivi de deux-points. L'email est validé syntaxiquement par Zod. Le téléphone accepte 7 à 15 chiffres, un préfixe `+` facultatif, et des espaces/parenthèses/points/tirets de présentation ; les formats commençant par zéro doivent avoir un deuxième chiffre non nul. Aucune vérification d'existence, de pays ou de joignabilité n'est prétendue.

Le seul prédicat de complétude est celui de la configuration : demande principale, localisation et délai textuels non vides, budget numérique et au moins un contact valide, tous `provided`. `absent`, `unknown` et `conflicting` ne satisfont pas ces exigences. `typeProjet` et `surface` ne bloquent pas ce socle. Les champs encore insuffisants mais déjà `provided` ou `unknown` sont proposés à la synchronisation existante comme clarifications.

La question de conflit est exactement `J’ai deux informations différentes pour {fieldLabel}. Laquelle dois-je retenir ?`, produite par le code depuis `FieldDef.label`. B reçoit seulement les questions sélectionnées, avec des identifiants déterministes par tour. Un échec technique, un format invalide ou `insufficient_information` utilise la question canonique ; la sélection et le dossier ne sont jamais modifiés par B.

La réponse réussie contient `ok`, `state`, `qualification`, `questions` et des diagnostics limités (rejets, observations ignorées, unresolved, contact invalide, fallback B, nécessité de reprise humaine signalée par les compteurs). Une erreur contient seulement `ok: false` et `error.code`. Aucune clé, aucun prompt ni stack trace n'est renvoyé.

## Premier test manuel Groq

1. Configurer `GROQ_API_KEY` uniquement dans `.env.local`, sans préfixe `NEXT_PUBLIC_`.
2. Lancer `pnpm dev`, puis ouvrir l'UI sur `http://localhost:3000` (ou le port annoncé par Next).
3. Envoyer `Mon budget est de 12000 €.`. Le budget doit être renseigné, la qualification rester `incomplete`, et au maximum deux questions issues du moteur être affichées.

La même vérification peut se faire dans PowerShell :

```powershell
$firstTurn = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/prequalification' -ContentType 'application/json' -Body (@{ message = 'Mon budget est de 12000 €.'; state = $null } | ConvertTo-Json -Depth 100)
$firstTurn | ConvertTo-Json -Depth 100
$secondTurn = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/prequalification' -ContentType 'application/json' -Body (@{ message = 'Le type de projet est une rénovation. Ma demande principale est de rénover la cuisine.'; state = $firstTurn.state } | ConvertTo-Json -Depth 100)
$secondTurn | ConvertTo-Json -Depth 100
```

Un message renseignant le socle complet et un contact valide peut être essayé : `Le type de projet est une rénovation. Ma demande principale est de rénover la cuisine. La localisation est Lyon. Le délai est dans trois mois. Le budget est de 12000 €. Mon email est prospect@example.com.` La qualification attendue est `complete` si A extrait correctement toutes ces données, sans conflit.

Ces essais réels restent manuels : les tests automatisés mockent le provider et n'utilisent pas le réseau. Le modèle reste `openai/gpt-oss-120b`. Aucun RAG ni appel C n'est ajouté.

## Limites explicites

- L'état client est validé structurellement, mais n'est ni signé ni authentifié : il peut être modifié par le client. Aucune garantie de confiance du dossier n'est revendiquée pour une exposition en production. La persistance et l'intégrité serveur restent des décisions ouvertes.
- La sortie A conserve son contrat existant (`provide`/`unknown` seulement), sans extraction de `correct`/`remove`.
- Le contrôle de B reste structurel ; une formulation conforme au JSON ne prouve pas sa fidélité sémantique.
- Les compteurs existants signalent la reprise humaine ; aucun nouveau workflow de reprise, arrêt automatique ou escalade documentaire n'est inventé.
- Le dossier et son historique sont retransmis intégralement : ce flux V1 n'ajoute ni compactage ni persistance.
