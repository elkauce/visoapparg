import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PresenceSettings from "./presence-settings";
const fixture = vi.hoisted(() => ({
  android: true,
  phone: vi.fn(),
  calendar: vi.fn(),
  list: vi.fn(),
  save: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/lib/android-native", () => ({
  isAndroidNative: () => fixture.android,
}));
vi.mock("@/lib/presence-native", () => ({
  presenceNative: {
    requestPhoneAccess: fixture.phone,
    requestCalendarAccess: fixture.calendar,
    listCalendars: fixture.list,
  },
  readPresencePreferences: () => ({
    calls: false,
    calendarIds: [],
    allBusyEvents: false,
  }),
  savePresencePreferences: fixture.save,
}));
vi.mock("sonner", () => ({ toast: { error: fixture.error } }));
beforeEach(() => {
  vi.clearAllMocks();
  fixture.android = true;
  fixture.phone.mockResolvedValue({ granted: true });
  fixture.calendar.mockResolvedValue({ granted: true });
  fixture.list.mockResolvedValue({
    calendars: [{ id: "17", name: "Equipo", account: "calendar@example.test" }],
  });
});
const show = () =>
  render(
    <PresenceSettings
      accountId="owner-A"
      open
      onOpenChange={() => undefined}
    />,
  );
describe("automatic presence opt-in permissions", () => {
  it("does not enable calls when Android denies the permission", async () => {
    fixture.phone.mockResolvedValue({ granted: false });
    show();
    fireEvent.click(
      screen.getByRole("switch", { name: "Detectar llamadas telefónicas" }),
    );
    await waitFor(() => expect(fixture.error).toHaveBeenCalled());
    expect(fixture.save).not.toHaveBeenCalled();
  });
  it("enables calls only after permission and saves them for the active account", async () => {
    show();
    fireEvent.click(
      screen.getByRole("switch", { name: "Detectar llamadas telefónicas" }),
    );
    await waitFor(() =>
      expect(fixture.save).toHaveBeenCalledWith("owner-A", {
        calls: true,
        calendarIds: [],
        allBusyEvents: false,
      }),
    );
  });
  it("never queries the calendar provider after a denied permission", async () => {
    fixture.calendar.mockResolvedValue({ granted: false });
    show();
    fireEvent.click(
      screen.getByRole("button", { name: "Elegir calendarios sincronizados" }),
    );
    await waitFor(() => expect(fixture.error).toHaveBeenCalled());
    expect(fixture.list).not.toHaveBeenCalled();
  });
  it("lets the user opt in to a specific synchronized calendar", async () => {
    show();
    fireEvent.click(
      screen.getByRole("button", { name: "Elegir calendarios sincronizados" }),
    );
    const checkbox = await screen.findByRole("checkbox");
    fireEvent.click(checkbox);
    expect(fixture.save).toHaveBeenCalledWith("owner-A", {
      calls: false,
      calendarIds: ["17"],
      allBusyEvents: false,
    });
  });
  it("explains the Android requirement on web without requesting permissions", () => {
    fixture.android = false;
    show();
    expect(
      screen.getByText(/Configurá esta detección en la APK Android/),
    ).toBeTruthy();
    expect(fixture.phone).not.toHaveBeenCalled();
    expect(fixture.calendar).not.toHaveBeenCalled();
  });
});
