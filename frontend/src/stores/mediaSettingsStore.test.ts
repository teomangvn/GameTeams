import { beforeEach, describe, expect, it } from "vitest";

import {
  MAX_USER_VOLUME,
  migrateMediaSettings,
  useMediaSettingsStore,
} from "@/stores/mediaSettingsStore";

const volumes = () => useMediaSettingsStore.getState().userVolumes;
const setUserVolume = (userId: string, volume: number) =>
  useMediaSettingsStore.getState().setUserVolume(userId, volume);

describe("setUserVolume", () => {
  beforeEach(() => {
    useMediaSettingsStore.setState({ userVolumes: {} });
  });

  it("kullanici basina seviyeyi saklar", () => {
    setUserVolume("a", 0.5);
    setUserVolume("b", 1.5);
    expect(volumes()).toEqual({ a: 0.5, b: 1.5 });
  });

  it("araligin disindaki degerleri sinirlar", () => {
    setUserVolume("a", -1);
    setUserVolume("b", 10);
    expect(volumes()).toEqual({ a: 0, b: MAX_USER_VOLUME });
  });

  it("%100'e donen kaydi siler", () => {
    setUserVolume("a", 0.3);
    setUserVolume("a", 1);
    expect(volumes()).toEqual({});
  });
});

describe("ayar goc islemi", () => {
  it("eski acik gurultu engellemeyi gelismis moda tasir", () => {
    const state = migrateMediaSettings({ noiseSuppression: true, microphoneId: "mic" }, 0);
    expect(state.noiseSuppression).toBe("enhanced");
    expect(state.microphoneId).toBe("mic");
  });

  it("eski kapali gurultu engellemeyi kapali tutar", () => {
    const state = migrateMediaSettings({ noiseSuppression: false }, 0);
    expect(state.noiseSuppression).toBe("off");
  });

  it("guncel bicimdeki ayara dokunmaz", () => {
    expect(migrateMediaSettings({ noiseSuppression: "standard" }, 1)).toEqual({
      noiseSuppression: "standard",
    });
  });
});
