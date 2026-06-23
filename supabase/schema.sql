-- Supabase Database Schema for ShivBlogs
-- This script contains table definitions, constraints, triggers, and Row Level Security (RLS) policies.
-- It is designed to be fully idempotent (safe to rerun/redeploy).

-- 1. Create Profiles Table (extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Allow authenticated users to read profiles" ON public.profiles;
CREATE POLICY "Allow authenticated users to read profiles" ON public.profiles
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
CREATE POLICY "Allow users to update their own profile" ON public.profiles
    FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 2. Create Blogs Table
CREATE TABLE IF NOT EXISTS public.blogs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL, -- e.g., 'Meme', 'Shower Thoughts', 'Life Hacks', 'Tech Humor', 'Confessions'
    emoji TEXT NOT NULL DEFAULT '📝',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    author_name TEXT NOT NULL
);

-- Enable RLS for blogs
ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;

-- Blogs Policies
DROP POLICY IF EXISTS "Allow authenticated users to read blogs" ON public.blogs;
CREATE POLICY "Allow authenticated users to read blogs" ON public.blogs
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to insert blogs" ON public.blogs;
CREATE POLICY "Allow authenticated users to insert blogs" ON public.blogs
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to update their own blogs" ON public.blogs;
CREATE POLICY "Allow users to update their own blogs" ON public.blogs
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to delete their own blogs" ON public.blogs;
CREATE POLICY "Allow users to delete their own blogs" ON public.blogs
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. Create Likes Table (for interactivity)
CREATE TABLE IF NOT EXISTS public.likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    blog_id UUID REFERENCES public.blogs ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (blog_id, user_id) -- A user can only like a blog once
);

-- Enable RLS for likes
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- Likes Policies
DROP POLICY IF EXISTS "Allow authenticated users to read likes" ON public.likes;
CREATE POLICY "Allow authenticated users to read likes" ON public.likes
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to toggle likes" ON public.likes;
CREATE POLICY "Allow authenticated users to toggle likes" ON public.likes
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow authenticated users to remove likes" ON public.likes;
CREATE POLICY "Allow authenticated users to remove likes" ON public.likes
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. Create Comments Table (for interactivity)
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    blog_id UUID REFERENCES public.blogs ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    author_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for comments
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Comments Policies
DROP POLICY IF EXISTS "Allow authenticated users to read comments" ON public.comments;
CREATE POLICY "Allow authenticated users to read comments" ON public.comments
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to add comments" ON public.comments;
CREATE POLICY "Allow authenticated users to add comments" ON public.comments
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to delete their own comments" ON public.comments;
CREATE POLICY "Allow users to delete their own comments" ON public.comments
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 5. Trigger to automatically create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', 'User_' || substring(new.id::text from 1 for 6)),
    COALESCE(new.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=' || new.id::text)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Insert some fun initial seed blogs (for when the DB is first set up)
-- Note: Replace USER_ID_PLACEHOLDER with an actual user ID if inserting manually via SQL editor,
-- or our app can handle seeding/creating posts if none exist.
