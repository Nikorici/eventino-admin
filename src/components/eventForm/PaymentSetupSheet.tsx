import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import * as WebBrowser from 'expo-web-browser';
import { CreditCard, X } from 'lucide-react-native';

import { cn } from '@/lib/cn';
import { WEB_ORIGIN } from '@/lib/constants';
import { haptics } from '@/lib/haptics';
import { colors } from '@/theme/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useToast } from '@/hooks/useToast';
import { useGetStripeConnectUrlMutation, useSignContractMutation, type SignContractInput } from '@/store/api/eventFormApi';
import { AppText, GlassButton, GlassInput, PressableScale, ToastHost } from '@/components/ui';

import type { PaymentSetupKind } from './eventFormRules';

type ContractField = 'legalEntityName' | 'legalRepresentativeName' | 'legalEntityIdno' | 'legalEntityCui' | 'legalEntityAddress' | 'legalEntityIban';

interface FieldSpec {
  field: ContractField;
  label: string;
  error: string;
}

const NAME: FieldSpec = { field: 'legalEntityName', label: 'Legal entity name', error: 'Please enter legal entity name' };
const REPRESENTATIVE: FieldSpec = {
  field: 'legalRepresentativeName',
  label: 'Legal representative name',
  error: 'Please enter legal representative name',
};
const IDNO: FieldSpec = { field: 'legalEntityIdno', label: 'Legal entity IDNO', error: 'Please enter legal entity IDNO' };
const CUI: FieldSpec = { field: 'legalEntityCui', label: 'CUI', error: 'CUI is required' };
const ADDRESS: FieldSpec = { field: 'legalEntityAddress', label: 'Legal entity address', error: 'Please enter legal entity address' };
const IBAN: FieldSpec = { field: 'legalEntityIban', label: 'IBAN', error: 'Please enter a valid IBAN.' };

const CONTRACT_COPY = {
  maib: {
    title: 'Accept Payments through MAIB',
    notice: 'This calendar is not yet set up to accept payments through MAIB.',
    body: 'We use MAIB to process payments in MDL, please sign the contract to start accepting payments. It should take less than a minute. To see the full contract, click',
    submit: 'Connect MAIB',
    fields: [NAME, REPRESENTATIVE, IDNO, ADDRESS, IBAN],
  },
  netopia: {
    title: 'Accept Payments with NETOPIA',
    notice: 'This calendar is not yet set up to accept payments through NETOPIA.',
    body: 'We use NETOPIA to process payments in RON. Please sign the contract to start accepting payments. It should take less than a minute. To see the full contract, click',
    submit: 'Connect NETOPIA',
    fields: [NAME, REPRESENTATIVE, CUI, ADDRESS, IBAN],
  },
} as const;

const EMPTY_CONTRACT: Record<ContractField, string> = {
  legalEntityName: '',
  legalRepresentativeName: '',
  legalEntityIdno: '',
  legalEntityCui: '',
  legalEntityAddress: '',
  legalEntityIban: '',
};

export interface PaymentSetupSheetProps {
  kind: PaymentSetupKind | null;
  onClose: () => void;
  onContractSigned: () => void;
}

export function PaymentSetupSheet({ kind, onClose, onContractSigned }: PaymentSetupSheetProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const isDark = useColorScheme() === 'dark';
  const mutedIcon = isDark ? colors.dark.textSecondary : colors.muted;
  const [values, setValues] = useState(EMPTY_CONTRACT);
  const [acceptsTerms, setAcceptsTerms] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [signContract, { isLoading: signing }] = useSignContractMutation();
  const [getStripeConnectUrl, { isLoading: connecting }] = useGetStripeConnectUrlMutation();

  const close = () => {
    setShowErrors(false);
    onClose();
  };

  const connectStripe = async () => {
    try {
      const response = await getStripeConnectUrl().unwrap();
      await WebBrowser.openBrowserAsync(response.onboard_link);
      close();
    } catch {
      haptics.error();
      toast(t('Failed to connect to Stripe. Please try again.'), 'error');
    }
  };

  const submitContract = async (contractKind: 'maib' | 'netopia') => {
    setShowErrors(true);
    const fields = CONTRACT_COPY[contractKind].fields;
    if (fields.some((spec) => values[spec.field].trim().length === 0) || !acceptsTerms) {
      haptics.error();
      toast(t('Please fill in all required fields and accept the terms.'), 'error');
      return;
    }
    const body: SignContractInput = {
      legalEntityName: values.legalEntityName.trim(),
      legalRepresentativeName: values.legalRepresentativeName.trim(),
      legalEntityAddress: values.legalEntityAddress.trim(),
      legalEntityIban: values.legalEntityIban.trim(),
      paymentProcessor: contractKind,
      ...(contractKind === 'maib' ? { legalEntityIdno: values.legalEntityIdno.trim() } : { legalEntityCui: values.legalEntityCui.trim() }),
    };
    try {
      await signContract(body).unwrap();
      haptics.success();
      if (contractKind === 'netopia') toast(t('Successfully connected to NETOPIA!'), 'success');
      onContractSigned();
      close();
    } catch {
      haptics.error();
      toast(contractKind === 'netopia' ? t('Error connecting to NETOPIA') : t('Error signing contract'), 'error');
    }
  };

  const renderContract = (contractKind: 'maib' | 'netopia') => {
    const copy = CONTRACT_COPY[contractKind];
    return (
      <>
        <AppText className="font-gilroy-medium text-[13px] leading-5 text-muted dark:text-dark-muted">{t(copy.notice)}</AppText>
        <AppText className="font-gilroy-medium text-[13px] leading-5 text-muted dark:text-dark-muted">
          {`${t(copy.body)} `}
          <AppText
            className="font-gilroy-semibold text-[13px] text-links underline dark:text-dark-text"
            onPress={() => void WebBrowser.openBrowserAsync(`${WEB_ORIGIN}/contract/contract.pdf`)}
          >
            {t('here')}
          </AppText>
          .
        </AppText>
        <View className="gap-3">
          {copy.fields.map((spec) => (
            <GlassInput
              key={spec.field}
              placeholder={t(spec.label)}
              value={values[spec.field]}
              onChangeText={(text) => setValues((prev) => ({ ...prev, [spec.field]: text }))}
              autoCapitalize={spec.field === 'legalEntityIban' ? 'characters' : 'words'}
              error={showErrors && values[spec.field].trim().length === 0 ? t(spec.error) : undefined}
            />
          ))}
        </View>
        <PressableScale
          onPress={() => {
            haptics.selection();
            setAcceptsTerms((prev) => !prev);
          }}
          accessibilityLabel={`${t('I accept the')} ${t('Terms and Conditions.')}`}
          className={cn(
            'flex-row items-center gap-3 rounded-[12px] border px-4 py-3',
            acceptsTerms
              ? 'border-primary bg-app-surface dark:border-white/40 dark:bg-dark-bg'
              : 'border-app-border bg-app-surface dark:border-dark-border dark:bg-dark-bg',
          )}
        >
          <View className={cn('h-[26px] w-[44px] justify-center rounded-full p-[3px]', acceptsTerms ? 'bg-primary dark:bg-white' : 'bg-black/15 dark:bg-white/20')}>
            <View className={cn('h-5 w-5 rounded-full bg-white dark:bg-dark-bg', acceptsTerms && 'self-end')} />
          </View>
          <AppText className="flex-1 font-gilroy-medium text-[13px]">
            {`${t('I accept the')} `}
            <AppText
              className="font-gilroy-semibold text-[13px] text-links underline dark:text-dark-text"
              onPress={() => void WebBrowser.openBrowserAsync(`${WEB_ORIGIN}/terms-of-use`)}
            >
              {t('Terms and Conditions.')}
            </AppText>
          </AppText>
        </PressableScale>
        <GlassButton label={t(copy.submit)} variant="primary" loading={signing} onPress={() => void submitContract(contractKind)} className="rounded-[12px]" />
      </>
    );
  };

  return (
    <Modal visible={kind != null} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable onPress={close} className="flex-1 justify-end bg-black/40">
          <Pressable onPress={(event) => event.stopPropagation()} className="max-h-[90%] rounded-t-[20px] bg-app-bg pt-3 dark:bg-dark-surface">
            <View className="mb-1 flex-row items-center justify-between px-5">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-links/10 dark:bg-white/10">
                <CreditCard size={18} color={isDark ? colors.dark.text : colors.links} />
              </View>
              <PressableScale
                onPress={close}
                accessibilityLabel={t('Cancel')}
                className="h-9 w-9 items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/10"
              >
                <X size={17} color={mutedIcon} />
              </PressableScale>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 14 }}>
              <AppText className="font-gilroy-bold text-[20px]">
                {kind === 'stripe' ? t('Accept Payments') : kind ? t(CONTRACT_COPY[kind].title) : ''}
              </AppText>
              {kind === 'stripe' ? (
                <>
                  <AppText className="font-gilroy-medium text-[13px] leading-5 text-muted dark:text-dark-muted">
                    {t('This calendar is not yet set up to accept payments.')}
                  </AppText>
                  <AppText className="font-gilroy-medium text-[13px] leading-5 text-muted dark:text-dark-muted">
                    {t('We use Stripe to process payments or set up a Stripe account to start accepting payments. It usually takes less than 5 minutes.')}
                  </AppText>
                  <GlassButton label={t('Connect Stripe')} variant="primary" loading={connecting} onPress={() => void connectStripe()} className="rounded-[12px]" />
                </>
              ) : kind ? (
                renderContract(kind)
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
      <ToastHost />
    </Modal>
  );
}
