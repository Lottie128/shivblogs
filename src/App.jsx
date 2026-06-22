import { useState, useEffect } from 'react';
import { 
  Mail, 
  Lock, 
  User, 
  Plus, 
  Heart, 
  MessageCircle, 
  Trash2, 
  LogOut, 
  Globe, 
  Search, 
  PenTool, 
  Sparkles, 
  Smile, 
  Info,
  ChevronRight,
  Flame,
  Lightbulb,
  Cat,
  Coffee,
  HelpCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase, isMockMode, mockApi } from './supabaseClient';
import './App.css';

// Unify Database Access Layer
const db = isMockMode ? mockApi : {
  auth: {
    getUser: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return { data: { user } };
    },
    signUp: async ({ email, password, options }) => {
      return await supabase.auth.signUp({ email, password, options });
    },
    signInWithPassword: async ({ email, password }) => {
      return await supabase.auth.signInWithPassword({ email, password });
    },
    signOut: async () => {
      return await supabase.auth.signOut();
    }
  },
  blogs: {
    select: async () => {
      return await supabase.from('blogs').select('*').order('created_at', { ascending: false });
    },
    insert: async (blog) => {
      return await supabase.from('blogs').insert(blog).select();
    },
    delete: async (blogId, userId) => {
      return await supabase.from('blogs').delete().eq('id', blogId).eq('user_id', userId);
    }
  },
  likes: {
    select: async () => {
      return await supabase.from('likes').select('*');
    },
    toggle: async (blogId, userId) => {
      const { data: existing } = await supabase
        .from('likes')
        .select('id')
        .eq('blog_id', blogId)
        .eq('user_id', userId);
      
      if (existing && existing.length > 0) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('blog_id', blogId)
          .eq('user_id', userId);
        return { action: 'unliked', error };
      } else {
        const { error } = await supabase
          .from('likes')
          .insert({ blog_id: blogId, user_id: userId });
        return { action: 'liked', error };
      }
    }
  },
  comments: {
    select: async (blogId) => {
      return await supabase
        .from('comments')
        .select('*')
        .eq('blog_id', blogId)
        .order('created_at', { ascending: true });
    },
    insert: async (comment) => {
      return await supabase.from('comments').insert(comment).select();
    },
    delete: async (commentId, userId) => {
      return await supabase.from('comments').delete().eq('id', commentId).eq('user_id', userId);
    }
  }
};

// Fun categories with icons and color schemes
const CATEGORIES = [
  { name: 'All', emoji: '🧭', color: 'var(--color-primary)' },
  { name: 'Memes', emoji: '🤪', color: 'var(--color-accent)' },
  { name: 'Shower Thoughts', emoji: '🧠', color: 'var(--color-secondary)' },
  { name: 'Tech Humor', emoji: '💻', color: '#10b981' },
  { name: 'Rants', emoji: '🤬', color: '#f59e0b' },
  { name: 'Life Hacks', emoji: '💡', color: '#84cc16' },
  { name: 'Wholesome', emoji: '❤️', color: '#ec4899' }
];

const FUN_EMOJIS = ['🤪', '🧠', '💻', '🤬', '💡', '❤️', '🚀', '😺', '🍕', '💀', '🎉', '🦄', '🍿', '🔥', '👑', '🌈'];

function App() {
  // Authentication & Profile states
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authTab, setAuthTab] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [avatarSeed, setAvatarSeed] = useState(Math.random().toString(36).substring(7));
  const [authError, setAuthError] = useState(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Application functional states
  const [blogs, setBlogs] = useState([]);
  const [likes, setLikes] = useState([]);
  const [commentsByBlog, setCommentsByBlog] = useState({});
  const [activeCommentsBlogId, setActiveCommentsBlogId] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [loadingBlogs, setLoadingBlogs] = useState(true);

  // Blog Creator form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Memes');
  const [selectedEmoji, setSelectedEmoji] = useState('🤪');
  const [submittingBlog, setSubmittingBlog] = useState(false);

  // Filters & Search
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'my'

  // Toasts
  const [toasts, setToasts] = useState([]);

  // Database Connection Details panel visibility
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  // Auto-generate avatar URL from seed
  const avatarUrl = `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${avatarSeed}`;

  // Helper to show custom notification toasts
  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Get current user details upon load
  useEffect(() => {
    const initSession = async () => {
      try {
        const { data } = await db.auth.getUser();
        if (data?.user) {
          setSession(data.user);
          addToast(`Welcome back, ${data.user.user_metadata?.username || 'user'}! 🚀`, 'success');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setAuthLoading(false);
      }
    };
    initSession();

    // Listen to real Supabase auth state change if not mock
    if (!isMockMode) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session?.user || null);
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  // Fetch blogs, likes and comments whenever session changes
  useEffect(() => {
    if (session) {
      fetchFeed();
    }
  }, [session]);

  const fetchFeed = async () => {
    setLoadingBlogs(true);
    try {
      const [blogsRes, likesRes] = await Promise.all([
        db.blogs.select(),
        db.likes.select()
      ]);

      if (blogsRes.error) throw blogsRes.error;
      if (likesRes.error) throw likesRes.error;

      setBlogs(blogsRes.data || []);
      setLikes(likesRes.data || []);
    } catch (err) {
      addToast(err.message || 'Error fetching blogs!', 'error');
    } finally {
      setLoadingBlogs(false);
    }
  };

  // Authentication handlers
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSubmitting(true);

    try {
      if (authTab === 'signup') {
        if (!username.trim()) {
          throw new Error('Please pick a cool username!');
        }
        const { data, error } = await db.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              username,
              avatar_url: avatarUrl
            }
          }
        });
        if (error) throw error;
        
        // If Supabase returned a real session, sign in immediately
        if (data?.session) {
          setSession(data.session.user);
          addToast('Account created successfully! Welcome to ShivBlogs 🤪', 'success');
        } else {
          // Email confirmation is required — do NOT set session
          addToast('Check your email to confirm your account! 📧', 'info');
        }
      } else {
        const { data, error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data?.user) {
          setSession(data.user);
          addToast('Successfully logged in! 🎉', 'success');
        }
      }
    } catch (err) {
      setAuthError(err.message);
      addToast(err.message, 'error');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await db.auth.signOut();
      setSession(null);
      setBlogs([]);
      setLikes([]);
      addToast('Logged out successfully! Come back soon! 👋', 'info');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // Blog creation handler
  const handleCreateBlog = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      addToast('A blog needs both a title and some fun thoughts!', 'error');
      return;
    }

    setSubmittingBlog(true);
    try {
      const blogData = {
        title: title.trim(),
        content: content.trim(),
        category,
        emoji: selectedEmoji,
        user_id: session.id,
        author_name: session.user_metadata?.username || 'Anonymous'
      };

      const { data, error } = await db.blogs.insert(blogData);
      if (error) throw error;

      // Celebrate!
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 }
      });

      addToast('Your fun thoughts are live! 🚀', 'success');
      
      // Reset Form
      setTitle('');
      setContent('');
      setSelectedEmoji(FUN_EMOJIS[Math.floor(Math.random() * FUN_EMOJIS.length)]);
      
      // Refresh feed
      if (data && data[0]) {
        setBlogs(prev => [data[0], ...prev]);
      } else {
        fetchFeed();
      }
    } catch (err) {
      addToast(err.message || 'Failed to publish post.', 'error');
    } finally {
      setSubmittingBlog(false);
    }
  };

  // Delete Blog
  const handleDeleteBlog = async (blogId) => {
    if (!window.confirm('Delete this masterpiece? Are you absolutely sure? 😢')) return;

    try {
      const { error } = await db.blogs.delete(blogId, session.id);
      if (error) throw error;

      setBlogs(prev => prev.filter(b => b.id !== blogId));
      addToast('Post deleted successfully.', 'info');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // Toggle Like
  const handleToggleLike = async (blogId) => {
    try {
      const userLiked = likes.some(l => l.blog_id === blogId && l.user_id === session.id);
      
      const { action, error } = await db.likes.toggle(blogId, session.id);
      if (error) throw error;

      if (action === 'liked') {
        setLikes(prev => [...prev, { blog_id: blogId, user_id: session.id }]);
        
        // Trigger small confetti effect right above the card
        confetti({
          particleCount: 30,
          angle: 60,
          spread: 55,
          origin: { x: 0.3 + Math.random() * 0.4, y: 0.6 }
        });
        
        addToast('Liking this content! ❤️', 'success');
      } else {
        setLikes(prev => prev.filter(l => !(l.blog_id === blogId && l.user_id === session.id)));
      }
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // Load and Toggle Comments section
  const handleToggleComments = async (blogId) => {
    if (activeCommentsBlogId === blogId) {
      setActiveCommentsBlogId(null);
      return;
    }

    setActiveCommentsBlogId(blogId);
    
    // Load comments if not loaded yet
    try {
      const { data, error } = await db.comments.select(blogId);
      if (error) throw error;
      setCommentsByBlog(prev => ({ ...prev, [blogId]: data || [] }));
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // Add Comment
  const handleAddComment = async (e, blogId) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    try {
      const commentData = {
        blog_id: blogId,
        user_id: session.id,
        content: newCommentText.trim(),
        author_name: session.user_metadata?.username || 'Anonymous'
      };

      const { data, error } = await db.comments.insert(commentData);
      if (error) throw error;

      setCommentsByBlog(prev => ({
        ...prev,
        [blogId]: [...(prev[blogId] || []), data[0]]
      }));
      setNewCommentText('');
      addToast('Comment added! 💬', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // Delete Comment
  const handleDeleteComment = async (commentId, blogId) => {
    try {
      const { error } = await db.comments.delete(commentId, session.id);
      if (error) throw error;

      setCommentsByBlog(prev => ({
        ...prev,
        [blogId]: prev[blogId].filter(c => c.id !== commentId)
      }));
      addToast('Comment deleted.', 'info');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // Filtering blogs
  const filteredBlogs = blogs.filter(blog => {
    const matchesCategory = activeCategory === 'All' || blog.category === activeCategory;
    const matchesSearch = blog.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          blog.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          blog.author_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || blog.user_id === session?.id;
    return matchesCategory && matchesSearch && matchesTab;
  });

  return (
    <div className="app-container">
      {/* Dynamic Background */}
      <div className="bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      {/* Floating Toast Notification Container */}
      <div style={{
        position: 'fixed',
        top: '1.5rem',
        right: '1.5rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        maxWidth: '350px'
      }}>
        {toasts.map(toast => (
          <div key={toast.id} style={{
            background: toast.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 
                        toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(30, 41, 59, 0.95)',
            color: '#fff',
            padding: '0.8rem 1.2rem',
            borderRadius: '12px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            fontSize: '0.9rem',
            fontWeight: '600',
            animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            {toast.type === 'success' && '🌟'}
            {toast.type === 'error' && '💥'}
            {toast.type === 'info' && '🔔'}
            {toast.message}
          </div>
        ))}
      </div>

      {/* App Header Banner for Demo Mode / Setup */}
      {isMockMode && (
        <div className="demo-banner">
          <span>
            <Sparkles size={16} style={{ color: '#fbbf24' }} />
            <strong>Demo Mode Active:</strong> Using Local Storage. No Supabase configuration found in env.
          </span>
          <button 
            onClick={() => setShowSetupGuide(!showSetupGuide)} 
            className="btn btn-secondary" 
            style={{ 
              padding: '0.3rem 0.8rem', 
              fontSize: '0.75rem', 
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.1)',
              borderColor: 'rgba(255,255,255,0.2)',
              color: '#fff'
            }}
          >
            <Info size={12} /> {showSetupGuide ? 'Hide Setup' : 'Show Supabase Setup'}
          </button>
        </div>
      )}

      {/* Supabase Connection Walkthrough Panel */}
      {isMockMode && showSetupGuide && (
        <div className="glass-panel" style={{ marginTop: '1rem', borderLeft: '4px solid var(--color-primary)' }}>
          <h3 className="panel-title" style={{ fontSize: '1.2rem' }}>
            <Globe size={18} /> Connecting to Supabase
          </h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            To link this project with your Supabase backend, follow these simple steps:
          </p>
          <ol style={{ fontSize: '0.85rem', color: 'var(--text-main)', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <li>
              Create a file named <code>.env</code> in the project root directory (<code>C:\Users\user\shivblogs\.env</code>)
            </li>
            <li>
              Add the following environment variables (replace with your actual API keys from Supabase project settings):
              <pre style={{
                background: 'var(--bg-tertiary)',
                padding: '0.6rem',
                borderRadius: '8px',
                marginTop: '0.4rem',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                overflowX: 'auto',
                border: '1px solid var(--border-color)',
                color: 'var(--color-secondary)'
              }}>
{`VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-api-key`}
              </pre>
            </li>
            <li>
              Go to your Supabase project's <strong>SQL Editor</strong> and execute the queries stored in the file <a href="file:///C:/Users/user/shivblogs/supabase/schema.sql" style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>supabase/schema.sql</a> to create tables and RLS policies.
            </li>
            <li>
              Restart the Vite dev server to reload variables!
            </li>
          </ol>
        </div>
      )}

      {/* MAIN SCREEN ROUTER */}
      {authLoading ? (
        <div className="loading-wrapper">
          <div className="spinner"></div>
          <p>Warming up the fun engine...</p>
        </div>
      ) : !session ? (
        /* ================= AUTHENTICATION VIEW ================= */
        <div className="auth-page">
          <div className="auth-card">
            <h1 className="auth-logo">
              ShivBlogs<span className="bounce-emoji">🤪</span>
            </h1>
            <p className="auth-subtitle">Welcome to the hub of funny thoughts and rants!</p>
            
            <div className="auth-tabs">
              <button 
                className={`auth-tab ${authTab === 'login' ? 'active' : ''}`}
                onClick={() => { setAuthTab('login'); setAuthError(null); }}
              >
                Sign In
              </button>
              <button 
                className={`auth-tab ${authTab === 'signup' ? 'active' : ''}`}
                onClick={() => { setAuthTab('signup'); setAuthError(null); }}
              >
                Sign Up
              </button>
            </div>

            {authError && (
              <div className="error-message">
                <Info size={16} />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAuth} className="auth-form">
              {authTab === 'signup' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Cool Username</label>
                    <div className="form-input-wrapper">
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. MemeLord" 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                      />
                      <User size={18} className="form-icon" />
                    </div>
                  </div>

                  {/* Fun Avatar Generator preview inside signup */}
                  <div className="form-group" style={{ alignItems: 'center', margin: '0.5rem 0' }}>
                    <label className="form-label" style={{ alignSelf: 'flex-start' }}>Your Avatar</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', marginTop: '0.4rem' }}>
                      <div className="avatar-wrapper" style={{ width: '56px', height: '56px', flexShrink: 0 }}>
                        <img src={avatarUrl} alt="Avatar Preview" className="avatar-img" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <button 
                          type="button" 
                          onClick={() => setAvatarSeed(Math.random().toString(36).substring(7))}
                          className="btn btn-secondary"
                          style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem', display: 'flex', gap: '0.4rem', justifyContent: 'center' }}
                        >
                          <Smile size={16} /> Randomize Face
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div className="form-input-wrapper">
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="you@email.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <Mail size={18} className="form-icon" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="form-input-wrapper">
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Lock size={18} className="form-icon" />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }} disabled={authSubmitting}>
                {authSubmitting ? 'Please wait...' : (authTab === 'login' ? 'Sign In Now' : 'Create Account')} {!authSubmitting && <ChevronRight size={18} />}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* ================= APP DASHBOARD VIEW ================= */
        <>
          <header className="app-header">
            <h1 className="app-logo" onClick={() => { setActiveCategory('All'); setSearchQuery(''); }}>
              ShivBlogs<span className="bounce-emoji">🤪</span>
            </h1>
            <div className="user-profile">
              <div className="avatar-wrapper">
                <img 
                  src={session.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${session.id}`} 
                  alt="My Avatar" 
                  className="avatar-img" 
                />
              </div>
              <span className="profile-name">{session.user_metadata?.username || 'User'}</span>
              <button onClick={handleSignOut} className="btn-signout" title="Sign Out">
                <LogOut size={16} />
              </button>
            </div>
          </header>

          <div className="dashboard-grid">
            {/* Sidebar Controls */}
            <aside className="sidebar-panel">
              {/* Creator Form */}
              <div className="glass-panel">
                <h3 className="panel-title">
                  <PenTool size={18} style={{ color: 'var(--color-primary)' }} /> Write a Fun Post
                </h3>
                <form onSubmit={handleCreateBlog} className="creator-form">
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Catchy Title</label>
                    <input 
                      type="text" 
                      placeholder="Give it a fun title..." 
                      className="form-input"
                      style={{ paddingLeft: '1rem' }}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={100}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Pick a Mood Emoji</label>
                    <div className="creator-emoji-selector">
                      {FUN_EMOJIS.map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          className={`emoji-btn ${selectedEmoji === emoji ? 'selected' : ''}`}
                          onClick={() => setSelectedEmoji(emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Category</label>
                    <select 
                      className="select-category-input"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      {CATEGORIES.slice(1).map(cat => (
                        <option key={cat.name} value={cat.name}>
                          {cat.emoji} {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Your Thoughts</span>
                      <span style={{ color: content.length > 250 ? 'var(--color-accent)' : 'inherit' }}>
                        {content.length}/350
                      </span>
                    </label>
                    <textarea 
                      className="creator-textarea" 
                      placeholder="What crazy thing happened today? Share the details..."
                      value={content}
                      onChange={(e) => setContent(e.target.value.slice(0, 350))}
                      required
                    />
                  </div>

                  <button type="submit" disabled={submittingBlog} className="btn btn-primary" style={{ width: '100%' }}>
                    {submittingBlog ? 'Publishing...' : 'Spread the Joy 🚀'}
                  </button>
                </form>
              </div>

              {/* Category Filter Panel */}
              <div className="glass-panel">
                <h3 className="panel-title">
                  <Compass size={18} style={{ color: 'var(--color-secondary)' }} /> Explore Moods
                </h3>
                <div className="categories-list">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.name}
                      onClick={() => setActiveCategory(cat.name)}
                      className={`category-pill ${activeCategory === cat.name ? 'active' : ''}`}
                    >
                      <span>{cat.emoji}</span>
                      <span>{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            {/* Blogs Feed */}
            <main className="feed-section">
              {/* Filter controls header */}
              <div className="feed-header">
                <div className="feed-title">
                  <Flame size={20} style={{ color: 'var(--color-accent)' }} /> 
                  <span>{activeCategory} Blogs</span>
                  <span style={{ 
                    fontSize: '0.8rem', 
                    background: 'var(--bg-tertiary)', 
                    padding: '0.2rem 0.6rem', 
                    borderRadius: '50px',
                    color: 'var(--text-muted)',
                    marginLeft: '0.5rem'
                  }}>
                    {filteredBlogs.length} posts
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Search box */}
                  <div className="form-input-wrapper" style={{ width: '220px' }}>
                    <input 
                      type="text" 
                      placeholder="Search blogs..." 
                      className="form-input"
                      style={{ padding: '0.5rem 1rem 0.5rem 2.2rem', fontSize: '0.85rem', borderRadius: '10px' }}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Search size={14} className="form-icon" style={{ left: '0.8rem' }} />
                  </div>

                  {/* Feed toggle */}
                  <div className="feed-filters">
                    <button 
                      className={`feed-filter-btn ${activeTab === 'all' ? 'active' : ''}`}
                      onClick={() => setActiveTab('all')}
                    >
                      All Blogs
                    </button>
                    <button 
                      className={`feed-filter-btn ${activeTab === 'my' ? 'active' : ''}`}
                      onClick={() => setActiveTab('my')}
                    >
                      My Blogs
                    </button>
                  </div>
                </div>
              </div>

              {/* Feed lists */}
              {loadingBlogs ? (
                <div className="loading-wrapper" style={{ minHeight: '200px' }}>
                  <div className="spinner"></div>
                  <p>Downloading laughter...</p>
                </div>
              ) : filteredBlogs.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🪐</div>
                  <h2>Absolute Silence here...</h2>
                  <p>No blogs matching the filter or search query. Write the first fun post!</p>
                </div>
              ) : (
                filteredBlogs.map(blog => {
                  const postLikes = likes.filter(l => l.blog_id === blog.id);
                  const userLiked = likes.some(l => l.blog_id === blog.id && l.user_id === session.id);
                  const isCommentsOpen = activeCommentsBlogId === blog.id;
                  const blogComments = commentsByBlog[blog.id] || [];

                  return (
                    <article key={blog.id} className="blog-card">
                      <div className="blog-card-header">
                        <div className="blog-card-meta">
                          <div className="avatar-wrapper" style={{ width: '32px', height: '32px' }}>
                            <img 
                              src={`https://api.dicebear.com/7.x/fun-emoji/svg?seed=${blog.author_name}`} 
                              alt={blog.author_name} 
                              className="avatar-img" 
                            />
                          </div>
                          <div className="blog-card-author">
                            <span className="blog-author-name">{blog.author_name}</span>
                            <span className="blog-date">{new Date(blog.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="blog-card-tags">
                          <span className="blog-tag-category">{blog.category}</span>
                          <span className="blog-tag-emoji">{blog.emoji}</span>
                        </div>
                      </div>

                      <h2 className="blog-title">{blog.title}</h2>
                      <p className="blog-content">{blog.content}</p>

                      <div className="blog-card-actions">
                        <button 
                          onClick={() => handleToggleLike(blog.id)}
                          className={`action-btn action-btn-like ${userLiked ? 'liked' : ''}`}
                        >
                          <Heart size={16} />
                          <span>{postLikes.length} Likes</span>
                        </button>

                        <button 
                          onClick={() => handleToggleComments(blog.id)}
                          className="action-btn action-btn-comment"
                        >
                          <MessageCircle size={16} />
                          <span>Comments ({isCommentsOpen ? blogComments.length : '...'})</span>
                        </button>

                        {blog.user_id === session.id && (
                          <button 
                            onClick={() => handleDeleteBlog(blog.id)}
                            className="action-btn action-btn-delete"
                            title="Delete Blog"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>

                      {/* Comments expanded section */}
                      {isCommentsOpen && (
                        <div className="comments-container">
                          <div className="comments-list">
                            {blogComments.length === 0 ? (
                              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem 0' }}>
                                No comments yet. Be the first to type something silly! 💬
                              </p>
                            ) : (
                              blogComments.map(comment => (
                                <div key={comment.id} className="comment-item">
                                  <div className="comment-header">
                                    <span className="comment-author">{comment.author_name}</span>
                                    <span className="comment-date">{new Date(comment.created_at).toLocaleDateString()}</span>
                                  </div>
                                  <p className="comment-content">{comment.content}</p>
                                  
                                  {comment.user_id === session.id && (
                                    <button 
                                      onClick={() => handleDeleteComment(comment.id, blog.id)}
                                      className="btn-comment-delete"
                                      title="Delete Comment"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              ))
                            )}
                          </div>

                          <form onSubmit={(e) => handleAddComment(e, blog.id)} className="comment-input-form">
                            <input 
                              type="text" 
                              placeholder="Write a comment..." 
                              className="comment-input"
                              value={newCommentText}
                              onChange={(e) => setNewCommentText(e.target.value)}
                              required
                            />
                            <button type="submit" className="comment-send-btn">
                              <Plus size={16} />
                            </button>
                          </form>
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </main>
          </div>
        </>
      )}

      {/* App Footer */}
      <footer className="app-footer">
        <p>ShivBlogs &copy; 2026. Made with <span className="footer-heart">❤️</span> and React.</p>
      </footer>
    </div>
  );
}

export default App;
