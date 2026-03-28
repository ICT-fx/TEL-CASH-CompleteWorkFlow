import { ThumbsUp, CalendarClock, Truck } from 'lucide-react';

export function FeaturesBar() {
  const features = [
    {
      icon: <ThumbsUp className="w-7 h-7 text-slate-800" strokeWidth={1.5} />,
      text: "Garantie 24 mois"
    },
    {
      icon: <CalendarClock className="w-7 h-7 text-slate-800" strokeWidth={1.5} />,
      text: "30j pour changer d'avis"
    },
    {
      icon: <Truck className="w-7 h-7 text-slate-800" strokeWidth={1.5} />,
      text: "Livraison offerte"
    },
    {
      icon: (
        <svg 
          width="28" 
          height="28" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="1.5" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="text-slate-800"
        >
          <path d="M12 2L8.5 4.5 9 8 5.5 10 7 14.5 6 18l5 2 4.5-1.5 3.5 2L20 16l-3-4 1.5-3.5L16 6l-4-4z" />
        </svg>
      ),
      text: "Entreprise française"
    }
  ];

  return (
    <div className="bg-white border-t border-slate-100 py-12 pb-16">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex flex-col md:flex-row items-center justify-center md:justify-around gap-10 md:gap-4">
          {features.map((feature, index) => (
            <div key={index} className="flex flex-col items-center gap-4 text-slate-900 group cursor-default">
              <div className="transition-transform duration-300 group-hover:-translate-y-1">
                {feature.icon}
              </div>
              <span className="font-semibold text-[15px] text-center">{feature.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
