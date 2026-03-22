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
  highlight?: string;
  source?: string;
  recommend?: boolean;
  guestName?: string;
  guestEmail?: string;
  timestamp: string;
  guestId?: string;
}

interface Feedback {
  id: string;
  rating: number;
  comment: string;
  highlight?: string;
  source?: string;
  recommend?: boolean;
  guestName?: string;
  guestEmail?: string;
  timestamp: string;
  guestId?: string;
  resolved?: boolean;
}

interface Promo {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  buttonText?: string;
  buttonLink?: string;
  type: 'promo' | 'news' | 'newsletter' | 'blog';
  active: boolean;
}

interface NewsletterSignup {
  id: string;
  email: string;
  name?: string;
  timestamp: string;
}

// --- Components ---

const Button = ({ children, onClick, className, variant = 'primary', disabled = false }: { 
  children: React.ReactNode, 
  onClick?: () => void, 
  className?: string, 
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'accent',
  disabled?: boolean
}) => {
  const variants = {
    primary: 'bg-white text-black hover:bg-zinc-200',
    secondary: 'bg-charcoal text-white hover:bg-zinc-800',
    outline: 'border border-white/20 text-white hover:bg-white/10',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    accent: 'bg-pink text-black hover:bg-pink-light font-bold',
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={cn(
        'px-6 py-4 rounded-3xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 tracking-tight',
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className, ...props }: { children: React.ReactNode, className?: string, [key: string]: any }) => (
  <div className={cn('bg-charcoal/50 backdrop-blur-md rounded-3xl border border-white/10 p-8', className)} {...props}>
    {children}
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [view, setView] = useState<'guest' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('hotelId') ? 'guest' : 'admin';
    }
    return 'admin';
  });
  const [hotelId, setHotelId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('hotelId');
    }
    return null;
  });
  const [settings, setSettings] = useState<HotelSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Sync URL changes
  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('hotelId');
      if (id) {
        setHotelId(id);
        setView('guest');
      } else {
        setView('admin');
      }
    };

    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      
      if (u && !hotelId && view === 'admin') {
        setHotelId(u.uid);
      }
      
      // If we are in admin view, we need auth to stop loading
      if (view === 'admin') {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [hotelId, view]);

  // Fetch settings
  useEffect(() => {
    if (!hotelId) {
      if (view === 'admin') setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, `hotels/${hotelId}/settings/config`), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as HotelSettings);
      }
      setLoading(false);
    }, (error) => {
      console.error("Settings fetch error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [hotelId, view]);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Sign in error:", error);
      setAuthError(error.message || "Failed to sign in. Please try again.");
    }
  };

  if (view === 'guest' && hotelId) {
    return <GuestFlow hotelId={hotelId} settings={settings} />;
  }

  if (loading && !isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-pink border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return <AdminDashboard user={user} hotelId={hotelId} settings={settings} onSignIn={handleSignIn} authError={authError} />;
}

// --- Guest Flow ---

function GuestFlow({ hotelId, settings }: { hotelId: string, settings: HotelSettings | null }) {
  const [step, setStep] = useState<'welcome' | 'rating' | 'highlight' | 'oneword' | 'feedback' | 'moreQuestions' | 'shareInfo' | 'thanks' | 'promos'>('welcome');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [oneWord, setOneWord] = useState('');
  const [highlight, setHighlight] = useState('');
  const [feedback, setFeedback] = useState('');
  const [source, setSource] = useState('');
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [promos, setPromos] = useState<Promo[]>([]);

  const steps = ['welcome', 'rating', 'highlight', 'oneword', 'feedback', 'moreQuestions', 'shareInfo', 'promos', 'thanks'];
  const currentStepIndex = steps.indexOf(step);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  useEffect(() => {
    const q = query(collection(db, `hotels/${hotelId}/promos`));
    const unsub = onSnapshot(q, (snap) => {
      setPromos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Promo)).filter(p => p.active));
    });
    return () => unsub();
  }, [hotelId]);

  const suggestions = ['Amazing!', 'Perfect!', 'Wow!', 'Cozy', 'Stunning', 'Friendly'];
  const sourceOptions = ['Google Search', 'Social Media', 'Friend/Family', 'Travel Agent', 'Other'];

  const getEmoji = (val: number) => {
    if (val === 1) return '😡';
    if (val === 2) return '😕';
    if (val === 3) return '😐';
    if (val === 4) return '😊';
    if (val === 5) return '🤩';
    return '✨';
  };

  const handleRatingSubmit = async (val: number) => {
    setRating(val);
    setStep('highlight');
  };

  const handleHighlightSubmit = () => {
    if (rating >= 4) {
      setStep('oneword');
    } else {
      setStep('feedback');
    }
  };

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    try {
      const commonData = {
        rating,
        highlight,
        source: source || null,
        recommend: recommend,
        guestName: guestName || null,
        guestEmail: guestEmail || null,
        timestamp: new Date().toISOString(),
        guestId: 'anonymous'
      };

      if (rating >= 4) {
        await addDoc(collection(db, `hotels/${hotelId}/reviews`), {
          ...commonData,
          oneWord,
        });
      } else {
        await addDoc(collection(db, `hotels/${hotelId}/feedback`), {
          ...commonData,
          comment: feedback,
          resolved: false
        });
      }

      if (promos.length > 0) {
        setStep('promos');
      } else {
        setStep('thanks');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `hotels/${hotelId}/${rating >= 4 ? 'reviews' : 'feedback'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewsletterSignup = async (email: string, name?: string) => {
    try {
      await addDoc(collection(db, `hotels/${hotelId}/signups`), {
        email,
        name: name || null,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `hotels/${hotelId}/signups`);
    }
  };

  if (!settings) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,131,218,0.05),transparent_70%)]" />
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-pink border-t-transparent rounded-full relative z-10"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-soehne overflow-hidden relative">
      {/* Immersive Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 5, 0],
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute -top-1/2 -left-1/2 w-full h-full bg-pink/20 blur-[120px] rounded-full"
        />
        <motion.div 
          animate={{ 
            scale: [1.2, 1, 1.2],
            rotate: [0, -5, 0],
            opacity: [0.1, 0.15, 0.1]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-blue/20 blur-[120px] rounded-full"
        />
      </div>

      {/* Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1.5 bg-white/5 z-[100]">
        <motion.div 
          className="h-full bg-pink shadow-[0_0_15px_#FF00FF]"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 50, damping: 20 }}
        />
      </div>

      {/* Background Accents */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-pink/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-blue/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute top-[30%] right-[-10%] w-[30%] h-[30%] bg-yellow/5 blur-[100px] rounded-full pointer-events-none" />

      <AnimatePresence mode="popLayout">
        {step === 'welcome' && (
          <motion.div 
            key="welcome"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.05, y: -10, filter: "blur(10px)" }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="max-w-md w-full text-center z-10 px-4"
          >
            {settings.logoUrl && (
              <motion.img 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                src={settings.logoUrl} 
                alt="Logo" 
                className="h-16 md:h-20 mx-auto mb-10 object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]" 
                referrerPolicy="no-referrer" 
              />
            )}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mb-4"
            >
              <span className="px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-supporting-grey">
                Guest Experience
              </span>
            </motion.div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-6 leading-[0.85] uppercase">
              {settings.hotelName}
            </h1>
            <p className="text-supporting-grey text-lg mb-12 font-medium leading-relaxed">
              {settings.welcomeLine || "We'd love to hear about your stay."}
            </p>
            <Button 
              onClick={() => setStep('rating')} 
              variant="accent" 
              className="w-full h-16 text-lg uppercase tracking-widest font-black group overflow-hidden relative shadow-[0_10px_30px_rgba(255,0,255,0.3)]"
            >
              <span className="relative z-10">Start Review</span>
              <motion.div 
                className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500"
              />
            </Button>
          </motion.div>
        )}

        {step === 'rating' && (
          <motion.div 
            key="rating"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.1, y: -20, filter: "blur(10px)" }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="max-w-md w-full text-center z-10 px-4"
          >
            <motion.div 
              key={hoverRating || rating}
              initial={{ scale: 0.5, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="text-8xl md:text-9xl mb-10 drop-shadow-[0_10px_30px_rgba(255,255,255,0.1)]"
            >
              {getEmoji(hoverRating || rating)}
            </motion.div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tighter mb-12 uppercase">Rate your stay</h2>
            <div className="flex justify-between gap-2 mb-12">
              {[1, 2, 3, 4, 5].map((star) => (
                <motion.button
                  key={star}
                  whileHover={{ scale: 1.2, y: -5 }}
                  whileTap={{ scale: 0.85 }}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => handleRatingSubmit(star)}
                  className={cn(
                    "p-3 rounded-2xl transition-all duration-300",
                    (hoverRating || rating) >= star ? "text-pink drop-shadow-[0_0_20px_rgba(255,0,255,0.4)]" : "text-white/10"
                  )}
                >
                  <Star size={48} fill={(hoverRating || rating) >= star ? "currentColor" : "none"} strokeWidth={1.5} />
                </motion.button>
              ))}
            </div>
            <p className="text-supporting-grey text-[10px] uppercase tracking-[0.3em] font-black opacity-40">Tap a star to continue</p>
          </motion.div>
        )}

        {step === 'highlight' && (
          <motion.div 
            key="highlight"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="max-w-md w-full z-10 px-4"
          >
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter mb-4 uppercase">The Highlight?</h2>
            <p className="text-supporting-grey text-lg mb-8">What was the best part of your stay?</p>
            
            <textarea 
              value={highlight}
              onChange={(e) => setHighlight(e.target.value)}
              placeholder="The breakfast, the view, the staff..."
              className="w-full p-6 bg-charcoal border border-white/10 rounded-3xl text-white text-lg focus:outline-none focus:ring-2 focus:ring-pink mb-8 min-h-[140px] placeholder:text-white/20 shadow-inner"
              autoFocus
            />

            <Button onClick={handleHighlightSubmit} variant="accent" className="w-full py-6 uppercase tracking-widest font-black">
              Next
            </Button>
          </motion.div>
        )}

        {step === 'oneword' && (
          <motion.div 
            key="oneword"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="max-w-md w-full z-10 px-4"
          >
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter mb-4 uppercase">Love that!</h2>
            <p className="text-supporting-grey text-lg mb-8">One word to describe your experience?</p>
            
            <input 
              type="text" 
              value={oneWord}
              onChange={(e) => setOneWord(e.target.value)}
              placeholder="Amazing!"
              className="w-full p-6 bg-charcoal border border-white/10 rounded-3xl text-white text-xl focus:outline-none focus:ring-2 focus:ring-pink mb-8 placeholder:text-white/20 shadow-inner"
              autoFocus
            />

            <div className="flex flex-wrap gap-2 mb-10">
              {suggestions.map(s => (
                <motion.button 
                  key={s}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setOneWord(s)}
                  className="px-5 py-3 rounded-full bg-white/5 text-white text-sm font-black hover:bg-pink hover:text-black transition-all uppercase tracking-wider border border-white/5"
                >
                  {s}
                </motion.button>
              ))}
            </div>

            <Button onClick={() => setStep('moreQuestions')} variant="accent" className="w-full py-6 uppercase tracking-widest font-black">
              Next
            </Button>
          </motion.div>
        )}

        {step === 'feedback' && (
          <motion.div 
            key="feedback"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            className="max-w-md w-full z-10"
          >
            <h2 className="text-4xl font-black tracking-tighter mb-4 uppercase">We're sorry.</h2>
            <p className="text-supporting-grey text-lg mb-10">How can we make it right?</p>
            
            <textarea 
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell us what went wrong..."
              className="w-full p-6 bg-charcoal border border-white/10 rounded-3xl text-white text-lg focus:outline-none focus:ring-2 focus:ring-pink mb-8 min-h-[160px] placeholder:text-white/20"
              autoFocus
            />

            <div className="flex flex-col gap-4">
              <Button onClick={() => setStep('moreQuestions')} variant="accent" className="w-full uppercase tracking-widest">
                Next
              </Button>
              <button 
                onClick={() => setStep('moreQuestions')} 
                className="text-supporting-grey hover:text-white transition-colors text-sm font-bold uppercase tracking-widest py-2"
              >
                Skip for now
              </button>
            </div>
          </motion.div>
        )}

        {step === 'moreQuestions' && (
          <motion.div 
            key="moreQuestions"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            className="max-w-md w-full z-10"
          >
            <h2 className="text-4xl font-black tracking-tighter mb-4 uppercase">Quick Bonus!</h2>
            <p className="text-supporting-grey text-lg mb-10">Help us grow with two quick taps.</p>
            
            <div className="space-y-8 mb-12">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-supporting-grey block mb-4">How did you find us?</label>
                <div className="flex flex-wrap gap-3">
                  {sourceOptions.map(opt => (
                    <motion.button 
                      key={opt}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSource(opt)}
                      className={cn(
                        "px-5 py-2.5 rounded-full text-xs font-bold transition-all uppercase tracking-wider border",
                        source === opt ? "bg-pink text-black border-pink" : "bg-white/5 text-white border-white/10 hover:border-white/20"
                      )}
                    >
                      {opt}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-supporting-grey block mb-4">Recommend to a friend?</label>
                <div className="flex gap-4">
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setRecommend(true)}
                    className={cn(
                      "flex-1 p-6 rounded-3xl border transition-all flex flex-col items-center gap-2",
                      recommend === true ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" : "bg-white/5 border-white/10 text-white hover:border-white/20"
                    )}
                  >
                    <ThumbsUp size={24} />
                    <span className="text-xs font-black uppercase tracking-widest">Yes</span>
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setRecommend(false)}
                    className={cn(
                      "flex-1 p-6 rounded-3xl border transition-all flex flex-col items-center gap-2",
                      recommend === false ? "bg-red-500/10 border-red-500 text-red-500" : "bg-white/5 border-white/10 text-white hover:border-white/20"
                    )}
                  >
                    <ThumbsDown size={24} />
                    <span className="text-xs font-black uppercase tracking-widest">No</span>
                  </motion.button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <Button onClick={() => setStep('shareInfo')} variant="accent" className="w-full uppercase tracking-widest">
                Next
              </Button>
              <button 
                onClick={() => setStep('shareInfo')} 
                className="text-supporting-grey hover:text-white transition-colors text-sm font-bold uppercase tracking-widest py-2"
              >
                Skip
              </button>
            </div>
          </motion.div>
        )}

        {step === 'shareInfo' && (
          <motion.div 
            key="shareInfo"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="max-w-md w-full z-10 px-4"
          >
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter mb-4 uppercase">VIP Access?</h2>
            <p className="text-supporting-grey text-lg mb-8">Share your info for exclusive treats and follow-ups.</p>
            
            <div className="space-y-4 mb-10">
              <input 
                type="text" 
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Your Name"
                className="w-full p-6 bg-charcoal border border-white/10 rounded-3xl text-white text-lg focus:outline-none focus:ring-2 focus:ring-pink placeholder:text-white/20 shadow-inner"
              />
              <input 
                type="email" 
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="Your Email"
                className="w-full p-6 bg-charcoal border border-white/10 rounded-3xl text-white text-lg focus:outline-none focus:ring-2 focus:ring-pink placeholder:text-white/20 shadow-inner"
              />
            </div>

            <div className="flex flex-col gap-4">
              <Button onClick={handleFinalSubmit} disabled={submitting} variant="accent" className="w-full py-6 uppercase tracking-widest font-black">
                {submitting ? 'Sending...' : 'Join the Circle'}
              </Button>
              <button 
                onClick={handleFinalSubmit} 
                disabled={submitting}
                className="text-supporting-grey hover:text-white transition-colors text-xs font-black uppercase tracking-widest py-2"
              >
                Maybe Later
              </button>
            </div>
          </motion.div>
        )}

        {step === 'promos' && (
          <motion.div 
            key="promos"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full text-center z-10"
          >
            <div className="space-y-8">
              {promos.map((promo, idx) => (
                <motion.div 
                  key={promo.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="p-8 rounded-[40px] bg-charcoal border border-white/10 overflow-hidden relative"
                >
                  {promo.imageUrl && (
                    <img src={promo.imageUrl} className="absolute inset-0 w-full h-full object-cover opacity-20" referrerPolicy="no-referrer" />
                  )}
                    <div className="relative z-10">
                      <div className="flex items-center justify-center gap-2 mb-4">
                        {promo.type === 'blog' && <MessageSquare size={16} className="text-pink" />}
                        {promo.type === 'newsletter' && <Mail size={16} className="text-pink" />}
                        {promo.type === 'promo' && <ThumbsUp size={16} className="text-pink" />}
                        <span className="text-[10px] font-black uppercase tracking-widest text-pink">{promo.type}</span>
                      </div>
                      <h3 className="text-3xl font-black uppercase tracking-tight mb-3 leading-tight">{promo.title}</h3>
                      <p className="text-supporting-grey font-medium mb-8 leading-relaxed">{promo.description}</p>
                    
                    {promo.type === 'newsletter' ? (
                      <div className="flex gap-2">
                        <input 
                          type="email" 
                          placeholder="Email" 
                          className="flex-1 p-4 bg-white/5 border border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-pink"
                          id={`newsletter-${promo.id}`}
                        />
                        <Button 
                          variant="accent" 
                          className="px-6 py-4 text-xs uppercase tracking-widest"
                          onClick={() => {
                            const input = document.getElementById(`newsletter-${promo.id}`) as HTMLInputElement;
                            if (input?.value) {
                              handleNewsletterSignup(input.value, guestName);
                              input.value = '';
                              alert('Thank you for signing up!');
                            }
                          }}
                        >
                          Join
                        </Button>
                      </div>
                    ) : (
                      promo.buttonLink && (
                        <Button 
                          variant="accent" 
                          className="w-full uppercase tracking-widest text-sm"
                          onClick={() => window.open(promo.buttonLink, '_blank')}
                        >
                          {promo.buttonText || 'Learn More'}
                        </Button>
                      )
                    )}
                  </div>
                </motion.div>
              ))}
              <button 
                onClick={() => setStep('thanks')} 
                className="text-supporting-grey hover:text-white transition-colors text-sm font-bold uppercase tracking-widest py-4"
              >
                Continue to Final Step
              </button>
            </div>
          </motion.div>
        )}

        {step === 'thanks' && (
          <motion.div 
            key="thanks"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full text-center z-10"
          >
            <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-10 border border-emerald-500/30">
              <CheckCircle className="w-12 h-12 text-emerald-500" />
            </div>
            <h2 className="text-5xl font-black tracking-tighter mb-6 uppercase">Thank you</h2>
            
            {rating >= 4 ? (
              <>
                <p className="text-supporting-grey text-lg mb-12">Help others find us by sharing your experience.</p>
                <div className="grid grid-cols-1 gap-4">
                  {settings.googleLink && (
                    <SocialButton icon={<img src="https://www.google.com/favicon.ico" className="w-6 h-6" />} label="Review on Google" href={settings.googleLink} />
                  )}
                  {settings.tripAdvisorLink && (
                    <SocialButton icon={<ThumbsUp className="w-6 h-6 text-emerald-400" />} label="Rate on TripAdvisor" href={settings.tripAdvisorLink} />
                  )}
                </div>
              </>
            ) : (
              <p className="text-supporting-grey text-lg">We've received your feedback and will look into it immediately. We hope to see you again soon.</p>
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
      className="flex items-center justify-between gap-4 p-6 rounded-3xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all group"
    >
      <div className="flex items-center gap-4">
        {icon}
        <span className="font-bold text-lg uppercase tracking-tight">{label}</span>
      </div>
      <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-pink transition-colors" />
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
  const [activeTab, setActiveTab] = useState<'inbox' | 'settings' | 'qr' | 'guests' | 'promos'>('inbox');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [signups, setSignups] = useState<NewsletterSignup[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<any>(null);

  // Unified Guest List
  const guestList = useMemo(() => {
    const guests = new Map<string, { name: string, email: string, source?: string, timestamp: string, type: 'Review' | 'Feedback' | 'Newsletter' }>();
    
    reviews.forEach(r => {
      if (r.guestEmail) {
        guests.set(r.guestEmail, { 
          name: r.guestName || 'Anonymous', 
          email: r.guestEmail, 
          source: r.source,
          timestamp: r.timestamp,
          type: 'Review'
        });
      }
    });

    feedback.forEach(f => {
      if (f.guestEmail) {
        const existing = guests.get(f.guestEmail);
        if (!existing || new Date(f.timestamp) > new Date(existing.timestamp)) {
          guests.set(f.guestEmail, { 
            name: f.guestName || 'Anonymous', 
            email: f.guestEmail, 
            source: f.source,
            timestamp: f.timestamp,
            type: 'Feedback'
          });
        }
      }
    });

    signups.forEach(s => {
      const existing = guests.get(s.email);
      if (!existing || new Date(s.timestamp) > new Date(existing.timestamp)) {
        guests.set(s.email, { 
          name: s.name || 'Anonymous', 
          email: s.email, 
          timestamp: s.timestamp,
          type: 'Newsletter'
        });
      }
    });

    return Array.from(guests.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [reviews, feedback, signups]);

  const exportToCSV = () => {
    if (guestList.length === 0) return;
    
    const headers = ['Name', 'Email', 'Source', 'Type', 'Date'];
    const rows = guestList.map(g => [
      g.name,
      g.email,
      g.source || 'N/A',
      g.type,
      new Date(g.timestamp).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `guests_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

  // Promo form state
  const [promoForm, setPromoForm] = useState<Partial<Promo>>({
    title: '',
    description: '',
    imageUrl: '',
    buttonText: '',
    buttonLink: '',
    type: 'promo',
    active: true
  });

  useEffect(() => {
    if (settings) {
      setForm(settings);
    }
  }, [settings]);

  // Fetch reviews, feedback, promos, signups
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

    const qPromos = query(collection(db, `hotels/${hotelId}/promos`), orderBy('active', 'desc'));
    const unsubPromos = onSnapshot(qPromos, (snap) => {
      setPromos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Promo)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `hotels/${hotelId}/promos`);
    });

    const qSignups = query(collection(db, `hotels/${hotelId}/signups`), orderBy('timestamp', 'desc'));
    const unsubSignups = onSnapshot(qSignups, (snap) => {
      setSignups(snap.docs.map(d => ({ id: d.id, ...d.data() } as NewsletterSignup)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `hotels/${hotelId}/signups`);
    });

    return () => {
      unsubReviews();
      unsubFeedback();
      unsubPromos();
      unsubSignups();
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

  const handleAddPromo = async () => {
    if (!hotelId) return;
    try {
      await addDoc(collection(db, `hotels/${hotelId}/promos`), promoForm);
      setPromoForm({ title: '', description: '', imageUrl: '', buttonText: '', buttonLink: '', type: 'promo', active: true });
      alert('Promo added!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `hotels/${hotelId}/promos`);
    }
  };

  const togglePromo = async (id: string, active: boolean) => {
    if (!hotelId) return;
    try {
      await updateDoc(doc(db, `hotels/${hotelId}/promos`, id), { active });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `hotels/${hotelId}/promos/${id}`);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 font-soehne">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,131,218,0.1),transparent_70%)] pointer-events-none" />
        <Card className="max-w-md w-full text-center p-12 relative overflow-hidden">
          <div className="w-20 h-20 bg-pink rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-3 shadow-[0_0_30px_rgba(255,131,218,0.3)]">
            <LayoutDashboard className="text-black w-10 h-10" />
          </div>
          <h1 className="text-4xl font-black mb-4 tracking-tighter uppercase">Review Flow</h1>
          <p className="text-supporting-grey mb-10 font-medium">Manage your hotel's reputation with privacy-first tools.</p>
          
          {authError && (
            <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-center gap-3">
              <AlertCircle size={18} className="shrink-0" />
              <p className="text-left">{authError}</p>
            </div>
          )}

          <Button onClick={onSignIn} variant="accent" className="w-full flex items-center justify-center gap-3 py-5 uppercase tracking-widest">
            <User size={20} />
            Sign in with Google
          </Button>
          
          <p className="mt-8 text-xs text-supporting-grey/50 uppercase tracking-widest font-bold">
            Privacy-first data ownership
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row pb-20 md:pb-0 font-soehne">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-72 bg-charcoal border-r border-white/5 flex-col sticky top-0 h-screen">
        <div className="p-8 flex items-center gap-4">
          <div className="w-10 h-10 bg-pink rounded-xl flex items-center justify-center rotate-3">
            <LayoutDashboard className="text-black w-6 h-6" />
          </div>
          <span className="font-black text-2xl tracking-tighter uppercase">Review Flow</span>
        </div>

        <nav className="flex-1 p-6 space-y-2">
          <NavItem active={activeTab === 'inbox'} icon={<Mail size={20} />} label="Inbox" onClick={() => setActiveTab('inbox')} />
          <NavItem active={activeTab === 'settings'} icon={<SettingsIcon size={20} />} label="Settings" onClick={() => setActiveTab('settings')} />
          <NavItem active={activeTab === 'promos'} icon={<Share2 size={20} />} label="Slides" onClick={() => setActiveTab('promos')} />
          <NavItem active={activeTab === 'qr'} icon={<QrCode size={20} />} label="QR Generator" onClick={() => setActiveTab('qr')} />
          <NavItem active={activeTab === 'guests'} icon={<User size={20} />} label="Guests" onClick={() => setActiveTab('guests')} />
        </nav>

        <div className="p-6 border-t border-white/5">
          <button 
            onClick={() => signOut(auth)}
            className="flex items-center gap-3 w-full p-4 text-supporting-grey hover:text-red-400 hover:bg-red-400/5 transition-all rounded-2xl font-bold uppercase tracking-widest text-xs"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-charcoal/80 backdrop-blur-xl border-t border-white/5 flex justify-around p-4 z-50">
        <MobileNavItem active={activeTab === 'inbox'} icon={<Mail size={20} />} label="Inbox" onClick={() => setActiveTab('inbox')} />
        <MobileNavItem active={activeTab === 'settings'} icon={<SettingsIcon size={20} />} label="Settings" onClick={() => setActiveTab('settings')} />
        <MobileNavItem active={activeTab === 'promos'} icon={<Share2 size={20} />} label="Slides" onClick={() => setActiveTab('promos')} />
        <MobileNavItem active={activeTab === 'qr'} icon={<QrCode size={20} />} label="QR" onClick={() => setActiveTab('qr')} />
        <MobileNavItem active={activeTab === 'guests'} icon={<User size={20} />} label="Guests" onClick={() => setActiveTab('guests')} />
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 md:p-12">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div>
            <h2 className="text-5xl font-black tracking-tighter uppercase mb-2">{activeTab}</h2>
            <p className="text-supporting-grey font-medium">Manage your hotel's guest experience.</p>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto bg-charcoal p-4 rounded-3xl border border-white/5 shadow-xl">
            <div className="text-left md:text-right flex-1 md:flex-none">
              <p className="font-bold text-sm uppercase tracking-tight">{user.displayName}</p>
              <p className="text-xs text-supporting-grey uppercase tracking-widest">{user.email}</p>
            </div>
            {user.photoURL && <img src={user.photoURL} className="w-12 h-12 rounded-2xl border border-white/10 shadow-lg" referrerPolicy="no-referrer" />}
          </div>
        </header>

        {activeTab === 'inbox' && (
          <div className="space-y-12">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
              <div className="bg-charcoal/50 backdrop-blur-md p-8 rounded-[40px] border border-white/5 shadow-xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-supporting-grey mb-2">Total Reviews</p>
                <p className="text-4xl font-black tracking-tighter text-emerald-400">{reviews.length}</p>
              </div>
              <div className="bg-charcoal/50 backdrop-blur-md p-8 rounded-[40px] border border-white/5 shadow-xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-supporting-grey mb-2">Avg Rating</p>
                <p className="text-4xl font-black tracking-tighter text-yellow">
                  {reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : '0.0'}
                </p>
              </div>
              <div className="bg-charcoal/50 backdrop-blur-md p-8 rounded-[40px] border border-white/5 shadow-xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-supporting-grey mb-2">Private Feedback</p>
                <p className="text-4xl font-black tracking-tighter text-red-400">{feedback.length}</p>
              </div>
              <div className="bg-charcoal/50 backdrop-blur-md p-8 rounded-[40px] border border-white/5 shadow-xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-supporting-grey mb-2">Guest List</p>
                <p className="text-4xl font-black tracking-tighter text-pink">{guestList.length}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-8">
                <div className="flex items-center justify-between mb-4 px-2">
                  <h3 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                    <ThumbsUp className="text-emerald-400 w-8 h-8" />
                    Reviews
                  </h3>
                </div>
                <div className="space-y-6">
                  {reviews.length === 0 ? (
                    <EmptyState message="No reviews yet." />
                  ) : (
                    reviews.map(r => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={r.id} 
                        className="p-8 rounded-[40px] bg-charcoal/50 backdrop-blur-md border border-white/5 hover:border-white/20 transition-all shadow-lg group"
                      >
                        <div className="flex justify-between items-start mb-6">
                          <div className="flex gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} size={18} fill="var(--color-yellow)" className={i < r.rating ? "text-yellow" : "text-white/5"} />
                            ))}
                          </div>
                          <span className="text-[10px] font-black text-supporting-grey uppercase tracking-widest opacity-50">{new Date(r.timestamp).toLocaleDateString()}</span>
                        </div>
                        <p className="text-2xl font-black tracking-tight mb-4 leading-tight">"{r.oneWord}"</p>
                        <div className="space-y-3 mb-8">
                          {r.highlight && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase tracking-widest text-pink/50">Highlight</span>
                              <p className="text-sm font-bold text-white/80">{r.highlight}</p>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-4">
                            {r.source && (
                              <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full">
                                <Share2 size={10} className="text-supporting-grey" />
                                <span className="text-[10px] text-supporting-grey font-black uppercase tracking-widest">{r.source}</span>
                              </div>
                            )}
                            {r.recommend !== undefined && (
                              <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full">
                                {r.recommend ? <ThumbsUp size={10} className="text-emerald-400" /> : <ThumbsDown size={10} className="text-red-400" />}
                                <span className="text-[10px] text-supporting-grey font-black uppercase tracking-widest">Recommend</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {r.guestName && (
                          <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-pink/10 rounded-xl flex items-center justify-center">
                                <User size={14} className="text-pink" />
                              </div>
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">{r.guestName}</p>
                                <p className="text-[10px] text-supporting-grey font-bold lowercase tracking-tight leading-none">{r.guestEmail}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-8">
                <div className="flex items-center justify-between mb-4 px-2">
                  <h3 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                    <ThumbsDown className="text-red-400 w-8 h-8" />
                    Feedback
                  </h3>
                </div>
                <div className="space-y-6">
                  {feedback.length === 0 ? (
                    <EmptyState message="No feedback yet." />
                  ) : (
                    feedback.map(f => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={f.id} 
                        className="p-8 rounded-[40px] bg-red-400/5 border border-red-400/10 hover:border-red-400/20 transition-all shadow-lg"
                      >
                        <div className="flex justify-between items-start mb-6">
                          <span className="px-3 py-1 bg-red-400/10 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-red-400/20">{f.rating} Stars</span>
                          <span className="text-[10px] font-black text-supporting-grey uppercase tracking-widest opacity-50">{new Date(f.timestamp).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xl font-bold text-white/90 mb-6 leading-relaxed">"{f.comment}"</p>
                        <div className="space-y-3 mb-8">
                          {f.highlight && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase tracking-widest text-red-400/50">Highlight</span>
                              <p className="text-sm font-bold text-white/80">{f.highlight}</p>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-4">
                            {f.source && (
                              <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full">
                                <Share2 size={10} className="text-supporting-grey" />
                                <span className="text-[10px] text-supporting-grey font-black uppercase tracking-widest">{f.source}</span>
                              </div>
                            )}
                            {f.recommend !== undefined && (
                              <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full">
                                {f.recommend ? <ThumbsUp size={10} className="text-emerald-400" /> : <ThumbsDown size={10} className="text-red-400" />}
                                <span className="text-[10px] text-supporting-grey font-black uppercase tracking-widest">Recommend</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {f.guestName && (
                          <div className="mb-8 pt-6 border-t border-white/5 flex items-center gap-3">
                            <div className="w-8 h-8 bg-red-400/10 rounded-xl flex items-center justify-center">
                              <User size={14} className="text-red-400" />
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">{f.guestName}</p>
                              <p className="text-[10px] text-supporting-grey font-bold lowercase tracking-tight leading-none">{f.guestEmail}</p>
                            </div>
                          </div>
                        )}
                        <div className="flex gap-8">
                          <button className="text-[10px] font-black uppercase tracking-widest text-supporting-grey hover:text-white transition-colors">Reply</button>
                          <button className="text-[10px] font-black uppercase tracking-widest text-supporting-grey hover:text-emerald-400 transition-colors">Resolve</button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <Card className="max-w-5xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-8">
                <h3 className="text-xl font-black uppercase tracking-tight border-b border-white/5 pb-4">Branding</h3>
                <Input label="Hotel Name" value={form.hotelName} onChange={v => setForm({...form, hotelName: v})} />
                <Input label="Logo URL" value={form.logoUrl || ''} onChange={v => setForm({...form, logoUrl: v})} placeholder="https://..." />
                <Input label="Primary Color" type="color" value={form.primaryColor} onChange={v => setForm({...form, primaryColor: v})} />
                <Input label="Welcome Line" value={form.welcomeLine} onChange={v => setForm({...form, welcomeLine: v})} />
                <Input label="Admin Email" value={form.adminEmail} onChange={v => setForm({...form, adminEmail: v})} />
              </div>
              <div className="space-y-8">
                <h3 className="text-xl font-black uppercase tracking-tight border-b border-white/5 pb-4">Social Links</h3>
                <Input label="Google Review Link" value={form.googleLink || ''} onChange={v => setForm({...form, googleLink: v})} />
                <Input label="TripAdvisor Link" value={form.tripAdvisorLink || ''} onChange={v => setForm({...form, tripAdvisorLink: v})} />
                <Input label="Yelp Link" value={form.yelpLink || ''} onChange={v => setForm({...form, yelpLink: v})} />
                <Input label="Facebook Link" value={form.facebookLink || ''} onChange={v => setForm({...form, facebookLink: v})} />
              </div>
            </div>
            <div className="mt-16 pt-8 border-t border-white/5 flex justify-end">
              <Button onClick={handleSaveSettings} disabled={isSaving} variant="accent" className="w-full md:w-auto uppercase tracking-widest">
                {isSaving ? 'Saving...' : 'Save All Changes'}
              </Button>
            </div>
          </Card>
        )}

        {activeTab === 'qr' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <Card className="flex flex-col items-center justify-center p-12 md:p-20">
              <div className="p-8 md:p-12 bg-white rounded-[40px] shadow-[0_0_60px_rgba(255,255,255,0.1)] mb-12">
                <QRCodeSVG 
                  value={`${window.location.origin}/?hotelId=${hotelId}`} 
                  size={window.innerWidth < 768 ? 200 : 280}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <h3 className="text-3xl font-black mb-4 uppercase tracking-tighter">Scan to Rate</h3>
              <p className="text-supporting-grey font-medium mb-12 text-center">Point your camera to start the flow</p>
              <Button variant="outline" className="flex items-center gap-3 w-full md:w-auto justify-center uppercase tracking-widest text-sm">
                <Download size={20} />
                Download PNG
              </Button>
            </Card>
            <div className="space-y-8">
              <Card>
                <h3 className="text-xl font-black uppercase tracking-tight mb-6">QR Customization</h3>
                <p className="text-supporting-grey font-medium mb-10 leading-relaxed">Print this QR code on keycards, menus, or lobby signs to capture real-time feedback.</p>
                <div className="space-y-4">
                  <div className="p-6 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                    <span className="text-sm font-bold uppercase tracking-widest">Include Logo</span>
                    <div className="w-12 h-6 bg-pink rounded-full relative">
                      <div className="absolute right-1.5 top-1.5 w-3 h-3 bg-black rounded-full" />
                    </div>
                  </div>
                  <div className="p-6 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                    <span className="text-sm font-bold uppercase tracking-widest">Custom Text</span>
                    <span className="text-xs text-supporting-grey font-bold uppercase tracking-widest">"How was your stay?"</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'promos' && (
          <div className="space-y-8">
            <Card className="max-w-2xl">
              <h3 className="text-xl font-black uppercase tracking-tight mb-8">Add New Slide</h3>
              <div className="space-y-6">
                <Input label="Title" value={promoForm.title || ''} onChange={v => setPromoForm({...promoForm, title: v})} />
                <Input label="Description" value={promoForm.description || ''} onChange={v => setPromoForm({...promoForm, description: v})} />
                <Input label="Image URL" value={promoForm.imageUrl || ''} onChange={v => setPromoForm({...promoForm, imageUrl: v})} />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Button Text" value={promoForm.buttonText || ''} onChange={v => setPromoForm({...promoForm, buttonText: v})} />
                  <Input label="Button Link" value={promoForm.buttonLink || ''} onChange={v => setPromoForm({...promoForm, buttonLink: v})} />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-supporting-grey">Slide Type</label>
                  <select 
                    value={promoForm.type} 
                    onChange={(e) => setPromoForm({...promoForm, type: e.target.value as any})}
                    className="w-full p-4 bg-white/5 rounded-2xl border border-white/5 text-white focus:outline-none focus:ring-2 focus:ring-pink"
                  >
                    <option value="promo" className="bg-charcoal">Promotion</option>
                    <option value="news" className="bg-charcoal">News/Update</option>
                    <option value="newsletter" className="bg-charcoal">Newsletter Signup</option>
                    <option value="blog" className="bg-charcoal">Blog Post</option>
                  </select>
                </div>
                <Button onClick={handleAddPromo} variant="accent" className="w-full uppercase tracking-widest">Add Slide</Button>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {promos.map(p => (
                <Card key={p.id} className="relative group">
                  <div className="flex justify-between items-start mb-6">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                      p.type === 'newsletter' ? "bg-blue/10 text-blue border-blue/20" : 
                      p.type === 'blog' ? "bg-pink/10 text-pink border-pink/20" :
                      "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
                    )}>
                      {p.type}
                    </span>
                    <button 
                      onClick={() => togglePromo(p.id, !p.active)}
                      className={cn(
                        "text-[10px] font-black uppercase tracking-widest",
                        p.active ? "text-emerald-400" : "text-supporting-grey"
                      )}
                    >
                      {p.active ? 'Active' : 'Paused'}
                    </button>
                  </div>
                  <h4 className="text-xl font-black uppercase tracking-tight mb-2">{p.title}</h4>
                  <p className="text-sm text-supporting-grey line-clamp-2 mb-6">{p.description}</p>
                  <Button 
                    variant="outline" 
                    className="w-full py-3 text-xs uppercase tracking-widest"
                    onClick={async () => {
                      if (confirm('Delete this slide?')) {
                        try {
                          const { deleteDoc } = await import('firebase/firestore');
                          await deleteDoc(doc(db, `hotels/${hotelId}/promos`, p.id));
                        } catch (error) {
                          handleFirestoreError(error, OperationType.DELETE, `hotels/${hotelId}/promos/${p.id}`);
                        }
                      }
                    }}
                  >
                    Delete
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'guests' && (
          <Card className="overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Guest Directory</h3>
                <p className="text-supporting-grey font-medium">All guests who have shared their information.</p>
              </div>
              <Button 
                variant="outline" 
                onClick={exportToCSV}
                className="flex items-center gap-3 w-full md:w-auto justify-center uppercase tracking-widest text-sm"
              >
                <Download size={20} />
                Export CSV
              </Button>
            </div>
            
            <div className="border border-white/5 rounded-3xl overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[800px]">
                <thead className="bg-white/5 border-b border-white/5">
                  <tr>
                    <th className="p-6 font-black uppercase tracking-widest text-[10px] text-supporting-grey">Guest Name</th>
                    <th className="p-6 font-black uppercase tracking-widest text-[10px] text-supporting-grey">Email</th>
                    <th className="p-6 font-black uppercase tracking-widest text-[10px] text-supporting-grey">Source</th>
                    <th className="p-6 font-black uppercase tracking-widest text-[10px] text-supporting-grey">Last Interaction</th>
                    <th className="p-6 font-black uppercase tracking-widest text-[10px] text-supporting-grey">Date</th>
                    <th className="p-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {guestList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-supporting-grey font-bold uppercase tracking-widest text-xs">No guests found.</td>
                    </tr>
                  ) : (
                    guestList.map(g => (
                      <tr key={g.email} className="hover:bg-white/5 transition-colors">
                        <td className="p-6 font-bold tracking-tight">{g.name}</td>
                        <td className="p-6 text-supporting-grey font-medium">{g.email}</td>
                        <td className="p-6 text-supporting-grey text-xs font-bold uppercase tracking-widest">{g.source || 'N/A'}</td>
                        <td className="p-6">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                            g.type === 'Review' ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" : 
                            g.type === 'Feedback' ? "bg-red-400/10 text-red-400 border-red-400/20" : 
                            "bg-blue/10 text-blue border-blue/20"
                          )}>
                            {g.type}
                          </span>
                        </td>
                        <td className="p-6 text-supporting-grey text-xs font-bold uppercase tracking-widest">{new Date(g.timestamp).toLocaleDateString()}</td>
                        <td className="p-6 text-right">
                          <button 
                            onClick={() => setSelectedGuest(g)}
                            className="p-2 text-supporting-grey hover:text-white transition-colors"
                          >
                            <ChevronRight size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>

      {/* Guest Details Modal */}
      <AnimatePresence>
        {selectedGuest && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedGuest(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="max-w-xl w-full bg-charcoal border border-white/10 rounded-[40px] p-12 relative z-10 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-pink" />
              <div className="flex justify-between items-start mb-12">
                <div className="w-20 h-20 bg-pink rounded-3xl flex items-center justify-center rotate-3">
                  <User size={40} className="text-black" />
                </div>
                <button onClick={() => setSelectedGuest(null)} className="p-2 text-supporting-grey hover:text-white">
                  <Trash2 size={24} />
                </button>
              </div>

              <h3 className="text-4xl font-black uppercase tracking-tighter mb-2">{selectedGuest.name}</h3>
              <p className="text-pink font-bold uppercase tracking-widest text-sm mb-12">{selectedGuest.email}</p>

              <div className="grid grid-cols-2 gap-8 mb-12">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-supporting-grey block mb-2">Source</label>
                  <p className="font-bold">{selectedGuest.source || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-supporting-grey block mb-2">Last Interaction</label>
                  <p className="font-bold">{selectedGuest.type}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-supporting-grey block mb-2">Date</label>
                  <p className="font-bold">{new Date(selectedGuest.timestamp).toLocaleDateString()}</p>
                </div>
              </div>

              <Button onClick={() => setSelectedGuest(null)} variant="accent" className="w-full uppercase tracking-widest">
                Close Profile
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MobileNavItem({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 p-2 rounded-2xl transition-all flex-1",
        active ? "text-pink" : "text-supporting-grey"
      )}
    >
      <div className={cn("p-3 rounded-2xl transition-all", active && "bg-pink/10")}>
        {icon}
      </div>
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}

function NavItem({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 w-full p-4 rounded-2xl transition-all font-bold uppercase tracking-widest text-xs",
        active ? "bg-pink text-black shadow-[0_0_30px_rgba(255,131,218,0.2)]" : "text-supporting-grey hover:bg-white/5 hover:text-white"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder }: { label: string, value: string, onChange: (v: string) => void, type?: string, placeholder?: string }) {
  return (
    <div className="space-y-3">
      <label className="text-[10px] font-black uppercase tracking-widest text-supporting-grey">{label}</label>
      <input 
        type={type} 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        placeholder={placeholder}
        className="w-full p-4 bg-white/5 rounded-2xl border border-white/5 text-white focus:outline-none focus:ring-2 focus:ring-pink transition-all placeholder:text-white/10 font-medium"
      />
    </div>
  );
}

function GuestRow({ name, email, status, date }: { name: string, email: string, status: string, date: string }) {
  return (
    <tr className="hover:bg-white/5 transition-colors group">
      <td className="p-6 font-bold tracking-tight">{name}</td>
      <td className="p-6 text-supporting-grey font-medium">{email}</td>
      <td className="p-6">
        <span className={cn(
          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
          status === 'Rated' ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" : 
          status === 'Opened' ? "bg-blue/10 text-blue border-blue/20" : 
          "bg-white/5 text-supporting-grey border-white/10"
        )}>
          {status}
        </span>
      </td>
      <td className="p-6 text-supporting-grey text-xs font-bold uppercase tracking-widest">{date}</td>
      <td className="p-6 text-right">
        <button className="p-2 text-supporting-grey hover:text-white transition-colors">
          <ChevronRight size={18} />
        </button>
      </td>
    </tr>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-3xl">
      <p className="text-supporting-grey font-bold uppercase tracking-widest text-xs">{message}</p>
    </div>
  );
}

