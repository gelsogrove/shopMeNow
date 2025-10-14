/**
 * Product Data - Altro Gusto Catalog
 * Exported for use in seed script
 * 
 * Italian product names with English descriptions (as per requirements)
 */

export interface ProductData {
  name: string
  ProductCode?: string
  description: string
  formato: string
  price: number
  stock: number
  status: string
  slug: string
  categoryName: string
  currentCharge?: number
  newTotal?: number
  createdAt?: Date
  previousTotal?: number
}

export const products: ProductData[] = [
  // PASTA CATEGORY
  {
    name: "Spaghetti di Gragnano IGP",
    ProductCode: "PASTA001",
    description:
      "Traditional bronze-drawn spaghetti from Gragnano, featuring a rough texture that holds sauce perfectly. Made with 100% Italian durum wheat semolina and mountain spring water.",
    formato: "500g",
    price: 3.5,
    stock: 100,
    status: "ACTIVE",
    slug: "spaghetti-gragnano-igp",
    categoryName: "Pasta",
  },
  {
    name: "Penne Rigate",
    ProductCode: "PASTA002",
    description:
      "Classic ridged penne pasta with a firm al dente texture. The diagonal cut and ridges make it ideal for capturing chunky sauces and ragù.",
    formato: "500g",
    price: 2.8,
    stock: 150,
    status: "ACTIVE",
    slug: "penne-rigate",
    categoryName: "Pasta",
  },
  {
    name: "Fusilli Lunghi",
    ProductCode: "PASTA003",
    description:
      "Long spiral pasta that wraps around creamy sauces beautifully. A Southern Italian specialty perfect for pesto and seafood dishes.",
    formato: "500g",
    price: 3.2,
    stock: 80,
    status: "ACTIVE",
    slug: "fusilli-lunghi",
    categoryName: "Pasta",
  },
  {
    name: "Orecchiette Pugliesi",
    ProductCode: "PASTA004",
    description:
      "Small ear-shaped pasta from Puglia, traditionally served with cime di rapa. The concave shape holds vegetables and sauce in every bite.",
    formato: "500g",
    price: 3.8,
    stock: 60,
    status: "ACTIVE",
    slug: "orecchiette-pugliesi",
    categoryName: "Pasta",
  },
  {
    name: "Paccheri Napoletani",
    ProductCode: "PASTA005",
    description:
      "Large tube pasta from Naples, perfect for stuffing or serving with thick, hearty sauces. Traditional partner for seafood ragù.",
    formato: "500g",
    price: 4.2,
    stock: 70,
    status: "ACTIVE",
    slug: "paccheri-napoletani",
    categoryName: "Pasta",
  },

  // SALUMI CATEGORY
  {
    name: "Prosciutto di Parma DOP",
    ProductCode: "SALUMI001",
    description:
      "18-month aged Parma ham with sweet, delicate flavor. Hand-sliced to order, revealing marbled pink meat with a buttery texture. Protected Designation of Origin certified.",
    formato: "100g",
    price: 8.5,
    stock: 40,
    status: "ACTIVE",
    slug: "prosciutto-parma-dop",
    categoryName: "Salumi",
  },
  {
    name: "Salame Milano",
    ProductCode: "SALUMI002",
    description:
      "Classic Milanese salami with fine grain and subtle garlic notes. Made from select pork cuts, aged to perfection with a delicate, refined taste.",
    formato: "200g",
    price: 6.8,
    stock: 50,
    status: "ACTIVE",
    slug: "salame-milano",
    categoryName: "Salumi",
  },
  {
    name: "Mortadella Bologna IGP",
    ProductCode: "SALUMI003",
    description:
      "Authentic Bologna mortadella with pistachios, featuring a smooth texture and aromatic spice blend. A cornerstone of Italian charcuterie boards.",
    formato: "200g",
    price: 5.5,
    stock: 45,
    status: "ACTIVE",
    slug: "mortadella-bologna-igp",
    categoryName: "Salumi",
  },
  {
    name: "Speck Alto Adige IGP",
    ProductCode: "SALUMI004",
    description:
      "Smoked cured ham from Alto Adige with juniper and mountain herbs. Lightly smoked for a distinctive alpine flavor, sliced paper-thin.",
    formato: "100g",
    price: 7.2,
    stock: 35,
    status: "ACTIVE",
    slug: "speck-alto-adige-igp",
    categoryName: "Salumi",
  },
  {
    name: "Bresaola della Valtellina IGP",
    ProductCode: "SALUMI005",
    description:
      "Air-dried beef from Valtellina, lean and intensely flavored. Aged in mountain air for 2-3 months, resulting in a deep burgundy color and delicate taste.",
    formato: "80g",
    price: 9.5,
    stock: 30,
    status: "ACTIVE",
    slug: "bresaola-valtellina-igp",
    categoryName: "Salumi",
  },
  {
    name: "Coppa di Parma",
    ProductCode: "SALUMI006",
    description:
      "Cured pork shoulder collar with marbled fat, sweet and slightly spicy. Aged for 90 days, offering a melt-in-mouth texture.",
    formato: "100g",
    price: 7.8,
    stock: 38,
    status: "ACTIVE",
    slug: "coppa-parma",
    categoryName: "Salumi",
  },

  // FORMAGGI CATEGORY
  {
    name: "Parmigiano Reggiano DOP 24 mesi",
    ProductCode: "FORMAG001",
    description:
      "24-month aged Parmigiano Reggiano with crystalline texture and complex nutty flavor. Made from raw cow's milk in traditional copper vats.",
    formato: "250g",
    price: 8.9,
    stock: 60,
    status: "ACTIVE",
    slug: "parmigiano-reggiano-24-mesi",
    categoryName: "Formaggi",
  },
  {
    name: "Gorgonzola Dolce DOP",
    ProductCode: "FORMAG002",
    description:
      "Creamy sweet gorgonzola with delicate blue veining. Soft and spreadable, perfect for risotto or paired with honey and walnuts.",
    formato: "200g",
    price: 6.5,
    stock: 40,
    status: "ACTIVE",
    slug: "gorgonzola-dolce-dop",
    categoryName: "Formaggi",
  },
  {
    name: "Mozzarella di Bufala Campana DOP",
    ProductCode: "FORMAG003",
    description:
      "Fresh buffalo milk mozzarella from Campania, porcelain-white with a creamy interior. Milky-sweet flavor with a slight tang.",
    formato: "250g",
    price: 7.8,
    stock: 35,
    status: "ACTIVE",
    slug: "mozzarella-bufala-campana-dop",
    categoryName: "Formaggi",
  },
  {
    name: "Pecorino Romano DOP",
    ProductCode: "FORMAG004",
    description:
      "Hard sheep's milk cheese aged 8 months, sharp and salty. Essential for authentic Cacio e Pepe and Carbonara, grated fresh to order.",
    formato: "200g",
    price: 6.2,
    stock: 55,
    status: "ACTIVE",
    slug: "pecorino-romano-dop",
    categoryName: "Formaggi",
  },
  {
    name: "Taleggio DOP",
    ProductCode: "FORMAG005",
    description:
      "Soft-washed rind cheese from Lombardy with a fruity, tangy flavor. Creamy interior becomes runny when ripe, perfect for melting.",
    formato: "200g",
    price: 7.5,
    stock: 30,
    status: "ACTIVE",
    slug: "taleggio-dop",
    categoryName: "Formaggi",
  },
  {
    name: "Burrata Pugliese",
    ProductCode: "FORMAG006",
    description:
      "Fresh cow's milk cheese with a solid mozzarella exterior and creamy stracciatella center. Best enjoyed within 48 hours of production.",
    formato: "200g",
    price: 8.2,
    stock: 25,
    status: "ACTIVE",
    slug: "burrata-pugliese",
    categoryName: "Formaggi",
  },
  {
    name: "Provolone Piccante",
    ProductCode: "FORMAG007",
    description:
      "Aged sharp provolone with a firm texture and bold flavor. Ideal for grating over pasta or enjoying with crusty bread and wine.",
    formato: "300g",
    price: 6.8,
    stock: 45,
    status: "ACTIVE",
    slug: "provolone-piccante",
    categoryName: "Formaggi",
  },

  // CONDIMENTI CATEGORY
  {
    name: "Olio Extravergine di Oliva Toscano IGP",
    ProductCode: "COND001",
    description:
      "Extra virgin olive oil from Tuscan hills with peppery finish and fruity notes. Cold-pressed from Frantoio and Leccino olives, ideal for finishing dishes.",
    formato: "500ml",
    price: 14.5,
    stock: 50,
    status: "ACTIVE",
    slug: "olio-evo-toscano-igp",
    categoryName: "Condimenti",
  },
  {
    name: "Aceto Balsamico di Modena IGP",
    ProductCode: "COND002",
    description:
      "Aged balsamic vinegar from Modena with sweet-tart complexity. Perfect for dressings, marinades, or drizzled over strawberries and gelato.",
    formato: "250ml",
    price: 9.8,
    stock: 40,
    status: "ACTIVE",
    slug: "aceto-balsamico-modena-igp",
    categoryName: "Condimenti",
  },
  {
    name: "Pesto Genovese DOP",
    ProductCode: "COND003",
    description:
      "Traditional Genoese pesto with PDO Ligurian basil, pine nuts, Parmigiano, and Ligurian olive oil. Fresh, vibrant flavor for pasta and bruschetta.",
    formato: "180g",
    price: 6.5,
    stock: 60,
    status: "ACTIVE",
    slug: "pesto-genovese-dop",
    categoryName: "Condimenti",
  },
  {
    name: "Passata di Pomodoro San Marzano DOP",
    ProductCode: "COND004",
    description:
      "Premium tomato passata made from San Marzano tomatoes grown in volcanic soil. Sweet, low-acid, perfect base for authentic Neapolitan pizza sauce.",
    formato: "700g",
    price: 4.8,
    stock: 80,
    status: "ACTIVE",
    slug: "passata-pomodoro-san-marzano-dop",
    categoryName: "Condimenti",
  },
  {
    name: "Tartufo Nero Estivo",
    ProductCode: "COND005",
    description:
      "Summer black truffle slices preserved in olive oil. Earthy, aromatic, ideal for elevating pasta, risotto, and egg dishes.",
    formato: "80g",
    price: 18.5,
    stock: 20,
    status: "ACTIVE",
    slug: "tartufo-nero-estivo",
    categoryName: "Condimenti",
  },
  {
    name: "Crema di Pistacchio di Bronte",
    ProductCode: "COND006",
    description:
      "Pure pistachio cream from Bronte, Sicily, made with DOP pistachios. Rich, intense flavor perfect for spreading on bread or swirling into gelato.",
    formato: "200g",
    price: 11.5,
    stock: 35,
    status: "ACTIVE",
    slug: "crema-pistacchio-bronte",
    categoryName: "Condimenti",
  },

  // DOLCI CATEGORY
  {
    name: "Panettone Classico",
    ProductCode: "DOLCI001",
    description:
      "Traditional Milanese Christmas cake with candied fruits and raisins. Naturally leavened for 72 hours, resulting in a light, fluffy texture.",
    formato: "1kg",
    price: 22.0,
    stock: 25,
    status: "ACTIVE",
    slug: "panettone-classico",
    categoryName: "Dolci",
  },
  {
    name: "Amaretti di Saronno",
    ProductCode: "DOLCI002",
    description:
      "Classic almond amaretti cookies from Saronno, crisp exterior with a soft, chewy center. Made with sweet and bitter almonds for depth of flavor.",
    formato: "250g",
    price: 6.8,
    stock: 50,
    status: "ACTIVE",
    slug: "amaretti-saronno",
    categoryName: "Dolci",
  },
  {
    name: "Cantuccini Toscani",
    ProductCode: "DOLCI003",
    description:
      "Tuscan almond biscotti, twice-baked for a satisfying crunch. Traditionally dunked in Vin Santo, perfect with espresso or dessert wine.",
    formato: "300g",
    price: 7.5,
    stock: 40,
    status: "ACTIVE",
    slug: "cantuccini-toscani",
    categoryName: "Dolci",
  },
  {
    name: "Torrone di Cremona IGP",
    ProductCode: "DOLCI004",
    description:
      "Traditional nougat from Cremona with honey, egg whites, and toasted almonds. Chewy texture with a delicate sweetness, a Christmas staple.",
    formato: "200g",
    price: 8.9,
    stock: 30,
    status: "ACTIVE",
    slug: "torrone-cremona-igp",
    categoryName: "Dolci",
  },
  {
    name: "Pandoro Veronese",
    ProductCode: "DOLCI005",
    description:
      "Star-shaped Christmas cake from Verona with a golden, buttery crumb. Dusted with vanilla-scented powdered sugar, lighter than panettone.",
    formato: "750g",
    price: 18.5,
    stock: 28,
    status: "ACTIVE",
    slug: "pandoro-veronese",
    categoryName: "Dolci",
  },

  // BEVANDE CATEGORY
  {
    name: "Limoncello di Sorrento IGP",
    ProductCode: "BEV001",
    description:
      "Traditional lemon liqueur from Sorrento peninsula, made with Femminello Sorrentino lemons. Bright, zesty, served ice-cold as a digestivo.",
    formato: "500ml",
    price: 16.5,
    stock: 35,
    status: "ACTIVE",
    slug: "limoncello-sorrento-igp",
    categoryName: "Bevande",
  },
  {
    name: "Chianti Classico DOCG",
    ProductCode: "BEV002",
    description:
      "Classic Tuscan red wine with Sangiovese grapes, featuring cherry and violet notes. Medium-bodied with balanced tannins, pairs beautifully with pasta and grilled meats.",
    formato: "750ml",
    price: 14.8,
    stock: 40,
    status: "ACTIVE",
    slug: "chianti-classico-docg",
    categoryName: "Bevande",
  },
  {
    name: "Prosecco Valdobbiadene DOCG",
    ProductCode: "BEV003",
    description:
      "Premium sparkling wine from Veneto hills with delicate bubbles and floral aroma. Crisp, refreshing, perfect for aperitivo or celebrations.",
    formato: "750ml",
    price: 12.5,
    stock: 45,
    status: "ACTIVE",
    slug: "prosecco-valdobbiadene-docg",
    categoryName: "Bevande",
  },
  {
    name: "Caffè Espresso Napoletano",
    ProductCode: "BEV004",
    description:
      "Neapolitan espresso blend with full body and rich crema. Dark roasted for intense flavor, perfect for moka pot or espresso machine.",
    formato: "250g",
    price: 7.8,
    stock: 60,
    status: "ACTIVE",
    slug: "caffe-espresso-napoletano",
    categoryName: "Bevande",
  },
  {
    name: "Amaretto di Saronno",
    ProductCode: "BEV005",
    description:
      "Iconic almond liqueur from Saronno with sweet, marzipan-like flavor. Versatile for cocktails, desserts, or sipping neat after dinner.",
    formato: "700ml",
    price: 19.5,
    stock: 25,
    status: "ACTIVE",
    slug: "amaretto-saronno",
    categoryName: "Bevande",
  },

  // SPECIALITÀ CATEGORY
  {
    name: "Nduja Calabrese",
    ProductCode: "SPEC001",
    description:
      "Spicy spreadable salami from Calabria with Calabrian chili peppers. Intense heat and deep pork flavor, perfect for pasta, pizza, or bruschetta.",
    formato: "180g",
    price: 8.5,
    stock: 30,
    status: "ACTIVE",
    slug: "nduja-calabrese",
    categoryName: "Specialità",
  },
  {
    name: "Colatura di Alici di Cetara",
    ProductCode: "SPEC002",
    description:
      "Ancient anchovy essence from Cetara, aged in chestnut barrels. Umami-rich, use sparingly to add depth to pasta, vegetables, and sauces.",
    formato: "100ml",
    price: 12.8,
    stock: 20,
    status: "ACTIVE",
    slug: "colatura-alici-cetara",
    categoryName: "Specialità",
  },
  {
    name: "Bottarga di Muggine Sarda",
    ProductCode: "SPEC003",
    description:
      "Cured mullet roe from Sardinia, hand-salted and sun-dried. Grated over pasta or shaved on salads for a briny, oceanic flavor.",
    formato: "80g",
    price: 24.5,
    stock: 15,
    status: "ACTIVE",
    slug: "bottarga-muggine-sarda",
    categoryName: "Specialità",
  },
  {
    name: "Miele di Acacia Italiano",
    ProductCode: "SPEC004",
    description:
      "Delicate acacia honey with a light, floral sweetness. Crystal-clear and slow to crystallize, ideal for tea, cheese pairings, and baking.",
    formato: "400g",
    price: 9.5,
    stock: 35,
    status: "ACTIVE",
    slug: "miele-acacia-italiano",
    categoryName: "Specialità",
  },
  {
    name: "Farro Perlato dell'Umbria",
    ProductCode: "SPEC005",
    description:
      "Pearled Umbrian spelt, an ancient grain with nutty flavor and chewy texture. Perfect for soups, salads, and as a risotto alternative.",
    formato: "500g",
    price: 5.8,
    stock: 45,
    status: "ACTIVE",
    slug: "farro-perlato-umbria",
    categoryName: "Specialità",
  },

  // SOTTOLIO E CONSERVE CATEGORY
  {
    name: "Carciofi Sottolio",
    ProductCode: "SOTT001",
    description:
      "Baby artichokes preserved in extra virgin olive oil with herbs. Tender, flavorful, ready to serve on antipasti platters or with cheese.",
    formato: "280g",
    price: 6.8,
    stock: 40,
    status: "ACTIVE",
    slug: "carciofi-sottolio",
    categoryName: "Sottolio e Conserve",
  },
  {
    name: "Pomodori Secchi Sottolio",
    ProductCode: "SOTT002",
    description:
      "Sun-dried tomatoes in olive oil with garlic and oregano. Intensely sweet and umami-rich, perfect for pasta, focaccia, and sandwiches.",
    formato: "280g",
    price: 5.9,
    stock: 50,
    status: "ACTIVE",
    slug: "pomodori-secchi-sottolio",
    categoryName: "Sottolio e Conserve",
  },
  {
    name: "Olive Taggiasche",
    ProductCode: "SOTT003",
    description:
      "Small Ligurian olives with delicate, fruity flavor. Marinated in Ligurian olive oil, ideal for salads, pizzas, or enjoyed as a snack.",
    formato: "300g",
    price: 7.2,
    stock: 45,
    status: "ACTIVE",
    slug: "olive-taggiasche",
    categoryName: "Sottolio e Conserve",
  },
  {
    name: "Peperoni Arrostiti",
    ProductCode: "SOTT004",
    description:
      "Flame-roasted bell peppers peeled and preserved in olive oil. Sweet, smoky, perfect for bruschetta, panini, or as a colorful side.",
    formato: "280g",
    price: 6.5,
    stock: 38,
    status: "ACTIVE",
    slug: "peperoni-arrostiti",
    categoryName: "Sottolio e Conserve",
  },
  {
    name: "Funghi Porcini Sottolio",
    ProductCode: "SOTT005",
    description:
      "Sliced porcini mushrooms preserved in olive oil with parsley and garlic. Earthy, meaty texture, ready to toss with pasta or risotto.",
    formato: "280g",
    price: 9.8,
    stock: 30,
    status: "ACTIVE",
    slug: "funghi-porcini-sottolio",
    categoryName: "Sottolio e Conserve",
  },
  {
    name: "Giardiniera all'Aceto",
    ProductCode: "SOTT006",
    description:
      "Mixed pickled vegetables with cauliflower, carrots, peppers, and onions. Crunchy and tangy, a classic Italian table condiment.",
    formato: "280g",
    price: 5.5,
    stock: 42,
    status: "ACTIVE",
    slug: "giardiniera-aceto",
    categoryName: "Sottolio e Conserve",
  },
]
