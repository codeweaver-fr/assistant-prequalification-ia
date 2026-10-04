type UpdateStalledTurnsResult = {
  stalledTurns: number;
  reachedThreshold: boolean;
};

export function updateStalledTurns(
  currentStalledTurns: number,
  didStateChange: boolean,
  stalledTurnsThreshold: number,
): UpdateStalledTurnsResult {
  /*
   * Dès que le dossier évolue réellement,
   * la conversation n'est plus considérée comme bloquée.
   */
  if (didStateChange) {
    return {
      stalledTurns: 0,
      reachedThreshold: false,
    };
  }

  /*
   * Aucun changement dans le dossier :
   * on compte un tour bloqué supplémentaire.
   */
  const nextStalledTurns =
    currentStalledTurns + 1;

  return {
    stalledTurns: nextStalledTurns,
    reachedThreshold:
      nextStalledTurns >= stalledTurnsThreshold,
  };
}