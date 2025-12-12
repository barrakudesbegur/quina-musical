export type GalleryImage = {
  id: string;
  filename: string;
  label: string;
  discoverable: boolean;
};

export const GALLERY_IMAGES: GalleryImage[] = [
  {
    id: 'quina-1',
    label: 'Premis quina 1',
    filename: '/images/quina-1.jpeg',
    discoverable: true,
  },
  {
    id: 'quina-2',
    label: 'Premis quina 2',
    filename: '/images/quina-2.jpeg',
    discoverable: true,
  },
  {
    id: 'quina-3',
    label: 'Premis quina 3',
    filename: '/images/quina-3.jpeg',
    discoverable: true,
  },
];
