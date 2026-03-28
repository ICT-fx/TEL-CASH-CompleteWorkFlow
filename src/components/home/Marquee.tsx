export function Marquee() {
  const items = [
    { text: "SAV Humain & Réactif", isHighlight: false },
    { text: "Livraison Gratuite 24/48h", isHighlight: true },
    { text: "+60 Points de Contrôle", isHighlight: false },
    { text: "Stock Vérifié", isHighlight: false },
    { text: "Certifié", isHighlight: true },
    { text: "Garantie 24 Mois", isHighlight: false },
  ];

  const scrollItems = [...items, ...items, ...items, ...items];

  return (
    <div className="w-full bg-[#0A0F1E] text-white py-3.5 overflow-hidden relative shadow-[0_4px_24px_rgba(10,15,30,0.5)] z-20"
      style={{
        borderTop: '1px solid rgba(37,99,235,0.3)',
        borderBottom: '1px solid rgba(37,99,235,0.3)',
      }}
    >
      {/* Side fades */}
      <div className="absolute top-0 left-0 w-16 md:w-32 h-full bg-gradient-to-r from-[#0A0F1E] to-transparent z-10 pointer-events-none" />
      <div className="absolute top-0 right-0 w-16 md:w-32 h-full bg-gradient-to-l from-[#0A0F1E] to-transparent z-10 pointer-events-none" />

      <div className="marquee-container w-full">
        <div className="marquee-content flex items-center">
          {scrollItems.map((item, index) => (
            <div key={index} className="flex items-center gap-6 md:gap-8 mx-6 md:mx-8 cursor-default">
              <span
                className={`text-[11px] md:text-[13px] font-semibold tracking-[0.18em] uppercase ${
                  item.isHighlight ? 'text-white' : 'text-white'
                }`}
                style={{
                  textShadow: '0 0 20px rgba(255,255,255,0.15)',
                }}
              >
                {item.text}
              </span>
              {/* Neon diamond separator */}
              <span
                className="text-[#2563EB] text-xs mt-[-1px] select-none"
                style={{
                  textShadow: '0 0 12px rgba(37,99,235,0.9), 0 0 24px rgba(37,99,235,0.5)',
                }}
              >
                ◆
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
