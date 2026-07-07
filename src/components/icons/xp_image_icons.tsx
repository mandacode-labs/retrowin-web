import Image from "next/image";

const iconMap = {
  folder_closed: "/icons/sprites/folder_closed.webp",
  folder_opened: "/icons/sprites/folder_opened.webp",
  recycle_bin_empty: "/icons/sprites/recycle_bin_empty.webp",
  recycle_bin_full: "/icons/sprites/recycle_bin_full.webp",
  generic_document: "/icons/sprites/generic_document.webp",
  generic_text_document: "/icons/sprites/generic_text_document.webp",
  generic_audio: "/icons/sprites/generic_audio.webp",
  generic_video: "/icons/sprites/generic_video.webp",
  generic_media: "/icons/sprites/generic_media.webp",
  my_documents: "/icons/sprites/my_documents.webp",
  my_music: "/icons/sprites/my_music.webp",
  my_pictures: "/icons/sprites/my_pictures.webp",
  my_videos: "/icons/sprites/my_videos.webp",
  bitmap: "/icons/sprites/bitmap.webp",
  gif: "/icons/sprites/gif.webp",
  jpg: "/icons/sprites/jpg.webp",
  tiff: "/icons/sprites/tiff.webp",
  txt: "/icons/sprites/txt.webp",
  up: "/icons/sprites/up.webp",
} as const;

const DEFAULT_ICON_SIZE = 48;

const makeIcon = (key: keyof typeof iconMap, alt: string) =>
  function IconComponent({ size = DEFAULT_ICON_SIZE }: { size?: number }) {
    return (
      <Image
        src={iconMap[key]}
        alt={alt}
        width={size}
        height={size}
        unoptimized
      />
    );
  };

export const XPImageIcons = {
  Folder: makeIcon("folder_closed", "Folder"),
  FolderOpen: makeIcon("folder_opened", "Folder Open"),
  File: makeIcon("generic_document", "File"),
  TextFile: makeIcon("generic_text_document", "Text File"),
  Audio: makeIcon("generic_audio", "Audio"),
  Video: makeIcon("generic_video", "Video"),
  Media: makeIcon("generic_media", "Media"),
  Trash: makeIcon("recycle_bin_empty", "Trash"),
  TrashFull: makeIcon("recycle_bin_full", "Trash Full"),
  Home: makeIcon("my_documents", "Home"),
  Upload: makeIcon("up", "Upload"),
  JPG: makeIcon("jpg", "JPG"),
  GIF: makeIcon("gif", "GIF"),
  Bitmap: makeIcon("bitmap", "BMP"),
  TIFF: makeIcon("tiff", "TIFF"),
};
