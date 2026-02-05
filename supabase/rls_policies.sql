-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.activities enable row level security;
alter table public.bookings enable row level security;
alter table public.tours enable row level security;

-- PROFILES
-- Everyone can read profiles (needed for guide info on tours)
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using ( true );

-- Users can insert their own profile
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check ( auth.uid() = id );

-- Users can update own profile
create policy "Users can update own profile"
  on public.profiles for update
  using ( auth.uid() = id );


-- ACTIVITIES (Business Dashboard)
-- Everyone can view activities (Map)
create policy "Activities are viewable by everyone"
  on public.activities for select
  using ( true );

-- Business owners can insert activities
create policy "Owners can insert activities"
  on public.activities for insert
  with check ( auth.uid() = owner_id );

-- Business owners can update their own activities
create policy "Owners can update own activities"
  on public.activities for update
  using ( auth.uid() = owner_id );


-- TOURS
-- Public view
create policy "Tours are viewable by everyone"
  on public.tours for select
  using ( true );

-- Guides can update their own tours (if column guide_id matches)
create policy "Guides can update own tours"
  on public.tours for update
  using ( guide_id = auth.uid() );


-- BOOKINGS
-- Users can view their own bookings
create policy "Users can view own bookings"
  on public.bookings for select
  using ( auth.uid() = user_id );

-- Users can create bookings
create policy "Users can create bookings"
  on public.bookings for insert
  with check ( auth.uid() = user_id );

-- Guides can view bookings for their tours
create policy "Guides can view bookings for their tours"
  on public.bookings for select
  using (
    exists (
      select 1 from public.tours
      where tours.id = bookings.tour_id
      and tours.guide_id = auth.uid()
    )
  );

-- Guides can update status (Accept/Reject)
create policy "Guides can update bookings for their tours"
  on public.bookings for update
  using (
    exists (
      select 1 from public.tours
      where tours.id = bookings.tour_id
      and tours.guide_id = auth.uid()
    )
  );
