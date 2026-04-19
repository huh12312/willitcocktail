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
  { id: 'pisco', name: 'Pisco', category: 'spirit' },
  { id: 'calvados', name: 'Calvados', category: 'spirit' },

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

  // --- WINES ---
  { id: 'prosecco', name: 'Prosecco', category: 'wine' },
  { id: 'champagne', name: 'Champagne', category: 'wine' },
  { id: 'sparkling_wine', name: 'Sparkling Wine', category: 'wine' },
  { id: 'port', name: 'Port', category: 'wine' },

  // --- JUICES ---
  { id: 'lime_juice', name: 'Fresh Lime Juice', category: 'juice' },
  { id: 'lemon_juice', name: 'Fresh Lemon Juice', category: 'juice' },
  { id: 'orange_juice', name: 'Fresh Orange Juice', category: 'juice' },
  { id: 'grapefruit_juice', name: 'Fresh Grapefruit Juice', category: 'juice' },
  { id: 'pineapple_juice', name: 'Pineapple Juice', category: 'juice' },
  { id: 'cranberry_juice', name: 'Cranberry Juice', category: 'juice' },
  { id: 'tomato_juice', name: 'Tomato Juice', category: 'juice' },

  // --- SYRUPS ---
  { id: 'simple_syrup', name: 'Simple Syrup', category: 'syrup' },
  { id: 'gomme_syrup', name: 'Gomme Syrup', category: 'syrup' },
  { id: 'grenadine', name: 'Grenadine', category: 'syrup' },
  { id: 'orgeat', name: 'Orgeat', category: 'syrup' },
  { id: 'honey_syrup', name: 'Honey Syrup', category: 'syrup' },
  { id: 'agave_syrup', name: 'Agave Syrup', category: 'syrup' },
  { id: 'raspberry_syrup', name: 'Raspberry Syrup', category: 'syrup' },
  { id: 'falernum', name: 'Falernum', category: 'syrup' },

  // --- BITTERS ---
  { id: 'angostura_bitters', name: 'Angostura Bitters', category: 'bitter' },
  { id: 'orange_bitters', name: 'Orange Bitters', category: 'bitter' },
  { id: 'peychauds_bitters', name: "Peychaud's Bitters", category: 'bitter' },

  // --- MIXERS ---
  { id: 'soda_water', name: 'Soda Water', category: 'mixer' },
  { id: 'tonic_water', name: 'Tonic Water', category: 'mixer' },
  { id: 'ginger_beer', name: 'Ginger Beer', category: 'mixer' },
  { id: 'ginger_ale', name: 'Ginger Ale', category: 'mixer' },
  { id: 'cola', name: 'Cola', category: 'mixer' },
  { id: 'lemon_lime_soda', name: 'Lemon-Lime Soda', category: 'mixer' },

  // --- OTHER ---
  { id: 'sugar_cube', name: 'Sugar Cube', category: 'other' },
  { id: 'sugar', name: 'Sugar', category: 'other' },
  { id: 'egg_white', name: 'Egg White', category: 'other' },
  { id: 'whole_egg', name: 'Whole Egg', category: 'other' },
  { id: 'cream', name: 'Heavy Cream', category: 'other' },
  { id: 'milk', name: 'Milk', category: 'other' },
  { id: 'coconut_cream', name: 'Coconut Cream', category: 'other' },
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
];
