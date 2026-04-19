// src/data/recipes.ts
var RECIPES = [
  {
    id: "daiquiri",
    name: "Daiquiri",
    family: "sour",
    method: "shake",
    glass: "coupe",
    garnish: "Lime wheel",
    instructions: "Shake all ingredients hard with ice, double strain into a chilled coupe.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "rum_white", amountMl: 60, amountDisplay: "2 oz", position: 1 },
      { ingredientId: "lime_juice", amountMl: 30, amountDisplay: "1 oz", position: 2 },
      { ingredientId: "simple_syrup", amountMl: 15, amountDisplay: "0.5 oz", position: 3 }
    ]
  },
  {
    id: "margarita",
    name: "Margarita",
    family: "sour",
    method: "shake",
    glass: "rocks",
    garnish: "Salt rim, lime wedge",
    instructions: "Rim glass with salt. Shake tequila, Cointreau, and lime juice with ice. Strain into rocks glass over fresh ice.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "tequila_blanco", amountMl: 50, amountDisplay: "1.75 oz", position: 1 },
      { ingredientId: "cointreau", amountMl: 20, amountDisplay: "0.75 oz", position: 2 },
      { ingredientId: "lime_juice", amountMl: 15, amountDisplay: "0.5 oz", position: 3 }
    ]
  },
  {
    id: "whiskey_sour",
    name: "Whiskey Sour",
    family: "sour",
    method: "shake",
    glass: "coupe",
    garnish: "Cherry and lemon slice",
    instructions: "Dry shake (no ice) to emulsify egg white, then wet shake with ice. Strain into a coupe.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "bourbon", amountMl: 60, amountDisplay: "2 oz", position: 1 },
      { ingredientId: "lemon_juice", amountMl: 22, amountDisplay: "0.75 oz", position: 2 },
      { ingredientId: "simple_syrup", amountMl: 15, amountDisplay: "0.5 oz", position: 3 },
      { ingredientId: "egg_white", amountDisplay: "1 egg white", optional: true, position: 4 }
    ]
  },
  {
    id: "sidecar",
    name: "Sidecar",
    family: "sour",
    method: "shake",
    glass: "coupe",
    garnish: "Sugar rim (optional), orange twist",
    instructions: "Shake all ingredients with ice and strain into a chilled coupe.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "cognac", amountMl: 50, amountDisplay: "1.75 oz", position: 1 },
      { ingredientId: "cointreau", amountMl: 20, amountDisplay: "0.75 oz", position: 2 },
      { ingredientId: "lemon_juice", amountMl: 20, amountDisplay: "0.75 oz", position: 3 }
    ]
  },
  {
    id: "gimlet",
    name: "Gimlet",
    family: "sour",
    method: "shake",
    glass: "coupe",
    garnish: "Lime wheel",
    instructions: "Shake gin and lime cordial (or lime juice + syrup) with ice; strain into a chilled coupe.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "gin_london_dry", amountMl: 60, amountDisplay: "2 oz", position: 1 },
      { ingredientId: "lime_juice", amountMl: 22, amountDisplay: "0.75 oz", position: 2 },
      { ingredientId: "simple_syrup", amountMl: 15, amountDisplay: "0.5 oz", position: 3 }
    ]
  },
  {
    id: "cosmopolitan",
    name: "Cosmopolitan",
    family: "sour",
    method: "shake",
    glass: "martini",
    garnish: "Orange twist",
    instructions: "Shake all ingredients with ice and strain into a martini glass.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "vodka", amountMl: 40, amountDisplay: "1.5 oz", position: 1 },
      { ingredientId: "cointreau", amountMl: 15, amountDisplay: "0.5 oz", position: 2 },
      { ingredientId: "lime_juice", amountMl: 15, amountDisplay: "0.5 oz", position: 3 },
      { ingredientId: "cranberry_juice", amountMl: 30, amountDisplay: "1 oz", position: 4 }
    ]
  },
  {
    id: "kamikaze",
    name: "Kamikaze",
    family: "sour",
    method: "shake",
    glass: "martini",
    garnish: "Lime wheel",
    instructions: "Shake with ice and strain.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "vodka", amountMl: 30, amountDisplay: "1 oz", position: 1 },
      { ingredientId: "triple_sec", amountMl: 30, amountDisplay: "1 oz", position: 2 },
      { ingredientId: "lime_juice", amountMl: 30, amountDisplay: "1 oz", position: 3 }
    ]
  },
  {
    id: "caipirinha",
    name: "Caipirinha",
    family: "sour",
    method: "build",
    glass: "rocks",
    garnish: "Lime wedge",
    instructions: "Muddle lime wedges and sugar in a rocks glass. Add cacha\xE7a and crushed ice; stir.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "cachaca", amountMl: 60, amountDisplay: "2 oz", position: 1 },
      { ingredientId: "lime_juice", amountMl: 15, amountDisplay: "0.5 oz", position: 2 },
      { ingredientId: "sugar", amountDisplay: "2 tsp", position: 3 }
    ]
  },
  // --- HIGHBALLS ---
  {
    id: "gin_tonic",
    name: "Gin & Tonic",
    family: "highball",
    method: "build",
    glass: "highball",
    garnish: "Lime wedge",
    instructions: "Build gin over ice in a highball glass. Top with tonic water and garnish.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "gin_london_dry", amountMl: 50, amountDisplay: "1.75 oz", position: 1 },
      { ingredientId: "tonic_water", amountMl: 150, amountDisplay: "top", position: 2 }
    ]
  },
  {
    id: "moscow_mule",
    name: "Moscow Mule",
    family: "highball",
    method: "build",
    glass: "highball",
    garnish: "Lime wedge, mint sprig",
    instructions: "Build in a copper mug or highball over ice. Top with ginger beer.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "vodka", amountMl: 45, amountDisplay: "1.5 oz", position: 1 },
      { ingredientId: "lime_juice", amountMl: 15, amountDisplay: "0.5 oz", position: 2 },
      { ingredientId: "ginger_beer", amountMl: 120, amountDisplay: "top", position: 3 }
    ]
  },
  {
    id: "dark_stormy",
    name: "Dark 'n Stormy",
    family: "highball",
    method: "build",
    glass: "highball",
    garnish: "Lime wedge",
    instructions: "Build dark rum over ice. Top with ginger beer.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "rum_dark", amountMl: 60, amountDisplay: "2 oz", position: 1 },
      { ingredientId: "ginger_beer", amountMl: 120, amountDisplay: "top", position: 2 },
      { ingredientId: "lime_juice", amountMl: 15, amountDisplay: "0.5 oz", optional: true, position: 3 }
    ]
  },
  {
    id: "paloma",
    name: "Paloma",
    family: "highball",
    method: "build",
    glass: "highball",
    garnish: "Salt rim, grapefruit wedge",
    instructions: "Build tequila and lime juice over ice. Top with grapefruit soda (or fresh juice + soda).",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "tequila_blanco", amountMl: 50, amountDisplay: "1.75 oz", position: 1 },
      { ingredientId: "lime_juice", amountMl: 15, amountDisplay: "0.5 oz", position: 2 },
      { ingredientId: "grapefruit_juice", amountMl: 60, amountDisplay: "2 oz", position: 3 },
      { ingredientId: "soda_water", amountMl: 60, amountDisplay: "top", position: 4 }
    ]
  },
  {
    id: "mojito",
    name: "Mojito",
    family: "highball",
    method: "build",
    glass: "highball",
    garnish: "Mint sprig",
    instructions: "Muddle mint with sugar and lime juice in a highball. Add rum and crushed ice. Stir and top with soda.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "rum_white", amountMl: 50, amountDisplay: "1.75 oz", position: 1 },
      { ingredientId: "lime_juice", amountMl: 20, amountDisplay: "0.75 oz", position: 2 },
      { ingredientId: "sugar", amountDisplay: "2 tsp", position: 3 },
      { ingredientId: "mint_leaves", amountDisplay: "6 leaves", position: 4 },
      { ingredientId: "soda_water", amountMl: 60, amountDisplay: "top", position: 5 }
    ]
  },
  {
    id: "cuba_libre",
    name: "Cuba Libre",
    family: "highball",
    method: "build",
    glass: "highball",
    garnish: "Lime wedge",
    instructions: "Build over ice and stir.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "rum_white", amountMl: 50, amountDisplay: "1.75 oz", position: 1 },
      { ingredientId: "lime_juice", amountMl: 10, amountDisplay: "0.25 oz", position: 2 },
      { ingredientId: "cola", amountMl: 120, amountDisplay: "top", position: 3 }
    ]
  },
  {
    id: "tom_collins",
    name: "Tom Collins",
    family: "highball",
    method: "shake",
    glass: "collins",
    garnish: "Lemon slice, cherry",
    instructions: "Shake gin, lemon, and syrup with ice. Strain into Collins glass over ice and top with soda.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "gin_london_dry", amountMl: 45, amountDisplay: "1.5 oz", position: 1 },
      { ingredientId: "lemon_juice", amountMl: 30, amountDisplay: "1 oz", position: 2 },
      { ingredientId: "simple_syrup", amountMl: 15, amountDisplay: "0.5 oz", position: 3 },
      { ingredientId: "soda_water", amountMl: 90, amountDisplay: "top", position: 4 }
    ]
  },
  // --- OLD FASHIONED FAMILY ---
  {
    id: "old_fashioned",
    name: "Old Fashioned",
    family: "old_fashioned",
    method: "stir",
    glass: "rocks",
    garnish: "Orange twist",
    instructions: "Stir sugar, bitters, and a splash of water until dissolved. Add bourbon and a large ice cube. Stir to chill and dilute. Express orange twist over the glass.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "bourbon", amountMl: 60, amountDisplay: "2 oz", position: 1 },
      { ingredientId: "sugar_cube", amountDisplay: "1 cube", position: 2 },
      { ingredientId: "angostura_bitters", amountDisplay: "2 dashes", position: 3 },
      { ingredientId: "water", amountMl: 5, amountDisplay: "splash", position: 4 }
    ]
  },
  {
    id: "sazerac",
    name: "Sazerac",
    family: "old_fashioned",
    method: "stir",
    glass: "rocks",
    garnish: "Lemon peel",
    instructions: "Rinse a chilled rocks glass with absinthe and discard. Stir rye, sugar, and bitters with ice. Strain into the absinthe-rinsed glass. Express lemon peel over.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "rye", amountMl: 60, amountDisplay: "2 oz", position: 1 },
      { ingredientId: "absinthe", amountMl: 5, amountDisplay: "rinse", position: 2 },
      { ingredientId: "sugar_cube", amountDisplay: "1 cube", position: 3 },
      { ingredientId: "peychauds_bitters", amountDisplay: "3 dashes", position: 4 }
    ]
  },
  // --- MARTINI FAMILY ---
  {
    id: "dry_martini",
    name: "Dry Martini",
    family: "martini",
    method: "stir",
    glass: "martini",
    garnish: "Olive or lemon twist",
    instructions: "Stir gin and dry vermouth over ice until very cold. Strain into a chilled martini glass.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "gin_london_dry", amountMl: 60, amountDisplay: "2 oz", position: 1 },
      { ingredientId: "vermouth_dry", amountMl: 10, amountDisplay: "0.25 oz", position: 2 },
      { ingredientId: "orange_bitters", amountDisplay: "1 dash", optional: true, position: 3 }
    ]
  },
  {
    id: "manhattan",
    name: "Manhattan",
    family: "martini",
    method: "stir",
    glass: "coupe",
    garnish: "Cherry",
    instructions: "Stir all ingredients with ice. Strain into a chilled coupe.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "rye", amountMl: 60, amountDisplay: "2 oz", position: 1 },
      { ingredientId: "vermouth_sweet", amountMl: 22, amountDisplay: "0.75 oz", position: 2 },
      { ingredientId: "angostura_bitters", amountDisplay: "2 dashes", position: 3 }
    ]
  },
  {
    id: "negroni",
    name: "Negroni",
    family: "martini",
    method: "stir",
    glass: "rocks",
    garnish: "Orange twist",
    instructions: "Stir all three ingredients with ice; strain over a large ice cube in a rocks glass.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "gin_london_dry", amountMl: 30, amountDisplay: "1 oz", position: 1 },
      { ingredientId: "campari", amountMl: 30, amountDisplay: "1 oz", position: 2 },
      { ingredientId: "vermouth_sweet", amountMl: 30, amountDisplay: "1 oz", position: 3 }
    ]
  },
  {
    id: "boulevardier",
    name: "Boulevardier",
    family: "martini",
    method: "stir",
    glass: "rocks",
    garnish: "Orange twist",
    instructions: "Stir with ice; strain over a large rock.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "bourbon", amountMl: 45, amountDisplay: "1.5 oz", position: 1 },
      { ingredientId: "campari", amountMl: 30, amountDisplay: "1 oz", position: 2 },
      { ingredientId: "vermouth_sweet", amountMl: 30, amountDisplay: "1 oz", position: 3 }
    ]
  },
  {
    id: "rob_roy",
    name: "Rob Roy",
    family: "martini",
    method: "stir",
    glass: "coupe",
    garnish: "Cherry",
    instructions: "Stir all ingredients with ice. Strain into a chilled coupe.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "scotch", amountMl: 60, amountDisplay: "2 oz", position: 1 },
      { ingredientId: "vermouth_sweet", amountMl: 22, amountDisplay: "0.75 oz", position: 2 },
      { ingredientId: "angostura_bitters", amountDisplay: "2 dashes", position: 3 }
    ]
  },
  {
    id: "vesper",
    name: "Vesper",
    family: "martini",
    method: "shake",
    glass: "martini",
    garnish: "Lemon twist",
    instructions: 'Shake well over ice and strain into a chilled glass. "Shaken, not stirred."',
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "gin_london_dry", amountMl: 60, amountDisplay: "2 oz", position: 1 },
      { ingredientId: "vodka", amountMl: 15, amountDisplay: "0.5 oz", position: 2 },
      { ingredientId: "lillet_blanc", amountMl: 7, amountDisplay: "0.25 oz", position: 3 }
    ]
  },
  {
    id: "martinez",
    name: "Martinez",
    family: "martini",
    method: "stir",
    glass: "coupe",
    garnish: "Lemon twist",
    instructions: "Stir all ingredients with ice. Strain into a chilled coupe.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "gin_old_tom", amountMl: 45, amountDisplay: "1.5 oz", position: 1 },
      { ingredientId: "vermouth_sweet", amountMl: 45, amountDisplay: "1.5 oz", position: 2 },
      { ingredientId: "maraschino", amountMl: 5, amountDisplay: "1 tsp", position: 3 },
      { ingredientId: "orange_bitters", amountDisplay: "2 dashes", position: 4 }
    ]
  },
  // --- SPRITZ ---
  {
    id: "aperol_spritz",
    name: "Aperol Spritz",
    family: "spritz",
    method: "build",
    glass: "wine",
    garnish: "Orange slice",
    instructions: "Fill a large wine glass with ice. Add prosecco first, then Aperol, then a splash of soda. Stir gently.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "prosecco", amountMl: 90, amountDisplay: "3 oz", position: 1 },
      { ingredientId: "aperol", amountMl: 60, amountDisplay: "2 oz", position: 2 },
      { ingredientId: "soda_water", amountMl: 30, amountDisplay: "splash", position: 3 }
    ]
  },
  {
    id: "campari_spritz",
    name: "Campari Spritz",
    family: "spritz",
    method: "build",
    glass: "wine",
    garnish: "Orange slice",
    instructions: "Build in a wine glass with ice.",
    source: "iba",
    ibaOfficial: false,
    ingredients: [
      { ingredientId: "prosecco", amountMl: 90, amountDisplay: "3 oz", position: 1 },
      { ingredientId: "campari", amountMl: 60, amountDisplay: "2 oz", position: 2 },
      { ingredientId: "soda_water", amountMl: 30, amountDisplay: "splash", position: 3 }
    ]
  },
  {
    id: "americano",
    name: "Americano",
    family: "highball",
    method: "build",
    glass: "highball",
    garnish: "Orange slice",
    instructions: "Build in a highball over ice; top with soda.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "campari", amountMl: 30, amountDisplay: "1 oz", position: 1 },
      { ingredientId: "vermouth_sweet", amountMl: 30, amountDisplay: "1 oz", position: 2 },
      { ingredientId: "soda_water", amountMl: 90, amountDisplay: "top", position: 3 }
    ]
  },
  // --- FIZZ FAMILY ---
  {
    id: "gin_fizz",
    name: "Gin Fizz",
    family: "fizz",
    method: "shake",
    glass: "highball",
    garnish: "Lemon slice",
    instructions: "Shake gin, lemon, and syrup hard with ice. Strain into a highball with ice. Top with soda.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "gin_london_dry", amountMl: 45, amountDisplay: "1.5 oz", position: 1 },
      { ingredientId: "lemon_juice", amountMl: 30, amountDisplay: "1 oz", position: 2 },
      { ingredientId: "simple_syrup", amountMl: 15, amountDisplay: "0.5 oz", position: 3 },
      { ingredientId: "soda_water", amountMl: 60, amountDisplay: "top", position: 4 }
    ]
  },
  {
    id: "silver_fizz",
    name: "Silver Fizz",
    family: "fizz",
    method: "shake",
    glass: "highball",
    garnish: "Lemon slice",
    instructions: "Dry shake with egg white, then wet shake with ice. Strain into a highball and top with soda.",
    source: "iba",
    ibaOfficial: false,
    ingredients: [
      { ingredientId: "gin_london_dry", amountMl: 45, amountDisplay: "1.5 oz", position: 1 },
      { ingredientId: "lemon_juice", amountMl: 30, amountDisplay: "1 oz", position: 2 },
      { ingredientId: "simple_syrup", amountMl: 15, amountDisplay: "0.5 oz", position: 3 },
      { ingredientId: "egg_white", amountDisplay: "1 egg white", position: 4 },
      { ingredientId: "soda_water", amountMl: 60, amountDisplay: "top", position: 5 }
    ]
  },
  {
    id: "french_75",
    name: "French 75",
    family: "fizz",
    method: "shake",
    glass: "flute",
    garnish: "Lemon twist",
    instructions: "Shake gin, lemon, and syrup with ice; strain into a flute and top with champagne.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "gin_london_dry", amountMl: 30, amountDisplay: "1 oz", position: 1 },
      { ingredientId: "lemon_juice", amountMl: 15, amountDisplay: "0.5 oz", position: 2 },
      { ingredientId: "simple_syrup", amountMl: 7, amountDisplay: "0.25 oz", position: 3 },
      { ingredientId: "champagne", amountMl: 60, amountDisplay: "top", position: 4 }
    ]
  },
  // --- JULEP ---
  {
    id: "mint_julep",
    name: "Mint Julep",
    family: "julep",
    method: "build",
    glass: "julep",
    garnish: "Mint sprig (slap)",
    instructions: "Muddle mint gently with syrup in a metal julep cup. Add bourbon and pack with crushed ice. Swizzle until cup frosts.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "bourbon", amountMl: 60, amountDisplay: "2 oz", position: 1 },
      { ingredientId: "simple_syrup", amountMl: 10, amountDisplay: "1 tsp", position: 2 },
      { ingredientId: "mint_leaves", amountDisplay: "8 leaves", position: 3 }
    ]
  },
  // --- FLIP ---
  {
    id: "brandy_flip",
    name: "Brandy Flip",
    family: "flip",
    method: "shake",
    glass: "coupe",
    garnish: "Freshly grated nutmeg",
    instructions: "Dry shake to emulsify egg, then wet shake with ice. Strain into a chilled coupe.",
    source: "iba",
    ibaOfficial: false,
    ingredients: [
      { ingredientId: "brandy", amountMl: 60, amountDisplay: "2 oz", position: 1 },
      { ingredientId: "simple_syrup", amountMl: 10, amountDisplay: "1 tsp", position: 2 },
      { ingredientId: "whole_egg", amountDisplay: "1 whole egg", position: 3 }
    ]
  },
  // --- TIKI / SOUR-ADJACENT ---
  {
    id: "mai_tai",
    name: "Mai Tai",
    family: "sour",
    method: "shake",
    glass: "rocks",
    garnish: "Mint sprig, lime shell",
    instructions: "Shake all ingredients with crushed ice. Pour unstrained into a rocks glass. Garnish heavily.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "rum_gold", amountMl: 30, amountDisplay: "1 oz", position: 1 },
      { ingredientId: "rum_dark", amountMl: 30, amountDisplay: "1 oz", position: 2 },
      { ingredientId: "cointreau", amountMl: 15, amountDisplay: "0.5 oz", position: 3 },
      { ingredientId: "lime_juice", amountMl: 22, amountDisplay: "0.75 oz", position: 4 },
      { ingredientId: "orgeat", amountMl: 15, amountDisplay: "0.5 oz", position: 5 }
    ]
  },
  {
    id: "pisco_sour",
    name: "Pisco Sour",
    family: "sour",
    method: "shake",
    glass: "coupe",
    garnish: "Angostura drops on foam",
    instructions: "Dry shake pisco, lemon, syrup, and egg white. Wet shake with ice. Strain. Dot foam with angostura.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "pisco", amountMl: 60, amountDisplay: "2 oz", position: 1 },
      { ingredientId: "lemon_juice", amountMl: 30, amountDisplay: "1 oz", position: 2 },
      { ingredientId: "simple_syrup", amountMl: 15, amountDisplay: "0.5 oz", position: 3 },
      { ingredientId: "egg_white", amountDisplay: "1 egg white", position: 4 },
      { ingredientId: "angostura_bitters", amountDisplay: "3 drops", position: 5 }
    ]
  },
  {
    id: "bloody_mary",
    name: "Bloody Mary",
    family: "highball",
    method: "build",
    glass: "highball",
    garnish: "Celery stalk, lemon wedge",
    instructions: "Roll between two tins (or gently stir) over ice. Strain into a highball with fresh ice.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "vodka", amountMl: 45, amountDisplay: "1.5 oz", position: 1 },
      { ingredientId: "tomato_juice", amountMl: 90, amountDisplay: "3 oz", position: 2 },
      { ingredientId: "lemon_juice", amountMl: 15, amountDisplay: "0.5 oz", position: 3 },
      { ingredientId: "salt", amountDisplay: "pinch", position: 4 }
    ]
  },
  {
    id: "corpse_reviver_2",
    name: "Corpse Reviver #2",
    family: "sour",
    method: "shake",
    glass: "coupe",
    garnish: "Orange twist",
    instructions: "Rinse a coupe with absinthe. Shake remaining ingredients with ice and strain in.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "gin_london_dry", amountMl: 22, amountDisplay: "0.75 oz", position: 1 },
      { ingredientId: "cointreau", amountMl: 22, amountDisplay: "0.75 oz", position: 2 },
      { ingredientId: "lillet_blanc", amountMl: 22, amountDisplay: "0.75 oz", position: 3 },
      { ingredientId: "lemon_juice", amountMl: 22, amountDisplay: "0.75 oz", position: 4 },
      { ingredientId: "absinthe", amountMl: 2, amountDisplay: "rinse", position: 5 }
    ]
  },
  {
    id: "last_word",
    name: "Last Word",
    family: "sour",
    method: "shake",
    glass: "coupe",
    garnish: "Cherry",
    instructions: "Shake equal parts with ice. Strain into a chilled coupe.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "gin_london_dry", amountMl: 22, amountDisplay: "0.75 oz", position: 1 },
      { ingredientId: "chartreuse_green", amountMl: 22, amountDisplay: "0.75 oz", position: 2 },
      { ingredientId: "maraschino", amountMl: 22, amountDisplay: "0.75 oz", position: 3 },
      { ingredientId: "lime_juice", amountMl: 22, amountDisplay: "0.75 oz", position: 4 }
    ]
  },
  {
    id: "espresso_martini",
    name: "Espresso Martini",
    family: "sour",
    method: "shake",
    glass: "coupe",
    garnish: "Three coffee beans",
    instructions: "Shake all ingredients hard with ice until foamy. Double strain into a chilled coupe.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "vodka", amountMl: 45, amountDisplay: "1.5 oz", position: 1 },
      { ingredientId: "kahlua", amountMl: 15, amountDisplay: "0.5 oz", position: 2 },
      { ingredientId: "simple_syrup", amountMl: 10, amountDisplay: "1 tsp", position: 3 },
      { ingredientId: "water", amountMl: 30, amountDisplay: "1 oz fresh espresso", position: 4 }
    ]
  },
  {
    id: "white_lady",
    name: "White Lady",
    family: "sour",
    method: "shake",
    glass: "coupe",
    garnish: "Lemon twist",
    instructions: "Shake gin, Cointreau, and lemon with ice. Double strain into a chilled coupe.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "gin_london_dry", amountMl: 40, amountDisplay: "1.5 oz", position: 1 },
      { ingredientId: "cointreau", amountMl: 30, amountDisplay: "1 oz", position: 2 },
      { ingredientId: "lemon_juice", amountMl: 20, amountDisplay: "0.75 oz", position: 3 }
    ]
  },
  {
    id: "hemingway_daiquiri",
    name: "Hemingway Daiquiri",
    family: "sour",
    method: "shake",
    glass: "coupe",
    garnish: "Lime wheel",
    instructions: "Shake well with ice, double strain into a chilled coupe.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "rum_white", amountMl: 60, amountDisplay: "2 oz", position: 1 },
      { ingredientId: "maraschino", amountMl: 7, amountDisplay: "0.25 oz", position: 2 },
      { ingredientId: "grapefruit_juice", amountMl: 15, amountDisplay: "0.5 oz", position: 3 },
      { ingredientId: "lime_juice", amountMl: 15, amountDisplay: "0.5 oz", position: 4 }
    ]
  },
  {
    id: "black_russian",
    name: "Black Russian",
    family: "old_fashioned",
    method: "build",
    glass: "rocks",
    garnish: "None",
    instructions: "Build over ice in a rocks glass. Stir.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "vodka", amountMl: 50, amountDisplay: "1.75 oz", position: 1 },
      { ingredientId: "kahlua", amountMl: 20, amountDisplay: "0.75 oz", position: 2 }
    ]
  },
  {
    id: "white_russian",
    name: "White Russian",
    family: "old_fashioned",
    method: "build",
    glass: "rocks",
    garnish: "None",
    instructions: "Build vodka and Kahl\xFAa over ice. Float cream on top.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "vodka", amountMl: 50, amountDisplay: "1.75 oz", position: 1 },
      { ingredientId: "kahlua", amountMl: 20, amountDisplay: "0.75 oz", position: 2 },
      { ingredientId: "cream", amountMl: 30, amountDisplay: "1 oz", position: 3 }
    ]
  },
  {
    id: "grasshopper",
    name: "Grasshopper",
    family: "flip",
    method: "shake",
    glass: "coupe",
    garnish: "None",
    instructions: "Shake all ingredients with ice; double strain into a chilled coupe.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "creme_de_menthe_green", amountMl: 30, amountDisplay: "1 oz", position: 1 },
      { ingredientId: "creme_de_cacao_white", amountMl: 30, amountDisplay: "1 oz", position: 2 },
      { ingredientId: "cream", amountMl: 30, amountDisplay: "1 oz", position: 3 }
    ]
  },
  {
    id: "alexander",
    name: "Alexander",
    family: "flip",
    method: "shake",
    glass: "coupe",
    garnish: "Grated nutmeg",
    instructions: "Shake all ingredients with ice; double strain into a chilled coupe.",
    source: "iba",
    ibaOfficial: true,
    ingredients: [
      { ingredientId: "cognac", amountMl: 30, amountDisplay: "1 oz", position: 1 },
      { ingredientId: "creme_de_cacao_dark", amountMl: 30, amountDisplay: "1 oz", position: 2 },
      { ingredientId: "cream", amountMl: 30, amountDisplay: "1 oz", position: 3 }
    ]
  }
];
export {
  RECIPES
};
