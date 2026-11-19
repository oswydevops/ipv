import { Product } from '../types';
import { CARRY_BAG_CATEGORY } from '../data/productCategories';

export const isDefectiveMermaProduct = (product: Product): boolean =>
  product.code.startsWith('MERMA-') || product.category === 'Defectuoso';

export const isCarryBagProduct = (product: Product): boolean =>
  product.category === CARRY_BAG_CATEGORY;
