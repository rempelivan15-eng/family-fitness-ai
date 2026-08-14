export const FOODS = {
  egg_large: { label: 'large egg', aliases: ['egg','eggs','huevo','huevos'], per: 'item', calories: 72, protein_g: 6.3, carbs_g: 0.4, fat_g: 4.8 },
  corn_tortilla_6in: { label: '6-inch corn tortilla', aliases: ['corn tortilla','corn tortillas','tortilla de maiz','tortillas de maiz','tortilla','tortillas'], per: 'item', calories: 52, protein_g: 1.4, carbs_g: 10.7, fat_g: 0.7 },
  flour_tortilla_8in: { label: '8-inch flour tortilla', aliases: ['flour tortilla','flour tortillas','tortilla de harina','tortillas de harina'], per: 'item', calories: 140, protein_g: 4.0, carbs_g: 24.0, fat_g: 4.0 },
  avocado_100g: { label: 'avocado', aliases: ['avocado','aguacate'], per: '100g', calories: 160, protein_g: 2.0, carbs_g: 8.5, fat_g: 14.7 },
  pineapple_100g: { label: 'pineapple', aliases: ['pineapple','pina','piña'], per: '100g', calories: 50, protein_g: 0.5, carbs_g: 13.1, fat_g: 0.1 },
  celery_100g: { label: 'celery', aliases: ['celery','apio'], per: '100g', calories: 14, protein_g: 0.7, carbs_g: 3.0, fat_g: 0.2 },
  beet_100g: { label: 'beet', aliases: ['beet','beets','betabel','remolacha'], per: '100g', calories: 43, protein_g: 1.6, carbs_g: 9.6, fat_g: 0.2 },
  coconut_water_240ml: { label: 'coconut water', aliases: ['coconut water','agua de coco'], per: '240ml', calories: 45, protein_g: 1.7, carbs_g: 8.9, fat_g: 0.5 },
  refried_beans_100g: { label: 'refried beans', aliases: ['refried beans','beans','frijoles','frijoles refritos'], per: '100g', calories: 90, protein_g: 4.6, carbs_g: 13.5, fat_g: 2.0 },
  tortilla_chips_28g: { label: 'tortilla chips', aliases: ['tortilla chips','totopos','chips'], per: '28g', calories: 140, protein_g: 2.0, carbs_g: 19.0, fat_g: 7.0 },
  salsa_30g: { label: 'salsa', aliases: ['salsa'], per: '30g', calories: 10, protein_g: 0.4, carbs_g: 2.0, fat_g: 0.1 },
  beef_jerky_100g: { label: 'beef jerky', aliases: ['beef jerky','jerky','carne seca'], per: '100g', calories: 410, protein_g: 33.0, carbs_g: 11.0, fat_g: 25.0 },
  bone_broth_240ml: { label: 'bone broth', aliases: ['bone broth','caldo de hueso'], per: '240ml', calories: 40, protein_g: 9.0, carbs_g: 0.0, fat_g: 0.5 }
};

export const KNOWN_KEYS = Object.keys(FOODS);

export function nutritionFor(key, quantity = 1, grams = null, ml = null) {
  const f = FOODS[key];
  if (!f) return null;
  let multiplier = Number(quantity) || 1;
  if (f.per === '100g' && Number(grams) > 0) multiplier = Number(grams) / 100;
  if (f.per.endsWith('g') && f.per !== '100g' && Number(grams) > 0) multiplier = Number(grams) / Number(f.per.replace('g',''));
  if (f.per.endsWith('ml') && Number(ml) > 0) multiplier = Number(ml) / Number(f.per.replace('ml',''));
  return {
    label: f.label,
    calories: Math.round(f.calories * multiplier),
    protein_g: +(f.protein_g * multiplier).toFixed(1),
    carbs_g: +(f.carbs_g * multiplier).toFixed(1),
    fat_g: +(f.fat_g * multiplier).toFixed(1),
    source: 'local-reference'
  };
}
