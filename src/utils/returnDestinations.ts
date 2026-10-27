import { MermaItem, ReturnRecord } from '../types';

export const getReturnItemMermas = (
  record: ReturnRecord,
  mermaItems: MermaItem[]
): (MermaItem | undefined)[] => {
  const remaining = mermaItems.filter((item) => item.returnId === record.id);

  return (record.items || []).map((returnItem, index) => {
    const expectedMermaId = `merma-${record.id}-${index + 1}`;
    let matchIndex = remaining.findIndex((mermaItem) => mermaItem.id === expectedMermaId);
    if (matchIndex === -1) {
      matchIndex = remaining.findIndex((mermaItem) =>
        mermaItem.productId === returnItem.productId &&
        mermaItem.code === returnItem.code &&
        mermaItem.name === returnItem.name &&
        mermaItem.quantity === returnItem.quantity
      );
    }
    if (matchIndex === -1) return undefined;
    return remaining.splice(matchIndex, 1)[0];
  });
};

export const getMermaDestination = (item?: MermaItem): { label: string; className: string } => {
  if (!item || item.status === 'en_almacen_merma') {
    return { label: 'Pendiente en mermas', className: 'bg-amber-500/10 text-amber-700' };
  }
  if (item.status === 'reincorporado_con_precio') {
    return { label: 'Venta como defectuoso', className: 'bg-purple-500/10 text-purple-700' };
  }
  if (item.status === 'devuelto_a_almacen') {
    return { label: 'Enviado al almacén', className: 'bg-sky-500/10 text-sky-700' };
  }
  if (item.status === 'reintegrado_a_stock') {
    return { label: 'Enviado al stock', className: 'bg-emerald-500/10 text-emerald-700' };
  }
  return { label: 'Baja definitiva', className: 'bg-red-500/10 text-red-700' };
};
