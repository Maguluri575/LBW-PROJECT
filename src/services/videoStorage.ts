/**
 * Video Storage Service
 * Uses IndexedDB for client-side video persistence
 */

const DB_NAME = 'lbw-video-storage';
const DB_VERSION = 1;
const STORE_NAME = 'videos';

interface StoredVideo {
  analysisId: string;
  videoBlob: Blob;
  fileName: string;
  storedAt: Date;
}

let db: IDBDatabase | null = null;

/**
 * Initialize the IndexedDB database
 */
async function initDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'analysisId' });
        store.createIndex('storedAt', 'storedAt', { unique: false });
      }
    };
  });
}

/**
 * Store a video blob associated with an analysis ID
 */
export async function storeVideo(analysisId: string, file: File): Promise<string> {
  try {
    const database = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const storedVideo: StoredVideo = {
        analysisId,
        videoBlob: file,
        fileName: file.name,
        storedAt: new Date(),
      };
      
      const request = store.put(storedVideo);
      
      request.onsuccess = () => {
        console.log(`Video stored for analysis: ${analysisId}`);
        resolve(analysisId);
      };
      
      request.onerror = () => {
        console.error('Failed to store video:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Failed to store video:', error);
    throw error;
  }
}

/**
 * Retrieve a video blob URL for an analysis ID
 */
export async function getVideoUrl(analysisId: string): Promise<string | null> {
  try {
    const database = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(analysisId);
      
      request.onsuccess = () => {
        const result = request.result as StoredVideo | undefined;
        if (result?.videoBlob) {
          const url = URL.createObjectURL(result.videoBlob);
          resolve(url);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => {
        console.error('Failed to retrieve video:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Failed to get video URL:', error);
    return null;
  }
}

/**
 * Delete a stored video by analysis ID
 */
export async function deleteVideo(analysisId: string): Promise<boolean> {
  try {
    const database = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(analysisId);
      
      request.onsuccess = () => {
        console.log(`Video deleted for analysis: ${analysisId}`);
        resolve(true);
      };
      
      request.onerror = () => {
        console.error('Failed to delete video:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Failed to delete video:', error);
    return false;
  }
}

/**
 * Get all stored video analysis IDs
 */
export async function getAllStoredVideoIds(): Promise<string[]> {
  try {
    const database = await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();
      
      request.onsuccess = () => {
        resolve(request.result as string[]);
      };
      
      request.onerror = () => {
        console.error('Failed to get stored video IDs:', request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Failed to get stored video IDs:', error);
    return [];
  }
}

/**
 * Clean up old videos (keep last N videos)
 */
export async function cleanupOldVideos(keepCount: number = 10): Promise<void> {
  try {
    const database = await initDB();
    
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('storedAt');
    
    const request = index.openCursor(null, 'prev');
    let count = 0;
    
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        count++;
        if (count > keepCount) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
  } catch (error) {
    console.error('Failed to cleanup old videos:', error);
  }
}
