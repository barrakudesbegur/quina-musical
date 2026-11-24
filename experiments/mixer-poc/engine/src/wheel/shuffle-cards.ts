// shuffle-test's cards.js, typed and as an ES module: the album cards on the drum.

const ART_STYLE_COUNT = 5;
const ARTICLES = /^(the|a|an|of)$/i;

/** What a card shows: the cover (or generated art when there is none), the title and the artist. */
export interface Album {
  title: string;
  artist: string;
  cover?: string | null;
}

function hashText(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getInitials(title: string): string {
  const words = title.split(/\s+/);
  const significantWords = words.filter((word) => !ARTICLES.test(word));
  const chosenWords = significantWords.length > 0 ? significantWords : words;
  if (chosenWords.length === 1) return Array.from(chosenWords[0]).slice(0, 3).join('').toUpperCase();
  return chosenWords
    .slice(0, 2)
    .map((word) => Array.from(word)[0].toUpperCase())
    .join('');
}

function createArtElement(album: Album): HTMLDivElement {
  const art = document.createElement('div');
  art.className = 'art';

  if (album.cover) {
    art.classList.add('has-image');
    art.style.backgroundImage = `url(${JSON.stringify(album.cover)})`;
    return art;
  }

  const hash = hashText(`${album.title}|${album.artist}`);
  const hueA = hash % 360;
  const hueB = (hueA + 40 + ((hash >>> 9) % 140)) % 360;
  art.classList.add(`art-${(hash >>> 20) % ART_STYLE_COUNT}`);
  art.style.setProperty('--hue-a', String(hueA));
  art.style.setProperty('--hue-b', String(hueB));
  art.style.setProperty('--tilt', `${(hash >>> 14) % 360}deg`);
  art.dataset.initials = getInitials(album.title);
  return art;
}

export function createCoverElement(album: Album): HTMLDivElement {
  const cover = document.createElement('div');
  cover.className = 'cover';
  cover.append(createArtElement(album));
  return cover;
}

export function createAlbumCard(album: Album, index: number): HTMLLIElement {
  const title = document.createElement('b');
  title.textContent = album.title;
  const artist = document.createElement('span');
  artist.textContent = album.artist;
  const caption = document.createElement('p');
  caption.className = 'caption';
  caption.append(title, artist);

  const face = document.createElement('div');
  face.className = 'face';
  face.append(createCoverElement(album), caption);

  const card = document.createElement('li');
  card.className = 'card';
  card.style.setProperty('--i', String(index));
  card.append(face);
  return card;
}
