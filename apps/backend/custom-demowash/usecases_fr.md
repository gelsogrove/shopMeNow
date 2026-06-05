### La machine a un problème

- [Ma machine ne démarre pas](#ma-machine-ne-démarre-pas)
- [La machine affiche ERR-01](#la-machine-affiche-err-01)
- [La machine affiche ALERT ou BLOCK](#la-machine-affiche-alert-ou-block)
- [J'ai payé mais la machine ne démarre pas](#jai-payé-mais-la-machine-ne-démarre-pas)
- [La porte ne s'ouvre pas, le lavage est terminé](#la-porte-ne-souvre-pas-le-lavage-est-terminé)
- [Le sèche-linge ne chauffe pas](#le-sèche-linge-ne-chauffe-pas)

### Paiements et remboursements

- [Vous m'avez débité deux fois sur la carte](#vous-mavez-débité-deux-fois-sur-la-carte)
- [J'ai payé mais la machine n'a pas démarré, je veux un remboursement](#jai-payé-mais-la-machine-na-pas-démarré-je-veux-un-remboursement)
- [J'ai mis des pièces dans le sèche-linge mais les minutes n'augmentent pas](#jai-mis-des-pièces-dans-le-sèche-linge-mais-les-minutes-naugmentent-pas)
- [Le linge est sorti sale et sent mauvais, je veux un remboursement](#le-linge-est-sorti-sale-et-sent-mauvais-je-veux-un-remboursement)
- [Je veux une facture](#je-veux-une-facture)

### Conseils de lavage

- [J'ai une chemise blanche tachée, à quelle température la laver ?](#jai-une-chemise-blanche-tachée-à-quelle-température-la-laver)
- [À quelle température laver les couleurs ?](#à-quelle-température-laver-les-couleurs)
- [J'ai une tache de graisse, comment l'enlever ?](#jai-une-tache-de-graisse-comment-lenlever)
- [Dois-je apporter la lessive ?](#dois-je-apporter-la-lessive)
- [Puis-je laver couettes et couvertures ?](#puis-je-laver-couettes-et-couvertures)
- [Combien de temps dure un lavage ?](#combien-de-temps-dure-un-lavage)

### Données par implantation

- [Quels sont les horaires ?](#quels-sont-les-horaires)
- [Combien coûte un lavage ?](#combien-coûte-un-lavage)
- [Peut-on payer par carte ?](#peut-on-payer-par-carte)
- [Quels programmes a la machine ?](#quels-programmes-a-la-machine)
- [Comment fonctionne la carte de fidélité ?](#comment-fonctionne-la-carte-de-fidélité)
- [Combien j'économise avec la carte ?](#combien-jéconomise-avec-la-carte)
- [Où est la laverie la plus proche ?](#où-est-la-laverie-la-plus-proche)

---

## Ma machine ne démarre pas

> Écran `OPEN` (la porte ne ferme pas AVANT le lavage). Si le message persiste après avoir replacé le linge, c'est généralement une **surcharge** : suggérer de retirer quelques pièces et de répartir la charge avant d'escalader. (Cela NE s'applique PAS à `OPEN ERROR`, où le cycle est déjà terminé.)

**Client :** Ma machine ne démarre pas.

**Bot :** Bonjour ! 👋 Je suis l'assistant virtuel de **Demowash**. Dans quelle laverie es-tu ?

**Client :** Eixample.

**Bot :** Lave-linge ou sèche-linge ?

**Client :** Lave-linge.

**Bot :** Quel est le numéro de la machine ?

**Client :** La 3.

**Bot :** Qu'est-ce que tu vois à l'écran ?

**Client :** OPEN.

**Bot :** Ouvre la porte avec précaution, vérifie qu'aucun vêtement ne soit coincé dans le joint et referme-la fermement jusqu'au clic. Le message a disparu ?

**Client :** Non, ça affiche toujours OPEN.

**Bot :** Parfois la porte ne ferme pas parce qu'il y a trop de linge. Retire quelques pièces et répartis bien la charge dans le tambour, puis ferme la porte. Est-ce qu'elle s'est fermée ?

**Client :** Oui, maintenant oui.

**Bot :** Parfait. Sélectionne à nouveau le programme. Bon lavage ! 👋

---

## La machine affiche ERR-01

**Client :** Je suis à Mataró, machine 6 avec ERR-01.

**Bot :** Tu as appuyé sur le programme avant de payer. On recommence :

1. Charge le linge et ferme bien la porte.
2. Va à la borne de paiement, paie et sélectionne le numéro de ta machine.
3. Reviens à la machine et appuie sur le programme.

Dis-moi si elle démarre.

**Client :** Maintenant elle démarre.

**Bot :** Parfait ! Bon lavage 👋

---

## La machine affiche ALERT ou BLOCK

**Client :** Sant Cugat, machine 4, affiche ALERT.

**Bot :** La machine a détecté une anomalie et a besoin d'une vérification. Déplace ton linge dans une autre machine libre et dis-moi laquelle tu as choisie. On l'active à distance pour que tu puisses laver sans frais supplémentaires.

**Client :** Je suis maintenant sur la machine 2.

**Bot :** Merci. Comment t'appelles-tu ? Je transfère le cas à un opérateur pour activer la machine 2 et enregistrer l'anomalie sur la 4.

**Client :** Andrea.

**Bot :** J'ai enregistré ton cas, Andrea. Un opérateur te contactera dans quelques minutes. Le chatbot reste en attente du support humain.

---

## J'ai payé mais la machine ne démarre pas

**Client :** J'ai payé mais la machine ne démarre pas.

**Bot :** Dans quelle laverie es-tu ?

**Client :** Rubí.

**Bot :** Lave-linge ou sèche-linge ?

**Client :** Lave-linge.

**Bot :** Quel est le numéro de la machine ?

**Client :** La 3.

**Bot :** Qu'est-ce que tu vois à l'écran ?

**Client :** Rien, c'est éteint.

**Bot :** Compris. Comment t'appelles-tu ? Je transfère le cas à un opérateur pour activer la machine à distance.

**Client :** Marta.

**Bot :** J'ai enregistré ton cas, Marta. Un opérateur te contactera dans quelques minutes. Le chatbot reste en attente du support humain.

---

## La porte ne s'ouvre pas, le lavage est terminé

> Écran typique : `OPEN ERROR`. Différent de `OPEN:` (porte qui ne ferme pas AVANT le lavage). S'applique de façon identique au lave-linge et au sèche-linge : le linge est déjà traité et coincé à l'intérieur — ne jamais proposer de changer de machine ni de relaver/resécher. C'est URGENT.
>
> 🚨 Désambiguïsation : si le client dit seulement « elle ne s'ouvre pas » sans préciser, DEMANDE d'abord si le cycle est déjà terminé avec le linge à l'intérieur : oui → `OPEN ERROR` ; pas encore / ne ferme pas pour démarrer → `OPEN:`.

**Client :** La porte ne s'ouvre pas.

**Bot :** Pour mieux t'aider : le lavage est-il déjà terminé avec ton linge à l'intérieur, ou tu n'as pas encore pu démarrer ?

**Client :** C'est déjà terminé, le linge est à l'intérieur.

**Bot :** Pas de souci. Quand le cycle se termine, la porte met quelques minutes à se déverrouiller. Depuis combien de temps le lavage est-il fini ?

**Client :** Plus de 5 minutes.

**Bot :** Tire la poignée fermement, parfois il faut un peu plus de force. Est-ce qu'elle s'est ouverte ?

**Client :** Non, toujours bloquée.

**Bot :** Dans quelle laverie es-tu ?

**Client :** Gràcia.

**Bot :** Quel est le numéro de la machine ?

**Client :** La 2.

> 🔧 _Lecture interne de la machine (non montrée au client, transmise à l'opérateur) :_ `📟 Gràcia > lavadora > Núm 2 = OPEN ERROR`

**Bot :** Comment t'appelles-tu ? Je transfère le cas en priorité à un opérateur pour déverrouiller la porte à distance.

**Client :** Luis.

**Bot :** J'ai enregistré ton cas, Luis. Un opérateur te contactera dans quelques minutes. Le chatbot reste en attente du support humain.

---

## Le sèche-linge ne chauffe pas

**Client :** Le sèche-linge ne chauffe pas, les minutes défilent mais le linge reste mouillé.

**Bot :** Désolé. Dans quelle laverie es-tu ?

**Client :** Terrassa.

**Bot :** Quel est le numéro du sèche-linge ?

**Client :** Le 5.

**Bot :** Comment t'appelles-tu ? Je transfère le cas à un opérateur pour rembourser le cycle et vérifier la machine.

**Client :** Anna.

**Bot :** J'ai enregistré ton cas, Anna. Un opérateur te contactera dans quelques minutes. Le chatbot reste en attente du support humain.

---

## Vous m'avez débité deux fois sur la carte

**Client :** Vous m'avez débité deux fois sur la carte.

**Bot :** Désolé. Dans quelle laverie es-tu ?

**Client :** Eixample.

**Bot :** Quel est le numéro de la machine ?

**Client :** La 1.

**Bot :** Peux-tu me donner les 4 derniers chiffres de la carte et ton nom ? Je transfère le cas à un opérateur pour vérifier le double débit.

**Client :** Carte 8821, je suis Jordi.

**Bot :** J'ai enregistré ton cas, Jordi. Un opérateur te contactera dans quelques minutes. Le chatbot reste en attente du support humain.

---

## J'ai payé mais la machine n'a pas démarré, je veux un remboursement

**Client :** J'ai payé mais la machine n'a pas démarré et je veux un remboursement.

**Bot :** Désolé. Dans quelle laverie es-tu ?

**Client :** Mataró.

**Bot :** Lave-linge ou sèche-linge ?

**Client :** Lave-linge, la 6.

**Bot :** Comment as-tu payé : espèces, carte de fidélité ou carte bancaire ?

**Client :** Carte bancaire, finit en 4412.

**Bot :** Comment t'appelles-tu ?

**Client :** Carla.

**Bot :** J'ai enregistré ton cas, Carla. Un opérateur te contactera dans quelques minutes pour traiter le remboursement.

---

## J'ai mis des pièces dans le sèche-linge mais les minutes n'augmentent pas

**Client :** J'ai mis des pièces dans le sèche-linge mais les minutes n'augmentent pas.

**Bot :** Désolé. Dans quelle laverie es-tu ?

**Client :** Rubí.

**Bot :** Quel est le numéro du sèche-linge ?

**Client :** Le 3.

**Bot :** Comment t'appelles-tu ? Je transfère le cas à un opérateur pour rembourser l'argent et vérifier la machine.

**Client :** Mireia.

**Bot :** J'ai enregistré ton cas, Mireia. Un opérateur te contactera dans quelques minutes. Le chatbot reste en attente du support humain.

---

## Le linge est sorti sale et sent mauvais, je veux un remboursement

**Client :** Le linge est sorti sale et sent mauvais après le lavage, je veux un remboursement.

**Bot :** Désolé. Dans quelle laverie es-tu ?

**Client :** Eixample.

**Bot :** Lave-linge ou sèche-linge ?

**Client :** Lave-linge, la 3.

**Bot :** Comment t'appelles-tu ?

**Client :** Marta.

**Bot :** J'ai enregistré ton cas, Marta. Un opérateur te contactera dans quelques minutes pour évaluer le cas et le remboursement.

---

## Je veux une facture

**Client :** Je veux une facture pour le lavage.

**Bot :** Parfait ! Je te prépare la facture. Quel est le nom de l'entreprise ou la raison sociale ?

**Client :** Marta Ribas SARL.

**Bot :** Merci. Quel est le montant que tu as payé ? (en euros)

**Client :** 8 €.

**Bot :** Parfait. Quand as-tu utilisé le service ? (ex. aujourd'hui, hier, 29/05/2026)

**Client :** Aujourd'hui.

**Bot :** Compris. À quelle adresse email je t'envoie la facture ?

**Client :** marta@example.com

**Bot :** Merci. Tu veux ajouter une note ? (ex. SIRET, code client, référence) Sinon, écris « non ».

**Client :** SIRET B12345678.

**Bot :** Parfait. J'ai enregistré la facture avec les données : Marta Ribas SARL, 8 €, aujourd'hui, SIRET B12345678. Tu la recevras à marta@example.com dans quelques minutes.

---

## J'ai une chemise blanche tachée, à quelle température la laver ?

**Client :** J'ai une chemise blanche tachée, à quelle température la laver sans l'abîmer ?

**Bot :** Pour une chemise blanche tachée :

- **Coton solide** : 40°C (jusqu'à 60°C pour les taches tenaces)
- **Tissus délicats** (soie, laine, mélanges fins) : 30°C

Au-dessus de 40°C sur du délicat, tu risques de fixer la tache. Sélectionne le programme correspondant à l'écran de la machine — la lessive est dosée automatiquement.

---

## À quelle température laver les couleurs ?

**Client :** À quelle température laver les couleurs ?

**Bot :** Règle générale pour les couleurs :

- **Couleurs foncées / noires** : 30°C (évite la perte de couleur)
- **Couleurs claires** : 30-40°C
- **Couleurs résistantes avec taches** : jusqu'à 40°C

Ne lave jamais les couleurs au-dessus de 40°C la première fois : la couleur dégorge plus quand le tissu est neuf.

---

## J'ai une tache de graisse, comment l'enlever ?

**Client :** J'ai une tache de graisse sur une chemise, comment l'enlever ?

**Bot :** D'abord, absorbe l'excès avec du papier essuie-tout sans frotter (frotter étale la tache). Puis sélectionne :

- **Coton** : 60°C
- **Synthétiques ou délicats** : 40°C

La lessive Demowash contient un agent dégraissant dosé automatiquement.

---

## Dois-je apporter la lessive ?

**Client :** Dois-je apporter la lessive ?

**Bot :** Non, tu n'as rien à apporter ! Les machines Demowash **dosent automatiquement** une lessive et un adoucissant écologiques certifiés, fabriqués avec des ingrédients 100% naturels. Apporte juste ton linge. 😊

---

## Puis-je laver couettes et couvertures ?

**Client :** Puis-je laver couettes et couvertures ?

**Bot :** Oui, tu peux ! Voici les conseils :

Couettes et couvertures en coton ou polyester solide :

- Température : 40°C
- Capacité : utilise un lave-linge 20 kg pour les grandes couettes
- Après le lavage : sèche-linge à haute ou moyenne température pour bien éliminer l'humidité

Couettes délicates ou avec garnissage synthétique :

- Température : 30°C

Conseils :

- Ne surcharge pas la machine — la couette a besoin d'espace pour bouger
- Après le lavage la couette ressort très mouillée : passe-la au sèche-linge pour finir

Si tu veux savoir quelles grandes machines sont disponibles et les tarifs exacts, dis-moi dans quelle laverie tu es. 😊

---

## Combien de temps dure un lavage ?

**Client :** Combien de temps dure un lavage ?

**Bot :** La durée dépend du programme que tu choisis :

- 60°C (très chaud) : 50-55 minutes
- 40°C (chaud) : 45-50 minutes
- 30°C (tiède) : 40-45 minutes
- Froid (*) : 35-40 minutes

Ce sont des durées approximatives. Pendant le cycle l'écran affiche le compte à rebours du temps restant (ex. `T-28` signifie 28 minutes). 😊

---

## Quels sont les horaires ?

**Client :** Quels sont les horaires ?

**Bot :** Dans quelle laverie es-tu ?

**Client :** Gràcia.

**Bot :** À **Gràcia** nous sommes ouverts de **7h00 à 23h00**, tous les jours.

---

## Combien coûte un lavage ?

**Client :** Combien coûte un lavage ?

**Bot :** Dans quelle laverie es-tu ?

**Client :** Eixample.

**Bot :** À **Eixample** voici les tarifs lave-linge :

- Machine 1 (20 kg) : 7 € avec carte fidélité / 8 € en espèces
- Machine 2 (20 kg) : 7 € avec carte fidélité / 8 € en espèces
- Machine 3 (10 kg) : 4 € avec carte fidélité / 4,50 € en espèces
- Machine 4 (10 kg) : 4 € avec carte fidélité / 4,50 € en espèces

Tu veux aussi les tarifs sèche-linge ?

---

## Peut-on payer par carte ?

**Client :** Peut-on payer par carte ?

**Bot :** Dans quelle laverie es-tu ?

**Client :** Gràcia.

**Bot :** À **Gràcia** seule la **carte de crédit/débit** est acceptée. Pas d'espèces ni de carte de fidélité dans cette implantation.

---

## Quels programmes a la machine ?

**Client :** Quels programmes a la machine ?

**Bot :** Dans quelle laverie es-tu ?

**Client :** Eixample.

**Bot :** À **Eixample** le lave-linge a 4 programmes :

- Bouton 1 — Très chaud — 60°C
- Bouton 2 — Chaud — 40°C
- Bouton 3 — Tiède — 30°C
- Bouton 4 — Froid — (*)

Le sèche-linge en a 3 : haute, moyenne et basse température.

---

## Comment fonctionne la carte de fidélité ?

**Client :** Comment fonctionne la carte de fidélité ?

**Bot :** Avec la carte de fidélité tu paies **moins** qu'en espèces ou en carte bancaire — la réduction s'applique automatiquement à chaque lavage et séchage.

Dans quelle laverie es-tu ? Je te confirme si on l'accepte et je te donne les tarifs.

**Client :** Eixample.

**Bot :** À **Eixample** oui, on accepte la carte de fidélité. Voici les tarifs :

- Lave-linge 1-2 (20 kg) : 7 €
- Lave-linge 3-4 (10 kg) : 4 €
- Sèche-linge 5-6 (20 kg) : 2,50 €

---

## Combien j'économise avec la carte ?

**Client :** Combien j'économise avec la carte ?

**Bot :** Pour te dire l'économie exacte, dans quelle laverie es-tu ?

**Client :** Rubí.

**Bot :** À **Rubí** les économies avec la carte de fidélité sont :

Lave-linge :

- Machine 1 (10 kg) : 0,50 € d'économie (4,50 € avec carte vs 5 € en espèces)
- Machine 2 (15 kg) : 1 € d'économie (6 € avec carte vs 7 € en espèces)
- Machine 3 (20 kg) : 1 € d'économie (7 € avec carte vs 8 € en espèces)

Sèche-linge (machines 4 et 5, 20 kg) : même prix avec carte ou en espèces (2 € / 15 min).

💡 Si tu utilises régulièrement le grand lave-linge (machine 3), la carte est vite rentabilisée. 😊

---

## Où est la laverie la plus proche ?

**Client :** Où est la laverie la plus proche ?

**Bot :** Dans quelle zone es-tu ? Je te donne les infos de l'implantation la plus pratique.

**Client :** Je suis à Barcelone.

**Bot :** À Barcelone nous avons deux implantations Demowash :

1. **Eixample** — C/ Aragó 286, près de Passeig de Gràcia. Horaires : 8h00 — 22h00
2. **Gràcia** — C/ Verdi 47, près de Plaça del Sol. Horaires : 7h00 — 23h00

Dans laquelle es-tu, ou laquelle t'intéresse ? 😊

---

---

## Je veux ouvrir une franchise Demowash

**Client:** Bonjour, je veux créer une entreprise. Proposez-vous du franchising chez Demowash?

**Bot:** Bonjour! 👋 Je suis l'assistant virtuel de **Demowash**. Oui, nous proposons une consultation gratuite en franchising. Je peux te fixer un rendez-vous avec notre équipe commerciale pour t'expliquer le modèle complet.

Ça t'intéresse?

**Client:** Oui, j'aimerais en savoir plus.

**Bot:** Parfait! Comment t'appelles-tu?

**Client:** Marco Rossi

**Bot:** [Tool: `capture_pii({name: "Marco Rossi"})` + `remember({name: "Marco Rossi"})`]

Enchanté, Marco. Quel est ton email? Je t'enverrai la confirmation avec les détails de la consultation.

**Client:** marco.rossi@email.com

**Bot:** [Tool: `capture_pii({email: "marco.rossi@email.com"})`]

Merci! Et ton téléphone? (optionnel)

**Client:** 034 567 8901

**Bot:** [Tool: `capture_pii({phone: "034 567 8901"})`]

Parfait, Marco. Un dernier détail : dans quelle ville veux-tu ouvrir la laverie?

**Client:** À Mataró

**Bot:** [Tool: `remember({location: "Mataró"})`]

Excellent! Voici les horaires disponibles pour parler avec notre équipe commerciale:

📅 **Lundi 10 juin**
- 1. 10:00
- 2. 15:00

📅 **Mardi 11 juin**
- 3. 11:00

Lequel te convient?

**Client:** 2

**Bot:** [Tool: `schedule_consultation({slotIndex: 2})`]

✅ Parfait, Marco! J'ai confirmé ton rendez-vous pour **lundi 10 juin à 15:00** avec notre équipe commerciale.

Tu recevras un email avec:
- 🔗 Lien Zoom pour l'appel vidéo
- 📅 Ajouter au calendrier (Google Calendar / Outlook)
- 📌 Détails de la consultation

Notre spécialiste t'expliquera le modèle de franchising, les coûts initiaux, le support continu et les prochaines étapes.

À bientôt! 👋
