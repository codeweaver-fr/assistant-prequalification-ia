# Audit et validation V1 — 8 octobre 2026

Rapport historique du refactor A5/P10. La fermeture ultérieure des dettes et la préparation Gemini sont documentées dans [le rapport suivant](v1-debts-provider-comparison.md) ; les résultats ci-dessous restent ceux de cette première étape.

La frontière A5 a été assouplie sans dictionnaire métier : 45/47 scénarios de référence réussissent après refactor, contre 27/47 avant. **La robustesse réelle de A n’est pas démontrée** : le dernier lot Groq contient 43 erreurs HTTP 429, trois erreurs d’extraction et une seule réponse entièrement correcte. Un test Vitest vert signifie que l’évaluation a été exécutée, pas que tous ses scénarios réussissent.

## 1. Architecture trouvée

API préqualification → `processMessage` → A (`extractMessage`) → contrat RawExtraction complet → conversion → validation A0–A5/P3 → merge existant → historique/provenance → synchronisation pending → qualification → sélection des questions → B ou question canonique. L’état arrive du client ; aucune nouvelle persistance n’a été ajoutée.

A reçoit les définitions des champs et le message courant. Les questions réellement affichées sont transmises à la validation, mais pas au prompt de A. A ne produit pas `sourceMessageId`, ne décide pas de la complétude et ne sélectionne pas les questions.

## 2. Problèmes architecturaux identifiés

- A5 assimilait souvent l’absence de cue à une ellipse. Les introductions spatiales configurées et la reconnaissance temporelle ajoutaient des chemins particuliers, sans couvrir le langage naturel général.
- La citation littérale prouve une valeur exprimée ; elle ne prouve pas universellement son rattachement sémantique à un champ texte ouvert.
- Deux observations peuvent exploiter une même preuve pour des champs concurrents.
- Le contrat A distingue les statuts d’extraction, mais ne transmet pas l’intention `correct`. Une correction explicite peut donc devenir un conflit dans le merge existant.
- Le modèle ne reçoit pas les questions affichées ; les ellipses telles que « aucune idée » ne peuvent pas être attribuées fiablement par A à partir du seul message.

## 3. Baseline avant refactor

47 scénarios construits et exécutés avant modification de production. Référence : 27 succès, 19 erreurs de validation, une limite d’extraction/correction, zéro erreur de décision. Groq historique : seulement quatre réponses exploitables ; 43 appels ont échoué.

La mesure initiale confondait les échecs provider avec les erreurs de contrat et comptait certaines absences dues à ces échecs comme des rejets réussis. Cette erreur de mesure a été corrigée dans les rapports sauvegardés, sans modifier les sorties historiques ni rejouer la baseline de référence sur le moteur corrigé.

## 4. Spécification écrite

`docs/validation-v1-spec.md`, écrite avant le refactor de production, expose l’audit, les responsabilités, accept/reject/clarify, les preuves, les cues, P10 et les limites de la règle.

## 5. Fichiers de cette mission

- Production : `src/engine/validation/isSelfContainedText.ts`, `validateObservationCue.ts`, `validateObservations.ts` et commentaire A5 de `validateObservation.ts`.
- Régression : `src/engine/validation/selfContainedText.test.ts`.
- Évaluation : `evals/validation-v1/scenarios.ts`, `generalization.eval.test.ts`.
- Documentation : spécification, présent rapport et cinq fichiers JSON dans `docs/evaluations/`.

Les autres modifications visibles dans Git préexistaient à cette mission. Aucune modification finale du prompt, du provider, du merge, des configurations, de l’UI, de B, de C ou du RAG n’est apportée par cette mission.

## 6. Refactor réalisé

Après les validations existantes, un `provide` textuel peut passer sans cue si sa valeur est littéralement supportée et si sa citation contient au moins deux tokens alphabétiques, n’est pas un nom composé dont tous les mots commencent par une majuscule, n’est pas une déclaration d’ignorance reconnue par P3 et ne désigne pas un champ numérique/enum concurrent.

Cette condition est une heuristique de contexte, pas une preuve complète du sens. Les anciennes voies d’autorisation restent compatibles. Aucun nom de ville, pièce, saison ou expression n’a été ajouté en production.

À la fin de la validation du lot, une même valeur textuelle avec la même citation attribuée à plusieurs champs sans cue distinctive est ignorée. Les index originaux sont conservés et les candidats invalides ne participent pas à cette détection.

## 7. Rôle final des cues

Signal supplémentaire, utile pour les valeurs courtes, unités et désambiguïsation. Une cue n’est plus obligatoire pour une citation textuelle contextualisée. Les contrôles number/date/enum conservent leurs règles déterministes et leur prudence de rattachement.

## 8. Règle finale P10

Une valeur nue sans signal fiable passe uniquement pour l’unique champ réellement demandé. Plusieurs questions distinctes ne permettent pas de choisir arbitrairement. `100`, `8000`, `mars` et `La Garde` restent bloqués dans le contexte multi-questions testé. Aucun pending global n’est assimilé à une question affichée. La clarification utilise les pending et la sélection existants ; aucune nouvelle question neutre n’a été inventée.

## 9. Protections conservées

Contrat complet, champs autorisés, citation exacte à la conversion, raw supporté, normalisations configurées, types, nuances exact/approximate/range/bound/date, rejet des citations tronquées, options enum, P3, provenance ajoutée par le code, conflits, history, pending, stalledTurns et abandonedFields. Complétude : demandePrincipale + localisation + délai + budget + contact valide ; typeProjet reste optionnel. Aucun repair retry ; retry technique existant limité à deux tentatives.

## 10. Tests unitaires et régressions

23 nouveaux tests vérifient l’acceptation de textes sans cues, même avec d’autres questions affichées ; les ellipses, dont 100 entre surface et budget ; les noms composés nus ; l’ignorance ; les champs numériques concurrents ; l’absence d’autorisation nouvelle pour correct/remove/unknown ; les textes inventés ; les collisions de preuves ; les index et l’absence d’empoisonnement par un candidat invalide.

La suite complète conserve les tests existants P3/P10, number/date/enum, merge, questions, complétude et provider.

## 11. Généralisation avant/après

| Mesure                  | Scénarios | Réussis | Provider | Extraction/contrat | Validation | Décision |  FP | FN hors provider |
| ----------------------- | --------: | ------: | -------: | -----------------: | ---------: | -------: | --: | ---------------: |
| Référence avant         |        47 |      27 |        0 |                  1 |         19 |        0 |   0 |               19 |
| Référence après         |        47 |      45 |        0 |                  1 |          1 |        0 |   0 |                1 |
| Groq historique avant   |        47 |       2 |       43 |                  1 |          1 |        0 |   0 |                2 |
| Même Groq, replay après |        47 |       3 |       43 |                  1 |          0 |        0 |   0 |                1 |
| Nouveau lot Groq après  |        47 |       1 |       43 |                  3 |          0 |        0 |   1 |                3 |

Le replay compare les mêmes sorties brutes. Le nouveau lot est une comparaison indicative, non appariée ; les erreurs HTTP 429 empêchent une conclusion statistique sur A. FP inclut les champs modifiés hors attendu : cela signale une extraction supplémentaire à examiner, pas automatiquement une hallucination démontrée.

Les JSON détaillent par scénario : détection, valeurs, citations, types, nuances, FP/FN, rejet d’ambiguïté, questions inutiles, issues de conversion et diagnostics. Les données et contacts des scénarios sont synthétiques.

## 12. Cas encore échoués

Référence : `money-07` (« je ne dépasserai pas 15k »), borne non reconnue par A3 ; `correction-01`, intent correct non transmissible par A. Ces échecs restent visibles.

Nouveau lot réel : `request-01` et `request-03`, A renvoie tous les champs missing malgré la demande ; `request-04`, A renseigne uniquement typeProjet (« cloison acoustique ») et oublie demandePrincipale. La validation n’invente pas l’observation manquante. Les 43 autres scénarios échouent à l’appel provider HTTP 429 ; aucun rejet métier réussi n’est déduit de ces appels.

## 13. Limites connues V1

Le contexte rédigé n’est pas un oracle sémantique. Une affectation textuelle erronée mais littérale peut rester acceptée. La casse peut produire des faux négatifs et un nom composé écrit en minuscules peut contourner cette heuristique. Une citation tronquée jusqu’au seul nom peut rester bloquée hors question unique. Les collisions ne couvrent que la même valeur avec la même citation. Les nombres en lettres et la multiplication implicite d’une borne restent hors scope mesuré.

## 14. Dette technique restante

Absence de contexte des questions dans l’entrée A ; absence d’intents destructeurs/correction dans RawExtraction ; ancien chevauchement des signaux A5 ; validation sémantique des champs texte ouverte ; limitation provider qui empêche une campagne réelle complète.

## 15. Recommandations dans le périmètre V1

Relancer le lot réel lorsque les quotas Groq le permettent, en conservant les scénarios et scores. Examiner les champs omis et les rattachements textuels avant de déclarer la V1 robuste. Trancher séparément l’exposition des questions affichées à A et le transport de correct, sans ajouter de retry sémantique ni déplacer les décisions du merge dans A. Ne pas étendre les cues pour obtenir artificiellement 47/47.

## 16. Vérifications

| Commande                                              | Résultat final                       |
| ----------------------------------------------------- | ------------------------------------ |
| `pnpm exec prettier --write <fichiers de la mission>` | exit 0                               |
| `pnpm test`                                           | exit 0 ; 636 tests, 46 fichiers      |
| `pnpm tsc --noEmit`                                   | exit 0 ; aucune erreur               |
| `pnpm lint`                                           | exit 0 ; aucune erreur               |
| `pnpm run format:check`                               | exit 0 ; tous les fichiers conformes |
| `git diff --check`                                    | exit 0 ; aucune sortie               |

Les 636 tests incluent un test d’exécution de l’évaluation ; ils ne signifient pas 47/47 scénarios de généralisation réussis. La première vérification TypeScript a trouvé deux erreurs dans les nouveaux fixtures de test ; elles ont été corrigées. Aucun défaut de production n’a été masqué par ces erreurs de test.

## 17. État Git

État final, incluant les changements antérieurs préservés :

```text
 M src/app/api/test-groq/route.ts
 M src/app/page.tsx
 M src/engine/model/config.ts
 M src/engine/model/types.ts
 M src/engine/questions/syncPendingQuestions.test.ts
 M src/engine/questions/syncPendingQuestions.ts
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
?? src/engine/validation/isSelfContainedText.ts
?? src/engine/validation/p10AskedQuestions.test.ts
?? src/engine/validation/selfContainedText.test.ts
```

Aucun commit ni push.
