/**
 * A layer that cannot run on this machine by the user's setup, not by a fault (REL-02): its model is not
 * installed, say. An adapter throws it with how to turn the layer on; the scan records it as the tool's
 * `note` instead of an `error`, caches nothing for that layer, and the report is complete without it.
 */
export class LayerUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LayerUnavailableError";
  }
}
