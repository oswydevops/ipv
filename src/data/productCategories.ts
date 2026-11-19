export interface ProductSubcategory {
  name: string;
  units: readonly string[];
}

export interface ProductCategory {
  name: string;
  subcategories: readonly ProductSubcategory[];
}

export interface BusinessProfile {
  id: string;
  label: string;
  categories: readonly ProductCategory[];
}

const hardwareUnits = ['Unidad', 'Pieza', 'Caja', 'Paquete', 'Metro', 'Rollo', 'Litro', 'Galón', 'Kilogramo', 'Libra', 'Saco'];
const groceryUnits = ['Unidad', 'Pieza', 'Paquete', 'Caja', 'Docena', 'Kilogramo', 'Gramo', 'Libra', 'Litro', 'Mililitro', 'Botella', 'Lata'];
const clothingUnits = ['Pieza', 'Par', 'Docena', 'Paca', 'Paquete', 'Caja', 'Unidad'];
const generalUnits = ['Unidad', 'Pieza', 'Paquete', 'Caja', 'Docena', 'Par', 'Metro', 'Rollo', 'Litro', 'Mililitro', 'Kilogramo', 'Gramo', 'Libra', 'Saco', 'Set'];
const cafeteriaUnits = ['Unidad', 'Porción', 'Taza', 'Vaso', 'Botella', 'Lata', 'Paquete', 'Docena', 'Litro', 'Mililitro', 'Kilogramo', 'Gramo'];

const category = (name: string, subcategories: string[], units: readonly string[]) => ({
  name,
  subcategories: subcategories.map((subcategory) => ({ name: subcategory, units })),
});

const minimarketCategory = (name: string, subcategories: string[], units: readonly string[]) =>
  category(name, subcategories, [...new Set([...units, 'Pallet', 'Contenedor'])]);

const ALL_BUSINESS_PROFILES = [
  {
    id: 'ferreteria',
    label: 'Ferretería y construcción',
    categories: [
      category('Herramientas manuales', ['Destornilladores y llaves', 'Martillos y cinceles', 'Corte y medición'], hardwareUnits),
      category('Herramientas eléctricas', ['Taladros y accesorios', 'Sierras y corte', 'Otras herramientas eléctricas'], hardwareUnits),
      category('Tornillería y fijaciones', ['Tornillos y tuercas', 'Clavos y puntillas', 'Anclajes y fijaciones'], ['Unidad', 'Caja', 'Paquete', 'Kilogramo', 'Libra']),
      category('Electricidad e iluminación', ['Cables y conductores', 'Interruptores y tomacorrientes', 'Lámparas y bombillas'], ['Unidad', 'Pieza', 'Caja', 'Metro', 'Rollo', 'Paquete']),
      category('Plomería y gasfitería', ['Tuberías y conexiones', 'Grifería y válvulas', 'Accesorios de baño'], ['Unidad', 'Pieza', 'Metro', 'Rollo', 'Caja']),
      category('Pinturas y accesorios', ['Pinturas y esmaltes', 'Brochas y rodillos', 'Diluyentes'], ['Unidad', 'Galón', 'Litro', 'Cuarto', 'Pieza']),
      category('Adhesivos y selladores', ['Pegamentos', 'Siliconas y selladores', 'Cintas adhesivas'], ['Unidad', 'Tubo', 'Litro', 'Galón', 'Rollo', 'Caja']),
      category('Cerrajería y herrajes', ['Cerraduras y candados', 'Bisagras y pasadores', 'Herrajes para muebles'], hardwareUnits),
      category('Construcción y obra', ['Cemento y morteros', 'Áridos y materiales', 'Perfiles y planchas'], ['Unidad', 'Saco', 'Kilogramo', 'Metro', 'Pieza']),
      category('Jardinería y exteriores', ['Herramientas de jardín', 'Riego', 'Macetas y accesorios'], hardwareUnits),
      category('Seguridad y protección', ['Protección personal', 'Señalización', 'Seguridad industrial'], ['Unidad', 'Pieza', 'Par', 'Caja', 'Paquete']),
      category('Otra categoría', ['Otros artículos de ferretería'], generalUnits),
    ],
  },
  {
    id: 'minimercado',
    label: 'Minimercado y almacenes',
    categories: [
      minimarketCategory('Abarrotes', ['Granos y legumbres', 'Enlatados y conservas', 'Aceites y condimentos'], groceryUnits),
      minimarketCategory('Bebidas', ['Refrescos y jugos', 'Agua', 'Bebidas energéticas'], groceryUnits),
      minimarketCategory('Lácteos y refrigerados', ['Leche y derivados', 'Quesos y embutidos', 'Congelados'], groceryUnits),
      minimarketCategory('Frutas y vegetales', ['Frutas', 'Vegetales', 'Tubérculos'], ['Unidad', 'Kilogramo', 'Gramo', 'Libra']),
      minimarketCategory('Panadería y dulces', ['Pan y galletas', 'Caramelos y chocolates', 'Repostería empacada'], groceryUnits),
      minimarketCategory('Limpieza del hogar', ['Detergentes', 'Desinfectantes', 'Accesorios de limpieza'], ['Unidad', 'Pieza', 'Paquete', 'Caja', 'Litro', 'Mililitro', 'Galón']),
      minimarketCategory('Higiene personal', ['Cuidado bucal', 'Cuidado corporal', 'Papel y desechables'], groceryUnits),
      minimarketCategory('Otra categoría', ['Otros productos de minimercado'], generalUnits),
    ],
  },
  {
    id: 'bar',
    label: 'Bar y bebidas',
    categories: [
      category('Cervezas', ['Nacionales', 'Importadas', 'Sin alcohol'], ['Botella', 'Lata', 'Unidad', 'Caja', 'Pack']),
      category('Licores', ['Ron y aguardiente', 'Vinos', 'Otros licores'], ['Botella', 'Unidad', 'Caja', 'Litro', 'Mililitro']),
      category('Bebidas sin alcohol', ['Refrescos y jugos', 'Agua', 'Bebidas energéticas'], ['Botella', 'Lata', 'Unidad', 'Caja', 'Pack', 'Litro']),
      category('Coctelería', ['Mezcladores y siropes', 'Frutas y complementos', 'Insumos de barra'], ['Unidad', 'Botella', 'Litro', 'Mililitro', 'Kilogramo', 'Libra']),
      category('Snacks', ['Aperitivos', 'Frutos secos', 'Dulces'], groceryUnits),
      category('Descartables y accesorios', ['Vasos y sorbetes', 'Hielo', 'Accesorios de servicio'], ['Unidad', 'Paquete', 'Bolsa', 'Caja', 'Kilogramo']),
      category('Otra categoría', ['Otros artículos para bar'], generalUnits),
    ],
  },
  {
    id: 'ropa',
    label: 'Tienda de ropa y calzado',
    categories: [
      category('Ropa por paca', ['Paca surtida', 'Paca de ropa de mujer', 'Paca de ropa de hombre', 'Paca infantil'], ['Paca', 'Unidad']),
      category('Prendas de vestir', ['Ropa de mujer', 'Ropa de hombre', 'Ropa infantil'], clothingUnits),
      category('Calzado', ['Calzado de mujer', 'Calzado de hombre', 'Calzado infantil'], ['Par', 'Caja', 'Unidad']),
      category('Accesorios', ['Bolsos y carteras', 'Cinturones y sombreros', 'Bisutería y complementos'], clothingUnits),
      category('Ropa de hogar', ['Sábanas y fundas', 'Toallas', 'Cortinas'], ['Pieza', 'Juego', 'Par', 'Paquete', 'Unidad']),
      category('Otra categoría', ['Otros artículos de ropa'], generalUnits),
    ],
  },
  {
    id: 'papeleria',
    label: 'Papelería y librería',
    categories: [
      category('Útiles escolares', ['Lápices y bolígrafos', 'Cuadernos y libretas', 'Papel y cartulina'], ['Unidad', 'Pieza', 'Paquete', 'Caja', 'Resma']),
      category('Oficina', ['Archivo y organización', 'Escritura', 'Accesorios de oficina'], generalUnits),
      category('Arte y manualidades', ['Pinturas y pinceles', 'Materiales de arte', 'Manualidades'], generalUnits),
      category('Libros e impresos', ['Libros', 'Revistas', 'Material impreso'], ['Unidad', 'Pieza', 'Paquete']),
      category('Otra categoría', ['Otros artículos de papelería'], generalUnits),
    ],
  },
  {
    id: 'tecnologia',
    label: 'Tecnología y electrónica',
    categories: [
      category('Telefonía', ['Teléfonos', 'Fundas y protectores', 'Cargadores y cables'], ['Unidad', 'Pieza', 'Caja', 'Paquete']),
      category('Computación', ['Accesorios de computadora', 'Almacenamiento', 'Periféricos'], ['Unidad', 'Pieza', 'Caja', 'Paquete']),
      category('Audio y video', ['Audífonos y bocinas', 'Televisores y pantallas', 'Accesorios audiovisuales'], ['Unidad', 'Pieza', 'Caja']),
      category('Componentes electrónicos', ['Cables y adaptadores', 'Baterías y pilas', 'Componentes'], ['Unidad', 'Pieza', 'Paquete', 'Caja']),
      category('Otra categoría', ['Otros productos tecnológicos'], generalUnits),
    ],
  },
  {
    id: 'belleza',
    label: 'Belleza y cuidado personal',
    categories: [
      category('Cuidado capilar', ['Champú y acondicionador', 'Tintes y tratamientos', 'Accesorios para el cabello'], groceryUnits),
      category('Cuidado de la piel', ['Cremas y lociones', 'Jabones y limpiadores', 'Protección solar'], groceryUnits),
      category('Maquillaje y uñas', ['Maquillaje', 'Esmaltes y uñas', 'Herramientas de belleza'], generalUnits),
      category('Perfumería', ['Perfumes', 'Colonias', 'Desodorantes'], ['Unidad', 'Botella', 'Mililitro', 'Caja']),
      category('Otra categoría', ['Otros productos de belleza'], generalUnits),
    ],
  },
  {
    id: 'hogar',
    label: 'Hogar y bazar',
    categories: [
      category('Cocina y mesa', ['Utensilios de cocina', 'Vajilla y cubiertos', 'Recipientes'], generalUnits),
      category('Decoración', ['Adornos', 'Iluminación decorativa', 'Textiles para el hogar'], generalUnits),
      category('Organización y almacenamiento', ['Cajas y organizadores', 'Ganchos y perchas', 'Contenedores'], generalUnits),
      category('Electrodomésticos', ['Pequeños electrodomésticos', 'Accesorios', 'Repuestos'], ['Unidad', 'Pieza', 'Caja']),
      category('Otra categoría', ['Otros artículos para el hogar'], generalUnits),
    ],
  },
  {
    id: 'mipyme',
    label: 'Mipyme (comercio mixto)',
    categories: [
      category('Ferretería y construcción', ['Herramientas y equipos', 'Tornillería y fijaciones', 'Electricidad y plomería', 'Pinturas y materiales de obra'], hardwareUnits),
      category('Alimentos básicos', ['Granos y legumbres', 'Enlatados y conservas', 'Aceites y condimentos', 'Lácteos y refrigerados', 'Frutas y vegetales'], groceryUnits),
      category('Bebidas envasadas sin alcohol', ['Agua embotellada', 'Refrescos listos para consumir', 'Jugos envasados'], ['Unidad', 'Botella', 'Lata', 'Paquete', 'Caja', 'Litro', 'Mililitro']),
      category('Limpieza del hogar', ['Detergentes', 'Desinfectantes', 'Accesorios de limpieza'], ['Unidad', 'Pieza', 'Paquete', 'Caja', 'Litro', 'Mililitro', 'Galón']),
      category('Higiene personal', ['Cuidado bucal', 'Cuidado corporal', 'Papel y desechables'], groceryUnits),
      category('Tecnología y electrónica', ['Telefonía', 'Computación', 'Audio y video', 'Componentes y accesorios'], ['Unidad', 'Pieza', 'Paquete', 'Caja', 'Set']),
      category('Electrodomésticos', ['Pequeños electrodomésticos', 'Electrodomésticos grandes', 'Repuestos y accesorios'], ['Unidad', 'Pieza', 'Caja']),
      category('Ropa y calzado', ['Ropa por paca', 'Prendas de vestir', 'Calzado', 'Accesorios'], clothingUnits),
      category('Papelería y librería', ['Útiles escolares', 'Artículos de oficina', 'Libros e impresos', 'Arte y manualidades'], ['Unidad', 'Pieza', 'Paquete', 'Caja', 'Resma', 'Set']),
      category('Belleza y cuidado personal', ['Cuidado capilar', 'Cuidado de la piel', 'Maquillaje y uñas', 'Perfumería'], groceryUnits),
      category('Hogar y bazar', ['Cocina y mesa', 'Decoración', 'Organización y almacenamiento', 'Textiles para el hogar'], generalUnits),
      category('Otros productos', ['Otros artículos de venta'], generalUnits),
    ],
  },
  {
    id: 'general',
    label: 'Comercio general',
    categories: [
      category('Artículos de venta', ['Accesorios', 'Consumibles', 'Repuestos', 'Otros artículos'], generalUnits),
      category('Otra categoría', ['Productos diversos'], generalUnits),
    ],
  },
  {
    id: 'cafeteria',
    label: 'Cafeterías',
    categories: [
      category('Bebidas', ['General'], cafeteriaUnits),
      category('Comidas rápidas', ['General'], cafeteriaUnits),
      category('Panadería y repostería', ['General'], cafeteriaUnits),
      category('Productos complementarios', ['General'], cafeteriaUnits),
      category('Otros', ['General'], cafeteriaUnits),
    ],
  },
] as const satisfies readonly BusinessProfile[];

export const BUSINESS_PROFILES: readonly BusinessProfile[] = ['mipyme', 'bar', 'cafeteria'].map(
  (id) => ALL_BUSINESS_PROFILES.find((profile) => profile.id === id)!
);

export const DEFAULT_BUSINESS_PROFILE_ID = 'mipyme';
export const BUSINESS_PROFILE_STORAGE_KEY = 'ferrestock_business_profile';
export const BUSINESS_PROFILE_LOCKED_STORAGE_KEY = 'ferrestock_business_profile_locked';
export const BUSINESS_PROFILE_CONFIRMED_STORAGE_KEY = 'ferrestock_business_profile_confirmed';
export const DEFAULT_PRODUCT_UNITS = generalUnits;
export const CARRY_BAG_CATEGORY = 'Bolsas para llevar';

export const getBusinessProfile = (id: string): BusinessProfile =>
  ALL_BUSINESS_PROFILES.find((profile) => profile.id === id) ||
  BUSINESS_PROFILES.find((profile) => profile.id === DEFAULT_BUSINESS_PROFILE_ID)!;

export const getSelectedBusinessProfile = (): BusinessProfile => {
  try {
    const profileId = typeof localStorage !== 'undefined'
      ? localStorage.getItem(BUSINESS_PROFILE_STORAGE_KEY)
      : null;
    return BUSINESS_PROFILES.find((profile) => profile.id === profileId) ||
      getBusinessProfile(DEFAULT_BUSINESS_PROFILE_ID);
  } catch {
    return getBusinessProfile(DEFAULT_BUSINESS_PROFILE_ID);
  }
};

export const PRODUCT_CATEGORIES = Array.from(
  new Set(BUSINESS_PROFILES.flatMap((profile) => profile.categories.map((item) => item.name)))
);

const PRODUCT_NAME_EXAMPLES: Record<string, Record<string, string>> = {
  ferreteria: {
    'Herramientas manuales': 'Ejemplo: Martillo de uña de 16 oz',
    'Herramientas eléctricas': 'Ejemplo: Taladro percutor de 650 W',
    'Tornillería y fijaciones': 'Ejemplo: Tornillo galvanizado de 1/2 pulgada',
    'Electricidad e iluminación': 'Ejemplo: Cable eléctrico calibre 12',
    'Plomería y gasfitería': 'Ejemplo: Tubo PVC de 1/2 pulgada',
    'Pinturas y accesorios': 'Ejemplo: Pintura acrílica blanca de 1 galón',
    'Adhesivos y selladores': 'Ejemplo: Silicona transparente de 280 ml',
    'Cerrajería y herrajes': 'Ejemplo: Cerradura de puerta para embutir',
    'Construcción y obra': 'Ejemplo: Cemento gris de 42,5 kg',
    'Jardinería y exteriores': 'Ejemplo: Manguera de jardín de 20 m',
    'Seguridad y protección': 'Ejemplo: Guantes de protección talla M',
    'Otra categoría': 'Ejemplo: Accesorio de ferretería, marca y modelo',
  },
  minimercado: {
    Abarrotes: 'Ejemplo: Arroz grano largo de 1 kg',
    Bebidas: 'Ejemplo: Refresco de cola de 2 litros',
    'Lácteos y refrigerados': 'Ejemplo: Leche entera de 1 litro',
    'Frutas y vegetales': 'Ejemplo: Tomate fresco por libra',
    'Panadería y dulces': 'Ejemplo: Galletas de chocolate, paquete de 200 g',
    'Limpieza del hogar': 'Ejemplo: Detergente en polvo de 1 kg',
    'Higiene personal': 'Ejemplo: Jabón de baño de 125 g',
    'Otra categoría': 'Ejemplo: Producto de almacén, marca y presentación',
  },
  bar: {
    Cervezas: 'Ejemplo: Cerveza lager en lata de 355 ml',
    Licores: 'Ejemplo: Ron añejo en botella de 750 ml',
    'Bebidas sin alcohol': 'Ejemplo: Agua mineral en botella de 1,5 litros',
    Coctelería: 'Ejemplo: Jarabe de granadina de 750 ml',
    Snacks: 'Ejemplo: Maní salado en paquete de 100 g',
    'Descartables y accesorios': 'Ejemplo: Vasos plásticos, paquete de 50',
    'Otra categoría': 'Ejemplo: Artículo para bar, marca y presentación',
  },
  cafeteria: {
    Bebidas: 'Ejemplo: Café espresso, taza de 120 ml',
    'Comidas rápidas': 'Ejemplo: Sándwich de jamón y queso',
    'Panadería y repostería': 'Ejemplo: Croissant de mantequilla',
    'Productos complementarios': 'Ejemplo: Servilletas, paquete de 100',
    Otros: 'Ejemplo: Producto complementario para cafetería',
  },
  ropa: {
    'Ropa por paca': 'Ejemplo: Paca surtida de ropa de mujer',
    'Prendas de vestir': 'Ejemplo: Camiseta de mujer, talla M',
    Calzado: 'Ejemplo: Zapato deportivo unisex, talla 40',
    Accesorios: 'Ejemplo: Bolso de mano color negro',
    'Ropa de hogar': 'Ejemplo: Juego de sábanas matrimonial',
    'Otra categoría': 'Ejemplo: Artículo de ropa, talla y color',
  },
  papeleria: {
    'Útiles escolares': 'Ejemplo: Cuaderno rayado de 100 hojas',
    Oficina: 'Ejemplo: Bolígrafo azul de punta media',
    'Arte y manualidades': 'Ejemplo: Pintura acrílica roja de 250 ml',
    'Libros e impresos': 'Ejemplo: Libro de lectura, edición y autor',
    'Otra categoría': 'Ejemplo: Artículo de papelería, marca y formato',
  },
  tecnologia: {
    Telefonía: 'Ejemplo: Cargador USB-C de 20 W',
    Computación: 'Ejemplo: Mouse inalámbrico óptico',
    'Audio y video': 'Ejemplo: Audífonos Bluetooth con micrófono',
    'Componentes electrónicos': 'Ejemplo: Batería recargable AA',
    'Otra categoría': 'Ejemplo: Accesorio electrónico, marca y modelo',
  },
  belleza: {
    'Cuidado capilar': 'Ejemplo: Champú hidratante de 400 ml',
    'Cuidado de la piel': 'Ejemplo: Crema humectante facial de 50 ml',
    'Maquillaje y uñas': 'Ejemplo: Esmalte para uñas color rojo',
    Perfumería: 'Ejemplo: Perfume en botella de 100 ml',
    'Otra categoría': 'Ejemplo: Producto de belleza, marca y presentación',
  },
  hogar: {
    'Cocina y mesa': 'Ejemplo: Juego de vasos de vidrio, 6 piezas',
    Decoración: 'Ejemplo: Lámpara decorativa de mesa',
    'Organización y almacenamiento': 'Ejemplo: Caja plástica organizadora de 20 litros',
    Electrodomésticos: 'Ejemplo: Hervidor eléctrico de 1,7 litros',
    'Otra categoría': 'Ejemplo: Artículo para el hogar, marca y modelo',
  },
  mipyme: {
    'Ferretería y construcción': 'Ejemplo: Taladro percutor de 650 W',
    'Alimentos básicos': 'Ejemplo: Arroz grano largo de 1 kg',
    'Bebidas envasadas sin alcohol': 'Ejemplo: Jugo envasado de 1 litro',
    'Limpieza del hogar': 'Ejemplo: Detergente en polvo de 1 kg',
    'Higiene personal': 'Ejemplo: Pasta dental de 100 ml',
    'Tecnología y electrónica': 'Ejemplo: Cargador USB-C de 20 W',
    Electrodomésticos: 'Ejemplo: Hervidor eléctrico de 1,7 litros',
    'Ropa y calzado': 'Ejemplo: Camiseta de mujer, talla M',
    'Papelería y librería': 'Ejemplo: Cuaderno rayado de 100 hojas',
    'Belleza y cuidado personal': 'Ejemplo: Champú hidratante de 400 ml',
    'Hogar y bazar': 'Ejemplo: Juego de vasos de vidrio, 6 piezas',
    'Otros productos': 'Ejemplo: Artículo de venta, marca y presentación',
  },
  general: {
    'Artículos de venta': 'Ejemplo: Producto, marca, modelo y presentación',
    'Otra categoría': 'Ejemplo: Artículo de venta, marca y presentación',
  },
};

export const getProductNamePlaceholder = (profileId: string, categoryName: string) =>
  PRODUCT_NAME_EXAMPLES[profileId]?.[categoryName] || `Ejemplo: Artículo de ${categoryName}, marca y presentación`;
