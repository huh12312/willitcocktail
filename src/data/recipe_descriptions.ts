import type { Method, Recipe } from '../types';
import type { DataIndex } from './index';

// One-sentence blurbs for curated recipes. Keyed by recipe id. HF-imported
// recipes fall back to a synthesized description at render time.
export const RECIPE_DESCRIPTIONS: Record<string, string> = {
  daiquiri: 'The three-ingredient Cuban sour — white rum, lime, and sugar — that Hemingway drank by the half-dozen at El Floridita.',
  margarita: 'The canonical tequila sour, soured with lime and sweetened by orange liqueur; salt rim optional but traditional.',
  whiskey_sour: 'A shaken bourbon sour with lemon and sugar, often crowned with egg white for a velvety foam.',
  sidecar: 'A pre-Prohibition Parisian sour of cognac, Cointreau, and lemon — equal parts bright and boozy.',
  gimlet: 'Royal Navy rations in a glass: gin cut with lime cordial to ward off scurvy on long voyages.',
  cosmopolitan: 'The vodka sour that defined the 90s, glossed pink by cranberry and sharpened with a flamed orange peel.',
  sea_breeze: 'A poolside three-ingredient highball — vodka, cranberry, and grapefruit juice — that hit its peak in the 1980s Cancún era.',
  kamikaze: 'A vodka-triple-sec-lime slammer from the mid-century bar scene, served up and dispatched quickly.',
  caipirinha: "Brazil's national cocktail: muddled lime and sugar drowned in funky cachaça, served on crushed ice.",
  gin_tonic: "Colonial anti-malarial turned global highball — botanical gin lengthened with quinine tonic and a lime wedge.",
  moscow_mule: 'Vodka, ginger beer, and lime in the copper mug that launched a thousand Instagram posts.',
  dark_stormy: "Gosling's black rum floating over ginger beer and lime — Bermuda's most protected trademark.",
  paloma: "Mexico's everyday highball: blanco tequila with grapefruit soda, salted rim, and a squeeze of lime.",
  mojito: 'Cuban rum-lime-mint-sugar highball topped with soda — Hemingway drank these at La Bodeguita.',
  cuba_libre: "Rum and cola with a lime squeeze — born in 1900 Havana after the Spanish-American War.",
  tom_collins: 'A tall, frothy gin fizz — gin, lemon, sugar, soda — named after a hoax circulated in 1874 New York.',
  old_fashioned: "The ur-cocktail: bourbon or rye stirred over a sugar cube dashed with bitters; orange peel for perfume.",
  sazerac: "New Orleans' signature sipper — rye or cognac stirred with Peychaud's in an absinthe-rinsed glass.",
  dry_martini: "Cold gin and dry vermouth, stirred, with a twist or an olive — the minimalist's cocktail.",
  manhattan: 'The original whiskey cocktail from the 1880s Manhattan Club: rye, sweet vermouth, two dashes of bitters, cherry.',
  negroni: "Campari, sweet vermouth, gin in equal parts — invented at Caffè Casoni when Count Negroni asked for a stronger Americano.",
  boulevardier: "Whiskey-based Negroni from 1920s Paris — bourbon subs for gin, giving it backbone and caramel warmth.",
  rob_roy: "A Manhattan built on Scotch instead of rye — named for the 1894 operetta at New York's Waldorf.",
  vesper: "Bond's invention in Casino Royale: gin, vodka, and Lillet Blanc, shaken until ice-cold.",
  martinez: "The Martini's sweeter Victorian ancestor — Old Tom gin, sweet vermouth, maraschino, orange bitters.",
  aperol_spritz: "Venetian aperitivo of Aperol, prosecco, and soda — the orange lifeblood of Italian terraces.",
  campari_spritz: "The sharper, redder sibling of the Aperol Spritz — Campari's bitterness lifted by bubbles.",
  americano: "Campari and sweet vermouth lengthened with soda — the Negroni's lighter, pre-gin ancestor.",
  gin_fizz: "Gin, lemon, sugar, and soda, shaken hard and topped — a morning drink in New Orleans' heyday.",
  silver_fizz: "A Gin Fizz enriched with egg white for a creamy head — bartenders' traditional hangover cure.",
  french_75: "Gin, lemon, sugar, and Champagne — packs enough artillery, said its 1915 inventors, to equal the French 75mm field gun.",
  mint_julep: "Kentucky Derby staple — bourbon muddled with mint and sugar, served over a mountain of crushed ice.",
  brandy_flip: "An 18th-century warmer: brandy, whole egg, and sugar, shaken into silk with a grating of nutmeg.",
  mai_tai: "Trader Vic's 1944 tiki masterwork — aged rum, orgeat, orange curaçao, and lime, with a heavy rum float.",
  pisco_sour: "Peru's national cocktail: pisco, lime, syrup, and egg white, dashed with Angostura on the foam.",
  bloody_mary: "The post-prohibition brunch drink — vodka, tomato juice, and a cabinet of savory seasonings.",
  corpse_reviver_2: "A pre-lunch eye-opener of gin, Lillet, triple sec, and lemon, kissed with absinthe — handle with care.",
  last_word: "A forgotten Prohibition-era masterpiece — equal parts gin, green Chartreuse, maraschino, and lime.",
  espresso_martini: "Vodka, Kahlúa, and fresh espresso shaken into a bitter, foamy pick-me-up — invented in 1980s Soho.",
  white_lady: "A gin Sidecar: gin, Cointreau, and lemon — the Savoy's most elegant interwar cocktail.",
  hemingway_daiquiri: "Papa's diabetic-friendly Daiquiri — white rum, grapefruit, maraschino, and lime, no sugar.",
  black_russian: "Vodka and Kahlúa on the rocks — invented in 1949 Brussels for the US ambassador.",
  white_russian: "A Black Russian softened with cream — forever The Dude's drink after The Big Lebowski.",
  grasshopper: "Green Crème de menthe, white Crème de cacao, and cream — a mint-chocolate dessert in a coupe.",
  alexander: "A creamy after-dinner tipple of gin (or brandy), Crème de cacao, and cream, dusted with nutmeg.",
  aviation: "A violet-hued gin sour from 1916 — gin, lemon, maraschino, and Crème de violette for the sky tone.",
  penicillin: "Sam Ross's modern classic: Scotch, honey-ginger syrup, and lemon, floated with smoky Islay.",
  paper_plane: "Sam Ross's equal-parts marvel — bourbon, Aperol, Amaro Nonino, and lemon.",
  jungle_bird: "A 1978 Kuala Lumpur tiki staple — dark rum, Campari, pineapple, lime, and demerara.",
  bramble: "Dick Bradsell's gin sour drizzled with Crème de mûre — a berry-ink bleed over crushed ice.",
  clover_club: "A pre-Prohibition Philadelphia classic — gin, raspberry, lemon, and egg white, shaken silky pink.",
  hanky_panky: "Ada Coleman's gin-sweet-vermouth stirrer, given structure by a splash of Fernet-Branca.",
  bijou: "An 1890s gem — gin, green Chartreuse, and sweet vermouth — named for its three jewel tones.",
  tommys_margarita: "San Francisco's riff on the classic: blanco tequila, lime, and agave — no triple sec required.",
  division_bell: "A mezcal twist on the Last Word — mezcal, Aperol, maraschino, and lime.",
  naked_and_famous: "Joaquín Simó's equal-parts mezcal, Aperol, yellow Chartreuse, and lime — the smoky Last Word.",
  oaxaca_old_fashioned: "Phil Ward's mezcal-reposado tequila Old Fashioned, sweetened with agave and smoked with an orange peel.",
  gold_rush: "A contemporary Whiskey Sour — bourbon, honey syrup, lemon — invented in 2001 at Milk & Honey.",
  bees_knees: "Prohibition-era gin sour with honey and lemon, designed to mask the taste of bathtub gin.",
  mezcal_negroni: "The Negroni's smoky sibling — mezcal in place of gin — equal parts Campari and sweet vermouth.",
  kingston_negroni: "A Jamaican Negroni — Smith & Cross overproof rum instead of gin — funky, boozy, sunbaked.",
  airmail: "A Champagne-topped Daiquiri with a spoonful of honey — 1930s Cuban mail cocktail.",
  trident: "Robert Hess's aquavit Negroni — Cynar, dry sherry, and peach bitters — herbal and briny.",
  toronto: "A Canadian Old Fashioned — rye with Fernet-Branca and sugar — bitter, medicinal, and sophisticated.",
  old_pal: "A drier Boulevardier: rye, Campari, and dry vermouth — sharp, bracing, un-sweet.",
  zombie: "Don the Beachcomber's 1934 three-rum bomb — five types of sugar, lime, grapefruit, and absinthe.",
  hurricane: "Pat O'Brien's New Orleans tiki classic — dark rum, passion fruit, and citrus in a hurricane-lamp glass.",
  painkiller: "The British Virgin Islands' Piña Colada — Pusser's rum, pineapple, orange, and coconut cream.",
  pina_colada: "Puerto Rico's national cocktail — white rum blended with pineapple and coconut cream over crushed ice.",
  saturn: "Popo Galsini's 1967 tiki gin sour with passion fruit, orgeat, falernum, and lemon.",
  fog_cutter: "A three-spirit tiki powerhouse — gin, rum, and brandy — with orgeat, citrus, and a sherry float.",
  brooklyn: "A drier cousin of the Manhattan — rye, dry vermouth, Amer Picon, and maraschino.",
  saratoga: "A split-base Manhattan — rye and cognac stirred with sweet vermouth and bitters.",
  stinger: "Brandy and white Crème de menthe, served neat or over crushed ice — the ultimate digestif.",
  sherry_cobbler: "A 19th-century American favorite — sherry, orange, and sugar shaken over crushed ice, heaped with berries.",
  bamboo: "An 1890s Yokohama stirred cocktail — dry sherry and dry vermouth with a dash of bitters.",
  adonis: "The Bamboo's sweeter sibling — dry sherry and sweet vermouth, orange bitters.",
  negroni_sbagliato: "A 'mistaken' Negroni — prosecco in place of gin — lighter, brighter, suddenly trending thanks to House of the Dragon.",
  garibaldi: "Campari lengthened with slow-juiced orange juice — fluffy, golden, and deceptively simple.",
  southside: "A Prohibition-era gin sour with muddled mint — essentially a Mojito with gin instead of rum.",
  gin_rickey: "A 1880s Washington DC highball — gin, lime, and soda — no sugar, no fuss.",
  dark_n_stormy: "Gosling's dark rum over ginger beer with a lime wedge — Bermuda's trademarked national drink.",
  amaretto_sour: "Amaretto, lemon, and egg white shaken silky — Jeffrey Morgenthaler's modern take rescued it from syrupy obscurity.",
  kentucky_buck: "A bourbon highball built around muddled strawberries, lemon, and ginger beer.",
  gibson: "A Dry Martini with a pickled cocktail onion instead of a twist — briny, savory, and stiff.",
  derby: "Bourbon, sweet vermouth, orange curaçao, and lime — the Kentucky Derby's namesake sipper.",
  scofflaw: "A Prohibition-era rye sour with dry vermouth, grenadine, and lemon — the name a Boston neologism for a lawbreaker.",
  army_and_navy: "A gin sour sweetened with orgeat — almond-rich, lemon-bright, service-academy strong.",
  ward_eight: "A 19th-century Boston rye sour with grenadine and orange juice — named for a winning political ward.",
  frisco: "Rye and Bénédictine with a squeeze of lemon — a pre-Prohibition stirrer.",
  vieux_carre: "The Hotel Monteleone's 1930s New Orleans masterpiece — rye, cognac, sweet vermouth, Bénédictine, and bitters.",
  seelbach: "Louisville's Seelbach Hotel claim to fame — bourbon, Cointreau, a dozen dashes of bitters, and Champagne.",
  revolver: "A modern bourbon Manhattan built on coffee liqueur, with a flamed orange peel.",
  ti_punch: "Martinique's everyday ritual — rhum agricole, cane syrup, and a squeezed lime disc, self-assembled at the table.",
  rome_with_a_view: "A fresher Americano — Campari, maraschino, lime, and soda — invented at Manhattan's Milk & Honey.",
};

const METHOD_ADJ: Record<Method, string> = {
  shake: 'shaken',
  stir: 'stirred',
  build: 'built',
  blend: 'blended',
  throw: 'thrown',
};

function synthesize(recipe: Recipe, data: DataIndex): string {
  const family = recipe.family.replace('_', ' ');
  const method = METHOD_ADJ[recipe.method] ?? recipe.method;
  const top = [...recipe.ingredients]
    .sort((a, b) => (b.amountMl ?? 0) - (a.amountMl ?? 0))
    .slice(0, 3)
    .map((ri) => data.ingredientById.get(ri.ingredientId)?.name)
    .filter((x): x is string => typeof x === 'string');
  if (top.length === 0) return `A ${method} ${family}.`;
  const joined =
    top.length === 1
      ? top[0]
      : `${top.slice(0, -1).join(', ')} and ${top[top.length - 1]}`;
  return `A ${method} ${family} with ${joined}.`;
}

export function describeRecipe(recipe: Recipe, data: DataIndex): string {
  return RECIPE_DESCRIPTIONS[recipe.id] ?? synthesize(recipe, data);
}
