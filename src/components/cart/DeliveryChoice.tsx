'use client';

// Choix du mode de réception dans le panier (refonte v4).
// Branché sur le store panier (useCart.deliveryMethod, type DeliveryMethod de
// lib/shipping) : c'est ce même état que le checkout doit reprendre.

import { useCart } from '@/store/useCart';
import {
  PICKUP_STORE_ADDRESS_LINE1,
  PICKUP_STORE_HOURS_SHORT,
  deliveryWindowLabel,
  formatShippingFee,
  type DeliveryMethod,
} from '@/lib/shipping';

interface Option {
  value: DeliveryMethod;
  title: string;
  price: string;
  priceClass: string;
  detail: string;
}

const OPTIONS: Option[] = [
  {
    value: 'pickup',
    title: "Retrait gratuit au magasin d'Angers",
    price: 'Gratuit',
    priceClass: 'text-[#157F3D]',
    detail: `Le jour même (${PICKUP_STORE_HOURS_SHORT}) · ${PICKUP_STORE_ADDRESS_LINE1}. On vous prévient dès que c'est prêt.`,
  },
  {
    value: 'home',
    title: 'Livraison à domicile',
    price: formatShippingFee(),
    priceClass: 'text-[#0A0F1E]',
    detail: `Suivie, reçue sous ${deliveryWindowLabel()}.`,
  },
];

export function DeliveryChoice() {
  const deliveryMethod = useCart((s) => s.deliveryMethod);
  const setDeliveryMethod = useCart((s) => s.setDeliveryMethod);

  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-2.5 text-[17px] font-extrabold text-[#0A0F1E]">Comment le recevoir ?</legend>
      {OPTIONS.map((opt) => {
        const on = deliveryMethod === opt.value;
        return (
          <label
            key={opt.value}
            className={`flex cursor-pointer items-start gap-3 rounded-[14px] p-3.5 transition-colors ${
              on
                ? 'border-2 border-[#2457E6] bg-gradient-to-b from-[#FAFBFF] to-[#EEF3FF] shadow-[0_10px_20px_-16px_rgba(36,87,230,0.7)]'
                : 'border-[1.5px] border-[#E4E8F0] bg-white hover:border-[#C9D1E0]'
            }`}
          >
            <input
              type="radio"
              name="reception"
              value={opt.value}
              checked={on}
              onChange={() => setDeliveryMethod(opt.value)}
              className="mt-px h-[22px] w-[22px] flex-none accent-[#2457E6]"
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <b className="text-[15px] text-[#0A0F1E]">{opt.title}</b>
                <b className={`whitespace-nowrap text-[15px] ${opt.priceClass}`}>{opt.price}</b>
              </span>
              <span className="mt-0.5 block text-sm leading-[1.45] text-[#47506A]">{opt.detail}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
