// ---------------------------------------------------------------------------
// BotSlots -- tracks which player slots (2-5, the same numbering PhoneNet
// uses for P3-P6) are currently filled by a CPU bot instead of a phone. This
// is local-only state (no network involved) so a lobby can fill empty seats
// for testing multiplayer matches without needing that many humans/phones.
//
// A slot is either a phone (PhoneNet) or a bot (this), never both -- callers
// are responsible for picking a slot that isn't already claimed by the other.
// ---------------------------------------------------------------------------
class BotSlots {
  constructor() {
    this.slots = new Set();
  }

  /** Claims the lowest slot in [2,5] not already in `taken`. Returns the slot, or null if none free. */
  add(taken) {
    for (let slot = 2; slot <= 5; slot++) {
      if (!taken.has(slot) && !this.slots.has(slot)) {
        this.slots.add(slot);
        return slot;
      }
    }
    return null;
  }

  /** Removes the highest-numbered bot slot (undo-last-add). Returns the removed slot, or null if there were none. */
  removeLast() {
    if (this.slots.size === 0) return null;
    const slot = Math.max(...this.slots);
    this.slots.delete(slot);
    return slot;
  }

  remove(slot) {
    this.slots.delete(slot);
  }

  hasSlot(slot) {
    return this.slots.has(slot);
  }

  get connectedSlots() {
    return [...this.slots].sort((a, b) => a - b);
  }

  clear() {
    this.slots.clear();
  }
}

export const botSlots = new BotSlots();
