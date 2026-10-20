/**
 * Errors caused by what the user or agent gave Dustmap — a diff base that does not exist, a damaged
 * decisions.yml or baseline.json — as opposed to Dustmap bugs. The CLI maps these to exit 2 (usage /
 * config); anything else is an internal error (exit 3). Exit 1 stays reserved for the ratchet.
 */
export class UserInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserInputError";
  }
}
