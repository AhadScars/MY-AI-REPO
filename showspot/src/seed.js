const bcrypt = require('bcryptjs');
const db = require('./db');
const { slug } = require('./lib/util');

async function seed() {
  const existing = await db.one('SELECT id FROM users WHERE email = ?', ['admin@showspot.com']);
  if (existing) {
    console.log('Seed skipped — admin@showspot.com already exists.');
    return;
  }

  const adminPass = await bcrypt.hash('Admin@123', 10);
  const orgPass = await bcrypt.hash('Organizer@123', 10);
  const userPass = await bcrypt.hash('User@123', 10);

  const cities = [
    ['Mumbai', 'mumbai', 'Maharashtra'],
    ['Delhi', 'delhi', 'Delhi'],
    ['Bengaluru', 'bengaluru', 'Karnataka'],
    ['Hyderabad', 'hyderabad', 'Telangana'],
    ['Chennai', 'chennai', 'Tamil Nadu'],
    ['Kolkata', 'kolkata', 'West Bengal'],
    ['Pune', 'pune', 'Maharashtra'],
    ['Ahmedabad', 'ahmedabad', 'Gujarat'],
    ['Jaipur', 'jaipur', 'Rajasthan'],
    ['Lucknow', 'lucknow', 'Uttar Pradesh'],
    ['Kanpur', 'kanpur', 'Uttar Pradesh'],
    ['Chandigarh', 'chandigarh', 'Chandigarh'],
    ['Kochi', 'kochi', 'Kerala'],
    ['Indore', 'indore', 'Madhya Pradesh'],
    ['Nagpur', 'nagpur', 'Maharashtra'],
  ];
  for (const [name, citySlug, state] of cities) {
    await db.query('INSERT INTO cities (name, slug, state) VALUES (?, ?, ?)', [name, citySlug, state]);
  }
  const cityRows = await db.query('SELECT * FROM cities');
  const cityId = Object.fromEntries(cityRows.map((c) => [c.slug, c.id]));

  await db.query(
    `INSERT INTO users (name, email, password, phone, role, status, city_id)
     VALUES (?, ?, ?, ?, 'admin', 'active', ?)`,
    ['ShowSpot Admin', 'admin@showspot.com', adminPass, '+91 90000 00001', cityId.kanpur]
  );
  await db.query(
    `INSERT INTO users (name, email, password, phone, role, status, city_id)
     VALUES (?, ?, ?, ?, 'user', 'active', ?)`,
    ['Priya Sharma', 'user@showspot.com', userPass, '+91 91234 56789', cityId.kanpur]
  );

  const theatres = [
    {
      email: 'organizer@showspot.com',
      manager: 'Aetherplex Kanpur',
      city: 'kanpur',
      name: 'Aetherplex Z Square',
      address: 'Z Square Mall, Mall Road, Kanpur',
      amenities: ['Dolby Atmos', 'Recliners', 'Valet', 'F&B'],
      screens: [
        ['Audi 1', 10, 16],
        ['Audi 2', 9, 14],
        ['Gold Lounge', 8, 12],
      ],
      moviePrices: [180, 260, 420],
    },
    {
      email: 'mumbai.theatre@showspot.com',
      manager: 'Lumen Cinema Mumbai',
      city: 'mumbai',
      name: 'Lumen Cinema Lower Parel',
      address: 'High Street Phoenix, Lower Parel, Mumbai',
      amenities: ['IMAX Laser', 'Recliners', 'Parking'],
      screens: [
        ['Screen 1', 10, 16],
        ['IMAX', 11, 18],
      ],
      moviePrices: [250, 380, 550],
    },
    {
      email: 'delhi.theatre@showspot.com',
      manager: 'Northgate Screens Delhi',
      city: 'delhi',
      name: 'Northgate Screens Saket',
      address: 'Select Citywalk, Saket, New Delhi',
      amenities: ['4K Laser', 'Cafe', 'Wheelchair access'],
      screens: [
        ['Audi 1', 10, 14],
        ['Audi 2', 8, 12],
      ],
      moviePrices: [230, 340, 520],
    },
    {
      email: 'bengaluru.theatre@showspot.com',
      manager: 'Orchid Cinemas Bengaluru',
      city: 'bengaluru',
      name: 'Orchid Cinemas Koramangala',
      address: 'Forum Mall, Koramangala, Bengaluru',
      amenities: ['Dolby Atmos', 'Recliners'],
      screens: [
        ['Screen 1', 10, 14],
        ['Screen 2', 9, 12],
      ],
      moviePrices: [220, 330, 499],
    },
    {
      email: 'lucknow.theatre@showspot.com',
      manager: 'Wavefront Lucknow',
      city: 'lucknow',
      name: 'Wavefront Gomti Nagar',
      address: 'Phoenix Palassio, Gomti Nagar, Lucknow',
      amenities: ['Dolby', 'Lounge', 'Parking'],
      screens: [['Hall A', 10, 14]],
      moviePrices: [190, 280, 450],
    },
  ];

  const screenIds = {};
  const venueIds = {};
  const orgIds = {};

  for (const t of theatres) {
    const orgRes = await db.query(
      `INSERT INTO users (name, email, password, phone, role, status, city_id)
       VALUES (?, ?, ?, ?, 'organizer', 'active', ?)`,
      [t.manager, t.email, orgPass, '+91 98000 00000', cityId[t.city]]
    );
    orgIds[t.city] = orgRes.insertId;
    const vSlug = slug(t.name);
    const res = await db.query(
      `INSERT INTO venues (organizer_id, city_id, name, slug, address, amenities, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [orgRes.insertId, cityId[t.city], t.name, vSlug, t.address, JSON.stringify(t.amenities)]
    );
    venueIds[vSlug] = res.insertId;
    screenIds[vSlug] = [];
    for (const [sName, rows, cols] of t.screens) {
      const sRes = await db.query(
        'INSERT INTO screens (venue_id, name, row_count, col_count) VALUES (?, ?, ?, ?)',
        [res.insertId, sName, rows, cols]
      );
      screenIds[vSlug].push(sRes.insertId);
    }
    t.slug = vSlug;
  }

  const adminUser = await db.one('SELECT id FROM users WHERE email = ?', ['admin@showspot.com']);
  const catalogOwner = adminUser.id;

  const shows = [
    {
      type: 'movie',
      title: 'Neon Harbor',
      synopsis:
        'A rain-soaked investigator in a coastal megacity finds a crate that should not exist. The harbour starts hunting her before sunrise.',
      language: 'English',
      genre: 'Sci-Fi, Thriller',
      duration: 128,
      rating: 'UA 16+',
      poster: '/img/posters/neon-harbor.jpg',
      release: '2026-07-04',
    },
    {
      type: 'movie',
      title: 'The Last Monsoon',
      synopsis:
        'When the rains refuse to stop, a schoolteacher rows village to village carrying letters the flood tried to erase.',
      language: 'Hindi',
      genre: 'Drama',
      duration: 141,
      rating: 'U',
      poster: '/img/posters/last-monsoon.jpg',
      release: '2026-06-12',
    },
    {
      type: 'movie',
      title: 'Circuit Breaker',
      synopsis:
        'A Mumbai courier on a black motorcycle has twelve hours to deliver a drive that can shut down an entire skyline.',
      language: 'Hindi, English',
      genre: 'Action',
      duration: 114,
      rating: 'UA 13+',
      poster: '/img/posters/circuit-breaker.jpg',
      release: '2026-08-01',
    },
    {
      type: 'movie',
      title: 'Moonlight Express',
      synopsis:
        'Two strangers share a sleeper cabin on a night train that only runs when the moon is full — Delhi to Varanasi.',
      language: 'Hindi',
      genre: 'Romance',
      duration: 118,
      rating: 'U',
      poster: '/img/posters/moonlight-express.jpg',
      release: '2026-05-22',
    },
    {
      type: 'movie',
      title: 'Paper Crown',
      synopsis:
        'A court scribe forges a crown from paper and a kingdom treats it as gold — until the real heir walks in.',
      language: 'Hindi, English',
      genre: 'Period Drama',
      duration: 152,
      rating: 'UA 13+',
      poster: '/img/posters/paper-crown.jpg',
      release: '2026-03-18',
    },
    {
      type: 'event',
      title: 'Desert Beats Festival',
      synopsis:
        'One night under desert floodlights. Four stages, sand in the bass, and a sunrise set you will talk about for a year.',
      language: 'Hindi, English',
      genre: 'Music Festival',
      duration: 360,
      rating: 'A',
      poster: '/img/posters/desert-beats.jpg',
      release: '2026-09-12',
    },
    {
      type: 'event',
      title: 'Laugh Riot Live',
      synopsis:
        'A rotating lineup of stand-ups, a brick wall, and no sacred cows. Two hours. Hindi and English sets.',
      language: 'Hindi, English',
      genre: 'Comedy',
      duration: 120,
      rating: 'A',
      poster: '/img/posters/laugh-riot.jpg',
      release: '2026-08-28',
    },
    {
      type: 'sports',
      title: 'City Cup Finals',
      synopsis:
        'Kanpur vs Lucknow. Ninety minutes. One trophy. The stands have been sold out in spirit since last season.',
      language: 'Hindi',
      genre: 'Football',
      duration: 120,
      rating: 'U',
      poster: '/img/posters/city-cup.jpg',
      release: '2026-09-05',
    },
    {
      type: 'play',
      title: 'Hamlet Reimagined',
      synopsis:
        'Elsinore recast as a newsroom after midnight in Delhi. The question is still the same. The cameras are new.',
      language: 'English',
      genre: 'Theatre',
      duration: 165,
      rating: 'UA 13+',
      poster: '/img/posters/hamlet.jpg',
      release: '2026-08-15',
    },
    {
      type: 'event',
      title: 'Starlight Symphony',
      synopsis:
        'The city orchestra plays film scores and new commissions under a gold balcony. Dress however the music asks.',
      language: 'Instrumental',
      genre: 'Classical',
      duration: 110,
      rating: 'U',
      poster: '/img/posters/starlight-symphony.jpg',
      release: '2026-09-20',
    },
  ];

  const showIds = {};
  for (const s of shows) {
    const sSlug = slug(s.title);
    const owner = catalogOwner;
    const res = await db.query(
      `INSERT INTO shows
        (organizer_id, type, title, slug, synopsis, language, genre, duration_min, age_rating, poster, release_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')`,
      [owner, s.type, s.title, sSlug, s.synopsis, s.language, s.genre, s.duration, s.rating, s.poster, s.release]
    );
    showIds[sSlug] = res.insertId;
  }

  function showDate(daysFromNow, hour, minute) {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  }

  const movieSlugs = ['neon-harbor', 'the-last-monsoon', 'circuit-breaker', 'moonlight-express', 'paper-crown'];
  const hours = [
    [1, 10, 0],
    [1, 13, 15],
    [1, 16, 30],
    [1, 19, 15],
    [1, 22, 0],
    [2, 11, 0],
    [2, 14, 45],
    [2, 18, 30],
    [2, 21, 30],
    [3, 19, 0],
  ];

  for (const ms of movieSlugs) {
    for (const t of theatres) {
      const screens = screenIds[t.slug];
      for (let i = 0; i < hours.length; i++) {
        const [day, hh, mm] = hours[i];
        await db.query(
          `INSERT INTO showtimes (show_id, venue_id, screen_id, starts_at, price_regular, price_premium, price_vip, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'open')`,
          [
            showIds[ms],
            venueIds[t.slug],
            screens[i % screens.length],
            showDate(day, hh, mm),
            t.moviePrices[0],
            t.moviePrices[1],
            t.moviePrices[2],
          ]
        );
      }
    }
  }

  const kanpur = theatres[0];
  const lucknow = theatres[4];
  const delhi = theatres[2];

  await db.query(
    `INSERT INTO showtimes (show_id, venue_id, screen_id, starts_at, price_regular, price_premium, price_vip, status)
     VALUES (?, ?, ?, ?, 799, 1499, 2499, 'open'),
            (?, ?, ?, ?, 799, 1499, 2499, 'open')`,
    [
      showIds['desert-beats-festival'],
      venueIds[kanpur.slug],
      screenIds[kanpur.slug][0],
      showDate(10, 18, 0),
      showIds['desert-beats-festival'],
      venueIds[kanpur.slug],
      screenIds[kanpur.slug][0],
      showDate(11, 18, 0),
    ]
  );

  await db.query(
    `INSERT INTO showtimes (show_id, venue_id, screen_id, starts_at, price_regular, price_premium, price_vip, status)
     VALUES (?, ?, ?, ?, 499, 799, 1299, 'open'),
            (?, ?, ?, ?, 499, 799, 1299, 'open')`,
    [
      showIds['laugh-riot-live'],
      venueIds[lucknow.slug],
      screenIds[lucknow.slug][0],
      showDate(5, 20, 0),
      showIds['laugh-riot-live'],
      venueIds[delhi.slug],
      screenIds[delhi.slug][0],
      showDate(6, 20, 30),
    ]
  );

  await db.query(
    `INSERT INTO showtimes (show_id, venue_id, screen_id, starts_at, price_regular, price_premium, price_vip, status)
     VALUES (?, ?, ?, ?, 350, 750, 1500, 'open')`,
    [
      showIds['city-cup-finals'],
      venueIds[kanpur.slug],
      screenIds[kanpur.slug][0],
      showDate(16, 19, 0),
    ]
  );

  await db.query(
    `INSERT INTO showtimes (show_id, venue_id, screen_id, starts_at, price_regular, price_premium, price_vip, status)
     VALUES (?, ?, ?, ?, 400, 700, 1200, 'open'),
            (?, ?, ?, ?, 400, 700, 1200, 'open')`,
    [
      showIds['hamlet-reimagined'],
      venueIds[delhi.slug],
      screenIds[delhi.slug][0],
      showDate(8, 19, 30),
      showIds['hamlet-reimagined'],
      venueIds[kanpur.slug],
      screenIds[kanpur.slug][0],
      showDate(9, 19, 30),
    ]
  );

  await db.query(
    `INSERT INTO showtimes (show_id, venue_id, screen_id, starts_at, price_regular, price_premium, price_vip, status)
     VALUES (?, ?, ?, ?, 600, 1100, 2000, 'open')`,
    [
      showIds['starlight-symphony'],
      venueIds[lucknow.slug],
      screenIds[lucknow.slug][0],
      showDate(20, 19, 0),
    ]
  );

  const settingsSql =
    db.dialect === 'sqlite'
      ? `INSERT INTO settings (k, v) VALUES
           ('tagline', 'India''s seat for movies, events and live sport.'),
           ('support_email', 'hello@showspot.com')
         ON CONFLICT(k) DO UPDATE SET v = excluded.v`
      : `INSERT INTO settings (k, v) VALUES
           ('tagline', 'India''s seat for movies, events and live sport.'),
           ('support_email', 'hello@showspot.com')
         ON DUPLICATE KEY UPDATE v = VALUES(v)`;
  await db.query(settingsSql);

  console.log('Seed complete.');
  console.log('  Admin      admin@showspot.com              / Admin@123');
  console.log('  Theatre    organizer@showspot.com          / Organizer@123  (Aetherplex Z Square, Kanpur)');
  console.log('  User       user@showspot.com               / User@123');
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}

module.exports = { seed };
