/** Secret words for civilians. Imposter sees none of these. */

export const CATEGORIES = [
  { id: "mixed", label: "Mixed" },
  { id: "places", label: "Places" },
  { id: "food", label: "Food" },
  { id: "objects", label: "Objects" },
  { id: "movies", label: "Movies & Shows" },
  { id: "sports", label: "Sports" },
];

const BANK = {
  places: [
    "Beach",
    "Airport",
    "Hospital",
    "School",
    "Mosque",
    "Mall",
    "Zoo",
    "Library",
    "Gym",
    "Cinema",
    "Train station",
    "Park",
    "Restaurant",
    "Hotel",
    "Mountain",
  ],
  food: [
    "Pizza",
    "Biryani",
    "Sushi",
    "Burger",
    "Ice cream",
    "Pasta",
    "Tacos",
    "Chocolate",
    "Mango",
    "Coffee",
    "Noodles",
    "Sandwich",
    "Cake",
    "Fries",
    "Samosa",
  ],
  objects: [
    "Umbrella",
    "Laptop",
    "Mirror",
    "Clock",
    "Backpack",
    "Guitar",
    "Camera",
    "Pillow",
    "Candle",
    "Bicycle",
    "Key",
    "Phone",
    "Book",
    "Sunglasses",
    "Wallet",
  ],
  movies: [
    "Titanic",
    "Avatar",
    "Inception",
    "Frozen",
    "The Lion King",
    "Spider-Man",
    "Harry Potter",
    "Joker",
    "Interstellar",
    "Coco",
    "Shrek",
    "The Avengers",
    "Finding Nemo",
    "Toy Story",
    "Jurassic Park",
  ],
  sports: [
    "Football",
    "Cricket",
    "Basketball",
    "Tennis",
    "Swimming",
    "Boxing",
    "Chess",
    "Badminton",
    "Hockey",
    "Golf",
    "Volleyball",
    "Table tennis",
    "Racing",
    "Wrestling",
    "Skiing",
  ],
};

export function pickWord(categoryId) {
  let pool;
  if (categoryId === "mixed" || !BANK[categoryId]) {
    pool = Object.values(BANK).flat();
  } else {
    pool = BANK[categoryId];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
