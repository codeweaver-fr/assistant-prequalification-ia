# Reprise du projet de préqualification

Tu reprends ce dépôt pour aider à terminer une démonstration fiable et un moteur réutilisable. Commence par lire le code, les tests et les instructions applicables. Préserve les modifications existantes.

## Objectif produit

Le développeur vend des sites sur mesure et souhaite proposer aux petites entreprises une qualification des demandes : comprendre le besoin, recueillir les informations manquantes et produire une fiche exploitable. Le moteur doit rester indépendant du métier. Une configuration définit un socle commun (demande, contexte, résultat attendu, délai, budget, contact), complété par des champs métier et des réglages client. Ce socle est une direction produit à confronter à l'existant, pas une obligation d'ajouter tous ces champs immédiatement. Champ commun ne signifie pas obligatoire ; budget inconnu et localisation non pertinente doivent être configurables.

Groq reste le provider de la démonstration. Ne remplace pas Groq par Claude et n'ajoute pas l'API Anthropic. N'ajoute pas de RAG, CRM, persistance ou nouvelle infrastructure pour corriger le parcours conversationnel.

## Défaut concret à traiter

Prospect : « je veux refaire mon salon ».
Assistant : localisation et délai.
Prospect : « marseille , avant l'été ».
Résultat actuel : délai enregistré, localisation absente, ville redemandée.

La règle P10 peut ignorer « marseille » avec plusieurs questions affichées, même si A extrait correctement la localisation. Voir docs/local-diagnostics-v1.md et le test de reproduction dans src/adapters/prequalification/processMessage.test.ts. Les tests qui reproduisent le défaut ne sont pas des critères produit à conserver. La sortie réelle du provider de cet échange n'a pas été observée : ne la présente pas comme prouvée.

## Travail demandé

1. Diagnostique extraction, validation, merge et sélection des questions. Explique les règles incompatibles avec les conversations attendues, avec références au code.
2. Choisis et implémente une correction minimale et cohérente. Une question par tour est une option pour la V1, pas une consigne imposée. Évite les listes de villes, affectations arbitraires par ordre et exceptions codées pour cet exemple. Préserve le refus des réponses réellement ambiguës, comme « 100 » entre budget et surface.
3. Ajoute des tests pertinents pour le défaut, les corrections de réponse et les ambiguïtés. Vérifie le socle commun avec au moins deux configurations métier, sans développer de fonctionnalités commerciales supplémentaires.
4. Lance les tests et le lint. Sépare clairement garanties des tests mockés et comportement réel de Groq. Ne lis ni n'affiche les secrets ou fichiers .env ; pour un essai réel, utilise la configuration serveur existante sans exposer ses valeurs.
5. Documente le comportement final, les limites et une procédure courte pour tester une demande complète, vague et corrigée. Fournis une synthèse des changements et des vérifications.

Procède par changements ciblés, sans réécriture générale. Ne committe et ne pousse pas automatiquement tes nouvelles modifications : laisse un diff vérifiable. Si une décision produit indispensable manque, expose-la précisément au lieu de l'inventer.

## État à la transmission

Branche : audit/coderabbit-review. Les 51 fichiers de tests et 753 tests passaient avant transmission. Le dépôt contient des diagnostics locaux opt-in et des bornes numériques configurables. Le défaut Marseille est documenté, pas encore corrigé.
