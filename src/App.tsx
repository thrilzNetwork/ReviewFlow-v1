/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged,
  doc, collection, setDoc, getDoc, addDoc, onSnapshot, query, orderBy, limit, updateDoc,
  handleFirestoreError, OperationType
} from './firebase';
import { 
  Star, 
  Send, 
  Settings as SettingsIcon, 
  LayoutDashboard, 
  QrCode, 
  Mail, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink, 
  LogOut, 
  Plus, 
  Trash2, 
  ChevronRight,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Download,
  Upload,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

interface HotelSettings {
  hotelName: string;
  logoUrl?: string;
  primaryColor: string;
  welcomeLine: string;
  googleLink?: string;
  tripAdvisorLink?: string;
  yelpLink?: string;
  facebookLink?: string;
  adminEmail: string;
}

interface Review {
  id: string;
  rating: number;
  oneWord?: string;
  timestamp: string;
  guestId?: string;
}

interface Feedback {
  id: string;
  rating: number;
  comment: string;
  timestamp: string;
  guestId?: string;
  resolved?: boolean;
}

// --- Components ---

const Button = ({ children, onClick, className, variant = 'primary', disabled = false }: { 
  children: React.ReactNode, 
  onClick?: () => void, 
  className?: string, 
  variant?: 'primary' | 'secondary' | 'outline' | 'danger',
  disabled?: boolean
}) => {
  const variants = {
    primary: 'bg-black text-white hover:bg-zinc-800',
    secondary: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200',
    outline: 'border border-zinc-200 text-zinc-900 hover:bg-zinc-50',
    danger: 'bg-red-500 text-white hover:bg-red-600',
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={cn(
        'px-6 py-3 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100',
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn('bg-white rounded-2xl border border-zinc-100 shadow-sm p-6', className)}>
    {children}
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [view, setView] = useState<'guest' | 'admin'>('guest');
  const [hotelId, setHotelId] = useState<string | null>(null);
  const [settings, setSettings] = useState<HotelSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Parse URL for hotelId
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('hotelId');
    if (id) {
      setHotelId(id);
      setView('guest');
    } else {
      setView('admin');
    }
  }, []);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      if (u && !hotelId) {
        setHotelId(u.uid);
      }
      // If we are in admin view and not logged in, we can stop loading
      if (!u && view === 'admin') {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [hotelId, view]);

  // Fetch settings
  useEffect(() => {
    if (!hotelId) return;

    setLoading(true);
    const unsubscribe = onSnapshot(doc(db, `hotels/${hotelId}/settings/config`), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as HotelSettings);
      } else {
        setSettings(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Settings fetch error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [hotelId]);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Sign in error:", error);
      setAuthError(error.message || "Failed to sign in. Please try again.");
    }
  };

  if (loading && hotelId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-zinc-400 font-medium"
        >
          Review Flow
        </motion.div>
      </div>
    );
  }

  if (view === 'guest' && hotelId) {
    return <GuestFlow hotelId={hotelId} settings={settings} />;
  }

  return <AdminDashboard user={user} hotelId={hotelId} settings={settings} onSignIn={handleSignIn} authError={authError} />;
}

// --- Guest Flow ---

function GuestFlow({ hotelId, settings }: { hotelId: string, settings: HotelSettings | null }) {
  const [step, setStep] = useState<'welcome' | 'rating' | 'oneword' | 'thanks' | 'feedback'>('welcome');
  const [rating, setRating] = useState(0);
  const [oneWord, setOneWord] = useState('');
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const suggestions = ['Amazing!', 'Perfect!', 'Wow!', 'Cozy', 'Stunning', 'Friendly'];

  const handleRatingSubmit = async (val: number) => {
    setRating(val);
    if (val >= 4) {
      setStep('oneword');
    } else {
      setStep('feedback');
    }
  };

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    try {
      if (rating >= 4) {
        await addDoc(collection(db, `hotels/${hotelId}/reviews`), {
          rating,
          oneWord,
          timestamp: new Date().toISOString(),
          guestId: 'anonymous'
        });
        setStep('thanks');
      } else {
        await addDoc(collection(db, `hotels/${hotelId}/feedback`), {
          rating,
          comment: feedback,
          timestamp: new Date().toISOString(),
          guestId: 'anonymous',
          resolved: false
        });
        setStep('thanks');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `hotels/${hotelId}/${rating >= 4 ? 'reviews' : 'feedback'}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <Card className="max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Hotel Not Found</h1>
          <p className="text-zinc-500">This review link appears to be invalid or expired.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 font-sans" style={{ '--primary': settings.primaryColor } as any}>
      <AnimatePresence mode="wait">
        {step === 'welcome' && (
          <motion.div 
            key="welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full text-center"
          >
            {settings.logoUrl && (
              <img src={settings.logoUrl} alt="Logo" className="h-16 mx-auto mb-8 object-contain" referrerPolicy="no-referrer" />
            )}
            <h1 className="text-3xl font-bold tracking-tight mb-4">{settings.welcomeLine}</h1>
            <p className="text-zinc-500 mb-8">Hey, we loved having you—tell us how it felt?</p>
            <Button onClick={() => setStep('rating')} className="w-full py-4 text-lg">
              Let's go
            </Button>
          </motion.div>
        )}

        {step === 'rating' && (
          <motion.div 
            key="rating"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full text-center"
          >
            <h2 className="text-2xl font-bold mb-12">How was your stay?</h2>
            <div className="flex justify-between mb-12">
              {[1, 2, 3, 4, 5].map((star) => (
                <motion.button
                  key={star}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleRatingSubmit(star)}
                  className={cn(
                    "p-2 rounded-full transition-all duration-300",
                    rating >= star ? "text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" : "text-zinc-200"
                  )}
                  onMouseEnter={() => setRating(star)}
                  onMouseLeave={() => setRating(0)}
                >
                  <Star size={48} fill={rating >= star ? "currentColor" : "none"} />
                </motion.button>
              ))}
            </div>
            <p className="text-zinc-400 text-sm">Tap a star to rate</p>
          </motion.div>
        )}

        {step === 'oneword' && (
          <motion.div 
            key="oneword"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="max-w-md w-full"
          >
            <h2 className="text-2xl font-bold mb-2">Love that!</h2>
            <p className="text-zinc-500 mb-8">One word to describe your experience?</p>
            
            <input 
              type="text" 
              value={oneWord}
              onChange={(e) => setOneWord(e.target.value)}
              placeholder="Amazing!"
              className="w-full p-4 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-black mb-4"
              autoFocus
            />

            <div className="flex flex-wrap gap-2 mb-8">
              {suggestions.map(s => (
                <button 
                  key={s}
                  onClick={() => setOneWord(s)}
                  className="px-4 py-2 rounded-full bg-zinc-100 text-zinc-600 text-sm hover:bg-zinc-200 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>

            <Button onClick={handleFinalSubmit} disabled={!oneWord || submitting} className="w-full">
              {submitting ? 'Sending...' : 'Next'}
            </Button>
          </motion.div>
        )}

        {step === 'feedback' && (
          <motion.div 
            key="feedback"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="max-w-md w-full"
          >
            <h2 className="text-2xl font-bold mb-2">We're sorry to hear that.</h2>
            <p className="text-zinc-500 mb-8">Want to help us fix this quietly?</p>
            
            <textarea 
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell us what went wrong..."
              className="w-full p-4 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-black mb-8 min-h-[120px]"
              autoFocus
            />

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setStep('thanks')} className="flex-1">No thanks</Button>
              <Button onClick={handleFinalSubmit} disabled={!feedback || submitting} className="flex-1">
                {submitting ? 'Sending...' : 'Send Feedback'}
              </Button>
            </div>
          </motion.div>
        )}

        {step === 'thanks' && (
          <motion.div 
            key="thanks"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full text-center"
          >
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold mb-4">Thank you!</h2>
            
            {rating >= 4 ? (
              <>
                <p className="text-zinc-500 mb-8">Want to shout it out and help others find us?</p>
                <div className="grid grid-cols-2 gap-4">
                  {settings.googleLink && (
                    <SocialButton icon={<img src="https://www.google.com/favicon.ico" className="w-5 h-5" />} label="Google" href={settings.googleLink} />
                  )}
                  {settings.tripAdvisorLink && (
                    <SocialButton icon={<ThumbsUp className="w-5 h-5" />} label="TripAdvisor" href={settings.tripAdvisorLink} />
                  )}
                  {settings.yelpLink && (
                    <SocialButton icon={<MessageSquare className="w-5 h-5" />} label="Yelp" href={settings.yelpLink} />
                  )}
                  {settings.facebookLink && (
                    <SocialButton icon={<Share2 className="w-5 h-5" />} label="Facebook" href={settings.facebookLink} />
                  )}
                </div>
              </>
            ) : (
              <p className="text-zinc-500">We've received your feedback and will look into it immediately. Next time's on us!</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SocialButton({ icon, label, href }: { icon: React.ReactNode, label: string, href: string }) {
  return (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-3 p-4 rounded-xl border border-zinc-100 bg-zinc-50 hover:bg-zinc-100 transition-colors"
    >
      {icon}
      <span className="font-medium text-sm">{label}</span>
    </a>
  );
}

// --- Admin Dashboard ---

function AdminDashboard({ user, hotelId, settings, onSignIn, authError }: { 
  user: any, 
  hotelId: string | null, 
  settings: HotelSettings | null,
  onSignIn: () => void,
  authError: string | null
}) {
  const [activeTab, setActiveTab] = useState<'inbox' | 'settings' | 'qr' | 'guests'>('inbox');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Form state for settings
  const [form, setForm] = useState<HotelSettings>({
    hotelName: '',
    logoUrl: '',
    primaryColor: '#000000',
    welcomeLine: 'Welcome to our hotel',
    googleLink: '',
    tripAdvisorLink: '',
    yelpLink: '',
    facebookLink: '',
    adminEmail: user?.email || ''
  });

  useEffect(() => {
    if (settings) {
      setForm(settings);
    }
  }, [settings]);

  // Fetch reviews & feedback
  useEffect(() => {
    if (!hotelId || !user) return;

    const qReviews = query(collection(db, `hotels/${hotelId}/reviews`), orderBy('timestamp', 'desc'), limit(50));
    const unsubReviews = onSnapshot(qReviews, (snap) => {
      setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() } as Review)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `hotels/${hotelId}/reviews`);
    });

    const qFeedback = query(collection(db, `hotels/${hotelId}/feedback`), orderBy('timestamp', 'desc'), limit(50));
    const unsubFeedback = onSnapshot(qFeedback, (snap) => {
      setFeedback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Feedback)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `hotels/${hotelId}/feedback`);
    });

    return () => {
      unsubReviews();
      unsubFeedback();
    };
  }, [hotelId, user]);

  const handleSaveSettings = async () => {
    if (!hotelId) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, `hotels/${hotelId}/settings/config`), form);
      alert('Settings saved successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `hotels/${hotelId}/settings/config`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8">
          <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mx-auto mb-6">
            <LayoutDashboard className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Review Flow Admin</h1>
          <p className="text-zinc-500 mb-8">Manage your hotel's reputation with privacy-first tools.</p>
          
          {authError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-3">
              <AlertCircle size={18} className="shrink-0" />
              <p className="text-left">{authError}</p>
            </div>
          )}

          <Button onClick={onSignIn} className="w-full flex items-center justify-center gap-3 py-4">
            <User size={20} />
            Sign in with Google
          </Button>
          
          <p className="mt-6 text-xs text-zinc-400">
            By signing in, you agree to our privacy-first data ownership policy.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col md:flex-row pb-20 md:pb-0">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-zinc-200 flex-col sticky top-0 h-screen">
        <div className="p-6 flex items-center gap-3 border-bottom border-zinc-100">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <LayoutDashboard className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-lg">Review Flow</span>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavItem active={activeTab === 'inbox'} icon={<Mail size={20} />} label="Inbox" onClick={() => setActiveTab('inbox')} />
          <NavItem active={activeTab === 'settings'} icon={<SettingsIcon size={20} />} label="Settings" onClick={() => setActiveTab('settings')} />
          <NavItem active={activeTab === 'qr'} icon={<QrCode size={20} />} label="QR Generator" onClick={() => setActiveTab('qr')} />
          <NavItem active={activeTab === 'guests'} icon={<User size={20} />} label="Guests" onClick={() => setActiveTab('guests')} />
        </nav>

        <div className="p-4 border-t border-zinc-100">
          <button 
            onClick={() => signOut(auth)}
            className="flex items-center gap-3 w-full p-3 text-zinc-500 hover:text-red-500 hover:bg-red-50 transition-colors rounded-xl"
          >
            <LogOut size={20} />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 flex justify-around p-2 z-50">
        <MobileNavItem active={activeTab === 'inbox'} icon={<Mail size={20} />} label="Inbox" onClick={() => setActiveTab('inbox')} />
        <MobileNavItem active={activeTab === 'settings'} icon={<SettingsIcon size={20} />} label="Settings" onClick={() => setActiveTab('settings')} />
        <MobileNavItem active={activeTab === 'qr'} icon={<QrCode size={20} />} label="QR" onClick={() => setActiveTab('qr')} />
        <MobileNavItem active={activeTab === 'guests'} icon={<User size={20} />} label="Guests" onClick={() => setActiveTab('guests')} />
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
            <p className="text-zinc-500 text-sm">Manage your hotel's guest experience.</p>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto bg-white p-3 rounded-2xl border border-zinc-100 md:bg-transparent md:p-0 md:border-0">
            <div className="text-left md:text-right flex-1 md:flex-none">
              <p className="font-medium text-sm">{user.displayName}</p>
              <p className="text-xs text-zinc-400">{user.email}</p>
            </div>
            {user.photoURL && <img src={user.photoURL} className="w-10 h-10 rounded-full border border-zinc-200" referrerPolicy="no-referrer" />}
            <button onClick={() => signOut(auth)} className="md:hidden p-2 text-zinc-400 hover:text-red-500">
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {activeTab === 'inbox' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold flex items-center gap-2">
                    <ThumbsUp className="text-green-500 w-5 h-5" />
                    Recent Reviews
                  </h3>
                  <span className="text-xs font-medium px-2 py-1 bg-green-50 text-green-600 rounded-full">{reviews.length} total</span>
                </div>
                <div className="space-y-4">
                  {reviews.length === 0 ? (
                    <EmptyState message="No reviews yet." />
                  ) : (
                    reviews.map(r => (
                      <div key={r.id} className="p-4 rounded-xl border border-zinc-50 bg-zinc-50/50">
                        <div className="flex justify-between mb-1">
                          <div className="flex gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} size={14} fill={i < r.rating ? "#fac815" : "none"} className={i < r.rating ? "text-yellow-400" : "text-zinc-200"} />
                            ))}
                          </div>
                          <span className="text-[10px] text-zinc-400">{new Date(r.timestamp).toLocaleDateString()}</span>
                        </div>
                        <p className="font-medium text-zinc-800">"{r.oneWord}"</p>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold flex items-center gap-2">
                    <ThumbsDown className="text-red-500 w-5 h-5" />
                    Private Feedback
                  </h3>
                  <span className="text-xs font-medium px-2 py-1 bg-red-50 text-red-600 rounded-full">{feedback.length} total</span>
                </div>
                <div className="space-y-4">
                  {feedback.length === 0 ? (
                    <EmptyState message="No feedback yet." />
                  ) : (
                    feedback.map(f => (
                      <div key={f.id} className="p-4 rounded-xl border border-red-50 bg-red-50/30">
                        <div className="flex justify-between mb-2">
                          <span className="text-xs font-bold text-red-600">{f.rating} Stars</span>
                          <span className="text-[10px] text-zinc-400">{new Date(f.timestamp).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm text-zinc-700 mb-3">{f.comment}</p>
                        <div className="flex gap-2">
                          <button className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-black">Reply via Email</button>
                          <button className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-green-600">Resolve</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <Card className="max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <h3 className="font-bold text-lg border-b pb-2">Branding</h3>
                <Input label="Hotel Name" value={form.hotelName} onChange={v => setForm({...form, hotelName: v})} />
                <Input label="Logo URL" value={form.logoUrl || ''} onChange={v => setForm({...form, logoUrl: v})} placeholder="https://..." />
                <Input label="Primary Color" type="color" value={form.primaryColor} onChange={v => setForm({...form, primaryColor: v})} />
                <Input label="Welcome Line" value={form.welcomeLine} onChange={v => setForm({...form, welcomeLine: v})} />
                <Input label="Admin Email (for feedback)" value={form.adminEmail} onChange={v => setForm({...form, adminEmail: v})} />
              </div>
              <div className="space-y-6">
                <h3 className="font-bold text-lg border-b pb-2">Social Links</h3>
                <Input label="Google Review Link" value={form.googleLink || ''} onChange={v => setForm({...form, googleLink: v})} />
                <Input label="TripAdvisor Link" value={form.tripAdvisorLink || ''} onChange={v => setForm({...form, tripAdvisorLink: v})} />
                <Input label="Yelp Link" value={form.yelpLink || ''} onChange={v => setForm({...form, yelpLink: v})} />
                <Input label="Facebook Link" value={form.facebookLink || ''} onChange={v => setForm({...form, facebookLink: v})} />
              </div>
            </div>
            <div className="mt-12 pt-6 border-t flex justify-end">
              <Button onClick={handleSaveSettings} disabled={isSaving} className="w-full md:w-auto">
                {isSaving ? 'Saving...' : 'Save All Changes'}
              </Button>
            </div>
          </Card>
        )}

        {activeTab === 'qr' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="flex flex-col items-center justify-center p-8 md:p-12">
              <div className="p-4 md:p-8 bg-white rounded-3xl border-4 md:border-8 border-zinc-100 shadow-xl mb-8">
                <QRCodeSVG 
                  value={`${window.location.origin}/?hotelId=${hotelId}`} 
                  size={window.innerWidth < 768 ? 160 : 200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <h3 className="text-xl font-bold mb-2">Scan to Rate</h3>
              <p className="text-zinc-400 text-sm mb-8 text-center">Point your camera to start the flow</p>
              <Button variant="outline" className="flex items-center gap-2 w-full md:w-auto justify-center">
                <Download size={18} />
                Download PNG
              </Button>
            </Card>
            <div className="space-y-6">
              <Card>
                <h3 className="font-bold mb-4">QR Customization</h3>
                <p className="text-zinc-500 text-sm mb-6">Print this QR code on keycards, menus, or lobby signs to capture real-time feedback.</p>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-between">
                    <span className="text-sm font-medium">Include Logo</span>
                    <div className="w-10 h-5 bg-black rounded-full relative">
                      <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-between">
                    <span className="text-sm font-medium">Custom Text</span>
                    <span className="text-xs text-zinc-400">"How was your stay?"</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'guests' && (
          <Card className="overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
              <div>
                <h3 className="font-bold">Guest List</h3>
                <p className="text-zinc-500 text-sm">Upload CSV to send automated review requests.</p>
              </div>
              <Button variant="outline" className="flex items-center gap-2 w-full md:w-auto justify-center">
                <Upload size={18} />
                Upload CSV
              </Button>
            </div>
            
            <div className="border rounded-xl overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[500px]">
                <thead className="bg-zinc-50 border-b">
                  <tr>
                    <th className="p-4 font-bold">Guest Name</th>
                    <th className="p-4 font-bold">Email</th>
                    <th className="p-4 font-bold">Status</th>
                    <th className="p-4 font-bold">Last Sent</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <GuestRow name="John Smith" email="john@example.com" status="Sent" date="2 hours ago" />
                  <GuestRow name="Sarah Miller" email="sarah.m@gmail.com" status="Opened" date="5 hours ago" />
                  <GuestRow name="David Chen" email="dchen@work.com" status="Rated" date="Yesterday" />
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}

function MobileNavItem({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 p-2 rounded-xl transition-all flex-1",
        active ? "text-black" : "text-zinc-400"
      )}
    >
      <div className={cn("p-2 rounded-xl transition-all", active && "bg-zinc-100")}>
        {icon}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

function NavItem({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full p-3 rounded-xl transition-all",
        active ? "bg-black text-white shadow-lg shadow-black/10" : "text-zinc-500 hover:bg-zinc-100"
      )}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder }: { label: string, value: string, onChange: (v: string) => void, type?: string, placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">{label}</label>
      <input 
        type={type} 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        placeholder={placeholder}
        className="w-full p-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-black transition-all"
      />
    </div>
  );
}

function GuestRow({ name, email, status, date }: { name: string, email: string, status: string, date: string }) {
  const statusColors = {
    'Sent': 'bg-zinc-100 text-zinc-600',
    'Opened': 'bg-blue-50 text-blue-600',
    'Rated': 'bg-green-50 text-green-600',
  };

  return (
    <tr className="hover:bg-zinc-50/50 transition-colors">
      <td className="p-4 font-medium">{name}</td>
      <td className="p-4 text-zinc-500">{email}</td>
      <td className="p-4">
        <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", (statusColors as any)[status])}>
          {status}
        </span>
      </td>
      <td className="p-4 text-zinc-400 text-xs">{date}</td>
      <td className="p-4 text-right">
        <button className="text-zinc-300 hover:text-black transition-colors">
          <ChevronRight size={18} />
        </button>
      </td>
    </tr>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-12 text-center">
      <MessageSquare className="w-8 h-8 text-zinc-200 mx-auto mb-3" />
      <p className="text-sm text-zinc-400">{message}</p>
    </div>
  );
}
