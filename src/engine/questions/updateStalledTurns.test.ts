import { describe, expect, it } from "vitest";

import { updateStalledTurns } from "./updateStalledTurns";

describe("updateStalledTurns", () => {
  it("incrémente stalledTurns lorsqu'aucun changement n'a été appliqué", () => {
    expect(updateStalledTurns(0, false, 3)).toEqual({
      stalledTurns: 1,
      reachedThreshold: false,
    });
  });

  it("continue d'incrémenter les tours consécutifs sans changement", () => {
    expect(updateStalledTurns(1, false, 3)).toEqual({
      stalledTurns: 2,
      reachedThreshold: false,
    });
  });

  it("signale lorsque le seuil est atteint", () => {
    expect(updateStalledTurns(2, false, 3)).toEqual({
      stalledTurns: 3,
      reachedThreshold: true,
    });
  });

  it("reste au-dessus du seuil si le moteur continue malgré tout", () => {
    expect(updateStalledTurns(3, false, 3)).toEqual({
      stalledTurns: 4,
      reachedThreshold: true,
    });
  });

  it("remet stalledTurns à zéro dès que le dossier change", () => {
    expect(updateStalledTurns(2, true, 3)).toEqual({
      stalledTurns: 0,
      reachedThreshold: false,
    });
  });

  it("reste à zéro lorsqu'un changement survient dès le premier tour", () => {
    expect(updateStalledTurns(0, true, 3)).toEqual({
      stalledTurns: 0,
      reachedThreshold: false,
    });
  });
});
