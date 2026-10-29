import { mock, type MockHandler } from './mock';

const valute = (code: string, value: number) =>
  `<Valute><CharCode>${code}</CharCode><Nominal>1</Nominal><Value>${value.toFixed(4)}</Value></Valute>`;

const bnmRatesXml = `<?xml version="1.0" encoding="UTF-8"?><ValCurs name="Cursul oficial de schimb">${[
  valute('EUR', 19.4),
  valute('USD', 17.6),
  valute('RON', 3.86),
].join('')}</ValCurs>`;

export const handlers: MockHandler[] = [mock('GET', 'https://bnm.md/ro/official_exchange_rates', bnmRatesXml)];
