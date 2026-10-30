import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FileSpreadsheet, FileText, FileCode } from 'lucide-react-native';

import { PDF_SHARE, XLSX_SHARE, XML_SHARE, useFileAction } from '@/components/dashboard/dashboardParts';
import { useThemeColor } from '@/hooks/useThemeColor';
import { downloadAuthedFile, type ShareFileOptions } from '@/lib/downloads';
import type { MerchOrder } from '@/store/api/merchApi';
import { colors } from '@/theme/colors';

import { SecondaryButton } from './merchParts';

type FacturaFormat = 'pdf' | 'xml' | 'sagaXml' | 'xlsx' | 'stornoPdf' | 'stornoXml';

interface FacturaSpec {
  path: string;
  ext: string;
  suffix: string;
  label: string;
  errorKey: string;
  share: ShareFileOptions;
}

const FACTURA_FORMATS: Record<FacturaFormat, FacturaSpec> = {
  pdf: { path: 'factura-pdf', ext: 'pdf', suffix: '', label: 'PDF', errorKey: 'Failed to download factura', share: PDF_SHARE },
  xml: {
    path: 'factura-xml',
    ext: 'xml',
    suffix: '',
    label: 'SPV (XML)',
    errorKey: 'Failed to download factura XML',
    share: XML_SHARE,
  },
  sagaXml: {
    path: 'factura-saga-xml',
    ext: 'xml',
    suffix: '_SAGA',
    label: 'SmartBill/Oblio',
    errorKey: 'Failed to download factura SAGA XML',
    share: XML_SHARE,
  },
  xlsx: {
    path: 'factura-xlsx',
    ext: 'xlsx',
    suffix: '',
    label: 'FGO (Excel)',
    errorKey: 'Failed to download factura XLSX',
    share: XLSX_SHARE,
  },
  stornoPdf: {
    path: 'factura-storno-pdf',
    ext: 'pdf',
    suffix: '_Storno',
    label: 'Storno PDF',
    errorKey: 'Failed to download storno PDF',
    share: PDF_SHARE,
  },
  stornoXml: {
    path: 'factura-storno-xml',
    ext: 'xml',
    suffix: '_Storno',
    label: 'Storno XML',
    errorKey: 'Failed to download storno XML',
    share: XML_SHARE,
  },
};

const BASE_FORMATS: FacturaFormat[] = ['pdf', 'xml', 'sagaXml', 'xlsx'];
const STORNO_FORMATS: FacturaFormat[] = ['stornoPdf', 'stornoXml'];

function facturaIcon(ext: string) {
  if (ext === 'xlsx') return FileSpreadsheet;
  if (ext === 'xml') return FileCode;
  return FileText;
}

export function FacturaActions({ order }: { order: MerchOrder }) {
  const { t } = useTranslation();
  const iconTint = useThemeColor(colors.primary, colors.dark.text);
  const { busyKey, run } = useFileAction();
  const formats = order.payment_status === 'REFUNDED' ? [...BASE_FORMATS, ...STORNO_FORMATS] : BASE_FORMATS;

  const download = (format: FacturaFormat) => {
    const spec = FACTURA_FORMATS[format];
    void run(
      format,
      (token) =>
        downloadAuthedFile(
          `/api/v1/merch/orders/${order.id}/${spec.path}/`,
          token,
          `Factura_Order_${order.id}${spec.suffix}.${spec.ext}`,
        ),
      spec.share,
      { error: t(spec.errorKey) },
    );
  };

  return (
    <View className="flex-row flex-wrap justify-between gap-y-2.5">
      {formats.map((format) => {
        const spec = FACTURA_FORMATS[format];
        const Icon = facturaIcon(spec.ext);
        return (
          <View key={format} className="w-[48.5%]">
            <SecondaryButton
              label={busyKey === format ? t('Downloading...') : t(spec.label)}
              onPress={() => download(format)}
              loading={busyKey === format}
              disabled={busyKey !== null && busyKey !== format}
              icon={<Icon size={16} color={iconTint} />}
            />
          </View>
        );
      })}
    </View>
  );
}
