const DATABASE = "viso-standby-photos-v1";
const STORE = "photos";
export const MAX_STANDBY_PHOTOS = 8;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const MAX_PHOTOS_BYTES = 24 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface StandbyPhoto {
  id: string;
  blob: Blob;
  createdAt: number;
}

interface StoredPhoto extends StandbyPhoto {
  key: string;
  owner: string;
}

export function validateStandbyPhoto(
  file: Pick<Blob, "type" | "size">,
): string | null {
  if (!PHOTO_TYPES.has(file.type)) return "Elegí fotografías JPG, PNG o WebP.";
  if (!file.size) return "La fotografía está vacía.";
  if (file.size > MAX_PHOTO_BYTES)
    return "Cada fotografía puede ocupar hasta 8 MB.";
  return null;
}

export function validateStandbyPhotoBatch(
  existing: Pick<StandbyPhoto, "blob">[],
  files: Blob[],
): string | null {
  if (existing.length + files.length > MAX_STANDBY_PHOTOS)
    return "Podés guardar hasta 8 fotografías por cuenta.";
  const invalid = files.map(validateStandbyPhoto).find(Boolean);
  if (invalid) return invalid;
  const bytes = [
    ...existing.map((photo) => photo.blob.size),
    ...files.map((file) => file.size),
  ].reduce((sum, size) => sum + size, 0);
  return bytes > MAX_PHOTOS_BYTES
    ? "Las fotografías pueden ocupar hasta 24 MB en total."
    : null;
}

function requireOwner(userId: string): void {
  if (!userId || userId.length > 512)
    throw new Error("Iniciá sesión para guardar tus fotografías.");
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(
        new Error(
          "Este dispositivo no permite guardar fotografías localmente.",
        ),
      );
      return;
    }
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: "key" });
      store.createIndex("owner", "owner");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("No se pudo abrir el almacenamiento de fotografías."));
    request.onblocked = () =>
      reject(new Error("Cerrá otras ventanas de VISO y volvé a intentar."));
  });
}

export async function listStandbyPhotos(
  userId: string,
): Promise<StandbyPhoto[]> {
  requireOwner(userId);
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, "readonly");
      const request = transaction
        .objectStore(STORE)
        .index("owner")
        .getAll(userId);
      request.onsuccess = () => {
        const photos = (request.result as StoredPhoto[])
          .filter(
            (photo) =>
              photo.owner === userId &&
              photo.blob instanceof Blob &&
              !validateStandbyPhoto(photo.blob),
          )
          .sort((a, b) => a.createdAt - b.createdAt)
          .map(({ id, blob, createdAt }) => ({ id, blob, createdAt }));
        resolve(photos);
      };
      request.onerror = () =>
        reject(new Error("No se pudieron leer tus fotografías."));
      transaction.onabort = () =>
        reject(new Error("No se pudieron leer tus fotografías."));
    });
  } finally {
    database.close();
  }
}

/** Validate actual decoding before retaining bytes in this account's local store. */
async function validateImageContent(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob);
  try {
    await new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        if (
          !image.naturalWidth ||
          !image.naturalHeight ||
          image.naturalWidth * image.naturalHeight > 40_000_000
        ) {
          reject(new Error("Elegí una fotografía de hasta 40 megapíxeles."));
        } else resolve();
      };
      image.onerror = () =>
        reject(new Error("No se pudo abrir una de las fotografías."));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function addStandbyPhotos(
  userId: string,
  files: Blob[],
): Promise<void> {
  requireOwner(userId);
  if (!files.length) return;
  const invalid = files.map(validateStandbyPhoto).find(Boolean);
  if (invalid) throw new Error(invalid);
  for (const file of files) await validateImageContent(file);
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      // Quotas and inserts share one transaction, including concurrent tabs.
      const transaction = database.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      const request = store.index("owner").getAll(userId);
      let failure =
        "No se pudieron guardar las fotografías. Comprobá el espacio disponible.";
      request.onsuccess = () => {
        const error = validateStandbyPhotoBatch(
          request.result as StoredPhoto[],
          files,
        );
        if (error) {
          failure = error;
          transaction.abort();
          return;
        }
        const now = Date.now();
        files.forEach((blob, index) => {
          const id = crypto.randomUUID();
          store.add({
            key: `${encodeURIComponent(userId)}:${id}`,
            owner: userId,
            id,
            blob,
            createdAt: now + index,
          } satisfies StoredPhoto);
        });
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(new Error(failure));
      transaction.onerror = () => reject(new Error(failure));
    });
  } finally {
    database.close();
  }
}

export async function removeStandbyPhoto(
  userId: string,
  id: string,
): Promise<void> {
  requireOwner(userId);
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, "readwrite");
      transaction
        .objectStore(STORE)
        .delete(`${encodeURIComponent(userId)}:${id}`);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () =>
        reject(new Error("No se pudo borrar la fotografía."));
      transaction.onerror = () =>
        reject(new Error("No se pudo borrar la fotografía."));
    });
  } finally {
    database.close();
  }
}
