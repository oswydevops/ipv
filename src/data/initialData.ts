import { Product, IPVRow, Denomination, BackupRecord, TopProduct, SaleRecord } from '../types';

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_IPV_ROWS: IPVRow[] = [];

export const INITIAL_DENOMINATIONS: Denomination[] = [
  {
    id: 'denom-20000',
    label: '20,000 CUP',
    sublabel: 'Billete 20 Mil',
    badge: '20K',
    value: 20000,
    count: 0,
  },
  {
    id: 'denom-10000',
    label: '10,000 CUP',
    sublabel: 'Billete 10 Mil',
    badge: '10K',
    value: 10000,
    count: 0,
  },
  {
    id: 'denom-5000',
    label: '5,000 CUP',
    sublabel: 'Billete 5 Mil',
    badge: '5K',
    value: 5000,
    count: 0,
  },
  {
    id: 'denom-2000',
    label: '2,000 CUP',
    sublabel: 'Billete Serie A',
    badge: '2K',
    value: 2000,
    count: 0,
  },
  {
    id: 'denom-1000',
    label: '1,000 CUP',
    sublabel: 'Billete Mella',
    badge: '1K',
    value: 1000,
    count: 0,
  },
  {
    id: 'denom-500',
    label: '500 CUP',
    sublabel: 'Billete A. Guiteras',
    badge: '500',
    value: 500,
    count: 0,
  },
  {
    id: 'denom-200',
    label: '200 CUP',
    sublabel: 'Billete F. País',
    badge: '200',
    value: 200,
    count: 0,
  },
  {
    id: 'denom-100',
    label: '100 CUP',
    sublabel: 'Billete C.M. Céspedes',
    badge: '100',
    value: 100,
    count: 0,
  },
  {
    id: 'denom-50',
    label: '50 CUP',
    sublabel: 'Billete Calixto G.',
    badge: '',
    value: 50,
    count: 0,
  },
  {
    id: 'denom-20',
    label: '20 CUP',
    sublabel: 'Billete Camilo C.',
    badge: '',
    value: 20,
    count: 0,
  },
];

export const INITIAL_BACKUPS: BackupRecord[] = [];

export const TOP_PRODUCTS: TopProduct[] = [];

export const INITIAL_SALES: SaleRecord[] = [];
