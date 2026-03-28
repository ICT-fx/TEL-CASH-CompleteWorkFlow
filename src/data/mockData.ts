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
    name: 'Sophie M.',
    rating: 5,
    text: 'iPhone 13 Pro reçu en 48h parfait état. Batterie à 100% alors que j\'avais pris grade A. Très contente de mon achat !',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&auto=format&fit=crop'
  },
  {
    id: '2',
    name: 'Thomas L.',
    rating: 5,
    text: 'Excellent service client, téléphone conforme à la description (Samsung S22). Prix très compétitif.',
    avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?q=80&w=150&auto=format&fit=crop'
  },
  {
    id: '3',
    name: 'Julie R.',
    rating: 4,
    text: 'Site de confiance, j\'ai pris un Grade B, il y a une micro rayure sur le côté mais l\'écran est nickel. Je recommande.',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=150&auto=format&fit=crop'
  },
  {
    id: '4',
    name: 'Alex D.',
    rating: 5,
    text: 'Première commande de reconditionné et pas déçu. L\'emballage est premium et le téléphone iPhone 14 fonctionne parfaitement.',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop'
  },
  {
    id: '5',
    name: 'Marie E.',
    rating: 5,
    text: 'Livraison express respectée. Merci Tel & Cash pour la coque et le chargeur rapide fournis avec.',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=150&auto=format&fit=crop'
  }
];
