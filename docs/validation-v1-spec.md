# Validation V1 — audit et spécification

## Audit avant modification

`POST /api/prequalification` → `extractMessage` → Groq → `convertRawExtraction` → `validateObservations` → `applyObservationToField` → historique → `syncPendingQuestions` → `selectPendingQuestions` → B ou question canonique. L'état est retransmis par le client, sans stockage serveur.

La conversion exige tous les champs configurés, citations exactes et raw inclus dans la citation. Un texte doit rester littéral ou suivre une équivalence métier déclarée ; une enum doit être configurée et exprimée. A0 borne les observations ; A1 vérifie champ/forme/type ; A2 vérifie les frontières de citation ; P3 prouve les intentions sensibles ; A3 prouve nombres, dates et conservation des nuances ; A4 contrôle les enums. A5 autorise une cue, une introduction spatiale configurée ou une expression calendaire reconnue. Sinon, une seule question réellement affichée doit correspondre au champ. Plusieurs questions entraînent `reponse_elliptique_ambigue`. Aucun pending global ne constitue une question affichée.

Le lexical influence aussi P3, les marqueurs numériques/date, le support des enums et la résolution de conflits. Ces protections ne sont pas des dictionnaires de formulations à étendre. La complétude dépend uniquement de demandePrincipale, localisation, délai, budget et contact valide. typeProjet est facultatif.

Risques : citation correcte ignorée faute de cue ; mois/saisons ou localisation non reconnus ; normalisation textuelle enrichie ; citation numérique tronquée ; même preuve affectée à plusieurs champs ; affectation sémantique erronée malgré une valeur littérale. Un contrat JSON ne prouve pas à lui seul le sens d'un champ.

## Responsabilités

A comprend et propose field/status/raw/normalized/sourceText. La validation vérifie la preuve et décide accept/reject/clarify. Le moteur conserve exclusivement merge, correction, conflit, provenance, history, pending et questions. A ne fournit jamais sourceMessageId.

## Règle générale ciblée

Après A1–A4 et les protections de la conversion :

- Cue présente : signal de rattachement supplémentaire, conservé pour compatibilité ; pas une obligation générale.
- Une proposition `provide` textuelle littéralement supportée peut être autonome si sa citation contient un contexte rédigé (au moins deux tokens alphabétiques), ne se réduit pas à un nombre ou à un nom composé dont chaque mot commence par une majuscule, ne correspond pas à une déclaration d'ignorance P3, et ne désigne pas explicitement un champ numérique ou enum concurrent configuré. Cette règle est indépendante des noms de villes, pièces, saisons et prépositions.
- Les nombres restent soumis à A3 et au rattachement explicite ou à l'unique question. Une phrase numeric-compatible entre deux champs n'est pas rendue fiable par sa longueur. Les dates structurées conservent leurs contrôles existants.
- Depuis la fermeture des dettes du 8 octobre, `correct` bénéficie du chemin textuel contextualisé uniquement après preuve P3 : cela conserve le rattachement accepté en provide lors du transport du nouvel intent. `remove` et `unknown` gardent leurs règles. Les preuves textuelles concurrentes restent ignorées pour provide/correct.
- Une preuve textuelle attribuée à plusieurs champs sans signal distinctif est ignorée : on ne choisit aucune cible du modèle.
- Une valeur nue sans rattachement reste une ellipse. Une unique question du bon champ l'autorise ; plusieurs questions ne l'autorisent pas. `100` pour surface/budget reste bloqué. Une clarification neutre est nécessaire, sans inventer le champ ; le mécanisme de questions existant la porte.

Accept = contrat, citation, support, type, intentions et rattachement cohérents. Reject = citation/type/valeur/nuance/intention invalide. Clarify = ambiguïté ou ellipse non rattachable, avec les raisons existantes et les pending existants.

## Exemples et limites

`avant l’été`, `quand ce sera possible`, `chez mes parents à Ollioules` sont des citations contextualisées. `mars`, `8000`, `100` sans rattachement restent prudents. `environ 12000 €` exige approximate et conserve environ. Un texte non cité, une enum inconnue ou une valeur inventée restent rejetés.

Cette politique prouve la provenance et la fidélité littérale, pas toute affectation sémantique du français. Une mauvaise affectation plausible et sans preuve concurrente peut rester indétectable. Cette limite doit être mesurée, jamais présentée comme une garantie d'absence absolue d'hallucination.

Le seuil de deux tokens est une heuristique conservatrice de contexte, pas une preuve sémantique. Les noms composés en minuscules, textes entièrement en capitales et citations tronquées jusqu'à un nom nu constituent des limites. Les anciennes introductions configurées et la reconnaissance temporelle restent des signaux compatibles ; aucune liste n'est étendue.

## Baseline et évaluation

Suite distincte dans `evals/validation-v1`, construite et exécutée avant refactor. Rapports séparés : sorties A de référence (mesure de validation/décision), et sorties Groq enregistrées puis rejouées avant/après (mesure d'extraction réelle et effet contrôlé du refactor). Aucun exemple d'évaluation n'est ajouté aux cues ou aux few-shots. Les scores et échecs sont conservés. Les formulations ne sont jamais un oracle de production.

## Non-objectifs

Pas de nouveau dictionnaire, RAG, C documentaire, CRM, UI, persistance, changement de complétude, merge ou repair retry. Le retry technique Groq reste borné à deux requêtes et réservé aux erreurs techniques autorisées. Aucun commit ni push.

## Contrat A après fermeture des dettes

A reçoit aussi les questions réellement affichées sous `askedQuestionsAtStart` (field, question canonique), sans ordre d’affectation imposé. Les statuts d’extraction restent séparés des intents provide/correct/remove/unknown. Les intents sensibles passent toujours P3 ; le merge décide. Le format historique sans intent conserve provide/unknown pour le replay et la compatibilité, sans inférer correct.

La notation k/K compacte ou séparée par des espaces vaut ×1000, avec décimales non ambiguës et conservation des séparateurs déjà reconnus. Les unités telles que km/kWh ne sont pas des montants en k. Les nombres en lettres, autres multiplicateurs et séparateurs ambigus restent hors scope. Une négation grammaticale de dépasser prouve une borne max ; la citation doit conserver l’opérateur complet. Cela ne prouve pas à lui seul le champ budget.
