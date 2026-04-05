'use client';

import { motion } from 'framer-motion';
import { Star, ExternalLink } from 'lucide-react';
import { mockReviews } from '@/data/mockData';

const GoogleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

interface ReviewType {
  id: string;
  name: string;
  rating: number;
  text: string;
  avatar: string;
}

const ReviewCard = ({ review }: { review: ReviewType }) => (
  <div className="w-[300px] md:w-[400px] flex-shrink-0 bg-white rounded-3xl p-6 shadow-sm border border-zinc-100 hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-4">
      <div className="flex items-center gap-3">
        <img src={review.avatar} alt={review.name} className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover" />
        <div>
          <h4 className="font-bold text-sm text-[#0A0F1E]">{review.name}</h4>
          <span className="text-xs text-slate-500">Avis Google vérifié</span>
        </div>
      </div>
      <GoogleIcon />
    </div>
    <div className="flex gap-1 mb-3">
      {[...Array(5)].map((_, i) => (
        <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'}`} />
      ))}
    </div>
    <p className="text-sm text-slate-500 line-clamp-4 leading-relaxed">
      "{review.text}"
    </p>
  </div>
);

export function Reviews() {
  const baseArr1 = [...mockReviews, ...mockReviews];
  const row1 = [...baseArr1, ...baseArr1];

  const baseArr2 = [...mockReviews].reverse();
  const baseArr2Extended = [...baseArr2, ...baseArr2];
  const row2 = [...baseArr2Extended, ...baseArr2Extended];

  const googleMapsUrl = "https://www.google.com/maps/place/Tel+and+Cash+Angers/@47.4734511,-0.5521127,17z/data=!3m1!4b1!4m6!3m5!1s0x480879224532671b:0x482a7e7aeb686dcb!8m2!3d47.4734475!4d-0.5495324!16s%2Fg%2F11y6p17ml6?entry=ttu&g_ep=EgoyMDI2MDMyNC4wIKXMDSoASAFQAw%3D%3D";

  return (
    <section className="py-24 bg-white overflow-hidden relative">
      <div className="container mx-auto px-4 max-w-7xl mb-16 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">

          {/* Left: title block */}
          <div className="max-w-xl">
            {/* Annotation to the right of the title block container */}
            <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-6 mb-2">
              <div>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight text-[#0A0F1E] relative inline-block">
                  Ils nous font confiance
                  {/* Wavy underline */}
                  <svg viewBox="0 0 300 12" preserveAspectRatio="none" className="absolute -bottom-3 left-0 w-full h-3 fill-none opacity-50" style={{strokeLinecap: 'round', stroke: '#3b82f6', strokeWidth: '1.5px'}}>
                    <path d="M 0 6 Q 25 0 50 6 T 100 6 T 150 6 T 200 6 T 250 6 T 300 6"/>
                  </svg>
                </h2>
              </div>
              {/* Floating cursive annotation top-right */}
              <div className="flex flex-col items-start md:items-start mt-3 md:mt-0">
                <span className="text-[#3b82f6] font-['Caveat'] text-xl md:text-2xl -rotate-2 inline-block">
                  ils ont adoré
                </span>
                <svg width="36" height="24" viewBox="0 0 36 24" className="fill-none mt-1" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                  <path d="M 30 4 C 20 4 6 8 4 18" stroke="#3b82f6" strokeWidth="1.5"/>
                  <path d="M 4 18 L 2 10 M 4 18 L 12 16" stroke="#3b82f6" strokeWidth="1.5"/>
                </svg>
              </div>
            </div>

            {/* Rating with sparkles */}
            <div className="flex items-center justify-start gap-4 mt-6">
              <span className="text-4xl font-bold flex items-center gap-2 text-[#0A0F1E] relative">
                5/5
                {/* Sparkles around the rating */}
                <svg width="30" height="30" viewBox="0 0 24 24" className="stroke-yellow-400 fill-none stroke-[1.5px] animate-pulse" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                  <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z"/>
                </svg>
                {/* Small extra sparkle */}
                <svg width="14" height="14" viewBox="0 0 24 24" className="absolute -top-3 -right-4 stroke-[#3b82f6] fill-none stroke-[1.5px] opacity-60" style={{strokeLinecap: 'round', strokeLinejoin: 'round'}}>
                  <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z"/>
                </svg>
              </span>
              <div className="h-10 w-px bg-slate-200 hidden md:block"></div>
              <div className="flex flex-col text-left">
                <span className="font-semibold text-lg leading-none mb-1 text-[#0A0F1E]">Avis Google</span>
                <span className="text-sm text-slate-500 leading-none">Note parfaite 5/5 · Clients vérifiés</span>
              </div>
            </div>
          </div>

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 flex items-center gap-3 bg-white text-[#0A0F1E] px-6 py-3.5 rounded-full font-bold shadow-md hover:shadow-xl transition-all hover:-translate-y-1 border border-zinc-200"
          >
            <GoogleIcon />
            <span>Voir notre page Google</span>
            <ExternalLink className="w-4 h-4 text-slate-400" />
          </a>
        </div>
      </div>

      <div className="relative w-full overflow-hidden flex flex-col gap-6">
        {/* Edge fade gradients — white bg */}
        <div className="absolute left-0 top-0 bottom-0 w-12 md:w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none"></div>
        <div className="absolute right-0 top-0 bottom-0 w-12 md:w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none"></div>

        {/* Row 1 - Moves Left */}
        <motion.div
          className="flex gap-6 w-max"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ repeat: Infinity, ease: "linear", duration: 45 }}
        >
          {row1.map((review, i) => (
            <ReviewCard key={`row1-${i}`} review={review} />
          ))}
        </motion.div>

        {/* Row 2 - Moves Right */}
        <motion.div
          className="flex gap-6 w-max -ml-[25%]"
          animate={{ x: ["-50%", "0%"] }}
          transition={{ repeat: Infinity, ease: "linear", duration: 55 }}
        >
          {row2.map((review, i) => (
            <ReviewCard key={`row2-${i}`} review={review} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
