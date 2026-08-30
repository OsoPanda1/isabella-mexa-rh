import { ISABELLA_AVATAR_PRIMARY, ISABELLA_MEDALLION_IMAGE, ISABELLA_PORTRAITS } from "../data/isabellaAvatar";

export interface ResourceItem {
  id: string;
  type: "image" | "video" | "audio" | "model";
  url: string;
  priority: "high" | "low";
}

export const RESOURCE_MANIFEST: ResourceItem[] = [
  {
    id: "isabella-primary-avatar",
    type: "image",
    url: ISABELLA_AVATAR_PRIMARY,
    priority: "high",
  },
  {
    id: "isabella-medallion",
    type: "image",
    url: ISABELLA_MEDALLION_IMAGE,
    priority: "high",
  },
  ...ISABELLA_PORTRAITS.map((p, i) => ({
    id: `isabella-portrait-${i}`,
    type: "image" as const,
    url: p.src,
    priority: "high" as const,
  })),
  {
    id: "cinematic-trailer",
    type: "video",
    url: "https://cdn.coverr.co/videos/coverr-a-beautiful-sunset-in-the-mountains-2841/1080p.mp4",
    priority: "low",
  },
  {
    id: "neural-model-vits",
    type: "model",
    url: "/models/vits_isabella_v4.onnx", // Simulated RVC/VITS model path
    priority: "high",
  },
  {
    id: "neural-model-vision",
    type: "model",
    url: "/models/orion_vision_flux.bin", // Simulated Vision model
    priority: "low",
  }
];

export class ResourcePreloader {
  private static loadedCount = 0;
  private static totalHighPriority = 0;
  private static listeners: ((progress: number) => void)[] = [];

  static subscribe(callback: (progress: number) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private static notifyListeners() {
    const progress = this.totalHighPriority === 0 ? 100 : (this.loadedCount / this.totalHighPriority) * 100;
    this.listeners.forEach((l) => l(progress));
  }

  static async initPreload(): Promise<void> {
    const highPriority = RESOURCE_MANIFEST.filter((r) => r.priority === "high");
    this.totalHighPriority = highPriority.length;
    this.loadedCount = 0;

    const promises = highPriority.map((resource) => {
      return this.loadResource(resource)
        .catch((err) => {
          console.warn(`[ResourcePreloader] Failed to preload ${resource.id}:`, err);
        })
        .finally(() => {
          this.loadedCount++;
          this.notifyListeners();
        });
    });

    await Promise.all(promises);

    // Load low priority resources in the background without blocking TTI
    const lowPriority = RESOURCE_MANIFEST.filter((r) => r.priority === "low");
    lowPriority.forEach((resource) => this.loadResource(resource).catch(() => {}));
  }

  private static loadResource(resource: ResourceItem): Promise<void> {
    return new Promise((resolve, reject) => {
      if (resource.type === "image") {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = resource.url;
      } else if (resource.type === "video" || resource.type === "audio") {
        const media = document.createElement(resource.type);
        media.oncanplaythrough = () => resolve();
        media.onerror = reject;
        media.src = resource.url;
        media.load();
      } else if (resource.type === "model") {
        // Simulate model pre-warming/fetching
        fetch(resource.url, { method: "HEAD" })
          .then(() => resolve())
          .catch(() => {
            // Even if model doesn't exist locally, we resolve to avoid blocking UI
            // In a real scenario we might stream the model chunks into IndexedDB
            setTimeout(resolve, 500); 
          });
      } else {
        resolve();
      }
    });
  }
}
