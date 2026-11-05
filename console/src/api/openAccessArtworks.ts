// Real artworks from The Metropolitan Museum of Art's Open Access collection (public domain; data and images
// CC0, https://www.metmuseum.org/about-the-met/policies-and-documents/open-access). Label facts only, as the
// museum publishes them: nothing here is written for STILL. Used by the mock seed so the editor shows real work.
export interface OpenAccessArtwork {
  id: string;
  objectId: number;
  title: string;
  artist: string;
  bio: string;
  date: string;
  medium: string;
  dimensions: string;
  credit: string;
  image: string;
  url: string;
}

export const OPEN_ACCESS_ARTWORKS: OpenAccessArtwork[] = [
  {
    "id": "met-436535",
    "objectId": 436535,
    "title": "Wheat Field with Cypresses",
    "artist": "Vincent van Gogh",
    "bio": "Dutch, Zundert 1853–1890 Auvers-sur-Oise",
    "date": "1889",
    "medium": "Oil on canvas",
    "dimensions": "28 13/16 × 36 3/4 in. (73.2 × 93.4 cm)",
    "credit": "Purchase, The Annenberg Foundation Gift, 1993",
    "image": "https://images.metmuseum.org/CRDImages/ep/web-large/DP-42549-001.jpg",
    "url": "https://www.metmuseum.org/art/collection/search/436535"
  },
  {
    "id": "met-438817",
    "objectId": 438817,
    "title": "The Dance Class",
    "artist": "Edgar Degas",
    "bio": "French, Paris 1834–1917 Paris",
    "date": "1874",
    "medium": "Oil on canvas",
    "dimensions": "32 7/8 x 30 3/8 in. (83.5 x 77.2 cm)",
    "credit": "Bequest of Mrs. Harry Payne Bingham, 1986",
    "image": "https://images.metmuseum.org/CRDImages/ep/web-large/DP-20101-001.jpg",
    "url": "https://www.metmuseum.org/art/collection/search/438817"
  },
  {
    "id": "met-436947",
    "objectId": 436947,
    "title": "Boating",
    "artist": "Edouard Manet",
    "bio": "French, Paris 1832–1883 Paris",
    "date": "1874",
    "medium": "Oil on canvas",
    "dimensions": "38 1/4 x 51 1/4 in. (97.2 x 130.2 cm)",
    "credit": "H. O. Havemeyer Collection, Bequest of Mrs. H. O. Havemeyer, 1929",
    "image": "https://images.metmuseum.org/CRDImages/ep/web-large/DP-25466-001.jpg",
    "url": "https://www.metmuseum.org/art/collection/search/436947"
  },
  {
    "id": "met-436965",
    "objectId": 436965,
    "title": "The Monet Family in Their Garden at Argenteuil",
    "artist": "Edouard Manet",
    "bio": "French, Paris 1832–1883 Paris",
    "date": "1874",
    "medium": "Oil on canvas",
    "dimensions": "24 x 39 1/4 in. (61 x 99.7 cm)",
    "credit": "Bequest of Joan Whitney Payson, 1975",
    "image": "https://images.metmuseum.org/CRDImages/ep/web-large/DP-25465-001.jpg",
    "url": "https://www.metmuseum.org/art/collection/search/436965"
  },
  {
    "id": "met-438012",
    "objectId": 438012,
    "title": "Bouquet of Chrysanthemums",
    "artist": "Auguste Renoir",
    "bio": "French, Limoges 1841–1919 Cagnes-sur-Mer",
    "date": "1881",
    "medium": "Oil on canvas",
    "dimensions": "26 x 21 7/8 in. (66 x 55.6 cm)",
    "credit": "The Walter H. and Leonore Annenberg Collection, Bequest of Walter H. Annenberg, 2002",
    "image": "https://images.metmuseum.org/CRDImages/ep/web-large/DT1877.jpg",
    "url": "https://www.metmuseum.org/art/collection/search/438012"
  },
  {
    "id": "met-459110",
    "objectId": 459110,
    "title": "Young Girl Bathing",
    "artist": "Auguste Renoir",
    "bio": "French, Limoges 1841–1919 Cagnes-sur-Mer",
    "date": "1892",
    "medium": "Oil on canvas",
    "dimensions": "32 x 25 1/2 in. (81.3 x 64.8 cm)",
    "credit": "Robert Lehman Collection, 1975",
    "image": "https://images.metmuseum.org/CRDImages/rl/web-large/DP-17279-001.jpg",
    "url": "https://www.metmuseum.org/art/collection/search/459110"
  },
  {
    "id": "met-437984",
    "objectId": 437984,
    "title": "La Berceuse (Woman Rocking a Cradle; Augustine-Alix Pellicot Roulin, 1851–1930)",
    "artist": "Vincent van Gogh",
    "bio": "Dutch, Zundert 1853–1890 Auvers-sur-Oise",
    "date": "1889",
    "medium": "Oil on canvas",
    "dimensions": "36 1/2 × 29 in. (92.7 × 73.7 cm)",
    "credit": "The Walter H. and Leonore Annenberg Collection, Gift of Walter H. and Leonore Annenberg, 1996, Bequest of Walter H. Annenberg, 2002",
    "image": "https://images.metmuseum.org/CRDImages/ep/web-large/DP-19279-001.jpg",
    "url": "https://www.metmuseum.org/art/collection/search/437984"
  },
  {
    "id": "met-436121",
    "objectId": 436121,
    "title": "A Woman Seated beside a Vase of Flowers (Madame Paul Valpinçon?)",
    "artist": "Edgar Degas",
    "bio": "French, Paris 1834–1917 Paris",
    "date": "1865",
    "medium": "Oil on canvas",
    "dimensions": "29 x 36 1/2 in. (73.7 x 92.7 cm)",
    "credit": "H. O. Havemeyer Collection, Bequest of Mrs. H. O. Havemeyer, 1929",
    "image": "https://images.metmuseum.org/CRDImages/ep/web-large/DP-25460-001.jpg",
    "url": "https://www.metmuseum.org/art/collection/search/436121"
  }
];
