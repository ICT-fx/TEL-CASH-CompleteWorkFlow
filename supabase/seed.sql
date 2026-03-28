-- ========================================
-- SEED DATA — Sample products for testing
-- ========================================

-- Insert sample phones
INSERT INTO public.products (brand, model, storage_capacity, color, imei, warranty, condition_description, grade, battery_health, price, compare_at_price, stock, images, category) VALUES
('Apple', 'iPhone 15 Pro Max', '256 Go', 'Titane Naturel', '352345678901234', '12 mois', 'Parfait état, aucune rayure, batterie excellente', 'A', 95, 899.99, 1099.99, 3, ARRAY['https://placehold.co/600x600/1a1a2e/ffffff?text=iPhone+15+Pro+Max'], 'telephones'),
('Apple', 'iPhone 14', '128 Go', 'Bleu', '352345678901235', '6 mois', 'Très bon état, légères traces d''utilisation', 'B', 88, 549.99, 749.99, 5, ARRAY['https://placehold.co/600x600/1a1a2e/ffffff?text=iPhone+14'], 'telephones'),
('Apple', 'iPhone 13', '128 Go', 'Minuit', '352345678901236', '3 mois', 'État correct, quelques marques visibles sur les côtés', 'C', 86, 399.99, 599.99, 2, ARRAY['https://placehold.co/600x600/1a1a2e/ffffff?text=iPhone+13'], 'telephones'),
('Samsung', 'Galaxy S24 Ultra', '256 Go', 'Noir', '352345678901237', '12 mois', 'Comme neuf, batterie excellente', 'A', 97, 849.99, 1199.99, 4, ARRAY['https://placehold.co/600x600/1a1a2e/ffffff?text=Galaxy+S24+Ultra'], 'telephones'),
('Samsung', 'Galaxy S23', '128 Go', 'Vert', '352345678901238', '6 mois', 'Très bon état, micro-rayures écran', 'B', 90, 449.99, 699.99, 3, ARRAY['https://placehold.co/600x600/1a1a2e/ffffff?text=Galaxy+S23'], 'telephones'),
('Samsung', 'Galaxy A54', '128 Go', 'Blanc', '352345678901239', '6 mois', 'Bon état général', 'B', 92, 249.99, 399.99, 6, ARRAY['https://placehold.co/600x600/1a1a2e/ffffff?text=Galaxy+A54'], 'telephones'),
('Google', 'Pixel 8 Pro', '128 Go', 'Obsidienne', '352345678901240', '12 mois', 'Parfait état', 'A', 96, 599.99, 899.99, 2, ARRAY['https://placehold.co/600x600/1a1a2e/ffffff?text=Pixel+8+Pro'], 'telephones'),
('Xiaomi', 'Redmi Note 13 Pro', '256 Go', 'Noir', '352345678901241', '6 mois', 'Très bon état', 'B', 91, 199.99, 329.99, 8, ARRAY['https://placehold.co/600x600/1a1a2e/ffffff?text=Redmi+Note+13'], 'telephones');

-- Insert sample accessories
INSERT INTO public.products (brand, model, price, stock, images, category, condition_description) VALUES
('Apple', 'Coque iPhone 15 - Silicone MagSafe', 29.99, 20, ARRAY['https://placehold.co/600x600/1a1a2e/ffffff?text=Coque+iPhone+15'], 'accessoires', 'Neuf'),
('Samsung', 'Chargeur rapide 25W USB-C', 19.99, 30, ARRAY['https://placehold.co/600x600/1a1a2e/ffffff?text=Chargeur+Samsung'], 'accessoires', 'Neuf'),
('Belkin', 'Protection écran iPhone 15 - Verre trempé', 14.99, 50, ARRAY['https://placehold.co/600x600/1a1a2e/ffffff?text=Protection+Ecran'], 'accessoires', 'Neuf'),
('Anker', 'Câble USB-C vers Lightning 1m', 12.99, 40, ARRAY['https://placehold.co/600x600/1a1a2e/ffffff?text=Cable+Anker'], 'accessoires', 'Neuf'),
('Apple', 'AirPods Pro 2ème gen (reconditionné)', 149.99, 5, ARRAY['https://placehold.co/600x600/1a1a2e/ffffff?text=AirPods+Pro'], 'accessoires', 'Reconditionné - Très bon état');
