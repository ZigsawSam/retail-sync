export type AppMode = "offline" | "online";

const KEY = "retail_sync_app_mode";

export function getAppMode(): AppMode {
    if (typeof window === "undefined") {
        return "online";
    }

    return (localStorage.getItem(KEY) as AppMode) ?? "online";
}

export function setAppMode(mode: AppMode) {
    if (typeof window !== "undefined") {
        localStorage.setItem(KEY, mode);
    }
}

export function isOfflineMode() {
    return getAppMode() === "offline";
}

export function isOnlineMode() {
    return getAppMode() === "online";
}