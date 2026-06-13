# Photos accessoires — à déposer ici (Yanis)

Dépose dans CE dossier les JPG fournis par le client, nommés d'après le code « photo src » :

| Fichier à déposer | Produit |
|---|---|
| `J8545.jpg` | Chargeur secteur 45W USB-C |
| `J8548.jpg` | Chargeur secteur 25W USB-C |
| `J8577.jpg` | Prise secteur USB-C 25W |
| `magsafe.jpg` | Batterie externe 10 000 mAh |
| `P8582.jpg` | Batterie externe de poche 5 000 mAh |
| `K62.jpg` | Écouteurs sans fil |
| `F6005.jpg` | Câble USB-C 1 m |
| `F3005.jpg` | Câble USB-C 3 m |
| `F3002.jpg` | Câble 2-en-1 Type-C + Lightning |

(Le « Chargeur 25W + câble Lightning » n'a pas de photo → placeholder neutre, normal.)

Puis lance :

```bash
node scripts/process-accessory-photos.mjs
```

Le script détoure le fond blanc (flood-fill depuis les bords, sans trouer les boîtes/câbles blancs), garde la vue recto si la photo a 2 vues, recentre sur un canvas carré transparent (même rendu que les iPhones), écrit `public/accessoires/<produit>.png` et met à jour la base. Une image inutilisable reste en placeholder.

Note : les extensions `.jpg`, `.jpeg`, `.png`, `.webp` sont acceptées.
