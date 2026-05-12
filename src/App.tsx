import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useParams, Navigate, useLocation } from 'react-router-dom';
import { 
  Play, 
  Lock, 
  Unlock, 
  CreditCard, 
  Users, 
  BarChart3, 
  LogOut, 
  Menu, 
  X, 
  Maximize,
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  CheckCircle2, 
  XCircle,
  Shield,
  Copy,
  User as UserIcon,
  Phone,
  Home as HomeIcon,
  Plus,
  Info,
  Film,
  Tv,
  Search,
  Folder,
  MessageSquare,
  Settings,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Key,
  Bell,
  RotateCcw,
  RefreshCw,
  Trash2,
  History,
  ImageIcon,
  Pencil,
  Volume2,
  VolumeX,
  Globe,
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  UserX,
  UserCheck,
  ExternalLink,
  Box,
  Upload,
  CreditCard as PaymentIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { User, Series, Season, Episode, PaymentRequest, Stat, PinResetRequest } from './types';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Auth Context ---
interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  stopImpersonation: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('bmtv_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('bmtv_token'));

  const login = (newToken: string, newUser: User, isAdminImpersonating?: boolean) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('bmtv_token', newToken);
    localStorage.setItem('bmtv_user', JSON.stringify(newUser));
  };

  const stopImpersonation = () => {
    const adminToken = localStorage.getItem('bmtv_admin_token');
    const adminUser = localStorage.getItem('bmtv_admin_user');
    
    if (adminToken && adminUser) {
      setToken(adminToken);
      setUser(JSON.parse(adminUser));
      localStorage.setItem('bmtv_token', adminToken);
      localStorage.setItem('bmtv_user', adminUser);
      localStorage.removeItem('bmtv_admin_token');
      localStorage.removeItem('bmtv_admin_user');
      window.location.href = '/admin';
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('bmtv_token');
    localStorage.removeItem('bmtv_user');
    localStorage.removeItem('bmtv_admin_token');
    localStorage.removeItem('bmtv_admin_user');
    sessionStorage.clear();
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, stopImpersonation }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// --- Settings Context ---
interface SettingsContextType {
  settings: Record<string, string>;
  isMaintenance: boolean;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('bmtv_settings');
    return saved ? JSON.parse(saved) : {};
  });
  const [isMaintenance, setIsMaintenance] = useState(() => {
    return localStorage.getItem('bmtv_is_maintenance') === 'true';
  });
  const [loading, setLoading] = useState(!localStorage.getItem('bmtv_settings'));

  const refreshSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json() as any;
      setSettings(data);
      setIsMaintenance(data.app_maintenance_mode === 'true');
      localStorage.setItem('bmtv_settings', JSON.stringify(data));
      localStorage.setItem('bmtv_is_maintenance', data.app_maintenance_mode === 'true' ? 'true' : 'false');
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, isMaintenance, loading, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
};

// --- Protection ---
const useProtection = () => {
  const { settings, isMaintenance, loading } = useSettings();

  useEffect(() => {
    if (loading) return;
    const isRightClickDisabled = settings.security_right_click_disabled !== 'false';
    const isTextSelectionDisabled = settings.security_text_selection_disabled !== 'false';
    const isDevToolsDisabled = settings.security_dev_tools_disabled !== 'false';
    const isExternalLinksDisabled = settings.security_external_links_disabled !== 'false';

    const handleContextMenu = (e: Event) => {
      // Allow context menu for everyone to see native download buttons etc
    };

    const handleSelectStart = (e: Event) => {
      if (isTextSelectionDisabled) {
        e.preventDefault();
        return false;
      }
    };

    const handleDragStart = (e: Event) => {
      if (isTextSelectionDisabled) {
        e.preventDefault();
        return false;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isDevToolsDisabled) return;
      if (
        (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'u' || e.key === 's' || e.key === 'p' || e.key === 'i' || e.key === 'j')) ||
        e.key === 'F12' ||
        (e.metaKey && (e.key === 'c' || e.key === 'v' || e.key === 'u' || e.key === 's' || e.key === 'p' || e.key === 'i' || e.key === 'j'))
      ) {
        e.preventDefault();
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (!isExternalLinksDisabled) return;
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (anchor) {
        const href = anchor.getAttribute('href');
        if (href && (href.startsWith('http') || href.startsWith('//')) && !href.includes(window.location.host)) {
          e.preventDefault();
        }
      }
    };

    let touchTimeout: any;
    const handleTouchStart = (e: TouchEvent) => {
      touchTimeout = setTimeout(() => {}, 500);
    };
    const handleTouchEnd = () => {
      clearTimeout(touchTimeout);
    };

    window.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('selectstart', handleSelectStart, true);
    window.addEventListener('dragstart', handleDragStart, true);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('click', handleClick, true);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu, true);
      window.removeEventListener('selectstart', handleSelectStart, true);
      window.removeEventListener('dragstart', handleDragStart, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('click', handleClick, true);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [settings]);

  return { settings, isMaintenance };
};

// --- Components ---

const Navbar = () => {
  const { user, logout, stopImpersonation } = useAuth();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const isAdminImpersonating = !!localStorage.getItem('bmtv_admin_token');

  return (
    <div className="flex flex-col">
      <nav className="bg-black/95 backdrop-blur-md border-b border-white/5 py-3 px-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2 leading-none">
            {settings.app_logo_url ? (
              <img src={settings.app_logo_url} alt="Logo" className="h-8 w-auto object-contain" />
            ) : (
              <div className="flex flex-col leading-none">
                <div className="text-2xl font-black italic tracking-tighter flex gap-1">
                  <span className="text-[#FFD700]">MANDEN</span>
                  <span className="text-[#FF0000]">TSERIE</span>
                </div>
                <span className="text-[6px] text-white/60 font-bold tracking-[0.2em] uppercase">{settings.app_description || 'Manden Tserie streaming'}</span>
              </div>
            )}
          </Link>
        </div>
        <div className="flex items-center gap-4">
          {isAdminImpersonating && (
            <button 
              onClick={stopImpersonation}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg animate-pulse"
            >
              <RotateCcw size={14} />
              Quitter le mode test
            </button>
          )}
          {(user?.role === 'admin' || user?.role === 'owner') && (
            <Link to="/admin" className="text-orange-500 hover:scale-110 transition-transform">
              <Shield size={20} />
            </Link>
          )}
          {user && (
            <button 
              onClick={() => { logout(); navigate('/login'); }}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <LogOut size={20} />
            </button>
          )}
        </div>
      </nav>
    </div>
  );
};

// --- Pages ---

const Home = () => {
  const [series, setSeries] = useState<Series[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const { settings } = useSettings();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isBannerMuted, setIsBannerMuted] = useState(true);

  const fetchData = async () => {
    try {
      const responses = await Promise.all([
        fetch('/api/series', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('bmtv_token')}` }
        }),
        fetch('/api/banners')
      ]);

      for (const res of responses) {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: "Unknown error" })) as any;
          throw new Error(errorData.error || errorData.message || `HTTP error! status: ${res.status}`);
        }
      }

      const [seriesRes, bannersRes] = responses;
      const seriesData = await seriesRes.json() as any;
      const bannersData = await bannersRes.json() as any;
      setSeries(Array.isArray(seriesData) ? seriesData : []);
      setBanners(Array.isArray(bannersData) ? bannersData : []);
    } catch (e: any) {
      console.error("Error fetching home data:", e);
      setError(e.message || "Une erreur est survenue lors du chargement des données.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">Chargement...</div>;

  if (error) return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white p-6 text-center">
      <AlertCircle size={48} className="text-red-500 mb-4" />
      <h1 className="text-xl font-bold mb-2">Erreur de chargement</h1>
      <p className="text-gray-400 max-w-md mb-6">{error}</p>
      <button 
        onClick={() => { setError(null); setLoading(true); fetchData(); }}
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold transition-all"
      >
        Réessayer
      </button>
    </div>
  );

  const filteredSeries = series.filter(s => s.titre.toLowerCase().includes(search.toLowerCase()));

  const renderHomeBanner = () => {
    if (settings.banner_home_video) {
      const trimmed = settings.banner_home_video.trim();
      let embedUrl = trimmed;
      const ytMatch = trimmed.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
      if (ytMatch) {
        embedUrl = `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1&mute=${isBannerMuted ? 1 : 0}&loop=1&playlist=${ytMatch[1]}&rel=0&modestbranding=1&showinfo=0&controls=0`;
        return (
          <div className="absolute inset-0 pointer-events-none">
            <iframe
              src={embedUrl}
              className="w-full h-full border-none scale-150"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            />
          </div>
        );
      } else if (trimmed.endsWith('.mp4')) {
        return (
          <video 
            src={trimmed} 
            autoPlay 
            muted={isBannerMuted}
            loop 
            playsInline 
            className="absolute inset-0 w-full h-full object-cover"
          />
        );
      }
    }

    const homeImage = settings.banner_home_image || (banners.length > 0 ? banners[0].image : null);
    if (homeImage) {
      return (
        <img 
          src={homeImage} 
          alt="Banner" 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          draggable="false"
          onContextMenu={(e) => e.preventDefault()}
        />
      );
    }

    return (
      <div className="relative z-10 text-center scale-100">
        {settings.app_logo_url ? (
          <img src={settings.app_logo_url} alt="Logo" className="h-16 w-auto mx-auto mb-2" />
        ) : (
          <>
            <div className="text-5xl font-black text-white flex items-center justify-center gap-2 mb-1 italic tracking-tighter">
              <span className="text-[#FFD700]">MANDEN</span>
              <span className="text-[#FF0000]">TSERIE</span>
            </div>
            <div className="text-[8px] font-black tracking-[0.4em] text-white/80 uppercase">{settings.app_description || 'Manden Tserie streaming'}</div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-24 select-none">
      {/* Info Bar */}
      {settings.info_bar_text && (
        <div className="bg-emerald-600/90 backdrop-blur-sm py-2 px-4 text-center border-b border-white/10 sticky top-0 z-[60]">
          <p className="text-[10px] font-black uppercase tracking-widest text-white flex items-center justify-center gap-2">
            <span className="bg-white text-emerald-600 px-1.5 py-0.5 rounded font-black">INFO:</span>
            {settings.info_bar_text}
          </p>
        </div>
      )}

      {/* Dynamic Banner Section */}
      <div className="relative aspect-video w-full bg-black overflow-hidden group">
        <div className="w-full h-full relative">
          {renderHomeBanner()}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/80" />
          
          {/* Mute Toggle Button */}
          {(settings.banner_home_video) && (
            <button 
              onClick={() => setIsBannerMuted(!isBannerMuted)}
              className="absolute top-4 right-4 z-20 bg-black/40 hover:bg-black/60 p-2 rounded-full border border-white/10 transition-all"
            >
              {isBannerMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          )}

          {banners.length > 0 && banners[0].id_serie && (
            <div className="absolute bottom-10 left-6 right-6 z-10">
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2 drop-shadow-lg">{banners[0].titre}</h2>
              <Link 
                to={`/series/${banners[0].id_serie}`}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-red-600/20"
              >
                <Play size={14} fill="currentColor" />
                Regarder maintenant
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-6 space-y-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
          <input 
            type="text"
            placeholder="Rechercher une série..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-zinc-800 rounded-full py-3 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500 transition-all"
          />
        </div>

        <section>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1 h-6 bg-blue-500 rounded-full" />
            <h2 className="text-xl font-bold">Séries disponibles</h2>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            {filteredSeries.map((s) => (
              <Link 
                key={s.id} 
                to={`/series/${s.id}`}
                className="flex flex-col group"
              >
                <div className="aspect-[2/3] rounded-lg overflow-hidden bg-zinc-900 border border-white/10 relative shadow-lg">
                  <img 
                    src={s.image} 
                    alt={s.titre}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                    draggable="false"
                    onContextMenu={(e) => e.preventDefault()}
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-[#00bcd4] py-1.5 px-1 border-t border-white/20">
                    <h3 className="text-[8px] font-black text-white text-center truncate uppercase leading-tight">
                      {s.titre}
                    </h3>
                  </div>
                </div>
                <div className="mt-2 px-1">
                  <h4 className="text-[10px] font-bold text-gray-200 truncate uppercase tracking-tight">
                    {s.titre}
                  </h4>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <BottomNav />
    </div>
  );
};

const BottomNav = () => {
  const { user } = useAuth();
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a] border-t border-white/5 flex justify-around items-center py-3 px-4 z-50">
      <Link to="/" className={cn("flex flex-col items-center gap-1 transition-colors", isActive('/') ? "text-[#2196f3]" : "text-gray-500")}>
        <HomeIcon size={22} />
        <span className="text-[10px] font-bold">Accueil</span>
      </Link>
      <Link to={user ? "/my-files" : "/login"} className={cn("flex flex-col items-center gap-1 transition-colors", isActive('/my-files') ? "text-[#2196f3]" : "text-gray-500")}>
        <Folder size={22} />
        <span className="text-[10px] font-bold">Mes fichiers</span>
      </Link>
      <div className="flex flex-col items-center gap-1 text-gray-500 relative">
        <MessageSquare size={22} />
        <span className="text-[10px] font-bold">Messages</span>
        <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-[#0a0a0a]">1</span>
      </div>
      <Link to={user ? "/profile" : "/login"} className={cn("flex flex-col items-center gap-1 transition-colors", isActive('/profile') ? "text-[#2196f3]" : "text-gray-500")}>
        <UserIcon size={22} />
        <span className="text-[10px] font-bold">Moi</span>
      </Link>
    </div>
  );
};

const TutorialModal = ({ videoUrl, onComplete }: { videoUrl: string, onComplete: () => void }) => {
  const isYoutube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
  
  let embedUrl = videoUrl;
  if (isYoutube) {
    const ytMatch = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    if (ytMatch) {
      embedUrl = `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1&rel=0&modestbranding=1&controls=1`;
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black p-4">
      <div className="w-full h-full max-w-4xl flex flex-col justify-center">
        <div className="mb-6 text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-red-600/10 border border-red-600/20 px-3 py-1 rounded-full mb-2">
            <Play size={10} className="text-red-500 fill-current" />
            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Tutoriel Obligatoire</span>
          </div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">Comment utiliser l'app ?</h2>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-[0.2em]">
            Vidéo à regarder une fois par mois pour accéder au contenu
          </p>
        </div>
        
        <div className="bg-zinc-900 rounded-[2rem] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] relative border-4 border-white/5 mx-auto w-fit max-w-full">
          {isYoutube ? (
            <div className="aspect-video w-[800px] max-w-[calc(100vw-3rem)]">
              <iframe
                src={embedUrl}
                className="w-full h-full border-none"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              />
            </div>
          ) : (
            <video 
              src={videoUrl} 
              controls 
              autoPlay
              className="max-h-[60vh] md:max-h-[70vh] w-auto mx-auto block"
            />
          )}
        </div>
        
        <div className="mt-8 flex flex-col items-center gap-4">
          <button 
            onClick={onComplete}
            className="w-full max-w-sm bg-white text-black py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-2xl hover:bg-gray-200 active:scale-95 flex items-center justify-center gap-3"
          >
            J'ai fini de regarder, aller à l'accueil
            <ChevronRight size={16} />
          </button>
          <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Manden Tserie &copy; 2026</p>
        </div>
      </div>
    </div>
  );
};

const MyFiles = () => {
  const { user, token } = useAuth();
  const [purchasedContent, setPurchasedContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetch('/api/user/purchased-content', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then((data: any) => {
        if (Array.isArray(data)) {
          setPurchasedContent(data);
        } else {
          setPurchasedContent([]);
        }
        setLoading(false);
      })
      .catch(() => {
        setPurchasedContent([]);
        setLoading(false);
      });
  }, [user, token]);

  if (!user) return <Navigate to="/login" />;
  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-[#2196f3] border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 font-bold text-sm">Chargement de vos fichiers...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-32 select-none">
      <div className="px-6 py-8">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#2196f3]/20 rounded-2xl flex items-center justify-center border border-[#2196f3]/30 shadow-lg shadow-blue-500/10">
              <Folder size={28} className="text-[#2196f3]" />
            </div>
            <h1 className="text-3xl font-black tracking-tighter uppercase">Mes fichiers</h1>
          </div>
          <div className="bg-zinc-900/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/5 shadow-xl">
            <span className="text-[11px] font-black text-gray-300 uppercase tracking-[0.2em]">
              {purchasedContent.length} {purchasedContent.length > 1 ? 'Saisons' : 'Saison'}
            </span>
          </div>
        </div>

        {purchasedContent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
            <div className="w-24 h-24 bg-zinc-900/50 rounded-3xl flex items-center justify-center border border-white/5 shadow-2xl">
              <Folder size={40} className="text-gray-700" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black tracking-tight">Aucun fichier trouvé</h3>
              <p className="text-gray-500 text-sm max-w-[240px] mx-auto leading-relaxed">
                Vos saisons achetées et validées apparaîtront ici.
              </p>
            </div>
            <Link 
              to="/" 
              className="bg-[#2196f3] hover:bg-blue-600 text-white px-8 py-3 rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-500/20 active:scale-95"
            >
              Découvrir des séries
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {purchasedContent.map((item, idx) => (
              <Link 
                key={`${item.id_saison}-${idx}`} 
                to={`/series/${item.id_serie}?seasonId=${item.id_saison}&purchasedOnly=true`}
                className="relative rounded-[1.5rem] overflow-hidden transition-all active:scale-[0.98] cursor-pointer shadow-xl group"
              >
                {/* Glass Background */}
                <div className="absolute inset-0 bg-[#2ecc71]/30 backdrop-blur-xl border border-white/10" />
                
                {/* Glossy Overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />

                <div className="relative p-3 md:p-4">
                  <div className="mb-2">
                    <h3 className="text-white text-[10px] md:text-xs font-black uppercase tracking-tight leading-tight">
                      {item.titre_saison || `SAISON ${item.numero_saison}: ÉPISODE 01 A ${item.total_episodes || '?'}`}
                    </h3>
                    <p className="text-white text-base md:text-lg font-black uppercase tracking-tighter">
                      {item.titre_serie}
                    </p>
                  </div>
                  
                  <div className="flex gap-3 items-center">
                    {/* Poster */}
                    <div className="w-16 md:w-20 aspect-[2/3] rounded-lg overflow-hidden shadow-2xl flex-none relative">
                      <img 
                        src={item.image_serie} 
                        alt={item.titre_serie}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    {/* Action Button */}
                    <div className="flex-1 flex flex-col items-center justify-center pl-2">
                      {/* Price above button */}
                      <div className="mb-1 flex items-center gap-1">
                        <span className="text-[#ff9f43] text-xs font-black">{Number(item.prix_saison || 0).toLocaleString('en-US')}</span>
                        <span className="text-[#ff9f43]/70 text-[8px] font-bold">GNF</span>
                      </div>

                      <div className="w-full max-w-[160px] py-2 md:py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg backdrop-blur-md border border-white/10 bg-white/10 relative">
                        <span className="text-white text-[9px] md:text-[10px] font-black uppercase tracking-tighter text-center leading-tight px-2">
                          DÉJÀ ACHETÉ
                        </span>
                        <ChevronRight size={14} className="text-white/30 absolute right-2" />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

const Profile = () => {
  const { user, token, login, logout } = useAuth();
  const navigate = useNavigate();
  const [pinData, setPinData] = useState({ ancien_pin: '', nouveau_pin: '', confirmer_pin: '' });
  const [resetData, setResetData] = useState({ nouveau_pin: '', confirmer_pin: '' });
  const [profileData, setProfileData] = useState({ 
    prenom: user?.prenom || '', 
    nom: user?.nom || '', 
    telephone: user?.telephone ? user.telephone.slice(-9) : '' 
  });
  const [profilePrefix, setProfilePrefix] = useState(user?.telephone ? user.telephone.slice(0, -9) : '+224');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [pinRequest, setPinRequest] = useState<PinResetRequest | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then((data: any) => setSettings(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      setProfileData({
        prenom: user.prenom || '',
        nom: user.nom || '',
        telephone: user.telephone ? user.telephone.slice(-9) : ''
      });
      setProfilePrefix(user.telephone ? user.telephone.slice(0, -9) : '+224');
    }
  }, [user]);

  useEffect(() => {
    if (user && token) {
      fetch('/api/user/pin-request', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then((data: any) => {
          if (data && !data.error) setPinRequest(data);
        });
    }
  }, [user, token]);

  if (!user) return <Navigate to="/login" />;

  const canUpdateProfile = () => {
    if (!user?.last_profile_update) return true;
    const limitDays = Number(settings.app_profile_update_limit) || 30;
    const limitInMs = limitDays * 24 * 60 * 60 * 1000;
    const now = new Date().getTime();
    const lastUpdateTime = new Date(user.last_profile_update).getTime();
    return (now - lastUpdateTime >= limitInMs);
  };

  const getRemainingDays = () => {
    if (!user?.last_profile_update) return 0;
    const limitDays = Number(settings.app_profile_update_limit) || 30;
    const limitInMs = limitDays * 24 * 60 * 60 * 1000;
    const now = new Date().getTime();
    const lastUpdateTime = new Date(user.last_profile_update).getTime();
    return Math.ceil((limitInMs - (now - lastUpdateTime)) / (24 * 60 * 60 * 1000));
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profileData.telephone.length !== 9) {
      setError("Le numéro de téléphone doit comporter exactement 9 chiffres.");
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);

    const finalTelephone = profilePrefix + profileData.telephone;

    try {
      const res = await fetch('/api/user/profile/update', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...profileData, telephone: finalTelephone })
      });
      const data = await res.json() as any;
      if (res.ok) {
        setSuccess("Profil mis à jour avec succès !");
        setIsEditingProfile(false);
        login(token!, data.user);
      } else {
        setError(data.error || "Une erreur est survenue");
      }
    } catch (err) {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (pinData.nouveau_pin !== pinData.confirmer_pin) {
      setError("Les nouveaux PIN ne correspondent pas.");
      setLoading(false);
      return;
    }

    if (pinData.nouveau_pin.length !== 4) {
      setError("Le PIN doit comporter 4 chiffres.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/user/change-pin', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ancien_pin: pinData.ancien_pin,
          nouveau_pin: pinData.nouveau_pin
        })
      });
      const data = await res.json() as any;
      if (res.ok) {
        setSuccess("PIN mis à jour avec succès !");
        setPinData({ ancien_pin: '', nouveau_pin: '', confirmer_pin: '' });
      } else {
        setError(data.error || "Une erreur est survenue");
      }
    } catch (err) {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await fetch('/api/user/pin-requests/request', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json() as any;
      if (res.ok) {
        setPinRequest(data);
        setSuccess("Demande de réinitialisation envoyée à l'administrateur.");
      } else {
        setError(data.error || "Une erreur est survenue");
      }
    } catch (err) {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (resetData.nouveau_pin !== resetData.confirmer_pin) {
      setError("Les codes PIN ne correspondent pas.");
      setLoading(false);
      return;
    }

    if (resetData.nouveau_pin.length !== 4) {
      setError("Le PIN doit comporter 4 chiffres.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/user/pin-requests/complete', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ nouveau_pin: resetData.nouveau_pin })
      });
      const data = await res.json() as any;
      if (res.ok) {
        setSuccess("Nouveau PIN configuré avec succès !");
        setPinRequest(null);
        setResetData({ nouveau_pin: '', confirmer_pin: '' });
      } else {
        setError(data.error || "Une erreur est survenue");
      }
    } catch (err) {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-32 select-none">
      {/* Header */}
      <div className="px-6 py-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-[#2196f3] text-3xl font-black italic tracking-tighter">MANDEN TSERIE</h1>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight">{user.prenom} {user.nom}</h2>
            <p className="text-gray-500 font-bold text-sm">{user.telephone}</p>
          </div>
          <button 
            onClick={() => { logout(); navigate('/login'); }}
            className="flex items-center gap-2 text-red-500 font-bold text-sm hover:opacity-80 transition-opacity"
          >
            <LogOut size={18} className="rotate-180" />
            <span>Quitter</span>
          </button>
        </div>

        {(user.role === 'admin' || user.role === 'owner') && (
          <Link 
            to="/admin" 
            className="bg-indigo-950/30 border border-indigo-500/20 p-4 rounded-xl flex items-center gap-3 text-indigo-400 hover:bg-indigo-950/50 transition-all"
          >
            <Shield size={20} />
            <span className="font-bold text-sm">Tableau de bord Admin</span>
          </Link>
        )}

        {/* Profile Info Card */}
        <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-white/5 shadow-xl">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <UserIcon size={24} className="text-[#2196f3]" />
              <h3 className="text-xl font-black tracking-tight">Mon Profil</h3>
            </div>
            {!isEditingProfile && (
              <button 
                onClick={() => {
                  if (canUpdateProfile()) {
                    setIsEditingProfile(true);
                  } else {
                    setError(`Vous ne pouvez modifier votre profil qu'une fois tous les ${settings.app_profile_update_limit || 30} jours. Veuillez patienter encore ${getRemainingDays()} jours.`);
                    setTimeout(() => setError(''), 5000);
                  }
                }}
                className={`p-2 rounded-lg transition-all ${canUpdateProfile() ? 'bg-white/5 hover:bg-white/10 text-gray-400' : 'bg-orange-500/10 text-orange-500 cursor-not-allowed'}`}
              >
                {canUpdateProfile() ? <Pencil size={18} /> : <Lock size={18} />}
              </button>
            )}
          </div>

          {isEditingProfile ? (
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-300 ml-1">Prénom</label>
                <input 
                  type="text"
                  value={profileData.prenom}
                  onChange={e => setProfileData({ ...profileData, prenom: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-white/5 rounded-xl px-4 py-4 text-white font-bold focus:border-[#2196f3] transition-all"
                  placeholder="Votre prénom"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-300 ml-1">Nom</label>
                <input 
                  type="text"
                  value={profileData.nom}
                  onChange={e => setProfileData({ ...profileData, nom: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-white/5 rounded-xl px-4 py-4 text-white font-bold focus:border-[#2196f3] transition-all"
                  placeholder="Votre nom"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-300 ml-1">Numéro de téléphone</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={profilePrefix}
                    onChange={e => setProfilePrefix(e.target.value.startsWith('+') ? e.target.value : '+' + e.target.value.replace('+', ''))}
                    className="w-20 shrink-0 bg-[#0a0a0a] border border-white/5 rounded-xl px-2 py-4 text-white text-center font-bold focus:border-[#2196f3] transition-all"
                  />
                  <input 
                    type="tel" 
                    required
                    maxLength={9}
                    value={profileData.telephone}
                    onChange={e => setProfileData({ ...profileData, telephone: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                    className="flex-1 bg-[#0a0a0a] border border-white/5 rounded-xl px-4 py-4 text-white font-bold focus:border-[#2196f3] transition-all"
                    placeholder="6XX XX XX XX"
                  />
                </div>
              </div>

              {!canUpdateProfile() && (
                <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl">
                  <p className="text-orange-500 text-[10px] font-black uppercase tracking-widest text-center">
                    Modification bloquée : Patientez encore {getRemainingDays()} jours
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-4 rounded-xl font-black transition-all"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  disabled={loading || !canUpdateProfile()}
                  className="flex-1 bg-[#2196f3] hover:bg-blue-600 disabled:opacity-50 text-white py-4 rounded-xl font-black transition-all shadow-lg shadow-blue-500/10"
                >
                  {loading ? "Chargement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {!canUpdateProfile() && (
                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex items-center gap-3">
                  <Info size={18} className="text-[#2196f3] shrink-0" />
                  <p className="text-[#2196f3] text-[10px] font-bold uppercase tracking-wider">
                    Prochaine modification possible dans {getRemainingDays()} jours
                  </p>
                </div>
              )}
              <div className="flex items-center gap-4 bg-black/20 p-4 rounded-xl border border-white/5">
                <div className="w-12 h-12 bg-[#2196f3]/10 rounded-full flex items-center justify-center text-[#2196f3]">
                  <UserIcon size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Nom complet</p>
                  <p className="font-bold text-white">{user.prenom} {user.nom}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 bg-black/20 p-4 rounded-xl border border-white/5">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500">
                  <Smartphone size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Téléphone</p>
                  <p className="font-bold text-white">{user.telephone}</p>
                </div>
              </div>
              {user.last_profile_update && (
                <p className="text-[9px] text-gray-600 italic text-center">
                  Dernière modification le {new Date(user.last_profile_update).toLocaleDateString()}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Change PIN Card */}
        <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-white/5 shadow-xl">
          <div className="flex items-center gap-3 mb-8">
            <Key size={24} className="text-indigo-500" />
            <h3 className="text-xl font-black tracking-tight">Changer le PIN</h3>
          </div>

          <form onSubmit={handleUpdatePin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-300 ml-1">Ancien PIN</label>
              <input 
                type="password"
                maxLength={4}
                value={pinData.ancien_pin}
                onChange={e => setPinData({ ...pinData, ancien_pin: e.target.value.replace(/\D/g, '') })}
                className="w-full bg-[#0a0a0a] border border-white/5 rounded-xl px-4 py-4 text-white tracking-[1.5em] text-center text-xl font-black focus:border-[#2196f3] transition-all"
                placeholder="••••"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-300 ml-1">Nouveau PIN</label>
              <input 
                type="password"
                maxLength={4}
                value={pinData.nouveau_pin}
                onChange={e => setPinData({ ...pinData, nouveau_pin: e.target.value.replace(/\D/g, '') })}
                className="w-full bg-[#0a0a0a] border border-white/5 rounded-xl px-4 py-4 text-white tracking-[1.5em] text-center text-xl font-black focus:border-[#2196f3] transition-all"
                placeholder="••••"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-300 ml-1">Confirmer le nouveau PIN</label>
              <input 
                type="password"
                maxLength={4}
                value={pinData.confirmer_pin}
                onChange={e => setPinData({ ...pinData, confirmer_pin: e.target.value.replace(/\D/g, '') })}
                className="w-full bg-[#0a0a0a] border border-white/5 rounded-xl px-4 py-4 text-white tracking-[1.5em] text-center text-xl font-black focus:border-[#2196f3] transition-all"
                placeholder="••••"
              />
            </div>

            {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}
            {success && <p className="text-emerald-500 text-xs font-bold text-center">{success}</p>}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-[#4c4cfc] hover:bg-blue-600 disabled:opacity-50 text-white py-4 rounded-xl font-black transition-all shadow-lg shadow-blue-500/10 active:scale-[0.98]"
            >
              {loading ? "Chargement..." : "Changer le PIN"}
            </button>
          </form>
        </div>

        {/* Forgot PIN Card */}
        <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-white/5 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <RotateCcw size={24} className="text-orange-500" />
            <h3 className="text-xl font-black tracking-tight">PIN oublié ?</h3>
          </div>
          
          {pinRequest?.statut === 'approved' ? (
            <div className="space-y-6">
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
                <p className="text-emerald-500 text-xs font-bold text-center">
                  Votre demande a été approuvée ! Veuillez définir votre nouveau PIN.
                </p>
              </div>
              
              <form onSubmit={handleSetNewPin} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-300 ml-1">Nouveau PIN</label>
                  <input 
                    type="password"
                    maxLength={4}
                    value={resetData.nouveau_pin}
                    onChange={e => setResetData({ ...resetData, nouveau_pin: e.target.value.replace(/\D/g, '') })}
                    className="w-full bg-[#0a0a0a] border border-white/5 rounded-xl px-4 py-4 text-white tracking-[1.5em] text-center text-xl font-black focus:border-[#2196f3] transition-all"
                    placeholder="••••"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-300 ml-1">Confirmer le nouveau PIN</label>
                  <input 
                    type="password"
                    maxLength={4}
                    value={resetData.confirmer_pin}
                    onChange={e => setResetData({ ...resetData, confirmer_pin: e.target.value.replace(/\D/g, '') })}
                    className="w-full bg-[#0a0a0a] border border-white/5 rounded-xl px-4 py-4 text-white tracking-[1.5em] text-center text-xl font-black focus:border-[#2196f3] transition-all"
                    placeholder="••••"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-4 rounded-xl font-black transition-all shadow-lg shadow-emerald-500/10 active:scale-[0.98]"
                >
                  {loading ? "Chargement..." : "Valider le nouveau PIN"}
                </button>
              </form>
            </div>
          ) : pinRequest?.statut === 'pending' ? (
            <div className="bg-orange-500/10 border border-orange-500/20 p-6 rounded-xl text-center">
              <p className="text-orange-500 text-sm font-bold mb-2">Demande en attente</p>
              <p className="text-gray-400 text-xs">L'administrateur examine votre demande de réinitialisation.</p>
            </div>
          ) : (
            <>
              <p className="text-gray-400 text-sm leading-relaxed mb-8">
                Si vous avez oublié votre PIN, vous pouvez soumettre une demande de réinitialisation. L'administrateur examinera votre demande.
              </p>

              <button 
                onClick={handleRequestReset}
                disabled={loading}
                className="w-full border border-white/10 hover:bg-white/5 disabled:opacity-50 text-white py-4 rounded-xl font-black transition-all"
              >
                {loading ? "Envoi..." : "Soumettre une demande"}
              </button>
            </>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

const SeriesDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const purchasedOnlyParam = searchParams.get('purchasedOnly') === 'true';
  const initialSeasonId = searchParams.get('seasonId');
  
  const { token, user } = useAuth();
  const [series, setSeries] = useState<Series | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchasedOnly, setPurchasedOnly] = useState(purchasedOnlyParam);
  const [expandedSeasonId, setExpandedSeasonId] = useState<number | null>(null);
  const [seasonEpisodes, setSeasonEpisodes] = useState<Record<number, Episode[]>>({});
  const [loadingEpisodes, setLoadingEpisodes] = useState<Record<number, boolean>>({});
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [requestError, setRequestError] = useState('');
  const [paymentStep, setPaymentStep] = useState(1); // 1: instructions, 2: verification
  const [paymentInfo, setPaymentInfo] = useState({ nom_utilisateur: '', numero_paiement: '', solde_apres_paiement: '' });
  const [activeEpisode, setActiveEpisode] = useState<{ id: number, title: string } | null>(null);
  const [view, setView] = useState<'seasons' | 'episodes'>(() => {
    const params = new URLSearchParams(window.location.hash.replace('#', ''));
    return params.get('view') === 'episodes' ? 'episodes' : 'seasons';
  });
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(() => {
    const params = new URLSearchParams(window.location.hash.replace('#', ''));
    const sid = params.get('seasonId');
    return sid ? Number(sid) : null;
  });

  // Handle initial view state from hash once series data is available
  useEffect(() => {
    const params = new URLSearchParams(location.hash.replace('#', ''));
    const hv = params.get('view');
    const hsid = params.get('seasonId');
    
    if (hv === 'episodes' && hsid) {
      if (view !== 'episodes') setView('episodes');
      const numericHsid = Number(hsid);
      if (selectedSeasonId !== numericHsid) setSelectedSeasonId(numericHsid);
    } else {
      if (view !== 'seasons') setView('seasons');
      if (selectedSeasonId !== null) setSelectedSeasonId(null);
    }
  }, [location.hash]);

  useEffect(() => {
    if (series?.saisons && selectedSeasonId && (!selectedSeason || selectedSeason.id !== selectedSeasonId)) {
      const season = series.saisons.find(s => s.id === selectedSeasonId);
      if (season) {
        setSelectedSeason(season);
        if (!seasonEpisodes[season.id]) fetchEpisodes(season.id);
      }
    }
  }, [series, selectedSeasonId, selectedSeason, seasonEpisodes]);

  const changeView = (newView: 'seasons' | 'episodes', seasonId?: number) => {
    if (newView === 'seasons') {
      navigate(location.pathname + location.search, { replace: true });
    } else {
      navigate(`#view=episodes&seasonId=${seasonId}`, { replace: false });
    }
  };

  const [userPurchases, setUserPurchases] = useState<number[]>([]);
  const [userPaymentRequests, setUserPaymentRequests] = useState<any[]>([]);
  const { settings } = useSettings();

  useEffect(() => {
    if (showPaymentModal) {
      window.history.pushState({ modal: 'payment-modal' }, '');
      const handlePopState = (e: PopStateEvent) => {
        // If the user presses the back button, close the modal
        setShowPaymentModal(false);
      };
      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
        if (window.history.state?.modal === 'payment-modal') {
          window.history.back();
        }
      };
    }
  }, [showPaymentModal]);

  useEffect(() => {
    if (user) {
      setPaymentInfo(prev => ({ ...prev, nom_utilisateur: `${user.prenom} ${user.nom}` }));
    }
  }, [user]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const headers = { 'Authorization': `Bearer ${token}` };
        const promises = [
          fetch(`/api/series/${id}`, { headers }).then(res => res.json()),
          user ? fetch('/api/user/purchases', { headers }).then(res => res.json()) : Promise.resolve([]),
          user ? fetch('/api/user/payment-requests', { headers }).then(res => res.json()) : Promise.resolve([])
        ];

        const [seriesData, purchasesData, requestsData] = await Promise.all(promises) as [any, any, any];

        if (seriesData.error) throw new Error(seriesData.error);
        
        setSeries(seriesData as Series);
        setUserPurchases(Array.isArray(purchasesData) ? purchasesData : []);
        setUserPaymentRequests(Array.isArray(requestsData) ? requestsData : []);

        // Handle initial season selection if provided in URL
        if (initialSeasonId && seriesData.saisons) {
          const season = (seriesData.saisons as any[]).find((s: any) => s.id === Number(initialSeasonId));
          if (season) {
            setSelectedSeason(season);
            setView('episodes');
            fetchEpisodes(season.id);
          }
        }
      } catch (err: any) {
        console.error("Error fetching series data:", err);
        setError(err.message || "Erreur lors du chargement des données");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, user, token, initialSeasonId]);

  const isSeasonPurchased = (seasonId: number) => userPurchases.includes(seasonId);
  
  const getPurchaseButtonText = (seasonId: number) => {
    const request = userPaymentRequests.find(r => r.id_saison === seasonId && r.statut === 'pending');
    if (request) {
      return "Achat envoyé. Validation en cours.";
    }
    return "ACHETER";
  };

  const toggleSeason = (seasonId: number) => {
    const season = series?.saisons?.find(s => s.id === seasonId);
    if (season) {
      setSelectedSeason(season);
      changeView('episodes', seasonId);
      if (!seasonEpisodes[seasonId]) {
        fetchEpisodes(seasonId);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const fetchEpisodes = (seasonId: number) => {
    setLoadingEpisodes(prev => ({ ...prev, [seasonId]: true }));
    fetch(`/api/seasons/${seasonId}/episodes`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then((data: any) => {
        if (Array.isArray(data)) {
          setSeasonEpisodes(prev => ({ ...prev, [seasonId]: data as Episode[] }));
        } else {
          setSeasonEpisodes(prev => ({ ...prev, [seasonId]: [] }));
        }
        setLoadingEpisodes(prev => ({ ...prev, [seasonId]: false }));
      })
      .catch(() => {
        setSeasonEpisodes(prev => ({ ...prev, [seasonId]: [] }));
        setLoadingEpisodes(prev => ({ ...prev, [seasonId]: false }));
      });
  };

  const handlePaymentRequest = async () => {
    if (!user || !selectedSeason || !series) return;
    setIsRequesting(true);
    setRequestError('');
    try {
      const res = await fetch('/api/payments/request', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          telephone: user.telephone,
          nom_utilisateur: paymentInfo.nom_utilisateur,
          titre_serie: series.titre, 
          numero_saison: selectedSeason.numero, 
          id_saison: selectedSeason.id,
          prix: selectedSeason.prix,
          numero_paiement: paymentInfo.numero_paiement,
          solde_apres_paiement: paymentInfo.solde_apres_paiement
        })
      });
      const data = await res.json() as any;
      if (res.ok) {
        setSuccessMessage(data.message || "Demande envoyée avec succès !");
        setRequestSent(true);
        setPaymentInfo({ nom_utilisateur: '', numero_paiement: '', solde_apres_paiement: '' });
        
        // Si le paiement a été approuvé automatiquement, on rafraîchit les achats
        if (data.message && data.message.includes("débloquée")) {
          fetch('/api/user/purchases', {
            headers: { 'Authorization': `Bearer ${token}` }
          })
            .then(res => res.json())
            .then((data: any) => setUserPurchases(data));
        }

        setTimeout(() => {
          setShowPaymentModal(false);
          setPaymentStep(1);
          setRequestSent(false);
          setSuccessMessage('');
        }, 3000);
      } else {
        setRequestError(data.error || "Une erreur est survenue");
      }
    } catch (e) {
      setRequestError("Erreur de connexion au serveur");
      console.error(e);
    } finally {
      setIsRequesting(false);
    }
  };

  const SeasonCard = ({ season, isDetail = false }: { season: Season, isDetail?: boolean }) => {
    const isPurchased = isSeasonPurchased(season.id);
    const isAdmin = user && (user.role === 'admin' || user.role === 'owner');
    const isReserved = season.statut === 'reserved';
    const isDraft = season.statut === 'draft';
    const isPending = userPaymentRequests.some(r => r.id_saison === season.id && r.statut === 'pending');
    
    const [timeLeft, setTimeLeft] = useState<{d: string, h: string, m: string, s: string} | null>(null);

    useEffect(() => {
      if (season.statut !== 'reserved' || !season.date_publication) {
        setTimeLeft(null);
        return;
      }
      
      const updateTimer = () => {
        const diff = new Date(season.date_publication!).getTime() - new Date().getTime();
        if (diff <= 0) {
          setTimeLeft(null);
          return true; // Finished
        } else {
          const d = Math.floor(diff / (1000 * 60 * 60 * 24));
          const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const s = Math.floor((diff % (1000 * 60)) / 1000);
          
          const pad = (n: number) => n.toString().padStart(2, '0');
          setTimeLeft({ d: d.toString(), h: pad(h), m: pad(m), s: pad(s) });
          return false;
        }
      };

      updateTimer();
      const timer = setInterval(() => {
        if (updateTimer()) {
          clearInterval(timer);
        }
      }, 1000);
      
      return () => clearInterval(timer);
    }, [season.id, season.statut, season.date_publication]);

    let glassColor = "bg-zinc-900/60";
    let btnColor = "bg-white/10";
    let btnText = "ACHETER";
    let borderColor = "border-white/10";
    
    if (isPurchased) {
      glassColor = "bg-[#2ecc71]/30"; // Transparent Green
      btnColor = "bg-white/10";
      btnText = "DÉJÀ ACHETER";
    } else if (isPending) {
      glassColor = "bg-[#ff9f43]/30"; 
      btnColor = isDetail 
        ? "bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-xl shadow-emerald-600/20"
        : "bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 shadow-xl shadow-orange-600/20";
      btnText = "ACHAT EN ATTENTE - CLIQUEZ POUR MODIFIER";
      borderColor = "border-white/40";
    } else if (isReserved && timeLeft) {
      glassColor = "bg-blue-900/30";
      btnColor = "bg-blue-600/20 text-blue-400 cursor-not-allowed";
      btnText = "RÉSERVÉ";
      borderColor = "border-blue-500/30";
    } else {
      glassColor = "bg-[#ff9f43]/30"; // Transparent Orange
      btnColor = isDetail 
      ? "bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-xl shadow-emerald-600/20"
      : "bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 shadow-xl shadow-orange-600/20";
      btnText = "ACHETER";
    }

    const CountdownBlock = ({ value, label }: { value: string, label: string }) => (
      <div className="flex flex-col items-center">
        <div className="bg-zinc-900 border border-white/10 rounded-xl w-11 md:w-14 h-14 md:h-16 flex items-center justify-center shadow-2xl">
          <span className="text-white text-2xl md:text-3xl font-black font-mono tracking-tighter leading-none">{value}</span>
        </div>
        <span className="text-[7px] md:text-[8px] font-bold text-white/50 mt-1 uppercase tracking-widest">{label}</span>
      </div>
    );

    const handleToggle = () => {
      if (!isDetail && !isAdmin && isReserved && timeLeft) {
        toast.info(`Cette saison sera disponible dans ${timeLeft.h}h ${timeLeft.m}m ${timeLeft.s}s`);
        return;
      }
      if (!isDetail) toggleSeason(season.id);
    };

    return (
      <div 
        className={cn(
          "relative rounded-[1.5rem] overflow-hidden transition-all active:scale-[0.98] cursor-pointer shadow-2xl group",
          isDetail ? "mb-4" : "mb-3"
        )}
        onClick={handleToggle}
      >
        {/* Glass Background */}
        <div className={cn("absolute inset-0 backdrop-blur-xl border", glassColor, borderColor)} />
        
        {/* Glossy Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />

        <div className="relative p-3 md:p-4">
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-white text-[10px] md:text-xs font-black uppercase tracking-tight leading-tight">
                {season.titre || `SAISON ${season.numero}: ÉPISODE 01 A ${seasonEpisodes[season.id]?.length || '?'}`}
              </h3>
              {isAdmin && isReserved && (
                <span className="bg-orange-600/20 text-orange-500 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">Réserve</span>
              )}
              {isAdmin && season.statut === 'published' && (
                <span className="bg-emerald-600/20 text-emerald-500 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">Publié</span>
              )}
            </div>
            <p className="text-white text-base md:text-lg font-black uppercase tracking-tighter">
              {series.titre}
            </p>
          </div>
          
          <div className="flex gap-3 items-center">
            {/* Poster */}
            <div className="w-16 md:w-20 aspect-[2/3] rounded-lg overflow-hidden shadow-2xl flex-none relative">
              <img 
                src={series.image} 
                alt={series.titre}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Action Button */}
            <div className="flex-1 flex flex-col items-center justify-center pl-2">
              {isReserved && timeLeft ? (
                <div className="flex flex-col items-center">
                  <p className="text-white text-[10px] md:text-xs font-black uppercase mb-2 tracking-widest text-center shadow-sm">Disponible dans</p>
                  <div className="flex gap-1.5">
                    {parseInt(timeLeft.d) > 0 && <CountdownBlock value={timeLeft.d} label="DAYS" />}
                    <CountdownBlock value={timeLeft.h} label="HOURS" />
                    <CountdownBlock value={timeLeft.m} label="MINUTES" />
                    <CountdownBlock value={timeLeft.s} label="SECONDS" />
                  </div>
                </div>
              ) : (
                <>
                  {/* Price above button */}
                  <div className="mb-1 flex items-center gap-1">
                    <span className="text-[#ff9f43] text-xs font-black">{Number(season.prix).toLocaleString('en-US')}</span>
                    <span className="text-[#ff9f43]/70 text-[8px] font-bold">GNF</span>
                  </div>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isPurchased) return;
                      if (!isDetail) {
                        toggleSeason(season.id);
                      } else {
                        setSelectedSeason(season);
                        setShowPaymentModal(true);
                      }
                    }}
                    className={cn(
                      "w-full max-w-[160px] py-2 md:py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg backdrop-blur-md border border-white/10 relative",
                      btnColor
                    )}
                  >
                    <span className="text-white text-[9px] md:text-[10px] font-black uppercase tracking-tighter text-center leading-tight px-2">
                      {isPurchased ? "DÉJÀ ACHETÉ" : btnText}
                    </span>
                    <ChevronRight size={14} className="text-white/30 absolute right-2" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-6 animate-pulse">
        <RefreshCw className="text-gray-500 animate-spin" size={24} />
      </div>
      <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Chargement de la série...</p>
    </div>
  );

  if (error || !series) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
        <AlertCircle className="text-red-500" size={32} />
      </div>
      <h2 className="text-xl font-black mb-2 uppercase">Erreur</h2>
      <p className="text-gray-400 mb-8 max-w-xs">{error || "Série introuvable"}</p>
      <button 
        onClick={() => navigate('/')}
        className="bg-white text-black px-8 py-3 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-white/5 transition-all active:scale-95"
      >
        Retour à l'accueil
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white select-none pb-24">
      {view === 'seasons' ? (
        <>
          {/* Backdrop Section */}
          <div className="relative h-[45vh] w-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-10" />
            <img 
              src={series.banniere} 
              alt={series.titre}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            
            {/* Back Button */}
            <button 
              onClick={() => {
                if (window.history.length > 1 && document.referrer.includes(window.location.host)) {
                  navigate(-1);
                } else {
                  navigate('/');
                }
              }}
              className="absolute top-6 left-6 z-20 flex items-center gap-2 bg-black/40 hover:bg-black/60 px-4 py-2 rounded-md border border-white/10 transition-all font-bold"
            >
              <ArrowLeft size={18} />
              <span>Retour</span>
            </button>
          </div>

          {/* Series Info Section */}
          <div className="px-6 -mt-24 relative z-20 flex flex-col md:flex-row gap-6 items-start">
            <div className="w-32 md:w-44 aspect-[2/3] rounded-lg overflow-hidden border-2 border-white/10 shadow-2xl flex-none">
              <img 
                src={series.image} 
                alt={series.titre}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="flex-1 pt-4 md:pt-12">
              <h1 className="text-4xl md:text-6xl font-black mb-4 tracking-tighter uppercase">{series.titre}</h1>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded uppercase">{series.genre || 'Série'}</span>
                <span className="bg-zinc-800 text-gray-300 text-[10px] font-bold px-3 py-1 rounded uppercase">{series.langue || 'Malinké'}</span>
              </div>
              <p className="text-gray-400 text-sm md:text-base max-w-2xl mb-6">
                {series.description}
              </p>
            </div>
          </div>

          {/* Seasons Section */}
          <div className="px-6 mt-12">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-black tracking-tight uppercase">
                {purchasedOnly ? "Mes Saisons" : "Saisons"}
              </h2>
              {purchasedOnlyParam && (
                <button 
                  onClick={() => setPurchasedOnly(!purchasedOnly)}
                  className="text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full border border-white/10 transition-all"
                >
                  {purchasedOnly ? "Voir tout" : "Voir mes achats"}
                </button>
              )}
            </div>
            <div className="max-w-2xl mx-auto">
              {series.saisons
                ?.filter(season => !purchasedOnly || userPurchases.includes(season.id))
                .map((season) => (
                  <SeasonCard key={season.id} season={season} />
                ))}
              
              {purchasedOnly && series.saisons?.filter(s => userPurchases.includes(s.id)).length === 0 && (
                <div className="text-center py-12 bg-zinc-900/30 rounded-[2rem] border border-white/5">
                  <p className="text-gray-500 font-bold uppercase text-xs tracking-widest">Aucune saison achetée pour cette série</p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="px-6 pt-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-black uppercase tracking-tighter">Contenu de la saison</h1>
            <button 
              onClick={() => changeView('seasons')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="text-sm font-black uppercase tracking-widest">Retour</span>
            </button>
          </div>

          {selectedSeason && (
            <div className="max-w-2xl mx-auto">
              <SeasonCard season={selectedSeason} isDetail />
              
              <div className="space-y-4">
                {loadingEpisodes[selectedSeason.id] ? (
                  <div className="p-12 text-center text-gray-500 font-bold uppercase tracking-widest animate-pulse">Chargement des épisodes...</div>
                ) : seasonEpisodes[selectedSeason.id]?.length === 0 ? (
                  <div className="p-12 text-center text-gray-500 font-bold uppercase tracking-widest">Aucun épisode disponible.</div>
                ) : (
                  seasonEpisodes[selectedSeason.id]?.map((ep, idx) => (
                    <a 
                      key={ep.id} 
                      href={`/api/redirect-video/${ep.id}?token=${token ? encodeURIComponent(token) : ''}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "bg-zinc-900/40 border border-white/5 rounded-2xl p-4 flex items-center gap-4 hover:bg-zinc-800/40 transition-all group",
                        ep.accessible ? "cursor-pointer" : "cursor-not-allowed opacity-60 pointer-events-none"
                      )}
                      onClick={(e) => {
                        if (!ep.accessible) {
                          e.preventDefault();
                          return;
                        }
                      }}
                    >
                      {/* Thumbnail */}
                      <div className="relative w-24 md:w-32 aspect-video rounded-xl overflow-hidden flex-none">
                        <img 
                          src={series.image} 
                          alt={ep.titre}
                          className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 transition-all",
                            ep.accessible ? "bg-indigo-600/80 text-white scale-100 group-hover:scale-110" : "bg-black/60 text-gray-500"
                          )}>
                            {ep.accessible ? <Play size={20} fill="currentColor" /> : <Lock size={20} />}
                          </div>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm md:text-base font-black uppercase tracking-tight truncate">
                          {ep.titre}
                        </h4>
                        <p className="text-[10px] md:text-xs text-gray-500 font-bold uppercase tracking-tighter truncate mt-1">
                          {series.titre} - Saison {selectedSeason.numero}
                        </p>
                      </div>

                      {/* Badge */}
                      <div className="flex-none">
                        {ep.statut === 'unlocked' ? (
                          <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 uppercase tracking-widest">Gratuit</span>
                        ) : isSeasonPurchased(selectedSeason.id) ? (
                          <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 uppercase tracking-widest">Payé</span>
                        ) : (
                          <span className="text-[10px] font-black text-red-500 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20 uppercase tracking-widest">Verrouillé</span>
                        )}
                      </div>
                    </a>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && selectedSeason && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowPaymentModal(false);
                setPaymentStep(1);
              }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-zinc-900 w-full max-w-md rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
            >
              {/* Header */}
              <div className="bg-orange-600 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center overflow-hidden">
                    <div className="w-6 h-6 bg-orange-500 rounded-full" />
                  </div>
                  <div>
                    <h2 className="text-white font-black text-lg leading-none">Orange Money</h2>
                    <p className="text-white/70 text-[10px] mt-1 uppercase font-bold">Saison {selectedSeason.numero} — Saison {selectedSeason.numero}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPaymentStep(1);
                  }} 
                  className="text-white/80 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8">
                {paymentStep === 1 ? (
                  <div className="space-y-6">
                    <div className="text-center">
                      <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Montant à payer</p>
                      <h3 className="text-4xl font-black text-orange-500">{Number(selectedSeason.prix).toLocaleString('en-US', { useGrouping: false, minimumFractionDigits: 0, maximumFractionDigits: 0 })}{settings.app_currency || 'GNF'}</h3>
                    </div>

                    <div className="bg-orange-50/5 border border-orange-500/20 p-6 rounded-2xl space-y-4">
                      <p className="text-center text-xs font-bold text-gray-300">Composez ce code USSD sur votre téléphone :</p>
                      
                      <div className="space-y-3">
                        {settings.payment_ussd_code_1 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-gray-500 uppercase ml-1">Code 1</p>
                            <div className="flex items-center gap-2 bg-black/40 border border-white/5 p-2 rounded-xl">
                              <a 
                                href={`tel:${settings.payment_ussd_code_1.replace('{prix}', selectedSeason.prix.toString())}`}
                                className="flex-1 text-center font-mono font-black text-orange-500 text-base md:text-lg break-all leading-tight hover:opacity-80 transition-all"
                              >
                                {settings.payment_ussd_code_1.replace('{prix}', selectedSeason.prix.toString())}
                              </a>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(settings.payment_ussd_code_1!.replace('{prix}', selectedSeason.prix.toString()));
                                  toast.success("Code 1 copié !");
                                }}
                                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all flex-none"
                              >
                                <Copy size={14} className="text-gray-400" />
                              </button>
                            </div>
                          </div>
                        )}

                        {settings.payment_ussd_code_2 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-gray-500 uppercase ml-1">Code 2</p>
                            <div className="flex items-center gap-2 bg-black/40 border border-white/5 p-2 rounded-xl">
                              <a 
                                href={`tel:${settings.payment_ussd_code_2.replace('{prix}', selectedSeason.prix.toString())}`}
                                className="flex-1 text-center font-mono font-black text-orange-500 text-xs md:text-sm break-all leading-tight hover:opacity-80 transition-all"
                              >
                                {settings.payment_ussd_code_2.replace('{prix}', selectedSeason.prix.toString())}
                              </a>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(settings.payment_ussd_code_2!.replace('{prix}', selectedSeason.prix.toString()));
                                  toast.success("Code 2 copié !");
                                }}
                                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all flex-none"
                              >
                                <Copy size={14} className="text-gray-400" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <p className="text-center text-[10px] text-gray-500 italic">Le code est affiché à titre informatif — ne le partagez pas.</p>
                    </div>

                    {settings.payment_deposit_number && (
                      <div className="bg-orange-500/5 border border-orange-500/10 p-4 rounded-xl text-center">
                        <p className="text-xs font-bold text-gray-300">Effectuez le dépôt sur <span className="text-orange-500">{settings.payment_deposit_number}</span></p>
                      </div>
                    )}

                    <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl space-y-2">
                      <p className="text-center text-xs font-bold text-gray-300">Après paiement, contactez-nous sur WhatsApp :</p>
                      <div className="flex items-center justify-center gap-3">
                        <a 
                          href={`https://wa.me/${(settings.payment_whatsapp_number || '224627322525').replace(/\D/g, '')}?text=${encodeURIComponent("Bonjour, je viens de payer pour une saison sur MANDEN TSERIE")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 text-emerald-500 hover:opacity-80 transition-all"
                        >
                          <MessageSquare size={18} />
                          <span className="font-black">+{settings.payment_whatsapp_number || '224627322525'}</span>
                        </a>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(settings.payment_whatsapp_number || "224627322525");
                            toast.success("WhatsApp copié !");
                          }}
                          className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-all"
                        >
                          <Copy size={12} className="text-emerald-500" />
                        </button>
                      </div>
                      <p className="text-center text-[10px] text-gray-500">Envoyez une capture de votre paiement pour obtenir l'accès rapidement.</p>
                    </div>

                    <div className="flex gap-4">
                      <button 
                        onClick={() => {
                          setShowPaymentModal(false);
                          setPaymentStep(1);
                        }}
                        className="flex-1 bg-white/5 hover:bg-white/10 text-white py-4 rounded-xl font-black transition-all border border-white/5"
                      >
                        Annuler
                      </button>
                      <button 
                        onClick={() => setPaymentStep(2)}
                        className="flex-[2] bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-xl font-black transition-all shadow-lg shadow-orange-600/20"
                      >
                        J'ai payé
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="text-center space-y-2">
                      <h3 className="text-xl font-black text-white">Vérification du paiement</h3>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        Veuillez saisir le <span className="text-white font-bold">numéro complet</span> (9 chiffres) ayant effectué le dépôt.
                        {selectedSeason && userPaymentRequests.some(r => r.id_saison === selectedSeason.id && r.statut === 'pending') && (
                          <span className="block mt-2 text-orange-500 font-black animate-pulse uppercase text-[9px] tracking-tighter bg-orange-500/10 py-1 rounded-full border border-orange-500/20">
                            Modification : votre ancienne demande sera remplacée
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Numéro de paiement (9 chiffres)</label>
                        <input 
                          type="text" 
                          maxLength={9}
                          required
                          value={paymentInfo.numero_paiement}
                          onChange={e => setPaymentInfo({...paymentInfo, numero_paiement: e.target.value.replace(/\D/g, '')})}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-white focus:border-orange-500 transition-all text-xl tracking-[0.2em] text-center font-black placeholder:text-gray-800 placeholder:tracking-normal"
                          placeholder="ex : 627322525"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Solde après paiement (optionnel)</label>
                        <input 
                          type="text" 
                          value={paymentInfo.solde_apres_paiement}
                          onChange={e => setPaymentInfo({...paymentInfo, solde_apres_paiement: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-white focus:border-orange-500 transition-all text-sm font-bold placeholder:text-gray-800"
                          placeholder={`ex : 12 500 ${settings.app_currency || 'GNF'}`}
                        />
                      </div>
                    </div>

                    {requestSent ? (
                      <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 p-4 rounded-2xl flex items-center justify-center gap-3 font-black text-sm text-center"
                      >
                        <CheckCircle2 size={20} /> {successMessage}
                      </motion.div>
                    ) : (
                      <div className="space-y-4">
                        {requestError && (
                          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-xl text-[10px] font-bold flex items-center gap-2">
                            <AlertCircle size={14} /> {requestError}
                          </div>
                        )}
                        
                        <div className="flex gap-4">
                          <button 
                            onClick={() => setPaymentStep(1)}
                            className="flex-1 bg-white/5 hover:bg-white/10 text-white py-4 rounded-xl font-black transition-all border border-white/5"
                          >
                            Retour
                          </button>
                          <button 
                            onClick={handlePaymentRequest}
                            disabled={isRequesting || paymentInfo.numero_paiement.length !== 9}
                            className="flex-[2] bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:grayscale text-white py-4 rounded-xl font-black transition-all shadow-lg shadow-orange-600/20"
                          >
                            {isRequesting ? "Envoi..." : (selectedSeason && userPaymentRequests.some(r => r.id_saison === selectedSeason.id && r.statut === 'pending') ? "Valider la modification" : "Envoyer la demande")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeEpisode && null}
      </AnimatePresence>
    </div>
  );
};

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isRegister, setIsRegister] = useState(false);
  const [phonePrefix, setPhonePrefix] = useState('+224');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isAdminReset, setIsAdminReset] = useState(false);
  const [forgotPinFlow, setForgotPinFlow] = useState(false);
  const [forgotPinStep, setForgotPinStep] = useState(1); // 1: phone, 2: confirm name
  const [foundUser, setFoundUser] = useState<any>(null);
  const [formData, setFormData] = useState({ telephone: '', pin: '', prenom: '', nom: '', confirmer_pin: '' });
  const [adminResetData, setAdminResetData] = useState({ telephone: '', prenom: '', nom: '', mot_secret: '', nouveau_pin: '', confirmer_pin: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const state = location.state as any;
    if (state?.message) {
      setError(state.message);
      // Clear state to avoid showing message again on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then((data: any) => setSettings(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (forgotPinFlow) {
      window.history.pushState({ modal: 'forgot-pin' }, '');
      const handlePopState = (e: PopStateEvent) => {
        setForgotPinFlow(false);
      };
      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
        if (window.history.state?.modal === 'forgot-pin') {
          window.history.back();
        }
      };
    }
  }, [forgotPinFlow]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (formData.telephone.length !== 9) {
      setError("Le numéro de téléphone doit comporter exactement 9 chiffres.");
      return;
    }
    if (formData.pin.length !== 4) {
      setError("Le PIN doit comporter exactement 4 chiffres.");
      return;
    }
    if (isRegister && formData.pin !== formData.confirmer_pin) {
      setError("Les codes PIN ne correspondent pas.");
      return;
    }
    setLoading(true);
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    const finalTelephone = phonePrefix + formData.telephone;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isRegister ? { ...formData, telephone: finalTelephone } : { telephone: finalTelephone, pin: formData.pin })
      });
      const data = await res.json() as any;
      if (res.ok) {
        login(data.token, data.user);
        navigate('/');
      } else {
        setError(data.error || "Une erreur est survenue");
      }
    } catch (e) {
      setError("Une erreur de connexion est survenue");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (adminResetData.telephone.length !== 9) {
      setError("Le numéro de téléphone doit comporter exactement 9 chiffres.");
      return;
    }

    if (adminResetData.mot_secret !== "ADBMPIN") {
      setError("Mot secret incorrect.");
      return;
    }

    if (adminResetData.nouveau_pin !== adminResetData.confirmer_pin) {
      setError("Les codes PIN ne correspondent pas.");
      return;
    }

    if (adminResetData.nouveau_pin.length !== 4) {
      setError("Le PIN doit comporter 4 chiffres.");
      return;
    }

    setLoading(true);
    const finalTelephone = phonePrefix + adminResetData.telephone;
    try {
      const res = await fetch('/api/admin/reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...adminResetData, telephone: finalTelephone })
      });
      const data = await res.json() as any;
      if (res.ok) {
        setSuccess("PIN Administrateur réinitialisé avec succès !");
        setTimeout(() => {
          setIsAdminReset(false);
          setSuccess('');
        }, 3000);
      } else {
        setError(data.error || "Une erreur est survenue");
      }
    } catch (e) {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.telephone.length !== 9) {
      setError("Le numéro de téléphone doit comporter exactement 9 chiffres.");
      return;
    }
    setError('');
    setLoading(true);
    const finalTelephone = phonePrefix + formData.telephone;
    try {
      const res = await fetch('/api/auth/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telephone: finalTelephone })
      });
      const data = await res.json() as any;
      if (res.ok) {
        if (data.user.role === 'admin' || data.user.role === 'owner') {
          setAdminResetData({ ...adminResetData, telephone: formData.telephone, prenom: data.user.prenom, nom: data.user.nom });
          setIsAdminReset(true);
          setForgotPinFlow(false);
        } else {
          setFoundUser(data.user);
          setForgotPinStep(2);
        }
      } else {
        setError(data.error || "Numéro non trouvé");
      }
    } catch (e) {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async () => {
    setLoading(true);
    const finalTelephone = phonePrefix + formData.telephone;
    try {
      const res = await fetch('/api/user/pin-requests/request-by-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telephone: finalTelephone })
      });
      const data = await res.json() as any;
      if (res.ok) {
        setSuccess("Votre demande a été envoyée à l'administrateur.");
        setTimeout(() => {
          setForgotPinFlow(false);
          setForgotPinStep(1);
          setSuccess('');
        }, 3000);
      } else {
        setError(data.error || "Erreur lors de l'envoi");
      }
    } catch (e) {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden select-none">
      <div className="absolute inset-0 z-0">
        <img src="https://picsum.photos/seed/bmtv-bg/1920/1080?blur=5" className="w-full h-full object-cover opacity-30" referrerPolicy="no-referrer" draggable="false" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black" />
      </div>

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-12">
          {settings.app_logo_url ? (
            <img src={settings.app_logo_url} alt="Logo" className="h-24 w-auto mx-auto mb-4" />
          ) : (
            <div className="inline-flex flex-col leading-none italic tracking-tighter mb-2">
              <div className="text-6xl font-black flex gap-2">
                <span className="text-[#FFD700]">MANDEN</span>
                <span className="text-[#FF0000]">TSERIE</span>
              </div>
              <span className="text-[10px] text-white/60 font-bold tracking-[0.4em] uppercase mt-1">{settings.app_description || 'Manden Tserie streaming'}</span>
            </div>
          )}
        </div>

        <div className="bg-black/80 backdrop-blur-2xl p-10 rounded-2xl border border-white/10 shadow-2xl">
          <h2 className="text-3xl font-black text-white mb-8 tracking-tight">
            {isAdminReset ? "Réinitialisation Admin" : forgotPinFlow ? "Code PIN oublié" : isRegister ? "Créer un compte" : "S'identifier"}
          </h2>
          
          {isAdminReset ? (
            <form onSubmit={handleAdminReset} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Prénom</label>
                  <input 
                    type="text" 
                    required
                    value={adminResetData.prenom}
                    onChange={e => setAdminResetData({...adminResetData, prenom: e.target.value})}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-5 py-4 text-white focus:ring-2 focus:ring-[#2196f3] focus:border-transparent transition-all placeholder:text-gray-600"
                    placeholder="Prénom"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Nom</label>
                  <input 
                    type="text" 
                    required
                    value={adminResetData.nom}
                    onChange={e => setAdminResetData({...adminResetData, nom: e.target.value})}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-5 py-4 text-white focus:ring-2 focus:ring-[#2196f3] focus:border-transparent transition-all placeholder:text-gray-600"
                    placeholder="Nom"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Numéro de téléphone</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={phonePrefix}
                    onChange={e => setPhonePrefix(e.target.value.startsWith('+') ? e.target.value : '+' + e.target.value.replace('+', ''))}
                    className="w-20 shrink-0 bg-zinc-900/50 border border-white/10 rounded-xl px-2 py-4 text-white text-center font-bold focus:ring-2 focus:ring-[#2196f3] focus:border-transparent transition-all"
                  />
                  <input 
                    type="tel" 
                    required
                    maxLength={9}
                    value={adminResetData.telephone}
                    onChange={e => setAdminResetData({...adminResetData, telephone: e.target.value.replace(/\D/g, '').slice(0, 9)})}
                    className="flex-1 bg-zinc-900/50 border border-white/10 rounded-xl px-5 py-4 text-white focus:ring-2 focus:ring-[#2196f3] focus:border-transparent transition-all placeholder:text-gray-600"
                    placeholder="6XX XX XX XX"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Mot Secret</label>
                <input 
                  type="text" 
                  required
                  value={adminResetData.mot_secret}
                  onChange={e => setAdminResetData({...adminResetData, mot_secret: e.target.value})}
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-5 py-4 text-white focus:ring-2 focus:ring-[#2196f3] focus:border-transparent transition-all placeholder:text-gray-600"
                  placeholder="Entrez le mot secret"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Nouveau PIN</label>
                  <input 
                    type="password" 
                    maxLength={4}
                    required
                    value={adminResetData.nouveau_pin}
                    onChange={e => setAdminResetData({...adminResetData, nouveau_pin: e.target.value.replace(/\D/g, '')})}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-5 py-4 text-white focus:ring-2 focus:ring-[#2196f3] focus:border-transparent transition-all placeholder:text-gray-600 tracking-[0.5em] text-center font-black"
                    placeholder="••••"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Confirmer</label>
                  <input 
                    type="password" 
                    maxLength={4}
                    required
                    value={adminResetData.confirmer_pin}
                    onChange={e => setAdminResetData({...adminResetData, confirmer_pin: e.target.value.replace(/\D/g, '')})}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-5 py-4 text-white focus:ring-2 focus:ring-[#2196f3] focus:border-transparent transition-all placeholder:text-gray-600 tracking-[0.5em] text-center font-black"
                    placeholder="••••"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-xs font-bold flex items-center gap-3">
                  <AlertCircle size={18} /> {error}
                </div>
              )}
              {success && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 p-4 rounded-xl text-xs font-bold flex items-center gap-3">
                  <CheckCircle2 size={18} /> {success}
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white py-5 rounded-xl font-black text-lg shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98]"
              >
                {loading ? "Chargement..." : "RÉINITIALISER"}
              </button>

              <button 
                type="button"
                onClick={() => setIsAdminReset(false)}
                className="w-full text-gray-500 hover:text-white text-sm font-bold transition-colors"
              >
                Retour à la connexion
              </button>
            </form>
          ) : forgotPinFlow ? (
            <div className="space-y-6">
              {forgotPinStep === 1 ? (
                <form onSubmit={handleCheckPhone} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Numéro de téléphone</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={phonePrefix}
                        onChange={e => setPhonePrefix(e.target.value.startsWith('+') ? e.target.value : '+' + e.target.value.replace('+', ''))}
                        className="w-20 shrink-0 bg-zinc-900/50 border border-white/10 rounded-xl px-2 py-4 text-white text-center font-bold focus:ring-2 focus:ring-[#2196f3] focus:border-transparent transition-all"
                      />
                      <input 
                        type="tel" 
                        required
                        maxLength={9}
                        value={formData.telephone}
                        onChange={e => setFormData({...formData, telephone: e.target.value.replace(/\D/g, '').slice(0, 9)})}
                        className="flex-1 bg-zinc-900/50 border border-white/10 rounded-xl px-5 py-4 text-white focus:ring-2 focus:ring-[#2196f3] focus:border-transparent transition-all placeholder:text-gray-600"
                        placeholder="6XX XX XX XX"
                      />
                    </div>
                  </div>
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-xs font-bold flex items-center gap-3">
                      <AlertCircle size={18} /> {error}
                    </div>
                  )}
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-[#2196f3] hover:bg-blue-600 disabled:opacity-50 text-white py-5 rounded-xl font-black text-lg shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
                  >
                    {loading ? "Vérification..." : "CONTINUER"}
                  </button>
                </form>
              ) : (
                <div className="space-y-6">
                  <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-6 text-center">
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Est-ce vous ?</p>
                    <p className="text-white text-xl font-black">{foundUser?.prenom} {foundUser?.nom}</p>
                  </div>
                  
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-xs font-bold flex items-center gap-3">
                      <AlertCircle size={18} /> {error}
                    </div>
                  )}
                  {success && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 p-4 rounded-xl text-xs font-bold flex items-center gap-3">
                      <CheckCircle2 size={18} /> {success}
                    </div>
                  )}

                  <div className="flex flex-col gap-4">
                    <button 
                      onClick={handleRequestReset}
                      disabled={loading}
                      className="w-full bg-[#2196f3] hover:bg-blue-600 disabled:opacity-50 text-white py-5 rounded-xl font-black text-lg shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
                    >
                      {loading ? "Envoi..." : "OUI, ENVOYER LA DEMANDE"}
                    </button>
                    <button 
                      onClick={() => setForgotPinStep(1)}
                      className="w-full text-gray-500 hover:text-white text-sm font-bold transition-colors"
                    >
                      Non, ce n'est pas moi
                    </button>
                  </div>
                </div>
              )}
              <button 
                type="button"
                onClick={() => {
                  setForgotPinFlow(false);
                  setForgotPinStep(1);
                  setError('');
                }}
                className="w-full text-gray-500 hover:text-white text-sm font-bold transition-colors"
              >
                Retour à la connexion
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {isRegister && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Prénom</label>
                    <input 
                      type="text" 
                      required
                      value={formData.prenom}
                      onChange={e => setFormData({...formData, prenom: e.target.value})}
                      className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-5 py-4 text-white focus:ring-2 focus:ring-[#2196f3] focus:border-transparent transition-all placeholder:text-gray-600"
                      placeholder="Prénom"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Nom</label>
                    <input 
                      type="text" 
                      required
                      value={formData.nom}
                      onChange={e => setFormData({...formData, nom: e.target.value})}
                      className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-5 py-4 text-white focus:ring-2 focus:ring-[#2196f3] focus:border-transparent transition-all placeholder:text-gray-600"
                      placeholder="Nom"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Numéro de téléphone</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={phonePrefix}
                    onChange={e => setPhonePrefix(e.target.value.startsWith('+') ? e.target.value : '+' + e.target.value.replace('+', ''))}
                    className="w-20 shrink-0 bg-zinc-900/50 border border-white/10 rounded-xl px-2 py-4 text-white text-center font-bold focus:ring-2 focus:ring-[#2196f3] focus:border-transparent transition-all"
                  />
                  <input 
                    type="tel" 
                    required
                    maxLength={9}
                    value={formData.telephone}
                    onChange={e => setFormData({...formData, telephone: e.target.value.replace(/\D/g, '').slice(0, 9)})}
                    className="flex-1 bg-zinc-900/50 border border-white/10 rounded-xl px-5 py-4 text-white focus:ring-2 focus:ring-[#2196f3] focus:border-transparent transition-all placeholder:text-gray-600"
                    placeholder="6XX XX XX XX"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Code PIN (4 chiffres)</label>
                <input 
                  type="password" 
                  maxLength={4}
                  required
                  value={formData.pin}
                  onChange={e => setFormData({...formData, pin: e.target.value.replace(/\D/g, '')})}
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-5 py-4 text-white focus:ring-2 focus:ring-[#2196f3] focus:border-transparent transition-all placeholder:text-gray-600 tracking-[1.5em] text-center text-xl font-black"
                  placeholder="••••"
                />
              </div>

              {isRegister && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Confirmer le code PIN</label>
                  <input 
                    type="password" 
                    maxLength={4}
                    required
                    value={formData.confirmer_pin}
                    onChange={e => setFormData({...formData, confirmer_pin: e.target.value.replace(/\D/g, '')})}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-5 py-4 text-white focus:ring-2 focus:ring-[#2196f3] focus:border-transparent transition-all placeholder:text-gray-600 tracking-[1.5em] text-center text-xl font-black"
                    placeholder="••••"
                  />
                </div>
              )}

              {error && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-xs font-bold flex items-center gap-3"
                >
                  <AlertCircle size={18} /> {error}
                </motion.div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-[#2196f3] hover:bg-blue-600 disabled:opacity-50 text-white py-5 rounded-xl font-black text-lg shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] mt-4"
              >
                {loading ? "Chargement..." : isRegister ? "S'INSCRIRE" : "S'IDENTIFIER"}
              </button>
            </form>
          )}

          <div className="mt-10 flex flex-col gap-5">
            {isRegister ? (
              <button 
                onClick={() => {
                  setIsRegister(false);
                  setIsAdminReset(false);
                  setError('');
                }}
                className="w-full bg-white/5 hover:bg-white/10 text-white py-4 rounded-xl font-bold text-sm transition-all border border-white/10"
              >
                Déjà membre ? <span className="text-[#2196f3]">Identifiez-vous</span>
              </button>
            ) : (
              settings.app_registration_enabled !== 'false' ? (
                <button 
                  onClick={() => {
                    setIsRegister(true);
                    setIsAdminReset(false);
                    setError('');
                  }}
                  className="w-full bg-[#FFD700]/10 hover:bg-[#FFD700]/20 text-white py-4 rounded-xl font-bold text-sm transition-all border border-[#FFD700]/20"
                >
                  Nouveau ? <span className="text-[#FFD700]">INSCRIVEZ-VOUS</span>
                </button>
              ) : (
                <div className="bg-orange-500/5 border border-orange-500/10 p-4 rounded-xl">
                  <p className="text-orange-500/60 text-[10px] font-black uppercase tracking-widest text-center">
                    Les inscriptions sont temporairement fermées
                  </p>
                </div>
              )
            )}
            
            {!isRegister && !isAdminReset && (
              <button 
                onClick={() => {
                  setForgotPinFlow(true);
                  setError('');
                }}
                className="w-full bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all border border-orange-500/20 shadow-lg shadow-orange-500/5"
              >
                CODE PIN OUBLIÉ ?
              </button>
            )}
          </div>
        </div>
        
        <p className="text-center mt-8 text-gray-600 text-[10px] font-medium uppercase tracking-widest">
          © 2026 Manden Tserie streaming. TOUS DROITS RÉSERVÉS.
        </p>
      </div>
    </div>
  );
};

// --- Admin ---

const AdminDashboard = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'menu' | 'payments' | 'users' | 'stats' | 'media_gestion' | 'media_ajout' | 'unlock' | 'pin' | 'banner' | 'settings' | 'messages' | 'roles' | 'payments_log' | 'trash' | 'stock'>(() => {
    const params = new URLSearchParams(location.hash.replace('#', ''));
    const tab = params.get('tab') as any;
    const validTabs = ['menu', 'payments', 'users', 'stats', 'media_gestion', 'media_ajout', 'unlock', 'pin', 'banner', 'settings', 'messages', 'roles', 'payments_log', 'trash', 'stock'];
    if (tab && validTabs.includes(tab)) {
      return tab;
    }
    return 'menu';
  });

  // Listen for hash changes to update activeTab (back button support)
  useEffect(() => {
    const params = new URLSearchParams(location.hash.replace('#', ''));
    const tab = params.get('tab') as any;
    const validTabs = ['menu', 'payments', 'users', 'stats', 'media_gestion', 'media_ajout', 'unlock', 'pin', 'banner', 'settings', 'messages', 'roles', 'payments_log', 'trash', 'stock'];
    if (tab && validTabs.includes(tab)) {
      if (tab !== activeTab) setActiveTab(tab);
    } else {
      if (activeTab !== 'menu') setActiveTab('menu');
    }
  }, [location.hash]);

  const changeTab = (tab: string) => {
    if (tab === 'menu') {
      navigate(location.pathname + location.search, { replace: true });
    } else {
      navigate(`#tab=${tab}`, { replace: false });
    }
  };
  const [activeForm, setActiveForm] = useState<'series' | 'season' | 'episode' | 'banner' | 'setting' | null>(null);
  const [selectedSeriesId, setSelectedSeriesId] = useState<number | null>(null);
  
  const hasPermission = (tab: string) => {
    if (user?.role === 'owner') return true;
    if (user?.role === 'admin') {
      if (tab === 'payments_log') return true; // Owners and admins can see logs
      // Map new tabs to old permission if needed, or update permissions
      if (tab === 'media_gestion' || tab === 'media_ajout') return user.permissions?.includes('media');
      return user.permissions?.includes(tab);
    }
    return false;
  };

  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [paymentsLog, setPaymentsLog] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [pinRequests, setPinRequests] = useState<PinResetRequest[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [seasonsList, setSeasonsList] = useState<Season[]>([]);
  const [adminSeasons, setAdminSeasons] = useState<(Season & { titre_serie: string })[]>([]);
  const [adminEpisodes, setAdminEpisodes] = useState<(Episode & { titre_serie: string, numero_saison: number })[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [trash, setTrash] = useState<{ series: any[], seasons: any[], episodes: any[] }>({ series: [], seasons: [], episodes: [] });
  const [settings, setSettings] = useState<any[]>([]);
  const [settingsRecord, setSettingsRecord] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [stockEpisodes, setStockEpisodes] = useState<any[]>([]);
  const [selectedStockIds, setSelectedStockIds] = useState<number[]>([]);
  const [mediaToMove, setMediaToMove] = useState<any | null>(null);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [activeUploads, setActiveUploads] = useState<Record<string, { progress: number, name: string, status: 'uploading' | 'success' | 'error' }>>({});

  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({
    payments: false,
    users: false,
    stats: false,
    pinRequests: false,
    series: false,
    seasons: false,
    episodes: false,
    banners: false,
    settings: false,
    stock: false
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPayments, setSearchPayments] = useState('');
  const [searchUsers, setSearchUsers] = useState('');
  const [searchPins, setSearchPins] = useState('');
  const [expandedSeriesId, setExpandedSeriesId] = useState<number | null>(null);
  const [expandedAdminSeasonId, setExpandedAdminSeasonId] = useState<number | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPin, setResetPin] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const [pinConfirm, setPinConfirm] = useState<{
    show: boolean;
    title: string;
    description?: string;
    onConfirm: (pin: string) => Promise<void>;
  } | null>(null);
  const [confirmPin, setConfirmPin] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning' | 'info';
  } | null>(null);

  const handlePinConfirm = async () => {
    if (!confirmPin || !pinConfirm) return;
    setConfirmLoading(true);
    try {
      await pinConfirm.onConfirm(confirmPin);
      setPinConfirm(null);
      setConfirmPin('');
    } catch (e) {
      console.error("PIN Confirmation error:", e);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files);
    setIsBulkUploading(true);
    
    // Initialiser l'état des uploads
    const initialUploads: Record<string, any> = {};
    const uploadTasks: Promise<any>[] = [];

    filesArray.forEach((file, index) => {
      const uploadId = `upload-${Date.now()}-${index}`;
      initialUploads[uploadId] = { progress: 0, name: file.name, status: 'uploading' };
      
      const uploadTask = new Promise((resolve) => {
        const formData = new FormData();
        formData.append('files', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/admin/stock/upload', true);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setActiveUploads(prev => ({
              ...prev,
              [uploadId]: { ...prev[uploadId], progress: percent }
            }));
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            const data = JSON.parse(xhr.responseText);
            if (data.success) {
              setActiveUploads(prev => ({
                ...prev,
                [uploadId]: { ...prev[uploadId], progress: 100, status: 'success' }
              }));
              resolve({ success: true, name: file.name });
            } else {
              setActiveUploads(prev => ({
                ...prev,
                [uploadId]: { ...prev[uploadId], status: 'error' }
              }));
              resolve({ success: false, name: file.name, error: data.error });
            }
          } else {
            setActiveUploads(prev => ({
              ...prev,
              [uploadId]: { ...prev[uploadId], status: 'error' }
            }));
            resolve({ success: false, name: file.name });
          }
        };

        xhr.onerror = () => {
          setActiveUploads(prev => ({
            ...prev,
            [uploadId]: { ...prev[uploadId], status: 'error' }
          }));
          resolve({ success: false, name: file.name });
        };

        xhr.send(formData);
      });
      
      uploadTasks.push(uploadTask);
    });

    setActiveUploads(initialUploads);

    try {
      const results = await Promise.all(uploadTasks);
      const successCount = results.filter(r => r.success).length;
      
      if (successCount > 0) {
        fetchData('stock');
        setFormMessage({ type: 'success', text: `${successCount} vidéo(s) ajoutée(s) au stock !` });
      } else {
        setFormMessage({ type: 'error', text: "Erreur lors de l'upload des fichiers" });
      }
      
      // Nettoyer après quelques secondes
      setTimeout(() => {
        setIsBulkUploading(false);
        setActiveUploads({});
        setFormMessage({ type: '', text: '' });
      }, 5000);

    } catch (err) {
      console.error("Bulk upload error:", err);
      setIsBulkUploading(false);
      setFormMessage({ type: 'error', text: "Une erreur est survenue lors de l'upload groupé" });
    }
  };

  const handleAssignFromStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!episodeForm.id_saison) return;

    setFormLoading(true);
    try {
      const isBulk = selectedStockIds.length > 0;
      const url = isBulk ? '/api/admin/stock/bulk-assign' : `/api/admin/stock/${mediaToMove.id}/assign`;
      const body = isBulk ? {
        ids: selectedStockIds,
        id_saison: Number(episodeForm.id_saison),
        statut: episodeForm.statut
      } : {
        id_saison: Number(episodeForm.id_saison),
        titre: episodeForm.titre || mediaToMove.titre,
        statut: episodeForm.statut
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        setMediaToMove(null);
        setSelectedStockIds([]);
        setEpisodeForm({ id_serie: '', id_saison: '', titre: '', url_video: '', statut: 'locked' });
        fetchData('stock');
        fetchData('episodes');
        setFormMessage({ type: 'success', text: isBulk ? "Épisodes assignés avec succès !" : "Épisode assigné avec succès !" });
        setTimeout(() => setFormMessage({ type: '', text: '' }), 3000);
      } else {
        const error = await res.json() as any;
        setFormMessage({ type: 'error', text: error.error || "Erreur d'assignation" });
      }
    } catch (e) {
      console.error("Assign error:", e);
      setFormMessage({ type: 'error', text: "Erreur réseau" });
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteFromStock = (id: number) => {
    setConfirmModal({
      show: true,
      title: "Supprimer du stock",
      message: "Voulez-vous vraiment supprimer cet épisode du stock ? Le fichier sera également supprimé définitivement.",
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/stock/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            fetchData('stock');
          }
        } catch (e) {
          console.error("Delete stock error:", e);
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const handleResetSales = async () => {
    if (!resetPin) return;
    setResetLoading(true);
    try {
      const res = await fetch('/api/admin/reset-sales', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pin: resetPin })
      });
      const data = await res.json() as any;
      if (res.ok) {
        setFormMessage({ type: 'success', text: data.message });
        setShowResetModal(false);
        setResetPin('');
        fetchData(); // Refresh stats
      } else {
        setFormMessage({ type: 'error', text: data.error || "Erreur lors de la réinitialisation" });
      }
    } catch (e) {
      console.error("Error resetting sales:", e);
      setFormMessage({ type: 'error', text: "Erreur réseau" });
    } finally {
      setResetLoading(false);
    }
  };

  const getSetting = (key: string) => settings.find(s => s.cle === key)?.valeur || '';
  const [localSettings, setLocalSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    const initialSettings: Record<string, string> = {};
    settings.forEach(s => {
      initialSettings[s.cle] = s.valeur;
    });
    setLocalSettings(initialSettings);
  }, [settings]);

  const handleSaveSetting = async (cle: string, valeur: string) => {
    setFormLoading(true);
    try {
      const res = await fetch('/api/admin/settings/save', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cle, valeur })
      });
      if (res.ok) {
        // Update global settings state to keep it in sync
        setSettings(prev => {
          const exists = prev.find(s => s.cle === cle);
          if (exists) {
            return prev.map(s => s.cle === cle ? { ...s, valeur } : s);
          }
          return [...prev, { cle, valeur }];
        });
        setFormMessage({ type: 'success', text: "Paramètre enregistré avec succès !" });
        setTimeout(() => setFormMessage({ type: '', text: '' }), 3000);
      }
    } catch (e) {
      console.error("Error saving setting:", e);
      setFormMessage({ type: 'error', text: "Erreur lors de l'enregistrement." });
    } finally {
      setFormLoading(false);
    }
  };

  // Form states
  const [seriesForm, setSeriesForm] = useState({ titre: '', description: '', image: '', banniere: '', genre: '', langue: '', statut: 'published' as 'published' | 'draft' | 'reserved' });
  const [seasonForm, setSeasonForm] = useState({ id_serie: '', numero: '', prix: '', titre: '', statut: 'published' as 'published' | 'draft' | 'reserved', date_publication: '' });
  const [episodeForm, setEpisodeForm] = useState({ id_serie: '', id_saison: '', titre: '', url_video: '', statut: 'locked' as 'locked' | 'unlocked' | 'draft' | 'reserved' });
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload', true);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          // Cap at 98% to account for server-side processing time
          const percentComplete = Math.round((event.loaded / event.total) * 98);
          setUploadProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        setUploadProgress(100);
        
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          setEpisodeForm(prev => ({ ...prev, url_video: response.url }));
          setFormMessage({ type: 'success', text: "Vidéo uploadée avec succès !" });
          setTimeout(() => setFormMessage({ type: '', text: '' }), 3000);
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            setFormMessage({ type: 'error', text: error.error || "Erreur lors de l'upload" });
          } catch (e) {
            setFormMessage({ type: 'error', text: "Erreur lors de l'upload" });
          }
        }
        
        // Group state updates with a small delay so user sees 100%
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(null);
        }, 1500);
      };

      xhr.onerror = () => {
        setFormMessage({ type: 'error', text: "Erreur de connexion lors de l'upload" });
        setIsUploading(false);
        setUploadProgress(null);
      };

      xhr.send(formData);
    } catch (err) {
      setFormMessage({ type: 'error', text: "Une erreur est survenue" });
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const [bannerForm, setBannerForm] = useState({ titre: '', image: '', id_serie: '', statut: 'active', type: 'image' });
  const [settingForm, setSettingForm] = useState({ cle: '', valeur: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [formMessage, setFormMessage] = useState({ type: '' as 'success' | 'error' | '', text: '' });

  useEffect(() => {
    if (token) {
      fetch('/api/admin/setup-db', {
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(e => console.error("Setup DB error:", e));
    }
  }, [token]);

  useEffect(() => {
    if (activeTab !== 'menu' || activeForm !== null) {
      window.history.pushState({ modal: 'admin-dashboard', tab: activeTab, form: activeForm }, '');
      const handlePopState = () => {
        if (activeForm !== null) {
          setActiveForm(null);
        } else if (selectedSeriesId !== null) {
          setSelectedSeriesId(null);
        } else if (activeTab !== 'menu') {
          setActiveTab('menu');
        }
      };
      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [activeTab, activeForm, selectedSeriesId]);

  useEffect(() => {
    setSeasonsList([]);
    setFormMessage({ type: '', text: '' });
  }, [activeForm]);

  const handleToggleSetting = (cle: string) => {
    const current = localSettings[cle] === 'true' ? 'false' : 'true';
    handleSaveSetting(cle, current);
  };

  const handleDeleteSetting = async (cle: string) => {
    setConfirmModal({
      show: true,
      title: "Supprimer le paramètre",
      message: `Voulez-vous vraiment supprimer le paramètre "${cle}" ?`,
      type: 'danger',
      onConfirm: async () => {
        setFormLoading(true);
        try {
          const res = await fetch(`/api/admin/settings/${cle}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            setSettings(prev => prev.filter(s => s.cle !== cle));
            setFormMessage({ type: 'success', text: "Paramètre supprimé." });
            setTimeout(() => setFormMessage({ type: '', text: '' }), 3000);
          }
        } catch (e) {
          setFormMessage({ type: 'error', text: "Erreur lors de la suppression." });
        } finally {
          setFormLoading(false);
          setConfirmModal(null);
        }
      }
    });
  };

  const SettingRow = ({ label, cle, description, type = 'text', placeholder = '' }: { label: string, cle: string, description?: string, type?: 'text' | 'toggle', placeholder?: string }) => {
    const value = localSettings[cle] || '';
    
    return (
      <div className="bg-black/20 border border-white/5 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 group transition-all hover:bg-black/30">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-black text-xs text-white uppercase tracking-widest">{label}</h3>
            <span className="text-[8px] font-black text-gray-600 uppercase tracking-tighter bg-white/5 px-1.5 py-0.5 rounded">{cle}</span>
          </div>
          {description && <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">{description}</p>}
        </div>
        
        <div className="flex items-center gap-3">
          {type === 'toggle' ? (
            <button 
              onClick={() => handleToggleSetting(cle)}
              className={cn(
                "relative w-12 h-6 rounded-full transition-all duration-300",
                value === 'true' ? "bg-emerald-500 shadow-lg shadow-emerald-500/20" : "bg-zinc-800"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300",
                value === 'true' ? "left-7" : "left-1"
              )} />
            </button>
          ) : (
            <div className="flex gap-2">
              <input 
                type="text"
                value={value}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, [cle]: e.target.value }))}
                placeholder={placeholder}
                className="bg-black border border-white/10 rounded-xl px-4 py-2 text-xs focus:border-blue-500 outline-none transition-all w-full md:w-64"
              />
              <button 
                onClick={() => handleSaveSetting(cle, value)}
                className="bg-white text-black px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
              >
                OK
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const fetchData = async (forceKey?: string) => {
    const keyToFetch = forceKey || activeTab;

    // Fetch public series list independently
    if (keyToFetch === 'series' || !forceKey) {
      const serRes = await fetch('/api/series');
      if (serRes.ok) {
        const data = await serRes.json() as any;
        setSeriesList(data);
      }
    }

    // Fetch admin-only data with resilience
    const headers = { 'Authorization': `Bearer ${token}` };
    
    const fetchAdminData = async (url: string, setter: (data: any) => void, key: string) => {
      setLoadingStates(prev => ({ ...prev, [key]: true }));
      try {
        const res = await fetch(url, { headers });
        if (res.ok) {
          const data = await res.json();
          setter(data);
        }
      } catch (err) {
        console.error(`Failed to fetch ${url}:`, err);
      } finally {
        setLoadingStates(prev => ({ ...prev, [key]: false }));
      }
    };

    // Only fetch what's requested or essential
    if (keyToFetch === 'settings' || !forceKey) {
      fetchAdminData('/api/admin/settings', (data) => {
        setSettings(data);
        const record: Record<string, string> = {};
        data.forEach((s: any) => record[s.cle] = s.valeur);
        setSettingsRecord(record);
      }, 'settings');
    }

    // Fetch specific data based on key or active tab
    if (keyToFetch === 'payments') fetchAdminData('/api/admin/payments', setPayments, 'payments');
    if (keyToFetch === 'users' || keyToFetch === 'roles') fetchAdminData('/api/admin/users', setUsers, 'users');
    if (keyToFetch === 'stats') fetchAdminData('/api/admin/stats', setStats, 'stats');
    if (keyToFetch === 'pin' || keyToFetch === 'pinRequests') fetchAdminData('/api/admin/pin-requests', setPinRequests, 'pinRequests');
    if (keyToFetch === 'media_gestion' || keyToFetch === 'media_ajout' || keyToFetch === 'seasons' || keyToFetch === 'series' || keyToFetch === 'episodes' || keyToFetch === 'stock') {
      fetchAdminData('/api/admin/series', setSeriesList, 'series');
      fetchAdminData('/api/admin/seasons', setAdminSeasons, 'seasons');
      fetchAdminData('/api/admin/episodes', setAdminEpisodes, 'episodes');
    }
    if (keyToFetch === 'banner' || keyToFetch === 'banners') fetchAdminData('/api/admin/banners', setBanners, 'banners');
    if (keyToFetch === 'payments_log') fetchAdminData('/api/admin/payments-log', setPaymentsLog, 'payments_log');
    if (keyToFetch === 'trash') fetchAdminData('/api/admin/trash', setTrash, 'trash');
    if (keyToFetch === 'stock') fetchAdminData('/api/admin/stock', setStockEpisodes, 'stock');
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Lazy load data based on active tab
  useEffect(() => {
    if (activeTab === 'unlock') fetchData('payments');
    else if (activeTab === 'users') fetchData('users');
    else if (activeTab === 'stats') fetchData('stats');
    else if (activeTab === 'pin') fetchData('pinRequests');
    else if (activeTab === 'media_gestion') {
      fetchData('series');
      fetchData('seasons');
      fetchData('episodes');
    }
    else if (activeTab === 'banner') fetchData('banners');
    else if (activeTab === 'settings') fetchData('settings');
    else if (activeTab === 'payments_log') fetchData('payments_log');
    else if (activeTab === 'trash') fetchData('trash');
    else if (activeTab === 'stock') {
      fetchData('series');
      fetchData('seasons');
      fetchData('stock');
    }
  }, [activeTab]);

  const handleDeletePaymentLog = async (id: number) => {
    setConfirmModal({
      show: true,
      title: "Supprimer le log",
      message: "Supprimer cette entrée du log ?",
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/payments-log/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            fetchData('payments_log');
            toast.success("Log supprimé");
          }
        } catch (e) {
          console.error("Error deleting payment log:", e);
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const handleApprove = async (id: number) => {
    const res = await fetch(`/api/admin/payments/${id}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (res.ok) fetchData('payments');
    else {
      const data = await res.json() as any;
      setFormMessage({ type: 'error', text: data.error || "Erreur" });
    }
  };

  const handleReject = (id: number) => {
    setPinConfirm({
      show: true,
      title: "Rejeter le paiement",
      description: "Veuillez confirmer avec votre code PIN administrateur.",
      onConfirm: async (pin) => {
        const res = await fetch(`/api/admin/payments/${id}/reject`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin })
        });
        if (res.ok) fetchData('payments');
        else {
          const data = await res.json() as any;
          setFormMessage({ type: 'error', text: data.error || "Erreur" });
        }
      }
    });
  };

  const handleRelock = (id: number) => {
    setPinConfirm({
      show: true,
      title: "Verrouiller la saison",
      description: "Veuillez confirmer avec votre code PIN administrateur.",
      onConfirm: async (pin) => {
        const res = await fetch(`/api/admin/payments/${id}/relock`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin })
        });
        if (res.ok) fetchData('payments');
        else {
          const data = await res.json() as any;
          setFormMessage({ type: 'error', text: data.error || "Erreur" });
        }
      }
    });
  };

  const handleRevoke = (id: number) => {
    setPinConfirm({
      show: true,
      title: "Révoquer le paiement",
      description: "Veuillez confirmer avec votre code PIN administrateur.",
      onConfirm: async (pin) => {
        const res = await fetch(`/api/admin/payments/${id}/revoke`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin })
        });
        if (res.ok) fetchData('payments');
        else {
          const data = await res.json() as any;
          setFormMessage({ type: 'error', text: data.error || "Erreur" });
        }
      }
    });
  };

  const handleImpersonate = (id: number) => {
    setPinConfirm({
      show: true,
      title: "Accéder au compte",
      description: "Vous allez être connecté en tant que cet utilisateur. Confirmez avec votre code PIN administrateur.",
      onConfirm: async (pin) => {
        const res = await fetch(`/api/admin/users/${id}/impersonate`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ pin })
        });
        const data = await res.json() as any;
        if (data.error) {
          setFormMessage({ type: 'error', text: data.error });
        } else {
          // Sauvegarder les identifiants admin pour pouvoir revenir
          localStorage.setItem('bmtv_admin_token', token || '');
          localStorage.setItem('bmtv_admin_user', JSON.stringify(user));
          
          localStorage.setItem('bmtv_token', data.token);
          localStorage.setItem('bmtv_user', JSON.stringify(data.user));
          window.location.href = '/';
        }
      }
    });
  };

  const handleUserStatus = (id: number, statut: string) => {
    setPinConfirm({
      show: true,
      title: statut === 'active' ? "Activer l'utilisateur" : "Bannir l'utilisateur",
      description: "Veuillez confirmer avec votre code PIN administrateur.",
      onConfirm: async (pin) => {
        const res = await fetch(`/api/admin/users/${id}/statut`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ statut, pin })
        });
        if (res.ok) fetchData('users');
        else {
          const data = await res.json() as any;
          setFormMessage({ type: 'error', text: data.error || "Erreur" });
        }
      }
    });
  };

  const handleUserRole = (id: number, role: string) => {
    setPinConfirm({
      show: true,
      title: "Changer le rôle",
      description: "Veuillez confirmer avec votre code PIN administrateur.",
      onConfirm: async (pin) => {
        const res = await fetch(`/api/admin/users/${id}/role`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ role, pin })
        });
        if (res.ok) fetchData('users');
        else {
          const data = await res.json() as any;
          setFormMessage({ type: 'error', text: data.error || "Erreur" });
        }
      }
    });
  };

  const handleUserPermissions = (id: number, permissions: string[]) => {
    setPinConfirm({
      show: true,
      title: "Gérer les permissions",
      description: "Veuillez confirmer avec votre code PIN propriétaire.",
      onConfirm: async (pin) => {
        const res = await fetch(`/api/admin/users/${id}/permissions`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissions, pin })
        });
        if (res.ok) fetchData('pinRequests');
        else {
          const data = await res.json() as any;
          setFormMessage({ type: 'error', text: data.error || "Erreur" });
        }
      }
    });
  };

  const handleApprovePinReset = (id: number) => {
    setPinConfirm({
      show: true,
      title: "Approuver la réinitialisation",
      description: "Veuillez entrer votre code PIN administrateur pour approuver cette demande de réinitialisation PIN.",
      onConfirm: async (pin) => {
        const res = await fetch(`/api/admin/pin-requests/${id}/approve`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ pin })
        });
        if (res.ok) {
          setFormMessage({ type: 'success', text: "Demande approuvée" });
          fetchData('pinRequests');
        } else {
          const data = await res.json() as any;
          setFormMessage({ type: 'error', text: data.error || "Erreur" });
        }
      }
    });
  };

  const handleRejectPinReset = (id: number) => {
    setPinConfirm({
      show: true,
      title: "Rejeter la réinitialisation",
      description: "Veuillez entrer votre code PIN administrateur pour rejeter cette demande de réinitialisation PIN.",
      onConfirm: async (pin) => {
        const res = await fetch(`/api/admin/pin-requests/${id}/reject`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ pin })
        });
        if (res.ok) {
          setFormMessage({ type: 'success', text: "Demande rejetée" });
          fetchData('pinRequests');
        } else {
          const data = await res.json() as any;
          setFormMessage({ type: 'error', text: data.error || "Erreur" });
        }
      }
    });
  };

  const handleEditSeries = (s: Series) => {
    setEditingId(s.id);
    setSeriesForm({
      titre: s.titre,
      description: s.description,
      image: s.image,
      banniere: s.banniere,
      genre: s.genre || '',
      langue: s.langue || '',
      statut: (s as any).statut || 'published'
    });
    setActiveForm('series');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteSeries = async (id: number) => {
    setConfirmModal({
      show: true,
      title: "Supprimer la série",
      message: "Êtes-vous sûr de vouloir supprimer cette série ? Cela supprimera également toutes ses saisons et épisodes.",
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/series/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            fetchData('series');
            toast.success("Série supprimée");
          }
        } catch (e) {
          console.error("Error deleting series:", e);
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const handleEditSeason = (s: Season & { titre_serie: string }) => {
    setEditingId(s.id);
    
    // Format ISO date back to datetime-local format (YYYY-MM-DDThh:mm)
    let displayDate = '';
    if (s.date_publication) {
      try {
        const date = new Date(s.date_publication);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        displayDate = `${year}-${month}-${day}T${hours}:${minutes}`;
      } catch (e) {
        displayDate = s.date_publication.substring(0, 16);
      }
    }

    setSeasonForm({
      id_serie: s.id_serie.toString(),
      numero: s.numero.toString(),
      prix: s.prix.toString(),
      titre: s.titre || '',
      statut: s.statut || 'published',
      date_publication: displayDate
    });
    setActiveForm('season');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteSeason = async (id: number) => {
    setConfirmModal({
      show: true,
      title: "Supprimer la saison",
      message: "Êtes-vous sûr de vouloir supprimer cette saison ? Cela supprimera également tous ses épisodes.",
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/seasons/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            fetchData('seasons');
            toast.success("Saison supprimée avec succès");
          } else {
            const data = await res.json() as any;
            toast.error(data.error || "Erreur lors de la suppression");
          }
        } catch (e) {
          console.error("Error deleting season:", e);
          toast.error("Erreur de connexion");
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const handleEditEpisode = (e: Episode & { titre_serie: string, numero_saison: number }) => {
    setEditingId(e.id);
    // We need to find the id_serie for this episode's season
    const season = adminSeasons.find(s => s.id === e.id_saison);
    setEpisodeForm({
      id_serie: season ? season.id_serie.toString() : '',
      id_saison: e.id_saison.toString(),
      titre: e.titre,
      url_video: e.url_video,
      statut: e.statut
    });
    if (season) {
      handleSeriesSelect(season.id_serie.toString());
    }
    setActiveForm('episode');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteEpisode = async (id: number) => {
    setConfirmModal({
      show: true,
      title: "Supprimer l'épisode",
      message: "Êtes-vous sûr de vouloir supprimer cet épisode ?",
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/episodes/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            fetchData('episodes');
            toast.success("Épisode supprimé");
          }
        } catch (e) {
          console.error("Error deleting episode:", e);
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const submitSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormMessage({ type: '', text: '' });
    try {
      const url = editingId ? `/api/admin/series/${editingId}` : '/api/admin/series';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(seriesForm)
      });
      if (res.ok) {
        setFormMessage({ type: 'success', text: editingId ? 'Série modifiée avec succès !' : 'Série ajoutée avec succès !' });
        if (!editingId) setSeriesForm({ titre: '', description: '', image: '', banniere: '', genre: '', langue: '', statut: 'published' });
        else setEditingId(null);
        fetchData();
      } else {
        setFormMessage({ type: 'error', text: 'Erreur lors de l\'opération.' });
      }
    } catch (e) {
      setFormMessage({ type: 'error', text: 'Erreur de connexion.' });
    } finally {
      setFormLoading(false);
    }
  };

  const submitSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormMessage({ type: '', text: '' });
    try {
      const url = editingId ? `/api/admin/seasons/${editingId}` : '/api/admin/seasons';
      const method = editingId ? 'PUT' : 'POST';
      
      // Convert local date to ISO for consistent backend storage
      let publicationDate = seasonForm.date_publication;
      if (publicationDate && seasonForm.statut === 'reserved') {
        try {
          publicationDate = new Date(publicationDate).toISOString();
        } catch (e) {
          console.error("Date formatting error:", e);
        }
      } else {
        publicationDate = null;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
          id_serie: Number(seasonForm.id_serie), 
          numero: Number(seasonForm.numero), 
          prix: Number(seasonForm.prix),
          titre: seasonForm.titre,
          statut: seasonForm.statut,
          date_publication: publicationDate
        })
      });
      if (res.ok) {
        setFormMessage({ type: 'success', text: editingId ? 'Saison modifiée avec succès !' : 'Saison ajoutée avec succès !' });
        if (!editingId) setSeasonForm({ id_serie: '', numero: '', prix: '', titre: '', statut: 'published', date_publication: '' });
        else setEditingId(null);
        fetchData();
      } else {
        setFormMessage({ type: 'error', text: 'Erreur lors de l\'opération.' });
      }
    } catch (e) {
      setFormMessage({ type: 'error', text: 'Erreur de connexion.' });
    } finally {
      setFormLoading(false);
    }
  };

  const submitEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormMessage({ type: '', text: '' });
    try {
      const url = editingId ? `/api/admin/episodes/${editingId}` : '/api/admin/episodes';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
          id_saison: Number(episodeForm.id_saison),
          titre: episodeForm.titre,
          url_video: episodeForm.url_video,
          statut: episodeForm.statut
        })
      });
      if (res.ok) {
        setFormMessage({ type: 'success', text: editingId ? 'Épisode modifié avec succès !' : 'Épisode ajouté avec succès !' });
        if (!editingId) setEpisodeForm({ id_serie: '', id_saison: '', titre: '', url_video: '', statut: 'locked' });
        else setEditingId(null);
        fetchData();
      } else {
        setFormMessage({ type: 'error', text: 'Erreur lors de l\'opération.' });
      }
    } catch (e) {
      setFormMessage({ type: 'error', text: 'Erreur de connexion.' });
    } finally {
      setFormLoading(false);
    }
  };

  const submitBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormMessage({ type: '', text: '' });
    try {
      const url = editingId ? `/api/admin/banners/${editingId}` : '/api/admin/banners';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          ...bannerForm,
          id_serie: bannerForm.id_serie ? Number(bannerForm.id_serie) : null
        })
      });
      if (res.ok) {
        setFormMessage({ type: 'success', text: editingId ? 'Bannière modifiée !' : 'Bannière ajoutée !' });
        if (!editingId) setBannerForm({ titre: '', image: '', id_serie: '', statut: 'active', type: 'image' });
        else setEditingId(null);
        fetchData();
      } else {
        setFormMessage({ type: 'error', text: 'Erreur lors de l\'opération.' });
      }
    } catch (e) {
      setFormMessage({ type: 'error', text: 'Erreur de connexion.' });
    } finally {
      setFormLoading(false);
    }
  };

  const submitSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormMessage({ type: '', text: '' });
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(settingForm)
      });
      if (res.ok) {
        setFormMessage({ type: 'success', text: 'Paramètre mis à jour !' });
        setSettingForm({ cle: '', valeur: '' });
        fetchData();
      } else {
        setFormMessage({ type: 'error', text: 'Erreur lors de l\'opération.' });
      }
    } catch (e) {
      setFormMessage({ type: 'error', text: 'Erreur de connexion.' });
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditBanner = (b: any) => {
    setEditingId(b.id);
    setBannerForm({
      titre: b.titre,
      image: b.image,
      id_serie: b.id_serie ? b.id_serie.toString() : '',
      statut: b.statut,
      type: b.type || 'image'
    });
    setActiveForm('banner');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteBanner = async (id: number) => {
    setConfirmModal({
      show: true,
      title: "Supprimer la bannière",
      message: "Supprimer cette bannière ?",
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/banners/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            fetchData();
            toast.success("Bannière supprimée");
          }
        } catch (e) {
          console.error("Error deleting banner:", e);
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const handleRestore = async (id: number, type: 'series' | 'season' | 'episode') => {
    try {
      const res = await fetch('/api/admin/trash/restore', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id, type })
      });
      if (res.ok) {
        toast.success("Élément restauré");
        fetchData('trash');
        fetchData(type === 'series' ? 'series' : type === 'season' ? 'seasons' : 'episodes');
      }
    } catch (e) {
      toast.error("Erreur lors de la restauration");
    }
  };

  const handlePermanentDelete = async (id: number, type: 'series' | 'season' | 'episode') => {
    setConfirmModal({
      show: true,
      title: "Suppression définitive",
      message: "Voulez-vous vraiment supprimer cet élément définitivement ? Cette action est irréversible.",
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/${type === 'series' ? 'series' : type === 'season' ? 'seasons' : 'episodes'}/${id}/permanent`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            toast.success("Élément supprimé définitivement");
            fetchData('trash');
          }
        } catch (e) {
          toast.error("Erreur lors de la suppression");
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const handleSeriesSelect = async (id_serie: string) => {
    if (activeForm === 'season') {
      setSeasonForm(prev => ({ ...prev, id_serie }));
    } else if (activeForm === 'episode') {
      setEpisodeForm(prev => ({ ...prev, id_serie, id_saison: '' }));
    }

    if (id_serie) {
      try {
        const res = await fetch(`/api/series/${id_serie}`);
        const data = await res.json() as any;
        setSeasonsList(data.saisons || []);
      } catch (e) {
        console.error("Error fetching seasons:", e);
        setSeasonsList([]);
      }
    } else {
      setSeasonsList([]);
    }
  };

  const Skeleton = ({ className }: { className?: string }) => (
    <div className={clsx("animate-pulse bg-zinc-800 rounded-lg", className)} />
  );

  return (
    <div className="min-h-screen bg-black text-white pb-32 select-none">
      <div className="max-w-4xl mx-auto px-6 py-8">
        
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-black text-red-600 tracking-tighter">MTV</h2>
          <button className="text-white p-2">
            <Menu size={24} />
          </button>
        </div>

        {/* Admin Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield size={24} className="text-red-600" />
            <h1 className="text-xl font-bold tracking-tight">Administration</h1>
            {(payments.filter(p => p.statut === 'pending').length > 0 || pinRequests.filter(r => r.statut === 'pending').length > 0) && (
              <div className="flex items-center gap-1.5 bg-red-600/10 border border-red-600/20 px-2 py-1 rounded-full animate-pulse">
                <Bell size={12} className="text-red-600" />
                <span className="text-[10px] font-black text-red-600 uppercase tracking-tighter">
                  {payments.filter(p => p.statut === 'pending').length + pinRequests.filter(r => r.statut === 'pending').length} Notification(s)
                </span>
              </div>
            )}
          </div>
          <button 
            onClick={() => fetchData()}
            className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
            title="Rafraîchir les données"
          >
            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Admin Grid Menu */}
        {activeTab === 'menu' && (
          <div className="grid grid-cols-2 gap-4">
            
            {/* GESTION DE MEDIA */}
            {hasPermission('media_gestion') && (
              <button 
                onClick={() => { changeTab('media_gestion'); setSelectedSeriesId(null); }}
                className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500 text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Folder size={24} />
                <span className="text-[10px] font-bold uppercase tracking-widest">MÉDIA</span>
              </button>
            )}

            {/* AJOUTER MEDIA */}
            {hasPermission('media_ajout') && (
              <button 
                onClick={() => { setEditingId(null); changeTab('media_ajout'); setActiveForm(null); }}
                className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus size={24} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-center">AJOUTER<br/>MEDIA</span>
              </button>
            )}

            {/* DÉBLOCAGE (DEMANDES DE PAIEMENT) */}
            {hasPermission('unlock') && (
              <button 
                onClick={() => changeTab('unlock')}
                className="relative flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {payments.filter(p => p.statut === 'pending').length > 0 && (
                  <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-lg animate-bounce">
                    {payments.filter(p => p.statut === 'pending').length}
                  </div>
                )}
                <Unlock size={24} />
                <span className="text-[10px] font-bold uppercase tracking-tight text-center leading-tight">
                  DEMANDES DE<br />PAIEMENT
                </span>
              </button>
            )}

            {/* PIN Reset */}
            {hasPermission('pin') && (
              <button 
                onClick={() => changeTab('pin')}
                className="relative flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-800 text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {pinRequests.filter(r => r.statut === 'pending').length > 0 && (
                  <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-lg animate-bounce">
                    {pinRequests.filter(r => r.statut === 'pending').length}
                  </div>
                )}
                <Key size={24} />
                <span className="text-[10px] font-bold uppercase tracking-widest">PIN Reset</span>
              </button>
            )}

            {/* Bannière */}
            {hasPermission('banner') && (
              <button 
                onClick={() => changeTab('banner')}
                className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-gradient-to-br from-slate-500 to-gray-600 text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Film size={24} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Bannière</span>
              </button>
            )}

            {/* STATISTIQUES */}
            {hasPermission('stats') && (
              <button 
                onClick={() => changeTab('stats')}
                className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-gradient-to-br from-red-500 to-rose-500 text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <BarChart3 size={24} />
                <span className="text-[10px] font-bold uppercase tracking-widest">STATS</span>
              </button>
            )}

            {/* UTILISATEURS */}
            {hasPermission('users') && (
              <button 
                onClick={() => changeTab('users')}
                className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-500 text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Users size={24} />
                <span className="text-[10px] font-bold uppercase tracking-widest">USERS</span>
              </button>
            )}

            {/* Paramètres */}
            {hasPermission('settings') && (
              <button 
                onClick={() => changeTab('settings')}
                className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-zinc-600 to-gray-700 text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Settings size={24} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-center">PARAMÈTRES</span>
              </button>
            )}

            {/* MESSAGES */}
            {hasPermission('messages') && (
              <button 
                onClick={() => changeTab('messages')}
                className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-gradient-to-br from-blue-500 to-sky-500 text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <MessageSquare size={24} />
                <span className="text-[10px] font-bold uppercase tracking-widest">MESSAGES</span>
              </button>
            )}

            {/* CORBEILLE */}
            <button 
              onClick={() => changeTab('trash')}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-gradient-to-br from-zinc-800 to-black text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] border border-white/5"
            >
              <Trash2 size={24} className="text-red-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-500">Corbeille</span>
            </button>

            {/* RÔLES */}
            {user?.role === 'owner' && (
              <button 
                onClick={() => changeTab('roles')}
                className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-gradient-to-br from-orange-600 to-red-600 text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Shield size={24} />
                <span className="text-[10px] font-bold uppercase tracking-widest">RÔLES</span>
              </button>
            )}

            {/* PAIEMENT LOG */}
            {hasPermission('payments_log') && (
              <button 
                onClick={() => changeTab('payments_log')}
                className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-gradient-to-br from-gray-600 to-gray-800 text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <History size={24} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-center">PAIEMENT LOG</span>
              </button>
            )}

            {/* STOCK */}
            {hasPermission('media_ajout') && (
              <button 
                onClick={() => changeTab('stock')}
                className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-800 border-2 border-indigo-400/30 text-white shadow-xl transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Box size={24} />
                <span className="text-[10px] font-black uppercase tracking-widest text-center">STOCK</span>
              </button>
            )}

            {/* Quitter */}
            <button 
              onClick={() => navigate('/')}
              className="col-span-2 flex items-center justify-center gap-3 p-6 rounded-2xl bg-zinc-900 border border-white/10 text-red-500 hover:bg-zinc-800 transition-all text-xs font-black uppercase tracking-widest"
            >
              <ArrowLeft size={20} />
              Quitter l'administration
            </button>
          </div>
        )}

        {/* Dynamic Content Area */}
        <AnimatePresence mode="wait">
          {activeTab !== 'menu' && (
            <div className="mb-8">
              <button 
                onClick={() => { 
                  if (activeForm) setActiveForm(null);
                  else if (activeTab === 'media_gestion' && selectedSeriesId) setSelectedSeriesId(null);
                  else { changeTab('menu'); setActiveForm(null); }
                }}
                className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-6 font-bold text-sm"
              >
                <ArrowLeft size={16} />
                Retour au menu
              </button>
            </div>
          )}

          {activeTab === 'payments_log' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <History size={24} className="text-gray-400" />
                  <h2 className="text-2xl font-black text-white uppercase tracking-widest">Paiement Log</h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-gray-400">
                        <th className="p-4">Date</th>
                        <th className="p-4">Téléphone</th>
                        <th className="p-4">Montant</th>
                        <th className="p-4">Statut</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {paymentsLog.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-gray-500 text-xs font-bold uppercase">Aucun log trouvé</td>
                        </tr>
                      ) : (
                        paymentsLog.map((log) => (
                          <tr key={log.id} className="hover:bg-white/5 transition-colors group">
                            <td className="p-4 text-[10px] font-bold text-gray-400">
                              {new Date(log.date_creation).toLocaleString()}
                            </td>
                            <td className="p-4 text-xs font-black">{log.telephone}</td>
                            <td className="p-4 text-xs font-black text-emerald-500">{log.montant} GNF</td>
                            <td className="p-4">
                              <span className={cn(
                                "text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-tighter",
                                log.statut === 'received' ? "bg-blue-500/10 text-blue-500" : "bg-emerald-500/10 text-emerald-500"
                              )}>
                                {log.statut}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <button 
                                onClick={() => handleDeletePaymentLog(log.id)}
                                className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'media_gestion' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* GESTION Header */}
              <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <Folder size={24} className="text-yellow-500" />
                  <h2 className="text-2xl font-black text-yellow-500 uppercase tracking-widest">MÉDIA</h2>
                </div>

                <div className="space-y-6">
                  {!selectedSeriesId ? (
                    <>
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input 
                          type="text"
                          placeholder="Rechercher une série..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm focus:border-yellow-500 outline-none transition-all"
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 gap-4">
                        {seriesList
                          .filter(s => s.titre.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map(s => (
                            <div key={s.id} className="bg-zinc-900/80 border border-white/5 rounded-xl overflow-hidden hover:border-yellow-500/30 transition-all">
                              <div className="p-3 flex items-center justify-between group">
                                <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => setSelectedSeriesId(s.id)}>
                                  <div className="w-10 h-14 rounded-lg overflow-hidden border border-white/10 flex-shrink-0">
                                    <img src={s.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" draggable="false" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleEditSeries(s); changeTab('media_ajout'); }}
                                        className="p-1.5 bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white rounded-lg transition-all"
                                        title="Modifier la série"
                                      >
                                        <Pencil size={12} />
                                      </button>
                                      <div className="text-base font-bold text-white truncate">{s.titre}</div>
                                    </div>
                                    <div className="text-[10px] text-gray-500 truncate">{s.description}</div>
                                  </div>
                                  <ChevronRight size={18} className="text-gray-500 group-hover:text-yellow-500 transition-colors" />
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                  <button 
                                    onClick={() => handleDeleteSeries(s.id)}
                                    className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                                    title="Supprimer la série"
                                  >
                                    <XCircle size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-6">
                      <button 
                        onClick={() => setSelectedSeriesId(null)}
                        className="flex items-center gap-2 text-xs font-black text-gray-500 hover:text-white uppercase tracking-widest transition-colors mb-4"
                      >
                        <ArrowLeft size={16} />
                        Retour à la liste des séries
                      </button>

                      {seriesList.filter(s => s.id === selectedSeriesId).map(s => (
                        <div key={s.id} className="space-y-4">
                          <div className="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                            <div className="w-12 h-16 rounded-lg overflow-hidden border border-white/10">
                              <img src={s.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <button 
                                  onClick={() => { handleEditSeries(s); changeTab('media_ajout'); }}
                                  className="p-1.5 bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white rounded-lg transition-all"
                                  title="Modifier la série"
                                >
                                  <Pencil size={14} />
                                </button>
                                <h3 className="text-lg font-black text-white uppercase">{s.titre}</h3>
                                <div className="flex gap-1 ml-auto">
                                  {((s as any).statut === 'draft' || (s as any).statut === 'reserved') && (
                                    <span className={cn(
                                      "text-[8px] font-black px-2 py-0.5 rounded-full border uppercase tracking-widest",
                                      (s as any).statut === 'draft' ? "text-orange-500 bg-orange-500/10 border-orange-500/20" : "text-blue-500 bg-blue-500/10 border-blue-500/20"
                                    )}>
                                      {(s as any).statut === 'draft' ? 'Brouillon' : 'En réserve'}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="text-[10px] text-gray-400 line-clamp-2">{s.description}</p>
                            </div>
                          </div>

                          <div className="space-y-4">
                            {adminSeasons
                              .filter(season => season.id_serie === s.id)
                              .map(season => (
                                <div key={season.id} className="bg-zinc-900/50 border border-white/5 rounded-xl overflow-hidden">
                                  <div className="p-2 flex items-center justify-between hover:bg-white/5 transition-colors group">
                                    <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => setExpandedAdminSeasonId(expandedAdminSeasonId === season.id ? null : season.id)}>
                                      <Film size={14} className="text-emerald-500" />
                                      <div className="flex-1">
                                        <div className="text-xs font-bold text-white/90 flex items-center gap-2">
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); handleEditSeason(season); changeTab('media_ajout'); }}
                                            className="p-1 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-lg transition-all"
                                            title="Modifier la saison"
                                          >
                                            <Pencil size={10} />
                                          </button>
                                          Saison {season.numero} {season.titre && `— ${season.titre}`}
                                          {((season as any).statut === 'draft' || (season as any).statut === 'reserved') && (
                                            <span className={cn(
                                              "text-[7px] font-black px-1.5 py-0.5 rounded-full border uppercase tracking-widest",
                                              (season as any).statut === 'draft' ? "text-orange-500 bg-orange-500/10 border-orange-500/20" : "text-blue-500 bg-blue-500/10 border-blue-500/20"
                                            )}>
                                              {(season as any).statut === 'draft' ? 'Brouillon' : 'En réserve'}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <div className="text-[8px] text-gray-500 font-black uppercase">{season.prix} {settingsRecord.app_currency || 'GNF'}</div>
                                          {season.statut === 'reserved' && season.date_publication && (
                                            <div className="text-[7px] text-blue-500 font-black uppercase">
                                              Publie le: {new Date(season.date_publication).toLocaleString()}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <ChevronDown size={14} className={cn("text-gray-500 transition-transform", expandedAdminSeasonId === season.id ? "rotate-180" : "")} />
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                      <button 
                                        onClick={() => handleDeleteSeason(season.id)}
                                        className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                                        title="Supprimer la saison"
                                      >
                                        <XCircle size={12} />
                                      </button>
                                    </div>
                                  </div>

                                  <AnimatePresence>
                                    {expandedAdminSeasonId === season.id && (
                                      <motion.div 
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="border-t border-white/5 bg-black/40"
                                      >
                                        <div className="p-2 space-y-2">
                                          {adminEpisodes
                                            .filter(ep => ep.id_saison === season.id)
                                            .map(ep => (
                                              <div key={ep.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors group">
                                                <div className="flex items-center gap-2 flex-1">
                                                  <Play size={12} className="text-yellow-500" />
                                                  <div className="flex-1">
                                                    <div className="text-[11px] font-medium text-gray-300 flex items-center gap-2">
                                                      <button 
                                                        onClick={() => { handleEditEpisode(ep); changeTab('media_ajout'); }}
                                                        className="p-1 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500 hover:text-black rounded-lg transition-all"
                                                        title="Modifier l'épisode"
                                                      >
                                                        <Pencil size={8} />
                                                      </button>
                                                      {ep.titre}
                                                      {((ep as any).statut === 'draft' || (ep as any).statut === 'reserved') && (
                                                        <span className={cn(
                                                          "text-[7px] font-black px-1.5 py-0.5 rounded-full border uppercase tracking-widest",
                                                          (ep as any).statut === 'draft' ? "text-orange-500 bg-orange-500/10 border-orange-500/20" : "text-blue-500 bg-blue-500/10 border-blue-500/20"
                                                        )}>
                                                          {(ep as any).statut === 'draft' ? 'Brouillon' : 'En réserve'}
                                                        </span>
                                                      )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                      {ep.statut === 'locked' ? <Lock size={8} className="text-red-500" /> : <Unlock size={8} className="text-emerald-500" />}
                                                      <span className="text-[8px] font-black text-gray-600 uppercase">{ep.statut === 'locked' ? 'PAYANT' : 'GRATUIT'}</span>
                                                    </div>
                                                  </div>
                                                </div>
                                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                  <button 
                                                    onClick={() => handleDeleteEpisode(ep.id)}
                                                    className="p-1 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                                                    title="Supprimer l'épisode"
                                                  >
                                                    <XCircle size={10} />
                                                  </button>
                                                </div>
                                              </div>
                                            ))}
                                          {adminEpisodes.filter(ep => ep.id_saison === season.id).length === 0 && (
                                            <div className="p-4 text-center text-[10px] text-gray-600 italic">Aucun épisode dans cette saison</div>
                                          )}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              ))}
                            {adminSeasons.filter(season => season.id_serie === s.id).length === 0 && (
                              <div className="p-6 text-center text-xs text-gray-600 italic">Aucune saison trouvée pour cette série</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'media_ajout' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {!editingId && (
                <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-2xl">
                  <div className="flex items-center gap-3 mb-6">
                    <Plus size={24} className="text-emerald-500" />
                    <h2 className="text-2xl font-black text-emerald-500 uppercase tracking-widest">AJOUTER MEDIA</h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <button 
                      onClick={() => setActiveForm('series')}
                      className={cn(
                        "flex flex-col items-center justify-center gap-3 p-6 rounded-3xl border transition-all group",
                        activeForm === 'series' ? "bg-indigo-600 text-white border-indigo-600 shadow-2xl shadow-indigo-600/40" : "bg-zinc-900/50 border-white/5 text-indigo-500/80 hover:bg-zinc-900/80 hover:border-indigo-500/30"
                      )}
                    >
                      <div className={cn(
                        "p-4 rounded-2xl transition-all",
                        activeForm === 'series' ? "bg-white/20" : "bg-indigo-500/10 group-hover:bg-indigo-500/20"
                      )}>
                        <Tv size={32} />
                      </div>
                      <span className="text-sm font-black uppercase tracking-widest">SÉRIES</span>
                    </button>
                    <button 
                      onClick={() => setActiveForm('season')}
                      className={cn(
                        "flex flex-col items-center justify-center gap-3 p-6 rounded-3xl border transition-all group",
                        activeForm === 'season' ? "bg-emerald-600 text-white border-emerald-600 shadow-2xl shadow-emerald-600/40" : "bg-zinc-900/50 border-white/5 text-emerald-500/80 hover:bg-zinc-900/80 hover:border-emerald-500/30"
                      )}
                    >
                      <div className={cn(
                        "p-4 rounded-2xl transition-all",
                        activeForm === 'season' ? "bg-white/20" : "bg-emerald-500/10 group-hover:bg-emerald-500/20"
                      )}>
                        <Film size={32} />
                      </div>
                      <span className="text-sm font-black uppercase tracking-widest">SAISONS</span>
                    </button>
                    <button 
                      onClick={() => setActiveForm('episode')}
                      className={cn(
                        "flex flex-col items-center justify-center gap-3 p-6 rounded-3xl border transition-all group",
                        activeForm === 'episode' ? "bg-yellow-500 text-black border-yellow-500 shadow-2xl shadow-yellow-500/40" : "bg-zinc-900/50 border-white/5 text-yellow-500/80 hover:bg-zinc-900/80 hover:border-yellow-500/30"
                      )}
                    >
                      <div className={cn(
                        "p-4 rounded-2xl transition-all",
                        activeForm === 'episode' ? "bg-black/20" : "bg-yellow-500/10 group-hover:bg-yellow-500/20"
                      )}>
                        <Play size={32} />
                      </div>
                      <span className="text-sm font-black uppercase tracking-widest">ÉPISODES</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Media Forms */}
              <AnimatePresence mode="wait">
                {activeForm && (
                  <motion.div 
                    key={activeForm}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-zinc-900/40 rounded-2xl border border-white/5 p-6 shadow-2xl"
                  >
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        {activeForm === 'series' && <Tv size={24} className="text-indigo-500" />}
                        {activeForm === 'season' && <Film size={24} className="text-indigo-500" />}
                        {activeForm === 'episode' && <Play size={24} className="text-indigo-500" />}
                        <h2 className="text-2xl font-black tracking-tight">
                          {editingId ? "Modifier" : "Ajouter"} {activeForm === 'series' ? "la série" : 
                           activeForm === 'season' ? "la saison" : 
                           "l'épisode"}
                        </h2>
                      </div>
                      {editingId && (
                        <button 
                          onClick={() => {
                            setEditingId(null);
                            setSeriesForm({ titre: '', description: '', image: '', banniere: '', genre: '', langue: '', statut: 'published' });
                            setSeasonForm({ id_serie: '', numero: '', prix: '', titre: '', statut: 'published', date_publication: '' });
                            setEpisodeForm({ id_serie: '', id_saison: '', titre: '', url_video: '', statut: 'locked' });
                          }}
                          className="text-xs font-bold text-gray-500 hover:text-white transition-colors"
                        >
                          Annuler la modification
                        </button>
                      )}
                    </div>

                    {formMessage.text && (
                      <div className={cn(
                        "p-4 rounded-xl mb-6 text-xs font-bold flex items-center gap-3",
                        formMessage.type === 'success' ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-500" : "bg-red-500/10 border border-red-500/20 text-red-500"
                      )}>
                        {formMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                        {formMessage.text}
                      </div>
                    )}

                    {activeForm === 'series' && (
                      <>
                        <form onSubmit={submitSeries} className="space-y-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Titre de la série</label>
                            <input 
                              type="text" 
                              required
                              value={seriesForm.titre}
                              onChange={e => setSeriesForm({...seriesForm, titre: e.target.value})}
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-4 text-white focus:border-indigo-500 transition-all"
                              placeholder="e.g. La Casa de Papel"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Description</label>
                            <textarea 
                              required
                              value={seriesForm.description}
                              onChange={e => setSeriesForm({...seriesForm, description: e.target.value})}
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-4 text-white focus:border-indigo-500 transition-all min-h-[120px]"
                              placeholder="Bref synopsis..."
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Genre</label>
                              <input 
                                type="text" 
                                value={seriesForm.genre || ''}
                                onChange={e => setSeriesForm({...seriesForm, genre: e.target.value})}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-4 text-white focus:border-indigo-500 transition-all"
                                placeholder="e.g. Action, Drame"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Langue</label>
                              <input 
                                type="text" 
                                value={seriesForm.langue || ''}
                                onChange={e => setSeriesForm({...seriesForm, langue: e.target.value})}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-4 text-white focus:border-indigo-500 transition-all"
                                placeholder="e.g. Français, VOSTFR"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Image (Poster)</label>
                              <input 
                                type="url" 
                                required
                                value={seriesForm.image}
                                onChange={e => setSeriesForm({...seriesForm, image: e.target.value})}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-4 text-white focus:border-indigo-500 transition-all"
                                placeholder="URL de l'image"
                              />
                            </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Bannière</label>
                              <input 
                                type="url" 
                                required
                                value={seriesForm.banniere}
                                onChange={e => setSeriesForm({...seriesForm, banniere: e.target.value})}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-4 text-white focus:border-indigo-500 transition-all"
                                placeholder="URL de la bannière"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Statut de publication</label>
                              <div className="relative">
                                <select 
                                  value={seriesForm.statut}
                                  onChange={e => setSeriesForm({...seriesForm, statut: e.target.value as any})}
                                  className="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-4 text-white focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                                >
                                  <option value="published" className="bg-zinc-900">Publié (Visible)</option>
                                  <option value="reserved" className="bg-zinc-900">En réserve (Compte à rebours)</option>
                                  <option value="draft" className="bg-zinc-900">Brouillon (Archivé/Caché)</option>
                                </select>
                                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                  <ChevronDown size={18} />
                                </div>
                              </div>
                            </div>
                          </div>
                          </div>
                          <button 
                            type="submit" 
                            disabled={formLoading}
                            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-4 rounded-xl font-black transition-all flex items-center justify-center gap-2"
                          >
                            {editingId ? <RefreshCw size={18} /> : <Plus size={18} />}
                            {editingId ? "MODIFIER LA SÉRIE" : "AJOUTER LA SÉRIE"}
                          </button>
                        </form>
                      </>
                    )}

                    {activeForm === 'season' && (
                      <div className="space-y-8">
                        <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-2xl space-y-6">
                          <h3 className="text-sm font-bold text-white/80">Ajouter une saison</h3>
                          <form onSubmit={submitSeason} className="space-y-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Série *</label>
                              <div className="relative">
                                <select 
                                  required
                                  value={seasonForm.id_serie}
                                  onChange={e => handleSeriesSelect(e.target.value)}
                                  className="w-full bg-black/60 border border-white/10 rounded-xl px-5 py-4 text-white focus:border-red-500 transition-all appearance-none cursor-pointer z-10"
                                >
                                  <option value="" className="bg-zinc-900 text-white">{seriesList.length === 0 ? "Aucune série trouvée" : "Sélectionner une série"}</option>
                                  {seriesList.map(s => (
                                    <option key={s.id} value={s.id.toString()} className="bg-zinc-900 text-white">
                                      {s.titre}
                                    </option>
                                  ))}
                                </select>
                                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 z-20">
                                  <ChevronDown size={18} />
                                </div>
                              </div>
                              {seriesList.length === 0 && (
                                <p className="text-[10px] text-red-500 mt-1 ml-1">Veuillez d'abord ajouter une série dans l'onglet "SÉRIES".</p>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">N° Saison *</label>
                                <input 
                                  type="number" 
                                  required
                                  value={seasonForm.numero}
                                  onChange={e => setSeasonForm({...seasonForm, numero: e.target.value})}
                                  className="w-full bg-black/60 border border-white/10 rounded-xl px-5 py-4 text-white focus:border-red-500 transition-all"
                                  placeholder="e.g. 1"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Prix ({settingsRecord.app_currency || 'GNF'}) *</label>
                                <input 
                                  type="number" 
                                  required
                                  value={seasonForm.prix}
                                  onChange={e => setSeasonForm({...seasonForm, prix: e.target.value})}
                                  className="w-full bg-black/60 border border-white/10 rounded-xl px-5 py-4 text-white focus:border-red-500 transition-all"
                                  placeholder="e.g. 50000"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Titre</label>
                                <input 
                                  type="text" 
                                  value={seasonForm.titre}
                                  onChange={e => setSeasonForm({...seasonForm, titre: e.target.value})}
                                  className="w-full bg-black/60 border border-white/10 rounded-xl px-5 py-4 text-white focus:border-red-500 transition-all"
                                  placeholder="Optionnel"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Statut</label>
                                <div className="relative">
                                  <select 
                                    value={seasonForm.statut}
                                    onChange={e => setSeasonForm({...seasonForm, statut: e.target.value as any})}
                                    className="w-full bg-black/60 border border-white/10 rounded-xl px-5 py-4 text-white focus:border-red-500 transition-all appearance-none cursor-pointer"
                                  >
                                    <option value="published" className="bg-zinc-900">Publié (Tout le monde)</option>
                                    <option value="reserved" className="bg-zinc-900">En réserve (Compte à rebours)</option>
                                    <option value="draft" className="bg-zinc-900">Brouillon (Caché)</option>
                                  </select>
                                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                    <ChevronDown size={18} />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {seasonForm.statut === 'reserved' && (
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Date de publication automatique</label>
                                <input 
                                  type="datetime-local" 
                                  required
                                  value={seasonForm.date_publication}
                                  onChange={e => setSeasonForm({...seasonForm, date_publication: e.target.value})}
                                  className="w-full bg-black/60 border border-white/10 rounded-xl px-5 py-4 text-white focus:border-red-500 transition-all font-bold"
                                />
                                <p className="text-[10px] text-gray-400 mt-1 italic">La saison passera automatiquement en statut "Publié" à cette date.</p>
                              </div>
                            )}

                            <button 
                              type="submit" 
                              disabled={formLoading}
                              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-4 rounded-xl font-black transition-all flex items-center justify-center gap-2"
                            >
                              {editingId ? <RefreshCw size={18} /> : <Plus size={18} />}
                              {editingId ? "MODIFIER LA SAISON" : "AJOUTER LA SAISON"}
                            </button>
                          </form>
                        </div>
                      </div>
                    )}

                    {activeForm === 'episode' && (
                      <div className="space-y-8">
                        <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-2xl space-y-6">
                          <h3 className="text-sm font-bold text-white/80">Ajouter un épisode</h3>
                          <form onSubmit={submitEpisode} className="space-y-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Série *</label>
                              <div className="relative">
                                <select 
                                  required
                                  value={episodeForm.id_serie}
                                  onChange={e => handleSeriesSelect(e.target.value)}
                                  className="w-full bg-black/60 border border-white/10 rounded-xl px-5 py-4 text-white focus:border-red-500 transition-all appearance-none cursor-pointer z-10"
                                >
                                  <option value="" className="bg-zinc-900 text-white">{seriesList.length === 0 ? "Aucune série trouvée" : "Sélectionner une série"}</option>
                                  {seriesList.map(s => (
                                    <option key={s.id} value={s.id.toString()} className="bg-zinc-900 text-white">
                                      {s.titre}
                                    </option>
                                  ))}
                                </select>
                                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 z-20">
                                  <ChevronDown size={18} />
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Saison *</label>
                              <div className="relative">
                                <select 
                                  required
                                  disabled={!episodeForm.id_serie}
                                  value={episodeForm.id_saison}
                                  onChange={e => setEpisodeForm({...episodeForm, id_saison: e.target.value})}
                                  className="w-full bg-black/60 border border-white/10 rounded-xl px-5 py-4 text-white focus:border-red-500 transition-all appearance-none disabled:opacity-30 cursor-pointer"
                                >
                                  <option value="">{!episodeForm.id_serie ? "Choisissez d'abord une série" : seasonsList.length === 0 ? "Aucune saison trouvée" : "Sélectionner une saison"}</option>
                                  {seasonsList.map(s => (
                                    <option key={s.id} value={s.id.toString()} className="bg-zinc-900 text-white">
                                      Saison {s.numero} {s.titre && `— ${s.titre}`} {s.statut !== 'published' ? `(EN RÉSERVE)` : ''}
                                    </option>
                                  ))}
                                </select>
                                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                  <ChevronDown size={18} />
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Titre *</label>
                              <input 
                                type="text" 
                                required
                                value={episodeForm.titre}
                                onChange={e => setEpisodeForm({...episodeForm, titre: e.target.value})}
                                className="w-full bg-black/60 border border-white/10 rounded-xl px-5 py-4 text-white focus:border-red-500 transition-all"
                                placeholder="e.g. Épisode 1"
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">URL Vidéo *</label>
                              <div className="space-y-4">
                                <div className="flex gap-4">
                                  <textarea 
                                    required
                                    value={episodeForm.url_video}
                                    onChange={e => setEpisodeForm({...episodeForm, url_video: e.target.value})}
                                    className="flex-1 bg-black/60 border border-white/10 rounded-xl px-5 py-4 text-white focus:border-red-500 transition-all min-h-[100px] resize-y"
                                    placeholder="Lien direct (.mp4), YouTube, Vimeo, ScreenPal ou code Embed (iframe)"
                                  />
                                  <div className="flex flex-col gap-2">
                                    <label className={cn(
                                      "cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-white p-4 rounded-xl transition-all flex flex-col items-center justify-center gap-2 border border-white/5",
                                      isUploading && "opacity-50 cursor-not-allowed"
                                    )}>
                                      <Upload size={20} />
                                      <span className="text-[8px] font-black uppercase tracking-widest">Uploader</span>
                                      <input 
                                        type="file" 
                                        className="hidden" 
                                        accept="video/*"
                                        onChange={handleFileUpload}
                                        disabled={isUploading}
                                      />
                                    </label>
                                  </div>
                                </div>
                                
                                {uploadProgress !== null && (
                                  <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">
                                      <span>Upload en cours...</span>
                                      <span>{uploadProgress}%</span>
                                    </div>
                                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                                      <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${uploadProgress}%` }}
                                        className="h-full bg-red-600"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="space-y-3">
                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Statut de l'épisode</label>
                              <div className="grid grid-cols-2 gap-4 mb-4">
                                <button 
                                  type="button"
                                  onClick={() => setEpisodeForm({...episodeForm, statut: 'unlocked'})}
                                  className={cn(
                                    "flex items-center justify-center gap-3 py-4 rounded-xl border transition-all font-black text-xs",
                                    episodeForm.statut === 'unlocked' ? "bg-emerald-500 border-emerald-500 text-white" : "bg-black/40 border-white/10 text-gray-500 hover:border-white/20"
                                  )}
                                >
                                  <Unlock size={18} />
                                  GRATUIT
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => setEpisodeForm({...episodeForm, statut: 'locked'})}
                                  className={cn(
                                    "flex items-center justify-center gap-3 py-4 rounded-xl border transition-all font-black text-xs",
                                    episodeForm.statut === 'locked' ? "bg-red-500 border-red-500 text-white" : "bg-black/40 border-white/10 text-gray-500 hover:border-white/20"
                                  )}
                                >
                                  <Lock size={18} />
                                  VERROUILLÉ
                                </button>
                              </div>
                              <div className="relative">
                                <select 
                                  value={episodeForm.statut}
                                  onChange={e => setEpisodeForm({...episodeForm, statut: e.target.value as any})}
                                  className="w-full bg-black/60 border border-white/10 rounded-xl px-5 py-4 text-white focus:border-red-500 transition-all appearance-none cursor-pointer"
                                >
                                  <option value={episodeForm.statut === 'unlocked' ? 'unlocked' : 'locked'} className="bg-zinc-900">
                                    {episodeForm.statut === 'unlocked' ? 'Publié (Gratuit)' : 'Publié (Verrouillé)'}
                                  </option>
                                  <option value="draft" className="bg-zinc-900">En réserve (Caché)</option>
                                  <option value="reserved" className="bg-zinc-900">Dépublié (Archivé)</option>
                                </select>
                                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                  <ChevronDown size={18} />
                                </div>
                              </div>
                            </div>

                            <button 
                              type="submit" 
                              disabled={formLoading}
                              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-4 rounded-xl font-black transition-all flex items-center justify-center gap-2"
                            >
                              {editingId ? <RefreshCw size={18} /> : <Plus size={18} />}
                              {editingId ? "MODIFIER L'ÉPISODE" : "AJOUTER L'ÉPISODE"}
                            </button>
                          </form>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div 
              key="users"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-zinc-900/40 rounded-2xl border border-white/5 overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 bg-black/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-xl font-black tracking-tight uppercase">Gestion des membres</h2>
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input 
                    type="text"
                    placeholder="Rechercher un utilisateur (nom, téléphone)..."
                    value={searchUsers}
                    onChange={e => setSearchUsers(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-xl pl-12 pr-4 py-2 text-sm focus:border-red-500 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 bg-black/40">
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Membre / Téléphone</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Rôle</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Statut</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {loadingStates.users ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b border-white/5">
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-2">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-3 w-24" />
                            </div>
                          </td>
                          <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-6 w-16 rounded-md" /></td>
                          <td className="px-6 py-4 text-right"><Skeleton className="h-8 w-24 ml-auto rounded-lg" /></td>
                        </tr>
                      ))
                    ) : users
                      .filter(u => 
                        u.telephone.includes(searchUsers) || 
                        (u.prenom && u.prenom.toLowerCase().includes(searchUsers.toLowerCase())) || 
                        (u.nom && u.nom.toLowerCase().includes(searchUsers.toLowerCase()))
                      ).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-gray-500 italic text-sm">Aucun utilisateur trouvé</td>
                      </tr>
                    ) : (
                      users
                        .filter(u => 
                          u.telephone.includes(searchUsers) || 
                          (u.prenom && u.prenom.toLowerCase().includes(searchUsers.toLowerCase())) || 
                          (u.nom && u.nom.toLowerCase().includes(searchUsers.toLowerCase()))
                        )
                        .map((u) => (
                        <tr key={u.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-sm text-white">
                                {u.prenom || ''} {u.nom || ''}
                                {(!u.prenom && !u.nom) && <span className="text-gray-500 italic font-normal">Sans nom</span>}
                              </span>
                              <span className="text-[10px] text-gray-500 font-medium tracking-wider">{u.telephone}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">{u.role}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md border",
                              u.statut === 'active' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"
                            )}>
                              {u.statut}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              {user?.role === 'owner' && u.role !== 'owner' && (
                                <button 
                                  onClick={() => handleUserRole(u.id, u.role === 'admin' ? 'user' : 'admin')}
                                  className="text-[8px] font-black uppercase tracking-widest bg-zinc-800 hover:bg-white hover:text-black px-3 py-1.5 rounded-md transition-all shadow-sm"
                                  title={u.role === 'admin' ? "Révoquer l'accès admin" : "Nommer administrateur"}
                                >
                                  {u.role === 'admin' ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
                                </button>
                              )}
                              {u.role !== 'owner' && (
                                <button 
                                  onClick={() => handleUserStatus(u.id, u.statut === 'active' ? 'suspended' : 'active')}
                                  className={cn(
                                    "p-1.5 rounded-md transition-all border",
                                    u.statut === 'active' ? "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500 hover:text-white" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500 hover:text-white"
                                  )}
                                  title={u.statut === 'active' ? "Bannir" : "Débannir"}
                                >
                                  {u.statut === 'active' ? <UserX size={14} /> : <UserCheck size={14} />}
                                </button>
                              )}
                              <button 
                                onClick={() => handleImpersonate(u.id)}
                                className="p-1.5 bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 hover:bg-indigo-500 hover:text-white rounded-md transition-all"
                                title="Accéder au compte"
                              >
                                <ExternalLink size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'unlock' && (
            <motion.div 
              key="unlock"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <Unlock size={24} className="text-emerald-500" />
                  <h2 className="text-xl font-black tracking-tight uppercase leading-tight">
                    DEMANDES DE PAIEMENT<br />
                    <span className="text-xs text-gray-400">Gérer les accès payants</span>
                  </h2>
                </div>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input 
                    type="text"
                    placeholder="Rechercher un utilisateur (Nom ou Tel)..."
                    value={searchPayments}
                    onChange={e => setSearchPayments(e.target.value)}
                    className="w-full md:w-64 bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {payments.filter(p => {
                  if (!searchPayments) return true;
                  const q = searchPayments.toLowerCase();
                  return (p.nom_utilisateur?.toLowerCase().includes(q) || p.telephone?.includes(q) || p.numero_paiement?.includes(q));
                }).length === 0 ? (
                  <div className="bg-zinc-900/40 p-12 rounded-2xl border border-white/5 text-center text-gray-500 italic">
                    Aucune demande trouvée
                  </div>
                ) : (
                  payments
                    .filter(p => {
                      if (!searchPayments) return true;
                      const q = searchPayments.toLowerCase();
                      return (p.nom_utilisateur?.toLowerCase().includes(q) || p.telephone?.includes(q) || p.numero_paiement?.includes(q));
                    })
                    .map((p) => (
                    <div key={p.id} className="bg-zinc-900/60 border border-white/5 rounded-2xl p-4 shadow-xl">
                      <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div className="space-y-3 flex-1">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500">
                              <UserIcon size={16} />
                            </div>
                            <div>
                              <h3 className="font-black text-sm text-white uppercase tracking-tight">{p.nom_utilisateur || "Utilisateur inconnu"}</h3>
                              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">{p.telephone}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-black/40 p-2 rounded-xl border border-white/5 col-span-2">
                              <p className="text-[7px] text-gray-500 uppercase font-black mb-0.5">Série</p>
                              <p className="text-xs font-bold text-white truncate">{p.titre_serie}</p>
                            </div>
                            <div className="bg-black/40 p-2 rounded-xl border border-white/5">
                              <p className="text-[7px] text-gray-500 uppercase font-black mb-0.5">Saison</p>
                              <p className="text-[10px] font-bold text-white">Saison {p.numero_saison}</p>
                            </div>
                            <div className="bg-black/40 p-2 rounded-xl border border-white/5">
                              <p className="text-[7px] text-gray-500 uppercase font-black mb-0.5">Prix</p>
                              <p className="text-[10px] font-bold text-emerald-500">{Number(p.prix).toLocaleString('en-US', { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2 })}{settingsRecord.app_currency || 'GNF'}</p>
                            </div>
                            <div className="bg-black/40 p-2 rounded-xl border border-white/5">
                              <p className="text-[7px] text-gray-500 uppercase font-black mb-0.5">Date</p>
                              <p className="text-[9px] font-bold text-gray-400">{new Date(p.date).toLocaleDateString('fr-FR')} {new Date(p.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                            <div className="bg-black/40 p-2 rounded-xl border border-white/5">
                              <p className="text-[7px] text-gray-500 uppercase font-black mb-0.5">Numéro de paiement</p>
                              <p className="text-[10px] font-black text-orange-500 tracking-widest">{p.numero_paiement || "XXXXXXXXX"}</p>
                            </div>
                            {p.solde_apres_paiement && (
                              <div className="bg-black/40 p-2 rounded-xl border border-white/5">
                                <p className="text-[7px] text-gray-500 uppercase font-black mb-0.5">Solde après paiement</p>
                                <p className="text-[10px] font-black text-emerald-500 tracking-widest">{p.solde_apres_paiement} {settingsRecord.app_currency || 'GNF'}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-row md:flex-col gap-2 justify-end">
                          {p.statut === 'pending' ? (
                            <>
                              <button 
                                onClick={() => handleApprove(p.id)}
                                className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20"
                              >
                                DÉVERROUILLÉ
                              </button>
                              <button 
                                onClick={() => handleReject(p.id)}
                                className="flex-1 md:flex-none bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all"
                              >
                                Rejeter
                              </button>
                              <button 
                                onClick={() => handleRevoke(p.id)}
                                className="flex-1 md:flex-none bg-zinc-800 hover:bg-zinc-700 text-gray-400 border border-white/5 px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all"
                              >
                                Révoqué
                              </button>
                            </>
                          ) : p.statut === 'approved' ? (
                            <button 
                              onClick={() => handleRelock(p.id)}
                              className="flex-1 md:flex-none bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all shadow-lg shadow-orange-600/20"
                            >
                              VERROUILLÉ
                            </button>
                          ) : p.statut === 'rejected' ? (
                            <div className="text-red-500 text-[9px] font-black uppercase tracking-widest bg-red-500/10 px-3 py-1.5 rounded-xl border border-red-500/20 text-center">
                              Rejeté
                            </div>
                          ) : (
                            <div className="text-gray-500 text-[9px] font-black uppercase tracking-widest bg-zinc-900 px-3 py-1.5 rounded-xl border border-white/5 text-center">
                              Révoqué
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'pin' && (
            <motion.div 
              key="pin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-zinc-900/40 rounded-2xl border border-white/5 overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 bg-black/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-xl font-black tracking-tight uppercase">Demandes de réinitialisation PIN</h2>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input 
                    type="text"
                    placeholder="Rechercher un utilisateur..."
                    value={searchPins}
                    onChange={e => setSearchPins(e.target.value)}
                    className="w-full md:w-64 bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 bg-black/40">
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Utilisateur</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Téléphone</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Date / Heure</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Statut</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {pinRequests.filter(r => {
                      if (!searchPins) return true;
                      const q = searchPins.toLowerCase();
                      return (r.nom_utilisateur?.toLowerCase().includes(q) || r.telephone_utilisateur?.includes(q));
                    }).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic text-sm">Aucune demande trouvée</td>
                      </tr>
                    ) : (
                      pinRequests
                        .filter(r => {
                          if (!searchPins) return true;
                          const q = searchPins.toLowerCase();
                          return (r.nom_utilisateur?.toLowerCase().includes(q) || r.telephone_utilisateur?.includes(q));
                        })
                        .map((r) => (
                        <tr key={r.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 font-bold text-sm">{r.nom_utilisateur}</td>
                          <td className="px-6 py-4 text-gray-400 text-xs">{r.telephone_utilisateur}</td>
                          <td className="px-6 py-4 text-gray-400 text-xs">
                            {new Date(r.date).toLocaleDateString('fr-FR')} {new Date(r.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md border",
                              r.statut === 'approved' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                              r.statut === 'completed' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                              "bg-orange-500/10 text-orange-500 border-orange-500/20"
                            )}>
                              {r.statut}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {r.statut === 'pending' && (
                              <div className="flex justify-end gap-2">
                                <button onClick={() => handleApprovePinReset(r.id)} className="p-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-lg transition-all">
                                  <CheckCircle2 size={18} />
                                </button>
                                <button onClick={() => handleRejectPinReset(r.id)} className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all">
                                  <XCircle size={18} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'banner' && (
            <motion.div 
              key="banner"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Home Banner Settings Section */}
              <div className="bg-zinc-900/40 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/5 bg-black/20 flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500">
                    <ImageIcon size={20} />
                  </div>
                  <h2 className="text-xl font-black tracking-tight uppercase">Bannière de l'accueil</h2>
                </div>
                
                <div className="p-8 space-y-8">
                  <p className="text-sm text-gray-400 font-medium leading-relaxed">
                    Modifiez les textes et paramètres affichés dans l'application.
                  </p>

                  <div className="space-y-6">
                    {/* Home Banner Image */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-gray-300 uppercase tracking-widest">Bannière de l'accueil (Image URL)</label>
                        <button 
                          onClick={() => handleSaveSetting('banner_home_image', localSettings.banner_home_image || '')}
                          disabled={formLoading}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                        >
                          Appliquer
                        </button>
                      </div>
                      <div className="relative group">
                        <input 
                          type="text" 
                          value={localSettings.banner_home_image || ''}
                          onChange={e => setLocalSettings({...localSettings, banner_home_image: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-sm focus:border-indigo-500 outline-none transition-all"
                          placeholder="https://exemple.com/image.jpg"
                        />
                        <ImageIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-indigo-500 transition-colors" size={18} />
                      </div>
                      <p className="text-[10px] text-gray-500 italic">Importez une image JPG ou PNG qui s'affichera en haut de l'accueil.</p>
                    </div>

                    {/* Home Banner Video */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-gray-300 uppercase tracking-widest">Bannière Vidéo (URL)</label>
                        <button 
                          onClick={() => handleSaveSetting('banner_home_video', localSettings.banner_home_video || '')}
                          disabled={formLoading}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                        >
                          Appliquer
                        </button>
                      </div>
                      <div className="relative group">
                        <input 
                          type="text" 
                          value={localSettings.banner_home_video || ''}
                          onChange={e => setLocalSettings({...localSettings, banner_home_video: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-sm focus:border-indigo-500 outline-none transition-all"
                          placeholder="https://youtu.be/..."
                        />
                        <Play className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-indigo-500 transition-colors" size={18} />
                      </div>
                      <p className="text-[10px] text-gray-500 italic">Collez un lien YouTube ou MP4 direct. Si défini, la vidéo remplace l'image de bannière. Laisser vide pour désactiver.</p>
                    </div>

                    {/* Info Bar */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="bg-red-500/10 text-red-500 text-[10px] font-black px-1.5 py-0.5 rounded">INFO</span>
                          <label className="text-xs font-black text-gray-300 uppercase tracking-widest">Barre d'information (accueil)</label>
                        </div>
                        <button 
                          onClick={() => handleSaveSetting('info_bar_text', localSettings.info_bar_text || '')}
                          disabled={formLoading}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                        >
                          Publier
                        </button>
                      </div>
                      <div className="relative group">
                        <input 
                          type="text" 
                          value={localSettings.info_bar_text || ''}
                          onChange={e => setLocalSettings({...localSettings, info_bar_text: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-sm focus:border-indigo-500 outline-none transition-all"
                          placeholder="Ex : Maintenance prévue"
                        />
                      </div>
                      <p className="text-[10px] text-gray-500 italic">Affiche un bandeau vert avec "INFO:" en haut de l'accueil. Laissez vide pour masquer.</p>
                    </div>
                  </div>

                  {/* Payment Configuration Section */}
                  <div className="pt-8 border-t border-white/5 space-y-8">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500">
                        <CreditCard size={20} />
                      </div>
                      <h2 className="text-xl font-black tracking-tight uppercase">Configuration des Paiements</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Orange Money Number */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-gray-300 uppercase tracking-widest">Numéro Orange Money</label>
                          <button 
                            onClick={() => handleSaveSetting('payment_orange_money_number', localSettings.payment_orange_money_number || '')}
                            disabled={formLoading}
                            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                          >
                            Enregistrer
                          </button>
                        </div>
                        <input 
                          type="text" 
                          value={localSettings.payment_orange_money_number || ''}
                          onChange={e => setLocalSettings({...localSettings, payment_orange_money_number: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-sm focus:border-orange-500 outline-none transition-all"
                          placeholder="Ex : +224 655 00 00 00"
                        />
                        <p className="text-[10px] text-gray-500 italic">Ce numéro sera affiché aux utilisateurs lors de l'achat d'une saison.</p>
                      </div>

                      {/* WhatsApp Number */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-gray-300 uppercase tracking-widest">Numéro WhatsApp (sans +)</label>
                          <button 
                            onClick={() => handleSaveSetting('payment_whatsapp_number', localSettings.payment_whatsapp_number || '')}
                            disabled={formLoading}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                          >
                            Sauvegarder
                          </button>
                        </div>
                        <input 
                          type="text" 
                          value={localSettings.payment_whatsapp_number || ''}
                          onChange={e => setLocalSettings({...localSettings, payment_whatsapp_number: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-sm focus:border-emerald-500 outline-none transition-all"
                          placeholder="224627322525"
                        />
                      </div>

                      {/* USSD Code 1 */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-gray-300 uppercase tracking-widest">Code USSD 1 (modèle avec {'{prix}'})</label>
                          <button 
                            onClick={() => handleSaveSetting('payment_ussd_code_1', localSettings.payment_ussd_code_1 || '')}
                            disabled={formLoading}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                          >
                            Sauvegarder
                          </button>
                        </div>
                        <input 
                          type="text" 
                          value={localSettings.payment_ussd_code_1 || ''}
                          onChange={e => setLocalSettings({...localSettings, payment_ussd_code_1: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-sm font-mono focus:border-indigo-500 outline-none transition-all"
                          placeholder="*144*6*..."
                        />
                      </div>

                      {/* USSD Code 2 */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-gray-300 uppercase tracking-widest">Code USSD 2 (modèle avec {'{prix}'})</label>
                          <button 
                            onClick={() => handleSaveSetting('payment_ussd_code_2', localSettings.payment_ussd_code_2 || '')}
                            disabled={formLoading}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                          >
                            Sauvegarder
                          </button>
                        </div>
                        <input 
                          type="text" 
                          value={localSettings.payment_ussd_code_2 || ''}
                          onChange={e => setLocalSettings({...localSettings, payment_ussd_code_2: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-sm font-mono focus:border-indigo-500 outline-none transition-all"
                          placeholder="*144*1*1*..."
                        />
                      </div>

                      {/* Deposit Number */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-gray-300 uppercase tracking-widest">Numéro de dépôt (ex : +224627322525)</label>
                          <button 
                            onClick={() => handleSaveSetting('payment_deposit_number', localSettings.payment_deposit_number || '')}
                            disabled={formLoading}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                          >
                            Sauvegarder
                          </button>
                        </div>
                        <input 
                          type="text" 
                          value={localSettings.payment_deposit_number || ''}
                          onChange={e => setLocalSettings({...localSettings, payment_deposit_number: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-sm focus:border-indigo-500 outline-none transition-all"
                          placeholder="+224627322525"
                        />
                      </div>

                      {/* Payment Instructions */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-gray-300 uppercase tracking-widest">Instructions de paiement (libre)</label>
                          <button 
                            onClick={() => handleSaveSetting('payment_instructions', localSettings.payment_instructions || '')}
                            disabled={formLoading}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                          >
                            Sauvegarder
                          </button>
                        </div>
                        <textarea 
                          value={localSettings.payment_instructions || ''}
                          onChange={e => setLocalSettings({...localSettings, payment_instructions: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-sm focus:border-indigo-500 outline-none transition-all min-h-[100px] resize-none"
                          placeholder="627613880"
                        />
                      </div>
                    </div>
                  </div>

                  {formMessage.text && (
                    <div className={cn("p-4 rounded-2xl text-xs font-black text-center uppercase tracking-widest", formMessage.type === 'success' ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500")}>
                      {formMessage.text}
                    </div>
                  )}
                </div>
              </div>

              {/* Existing Banner List Management */}
              <div className="pt-8 border-t border-white/5 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black tracking-tight uppercase">Gestion des bannières promotionnelles</h2>
                  <button 
                    onClick={() => {
                      setEditingId(null);
                      setBannerForm({ titre: '', image: '', id_serie: '', statut: 'active', type: 'image' });
                      setActiveForm('banner');
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all"
                  >
                    Ajouter une promo
                  </button>
                </div>

              {activeForm === 'banner' && (
                <form onSubmit={submitBanner} className="bg-zinc-900/60 border border-white/10 p-6 rounded-2xl space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Titre</label>
                      <input 
                        type="text" 
                        value={bannerForm.titre}
                        onChange={e => setBannerForm({...bannerForm, titre: e.target.value})}
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-red-500 outline-none transition-all"
                        placeholder="Ex: Promo Saison 2"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Image URL</label>
                      <input 
                        type="text" 
                        value={bannerForm.image}
                        onChange={e => setBannerForm({...bannerForm, image: e.target.value})}
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-red-500 outline-none transition-all"
                        placeholder="https://..."
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Série liée (Optionnel)</label>
                      <select 
                        value={bannerForm.id_serie}
                        onChange={e => setBannerForm({...bannerForm, id_serie: e.target.value})}
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-red-500 outline-none transition-all"
                      >
                        <option value="">Aucune</option>
                        {seriesList.map(s => (
                          <option key={s.id} value={s.id}>{s.titre}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Statut</label>
                      <select 
                        value={bannerForm.statut}
                        onChange={e => setBannerForm({...bannerForm, statut: e.target.value as any})}
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-red-500 outline-none transition-all"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Type de contenu</label>
                      <select 
                        value={bannerForm.type}
                        onChange={e => setBannerForm({...bannerForm, type: e.target.value as any})}
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-red-500 outline-none transition-all"
                      >
                        <option value="image">Image</option>
                        <option value="video">Vidéo</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button 
                      type="submit" 
                      disabled={formLoading}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                      {formLoading ? "Envoi..." : (editingId ? "Modifier" : "Ajouter")}
                    </button>
                    <button 
                      type="button"
                      onClick={() => setActiveForm(null)}
                      className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all"
                    >
                      Annuler
                    </button>
                  </div>
                  {formMessage.text && (
                    <div className={cn("p-3 rounded-xl text-[10px] font-bold text-center uppercase tracking-widest", formMessage.type === 'success' ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500")}>
                      {formMessage.text}
                    </div>
                  )}
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {banners.map(b => (
                  <div key={b.id} className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 flex items-center gap-4 group relative overflow-hidden">
                    <div className="w-24 aspect-video rounded-lg overflow-hidden bg-black border border-white/5 shrink-0">
                      <img src={b.image} alt={b.titre} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-xs truncate">{b.titre}</h3>
                        <span className={cn(
                          "text-[7px] font-black uppercase tracking-widest px-1 py-0.5 rounded border shrink-0",
                          b.type === 'video' ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                        )}>
                          {b.type || 'image'}
                        </span>
                      </div>
                      <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest truncate">
                        {b.statut} {b.id_serie && `— Liée à: ${seriesList.find(s => s.id === b.id_serie)?.titre || '?'}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <button onClick={() => handleEditBanner(b)} className="p-2 bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white rounded-lg transition-all" title="Modifier">
                        <Settings size={14} />
                      </button>
                      <button onClick={() => handleDeleteBanner(b.id)} className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all" title="Supprimer">
                        <XCircle size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

          {activeTab === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12 pb-24"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black tracking-tight uppercase">Paramètres système</h2>
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Configurez le comportement global de l'application</p>
                </div>
                <button 
                  onClick={() => {
                    setSettingForm({ cle: '', valeur: '' });
                    setActiveForm('setting');
                  }}
                  className="bg-zinc-800 hover:bg-white hover:text-black text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all"
                >
                  Ajouter un paramètre
                </button>
              </div>

              {activeForm === 'setting' && (
                <form onSubmit={submitSetting} className="bg-zinc-900/60 border border-white/10 p-6 rounded-2xl space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Clé (ID)</label>
                      <input 
                        type="text" 
                        value={settingForm.cle}
                        onChange={e => setSettingForm({...settingForm, cle: e.target.value})}
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-red-500 outline-none transition-all"
                        placeholder="Ex: contact_phone"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Valeur</label>
                      <input 
                        type="text" 
                        value={settingForm.valeur}
                        onChange={e => setSettingForm({...settingForm, valeur: e.target.value})}
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-red-500 outline-none transition-all"
                        placeholder="Valeur du paramètre"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button 
                      type="submit" 
                      disabled={formLoading}
                      className="flex-1 bg-white text-black py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                      {formLoading ? "Envoi..." : "Enregistrer"}
                    </button>
                    <button 
                      type="button"
                      onClick={() => setActiveForm(null)}
                      className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              )}

              {/* Categories */}
              <div className="space-y-12">
                {/* General */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3 mb-6">
                    <Globe size={20} className="text-blue-500" />
                    <h3 className="text-sm font-black uppercase tracking-widest">Général & Branding</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <SettingRow 
                      label="Nom de l'application" 
                      cle="app_name" 
                      placeholder="Ex: MANDEN TSERIE"
                    />
                    <SettingRow 
                      label="Description / Slogan" 
                      cle="app_description" 
                      placeholder="Ex: Manden Tserie streaming"
                    />
                    <SettingRow 
                      label="URL du Logo" 
                      cle="app_logo_url" 
                      placeholder="https://..."
                    />
                    <SettingRow 
                      label="Devise (Symbole)" 
                      cle="app_currency" 
                      placeholder="Ex: GNF"
                    />
                    <SettingRow 
                      label="Texte de la barre d'info" 
                      cle="info_bar_text" 
                      description="Message défilant en haut de l'écran d'accueil"
                      placeholder="Ex: Nouvelle série disponible !"
                    />
                    <SettingRow 
                      label="Lien Vidéo Tutoriel" 
                      cle="tutorial_video_url" 
                      description="Lien de la vidéo (MP4 ou YouTube) que les utilisateurs doivent regarder"
                      placeholder="https://..."
                    />
                  </div>
                </section>

                {/* System Status */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3 mb-6">
                    <RefreshCw size={20} className="text-orange-500" />
                    <h3 className="text-sm font-black uppercase tracking-widest">État du système</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SettingRow 
                      label="Mode Maintenance" 
                      cle="app_maintenance_mode" 
                      type="toggle"
                      description="Bloque l'accès à l'application pour les utilisateurs"
                    />
                    <SettingRow 
                      label="Inscriptions autorisées" 
                      cle="app_registration_enabled" 
                      type="toggle"
                      description="Permet ou non aux nouveaux utilisateurs de s'inscrire"
                    />
                  </div>
                </section>

                {/* Contact & Support */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3 mb-6">
                    <MessageSquare size={20} className="text-blue-400" />
                    <h3 className="text-sm font-black uppercase tracking-widest">Contact & Support</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <SettingRow 
                      label="Numéro WhatsApp" 
                      cle="payment_whatsapp_number" 
                      description="Numéro pour le support et les confirmations"
                      placeholder="Ex: 224627322525"
                    />
                    <SettingRow 
                      label="Téléphone Support" 
                      cle="app_support_phone" 
                    />
                    <SettingRow 
                      label="Email Support" 
                      cle="app_support_email" 
                    />
                    <SettingRow 
                      label="Lien Facebook" 
                      cle="app_facebook_url" 
                    />
                    <SettingRow 
                      label="Lien Telegram" 
                      cle="app_telegram_url" 
                    />
                  </div>
                </section>

                {/* Security */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3 mb-6">
                    <ShieldCheck size={20} className="text-emerald-500" />
                    <h3 className="text-sm font-black uppercase tracking-widest">Sécurité</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SettingRow 
                      label="Désactiver le clic droit" 
                      cle="security_right_click_disabled" 
                      type="toggle"
                      description="Empêche le menu contextuel"
                    />
                    <SettingRow 
                      label="Désactiver la sélection" 
                      cle="security_text_selection_disabled" 
                      type="toggle"
                      description="Empêche de copier le texte"
                    />
                    <SettingRow 
                      label="Désactiver DevTools" 
                      cle="security_dev_tools_disabled" 
                      type="toggle"
                      description="Bloque F12 et raccourcis inspecter"
                    />
                    <SettingRow 
                      label="Bloquer liens externes" 
                      cle="security_external_links_disabled" 
                      type="toggle"
                      description="Empêche de quitter l'application via des liens"
                    />
                  </div>
                </section>

                {/* Payment */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3 mb-6">
                    <PaymentIcon size={20} className="text-orange-500" />
                    <h3 className="text-sm font-black uppercase tracking-widest">Paiement</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <SettingRow 
                      label="Numéro Orange Money" 
                      cle="payment_orange_money_number" 
                      placeholder="+224 655 00 00 00"
                    />
                    <SettingRow 
                      label="Code USSD 1" 
                      cle="payment_ussd_code_1" 
                      description="Utilisez {prix} comme variable"
                      placeholder="*144*6*..."
                    />
                    <SettingRow 
                      label="Code USSD 2" 
                      cle="payment_ussd_code_2" 
                      description="Utilisez {prix} comme variable"
                      placeholder="*144*1*..."
                    />
                    <SettingRow 
                      label="Numéro de dépôt" 
                      cle="payment_deposit_number" 
                    />
                    <SettingRow 
                      label="Instructions de paiement" 
                      cle="payment_instructions" 
                      description="Texte d'aide affiché lors du paiement"
                    />
                  </div>
                </section>

                {/* Appearance */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3 mb-6">
                    <ImageIcon size={20} className="text-purple-500" />
                    <h3 className="text-sm font-black uppercase tracking-widest">Apparence & Bannière</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <SettingRow 
                      label="Image de bannière accueil" 
                      cle="banner_home_image" 
                      description="URL de l'image par défaut"
                    />
                    <SettingRow 
                      label="Vidéo de bannière accueil" 
                      cle="banner_home_video" 
                      description="URL MP4 ou lien YouTube"
                    />
                  </div>
                </section>

                {/* Custom Settings */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3 mb-6">
                    <Settings size={20} className="text-gray-500" />
                    <h3 className="text-sm font-black uppercase tracking-widest">Autres paramètres</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {settings.filter(s => ![
                      'info_bar_text', 'payment_whatsapp_number', 
                      'security_right_click_disabled', 'security_text_selection_disabled', 
                      'security_dev_tools_disabled', 'security_external_links_disabled',
                      'payment_orange_money_number', 'payment_ussd_code_1', 'payment_ussd_code_2',
                      'payment_deposit_number', 'payment_instructions',
                      'banner_home_image', 'banner_home_video'
                    ].includes(s.cle)).map(s => (
                      <div key={s.cle} className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 flex items-center justify-between group">
                        <div>
                          <h3 className="font-black text-xs text-gray-500 uppercase tracking-widest mb-1">{s.cle}</h3>
                          <p className="font-bold text-white">{s.valeur}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => {
                              setSettingForm({ cle: s.cle, valeur: s.valeur });
                              setActiveForm('setting');
                            }}
                            className="p-2 bg-white/5 text-gray-400 hover:bg-white hover:text-black rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Settings size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteSetting(s.cle)}
                            className="p-2 bg-white/5 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </motion.div>
          )}

          {activeTab === 'messages' && (
            <motion.div 
              key="messages"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-zinc-900/40 rounded-2xl border border-white/5 p-12 text-center shadow-2xl"
            >
              <MessageSquare size={48} className="text-blue-500 mx-auto mb-4 opacity-20" />
              <h2 className="text-2xl font-black tracking-tight uppercase mb-2">Centre de messagerie</h2>
              <p className="text-gray-500 text-sm">Gestion des communications avec les utilisateurs en cours de développement.</p>
            </motion.div>
          )}

          {activeTab === 'roles' && (
            <motion.div 
              key="roles"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-zinc-900/40 rounded-2xl border border-white/5 p-8 shadow-2xl">
                <div className="flex items-center gap-4 mb-8">
                  <Shield size={32} className="text-orange-500" />
                  <div>
                    <h2 className="text-xl font-black tracking-tight uppercase">Gestion des rôles</h2>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Gérez les permissions des administrateurs</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {users.filter(u => u.role === 'admin' || u.role === 'owner').map(u => (
                    <div key={u.id} className="bg-black/40 border border-white/5 rounded-2xl p-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center",
                            u.role === 'owner' ? "bg-orange-500/10 text-orange-500" : "bg-blue-500/10 text-blue-500"
                          )}>
                            {u.role === 'owner' ? <Shield size={24} /> : <UserIcon size={24} />}
                          </div>
                          <div>
                            <h3 className="font-black text-white uppercase tracking-tight">{u.prenom} {u.nom}</h3>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{u.telephone}</p>
                            <span className={cn(
                              "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border mt-1 inline-block",
                              u.role === 'owner' ? "bg-orange-500/10 text-orange-500 border-orange-500/20" : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                            )}>
                              {u.role}
                            </span>
                          </div>
                        </div>

                        {u.role === 'admin' && (
                          <div className="flex-1 max-w-xl">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 ml-1">Permissions accordées</p>
                            <div className="flex flex-wrap gap-2">
                              {[
                                { id: 'media', label: 'GESTION DE MEDIA' },
                                { id: 'unlock', label: 'DEMANDES DE PAIEMENT' },
                                { id: 'pin', label: 'RÉINIT. PIN' },
                                { id: 'banner', label: 'Bannière' },
                                { id: 'stats', label: 'STATISTIQUES' },
                                { id: 'users', label: 'UTILISATEURS' },
                                { id: 'settings', label: 'Paramètres' },
                                { id: 'messages', label: 'MESSAGES' },
                              ].map(perm => {
                                const isGranted = u.permissions?.includes(perm.id);
                                return (
                                  <button
                                    key={perm.id}
                                    onClick={() => {
                                      const newPerms = isGranted
                                        ? u.permissions?.filter(p => p !== perm.id) || []
                                        : [...(u.permissions || []), perm.id];
                                      handleUserPermissions(u.id, newPerms);
                                    }}
                                    className={cn(
                                      "px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all",
                                      isGranted 
                                        ? "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20" 
                                        : "bg-zinc-900 border-white/5 text-gray-500 hover:border-white/20"
                                    )}
                                  >
                                    {perm.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {u.role === 'owner' && (
                          <div className="bg-orange-500/5 border border-orange-500/20 px-4 py-2 rounded-xl">
                            <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Accès total (Propriétaire)</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'stats' && (
            <motion.div 
              key="stats"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Dashboard Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-zinc-900/40 p-6 rounded-3xl border border-white/5 flex flex-col items-center justify-center text-center">
                  <div className="text-3xl font-black text-white mb-1">
                    {loadingStates.stats ? (
                      <Skeleton className="h-8 w-16 mx-auto mb-1" />
                    ) : (
                      stats.reduce((acc, s) => acc + Number(s.compte), 0)
                    )}
                  </div>
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Ventes validées</p>
                </div>
                <div className="bg-zinc-900/40 p-6 rounded-3xl border border-white/5 flex flex-col items-center justify-center text-center">
                  <div className="text-3xl font-black text-red-600 mb-1">
                    {loadingStates.stats ? (
                      <Skeleton className="h-8 w-24 mx-auto mb-1" />
                    ) : (
                      stats.reduce((acc, s) => acc + Number(s.total_recettes), 0).toLocaleString('en-US', { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    )}
                  </div>
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{settingsRecord.app_currency || 'GNF'} de recettes</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black uppercase tracking-tighter">Détail par saison</h2>
                {user?.role === 'owner' && (
                  <button 
                    onClick={() => setShowResetModal(true)}
                    className="p-2 bg-zinc-900/60 hover:bg-red-500/10 text-gray-400 hover:text-red-500 rounded-xl border border-white/5 transition-all"
                    title="Réinitialiser les ventes"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {/* Detailed Stats */}
              <div className="space-y-3">
                {loadingStates.stats ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="bg-zinc-900/40 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-2 w-24" />
                      </div>
                      <div className="text-right space-y-2">
                        <Skeleton className="h-4 w-16 ml-auto" />
                        <Skeleton className="h-3 w-20 ml-auto" />
                      </div>
                    </div>
                  ))
                ) : stats.length === 0 ? (
                  <div className="bg-zinc-900/40 p-12 rounded-2xl border border-white/5 text-center text-gray-500 italic">
                    Aucune statistique détaillée disponible
                  </div>
                ) : (
                  stats.map((s, i) => (
                    <div key={i} className="bg-zinc-900/40 p-4 rounded-2xl border border-white/5 flex items-center justify-between group hover:border-white/10 transition-all">
                      <div className="space-y-0.5">
                        <h3 className="text-sm font-black uppercase tracking-tight text-white">{s.titre_serie} — Saison {s.numero_saison}</h3>
                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                          {Number(s.prix_saison).toLocaleString('en-US', { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2 })}{settingsRecord.app_currency || 'GNF'} / saison
                        </p>
                      </div>
                      <div className="text-right space-y-0.5">
                        <div className="text-sm font-black text-white">
                          {s.compte} {Number(s.compte) > 1 ? 'ventes' : 'vente'}
                        </div>
                        <div className="text-xs font-black text-red-600 uppercase tracking-widest">
                          {Number(s.total_recettes).toLocaleString('en-US', { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2 })}{settingsRecord.app_currency || 'GNF'}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reset Sales Modal */}
        <AnimatePresence>
          {showResetModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowResetModal(false)}
                className="absolute inset-0 bg-black/90 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md bg-zinc-950 border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500" />
                
                <div className="flex flex-col items-center text-center space-y-4 mb-8">
                  <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
                    <AlertCircle size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tighter text-white">Réinitialisation</h3>
                    <p className="text-gray-500 text-sm mt-2">
                      Cette action effacera toutes les données de vente validées. Cette opération est irréversible.
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Code PIN Admin</label>
                    <input 
                      type="password"
                      maxLength={4}
                      placeholder="••••"
                      value={resetPin}
                      onChange={(e) => setResetPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-zinc-900 border border-white/5 rounded-2xl px-6 py-4 text-center text-2xl font-black tracking-[1em] focus:border-red-500/50 focus:ring-0 transition-all placeholder:text-zinc-800"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => setShowResetModal(false)}
                      className="flex-1 px-6 py-4 bg-zinc-900 hover:bg-zinc-800 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all"
                    >
                      Annuler
                    </button>
                    <button 
                      onClick={handleResetSales}
                      disabled={resetPin.length !== 4 || resetLoading}
                      className="flex-1 px-6 py-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:hover:bg-red-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
                    >
                      {resetLoading ? <RefreshCw className="animate-spin" size={14} /> : "Confirmer"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {activeTab === 'trash' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black tracking-tight uppercase">Corbeille</h2>
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Gérez les éléments supprimés</p>
                </div>
                <button 
                  onClick={() => fetchData('trash')}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                >
                  <RefreshCw size={20} className={loadingStates.trash ? "animate-spin" : ""} />
                </button>
              </div>

              <div className="space-y-12">
                {/* Series Trash */}
                <section>
                  <h3 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Tv size={16} /> Séries supprimées ({trash.series.length})
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    {trash.series.map(s => (
                      <div key={s.id} className="bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <img src={s.image} className="w-12 h-16 object-cover rounded-lg" referrerPolicy="no-referrer" />
                          <div>
                            <h4 className="font-black text-white uppercase tracking-tight">{s.titre}</h4>
                            <p className="text-[10px] text-gray-500 font-bold uppercase">{s.genre}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleRestore(s.id, 'series')}
                            className="p-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl transition-all"
                            title="Restaurer"
                          >
                            <RotateCcw size={18} />
                          </button>
                          <button 
                            onClick={() => handlePermanentDelete(s.id, 'series')}
                            className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                            title="Supprimer définitivement"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {trash.series.length === 0 && <p className="text-xs text-gray-600 italic text-center py-4">Aucune série dans la corbeille</p>}
                  </div>
                </section>

                {/* Seasons Trash */}
                <section>
                  <h3 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Film size={16} /> Saisons supprimées ({trash.seasons.length})
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    {trash.seasons.map(s => (
                      <div key={s.id} className="bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex items-center justify-between group">
                        <div>
                          <h4 className="font-black text-white uppercase tracking-tight">Saison {s.numero} {s.titre && `— ${s.titre}`}</h4>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Série: {s.titre_serie}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleRestore(s.id, 'season')}
                            className="p-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl transition-all"
                            title="Restaurer"
                          >
                            <RotateCcw size={18} />
                          </button>
                          <button 
                            onClick={() => handlePermanentDelete(s.id, 'season')}
                            className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                            title="Supprimer définitivement"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {trash.seasons.length === 0 && <p className="text-xs text-gray-600 italic text-center py-4">Aucune saison dans la corbeille</p>}
                  </div>
                </section>

                {/* Episodes Trash */}
                <section>
                  <h3 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Play size={16} /> Épisodes supprimés ({trash.episodes.length})
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    {trash.episodes.map(e => (
                      <div key={e.id} className="bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex items-center justify-between group">
                        <div>
                          <h4 className="font-black text-white uppercase tracking-tight">{e.titre}</h4>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Série: {e.titre_serie} — Saison {e.numero_saison}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleRestore(e.id, 'episode')}
                            className="p-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl transition-all"
                            title="Restaurer"
                          >
                            <RotateCcw size={18} />
                          </button>
                          <button 
                            onClick={() => handlePermanentDelete(e.id, 'episode')}
                            className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                            title="Supprimer définitivement"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {trash.episodes.length === 0 && <p className="text-xs text-gray-600 italic text-center py-4">Aucun épisode dans la corbeille</p>}
                  </div>
                </section>
              </div>
            </motion.div>
          )}

          {activeTab === 'stock' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6 pb-20"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black tracking-tight uppercase flex items-center gap-3">
                    <Box className="text-indigo-500" size={28} />
                    STOCK ÉPISODES {selectedStockIds.length > 0 && <span className="text-emerald-500">({selectedStockIds.length} SÉLECTIONNÉS)</span>}
                  </h2>
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Vidéos uploadées non encore assignées</p>
                </div>

                <div className="flex gap-2">
                  {selectedStockIds.length > 0 && (
                    <button 
                      onClick={() => {
                        setEpisodeForm({ id_serie: '', id_saison: '', titre: '', url_video: '', statut: 'locked' });
                        // Pas de mediaToMove pour le bulk, handleAssignFromStock utilisera selectedStockIds
                        setMediaToMove({ id: 'bulk', titre: `${selectedStockIds.length} épisodes` });
                      }}
                      className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg"
                    >
                      <Plus size={16} />
                      Déplacer la sélection ({selectedStockIds.length})
                    </button>
                  )}
                  <label className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all cursor-pointer shadow-lg",
                    isBulkUploading ? "bg-zinc-800 text-gray-500 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-500 text-white"
                  )}>
                    <Upload size={16} />
                    {isBulkUploading ? "Upload en cours..." : "Uploader vers Stock"}
                    <input 
                      type="file" 
                      multiple 
                      accept="video/*" 
                      className="hidden" 
                      onChange={handleBulkUpload}
                      disabled={isBulkUploading}
                    />
                  </label>
                  <button 
                    onClick={() => fetchData('stock')}
                    className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all"
                  >
                    <RefreshCw size={20} className={loadingStates.stock ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>

              {Object.keys(activeUploads).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  {Object.entries(activeUploads).map(([id, upload]) => (
                    <div key={id} className="bg-zinc-900 border border-white/10 p-4 rounded-2xl space-y-3 shadow-lg relative overflow-hidden">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black text-white uppercase truncate flex-1">{upload.name}</span>
                        {upload.status === 'success' ? <CheckCircle2 size={14} className="text-emerald-500" /> : 
                         upload.status === 'error' ? <XCircle size={14} className="text-red-500" /> : 
                         <RefreshCw size={14} className="text-indigo-500 animate-spin" />}
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${upload.progress}%` }}
                          className={cn(
                            "h-full transition-all duration-300",
                            upload.status === 'success' ? "bg-emerald-500" : 
                            upload.status === 'error' ? "bg-red-500" : "bg-indigo-500"
                          )}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-tighter text-gray-500">
                        <span>{upload.status === 'uploading' ? 'Envoi...' : 
                               upload.status === 'success' ? 'TERMINÉ' : 
                               upload.status === 'error' ? 'ERREUR' : String(upload.status).toUpperCase()}</span>
                        <span>{upload.progress}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stockEpisodes.length === 0 ? (
                  <div className="col-span-full py-20 text-center space-y-4">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                      <Box size={32} className="text-gray-600" />
                    </div>
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-xs italic">Aucune vidéo en stock</p>
                  </div>
                ) : (
                  stockEpisodes.map((ep) => (
                    <motion.div 
                      key={ep.id}
                      layout
                      onClick={() => {
                        setSelectedStockIds(prev => 
                          prev.includes(ep.id) 
                            ? prev.filter(id => id !== ep.id) 
                            : [...prev, ep.id]
                        );
                      }}
                      className={cn(
                        "bg-zinc-900/60 border rounded-2xl p-4 space-y-4 group transition-all shadow-xl cursor-pointer relative",
                        selectedStockIds.includes(ep.id) ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/30" : "border-white/5 hover:border-indigo-500/30"
                      )}
                    >
                      <div className="absolute top-2 right-2 z-10">
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                          selectedStockIds.includes(ep.id) ? "bg-emerald-500 border-emerald-500" : "bg-black/50 border-white/20 group-hover:border-white/40"
                        )}>
                          {selectedStockIds.includes(ep.id) && <CheckCircle2 size={12} className="text-white" />}
                        </div>
                      </div>

                      <div className="aspect-video bg-black/40 rounded-xl flex items-center justify-center overflow-hidden relative">
                         <video src={ep.url_video} className="w-full h-full object-cover opacity-60" />
                         <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/0 transition-all">
                           <Play size={32} className="text-white/20 group-hover:text-white transition-all" />
                         </div>
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-black text-white text-xs uppercase tracking-tight truncate" title={ep.titre}>{ep.titre}</h3>
                        <p className="text-[9px] text-gray-500 font-bold">{new Date(ep.date_creation).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={() => {
                            setMediaToMove(ep);
                            setSelectedStockIds([]); // Clear selection when moving single
                            setEpisodeForm({ 
                              id_serie: '', 
                              id_saison: '', 
                              titre: ep.titre, 
                              url_video: ep.url_video, 
                              statut: 'locked' 
                            });
                          }}
                          className="flex-1 py-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                          Déplacer
                        </button>
                        <button 
                          onClick={() => handleDeleteFromStock(ep.id)}
                          className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {confirmModal?.show && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setConfirmModal(null)}
                className="absolute inset-0 bg-black/90 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md bg-zinc-950 border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden"
              >
                <div className={cn(
                  "absolute top-0 left-0 w-full h-1",
                  confirmModal.type === 'danger' ? "bg-red-500" : 
                  confirmModal.type === 'warning' ? "bg-orange-500" : "bg-blue-500"
                )} />
                
                <div className="flex flex-col items-center text-center space-y-4 mb-8">
                  <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center",
                    confirmModal.type === 'danger' ? "bg-red-500/10 text-red-500" : 
                    confirmModal.type === 'warning' ? "bg-orange-500/10 text-orange-500" : "bg-blue-500/10 text-blue-500"
                  )}>
                    <AlertTriangle size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tighter text-white">{confirmModal.title}</h3>
                    <p className="text-gray-500 text-sm mt-2">
                      {confirmModal.message}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setConfirmModal(null)}
                    className="flex-1 px-6 py-4 bg-zinc-900 hover:bg-zinc-800 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all"
                  >
                    Annuler
                  </button>
                  <button 
                    onClick={confirmModal.onConfirm}
                    className={cn(
                      "flex-1 px-6 py-4 font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-lg transition-all",
                      confirmModal.type === 'danger' ? "bg-red-600 hover:bg-red-700 text-white shadow-red-600/20" : 
                      confirmModal.type === 'warning' ? "bg-orange-600 hover:bg-orange-700 text-white shadow-orange-600/20" : 
                      "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20"
                    )}
                  >
                    Confirmer
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {pinConfirm?.show && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setPinConfirm(null);
                  setConfirmPin('');
                }}
                className="absolute inset-0 bg-black/90 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md bg-zinc-950 border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-emerald-500" />
                
                <div className="flex flex-col items-center text-center space-y-4 mb-8">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500">
                    <ShieldCheck size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tighter text-white">{pinConfirm.title}</h3>
                    <p className="text-gray-500 text-sm mt-2">
                      {pinConfirm.description}
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Code PIN</label>
                    <input 
                      type="password"
                      maxLength={4}
                      placeholder="••••"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-zinc-900 border border-white/5 rounded-2xl px-6 py-4 text-center text-2xl font-black tracking-[1em] focus:border-blue-500/50 focus:ring-0 transition-all placeholder:text-zinc-800"
                      autoFocus
                    />
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => {
                        setPinConfirm(null);
                        setConfirmPin('');
                      }}
                      className="flex-1 px-6 py-4 bg-zinc-900 hover:bg-zinc-800 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all"
                    >
                      Annuler
                    </button>
                    <button 
                      onClick={handlePinConfirm}
                      disabled={confirmPin.length !== 4 || confirmLoading}
                      className="flex-1 px-6 py-4 bg-white text-black font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-lg shadow-white/10 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {confirmLoading ? <RefreshCw className="animate-spin" size={14} /> : "Confirmer"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {mediaToMove && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMediaToMove(null)}
                className="absolute inset-0 bg-black/90 backdrop-blur-md"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg bg-zinc-950 border border-white/10 rounded-[32px] overflow-hidden shadow-2xl"
              >
                <div className="p-8 border-b border-white/5 bg-indigo-600/5">
                  <h3 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-3">
                    <Box className="text-indigo-500" />
                    Déplacer vers une Saison
                  </h3>
                  <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-1">Assigner l'épisode au catalogue</p>
                </div>

                <form onSubmit={handleAssignFromStock} className="p-8 space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Série de destination</label>
                    <select 
                      required
                      value={episodeForm.id_serie}
                      onChange={e => setEpisodeForm({...episodeForm, id_serie: e.target.value, id_saison: ''})}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-zinc-900">Choisir une série</option>
                      {seriesList.map(s => (
                        <option key={s.id} value={s.id} className="bg-zinc-900">{s.titre}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Saison de destination</label>
                    <select 
                      required
                      disabled={!episodeForm.id_serie}
                      value={episodeForm.id_saison}
                      onChange={e => setEpisodeForm({...episodeForm, id_saison: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-indigo-500 transition-all appearance-none cursor-pointer disabled:opacity-50"
                    >
                      <option value="" className="bg-zinc-900">
                        {!episodeForm.id_serie ? "Choisissez d'abord une série" : "Sélectionner une saison"}
                      </option>
                      {adminSeasons.filter(s => s.id_serie === Number(episodeForm.id_serie)).map(s => (
                        <option key={s.id} value={s.id} className="bg-zinc-900">Saison {s.numero} {s.titre && `— ${s.titre}`}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Titre de l'épisode</label>
                    <input 
                      type="text"
                      required
                      value={episodeForm.titre}
                      onChange={e => setEpisodeForm({...episodeForm, titre: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-indigo-500 outline-none transition-all"
                      placeholder="Nom de l'épisode..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={() => setMediaToMove(null)}
                      className="px-6 py-4 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all"
                    >
                      Annuler
                    </button>
                    <button 
                      type="submit"
                      disabled={formLoading}
                      className="px-6 py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                    >
                      {formLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Confirmer le déplacement"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};


// --- App ---

const AppContent = () => {
  const { settings, isMaintenance, loading: settingsLoading } = useSettings();
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  const { user, token, login, logout } = useAuth();
  const navigate = useNavigate();
  const [showTutorial, setShowTutorial] = useState(false);

  const needsTutorial = () => {
    if (isLoginPage) return false;
    if (!settings.tutorial_video_url || settings.tutorial_video_url.trim() === '') return false;
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'owner') return false;
    
    // Vérifier si la vidéo a déjà été vue dans cette session
    const sessionSeen = sessionStorage.getItem(`tutorial_seen_${user.id}`);
    if (sessionSeen) return false;
    
    return true;
  };

  useEffect(() => {
    if (!settingsLoading && user && needsTutorial()) {
      setShowTutorial(true);
    }
  }, [settingsLoading, user, location.pathname, settings.tutorial_video_url]);

  const handleTutorialComplete = async () => {
    if (!token || !user) return;
    try {
      // Marquer comme vue dans la session locale immédiatement
      sessionStorage.setItem(`tutorial_seen_${user.id}`, 'true');
      
      const res = await fetch('/api/user/watched-tutorial', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json() as any;
        const newUser = { ...user, last_tutorial_watch: data.last_tutorial_watch };
        login(token, newUser);
      }
      setShowTutorial(false);
    } catch (e) {
      setShowTutorial(false);
    }
  };

  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await originalFetch(input, init);
      if (response.status === 401) {
        const clonedResponse = response.clone();
        try {
          const data = await clonedResponse.json() as any;
          if (data.code === 'SESSION_EXPIRED') {
            logout();
            navigate('/login', { state: { message: data.error } });
          }
        } catch (e) {}
      }
      return response;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [logout, navigate]);

  useEffect(() => {
    if (!settingsLoading && !user && !isLoginPage) {
      // Small delay or check to ensure user is truly not there
      const savedUser = localStorage.getItem('bmtv_user');
      if (!savedUser) {
        navigate('/login');
      }
    }
  }, [user, isLoginPage, navigate, settingsLoading]);

  if (settingsLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs font-mono">INITIALISATION...</p>
        </div>
      </div>
    );
  }

  if (!user && !isLoginPage) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Chargement...</p>
        </div>
      </div>
    );
  }

  if (isMaintenance && user?.role !== 'admin' && user?.role !== 'owner') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-6">
          <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-8">
            <Settings className="text-orange-500 animate-spin-slow" size={40} />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight italic">MODE MAINTENANCE</h1>
          <p className="text-gray-400 font-bold leading-relaxed">
            <span className="text-[#FFD700]">MANDEN</span> <span className="text-[#FF0000]">TSERIE</span> est actuellement en maintenance pour amélioration. Nous serons de retour très bientôt. Merci de votre patience !
          </p>
          <div className="pt-8 border-t border-white/5">
            <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.3em]">
              Manden Tserie streaming &copy; 2026
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {!isLoginPage && <Navbar />}
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/my-files" element={<MyFiles />} />
          <Route path="/series/:id" element={<SeriesDetail />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      <AnimatePresence>
        {showTutorial && settings.tutorial_video_url && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <TutorialModal 
              videoUrl={settings.tutorial_video_url} 
              onComplete={handleTutorialComplete} 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <Toaster position="top-center" richColors theme="dark" />
        <Router>
          <AppContent />
        </Router>
      </SettingsProvider>
    </AuthProvider>
  );
}
