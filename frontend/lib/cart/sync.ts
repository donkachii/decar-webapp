import type { CartLine } from "./types";

// Keeps a signed-in buyer's cart the same on the website and in the phone app.
// Each keeps its own cart store (SKU and quantity only); the API holds the
// account's copy. Every change is saved (PUT /me/cart), the saved copy is
// re-read when the buyer comes back (GET /me/cart), and at sign-in a guest
// cart is merged in (POST /me/cart/merge). Saving never reserves a unit
// (CLAUDE.md section 7). The phone app imports this file, so no package imports.

/** The cart store fields this keeps in step. Persist all three. */
export interface SyncedCart {
  lines: CartLine[];
  /** The account these lines are saved to; null for a guest cart. */
  owner: string | null;
  /** Changes made while signed in that haven't reached the account yet. */
  unsaved: boolean;
}

/** A Zustand store fits this as it is. */
export interface SyncedCartStore {
  getState(): SyncedCart;
  setState(partial: Partial<SyncedCart>): void;
  subscribe(listener: (state: SyncedCart, previous: SyncedCart) => void): () => void;
}

/** The account's saved cart. Each call resolves to null once the session has ended. */
export interface SavedCartApi {
  load(): Promise<CartLine[] | null>;
  save(lines: CartLine[]): Promise<CartLine[] | null>;
  merge(lines: CartLine[]): Promise<CartLine[] | null>;
}

export interface CartSync {
  /** Who is signed in: an account id, or null for a guest. Call whenever it may have changed. */
  setUser(userId: string | null): void;
  /** Re-reads the account's cart, for when the buyer comes back to the page or app. */
  refresh(): Promise<void>;
}

/** Both carts in one; a part in both keeps the larger quantity, as the API's merge does. */
export function mergeLines(first: CartLine[], second: CartLine[]): CartLine[] {
  const qty = new Map(first.map((line) => [line.sku, line.qty]));
  for (const line of second) qty.set(line.sku, Math.max(line.qty, qty.get(line.sku) ?? 0));
  return [...qty].map(([sku, n]) => ({ sku, qty: n }));
}

export function startCartSync(store: SyncedCartStore, api: SavedCartApi): CartSync {
  let user: string | null | undefined; // undefined until the client knows who is signed in
  let edits = 0; // the buyer's changes, counted so a slow reply never undoes a newer one
  let applying = false;
  let queue = Promise.resolve();

  function apply(partial: Partial<SyncedCart>) {
    applying = true;
    try {
      store.setState(partial);
    } finally {
      applying = false;
    }
  }

  // One request at a time, in order. One that fails leaves `unsaved` set, and
  // the next refresh saves again.
  function enqueue(task: () => Promise<void>): Promise<void> {
    queue = queue.then(task).catch(() => undefined);
    return queue;
  }

  async function save() {
    const target = user;
    const state = store.getState();
    if (!target || state.owner !== target || !state.unsaved) return; // a later save already sent it
    const seen = edits;
    const saved = await api.save(state.lines);
    if (saved === null) return ended(target);
    if (user === target && edits === seen) apply({ lines: saved, unsaved: false });
  }

  async function pull() {
    const target = user;
    if (!target) return;
    const state = store.getState();
    if (state.owner !== target) return join(target);
    if (state.unsaved) return save();
    const seen = edits;
    const lines = await api.load();
    if (lines === null) return ended(target);
    if (user === target && edits === seen) apply({ lines });
  }

  // Signing in on this device: a guest cart joins the account's; lines left
  // by another account don't.
  async function join(target: string) {
    const state = store.getState();
    const seen = edits;
    const lines = state.owner === null ? await api.merge(state.lines) : await api.load();
    if (lines === null) return ended(target);
    if (user !== target) return;
    if (edits === seen) return apply({ lines, owner: target, unsaved: false });
    // The buyer changed the cart meanwhile: keep that too, and save it.
    apply({ lines: mergeLines(lines, store.getState().lines), owner: target, unsaved: true });
    await save();
  }

  function ended(target: string) {
    if (user === target) setUser(null);
  }

  function setUser(next: string | null) {
    if (next === user) return;
    user = next;
    if (next !== null) {
      void enqueue(pull);
    } else if (store.getState().owner !== null) {
      // Signed out: the cart stays saved to the account, and this device
      // goes back to an empty guest cart.
      apply({ lines: [], owner: null, unsaved: false });
    }
  }

  store.subscribe((state, previous) => {
    if (applying || state.lines === previous.lines) return;
    edits += 1;
    if (!user || state.owner !== user) return;
    if (!state.unsaved) apply({ unsaved: true });
    void enqueue(save);
  });

  return {
    setUser,
    refresh: () => (user ? enqueue(pull) : Promise.resolve()),
  };
}
