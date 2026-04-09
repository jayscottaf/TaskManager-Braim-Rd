const STORAGE_KEY = "tasktracker-features";

export interface InstalledFeature {
  featureId: string;
  databaseId: string;
  installedAt: string;
}

export function getInstalledFeatures(): InstalledFeature[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function getInstalledFeature(featureId: string): InstalledFeature | undefined {
  return getInstalledFeatures().find((f) => f.featureId === featureId);
}

export function isFeatureInstalled(featureId: string): boolean {
  return getInstalledFeatures().some((f) => f.featureId === featureId);
}

export function saveInstalledFeature(featureId: string, databaseId: string): void {
  const features = getInstalledFeatures();
  if (features.some((f) => f.featureId === featureId)) return;
  features.push({ featureId, databaseId, installedAt: new Date().toISOString() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(features));
}

export function removeInstalledFeature(featureId: string): void {
  const features = getInstalledFeatures().filter((f) => f.featureId !== featureId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(features));
}
