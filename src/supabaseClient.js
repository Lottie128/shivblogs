import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Is a value present and not a stringified empty/undefined/null?
const isPresent = (val) => {
  if (!val) return false;
  const str = String(val).trim().toLowerCase();
  return str !== '' && str !== 'undefined' && str !== 'null';
};

// A real Supabase project URL: https://<ref>.supabase.co (reject the .env.example placeholder).
const isRealUrl = (val) =>
  isPresent(val) && /^https?:\/\//i.test(String(val).trim()) && !String(val).includes('your-project-id');

// A real Supabase client key is either the legacy anon JWT (starts with "eyJ")
// or the new publishable key (starts with "sb_publishable_" / "sb_"). The
// placeholder "your-anon-api-key-here" matches neither, so this reliably tells
// a configured project from an unedited .env. (Without it the placeholder slipped
// through and the app built a real client against a fake project →
// "No API key found in request" on signup.)
const isRealKey = (val) => isPresent(val) && /^(eyJ|sb_)/.test(String(val).trim());

// Fall back to the local mock UNLESS both credentials are real.
export const isMockMode = !isRealUrl(supabaseUrl) || !isRealKey(supabaseAnonKey);

if (isMockMode) {
  // eslint-disable-next-line no-console
  console.warn(
    '[ShivBlogs] Running in DEMO mode (localStorage) — Supabase credentials missing or still set to the .env.example placeholders.\n' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (the anon key starts with "eyJ"), then restart the dev server.'
  );
}

export const supabase = !isMockMode ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Mock Database implementation for high-fidelity LocalStorage fallback
const getStorageItem = (key, defaultValue) => {
  const item = localStorage.getItem(key);
  try {
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const setStorageItem = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

// Initial Seed Data for Blogs
const INITIAL_BLOGS = [
  {
    id: 'blog-1',
    title: 'Why programmer cats never play fetch 🐱',
    content: 'Because they refuse to run code that someone else wrote without reviewing it first. Also, they prefer loops that never end, especially when chasing laser pointers!',
    category: 'Tech Humor',
    emoji: '😺',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    user_id: 'user-system',
    author_name: 'CodeCat'
  },
  {
    id: 'blog-2',
    title: 'Is cereal just cold soup?',
    content: 'Think about it: it is a liquid-based dish with solid ingredients, served in a bowl, eaten with a spoon. If you serve gazpacho cold, why is cereal not soup? Discuss. 🥣',
    category: 'Shower Thoughts',
    emoji: '🧠',
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    user_id: 'user-system',
    author_name: 'DeepThinker'
  },
  {
    id: 'blog-3',
    title: 'My keyboard is judging my search history...',
    content: 'It keeps suggesting "how to exit vim" and "is it normal to cry over semi-colons". Honestly, I think my spacebar is plotting a rebellion.',
    category: 'Rants',
    emoji: '🤬',
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    user_id: 'user-system',
    author_name: 'VimVictim'
  },
  {
    id: 'blog-4',
    title: 'How to wake up early without suffering 💡',
    content: 'Step 1: Put your alarm on the other side of the room. Step 2: Ensure it plays a heavy metal cover of your least favorite song. Step 3: Put a glass of cold water right next to it to splash on your face. Works every time, guaranteed mood changer (usually anger).',
    category: 'Life Hacks',
    emoji: '💡',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    user_id: 'user-system',
    author_name: 'EarlyBird'
  }
];

const INITIAL_COMMENTS = [
  {
    id: 'comment-1',
    blog_id: 'blog-1',
    user_id: 'user-system-2',
    author_name: 'PixelPaws',
    content: 'Fully agree. My cat reviewed my pull request yesterday and knocked the coffee onto the keyboard. Pure approval.',
    created_at: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'comment-2',
    blog_id: 'blog-2',
    user_id: 'user-system',
    author_name: 'CodeCat',
    content: 'Cereal is definitely soup. Milk is just sweet broth!',
    created_at: new Date(Date.now() - 3600000 * 4).toISOString()
  }
];

// Mock API client for local storage mock mode
export const mockApi = {
  // Auth simulation
  auth: {
    getUser: () => {
      const session = getStorageItem('shivblogs_session', null);
      return { data: { user: session }, error: null };
    },
    signUp: async ({ email, password, options }) => {
      await new Promise(r => setTimeout(r, 600));
      const users = getStorageItem('shivblogs_users', []);
      if (users.some(u => u.email === email)) {
        return { data: { user: null }, error: { message: 'User already exists!' } };
      }
      const newUser = {
        id: 'user-' + Math.random().toString(36).substr(2, 9),
        email,
        raw_user_meta_data: options?.data || {},
        created_at: new Date().toISOString()
      };
      users.push(newUser);
      setStorageItem('shivblogs_users', users);
      setStorageItem('shivblogs_session', newUser);
      return { data: { user: newUser }, error: null };
    },
    signInWithPassword: async ({ email, password }) => {
      await new Promise(r => setTimeout(r, 600));
      const users = getStorageItem('shivblogs_users', []);
      const user = users.find(u => u.email === email);
      // For simple demo, we accept any login if user exists
      if (!user) {
        return { data: { user: null }, error: { message: 'Invalid login credentials!' } };
      }
      setStorageItem('shivblogs_session', user);
      return { data: { user }, error: null };
    },
    signOut: async () => {
      setStorageItem('shivblogs_session', null);
      return { error: null };
    }
  },

  // Blogs simulation
  blogs: {
    select: async () => {
      await new Promise(r => setTimeout(r, 400));
      const blogs = getStorageItem('shivblogs_posts', INITIAL_BLOGS);
      // Sort desc
      return { 
        data: [...blogs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)), 
        error: null 
      };
    },
    insert: async (blog) => {
      await new Promise(r => setTimeout(r, 500));
      const blogs = getStorageItem('shivblogs_posts', INITIAL_BLOGS);
      const newBlog = {
        id: 'blog-' + Math.random().toString(36).substr(2, 9),
        created_at: new Date().toISOString(),
        ...blog
      };
      blogs.push(newBlog);
      setStorageItem('shivblogs_posts', blogs);
      return { data: [newBlog], error: null };
    },
    delete: async (blogId, userId) => {
      await new Promise(r => setTimeout(r, 400));
      let blogs = getStorageItem('shivblogs_posts', INITIAL_BLOGS);
      blogs = blogs.filter(b => !(b.id === blogId && b.user_id === userId));
      setStorageItem('shivblogs_posts', blogs);
      return { error: null };
    }
  },

  // Likes simulation
  likes: {
    select: async () => {
      const likes = getStorageItem('shivblogs_likes', []);
      return { data: likes, error: null };
    },
    toggle: async (blogId, userId) => {
      const likes = getStorageItem('shivblogs_likes', []);
      const index = likes.findIndex(l => l.blog_id === blogId && l.user_id === userId);
      let action = 'liked';
      if (index > -1) {
        likes.splice(index, 1);
        action = 'unliked';
      } else {
        likes.push({
          id: 'like-' + Math.random().toString(36).substr(2, 9),
          blog_id: blogId,
          user_id: userId,
          created_at: new Date().toISOString()
        });
      }
      setStorageItem('shivblogs_likes', likes);
      return { action, error: null };
    }
  },

  // Comments simulation
  comments: {
    select: async (blogId) => {
      const comments = getStorageItem('shivblogs_comments', INITIAL_COMMENTS);
      const filtered = comments.filter(c => c.blog_id === blogId);
      return { data: filtered.sort((a,b) => new Date(a.created_at) - new Date(b.created_at)), error: null };
    },
    insert: async (comment) => {
      const comments = getStorageItem('shivblogs_comments', INITIAL_COMMENTS);
      const newComment = {
        id: 'comment-' + Math.random().toString(36).substr(2, 9),
        created_at: new Date().toISOString(),
        ...comment
      };
      comments.push(newComment);
      setStorageItem('shivblogs_comments', comments);
      return { data: [newComment], error: null };
    },
    delete: async (commentId, userId) => {
      let comments = getStorageItem('shivblogs_comments', INITIAL_COMMENTS);
      comments = comments.filter(c => !(c.id === commentId && c.user_id === userId));
      setStorageItem('shivblogs_comments', comments);
      return { error: null };
    }
  }
};
