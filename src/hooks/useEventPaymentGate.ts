import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { EventFormSubmit } from '@/components/events/EventForm';
import { useLazyGetStripeVerificationQuery } from '@/store/api/usersApi';
import type { User } from '@/types/api';

function isContractSigned(user: User): boolean {
  return 'contract_signed' in user && user.contract_signed === true;
}

export function useEventPaymentGate() {
  const { t } = useTranslation();
  const [checkStripeVerification] = useLazyGetStripeVerificationQuery();

  return useCallback(
    async (payload: EventFormSubmit, currentUser: User): Promise<string | null> => {
      const hasPaidTickets = payload.tickets.some((ticket) => ticket.price > 0);
      if (!hasPaidTickets) return null;

      const country = payload.country.toLowerCase();
      const inMoldova = country.includes('moldova') || country.includes('md');
      if (inMoldova) {
        return isContractSigned(currentUser)
          ? null
          : t(
              'Paid events in Moldova require a signed MAIB contract. Open the Eventino web dashboard to sign the contract, then publish your event.',
            );
      }

      if (payload.currency === 'RON') {
        return isContractSigned(currentUser)
          ? null
          : t(
              'Paid events in RON require a NETOPIA payment agreement. Open the Eventino web dashboard to connect payments, then publish your event.',
            );
      }

      if (payload.currency === 'MDL') return null;

      try {
        const verification = await checkStripeVerification().unwrap();
        if (verification.verified) return null;
      } catch {
        return t(
          'Paid events require a connected Stripe account. Open the Eventino web dashboard to connect Stripe, then publish your event.',
        );
      }
      return t(
        'Paid events require a connected Stripe account. Open the Eventino web dashboard to connect Stripe, then publish your event.',
      );
    },
    [checkStripeVerification, t],
  );
}
