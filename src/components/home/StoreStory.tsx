import {
  PICKUP_STORE_ADDRESS_LINE1,
  PICKUP_STORE_PHONE,
} from '@/lib/shipping';

// « Pas un entrepôt. Une vraie boutique. » — refonte v4 (maquettes).
// Adresse / téléphone : constantes de src/lib/shipping.ts (source unique).
// Horaires : PICKUP_STORE_HOURS (« Lundi-Samedi, 10h - 19h ») reformulé en
// version courte pour la puce ci-dessous.

const MAPS_URL =
  'https://www.google.com/maps/place/Tel+and+Cash+Angers/@47.4734511,-0.5521127,17z/data=!3m1!4b1!4m6!3m5!1s0x480879224532671b:0x482a7e7aeb686dcb!8m2!3d47.4734475!4d-0.5495324!16s%2Fg%2F11y6p17ml6';
const TEL_HREF = `tel:${PICKUP_STORE_PHONE.replace(/\s+/g, '')}`;

const POINTS = [
  { label: 'Retrait gratuit le jour même', desc: 'commandez en ligne, récupérez au magasin du lundi au samedi, 10h–19h' },
  { label: 'Diagnostic précis', desc: 'chaque appareil passe entre nos mains expertes' },
  { label: 'SAV direct', desc: "pas de centre d'appels délocalisé, on vous répond nous-mêmes" },
  { label: 'On rachète votre ancien téléphone', desc: 'estimation sur place' },
];

const STAR = 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z';

export function StoreStory() {
  return (
    <section id="boutique" className="bg-[#F9F8F5]">
      <div className="mx-auto max-w-[1232px] px-4 py-10 md:py-[100px] grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-12 lg:gap-[72px] items-center">
        {/* Texte */}
        <div className="flex flex-col gap-5 md:gap-[26px] min-w-0">
          <div className="flex flex-col gap-1 md:gap-1.5">
            <span className="self-start font-caveat font-bold text-[#2457E6] text-[23px] md:text-[28px] -rotate-2 inline-block">
              fait avec passion
            </span>
            <h2 className="m-0 text-[32px] leading-[1.05] md:text-[44px] lg:text-[56px] md:leading-[1.02] font-black tracking-[-.035em] md:tracking-[-.04em] text-[#0A0F1E]">
              Pas un entrepôt. <br />
              <span className="text-[#2457E6]">Une vraie boutique.</span>
            </h2>
            <svg viewBox="0 0 440 12" fill="none" aria-hidden="true" className="w-[240px] md:w-[440px] max-w-full h-2.5 md:h-3" preserveAspectRatio="none">
              <path d="M2 7 Q 30 1 60 7 T 120 7 T 180 7 T 240 7 T 300 7 T 360 7 T 438 7" stroke="#2457E6" strokeWidth="1.6" strokeLinecap="round" opacity=".7" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>

          {/* Mobile : la photo vient avant les puces (maquette) */}
          <StorePhoto className="md:hidden" />

          <ul className="m-0 p-0 list-none flex flex-col gap-3.5 md:gap-[18px]">
            {POINTS.map((p) => (
              <li key={p.label} className="flex gap-3 md:gap-3.5 text-[15px] md:text-[17px] leading-[1.5] md:leading-[1.55] text-[#0A0F1E]">
                <span aria-hidden="true" className="w-6 h-6 shrink-0 mt-px md:mt-0.5 rounded-full bg-[#EEF3FF] border border-[#D6E1FF] flex items-center justify-center">
                  <span className="w-[9px] h-[9px] rounded-full bg-[#2457E6]" />
                </span>
                <span>
                  <b>{p.label}</b> <span className="text-[#5B6478]">· {p.desc}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="grid grid-cols-[1.45fr_1fr] gap-2.5 md:flex md:gap-3">
            <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" className="tc-btn-outline md:min-h-[54px] md:px-[26px]">
              Nous rendre visite
            </a>
            <a href={TEL_HREF} className="tc-btn-navy md:min-h-[54px] md:px-[26px]">
              <span className="md:hidden">Appeler</span>
              <span className="hidden md:inline">Appeler le {PICKUP_STORE_PHONE}</span>
            </a>
          </div>
        </div>

        {/* Ordinateur : photo à droite */}
        <StorePhoto className="hidden md:block" />
      </div>
    </section>
  );
}

function StorePhoto({ className = '' }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="relative pt-3.5 pr-[18px] pb-[22px] pl-2.5 md:h-[540px] md:p-0 md:max-w-[560px] md:mx-auto">
        <img
          src="/boutique.jpg"
          alt="Intérieur du magasin Tel and Cash à Angers"
          loading="lazy"
          decoding="async"
          className="block w-full h-[240px] object-cover rounded-[22px] rotate-[1.5deg] shadow-[0_24px_44px_-24px_rgba(11,20,55,.6),0_0_0_7px_#fff] md:absolute md:left-[50px] md:top-[30px] md:w-[460px] md:max-w-[calc(100%-100px)] md:h-[470px] md:rounded-[26px] md:rotate-2 md:shadow-[0_30px_60px_-28px_rgba(11,20,55,.6),0_0_0_9px_#fff]"
        />
        {/* 5/5 Google */}
        <div className="tc-glass absolute right-3.5 -top-1.5 md:right-auto md:left-[min(420px,calc(100%-130px))] md:top-0 rounded-[14px] md:rounded-2xl px-3 py-2 md:px-3.5 md:py-2.5 flex items-center gap-2 md:gap-2.5">
          <span className="w-[30px] h-[30px] md:w-9 md:h-9 rounded-full flex items-center justify-center bg-[linear-gradient(180deg,#FFF6D9,#FFE7A3)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#F5A524" aria-hidden="true"><path d={STAR} /></svg>
          </span>
          <span className="flex flex-col leading-[1.15]">
            <b className="text-sm md:text-base text-[#0A0F1E]">5/5</b>
            <span className="text-[13px] font-semibold text-[#5B6478]">Google</span>
          </span>
        </div>
        {/* +5 ans d'expérience */}
        <div className="absolute right-0 top-[120px] md:right-auto md:left-[min(460px,calc(100%-140px))] md:top-[250px] rounded-[14px] md:rounded-2xl px-3 py-[9px] md:px-4 md:py-3 flex items-center gap-2 md:gap-2.5 text-white bg-[linear-gradient(180deg,#26325C,#0A0F1E)] shadow-[inset_0_1px_0_rgba(255,255,255,.2),0_14px_28px_-12px_rgba(10,15,30,.7)]">
          <span aria-hidden="true" className="text-sm md:text-base">✦</span>
          <span className="flex flex-col leading-[1.15]">
            <b className="text-sm md:text-base">+5 ans</b>
            <span className="text-[13px] text-[#C5CCDD]">d&apos;expérience</span>
          </span>
        </div>
        {/* Angers */}
        <div className="tc-glass absolute left-0 bottom-0 md:bottom-auto md:top-[440px] rounded-[14px] md:rounded-2xl px-3 py-2 md:px-3.5 md:py-2.5 flex items-center gap-2 md:gap-2.5">
          <span className="w-[30px] h-[30px] md:w-9 md:h-9 rounded-full flex items-center justify-center bg-[linear-gradient(180deg,#FFEDEE,#FFD5D8)]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#E5484D" aria-hidden="true">
              <path d="M12 22s-7-6.4-7-12a7 7 0 0 1 14 0c0 5.6-7 12-7 12Z" />
              <circle cx="12" cy="10" r="2.6" fill="#fff" />
            </svg>
          </span>
          <span className="flex flex-col leading-[1.15]">
            <b className="text-sm md:text-base text-[#0A0F1E]">Angers</b>
            <span className="text-[13px] font-semibold text-[#5B6478]">
              <span className="md:hidden">{PICKUP_STORE_ADDRESS_LINE1}</span>
              <span className="hidden md:inline">Maine-et-Loire</span>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
