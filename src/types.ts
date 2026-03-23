export interface CustomQuestion {
  id: string;
  text: string;
  type: 'text' | 'boolean' | 'rating';
  required: boolean;
}

export interface HotelSettings {
  hotelName: string;
  logoUrl?: string;
  primaryColor: string;
  welcomeLine: string;
  googleLink?: string;
  tripAdvisorLink?: string;
  yelpLink?: string;
  facebookLink?: string;
  adminEmail: string;
  customQuestions?: CustomQuestion[];
  qrCampaignId?: string;
  showPromos?: boolean;
  showNewsletter?: boolean;
}

export interface Review {
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

export interface Feedback {
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

export interface Promo {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  buttonText?: string;
  buttonLink?: string;
  type: 'promo' | 'news' | 'newsletter' | 'blog';
  active: boolean;
}

export interface NewsletterSignup {
  id: string;
  email: string;
  name?: string;
  timestamp: string;
}
