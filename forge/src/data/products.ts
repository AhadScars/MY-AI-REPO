export const CATEGORIES = ['men', 'women', 'accessories', 'supplements', 'equipment'] as const
export type Category = (typeof CATEGORIES)[number]

export const GOALS = ['muscle', 'fat', 'strength', 'performance', 'recovery'] as const
export type Goal = (typeof GOALS)[number]

export type Badge = 'sale' | 'new' | 'drop' | 'bestseller'

export type ColorOption = { name: string; hex: string }

export type Review = {
  id: string
  name: string
  avatar: string
  rating: number
  title: string
  body: string
  date: string
  verified: boolean
}

export type Product = {
  id: string
  slug: string
  name: string
  category: Category
  gender: 'men' | 'women' | 'unisex'
  price: number
  compareAt?: number
  rating: number
  reviewCount: number
  colors: ColorOption[]
  sizes: string[]
  images: string[]
  hoverImage?: string
  badge?: Badge
  stock: number
  description: string
  specs: Record<string, string>
  goals: Goal[]
  trending?: boolean
  featured?: boolean
  reviews: Review[]
}

export const FREE_SHIPPING = 2499
export const CURRENCY = 'INR'

export const formatPrice = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)

const apparelSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const oneSize = ['ONE']
const equipSizes = ['STD']

const reviewPool: Review[] = [
  {
    id: 'r1',
    name: 'Arjun Mehta',
    avatar: '/images/portrait-m.jpg',
    rating: 5,
    title: 'Cuts like armour',
    body: 'The compression is locked in without feeling cheap. Survived a 90-minute leg day and still looked sharp after.',
    date: '12 Aug 2026',
    verified: true,
  },
  {
    id: 'r2',
    name: 'Nia Kapoor',
    avatar: '/images/portrait-w.jpg',
    rating: 5,
    title: 'Finally a brand that fits',
    body: 'Sculpt where it should sculpt. No see-through, no roll-down. Wore it for two sessions the day it arrived.',
    date: '4 Aug 2026',
    verified: true,
  },
  {
    id: 'r3',
    name: 'Rohit Sen',
    avatar: '/images/portrait-m.jpg',
    rating: 4,
    title: 'Serious hardware',
    body: 'Heavier than it looks. The finish is matte and expensive. Shipping was next-day in Mumbai.',
    date: '28 Jul 2026',
    verified: true,
  },
  {
    id: 'r4',
    name: 'Sara D’Souza',
    avatar: '/images/portrait-w.jpg',
    rating: 5,
    title: 'Drop quality is real',
    body: 'Limited pieces usually feel like merch. This feels like a training system. Keeping the hoodie forever.',
    date: '19 Jul 2026',
    verified: true,
  },
]

const r = (...ids: string[]) => reviewPool.filter((x) => ids.includes(x.id))

export const products: Product[] = [
  {
    id: 'p01',
    slug: 'apex-compression-tee',
    name: 'Apex Compression Tee',
    category: 'men',
    gender: 'men',
    price: 1899,
    compareAt: 2499,
    rating: 4.8,
    reviewCount: 312,
    colors: [
      { name: 'Obsidian', hex: '#111111' },
      { name: 'Graphite', hex: '#4A4A4A' },
      { name: 'Volt', hex: '#C6FF00' },
    ],
    sizes: apparelSizes,
    images: ['/images/prod-tee.jpg', '/images/cat-men.jpg', '/images/hero.jpg'],
    hoverImage: '/images/cat-men.jpg',
    badge: 'sale',
    stock: 48,
    description:
      'Second-skin compression engineered for heavy compound work. Four-way stretch, bonded seams, and a cool-touch knit that stays locked through the last set.',
    specs: {
      Fabric: '88% nylon / 12% elastane',
      Weight: '210 gsm',
      Fit: 'Athletic compression',
      Care: 'Cold wash, hang dry',
    },
    goals: ['muscle', 'performance', 'strength'],
    trending: true,
    featured: true,
    reviews: r('r1', 'r3'),
  },
  {
    id: 'p02',
    slug: 'volt-performance-hoodie',
    name: 'Volt Performance Hoodie',
    category: 'men',
    gender: 'men',
    price: 4499,
    rating: 4.9,
    reviewCount: 186,
    colors: [
      { name: 'Shadow', hex: '#161616' },
      { name: 'Steel', hex: '#6B6B6B' },
    ],
    sizes: apparelSizes,
    images: ['/images/prod-hoodie.jpg', '/images/drop-hoodie.jpg', '/images/cat-men.jpg'],
    hoverImage: '/images/drop-hoodie.jpg',
    badge: 'bestseller',
    stock: 32,
    description:
      'A heavyweight training hoodie with articulated sleeves and a bonded hood. Warm enough for 5am sessions, clean enough for the street.',
    specs: {
      Fabric: 'Brushed French terry',
      Weight: '420 gsm',
      Fit: 'Relaxed athletic',
      Care: 'Machine wash cold',
    },
    goals: ['recovery', 'performance'],
    trending: true,
    featured: true,
    reviews: r('r4', 'r1'),
  },
  {
    id: 'p03',
    slug: 'iron-cut-tank',
    name: 'Iron Cut Tank',
    category: 'men',
    gender: 'men',
    price: 1499,
    rating: 4.7,
    reviewCount: 98,
    colors: [
      { name: 'Black', hex: '#0A0A0A' },
      { name: 'Ash', hex: '#8A8A8A' },
    ],
    sizes: apparelSizes,
    images: ['/images/prod-tank.jpg', '/images/goal-muscle.jpg', '/images/cat-men.jpg'],
    hoverImage: '/images/goal-muscle.jpg',
    badge: 'new',
    stock: 64,
    description:
      'Dropped armholes, raw-cut hem, zero distraction. Built for the days you want to see the work happening.',
    specs: {
      Fabric: 'Cotton-modal blend',
      Weight: '180 gsm',
      Fit: 'Relaxed drop-arm',
      Care: 'Cold wash',
    },
    goals: ['muscle', 'strength'],
    trending: true,
    reviews: r('r1'),
  },
  {
    id: 'p04',
    slug: 'kinetic-training-shorts',
    name: 'Kinetic Training Shorts',
    category: 'men',
    gender: 'men',
    price: 1799,
    rating: 4.6,
    reviewCount: 221,
    colors: [
      { name: 'Black', hex: '#111111' },
      { name: 'Olive', hex: '#3D4A32' },
      { name: 'Volt', hex: '#C6FF00' },
    ],
    sizes: apparelSizes,
    images: ['/images/prod-shorts.jpg', '/images/cat-men.jpg', '/images/hero.jpg'],
    hoverImage: '/images/hero.jpg',
    stock: 55,
    description:
      '7-inch inseam, laser-cut vents, and a hidden phone pocket that stays silent on sprints. Built for mixed-modal training.',
    specs: {
      Fabric: 'Recycled stretch ripstop',
      Inseam: '7 inch',
      Fit: 'Tapered athletic',
      Care: 'Machine wash',
    },
    goals: ['performance', 'fat', 'strength'],
    trending: true,
    reviews: r('r3', 'r1'),
  },
  {
    id: 'p05',
    slug: 'strike-training-jacket',
    name: 'Strike Training Jacket',
    category: 'men',
    gender: 'men',
    price: 4999,
    rating: 4.8,
    reviewCount: 74,
    colors: [
      { name: 'Carbon', hex: '#1A1A1A' },
      { name: 'Storm', hex: '#2C3340' },
    ],
    sizes: apparelSizes,
    images: ['/images/prod-jacket.jpg', '/images/cat-men.jpg', '/images/goal-performance.jpg'],
    hoverImage: '/images/goal-performance.jpg',
    badge: 'new',
    stock: 22,
    description:
      'Wind-blocking shell with stretch panels at the scapula. The piece you throw on between sets and never take off after.',
    specs: {
      Fabric: 'Softshell + stretch knit',
      Weight: '310 gsm',
      Fit: 'Tailored athletic',
      Care: 'Gentle cycle',
    },
    goals: ['performance', 'fat'],
    featured: true,
    reviews: r('r1', 'r4'),
  },
  {
    id: 'p06',
    slug: 'forge-training-joggers',
    name: 'Forge Training Joggers',
    category: 'men',
    gender: 'men',
    price: 2999,
    rating: 4.7,
    reviewCount: 143,
    colors: [
      { name: 'Black', hex: '#0D0D0D' },
      { name: 'Charcoal', hex: '#3A3A3A' },
    ],
    sizes: apparelSizes,
    images: ['/images/prod-joggers.jpg', '/images/cat-men.jpg', '/images/goal-recovery.jpg'],
    hoverImage: '/images/goal-recovery.jpg',
    stock: 40,
    description:
      'Tapered joggers with articulated knees and a hidden zip pocket. Warm-up, lift, leave — one pair.',
    specs: {
      Fabric: 'Tech fleece',
      Weight: '360 gsm',
      Fit: 'Tapered',
      Care: 'Cold wash',
    },
    goals: ['recovery', 'muscle'],
    reviews: r('r3'),
  },
  {
    id: 'p07',
    slug: 'flux-support-bra',
    name: 'Flux Support Bra',
    category: 'women',
    gender: 'women',
    price: 1699,
    rating: 4.9,
    reviewCount: 268,
    colors: [
      { name: 'Obsidian', hex: '#111111' },
      { name: 'Bone', hex: '#D9D4C8' },
      { name: 'Volt', hex: '#C6FF00' },
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    images: ['/images/prod-bra.jpg', '/images/cat-women.jpg', '/images/goal-fat.jpg'],
    hoverImage: '/images/cat-women.jpg',
    badge: 'bestseller',
    stock: 51,
    description:
      'Medium-high support with a bonded underband and cut-out back. Built for lifting days that turn into conditioning.',
    specs: {
      Fabric: 'Power mesh + compressive knit',
      Support: 'Medium-high',
      Fit: 'Locked underband',
      Care: 'Cold wash, no tumble',
    },
    goals: ['performance', 'strength', 'fat'],
    trending: true,
    featured: true,
    reviews: r('r2', 'r4'),
  },
  {
    id: 'p08',
    slug: 'apex-sculpt-leggings',
    name: 'Apex Sculpt Leggings',
    category: 'women',
    gender: 'women',
    price: 2499,
    compareAt: 2999,
    rating: 4.9,
    reviewCount: 540,
    colors: [
      { name: 'Black', hex: '#0A0A0A' },
      { name: 'Graphite', hex: '#4A4A4A' },
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    images: ['/images/prod-leggings.jpg', '/images/cat-women.jpg', '/images/goal-fat.jpg'],
    hoverImage: '/images/cat-women.jpg',
    badge: 'sale',
    stock: 38,
    description:
      'High-rise sculpt with a stay-put waist and squat-proof density. The pair athletes actually re-order.',
    specs: {
      Fabric: '260 gsm sculpt knit',
      Rise: 'High',
      Fit: 'Sculpt compression',
      Care: 'Cold wash',
    },
    goals: ['fat', 'performance', 'muscle'],
    trending: true,
    featured: true,
    reviews: r('r2'),
  },
  {
    id: 'p09',
    slug: 'ember-crop-hoodie',
    name: 'Ember Crop Hoodie',
    category: 'women',
    gender: 'women',
    price: 3299,
    rating: 4.8,
    reviewCount: 91,
    colors: [
      { name: 'Charcoal', hex: '#2A2A2A' },
      { name: 'Black', hex: '#111111' },
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    images: ['/images/prod-crop.jpg', '/images/cat-women.jpg', '/images/goal-recovery.jpg'],
    hoverImage: '/images/cat-women.jpg',
    badge: 'new',
    stock: 27,
    description:
      'Cropped, heavy, and clean. A studio-to-street layer with dropped shoulders and a raw hem.',
    specs: {
      Fabric: 'Brushed fleece',
      Weight: '400 gsm',
      Fit: 'Relaxed crop',
      Care: 'Machine wash cold',
    },
    goals: ['recovery', 'performance'],
    trending: true,
    reviews: r('r2', 'r4'),
  },
  {
    id: 'p10',
    slug: 'pulse-training-shorts-w',
    name: 'Pulse Training Shorts',
    category: 'women',
    gender: 'women',
    price: 1599,
    rating: 4.6,
    reviewCount: 77,
    colors: [
      { name: 'Black', hex: '#111111' },
      { name: 'Volt', hex: '#C6FF00' },
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    images: ['/images/prod-shorts.jpg', '/images/cat-women.jpg', '/images/goal-performance.jpg'],
    hoverImage: '/images/goal-performance.jpg',
    stock: 44,
    description:
      'Split hem, compressive liner, and a waistband that does not fold. Built for intervals and lifting.',
    specs: {
      Fabric: 'Power stretch',
      Inseam: '4 inch',
      Fit: 'Athletic',
      Care: 'Cold wash',
    },
    goals: ['performance', 'fat'],
    reviews: r('r2'),
  },
  {
    id: 'p11',
    slug: 'kinetic-training-tank-w',
    name: 'Kinetic Training Tank',
    category: 'women',
    gender: 'women',
    price: 1399,
    rating: 4.7,
    reviewCount: 64,
    colors: [
      { name: 'Black', hex: '#0A0A0A' },
      { name: 'Bone', hex: '#D9D4C8' },
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    images: ['/images/prod-tank.jpg', '/images/cat-women.jpg', '/images/goal-strength.jpg'],
    hoverImage: '/images/cat-women.jpg',
    stock: 58,
    description:
      'Racerback tank with a longer hem and a dry-touch knit. Layers over the Flux bra without bulk.',
    specs: {
      Fabric: 'Dry-touch jersey',
      Weight: '160 gsm',
      Fit: 'Relaxed',
      Care: 'Cold wash',
    },
    goals: ['strength', 'performance'],
    reviews: r('r2'),
  },
  {
    id: 'p12',
    slug: 'forge-studio-joggers',
    name: 'Forge Studio Joggers',
    category: 'women',
    gender: 'women',
    price: 2799,
    rating: 4.8,
    reviewCount: 88,
    colors: [
      { name: 'Black', hex: '#0D0D0D' },
      { name: 'Ash', hex: '#6A6A6A' },
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    images: ['/images/prod-joggers.jpg', '/images/cat-women.jpg', '/images/goal-recovery.jpg'],
    hoverImage: '/images/goal-recovery.jpg',
    stock: 33,
    description:
      'Soft-structure joggers with a sculpted hip and a tapered ankle. Warm-up uniform, off-day uniform.',
    specs: {
      Fabric: 'Brushed tech fleece',
      Fit: 'Tapered high-rise',
      Care: 'Cold wash',
    },
    goals: ['recovery'],
    reviews: r('r4'),
  },
  {
    id: 'p13',
    slug: 'iron-grip-gloves',
    name: 'Iron Grip Gloves',
    category: 'accessories',
    gender: 'unisex',
    price: 1299,
    rating: 4.5,
    reviewCount: 154,
    colors: [
      { name: 'Black', hex: '#111111' },
      { name: 'Lime stitch', hex: '#C6FF00' },
    ],
    sizes: ['S', 'M', 'L', 'XL'],
    images: ['/images/prod-gloves.jpg', '/images/cat-accessories.jpg', '/images/goal-strength.jpg'],
    hoverImage: '/images/cat-accessories.jpg',
    stock: 80,
    description:
      'Thin-profile lifting gloves with reinforced palm and ventilated back. Enough protection, zero bulk.',
    specs: {
      Material: 'Synthetic leather + mesh',
      Closure: 'Hook-and-loop',
      Care: 'Air dry',
    },
    goals: ['strength', 'muscle'],
    trending: true,
    reviews: r('r3'),
  },
  {
    id: 'p14',
    slug: 'forge-duffle-40',
    name: 'Forge Duffle 40L',
    category: 'accessories',
    gender: 'unisex',
    price: 3499,
    rating: 4.8,
    reviewCount: 67,
    colors: [{ name: 'Black', hex: '#111111' }],
    sizes: oneSize,
    images: ['/images/prod-duffle.jpg', '/images/cat-accessories.jpg', '/images/community.jpg'],
    hoverImage: '/images/cat-accessories.jpg',
    badge: 'bestseller',
    stock: 19,
    description:
      'Structured 40L duffle with a shoe vault, wet pocket, and a strap that does not chew your shoulder.',
    specs: {
      Volume: '40 litres',
      Material: 'Ballistic nylon',
      Features: 'Shoe vault, wet pocket',
    },
    goals: ['performance'],
    featured: true,
    reviews: r('r4', 'r3'),
  },
  {
    id: 'p15',
    slug: 'steel-shaker-700',
    name: 'Steel Shaker 700ml',
    category: 'accessories',
    gender: 'unisex',
    price: 899,
    rating: 4.6,
    reviewCount: 210,
    colors: [
      { name: 'Steel', hex: '#8A8A8A' },
      { name: 'Black', hex: '#111111' },
    ],
    sizes: oneSize,
    images: ['/images/prod-shaker.jpg', '/images/cat-supplements.jpg', '/images/cat-accessories.jpg'],
    hoverImage: '/images/cat-supplements.jpg',
    stock: 120,
    description:
      'Double-wall stainless shaker. No plastic aftertaste, no leaking into the duffle, no excuses.',
    specs: {
      Capacity: '700 ml',
      Material: 'Stainless steel',
      Insulation: 'Double wall',
    },
    goals: ['muscle', 'recovery'],
    trending: true,
    reviews: r('r1'),
  },
  {
    id: 'p16',
    slug: 'wrist-wrap-pair',
    name: 'Wrist Wrap Pair',
    category: 'accessories',
    gender: 'unisex',
    price: 799,
    rating: 4.7,
    reviewCount: 132,
    colors: [
      { name: 'Black', hex: '#111111' },
      { name: 'Volt', hex: '#C6FF00' },
    ],
    sizes: oneSize,
    images: ['/images/cat-accessories.jpg', '/images/prod-gloves.jpg', '/images/goal-strength.jpg'],
    hoverImage: '/images/goal-strength.jpg',
    stock: 90,
    description:
      'Stiff enough for a heavy press, flexible enough to stay on between sets. Thumb loop, clean finish.',
    specs: {
      Length: '50 cm',
      Material: 'Elastic cotton blend',
      Use: 'Pressing / Olympic',
    },
    goals: ['strength', 'muscle'],
    reviews: r('r3'),
  },
  {
    id: 'p17',
    slug: 'resistance-band-set',
    name: 'Resistance Band Set',
    category: 'accessories',
    gender: 'unisex',
    price: 1199,
    rating: 4.5,
    reviewCount: 88,
    colors: [{ name: 'Mixed', hex: '#C6FF00' }],
    sizes: oneSize,
    images: ['/images/cat-accessories.jpg', '/images/cat-equipment.jpg', '/images/goal-fat.jpg'],
    hoverImage: '/images/goal-fat.jpg',
    stock: 70,
    description:
      'Five progressive loops in a compact pouch. Warm-up, accessory work, travel sessions.',
    specs: {
      Levels: '5',
      Material: 'Natural latex',
      Includes: 'Carry pouch',
    },
    goals: ['fat', 'recovery', 'performance'],
    reviews: r('r2'),
  },
  {
    id: 'p18',
    slug: 'lifting-belt',
    name: 'Forge Lifting Belt',
    category: 'accessories',
    gender: 'unisex',
    price: 1999,
    rating: 4.8,
    reviewCount: 59,
    colors: [{ name: 'Black', hex: '#111111' }],
    sizes: ['S', 'M', 'L', 'XL'],
    images: ['/images/cat-accessories.jpg', '/images/goal-strength.jpg', '/images/hero.jpg'],
    hoverImage: '/images/goal-strength.jpg',
    stock: 28,
    description:
      '10mm lever-feel support in a tapered everyday belt. Brace harder. Stay honest.',
    specs: {
      Thickness: '10 mm',
      Material: 'Split leather + steel',
      Width: '10 cm rear / tapered front',
    },
    goals: ['strength', 'muscle'],
    reviews: r('r3', 'r1'),
  },
  {
    id: 'p19',
    slug: 'isolate-whey-2kg',
    name: 'Isolate Whey 2kg',
    category: 'supplements',
    gender: 'unisex',
    price: 4499,
    compareAt: 5199,
    rating: 4.8,
    reviewCount: 402,
    colors: [{ name: 'Vanilla Steel', hex: '#D9D4C8' }],
    sizes: oneSize,
    images: ['/images/prod-whey.jpg', '/images/cat-supplements.jpg', '/images/prod-shaker.jpg'],
    hoverImage: '/images/cat-supplements.jpg',
    badge: 'sale',
    stock: 46,
    description:
      'Grass-fed isolate. 27g protein, low lactose, mixes clean. The post-session standard.',
    specs: {
      Protein: '27g / serve',
      Servings: '60',
      Flavour: 'Vanilla Steel',
      Origin: 'Grass-fed isolate',
    },
    goals: ['muscle', 'recovery', 'strength'],
    trending: true,
    featured: true,
    reviews: r('r1', 'r3'),
  },
  {
    id: 'p20',
    slug: 'ignite-pre-workout',
    name: 'Ignite Pre-Workout',
    category: 'supplements',
    gender: 'unisex',
    price: 2299,
    rating: 4.6,
    reviewCount: 176,
    colors: [{ name: 'Citrus Volt', hex: '#C6FF00' }],
    sizes: oneSize,
    images: ['/images/cat-supplements.jpg', '/images/prod-whey.jpg', '/images/goal-performance.jpg'],
    hoverImage: '/images/goal-performance.jpg',
    badge: 'bestseller',
    stock: 61,
    description:
      'Clinical caffeine, citrulline, and no crash cocktail. Sharp focus for the first bar and the last sprint.',
    specs: {
      Caffeine: '200 mg',
      Citrulline: '6 g',
      Servings: '30',
    },
    goals: ['performance', 'fat', 'strength'],
    trending: true,
    reviews: r('r1', 'r4'),
  },
  {
    id: 'p21',
    slug: 'pure-creatine-300',
    name: 'Pure Creatine 300g',
    category: 'supplements',
    gender: 'unisex',
    price: 1299,
    rating: 4.9,
    reviewCount: 298,
    colors: [{ name: 'Unflavoured', hex: '#E8E8E8' }],
    sizes: oneSize,
    images: ['/images/prod-whey.jpg', '/images/cat-supplements.jpg', '/images/goal-muscle.jpg'],
    hoverImage: '/images/goal-muscle.jpg',
    stock: 88,
    description:
      'Micronised monohydrate. No blends, no candy flavour, no marketing. Five grams. Every day.',
    specs: {
      Type: 'Creapure-grade monohydrate',
      Serve: '5 g',
      Servings: '60',
    },
    goals: ['muscle', 'strength', 'performance'],
    trending: true,
    reviews: r('r3'),
  },
  {
    id: 'p22',
    slug: 'recover-bcaa',
    name: 'Recover BCAA',
    category: 'supplements',
    gender: 'unisex',
    price: 1899,
    rating: 4.4,
    reviewCount: 71,
    colors: [{ name: 'Blood Orange', hex: '#FF4D00' }],
    sizes: oneSize,
    images: ['/images/cat-supplements.jpg', '/images/prod-whey.jpg', '/images/goal-recovery.jpg'],
    hoverImage: '/images/goal-recovery.jpg',
    stock: 54,
    description:
      'Intra-session aminos with electrolytes. Keep the pump, keep the pace, skip the crash.',
    specs: {
      Ratio: '2:1:1',
      Electrolytes: 'Sodium + potassium',
      Servings: '30',
    },
    goals: ['recovery', 'performance'],
    reviews: r('r2'),
  },
  {
    id: 'p23',
    slug: 'mass-protocol',
    name: 'Mass Protocol',
    category: 'supplements',
    gender: 'unisex',
    price: 3999,
    rating: 4.5,
    reviewCount: 49,
    colors: [{ name: 'Cocoa Iron', hex: '#3A2A22' }],
    sizes: oneSize,
    images: ['/images/prod-whey.jpg', '/images/cat-supplements.jpg', '/images/goal-muscle.jpg'],
    hoverImage: '/images/goal-muscle.jpg',
    stock: 24,
    description:
      'Dense calories without the sludge. Built for hardgainers who actually train.',
    specs: {
      Calories: '520 / serve',
      Protein: '32 g',
      Servings: '16',
    },
    goals: ['muscle'],
    reviews: r('r1'),
  },
  {
    id: 'p24',
    slug: 'adjustable-dumbbells-24',
    name: 'Adjustable Dumbbells 24kg',
    category: 'equipment',
    gender: 'unisex',
    price: 12999,
    rating: 4.8,
    reviewCount: 41,
    colors: [{ name: 'Matte Black', hex: '#111111' }],
    sizes: equipSizes,
    images: ['/images/prod-dumbbells.jpg', '/images/cat-equipment.jpg', '/images/goal-strength.jpg'],
    hoverImage: '/images/cat-equipment.jpg',
    badge: 'bestseller',
    stock: 12,
    description:
      'Pair of 24kg adjustables with a locked-click selector. Apartment gym that does not look like a toy.',
    specs: {
      Range: '2.5–24 kg each',
      Plates: 'Steel, rubber-coated',
      Includes: 'Pair + tray',
    },
    goals: ['muscle', 'strength'],
    featured: true,
    reviews: r('r3'),
  },
  {
    id: 'p25',
    slug: 'speed-rope-pro',
    name: 'Speed Rope Pro',
    category: 'equipment',
    gender: 'unisex',
    price: 999,
    rating: 4.6,
    reviewCount: 118,
    colors: [
      { name: 'Black', hex: '#111111' },
      { name: 'Volt', hex: '#C6FF00' },
    ],
    sizes: oneSize,
    images: ['/images/cat-equipment.jpg', '/images/goal-performance.jpg', '/images/goal-fat.jpg'],
    hoverImage: '/images/goal-performance.jpg',
    stock: 76,
    description:
      'CNC handles, coated cable, and a bearing that does not die in week two. Conditioning, uncompromised.',
    specs: {
      Cable: '2.5 mm coated steel',
      Handles: 'CNC aluminium',
      Adjustable: 'Yes',
    },
    goals: ['fat', 'performance'],
    trending: true,
    reviews: r('r2', 'r1'),
  },
  {
    id: 'p26',
    slug: 'forge-training-mat',
    name: 'Forge Training Mat',
    category: 'equipment',
    gender: 'unisex',
    price: 1899,
    rating: 4.7,
    reviewCount: 83,
    colors: [{ name: 'Charcoal', hex: '#2A2A2A' }],
    sizes: oneSize,
    images: ['/images/cat-equipment.jpg', '/images/goal-recovery.jpg', '/images/prod-dumbbells.jpg'],
    hoverImage: '/images/goal-recovery.jpg',
    stock: 35,
    description:
      '8mm closed-cell mat with a grip face that stays put on concrete. Floor work, stretching, loaded carries.',
    specs: {
      Thickness: '8 mm',
      Size: '183 × 61 cm',
      Material: 'Closed-cell TPE',
    },
    goals: ['recovery', 'strength'],
    reviews: r('r2'),
  },
  {
    id: 'p27',
    slug: 'recovery-foam-roller',
    name: 'Recovery Foam Roller',
    category: 'equipment',
    gender: 'unisex',
    price: 1299,
    rating: 4.6,
    reviewCount: 96,
    colors: [{ name: 'Black', hex: '#111111' }],
    sizes: oneSize,
    images: ['/images/goal-recovery.jpg', '/images/cat-equipment.jpg', '/images/community.jpg'],
    hoverImage: '/images/cat-equipment.jpg',
    stock: 42,
    description:
      'High-density roller with a grid that actually reaches tissue. The boring tool that keeps you training.',
    specs: {
      Length: '45 cm',
      Density: 'High',
      Material: 'EVA + ABS core',
    },
    goals: ['recovery'],
    reviews: r('r4'),
  },
  {
    id: 'p28',
    slug: 'shadow-volt-hoodie',
    name: 'Shadow Volt Hoodie',
    category: 'men',
    gender: 'men',
    price: 5999,
    compareAt: 7499,
    rating: 5,
    reviewCount: 28,
    colors: [{ name: 'Shadow Volt', hex: '#C6FF00' }],
    sizes: apparelSizes,
    images: ['/images/drop-hoodie.jpg', '/images/prod-hoodie.jpg', '/images/cat-men.jpg'],
    hoverImage: '/images/prod-hoodie.jpg',
    badge: 'drop',
    stock: 18,
    description:
      'Limited drop. Heavyweight fleece, metallic volt graphic, numbered hangtag. When it is gone, it is gone.',
    specs: {
      Fabric: '420 gsm fleece',
      Edition: 'Limited — 500 units',
      Fit: 'Oversized athletic',
      Care: 'Cold wash inside-out',
    },
    goals: ['performance'],
    featured: true,
    trending: true,
    reviews: r('r4', 'r1'),
  },
]

export const categoryMeta: Record<
  Category,
  { label: string; blurb: string; image: string; href: string }
> = {
  men: {
    label: 'Men',
    blurb: 'Compression, layers, and pieces built for heavy days.',
    image: '/images/cat-men.jpg',
    href: '/shop/men',
  },
  women: {
    label: 'Women',
    blurb: 'Sculpt, support, and studio-to-street kit.',
    image: '/images/cat-women.jpg',
    href: '/shop/women',
  },
  accessories: {
    label: 'Accessories',
    blurb: 'The small tools that keep the session honest.',
    image: '/images/cat-accessories.jpg',
    href: '/shop/accessories',
  },
  supplements: {
    label: 'Supplements',
    blurb: 'Fuel, focus, and recovery — no candy science.',
    image: '/images/cat-supplements.jpg',
    href: '/shop/supplements',
  },
  equipment: {
    label: 'Equipment',
    blurb: 'Hardware that looks as serious as it lifts.',
    image: '/images/cat-equipment.jpg',
    href: '/shop/equipment',
  },
}

export const goalMeta: Record<
  Goal,
  { label: string; kicker: string; copy: string; image: string }
> = {
  muscle: {
    label: 'Build Muscle',
    kicker: 'Hypertrophy',
    copy: 'Progressive overload kit — compression that stays locked, isolate that actually mixes, iron that lives in your apartment.',
    image: '/images/goal-muscle.jpg',
  },
  fat: {
    label: 'Lose Fat',
    kicker: 'Conditioning',
    copy: 'Pieces that move when you move. Breathable layers, ropes, bands, and a pre-workout that does not lie to you.',
    image: '/images/goal-fat.jpg',
  },
  strength: {
    label: 'Improve Strength',
    kicker: 'Max effort',
    copy: 'Belts, wraps, dense fabrics, and creatine. The boring stack that moves numbers.',
    image: '/images/goal-strength.jpg',
  },
  performance: {
    label: 'Performance',
    kicker: 'Output',
    copy: 'Engineered for mixed sessions. Fast-dry knits, ignition formulas, and hardware that survives daily use.',
    image: '/images/goal-performance.jpg',
  },
  recovery: {
    label: 'Recovery',
    kicker: 'Stay in the fight',
    copy: 'Fleece, rollers, aminos, and the kit you live in on the day after.',
    image: '/images/goal-recovery.jpg',
  },
}

export const faqs = [
  {
    q: 'How long does shipping take?',
    a: 'Metro cities: 2–4 business days. Rest of India: 4–7. Orders over ₹2,499 ship free.',
  },
  {
    q: 'What is your return policy?',
    a: 'Unworn items with tags can be returned within 14 days. Sale and limited drops are final unless defective.',
  },
  {
    q: 'How do I pick a size?',
    a: 'Use the size guide on each product. Compression pieces are designed true-to-size; oversized drops fit roomy.',
  },
  {
    q: 'Are supplements third-party tested?',
    a: 'Yes. Every batch is lab-tested for heavy metals and label accuracy. Certificates are available on request.',
  },
]

export const testimonials = [
  {
    id: 't1',
    name: 'Kabir Rao',
    role: 'Powerlifter · Mumbai',
    quote:
      'Most “performance” brands fall apart after a cycle. FORGE still looks new after a meet prep. The belt and wraps are the real deal.',
    image: '/images/portrait-m.jpg',
    stat: '+32kg total',
  },
  {
    id: 't2',
    name: 'Meera Iyer',
    role: 'Hyrox athlete · Bengaluru',
    quote:
      'The sculpt leggings and Flux bra survived 12 weeks of running plus lifting. Zero roll, zero see-through, zero drama.',
    image: '/images/portrait-w.jpg',
    stat: '12-week block',
  },
  {
    id: 't3',
    name: 'Dev Patel',
    role: 'Coach · Delhi',
    quote:
      'I put my athletes in the Apex tee and Ignite. The quality is consistent. Clients notice. That is rare.',
    image: '/images/community.jpg',
    stat: '40+ athletes',
  },
]

export const communityPosts = [
  { id: 'c1', image: '/images/community.jpg', handle: '@forge.club', caption: 'Sunday crew. No extras.' },
  { id: 'c2', image: '/images/goal-muscle.jpg', handle: '@kabir.lifts', caption: 'Heavy. Honest.' },
  { id: 'c3', image: '/images/goal-fat.jpg', handle: '@meera.runs', caption: 'Ropes then miles.' },
  { id: 'c4', image: '/images/goal-performance.jpg', handle: '@volt.days', caption: 'Track work.' },
  { id: 'c5', image: '/images/cat-women.jpg', handle: '@studio.nia', caption: 'Locked in.' },
  { id: 'c6', image: '/images/hero.jpg', handle: '@iron.hours', caption: 'Last pull.' },
]

export function getProduct(slug: string) {
  return products.find((p) => p.slug === slug)
}

export function getProductById(id: string) {
  return products.find((p) => p.id === id)
}

export function relatedProducts(product: Product, limit = 4) {
  return products
    .filter((p) => p.id !== product.id && (p.category === product.category || p.goals.some((g) => product.goals.includes(g))))
    .slice(0, limit)
}

export function filterProducts(opts: {
  category?: string
  goal?: string
  q?: string
  min?: number
  max?: number
  color?: string
  size?: string
  rating?: number
  inStock?: boolean
  sale?: boolean
  sort?: string
}) {
  let list = [...products]
  if (opts.category === 'new') list = list.filter((p) => p.badge === 'new' || p.badge === 'drop')
  else if (opts.category === 'sale') list = list.filter((p) => p.badge === 'sale' || (p.compareAt && p.compareAt > p.price))
  else if (opts.category && CATEGORIES.includes(opts.category as Category))
    list = list.filter((p) => p.category === opts.category)
  if (opts.goal) list = list.filter((p) => p.goals.includes(opts.goal as Goal))
  if (opts.q) {
    const q = opts.q.toLowerCase()
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.includes(q) ||
        p.description.toLowerCase().includes(q),
    )
  }
  if (opts.min != null) list = list.filter((p) => p.price >= opts.min!)
  if (opts.max != null) list = list.filter((p) => p.price <= opts.max!)
  if (opts.color) list = list.filter((p) => p.colors.some((c) => c.name.toLowerCase() === opts.color!.toLowerCase()))
  if (opts.size) list = list.filter((p) => p.sizes.includes(opts.size!))
  if (opts.rating) list = list.filter((p) => p.rating >= opts.rating!)
  if (opts.inStock) list = list.filter((p) => p.stock > 0)
  if (opts.sale) list = list.filter((p) => p.compareAt && p.compareAt > p.price)

  switch (opts.sort) {
    case 'price-asc':
      list.sort((a, b) => a.price - b.price)
      break
    case 'price-desc':
      list.sort((a, b) => b.price - a.price)
      break
    case 'rating':
      list.sort((a, b) => b.rating - a.rating)
      break
    case 'newest':
      list.sort((a, b) => Number(b.badge === 'new' || b.badge === 'drop') - Number(a.badge === 'new' || a.badge === 'drop'))
      break
    default:
      list.sort((a, b) => Number(!!b.trending) - Number(!!a.trending) || b.reviewCount - a.reviewCount)
  }
  return list
}

export const allColors = Array.from(
  new Map(products.flatMap((p) => p.colors).map((c) => [c.name, c])).values(),
)

export const allSizes = Array.from(new Set(products.flatMap((p) => p.sizes)))
