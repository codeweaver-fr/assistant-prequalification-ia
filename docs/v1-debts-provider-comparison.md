# Dettes V1 et préparation Groq/Gemini — 8 octobre 2026

## 1. État de départ confirmé

Lecture du rapport et de la spécification avant modification. Référence 45/47, baseline historique 27/47, 636 tests dans 46 fichiers. Modifications précédentes préservées ; aucun autre projet concerné.

## 2. Questions réellement posées transmises à A

`extractionMessages` reçoit `askedQuestionsAtStart` et transmet field + question canonique. `extractMessage` utilise le même contexte pour le prompt et pour la conversion/validation. Aucun dossier ni pending global n’est transmis. Le prompt interdit l’affectation par ordre et demande ambiguous si le rattachement reste incertain.

## 3. Intention correct

RawExtraction transporte désormais intent provide/correct/remove/unknown. Provided avec provide/correct contient une valeur ; provided avec remove a value null ; unknown a intent unknown et value null ; missing/ambiguous ont intent null. La conversion ne décide pas le merge. P3 rejette les intentions non prouvées. Une contradiction non explicitement corrigée reste provide et devient conflicting par le merge existant.

Compatibilité : les anciens JSON sans intent restent acceptés avec le mapping historique provide/unknown. Aucun correct/remove n’est inféré silencieusement. Les few-shots existants sont émis avec leurs intentions cohérentes, identiques pour les deux providers.

## 4. Nombres abrégés

k/K signifie ×1000, collé ou séparé par des espaces ordinaires/insécables. Entiers, décimales non ambiguës (1,5k / 1.5 K), groupes de milliers déjà reconnus, exact/approximate/range/bound conservés. Les unités km/kWh ne sont pas des montants en k ; aucun préfixe de leur nombre n’est utilisé comme montant de repli. Les jours ordinaux des dates restent reconnus.

La borne « ne dépasserai pas » est traitée comme une négation grammaticale du verbe dépasser, avec plusieurs personnes/temps et la forme infinitive, sans exception sur un montant précis. Une citation tronquée perdant cet opérateur est refusée. Les signes négatifs/ambiguës restent rejetés.

Hors scope : nombres en lettres, autres multiplicateurs, séparateurs ambigus tels que 1.500k, multiplication implicite d’une borne. Le code ne devine pas une unité ni le champ budget à partir de k seul.

## 5. Tests des trois dettes

13 nouveaux tests de contrat/contexte/intents/merge et preuves de correction concurrentes ; 27 tests de notation compacte, bornes, citations tronquées, nombres signés, unités et date ordinale. Aucun réseau dans les tests classiques.

Régression directe démontrée avant correction : une localisation spontanée acceptée en provide était ignorée quand le nouveau contrat la transportait en correct. Seul le chemin textuel contextualisé a été étendu à correct après preuve P3. Le rejet des preuves concurrentes couvre aussi correct pour éviter plusieurs remplacements sur une même citation. Remove/unknown restent inchangés. Le merge n’a pas été modifié ; aucun cue ajouté.

## 6. Jeu de 47 scénarios

Les 47 phrases sont strictement inchangées, vérifiées contre la baseline. Seule la sortie de référence de la famille correction est enrichie avec intent correct, conformément au nouveau contrat.

Référence : **46/47**, zéro erreur d’extraction/contrat attendue, une erreur de validation, zéro erreur moteur, zéro FP, un FN. Le dernier cas « je ne dépasserai pas 15k » passe désormais A3 ; il reste ignoré par A5 faute de rattachement budgétaire ou de question réellement posée. La même observation passe avec l’unique question budget. Aucun assouplissement opportuniste de P10 pour atteindre 47/47.

Rapport : `docs/evaluations/validation-debts.json`. Les anciennes mesures baseline/après refactor restent conservées.

## 7. Architecture provider

Interface existante `JsonAiProvider` réutilisée. `src/adapters/groq.ts` reste le provider de l’UI/API. `src/adapters/gemini.ts` est une alternative d’évaluation. Aucun changement du moteur ou de la sélection produit.

La politique technique bornée existante est partagée via `withProviderTechnicalRetry`, avec le nom Groq historique préservé. La classification commune expose les six catégories provider. Aucun framework provider supplémentaire.

## 8. Fichiers Gemini

`src/adapters/gemini.ts` et `gemini.test.ts`. Dépendance déjà installée `@google/genai` 2.26.0 réutilisée, API vérifiée dans son code/types locaux ; aucun ajout de package. `GEMINI_API_KEY` et `GEMINI_MODEL` doivent être définis côté serveur. Aucun modèle deviné ni clé affichée. Le SDK désactive ses retries internes au client ET à la requête (`attempts: 1`).

## 9. Contrat commun

Même constructeur de messages A, définitions, contexte, prompt et few-shots. Gemini transpose seulement les rôles assistant → model et les instructions system vers systemInstruction, sans modifier le contenu logique. JSON demandé par responseMimeType, comme le mode json_object de Groq. Le JSON reste non fiable jusqu’à la même conversion RawExtraction, P3/A3/A5/P10 et au même merge.

## 10. Erreurs techniques

429/502/503/504, timeout et réseau identifiable : une tentative normale + un retry technique au maximum. 400/401/403/404 et HTTP non autorisés : aucun retry. Abort utilisateur et erreur inconnue : aucun retry. Timeout par tentative 15 secondes ; attente par défaut 750 ms. Logs : catégorie, événement et numéro de tentative seulement.

Le décodage JSON et le rejet d’une réponse vide restent hors retry. JSON invalide/vide = qualité de sortie, jamais repair retry ni erreur HTTP fabriquée. Les erreurs HTTP et non-exécutions ne comptent pas comme erreurs sémantiques du moteur.

## 11. Runner comparatif

`evals/validation-v1/campaign.ts` + tests ; suite de généralisation existante adaptée. Rapports séparés `comparison-groq.json` et `comparison-gemini.json`, sorties brutes séparées, replay hors réseau possible. B est mocké afin de comparer exclusivement A et les décisions du même moteur.

Les compteurs couvrent tentés/non tentés, réponses reçues, succès, extraction/contrat, validation, moteur, HTTP, 429, 5xx, sorties contractuellement invalides, FP/FN, citations et nuances incorrectes. Disponibilité et qualité restent distinctes. Les erreurs HTTP sont comptées par scénario après épuisement du retry, pas par requête HTTP individuelle.

## 12. Protections quota et commandes

Scénarios séquentiels ; deux secondes entre scénarios par défaut. `PREQUAL_EVAL_DELAY_MS` configure le délai (borné à 1–60 secondes en mode réel). Arrêt dès le premier scénario qui échoue encore en 429 ; seuil configurable `PREQUAL_EVAL_MAX_429`. Arrêt immédiat sur auth/bad request, arrêt après trois échecs techniques consécutifs. Non-exécutés explicitement marqués ; INCONCLUSIVE si non-exécutions ou plus de 20 % d’indisponibilité. Aucun retry supplémentaire du runner.

Depuis PowerShell, Groq uniquement :

```powershell
$env:PREQUAL_EVAL_PROVIDER = 'groq'
$env:PREQUAL_EVAL_PHASE = 'compare'
$env:PREQUAL_EVAL_LIVE = '1'
$env:PREQUAL_EVAL_DELAY_MS = '2000'
pnpm exec vitest run evals/validation-v1/generalization.eval.test.ts
```

Pour Gemini, remplacer uniquement le provider par gemini, après configuration serveur de sa clé et de son modèle. Pour rejouer les résultats sans réseau, utiliser `PREQUAL_EVAL_LIVE = '0'`. Les tests ordinaires ne lancent pas de campagne réelle. Un replay reconstruit les compteurs et le motif d’arrêt depuis les enregistrements ; sa cadence est null car il n’émet aucun appel.

## 13. Groq réel

5 scénarios tentés sur 47, 4 réponses reçues, 1 réussite complète, 3 erreurs d’extraction (demandes omises), 0 erreur de validation et 0 erreur moteur sur les réponses reçues. Le cinquième scénario échoue en HTTP 429 persistant ; les 42 suivants ne sont pas exécutés. Aucun 5xx, aucun JSON contractuellement invalide sur les quatre réponses reçues, zéro FP et trois FN. **INCONCLUSIVE** : aucun score global fiable du modèle ne peut être déduit de ces quatre réponses.

## 14. Gemini réel

0 scénario tenté, 47 non exécutés. `GEMINI_API_KEY` et `GEMINI_MODEL` absents de l’environnement disponible. Zéro appel réseau Gemini. Les 18 tests du provider sont mockés ; ils ne mesurent pas sa compréhension réelle.

## 15. Comparaison inconclusive

Groq est limité par le quota, Gemini n’est pas configuré. Aucun gagnant annoncé. Les deux providers utilisent le même jeu inchangé et la même logique ; les rapports sauvegardent ces limitations au lieu de compter une erreur HTTP ou une non-exécution comme un rejet métier réussi.

## 16. Vérifications

Les trois dettes ont passé les checks avant l’ajout de Gemini. Résultats finaux sur l’ensemble des changements :

| Commande                                         | Résultat                             |
| ------------------------------------------------ | ------------------------------------ |
| `pnpm exec prettier --write <fichiers modifiés>` | exit 0                               |
| `pnpm test`                                      | exit 0 ; 704 tests, 50 fichiers      |
| `pnpm tsc --noEmit`                              | exit 0 ; aucune erreur               |
| `pnpm lint`                                      | exit 0 ; aucune erreur               |
| `pnpm run format:check`                          | exit 0 ; tous les fichiers conformes |
| `git diff --check`                               | exit 0 ; aucune sortie               |

68 tests ajoutés : 40 sur les dettes et leurs garde-fous, 18 Gemini, 10 runner. Le test d’exécution de l’évaluation ne transforme pas les 46/47 en 47/47. Une erreur TypeScript du fixture immuable a été trouvée puis corrigée avant l’ajout de Gemini.

## 17. Limites V1 restantes

A5 garde ses heuristiques de rattachement, qui ne prouvent pas toute sémantique d’un champ texte ouvert. Le contexte des questions aide A mais ne lui donne aucune autorisation de contourner P10. Une ellipse « mars, 10000 » peut donc rester bloquée si le rattachement n’est pas suffisamment prouvé. Les omissions réelles de A restent visibles, sans réparation. Le format historique sans intent demeure volontairement accepté ; son retrait serait une décision de compatibilité séparée.

## 18. Git

Aucun commit ni push. Les modifications antérieures sont préservées. État complet `git status --short` :

```text
 M src/app/api/test-groq/route.ts
 M src/app/page.tsx
 M src/engine/model/config.ts
 M src/engine/model/types.ts
 M src/engine/questions/syncPendingQuestions.test.ts
 M src/engine/questions/syncPendingQuestions.ts
 M src/engine/validation/parseNumbers.ts
 M src/engine/validation/supportsValue.ts
 M src/engine/validation/validateObservation.ts
 M src/engine/validation/validateObservationCue.test.ts
 M src/engine/validation/validateObservationCue.ts
 M src/engine/validation/validateObservationValueSupport.test.ts
 M src/engine/validation/validateObservationValueSupport.ts
 M src/engine/validation/validateObservations.ts
?? docs/
?? evals/
?? src/adapters/
?? src/app/api/prequalification/
?? src/configs/
?? src/engine/questions/canonicalQuestion.test.ts
?? src/engine/questions/canonicalQuestion.ts
?? src/engine/validation/compactNumbers.test.ts
?? src/engine/validation/isSelfContainedText.ts
?? src/engine/validation/p10AskedQuestions.test.ts
?? src/engine/validation/selfContainedText.test.ts
```
