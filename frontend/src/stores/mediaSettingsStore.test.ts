import { beforeEach, describe, expect, it } from "vitest";

import { MAX_USER_VOLUME, useMediaSettingsStore } from "@/stores/mediaSettingsStore";

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
