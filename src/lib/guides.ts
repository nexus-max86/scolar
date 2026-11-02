/**
 * Guides d'utilisation publics (/aide). Les captures viennent de l'école de démonstration
 * et se trouvent dans /public/guides : préfixe « m- » = capture de téléphone.
 * Dans les textes, **gras** met en valeur le nom d'un bouton ou d'un menu.
 */

export type GuideSection = {
  id: string;
  title: string;
  intro?: string;
  steps?: string[];
  points?: string[];
  image?: { file: string; alt: string };
  tip?: string;
};

export type Guide = {
  slug: "directeur" | "caissier" | "parent";
  title: string;
  audience: string;
  summary: string;
  sections: GuideSection[];
};

export const GUIDES: Guide[] = [
  {
    slug: "directeur",
    title: "Guide du directeur",
    audience: "Directeur, préfet, gestionnaire",
    summary: "Mettre l'école en place, suivre l'argent chaque jour, gérer les élèves, les frais et l'équipe.",
    sections: [
      {
        id: "creer-ecole",
        title: "Créer l'espace de l'école",
        intro: "Une seule fois, au tout début. Comptez cinq minutes.",
        steps: [
          "Sur la page d'accueil de Scolar, touchez **Créer mon école**.",
          "Remplissez le nom de l'école, la ville, le téléphone et l'année scolaire en cours (par exemple 2026-2027).",
          "Créez votre compte directeur : votre nom, votre e-mail et un mot de passe d'au moins 8 caractères.",
          "Touchez **Créer mon école**. Vous arrivez sur le tableau de bord.",
        ],
        image: { file: "inscription", alt: "Formulaire de création de l'espace école" },
        tip: "Le logo est facultatif. Vous pourrez l'ajouter plus tard dans Paramètres, il apparaîtra sur les reçus.",
      },
      {
        id: "connexion",
        title: "Se connecter",
        steps: [
          "Ouvrez Scolar dans le navigateur du téléphone ou de l'ordinateur, puis touchez **Espace école**.",
          "Saisissez votre e-mail et votre mot de passe, puis **Se connecter**.",
        ],
        image: { file: "connexion", alt: "Page de connexion" },
        tip: "Sur Android, ouvrez le menu du navigateur puis « Ajouter à l'écran d'accueil » : Scolar s'ouvre ensuite comme une application.",
      },
      {
        id: "tableau-de-bord",
        title: "Le tableau de bord",
        intro: "C'est la première page après la connexion. Elle résume la situation de l'école.",
        points: [
          "**Encaissé aujourd'hui** et **Encaissé cette année**, en dollars et en francs, toujours séparés.",
          "**Reste à percevoir** : tout ce que les parents doivent encore.",
          "Un bandeau orange signale les élèves dont la date limite est dépassée. Touchez-le pour les relancer.",
          "Tant que l'école n'est pas complètement installée, la carte **Mettre l'école en route** indique l'étape suivante.",
        ],
        image: { file: "tableau-de-bord", alt: "Tableau de bord du directeur" },
      },
      {
        id: "classes",
        title: "Créer les classes",
        steps: [
          "Menu **Classes**.",
          "Saisissez le nom de la classe (par exemple « 6e primaire » ou « 1re humanités ») et, si besoin, la section ou l'option.",
          "Touchez **Ajouter**. Répétez pour chaque classe.",
        ],
        image: { file: "classes", alt: "Liste des classes" },
        tip: "Si vous importez vos élèves depuis Excel, les classes qui n'existent pas encore sont créées automatiquement.",
      },
      {
        id: "frais",
        title: "Définir les frais scolaires",
        intro: "Chaque frais a un montant, une devise (dollars ou francs), une classe concernée et une date limite.",
        steps: [
          "Menu **Frais scolaires**, puis remplissez le formulaire : type, libellé, montant, devise.",
          "Choisissez la classe concernée, ou toutes les classes.",
          "Indiquez la date limite de paiement : c'est elle qui fait apparaître les retards.",
          "Pour un minerval mensuel, cochez **créer une échéance par mois** : Scolar crée les mensualités de septembre à juin.",
          "Pour un frais que tous les élèves ne paient pas (transport, cantine), cochez **Frais optionnel**.",
        ],
        image: { file: "frais", alt: "Page des frais scolaires" },
        tip: "Un frais déjà payé par des élèves ne peut plus changer de montant, pour protéger les reçus déjà remis. Vous pouvez l'archiver et en créer un nouveau.",
      },
      {
        id: "eleves",
        title: "Inscrire les élèves",
        intro: "Deux façons de faire : un par un, ou tous d'un coup depuis Excel.",
        steps: [
          "**Un par un** : menu **Élèves**, puis **Inscrire un élève**. Le matricule est donné automatiquement si vous le laissez vide.",
          "Saisissez toujours le **téléphone du parent** : il sert pour les reçus WhatsApp, les rappels et l'espace parent.",
          "**Depuis Excel** : menu **Élèves**, puis **Importer Excel**. Téléchargez le modèle, remplissez une ligne par élève, puis envoyez le fichier.",
          "Si une ligne contient une erreur, Scolar n'importe rien et indique le numéro de la ligne à corriger.",
        ],
        image: { file: "import-eleves", alt: "Import des élèves depuis Excel" },
      },
      {
        id: "fiche-eleve",
        title: "La fiche de l'élève",
        intro: "Touchez le nom d'un élève, ou cherchez-le par son nom ou son matricule en haut de l'écran.",
        points: [
          "Sous le nom : le matricule de l'école et le **code élève** Scolar (par exemple SC-2026-000125). Ce code est unique : il évite toute confusion entre deux élèves du même nom.",
          "En haut : **total à payer**, **déjà payé** et **solde restant**, par devise.",
          "Le tableau des frais montre pour chaque frais ce qui a été payé, ce qui reste et la date limite.",
          "En bas : l'historique de tous les reçus de l'élève.",
          "**Modifier** corrige les informations. **Marquer transféré** ou **Archiver** retire l'élève des listes sans effacer ses paiements.",
        ],
        image: { file: "fiche-eleve", alt: "Fiche d'un élève avec son solde et ses frais" },
      },
      {
        id: "reductions",
        title: "Réductions, exemptions et frais optionnels",
        steps: [
          "Sur la fiche de l'élève, ouvrez **Accorder une réduction ou une exemption**.",
          "Choisissez le frais, puis une réduction en pourcentage, un montant à payer, ou **Exempté**.",
          "Indiquez le motif (fratrie, enfant d'enseignant, bourse…) puis enregistrez. Le solde se met à jour aussitôt.",
          "Pour un frais optionnel (transport, cantine), touchez **Inscrire l'élève** sous **Frais optionnels disponibles**.",
        ],
        image: { file: "reduction", alt: "Formulaire de réduction sur la fiche élève" },
      },
      {
        id: "espace-parent",
        title: "Donner l'espace parent aux familles",
        intro: "Chaque élève a un lien personnel. Le parent l'ouvre sur son téléphone, sans compte ni mot de passe.",
        steps: [
          "Sur la fiche de l'élève, carte **Espace parent** : touchez **Envoyer le lien par WhatsApp**.",
          "Le lien est aussi ajouté automatiquement au message de chaque reçu et aux rappels d'impayés.",
          "Si le lien a circulé hors de la famille, touchez **Changer le lien** : l'ancien ne fonctionne plus.",
        ],
        image: { file: "lien-parent", alt: "Carte Espace parent sur la fiche élève" },
      },
      {
        id: "annonces",
        title: "Publier une annonce aux parents",
        intro: "Réunions, examens, congés, changements d'horaire, événements : les parents la lisent sur leur espace parent.",
        steps: [
          "Menu **Annonces**.",
          "Écrivez le titre et le message. Ajoutez la date concernée si c'est une réunion, un examen ou un congé.",
          "Choisissez **Toute l'école** ou **Certaines classes**. Pour une seule famille, partez de la fiche de l'élève : **Envoyer une annonce à cette famille**.",
          "Touchez **Publier l'annonce**. Elle apparaît aussitôt, marquée « Nouveau », sur l'espace parent des familles concernées.",
        ],
        image: { file: "annonces", alt: "Page des annonces : rédaction et liste" },
      },
      {
        id: "annonces-whatsapp",
        title: "Prévenir les familles par WhatsApp",
        intro: "Après la publication, la page de l'annonce sert à prévenir les parents.",
        points: [
          "**Envoyer à chaque famille** : un bouton **Envoyer** par famille ouvre WhatsApp avec le message et le lien personnel du parent. Les frères et sœurs sont regroupés.",
          "**Partager dans WhatsApp** ou **Copier le message** : pour le groupe des parents d'une classe ou une liste de diffusion.",
          "Scolar indique combien de familles ont ouvert l'annonce, et le badge **Lue** apparaît à côté de chaque famille qui l'a lue.",
          "**Retirer l'annonce** la fait disparaître de l'espace des parents.",
        ],
        image: { file: "annonce-detail", alt: "Annonce publiée avec l'envoi WhatsApp par famille" },
      },
      {
        id: "reprise",
        title: "Reprendre les paiements déjà reçus",
        intro: "Si l'année a commencé avant Scolar, enregistrez ce que les parents ont déjà payé pour que les soldes soient justes.",
        steps: [
          "Menu **Paiements**, puis **Reprendre des paiements**.",
          "Téléchargez le modèle Excel : il contient déjà la liste de vos élèves et vos frais.",
          "Pour chaque paiement reçu, remplissez le frais, le montant, la date, le moyen et le numéro du reçu papier.",
          "Envoyez le fichier. Si une ligne est fausse, rien n'est importé et Scolar indique la ligne à corriger.",
        ],
        image: { file: "reprise-paiements", alt: "Page de reprise des paiements" },
      },
      {
        id: "utilisateurs",
        title: "Créer le compte du caissier",
        steps: [
          "Menu **Utilisateurs**.",
          "Saisissez le nom, l'e-mail et un mot de passe, choisissez le rôle **Secrétaire / caissier**, puis **Créer le compte**.",
          "Donnez ces informations au caissier. Il pourra encaisser, imprimer les reçus et voir les impayés.",
          "Si quelqu'un quitte l'école, touchez **Désactiver le compte** : il ne pourra plus se connecter.",
        ],
        image: { file: "utilisateurs", alt: "Gestion des utilisateurs" },
        tip: "Un caissier a oublié son mot de passe ? Sur la même page, donnez-lui un nouveau mot de passe.",
      },
      {
        id: "parametres",
        title: "Personnaliser les reçus",
        steps: [
          "Menu **Paramètres**.",
          "Ajoutez le logo, l'adresse et le téléphone de l'école : ils figurent en haut de chaque reçu.",
          "Choisissez le **préfixe des reçus** (par exemple VIC) et la phrase en bas du reçu.",
          "Choisissez le **format des reçus** : feuille A4, ou ticket 80 mm ou 58 mm pour les petites imprimantes.",
        ],
        image: { file: "parametres", alt: "Paramètres de l'école" },
        tip: "Sur la même page, la carte « Mon mot de passe » permet de changer votre propre mot de passe.",
      },
      {
        id: "caisse",
        title: "Contrôler la caisse du jour",
        intro: "À la fin de chaque journée, comparez l'argent dans la caisse avec ce que Scolar affiche.",
        points: [
          "**Total encaissé** en dollars et en francs, puis le détail par moyen de paiement et par agent.",
          "**Espèces à remettre** : ce qui doit se trouver physiquement dans la caisse.",
          "Le détail liste chaque reçu de la journée. Changez la date pour revoir un autre jour.",
          "**Imprimer** ou **Exporter Excel** pour garder une trace.",
        ],
        image: { file: "caisse", alt: "Caisse du jour" },
      },
      {
        id: "impayes",
        title: "Suivre et relancer les impayés",
        steps: [
          "Menu **Impayés** : la liste des élèves qui doivent encore de l'argent, classe par classe.",
          "Cochez **Date limite dépassée seulement** puis **Afficher** pour ne garder que les retards.",
          "Touchez **Rappel WhatsApp** : WhatsApp s'ouvre avec un message poli déjà rédigé pour le parent.",
          "**Exporter Excel** donne la liste complète, par exemple pour une réunion.",
        ],
        image: { file: "impayes", alt: "Liste des impayés" },
      },
      {
        id: "paiements",
        title: "Historique des paiements",
        points: [
          "Menu **Paiements** : tous les reçus sur une période, filtrables par moyen de paiement.",
          "Touchez un reçu pour l'ouvrir, l'imprimer ou le renvoyer au parent.",
          "**Exporter Excel** pour la comptabilité.",
        ],
        image: { file: "paiements", alt: "Historique des paiements" },
      },
      {
        id: "annuler",
        title: "Corriger une erreur de paiement",
        intro: "Un paiement ne s'efface jamais, pour que personne ne puisse faire disparaître de l'argent. Le directeur peut l'annuler.",
        steps: [
          "Ouvrez le reçu concerné (depuis Paiements ou la fiche de l'élève).",
          "En bas, ouvrez **Annuler ce paiement**, indiquez le motif puis confirmez.",
          "Le reçu reste visible avec la mention ANNULÉ et le solde de l'élève est corrigé. Encaissez ensuite le bon montant.",
        ],
        image: { file: "recu", alt: "Reçu de paiement" },
      },
      {
        id: "roles",
        title: "Qui peut faire quoi",
        points: [
          "**Directeur et caissier** : inscrire et chercher un élève, encaisser, imprimer un reçu, voir les impayés et la caisse.",
          "**Directeur seulement** : annonces, classes, frais, réductions, utilisateurs, paramètres, annulation d'un paiement, archivage d'un élève, reprise des paiements.",
          "Le caissier ne voit dans la caisse du jour que ses propres encaissements. Le directeur voit ceux de toute l'école.",
        ],
      },
      {
        id: "bon-a-savoir",
        title: "Bon à savoir",
        points: [
          "Les dollars et les francs sont toujours comptés séparément. Quand un parent paie un frais en dollars avec des francs, le caissier saisit le taux du jour et le reçu indique les deux montants.",
          "En cas de coupure Internet, un bandeau orange s'affiche : attendez le retour de la connexion avant d'enregistrer.",
          "À la fin de l'abonnement, les données restent consultables mais les nouvelles saisies sont bloquées jusqu'au renouvellement.",
          "Pour essayer sans risque, utilisez la démo : une école fictive remise à zéro chaque nuit.",
        ],
      },
    ],
  },
  {
    slug: "caissier",
    title: "Guide du caissier",
    audience: "Secrétaire, caissier, comptable",
    summary: "Encaisser un paiement, remettre le reçu au parent et faire la caisse en fin de journée.",
    sections: [
      {
        id: "connexion",
        title: "Se connecter",
        steps: [
          "Ouvrez Scolar sur le téléphone ou l'ordinateur de la caisse, puis **Espace école**.",
          "Saisissez l'e-mail et le mot de passe donnés par le directeur.",
          "Vous arrivez sur l'accueil. Le gros bouton **Encaisser**, en bas de l'écran, sert pour presque tout.",
        ],
        image: { file: "m-accueil-caissier", alt: "Accueil du caissier sur téléphone" },
      },
      {
        id: "trouver-eleve",
        title: "Trouver l'élève",
        steps: [
          "Touchez **Encaisser**.",
          "Tapez les premières lettres du nom, du post-nom, le matricule ou le **code élève** (SC-…) inscrit sur les reçus.",
          "Touchez l'élève dans la liste. Vérifiez la classe pour ne pas confondre deux élèves du même nom.",
        ],
        image: { file: "m-encaisser-recherche", alt: "Recherche d'un élève avant d'encaisser" },
      },
      {
        id: "encaisser",
        title: "Encaisser un paiement",
        steps: [
          "En haut, Scolar affiche le **solde restant** de l'élève.",
          "Choisissez le **frais payé** : le montant se remplit avec ce qui reste à payer sur ce frais.",
          "Si le parent paie seulement une partie, corrigez le montant.",
          "Choisissez le moyen de paiement : espèces, M-Pesa, Airtel Money, Orange Money, banque…",
          "Pour le Mobile Money, saisissez le numéro de transaction reçu par SMS.",
          "Touchez **Enregistrer et générer le reçu**.",
        ],
        image: { file: "m-encaisser", alt: "Formulaire d'encaissement sur téléphone" },
        tip: "Scolar refuse un montant plus grand que ce qui reste à payer. Vérifiez alors le frais choisi.",
      },
      {
        id: "francs",
        title: "Le parent paie en francs un frais en dollars",
        steps: [
          "Sous **Le parent paie en**, touchez **Francs**.",
          "Saisissez le **taux du jour**, par exemple 2850 francs pour 1 dollar. Scolar retient le dernier taux utilisé.",
          "Saisissez le montant reçu en francs. Scolar affiche le montant crédité en dollars sur le frais.",
          "Le reçu indique les deux : le montant crédité et les francs reçus avec le taux.",
        ],
        image: { file: "m-encaisser-francs", alt: "Paiement en francs avec le taux du jour" },
      },
      {
        id: "recu",
        title: "Remettre le reçu",
        intro: "Après l'enregistrement, le reçu numéroté s'affiche.",
        points: [
          "**Imprimer le ticket** ou **Télécharger le PDF**, selon l'imprimante de l'école.",
          "**Envoyer par WhatsApp** : le message au parent est déjà rédigé, avec le lien vers son espace parent.",
          "Un reçu n'est jamais modifié. En cas d'erreur, prévenez le directeur : lui seul peut annuler un paiement.",
        ],
        image: { file: "m-recu", alt: "Reçu affiché après un paiement" },
      },
      {
        id: "inscrire",
        title: "Inscrire un nouvel élève",
        steps: [
          "Menu **Élèves**, puis **Inscrire un élève**.",
          "Remplissez le nom, la classe et surtout le **téléphone du parent**.",
          "Enregistrez. Vous pouvez ensuite encaisser directement les frais d'inscription.",
        ],
        image: { file: "nouvel-eleve", alt: "Formulaire d'inscription d'un élève" },
      },
      {
        id: "caisse",
        title: "Faire la caisse en fin de journée",
        steps: [
          "Menu **Caisse du jour**.",
          "Comptez l'argent de la caisse et comparez avec **Espèces à remettre**, en dollars et en francs.",
          "Si tout correspond, remettez l'argent au directeur. Sinon, relisez la liste des reçus de la journée.",
        ],
        image: { file: "m-caisse", alt: "Caisse du jour sur téléphone" },
      },
      {
        id: "relancer",
        title: "Relancer un parent",
        steps: [
          "Menu **Impayés**.",
          "Touchez **Rappel WhatsApp** à côté de l'élève : WhatsApp s'ouvre avec un rappel poli déjà écrit.",
          "Envoyez-le depuis le téléphone de l'école.",
        ],
        image: { file: "impayes", alt: "Liste des impayés" },
      },
    ],
  },
  {
    slug: "parent",
    title: "Guide des parents",
    audience: "Parents et tuteurs",
    summary: "Voir sur votre téléphone ce que vous avez payé, ce qui reste et retrouver tous vos reçus.",
    sections: [
      {
        id: "lien",
        title: "Recevoir votre lien personnel",
        intro: "Vous n'avez rien à installer ni de compte à créer.",
        points: [
          "L'école vous envoie un lien par WhatsApp, avec chaque reçu ou séparément.",
          "Touchez ce lien : la page de votre enfant s'ouvre dans le navigateur du téléphone.",
          "Gardez le message, ou ajoutez la page à l'écran d'accueil pour la retrouver facilement.",
        ],
      },
      {
        id: "page",
        title: "Lire la page de votre enfant",
        points: [
          "En haut : le nom de l'enfant, sa classe, son matricule et son **code élève** (SC-…), à donner à l'école en cas de question.",
          "**Reste à payer** : le montant total encore dû, en dollars et en francs.",
          "**Prochain paiement** : le prochain frais à payer et sa date limite. Il devient rouge **En retard** quand la date est passée.",
          "Le détail des frais indique pour chacun ce qui est payé et ce qui reste.",
        ],
        image: { file: "m-parent", alt: "Page parent sur téléphone" },
      },
      {
        id: "annonces",
        title: "Lire les annonces de l'école",
        points: [
          "En haut de la page, **Annonces de l'école** affiche les réunions, examens, congés et informations importantes.",
          "Une annonce que vous n'avez pas encore lue porte le badge **Nouveau**.",
          "La date concernée (réunion, examen, congé) est indiquée en bleu.",
          "L'école sait que vous avez ouvert l'annonce : inutile de répondre pour confirmer.",
        ],
        image: { file: "m-parent-annonces", alt: "Annonces de l'école sur la page parent" },
      },
      {
        id: "recus",
        title: "Retrouver vos reçus",
        steps: [
          "Faites défiler la page jusqu'à la liste des reçus.",
          "Touchez **Reçu** à côté d'un paiement pour télécharger le reçu en PDF.",
          "Vous pouvez le montrer ou l'imprimer en cas de besoin : chaque reçu a un numéro unique.",
        ],
        image: { file: "m-parent-recus", alt: "Liste des reçus du parent" },
      },
      {
        id: "enfants",
        title: "Plusieurs enfants dans la même école",
        points: [
          "Si vos enfants sont inscrits avec le même numéro de téléphone, leurs noms apparaissent en bas de la page.",
          "Touchez un nom pour voir la situation de cet enfant.",
        ],
      },
      {
        id: "payer",
        title: "Payer les frais",
        points: [
          "Le paiement se fait toujours à l'école ou par Mobile Money, comme d'habitude. La page ne sert pas à payer.",
          "Après chaque paiement, la page se met à jour et le nouveau reçu apparaît.",
          "Un montant vous semble faux ? Touchez **Appeler l'école** ou **WhatsApp** en bas de la page.",
        ],
      },
      {
        id: "securite",
        title: "Protéger vos informations",
        points: [
          "Ce lien est personnel : ne le partagez qu'avec la famille.",
          "Chaque lien ne montre que votre enfant. Personne d'autre ne peut voir vos paiements sans ce lien.",
          "Si le lien a circulé, demandez à l'école de le changer : l'ancien ne fonctionnera plus et vous recevrez le nouveau.",
        ],
      },
    ],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
