-- ========================================
-- ROW LEVEL SECURITY POLICIES
-- ========================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

-- Helper function: is current user an admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ========================================
-- PROFILES
-- ========================================
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Admins full access profiles"
  ON public.profiles FOR ALL
  USING (public.is_admin());

CREATE POLICY "Allow insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- ========================================
-- PRODUCTS (public read, admin write)
-- ========================================
CREATE POLICY "Anyone can view active products"
  ON public.products FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can view all products"
  ON public.products FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can insert products"
  ON public.products FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update products"
  ON public.products FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete products"
  ON public.products FOR DELETE
  USING (public.is_admin());

-- ========================================
-- CART ITEMS
-- ========================================
CREATE POLICY "Users manage own cart"
  ON public.cart_items FOR ALL
  USING (user_id = auth.uid());

-- ========================================
-- ORDERS
-- ========================================
CREATE POLICY "Users view own orders"
  ON public.orders FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins manage all orders"
  ON public.orders FOR ALL
  USING (public.is_admin());

-- Allow insert for authenticated users (creating orders)
CREATE POLICY "Users can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ========================================
-- ORDER ITEMS
-- ========================================
CREATE POLICY "Users view own order items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage order items"
  ON public.order_items FOR ALL
  USING (public.is_admin());

CREATE POLICY "Users can insert order items"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- ========================================
-- ADDRESSES
-- ========================================
CREATE POLICY "Users manage own addresses"
  ON public.addresses FOR ALL
  USING (user_id = auth.uid());

-- ========================================
-- REFERRAL CODES
-- ========================================
CREATE POLICY "Users view own referral codes"
  ON public.referral_codes FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins manage referral codes"
  ON public.referral_codes FOR ALL
  USING (public.is_admin());

CREATE POLICY "Users can create own referral codes"
  ON public.referral_codes FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Anyone can look up an active code to validate it (public lookup)
CREATE POLICY "Anyone can validate active codes"
  ON public.referral_codes FOR SELECT
  USING (is_active = true AND times_used < max_uses);

-- ========================================
-- LOYALTY POINTS
-- ========================================
CREATE POLICY "Users view own points"
  ON public.loyalty_points FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins manage loyalty points"
  ON public.loyalty_points FOR ALL
  USING (public.is_admin());
