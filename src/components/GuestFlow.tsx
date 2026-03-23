import React, { useState, useEffect } from 'react';
import { 
  db, addDoc, collection, getDocs, query, doc, onSnapshot, handleFirestoreError, OperationType
} from '../firebase';
import { 
  Star, 
  Mail, 
  CheckCircle, 
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Share2,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { HotelSettings, Promo } from '../types';
import { Button, cn } from './UI';

export default function GuestFlow({ hotelId, initialSettings }: { hotelId: string, initialSettings: HotelSettings | null }) {
  const [step, setStep] = useState<'rating' | 'highlight' | 'feedback' | 'moreQuestions' | 'shareInfo' | 'thanks' | 'promos'>('rating');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [highlight, setHighlight] = useState('');
  const [feedback, setFeedback] = useState('');
  const [source, setSource] = useState('');
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [settings, setSettings] = useState<HotelSettings | null>(initialSettings);

  const steps = ['rating', 'highlight', 'feedback', 'moreQuestions', 'shareInfo', 'promos', 'thanks'];
  const currentStepIndex = steps.indexOf(step);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  useEffect(() => {
    if (initialSettings) {
      setSettings(initialSettings);
    } else {
      // Fetch settings directly if not provided
      const unsubscribe = onSnapshot(doc(db, `hotels/${hotelId}/settings/config`), (docSnap) => {
        if (docSnap.exists()) {
          setSettings(docSnap.data() as HotelSettings);
        }
      }, (error) => {
        console.error("GuestFlow settings fetch error:", error);
      });
      return () => unsubscribe();
    }
  }, [hotelId, initialSettings]);

  useEffect(() => {
    const fetchPromos = async () => {
      try {
        const q = query(collection(db, `hotels/${hotelId}/promos`));
        const snap = await getDocs(q);
        setPromos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Promo)).filter(p => p.active));
      } catch (error) {
        console.error("Error fetching promos:", error);
      }
    };
    fetchPromos();
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
    if (val >= 4) {
      setStep('highlight');
    } else {
      setStep('feedback');
    }
  };

  const handleHighlightSubmit = () => {
    setStep('moreQuestions');
  };

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    try {
      // Automatic oneWord summary generation
      const textForSummary = rating >= 4 ? highlight : feedback;
      const oneWord = textForSummary 
        ? textForSummary.split(' ').filter(w => w.length > 3)[0] || textForSummary.split(' ')[0] || 'Feedback'
        : (rating >= 4 ? 'Great' : 'Feedback');

      const commonData: any = {
        rating,
        timestamp: new Date().toISOString(),
        guestId: 'anonymous'
      };

      // Only add optional fields if they have values to satisfy Firestore string rules
      if (oneWord) commonData.oneWord = oneWord;
      if (highlight) commonData.highlight = highlight;
      if (source) commonData.source = source;
      if (recommend !== null) commonData.recommend = recommend;
      if (guestName) commonData.guestName = guestName;
      if (guestEmail) commonData.guestEmail = guestEmail;

      if (rating >= 4) {
        await addDoc(collection(db, `hotels/${hotelId}/reviews`), commonData);
      } else {
        await addDoc(collection(db, `hotels/${hotelId}/feedback`), {
          ...commonData,
          comment: feedback || '',
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
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-soehne overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,131,218,0.05),transparent_70%)]" />
        
        {/* Skeleton UI */}
        <div className="w-full max-w-md space-y-12 relative z-10">
          <div className="space-y-4 text-center">
            <div className="h-4 w-24 bg-white/5 rounded mx-auto animate-pulse" />
            <div className="h-12 w-48 bg-white/5 rounded mx-auto animate-pulse" />
          </div>
          
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-12 h-12 rounded-full bg-white/5 animate-pulse" />
            ))}
          </div>
          
          <div className="h-12 w-full bg-white/5 rounded-full animate-pulse" />
        </div>

        <motion.div 
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="absolute bottom-12 text-supporting-grey font-black uppercase tracking-widest text-[10px] z-10"
        >
          Loading Experience...
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-soehne overflow-hidden relative">
      {/* Immersive Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/4 -left-1/4 w-full h-full bg-pink/5 blur-[60px] rounded-full opacity-30" />
        <div className="absolute -bottom-1/4 -right-1/4 w-full h-full bg-blue/5 blur-[60px] rounded-full opacity-30" />
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
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-pink/5 blur-[40px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue/5 blur-[40px] rounded-full pointer-events-none" />
      <div className="absolute top-[30%] right-[-10%] w-[20%] h-[20%] bg-yellow/5 blur-[30px] rounded-full pointer-events-none" />

      <AnimatePresence mode="wait">
        {step === 'rating' && (
          <motion.div 
            key="rating"
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.02, y: -10 }}
            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
            style={{ willChange: 'transform, opacity' }}
            className="max-w-md w-full text-center z-10 px-4"
          >
            {settings.logoUrl && (
              <motion.img 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                src={settings.logoUrl} 
                alt="Logo" 
                className="h-12 md:h-16 mx-auto mb-8 object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]" 
                referrerPolicy="no-referrer" 
              />
            )}
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 leading-[0.85] uppercase">
                {settings.hotelName}
              </h1>
              <p className="text-supporting-grey text-base mb-10 font-medium leading-relaxed max-w-[280px] mx-auto">
                {settings.welcomeLine || "We'd love to hear about your stay."}
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="bg-white/5 border border-white/10 rounded-[40px] p-8 backdrop-blur-sm relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
              
              <motion.div 
                key={hoverRating || rating}
                initial={{ scale: 0.5, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="text-6xl mb-6 drop-shadow-[0_10px_30px_rgba(255,255,255,0.1)]"
              >
                {getEmoji(hoverRating || rating)}
              </motion.div>

              <h2 className="text-xl font-black tracking-widest mb-8 uppercase opacity-80">Rate your stay</h2>
              
              <div className="flex justify-between gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <motion.button
                    key={star}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => handleRatingSubmit(star)}
                    className={cn(
                      "p-2 rounded-xl transition-all duration-200",
                      (hoverRating || rating) >= star ? "text-pink drop-shadow-[0_0_15px_rgba(255,0,255,0.3)]" : "text-white/10"
                    )}
                  >
                    <Star size={36} fill={(hoverRating || rating) >= star ? "currentColor" : "none"} strokeWidth={1.5} />
                  </motion.button>
                ))}
              </div>
              <p className="text-supporting-grey text-[9px] uppercase tracking-[0.3em] font-black opacity-40">Tap a star to start</p>
            </motion.div>
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
            
            <div className="flex flex-wrap gap-2 mb-8">
              {suggestions.map(s => (
                <motion.button 
                  key={s}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setHighlight(s)}
                  className={cn(
                    "px-5 py-3 rounded-full text-sm font-black transition-all uppercase tracking-wider border",
                    highlight === s ? "bg-pink text-black border-pink" : "bg-white/5 text-white border-white/5 hover:border-white/20"
                  )}
                >
                  {s}
                </motion.button>
              ))}
            </div>

            <textarea 
              value={highlight}
              onChange={(e) => setHighlight(e.target.value)}
              placeholder="Or tell us more here..."
              className="w-full p-6 bg-charcoal border border-white/10 rounded-3xl text-white text-lg focus:outline-none focus:ring-2 focus:ring-pink mb-8 min-h-[120px] placeholder:text-white/20 shadow-inner"
            />

            <Button onClick={handleHighlightSubmit} variant="accent" className="w-full py-6 uppercase tracking-widest font-black shadow-[0_10px_30px_rgba(255,0,255,0.3)]">
              Continue
            </Button>
          </motion.div>
        )}

        {step === 'feedback' && (
          <motion.div 
            key="feedback"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="max-w-md w-full z-10 px-4"
          >
            <h2 className="text-4xl font-black tracking-tighter mb-4 uppercase">We're sorry.</h2>
            <p className="text-supporting-grey text-lg mb-10">How can we make it right?</p>
            
            <textarea 
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell us what went wrong..."
              className="w-full p-6 bg-charcoal border border-white/10 rounded-3xl text-white text-lg focus:outline-none focus:ring-2 focus:ring-pink mb-8 min-h-[160px] placeholder:text-white/20 shadow-inner"
              autoFocus
            />

            <div className="flex flex-col gap-4">
              <Button onClick={() => setStep('moreQuestions')} variant="accent" className="w-full py-6 uppercase tracking-widest font-black shadow-[0_10px_30px_rgba(255,0,255,0.3)]">
                Next
              </Button>
              <button 
                onClick={() => setStep('moreQuestions')} 
                className="text-supporting-grey hover:text-white transition-colors text-xs font-black uppercase tracking-widest py-2"
              >
                Skip
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
              <CheckCircle size={48} className="text-emerald-500" />
            </div>
            <h2 className="text-5xl font-black tracking-tighter mb-6 uppercase">Thank You!</h2>
            <p className="text-supporting-grey text-lg mb-12 leading-relaxed">Your feedback helps us create better experiences for everyone.</p>
            
            {rating >= 4 && (
              <div className="space-y-4">
                <p className="text-supporting-grey text-xs font-black uppercase tracking-widest mb-6">Share the love</p>
                <div className="grid grid-cols-2 gap-4">
                  {settings.googleLink && (
                    <Button onClick={() => window.open(settings.googleLink, '_blank')} variant="secondary" className="flex items-center justify-center gap-2">
                      <Share2 size={18} /> Google
                    </Button>
                  )}
                  {settings.tripAdvisorLink && (
                    <Button onClick={() => window.open(settings.tripAdvisorLink, '_blank')} variant="secondary" className="flex items-center justify-center gap-2">
                      <ExternalLink size={18} /> TripAdvisor
                    </Button>
                  )}
                </div>
              </div>
            )}
            
            <button 
              onClick={() => window.location.reload()} 
              className="mt-12 text-supporting-grey hover:text-white transition-colors text-xs font-black uppercase tracking-widest"
            >
              Done
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
