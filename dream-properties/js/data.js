const SITE = {
  name: "Dream Properties",
  legal: "Dream Properties And Construction",
  owner: "Haseeb Siddiqui",
  phone: "+918299058827",
  phoneDisplay: "+91 82990 58827",
  whatsapp: "918299058827",
  hours: "Monday–Saturday, 10:00 AM – 7:00 PM",
  hoursShort: "10:00 AM – 7:00 PM",
  address: "114/94B, Swaroop Nagar, Near Kanpur Vidyamandir",
  city: "Kanpur, Uttar Pradesh",
  maps: "https://maps.app.goo.gl/5ZDKQNBcg2oX6Zoz7",
  mapsEmbed:
    "https://maps.google.com/maps?q=Dream+Properties+Swaroop+Nagar+Kanpur&z=16&output=embed",
  tagline: "Kanpur homes, shown the way we present them.",
  experience: "14+",
  team: "10",
  rating: "5.0",
  reviewCount: "9",
};

const AREAS = [
  "Swaroop Nagar",
  "Civil Lines",
  "Kakadeo",
  "Kidwai Nagar",
  "Govind Nagar",
  "NRI City",
  "Barra",
  "Lakhanpur",
  "Arya Nagar",
  "Vishnupuri",
  "Tilak Nagar",
];

const TYPES = ["Apartment", "Independent House", "Penthouse", "Plot"];

const WORK = [
  { id: "swaroop-nagar", title: "Swaroop Nagar", type: "Apartment", photos: 4, featured: true },
  { id: "civil-lines", title: "Civil Lines", type: "Independent House", photos: 4, featured: true },
  { id: "kakadeo", title: "Kakadeo", type: "Apartment", photos: 3, featured: true },
  { id: "nri-city", title: "NRI City", type: "Plot", photos: 2, featured: true },
  { id: "govind-nagar", title: "Govind Nagar", type: "Penthouse", photos: 4, featured: true },
  { id: "kidwai-nagar", title: "Kidwai Nagar", type: "Independent House", photos: 3, featured: false },
  { id: "lakhanpur", title: "Lakhanpur", type: "Apartment", photos: 3, featured: true },
  { id: "barra", title: "Barra", type: "Independent House", photos: 4, featured: false },
  { id: "vishnupuri", title: "Vishnupuri", type: "Independent House", photos: 4, featured: false },
];

function propertyPhotos(p) {
  return Array.from({ length: p.photos }, (_, i) => `assets/properties/${p.id}/${i + 1}.jpg`);
}

function cover(p) {
  return propertyPhotos(p)[0];
}

const REVIEWS = [
  {
    name: "Krishnanunni R",
    meta: "1 review · a week ago",
    stars: 5,
    text: "Highly recommend Dream Properties! After wasting time and money with several other brokers, I finally found the right team. They understood my requirements perfectly and found me a premium luxury flat in Kanpur within just one day.",
    reply: "Thank you so much for your valuable feedback. It means a lot to us. We look forward to serving you again.",
    replyWhen: "a week ago",
  },
  {
    name: "Umang Sharma",
    meta: "2 reviews · 5 months ago",
    stars: 5,
    text: "Professionalism: highly regarded for transparent dealings. The agents are polite and do not use high-pressure tactics. Their ability to negotiate a fair price stood out — I would work with them again.",
    reply: "Thansk",
    replyWhen: "5 months ago",
  },
  {
    name: "Thakurakanksha Singh",
    meta: "3 reviews · 2 months ago",
    stars: 5,
    text: "Delighted with the services and dealing. They provide places at best rates and also at best locality. Thanks a lot.",
    reply: "Thank you so much for your valuable feedback. It means a lot to us. We look forward to serving you again.",
    replyWhen: "2 months ago",
  },
  {
    name: "Aayush Srivastava",
    meta: "5 reviews · 3 weeks ago",
    stars: 5,
    text: "They have a variety of inventories of properties. I found the best deal with Haseeb bhai. Great work, Bhai.",
    reply: "Thank you so much for your valuable feedback. It means a lot to us. We look forward to serving you again.",
    replyWhen: "3 weeks ago",
  },
  {
    name: "Ankit Bharti",
    meta: "4 reviews · 4 months ago",
    stars: 5,
    text: "These people are completely professional and transparent. They honestly helped us finding the right home. I am glad we connected with them. Recommended others as well.",
    reply: "Thank you so much for your valuable feedback. It means a lot to us. We look forward to serving you again.",
    replyWhen: "4 months ago",
  },
  {
    name: "Hardik Mittal",
    meta: "Local Guide · 19 reviews · a month ago",
    stars: 5,
    text: "They have a large options of property according to the needs. Great service and nice behaviour.",
    reply: "Thank you so much for your valuable feedback. It means a lot to us. We look forward to serving you again.",
    replyWhen: "a month ago",
  },
  {
    name: "Ankit Singh",
    meta: "13 reviews · 2 months ago",
    stars: 5,
    text: "They helped me get a good apartment in Kanpur, in the time of urgency.",
    reply: "Thank you so much for your valuable feedback. It means a lot to us. We look forward to serving you again.",
    replyWhen: "2 months ago",
  },
  {
    name: "Hina Usmani",
    meta: "1 review · a year ago",
    stars: 5,
    text: "Dream Properties helped me find a great deal within my budget. Their team is efficient, courteous, and knows the market very well. They provided exceptional support at every step. A trustworthy partner for real estate solutions.",
    reply: "Thank you",
    replyWhen: "a year ago",
  },
  {
    name: "Manoj Kumar Verma",
    meta: "3 reviews · 4 months ago",
    stars: 5,
    text: "I searched for a rented flat and got the best service.",
    reply: "Thank you so much for your valuable feedback. It means a lot to us. We look forward to serving you again.",
    replyWhen: "4 months ago",
  },
];

const SERVICES = [
  {
    id: "flats",
    title: "Apartments",
    text: "Luxury flats and family 2 & 3 BHKs — matched to how you live, then negotiated quietly.",
    href: "properties.html?type=Apartment",
  },
  {
    id: "houses",
    title: "Houses & villas",
    text: "Independent homes with a gate, a sit-out, and rooms that actually work.",
    href: "properties.html?type=Independent%20House",
  },
  {
    id: "penthouses",
    title: "Penthouses",
    text: "Uncommon briefs — terrace, sky, and a finish that still feels considered.",
    href: "properties.html?type=Penthouse",
  },
  {
    id: "plots",
    title: "Plots",
    text: "Build-ready parcels in pockets like NRI City — title first, then the facing.",
    href: "properties.html?type=Plot",
  },
];
