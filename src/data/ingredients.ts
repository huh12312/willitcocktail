import type { Ingredient, IngredientAlias, Substitute } from '../types';

// Canonical ingredient table. IDs are stable and referenced by recipes.
// Parent-child hierarchy: children satisfy parents in the matcher.
export const INGREDIENTS: Ingredient[] = [
  // --- SPIRITS: base families ---
  { id: 'gin', name: 'Gin', category: 'spirit' },
  { id: 'gin_london_dry', name: 'London Dry Gin', category: 'spirit', parentId: 'gin' },
  { id: 'gin_plymouth', name: 'Plymouth Gin', category: 'spirit', parentId: 'gin' },
  { id: 'gin_old_tom', name: 'Old Tom Gin', category: 'spirit', parentId: 'gin' },

  { id: 'vodka', name: 'Vodka', category: 'spirit' },

  { id: 'rum', name: 'Rum', category: 'spirit' },
  { id: 'rum_white', name: 'White Rum', category: 'spirit', parentId: 'rum' },
  { id: 'rum_gold', name: 'Gold Rum', category: 'spirit', parentId: 'rum' },
  { id: 'rum_dark', name: 'Dark Rum', category: 'spirit', parentId: 'rum' },
  { id: 'rum_overproof', name: 'Overproof Rum', category: 'spirit', parentId: 'rum' },
  { id: 'cachaca', name: 'Cachaça', category: 'spirit' },

  { id: 'tequila', name: 'Tequila', category: 'spirit' },
  { id: 'tequila_blanco', name: 'Blanco Tequila', category: 'spirit', parentId: 'tequila' },
  { id: 'tequila_reposado', name: 'Reposado Tequila', category: 'spirit', parentId: 'tequila' },
  { id: 'mezcal', name: 'Mezcal', category: 'spirit' },

  { id: 'whiskey', name: 'Whiskey', category: 'spirit' },
  { id: 'bourbon', name: 'Bourbon', category: 'spirit', parentId: 'whiskey' },
  { id: 'rye', name: 'Rye Whiskey', category: 'spirit', parentId: 'whiskey' },
  { id: 'scotch', name: 'Scotch Whisky', category: 'spirit', parentId: 'whiskey' },
  { id: 'irish_whiskey', name: 'Irish Whiskey', category: 'spirit', parentId: 'whiskey' },

  { id: 'brandy', name: 'Brandy', category: 'spirit' },
  { id: 'cognac', name: 'Cognac', category: 'spirit', parentId: 'brandy' },
  { id: 'armagnac', name: 'Armagnac', category: 'spirit', parentId: 'brandy' },
  { id: 'pisco', name: 'Pisco', category: 'spirit' },
  { id: 'calvados', name: 'Calvados', category: 'spirit' },
  { id: 'japanese_whisky', name: 'Japanese Whisky', category: 'spirit', parentId: 'whiskey' },
  { id: 'rhum_agricole', name: 'Rhum Agricole', category: 'spirit', parentId: 'rum' },
  { id: 'aquavit', name: 'Aquavit', category: 'spirit' },
  { id: 'genever', name: 'Genever', category: 'spirit' },

  // --- LIQUEURS & FORTIFIED WINES ---
  { id: 'vermouth_dry', name: 'Dry Vermouth', category: 'wine' },
  { id: 'vermouth_sweet', name: 'Sweet Vermouth', category: 'wine' },
  { id: 'vermouth_bianco', name: 'Bianco Vermouth', category: 'wine' },
  { id: 'lillet_blanc', name: 'Lillet Blanc', category: 'wine' },
  { id: 'campari', name: 'Campari', category: 'liqueur' },
  { id: 'aperol', name: 'Aperol', category: 'liqueur' },
  { id: 'cynar', name: 'Cynar', category: 'liqueur' },
  { id: 'fernet_branca', name: 'Fernet-Branca', category: 'liqueur' },
  { id: 'amaro_nonino', name: 'Amaro Nonino', category: 'liqueur' },
  { id: 'cointreau', name: 'Cointreau', category: 'liqueur' },
  { id: 'triple_sec', name: 'Triple Sec', category: 'liqueur' },
  { id: 'grand_marnier', name: 'Grand Marnier', category: 'liqueur' },
  { id: 'curacao_orange', name: 'Orange Curaçao', category: 'liqueur' },
  { id: 'maraschino', name: 'Maraschino Liqueur', category: 'liqueur' },
  { id: 'creme_de_cassis', name: 'Crème de Cassis', category: 'liqueur' },
  { id: 'creme_de_menthe_white', name: 'White Crème de Menthe', category: 'liqueur' },
  { id: 'creme_de_menthe_green', name: 'Green Crème de Menthe', category: 'liqueur' },
  { id: 'creme_de_cacao_white', name: 'White Crème de Cacao', category: 'liqueur' },
  { id: 'creme_de_cacao_dark', name: 'Dark Crème de Cacao', category: 'liqueur' },
  { id: 'kahlua', name: 'Kahlúa (coffee liqueur)', category: 'liqueur' },
  { id: 'baileys', name: 'Irish Cream', category: 'liqueur' },
  { id: 'galliano', name: 'Galliano', category: 'liqueur' },
  { id: 'chartreuse_green', name: 'Green Chartreuse', category: 'liqueur' },
  { id: 'chartreuse_yellow', name: 'Yellow Chartreuse', category: 'liqueur' },
  { id: 'benedictine', name: 'Bénédictine', category: 'liqueur' },
  { id: 'drambuie', name: 'Drambuie', category: 'liqueur' },
  { id: 'elderflower_liqueur', name: 'Elderflower Liqueur', category: 'liqueur' },
  { id: 'sambuca', name: 'Sambuca', category: 'liqueur' },
  { id: 'absinthe', name: 'Absinthe', category: 'liqueur' },
  { id: 'creme_de_violette', name: 'Crème de Violette', category: 'liqueur' },
  { id: 'creme_de_mure', name: 'Crème de Mûre (blackberry)', category: 'liqueur' },
  { id: 'creme_de_framboise', name: 'Crème de Framboise (raspberry)', category: 'liqueur' },
  { id: 'creme_de_peche', name: 'Crème de Pêche (peach)', category: 'liqueur' },
  { id: 'suze', name: 'Suze', category: 'liqueur' },
  { id: 'pimms', name: "Pimm's No. 1", category: 'liqueur' },
  { id: 'amaro_montenegro', name: 'Amaro Montenegro', category: 'liqueur' },
  { id: 'amaro_averna', name: 'Averna', category: 'liqueur' },
  { id: 'amaretto', name: 'Amaretto', category: 'liqueur' },
  { id: 'frangelico', name: 'Frangelico', category: 'liqueur' },
  { id: 'midori', name: 'Midori', category: 'liqueur' },
  { id: 'licor_43', name: 'Licor 43', category: 'liqueur' },
  { id: 'chambord', name: 'Chambord', category: 'liqueur' },
  { id: 'kummel', name: 'Kümmel', category: 'liqueur' },
  { id: 'st_germain', name: 'St-Germain', category: 'liqueur', parentId: 'elderflower_liqueur' },
  { id: 'select_aperitivo', name: 'Select Aperitivo', category: 'liqueur' },

  // --- WINES ---
  { id: 'prosecco', name: 'Prosecco', category: 'wine' },
  { id: 'champagne', name: 'Champagne', category: 'wine' },
  { id: 'sparkling_wine', name: 'Sparkling Wine', category: 'wine' },
  { id: 'port', name: 'Port', category: 'wine' },
  { id: 'sherry_fino', name: 'Fino Sherry', category: 'wine' },
  { id: 'sherry_manzanilla', name: 'Manzanilla Sherry', category: 'wine' },
  { id: 'sherry_amontillado', name: 'Amontillado Sherry', category: 'wine' },
  { id: 'sherry_oloroso', name: 'Oloroso Sherry', category: 'wine' },
  { id: 'sherry_px', name: 'Pedro Ximénez Sherry', category: 'wine' },
  { id: 'madeira', name: 'Madeira', category: 'wine' },
  { id: 'punt_e_mes', name: 'Punt e Mes', category: 'wine' },
  { id: 'sake', name: 'Sake', category: 'wine' },

  // --- JUICES ---
  { id: 'lime_juice', name: 'Fresh Lime Juice', category: 'juice' },
  { id: 'lemon_juice', name: 'Fresh Lemon Juice', category: 'juice' },
  { id: 'orange_juice', name: 'Fresh Orange Juice', category: 'juice' },
  { id: 'grapefruit_juice', name: 'Fresh Grapefruit Juice', category: 'juice' },
  { id: 'pineapple_juice', name: 'Pineapple Juice', category: 'juice' },
  { id: 'cranberry_juice', name: 'Cranberry Juice', category: 'juice' },
  { id: 'tomato_juice', name: 'Tomato Juice', category: 'juice' },
  { id: 'apple_juice', name: 'Apple Juice', category: 'juice' },
  { id: 'passion_fruit_juice', name: 'Passion Fruit Juice', category: 'juice' },

  // --- SYRUPS ---
  { id: 'simple_syrup', name: 'Simple Syrup', category: 'syrup' },
  { id: 'gomme_syrup', name: 'Gomme Syrup', category: 'syrup' },
  { id: 'grenadine', name: 'Grenadine', category: 'syrup' },
  { id: 'orgeat', name: 'Orgeat', category: 'syrup' },
  { id: 'honey_syrup', name: 'Honey Syrup', category: 'syrup' },
  { id: 'agave_syrup', name: 'Agave Syrup', category: 'syrup' },
  { id: 'raspberry_syrup', name: 'Raspberry Syrup', category: 'syrup' },
  { id: 'falernum', name: 'Falernum', category: 'syrup' },
  { id: 'demerara_syrup', name: 'Demerara Syrup', category: 'syrup' },
  { id: 'cinnamon_syrup', name: 'Cinnamon Syrup', category: 'syrup' },
  { id: 'ginger_syrup', name: 'Ginger Syrup', category: 'syrup' },
  { id: 'vanilla_syrup', name: 'Vanilla Syrup', category: 'syrup' },
  { id: 'pineapple_syrup', name: 'Pineapple Syrup', category: 'syrup' },
  { id: 'cane_syrup', name: 'Cane Syrup', category: 'syrup' },

  // --- BITTERS ---
  { id: 'angostura_bitters', name: 'Angostura Bitters', category: 'bitter' },
  { id: 'orange_bitters', name: 'Orange Bitters', category: 'bitter' },
  { id: 'peychauds_bitters', name: "Peychaud's Bitters", category: 'bitter' },
  { id: 'aromatic_bitters', name: 'Aromatic Bitters', category: 'bitter' },
  { id: 'cardamom_bitters', name: 'Cardamom Bitters', category: 'bitter' },
  { id: 'celery_bitters', name: 'Celery Bitters', category: 'bitter' },
  { id: 'rhubarb_bitters', name: 'Rhubarb Bitters', category: 'bitter' },

  // --- MIXERS ---
  { id: 'soda_water', name: 'Soda Water', category: 'mixer' },
  { id: 'tonic_water', name: 'Tonic Water', category: 'mixer' },
  { id: 'ginger_beer', name: 'Ginger Beer', category: 'mixer' },
  { id: 'ginger_ale', name: 'Ginger Ale', category: 'mixer' },
  { id: 'cola', name: 'Cola', category: 'mixer' },
  { id: 'lemon_lime_soda', name: 'Lemon-Lime Soda', category: 'mixer' },
  { id: 'beer', name: 'Beer', category: 'mixer' },
  { id: 'stout', name: 'Stout', category: 'mixer', parentId: 'beer' },
  { id: 'sparkling_grapefruit', name: 'Grapefruit Soda', category: 'mixer' },

  // --- OTHER ---
  { id: 'sugar_cube', name: 'Sugar Cube', category: 'other' },
  { id: 'sugar', name: 'Sugar', category: 'other' },
  { id: 'egg_white', name: 'Egg White', category: 'other' },
  { id: 'whole_egg', name: 'Whole Egg', category: 'other' },
  { id: 'cream', name: 'Heavy Cream', category: 'other' },
  { id: 'milk', name: 'Milk', category: 'other' },
  { id: 'coconut_cream', name: 'Coconut Cream', category: 'other' },
  { id: 'coconut_milk', name: 'Coconut Milk', category: 'other' },
  { id: 'saline_solution', name: 'Saline Solution', category: 'other' },
  { id: 'salt', name: 'Salt', category: 'other' },
  { id: 'water', name: 'Water', category: 'other' },

  // Fresh herbs & botanicals
  { id: 'mint_leaves', name: 'Fresh Mint', category: 'other' },
  { id: 'basil', name: 'Fresh Basil', category: 'other' },
  { id: 'rosemary', name: 'Fresh Rosemary', category: 'other' },
  { id: 'thyme', name: 'Fresh Thyme', category: 'other' },
  { id: 'sage', name: 'Fresh Sage', category: 'other' },
  { id: 'cilantro', name: 'Fresh Cilantro', category: 'other' },

  // Fresh fruit / produce (muddled or garnish)
  { id: 'cucumber', name: 'Cucumber', category: 'other' },
  { id: 'ginger_fresh', name: 'Fresh Ginger', category: 'other' },
  { id: 'jalapeno', name: 'Jalapeño', category: 'other' },
  { id: 'strawberry', name: 'Strawberry', category: 'other' },
  { id: 'raspberry', name: 'Raspberry', category: 'other' },
  { id: 'blackberry', name: 'Blackberry', category: 'other' },
  { id: 'passion_fruit', name: 'Passion Fruit', category: 'other' },
  { id: 'peach', name: 'Peach', category: 'other' },
  { id: 'pineapple', name: 'Pineapple', category: 'other' },
  { id: 'apple', name: 'Apple', category: 'other' },
  { id: 'pear', name: 'Pear', category: 'other' },
  { id: 'pomegranate', name: 'Pomegranate', category: 'other' },
  { id: 'watermelon', name: 'Watermelon', category: 'other' },

  // Spices
  { id: 'cinnamon_stick', name: 'Cinnamon Stick', category: 'other' },
  { id: 'nutmeg', name: 'Nutmeg', category: 'other' },
  { id: 'black_pepper', name: 'Black Pepper', category: 'other' },
  { id: 'star_anise', name: 'Star Anise', category: 'other' },
  { id: 'cardamom', name: 'Cardamom', category: 'other' },

  // Coffee
  { id: 'espresso', name: 'Espresso', category: 'other' },
  { id: 'coffee_brewed', name: 'Brewed Coffee', category: 'other' },

  // Savory / bloody mary kit
  { id: 'tabasco', name: 'Tabasco', category: 'other' },
  { id: 'worcestershire', name: 'Worcestershire Sauce', category: 'other' },
  { id: 'celery_stalk', name: 'Celery Stalk', category: 'other' },
  { id: 'horseradish', name: 'Horseradish', category: 'other' },

  // Chocolate bitters — common enough to mention
  { id: 'chocolate_bitters', name: 'Chocolate Bitters', category: 'bitter' },

  // --- GARNISH ---
  { id: 'olive', name: 'Olive', category: 'garnish' },
  { id: 'lemon_twist', name: 'Lemon Twist', category: 'garnish' },
  { id: 'orange_twist', name: 'Orange Twist', category: 'garnish' },
  { id: 'cherry', name: 'Maraschino Cherry', category: 'garnish' },
];

export const INGREDIENT_ALIASES: IngredientAlias[] = [
  { alias: 'fresh lime juice', ingredientId: 'lime_juice' },
  { alias: 'juice of 1 lime', ingredientId: 'lime_juice' },
  { alias: 'lime', ingredientId: 'lime_juice' },
  { alias: 'fresh lemon juice', ingredientId: 'lemon_juice' },
  { alias: 'juice of 1 lemon', ingredientId: 'lemon_juice' },
  { alias: 'lemon', ingredientId: 'lemon_juice' },
  { alias: 'gin', ingredientId: 'gin_london_dry' },
  { alias: 'london dry gin', ingredientId: 'gin_london_dry' },
  { alias: 'white rum', ingredientId: 'rum_white' },
  { alias: 'light rum', ingredientId: 'rum_white' },
  { alias: 'dark rum', ingredientId: 'rum_dark' },
  { alias: 'bourbon', ingredientId: 'bourbon' },
  { alias: 'rye', ingredientId: 'rye' },
  { alias: 'rye whiskey', ingredientId: 'rye' },
  { alias: 'scotch', ingredientId: 'scotch' },
  { alias: 'cognac', ingredientId: 'cognac' },
  { alias: 'brandy', ingredientId: 'brandy' },
  { alias: 'dry vermouth', ingredientId: 'vermouth_dry' },
  { alias: 'sweet vermouth', ingredientId: 'vermouth_sweet' },
  { alias: 'campari', ingredientId: 'campari' },
  { alias: 'aperol', ingredientId: 'aperol' },
  { alias: 'cointreau', ingredientId: 'cointreau' },
  { alias: 'triple sec', ingredientId: 'triple_sec' },
  { alias: 'simple syrup', ingredientId: 'simple_syrup' },
  { alias: 'sugar syrup', ingredientId: 'simple_syrup' },
  { alias: 'grenadine', ingredientId: 'grenadine' },
  { alias: 'orgeat', ingredientId: 'orgeat' },
  { alias: 'angostura', ingredientId: 'angostura_bitters' },
  { alias: 'angostura bitters', ingredientId: 'angostura_bitters' },
  { alias: 'orange bitters', ingredientId: 'orange_bitters' },
  { alias: "peychaud's", ingredientId: 'peychauds_bitters' },
  { alias: 'soda', ingredientId: 'soda_water' },
  { alias: 'club soda', ingredientId: 'soda_water' },
  { alias: 'tonic', ingredientId: 'tonic_water' },
  { alias: 'prosecco', ingredientId: 'prosecco' },
  { alias: 'champagne', ingredientId: 'champagne' },

  // Herbs & botanicals
  { alias: 'basil', ingredientId: 'basil' },
  { alias: 'fresh basil', ingredientId: 'basil' },
  { alias: 'rosemary', ingredientId: 'rosemary' },
  { alias: 'fresh rosemary', ingredientId: 'rosemary' },
  { alias: 'thyme', ingredientId: 'thyme' },
  { alias: 'sage', ingredientId: 'sage' },
  { alias: 'mint', ingredientId: 'mint_leaves' },
  { alias: 'fresh mint', ingredientId: 'mint_leaves' },
  { alias: 'cilantro', ingredientId: 'cilantro' },
  { alias: 'coriander', ingredientId: 'cilantro' },

  // Produce
  { alias: 'cucumber', ingredientId: 'cucumber' },
  { alias: 'ginger', ingredientId: 'ginger_fresh' },
  { alias: 'fresh ginger', ingredientId: 'ginger_fresh' },
  { alias: 'ginger root', ingredientId: 'ginger_fresh' },
  { alias: 'jalapeno', ingredientId: 'jalapeno' },
  { alias: 'jalapeño', ingredientId: 'jalapeno' },
  { alias: 'chili', ingredientId: 'jalapeno' },
  { alias: 'strawberry', ingredientId: 'strawberry' },
  { alias: 'strawberries', ingredientId: 'strawberry' },
  { alias: 'raspberry', ingredientId: 'raspberry' },
  { alias: 'raspberries', ingredientId: 'raspberry' },
  { alias: 'blackberry', ingredientId: 'blackberry' },
  { alias: 'blackberries', ingredientId: 'blackberry' },
  { alias: 'passion fruit', ingredientId: 'passion_fruit' },
  { alias: 'passionfruit', ingredientId: 'passion_fruit' },
  { alias: 'peach', ingredientId: 'peach' },
  { alias: 'pineapple', ingredientId: 'pineapple' },
  { alias: 'apple', ingredientId: 'apple' },
  { alias: 'pear', ingredientId: 'pear' },
  { alias: 'pomegranate', ingredientId: 'pomegranate' },
  { alias: 'watermelon', ingredientId: 'watermelon' },

  // Spices
  { alias: 'cinnamon', ingredientId: 'cinnamon_stick' },
  { alias: 'cinnamon stick', ingredientId: 'cinnamon_stick' },
  { alias: 'nutmeg', ingredientId: 'nutmeg' },
  { alias: 'black pepper', ingredientId: 'black_pepper' },
  { alias: 'pepper', ingredientId: 'black_pepper' },
  { alias: 'star anise', ingredientId: 'star_anise' },
  { alias: 'cardamom', ingredientId: 'cardamom' },

  // Coffee / cream
  { alias: 'espresso', ingredientId: 'espresso' },
  { alias: 'coffee', ingredientId: 'coffee_brewed' },
  { alias: 'brewed coffee', ingredientId: 'coffee_brewed' },
  { alias: 'cream', ingredientId: 'cream' },
  { alias: 'heavy cream', ingredientId: 'cream' },
  { alias: 'double cream', ingredientId: 'cream' },
  { alias: 'milk', ingredientId: 'milk' },
  { alias: 'coconut cream', ingredientId: 'coconut_cream' },
  { alias: 'cream of coconut', ingredientId: 'coconut_cream' },

  // Savory
  { alias: 'tabasco', ingredientId: 'tabasco' },
  { alias: 'hot sauce', ingredientId: 'tabasco' },
  { alias: 'worcestershire', ingredientId: 'worcestershire' },
  { alias: 'worcestershire sauce', ingredientId: 'worcestershire' },
  { alias: 'celery', ingredientId: 'celery_stalk' },
  { alias: 'horseradish', ingredientId: 'horseradish' },

  // Chocolate bitters
  { alias: 'chocolate bitters', ingredientId: 'chocolate_bitters' },
  { alias: 'aromatic bitters', ingredientId: 'aromatic_bitters' },
  { alias: 'cardamom bitters', ingredientId: 'cardamom_bitters' },
  { alias: 'celery bitters', ingredientId: 'celery_bitters' },
  { alias: 'rhubarb bitters', ingredientId: 'rhubarb_bitters' },

  // Liqueur aliases (brand + generic)
  { alias: 'st germain', ingredientId: 'st_germain' },
  { alias: 'st-germain', ingredientId: 'st_germain' },
  { alias: 'elderflower', ingredientId: 'elderflower_liqueur' },
  { alias: 'elderflower cordial', ingredientId: 'elderflower_liqueur' },
  { alias: 'creme de violette', ingredientId: 'creme_de_violette' },
  { alias: 'crème de violette', ingredientId: 'creme_de_violette' },
  { alias: 'violette', ingredientId: 'creme_de_violette' },
  { alias: 'creme de mure', ingredientId: 'creme_de_mure' },
  { alias: 'crème de mûre', ingredientId: 'creme_de_mure' },
  { alias: 'blackberry liqueur', ingredientId: 'creme_de_mure' },
  { alias: 'creme de framboise', ingredientId: 'creme_de_framboise' },
  { alias: 'raspberry liqueur', ingredientId: 'creme_de_framboise' },
  { alias: 'peach liqueur', ingredientId: 'creme_de_peche' },
  { alias: 'peach schnapps', ingredientId: 'creme_de_peche' },
  { alias: 'suze', ingredientId: 'suze' },
  { alias: "pimm's", ingredientId: 'pimms' },
  { alias: 'pimms', ingredientId: 'pimms' },
  { alias: "pimm's no. 1", ingredientId: 'pimms' },
  { alias: 'amaro montenegro', ingredientId: 'amaro_montenegro' },
  { alias: 'montenegro', ingredientId: 'amaro_montenegro' },
  { alias: 'averna', ingredientId: 'amaro_averna' },
  { alias: 'amaro averna', ingredientId: 'amaro_averna' },
  { alias: 'amaretto', ingredientId: 'amaretto' },
  { alias: 'disaronno', ingredientId: 'amaretto' },
  { alias: 'frangelico', ingredientId: 'frangelico' },
  { alias: 'hazelnut liqueur', ingredientId: 'frangelico' },
  { alias: 'midori', ingredientId: 'midori' },
  { alias: 'melon liqueur', ingredientId: 'midori' },
  { alias: 'licor 43', ingredientId: 'licor_43' },
  { alias: 'chambord', ingredientId: 'chambord' },
  { alias: 'kummel', ingredientId: 'kummel' },
  { alias: 'kümmel', ingredientId: 'kummel' },
  { alias: 'select', ingredientId: 'select_aperitivo' },
  { alias: 'select aperitivo', ingredientId: 'select_aperitivo' },
  { alias: 'cynar', ingredientId: 'cynar' },
  { alias: 'fernet', ingredientId: 'fernet_branca' },
  { alias: 'fernet branca', ingredientId: 'fernet_branca' },
  { alias: 'fernet-branca', ingredientId: 'fernet_branca' },
  { alias: 'amaro nonino', ingredientId: 'amaro_nonino' },
  { alias: 'nonino', ingredientId: 'amaro_nonino' },
  { alias: 'green chartreuse', ingredientId: 'chartreuse_green' },
  { alias: 'yellow chartreuse', ingredientId: 'chartreuse_yellow' },
  { alias: 'chartreuse', ingredientId: 'chartreuse_green' },
  { alias: 'benedictine', ingredientId: 'benedictine' },
  { alias: 'bénédictine', ingredientId: 'benedictine' },
  { alias: 'drambuie', ingredientId: 'drambuie' },
  { alias: 'galliano', ingredientId: 'galliano' },
  { alias: 'kahlua', ingredientId: 'kahlua' },
  { alias: 'kahlúa', ingredientId: 'kahlua' },
  { alias: 'coffee liqueur', ingredientId: 'kahlua' },
  { alias: 'maraschino', ingredientId: 'maraschino' },
  { alias: 'maraschino liqueur', ingredientId: 'maraschino' },
  { alias: 'luxardo', ingredientId: 'maraschino' },
  { alias: 'creme de cassis', ingredientId: 'creme_de_cassis' },
  { alias: 'crème de cassis', ingredientId: 'creme_de_cassis' },
  { alias: 'cassis', ingredientId: 'creme_de_cassis' },
  { alias: 'absinthe', ingredientId: 'absinthe' },
  { alias: 'pastis', ingredientId: 'absinthe' },
  { alias: 'curacao', ingredientId: 'curacao_orange' },
  { alias: 'curaçao', ingredientId: 'curacao_orange' },
  { alias: 'orange curacao', ingredientId: 'curacao_orange' },
  { alias: 'grand marnier', ingredientId: 'grand_marnier' },

  // Spirit aliases (brand + generic)
  { alias: 'vodka', ingredientId: 'vodka' },
  { alias: 'tequila', ingredientId: 'tequila_blanco' },
  { alias: 'blanco tequila', ingredientId: 'tequila_blanco' },
  { alias: 'silver tequila', ingredientId: 'tequila_blanco' },
  { alias: 'reposado tequila', ingredientId: 'tequila_reposado' },
  { alias: 'mezcal', ingredientId: 'mezcal' },
  { alias: 'old tom gin', ingredientId: 'gin_old_tom' },
  { alias: 'plymouth gin', ingredientId: 'gin_plymouth' },
  { alias: 'irish whiskey', ingredientId: 'irish_whiskey' },
  { alias: 'japanese whisky', ingredientId: 'japanese_whisky' },
  { alias: 'japanese whiskey', ingredientId: 'japanese_whisky' },
  { alias: 'armagnac', ingredientId: 'armagnac' },
  { alias: 'pisco', ingredientId: 'pisco' },
  { alias: 'calvados', ingredientId: 'calvados' },
  { alias: 'apple brandy', ingredientId: 'calvados' },
  { alias: 'cachaça', ingredientId: 'cachaca' },
  { alias: 'cachaca', ingredientId: 'cachaca' },
  { alias: 'rhum agricole', ingredientId: 'rhum_agricole' },
  { alias: 'aquavit', ingredientId: 'aquavit' },
  { alias: 'genever', ingredientId: 'genever' },

  // Wines & fortified
  { alias: 'lillet blanc', ingredientId: 'lillet_blanc' },
  { alias: 'lillet', ingredientId: 'lillet_blanc' },
  { alias: 'bianco vermouth', ingredientId: 'vermouth_bianco' },
  { alias: 'blanc vermouth', ingredientId: 'vermouth_bianco' },
  { alias: 'fino sherry', ingredientId: 'sherry_fino' },
  { alias: 'fino', ingredientId: 'sherry_fino' },
  { alias: 'manzanilla', ingredientId: 'sherry_manzanilla' },
  { alias: 'manzanilla sherry', ingredientId: 'sherry_manzanilla' },
  { alias: 'amontillado', ingredientId: 'sherry_amontillado' },
  { alias: 'oloroso', ingredientId: 'sherry_oloroso' },
  { alias: 'pedro ximenez', ingredientId: 'sherry_px' },
  { alias: 'px sherry', ingredientId: 'sherry_px' },
  { alias: 'sherry', ingredientId: 'sherry_fino' },
  { alias: 'madeira', ingredientId: 'madeira' },
  { alias: 'port', ingredientId: 'port' },
  { alias: 'punt e mes', ingredientId: 'punt_e_mes' },
  { alias: 'sake', ingredientId: 'sake' },
  { alias: 'sparkling wine', ingredientId: 'sparkling_wine' },
  { alias: 'cava', ingredientId: 'sparkling_wine' },

  // Juices
  { alias: 'apple juice', ingredientId: 'apple_juice' },
  { alias: 'passion fruit juice', ingredientId: 'passion_fruit_juice' },
  { alias: 'orange juice', ingredientId: 'orange_juice' },
  { alias: 'fresh orange juice', ingredientId: 'orange_juice' },
  { alias: 'grapefruit juice', ingredientId: 'grapefruit_juice' },
  { alias: 'pineapple juice', ingredientId: 'pineapple_juice' },
  { alias: 'cranberry juice', ingredientId: 'cranberry_juice' },
  { alias: 'tomato juice', ingredientId: 'tomato_juice' },

  // Syrups
  { alias: 'demerara syrup', ingredientId: 'demerara_syrup' },
  { alias: 'rich simple syrup', ingredientId: 'demerara_syrup' },
  { alias: 'cinnamon syrup', ingredientId: 'cinnamon_syrup' },
  { alias: 'ginger syrup', ingredientId: 'ginger_syrup' },
  { alias: 'vanilla syrup', ingredientId: 'vanilla_syrup' },
  { alias: 'pineapple syrup', ingredientId: 'pineapple_syrup' },
  { alias: 'cane syrup', ingredientId: 'cane_syrup' },
  { alias: 'honey', ingredientId: 'honey_syrup' },
  { alias: 'honey syrup', ingredientId: 'honey_syrup' },
  { alias: 'falernum', ingredientId: 'falernum' },
  { alias: 'orgeat syrup', ingredientId: 'orgeat' },
  { alias: 'almond syrup', ingredientId: 'orgeat' },
  { alias: 'raspberry syrup', ingredientId: 'raspberry_syrup' },
  { alias: 'agave', ingredientId: 'agave_syrup' },
  { alias: 'agave syrup', ingredientId: 'agave_syrup' },
  { alias: 'agave nectar', ingredientId: 'agave_syrup' },
  { alias: 'gomme syrup', ingredientId: 'gomme_syrup' },

  // Mixers
  { alias: 'ginger beer', ingredientId: 'ginger_beer' },
  { alias: 'ginger ale', ingredientId: 'ginger_ale' },
  { alias: 'tonic water', ingredientId: 'tonic_water' },
  { alias: 'soda water', ingredientId: 'soda_water' },
  { alias: 'sparkling water', ingredientId: 'soda_water' },
  { alias: 'cola', ingredientId: 'cola' },
  { alias: 'coca-cola', ingredientId: 'cola' },
  { alias: 'coke', ingredientId: 'cola' },
  { alias: 'lemonade', ingredientId: 'lemon_lime_soda' },
  { alias: 'sprite', ingredientId: 'lemon_lime_soda' },
  { alias: '7-up', ingredientId: 'lemon_lime_soda' },
  { alias: 'beer', ingredientId: 'beer' },
  { alias: 'stout', ingredientId: 'stout' },
  { alias: 'grapefruit soda', ingredientId: 'sparkling_grapefruit' },

  // Other
  { alias: 'coconut milk', ingredientId: 'coconut_milk' },
  { alias: 'saline', ingredientId: 'saline_solution' },
  { alias: 'saline solution', ingredientId: 'saline_solution' },
  { alias: 'egg white', ingredientId: 'egg_white' },
  { alias: 'whole egg', ingredientId: 'whole_egg' },
  { alias: 'egg', ingredientId: 'whole_egg' },
  { alias: 'water', ingredientId: 'water' },
  { alias: 'sugar', ingredientId: 'sugar' },
  { alias: 'sugar cube', ingredientId: 'sugar_cube' },
  { alias: 'caster sugar', ingredientId: 'sugar' },
];

// Substitute graph. Strength 1.0 = identical, 0.7+ = confident swap,
// 0.4-0.6 = passable, below 0.4 = last resort (not used by near-match).
export const SUBSTITUTES: Substitute[] = [
  // Citrus swaps
  { ingredientId: 'lime_juice', substituteId: 'lemon_juice', strength: 0.7, notes: 'slightly sweeter, less sharp' },
  { ingredientId: 'lemon_juice', substituteId: 'lime_juice', strength: 0.7, notes: 'brighter, more tart' },

  // Orange liqueur family
  { ingredientId: 'cointreau', substituteId: 'triple_sec', strength: 0.85, notes: 'triple sec is sweeter, slightly less refined' },
  { ingredientId: 'cointreau', substituteId: 'grand_marnier', strength: 0.8, notes: 'grand marnier is cognac-based, richer' },
  { ingredientId: 'cointreau', substituteId: 'curacao_orange', strength: 0.8 },
  { ingredientId: 'triple_sec', substituteId: 'cointreau', strength: 0.95 },
  { ingredientId: 'triple_sec', substituteId: 'curacao_orange', strength: 0.85 },
  { ingredientId: 'grand_marnier', substituteId: 'cointreau', strength: 0.75 },

  // Bitter Italian liqueurs
  { ingredientId: 'campari', substituteId: 'aperol', strength: 0.7, notes: 'aperol is sweeter, less bitter' },
  { ingredientId: 'aperol', substituteId: 'campari', strength: 0.7, notes: 'campari more bitter; use a bit less' },

  // Whiskey family swaps
  { ingredientId: 'rye', substituteId: 'bourbon', strength: 0.8, notes: 'bourbon is sweeter' },
  { ingredientId: 'bourbon', substituteId: 'rye', strength: 0.8, notes: 'rye is spicier, drier' },

  // Rum swaps
  { ingredientId: 'rum_white', substituteId: 'rum_gold', strength: 0.75 },
  { ingredientId: 'rum_dark', substituteId: 'rum_gold', strength: 0.75 },
  { ingredientId: 'rum_gold', substituteId: 'rum_white', strength: 0.75 },

  // Agave swaps
  { ingredientId: 'tequila_blanco', substituteId: 'mezcal', strength: 0.75, notes: 'mezcal adds smoke' },
  { ingredientId: 'mezcal', substituteId: 'tequila_blanco', strength: 0.7, notes: 'loses smokiness' },

  // Gin swaps (horizontal within gin family)
  { ingredientId: 'gin_london_dry', substituteId: 'gin_plymouth', strength: 0.9 },
  { ingredientId: 'gin_plymouth', substituteId: 'gin_london_dry', strength: 0.9 },

  // Sweetener swaps
  { ingredientId: 'simple_syrup', substituteId: 'agave_syrup', strength: 0.8 },
  { ingredientId: 'simple_syrup', substituteId: 'honey_syrup', strength: 0.75 },
  { ingredientId: 'agave_syrup', substituteId: 'simple_syrup', strength: 0.85 },
  { ingredientId: 'honey_syrup', substituteId: 'simple_syrup', strength: 0.8 },
  { ingredientId: 'gomme_syrup', substituteId: 'simple_syrup', strength: 0.9 },

  // Vermouth / aromatized wine
  { ingredientId: 'vermouth_bianco', substituteId: 'lillet_blanc', strength: 0.75 },
  { ingredientId: 'lillet_blanc', substituteId: 'vermouth_bianco', strength: 0.7 },

  // Sparkling
  { ingredientId: 'champagne', substituteId: 'prosecco', strength: 0.85 },
  { ingredientId: 'champagne', substituteId: 'sparkling_wine', strength: 0.9 },
  { ingredientId: 'prosecco', substituteId: 'champagne', strength: 0.85 },
  { ingredientId: 'prosecco', substituteId: 'sparkling_wine', strength: 0.9 },
  { ingredientId: 'sparkling_wine', substituteId: 'prosecco', strength: 0.9 },

  // Ginger soft drinks
  { ingredientId: 'ginger_beer', substituteId: 'ginger_ale', strength: 0.7, notes: 'ale is milder, sweeter' },
  { ingredientId: 'ginger_ale', substituteId: 'ginger_beer', strength: 0.8 },

  // Bitters (orange vs angostura overlap poorly — don't pretend)
  // Egg substitute considered risky; omit.

  // Sugar forms
  { ingredientId: 'sugar_cube', substituteId: 'simple_syrup', strength: 0.85, notes: 'use ~7ml syrup per cube' },
  { ingredientId: 'sugar', substituteId: 'simple_syrup', strength: 0.85 },
  { ingredientId: 'simple_syrup', substituteId: 'demerara_syrup', strength: 0.85, notes: 'richer, caramel notes' },
  { ingredientId: 'demerara_syrup', substituteId: 'simple_syrup', strength: 0.8 },
  { ingredientId: 'cane_syrup', substituteId: 'simple_syrup', strength: 0.9 },

  // Amaro family cross-subs (lossy but usable)
  { ingredientId: 'amaro_montenegro', substituteId: 'amaro_averna', strength: 0.65 },
  { ingredientId: 'amaro_averna', substituteId: 'amaro_montenegro', strength: 0.65 },
  { ingredientId: 'amaro_nonino', substituteId: 'amaro_averna', strength: 0.6 },

  // Bitter aperitifs
  { ingredientId: 'suze', substituteId: 'aperol', strength: 0.5, notes: 'very different — gentian vs. orange' },
  { ingredientId: 'select_aperitivo', substituteId: 'aperol', strength: 0.8 },
  { ingredientId: 'select_aperitivo', substituteId: 'campari', strength: 0.7 },

  // Elderflower family
  { ingredientId: 'st_germain', substituteId: 'elderflower_liqueur', strength: 0.95 },
  { ingredientId: 'elderflower_liqueur', substituteId: 'st_germain', strength: 0.95 },

  // Nut/stone liqueurs
  { ingredientId: 'amaretto', substituteId: 'orgeat', strength: 0.55, notes: 'non-alcoholic swap; adjust proof' },
  { ingredientId: 'frangelico', substituteId: 'amaretto', strength: 0.6 },

  // Berry liqueur swaps
  { ingredientId: 'chambord', substituteId: 'creme_de_cassis', strength: 0.75, notes: 'raspberry vs blackcurrant' },
  { ingredientId: 'chambord', substituteId: 'creme_de_framboise', strength: 0.9 },
  { ingredientId: 'creme_de_mure', substituteId: 'chambord', strength: 0.8 },
  { ingredientId: 'creme_de_framboise', substituteId: 'chambord', strength: 0.9 },

  // Violet has no good sub — omit.

  // Peach
  { ingredientId: 'creme_de_peche', substituteId: 'peach', strength: 0.5, notes: 'muddled fresh peach + simple' },

  // Whiskey family (extend)
  { ingredientId: 'japanese_whisky', substituteId: 'scotch', strength: 0.75 },
  { ingredientId: 'scotch', substituteId: 'japanese_whisky', strength: 0.75 },
  { ingredientId: 'irish_whiskey', substituteId: 'bourbon', strength: 0.7 },

  // Brandy extensions
  { ingredientId: 'armagnac', substituteId: 'cognac', strength: 0.9 },
  { ingredientId: 'cognac', substituteId: 'armagnac', strength: 0.9 },
  { ingredientId: 'calvados', substituteId: 'apple_juice', strength: 0.3, notes: 'non-alcoholic only' },

  // Rum extensions
  { ingredientId: 'rhum_agricole', substituteId: 'rum_white', strength: 0.7, notes: 'agricole has grassy funk' },

  // Sherry swaps
  { ingredientId: 'sherry_manzanilla', substituteId: 'sherry_fino', strength: 0.9 },
  { ingredientId: 'sherry_fino', substituteId: 'sherry_manzanilla', strength: 0.9 },
  { ingredientId: 'sherry_amontillado', substituteId: 'sherry_oloroso', strength: 0.75 },
  { ingredientId: 'sherry_oloroso', substituteId: 'sherry_amontillado', strength: 0.75 },
  { ingredientId: 'sherry_px', substituteId: 'sherry_oloroso', strength: 0.55, notes: 'PX much sweeter' },

  // Punt e Mes / sweet vermouth
  { ingredientId: 'punt_e_mes', substituteId: 'vermouth_sweet', strength: 0.75, notes: 'punt e mes more bitter' },

  // Juice extensions
  { ingredientId: 'grapefruit_juice', substituteId: 'sparkling_grapefruit', strength: 0.5 },

  // Syrup extensions
  { ingredientId: 'ginger_syrup', substituteId: 'ginger_beer', strength: 0.5, notes: 'adjust dilution' },
  { ingredientId: 'cinnamon_syrup', substituteId: 'simple_syrup', strength: 0.4, notes: 'loses spice' },
  { ingredientId: 'vanilla_syrup', substituteId: 'simple_syrup', strength: 0.5 },
  { ingredientId: 'pineapple_syrup', substituteId: 'pineapple_juice', strength: 0.55 },

  // Aromatic bitters family
  { ingredientId: 'aromatic_bitters', substituteId: 'angostura_bitters', strength: 0.95 },
  { ingredientId: 'angostura_bitters', substituteId: 'aromatic_bitters', strength: 0.95 },
];
