export interface Product {
  id: string;
  name: string;
  brand: 'Apple' | 'Samsung' | 'Xiaomi';
  storage: '128' | '256' | '512';
  grade: 'A' | 'B' | 'C';
  price: number;
  originalPrice: number;
  image: string;
  badges: ('Best seller' | 'Promo' | 'Nouveau')[];
  color: string;
  battery: string;
}

export const mockProducts: Product[] = [
  {
    id: '1',
    name: 'iPhone 13 Pro',
    brand: 'Apple',
    storage: '256',
    grade: 'A',
    price: 649,
    originalPrice: 899,
    image: '/products/iphone-13-pro-blue.png',
    badges: ['Best seller', 'Promo'],
    color: 'Bleu',
    battery: '100%'
  },
  {
    id: '2',
    name: 'Samsung Galaxy S22 Ultra',
    brand: 'Samsung',
    storage: '256',
    grade: 'A',
    price: 599,
    originalPrice: 799,
    image: 'https://www.pngall.com/wp-content/uploads/11/Samsung-Galaxy-S22-Ultra-PNG-Image.png',
    badges: ['Promo'],
    color: 'Noir',
    battery: '95%'
  },
  {
    id: '3',
    name: 'iPhone 12',
    brand: 'Apple',
    storage: '128',
    grade: 'B',
    price: 349,
    originalPrice: 499,
    image: 'https://www.pngall.com/wp-content/uploads/11/iPhone-12-PNG-Picture.png',
    badges: [],
    color: 'Blanc',
    battery: '88%'
  },
  {
    id: '4',
    name: 'Xiaomi 13 Pro',
    brand: 'Xiaomi',
    storage: '256',
    grade: 'A',
    price: 499,
    originalPrice: 650,
    image: 'https://www.pngmart.com/files/22/Xiaomi-13-Pro-PNG-Transparent.png',
    badges: ['Nouveau'],
    color: 'Ceramic White',
    battery: '100%'
  },
  {
    id: '5',
    name: 'iPhone 14 Pro Max',
    brand: 'Apple',
    storage: '512',
    grade: 'A',
    price: 949,
    originalPrice: 1199,
    image: 'https://www.pngmart.com/files/22/iPhone-14-Pro-Max-PNG-Pic.png',
    badges: ['Best seller'],
    color: 'Violet',
    battery: '98%'
  },
  {
    id: '6',
    name: 'Samsung Galaxy Z Flip 4',
    brand: 'Samsung',
    storage: '256',
    grade: 'B',
    price: 459,
    originalPrice: 699,
    image: 'https://www.pngmart.com/files/22/Samsung-Galaxy-Z-Flip-4-PNG-Isolated-Pic.png',
    badges: [],
    color: 'Graphite',
    battery: '85%'
  },
  {
    id: '7',
    name: 'iPhone 11',
    brand: 'Apple',
    storage: '128',
    grade: 'C',
    price: 249,
    originalPrice: 350,
    image: 'https://www.pngmart.com/files/15/Apple-iPhone-11-PNG-File.png',
    badges: ['Promo'],
    color: 'Noir',
    battery: '87%'
  },
  {
    id: '8',
    name: 'Xiaomi Redmi Note 12 Pro',
    brand: 'Xiaomi',
    storage: '128',
    grade: 'A',
    price: 229,
    originalPrice: 299,
    image: 'https://www.pngmart.com/files/22/Xiaomi-13-Lite-PNG.png',
    badges: [],
    color: 'Bleu',
    battery: '100%'
  },
  {
    id: '9',
    name: 'iPhone 14 Pro',
    brand: 'Apple',
    storage: '128',
    grade: 'A',
    price: 849,
    originalPrice: 1199,
    image: 'https://www.pngmart.com/files/22/iPhone-14-Pro-PNG-Isolated-HD.png',
    badges: ['Best seller'],
    color: 'Noir sidéral',
    battery: '100%'
  }
];

export const mockReviews = [
  {
    id: '1',
    name: 'Mélanie C.',
    rating: 5,
    text: 'Très professionnel et patient. L\'équipe a pris le temps de trouver une solution à mon problème et est même restée après la fermeture pour terminer la réparation. Un vrai sens du service, rare et précieux. Je recommande les yeux fermés !',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&auto=format&fit=crop'
  },
  {
    id: '2',
    name: 'Stéphanie G.',
    rating: 5,
    text: 'Excellent accueil et très bons conseils. Mon téléphone avec l\'écran cassé a été réparé à un prix très raisonnable. Une équipe jeune, dynamique et efficace. Je recommande.',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=150&auto=format&fit=crop'
  },
  {
    id: '3',
    name: 'Salomé P.',
    rating: 5,
    text: 'Un bout de chargeur coincé dans mon téléphone, impossible à enlever seule. L\'équipe de Tel & Cash l\'a retiré en deux temps trois mouvements, et gratuitement ! Tout simplement magique. Je conseille cet établissement à 100%.',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=150&auto=format&fit=crop'
  },
  {
    id: '4',
    name: 'Eulalie D.',
    rating: 5,
    text: 'J\'étais complètement perdue pour l\'achat d\'un nouveau téléphone. L\'équipe a été très à l\'écoute de mes attentes et de très bon conseil. Je suis ravie de mon achat et je les recommanderai sans hésiter à mes proches.',
    avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=150&auto=format&fit=crop'
  },
  {
    id: '5',
    name: 'Isaac B.',
    rating: 5,
    text: 'Super expérience chez Tel & Cash à Angers ! Que ce soit pour l\'achat, la vente ou la réparation, l\'équipe est accueillante, rapide et très professionnelle. Les prix sont corrects et le service vraiment efficace. Je recommande sans hésiter.',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop'
  },
  {
    id: '6',
    name: 'Éliane C.',
    rating: 5,
    text: 'J\'ai fait changer la batterie de mon téléphone et j\'ai été très satisfaite. Mon père a ensuite fait de même. En plus d\'un travail de qualité, l\'accueil est chaleureux et le personnel vraiment à l\'écoute. Je recommande.',
    avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?q=80&w=150&auto=format&fit=crop'
  },
  {
    id: '7',
    name: 'Lucas D.',
    rating: 5,
    text: 'Agréablement surpris, je recommande fortement. Je suis venu faire réparer mon iPhone 13 et tout s\'est passé de façon fluide et transparente. Ayant essayé d\'autres boutiques avant, je ne pense pas en changer à l\'avenir.',
    avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?q=80&w=150&auto=format&fit=crop'
  },
  {
    id: '8',
    name: 'Enzo C.',
    rating: 5,
    text: 'La boutique était sur le point de fermer et j\'avais besoin d\'une réparation en urgence. L\'équipe a été très compréhensive et a tout fait pour répondre à ma demande. D\'habitude je ne laisse pas d\'avis, mais cette fois-ci c\'était mérité. Très belle expérience.',
    avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?q=80&w=150&auto=format&fit=crop'
  },
  {
    id: '9',
    name: 'Mendy R.',
    rating: 5,
    text: 'Très bonne expérience. L\'accueil est chaleureux et professionnel, on se sent tout de suite à l\'aise. Le service est rapide et efficace, avec de bons conseils à la clé. Je recommande sans hésiter.',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=150&auto=format&fit=crop'
  },
  {
    id: '10',
    name: 'Hugo B.',
    rating: 5,
    text: 'Une équipe vraiment accueillante et très professionnelle. J\'ai longtemps hésité à prendre un téléphone reconditionné, mais j\'ai sauté le pas les yeux fermés — et tout était parfait. Toujours de bons conseils et une vraie volonté de trouver la meilleure solution. Je recommande à 100%.',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150&auto=format&fit=crop'
  }
];
