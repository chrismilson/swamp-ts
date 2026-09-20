// SortedMultiset.test.ts
//
// Behavioral test suite for SortedMultiset (backed by a Swamp).
//   - Deno's built-in test runner (Deno.test)
//   - jsr:@std/expect for assertions
//   - npm:fast-check for property-based / model-based testing
//
// Run with:
//   deno test SortedMultiset.test.ts

import { SortedMultiset } from "./SortedMultiset.ts";
import { expect } from "jsr:@std/expect@^1.0.0";
import * as fc from "npm:fast-check@3.21.0";

// ---------------------------------------------------------------------------
// Comparators
// ---------------------------------------------------------------------------

const numCmp = (a: number, b: number) => a - b;
const strCmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sorted reference for a numeric array (duplicates preserved). */
const sorted = (xs: number[]): number[] => [...xs].sort(numCmp);

/**
 * Drains a multiset in ascending order by repeatedly removing its minimum.
 * This independently verifies `min` + `remove` + ordering in one sweep.
 * (Operations are persistent, so draining one value never mutates the source.)
 */
function drain<T>(sm: SortedMultiset<T>): T[] {
    const out: T[] = [];
    let cur = sm;
    let guard = 10_000;
    for (;;) {
        const m = cur.min;
        if (m === undefined) return out;
        if (--guard <= 0) throw new Error("drain() did not terminate");
        out.push(m);
        cur = cur.remove(m);
    }
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

type Cmd =
    | { op: "add"; v: number }
    | { op: "remove"; v: number }
    | { op: "remove_all"; v: number };

const cmdArb: fc.Arbitrary<Cmd> = fc.oneof(
    fc.record({
        op: fc.constant<"add">("add"),
        v: fc.integer({ min: -50, max: 50 }),
    }),
    fc.record({
        op: fc.constant<"remove">("remove"),
        v: fc.integer({ min: -50, max: 50 }),
    }),
    fc.record({
        op: fc.constant<"remove_all">("remove_all"),
        v: fc.integer({ min: -50, max: 50 }),
    }),
);

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

Deno.test("empty() has no min and no max", () => {
    const sm = SortedMultiset.empty(numCmp);
    expect(sm.min).toBeUndefined();
    expect(sm.max).toBeUndefined();
    expect(drain(sm)).toEqual([]);
});

Deno.test("remove() on an empty multiset returns the same instance", () => {
    const sm = SortedMultiset.empty(numCmp);
    expect(sm.remove(1)).toBe(sm);
    expect(sm.remove(-5)).toBe(sm);
});

Deno.test("remove_all() on an empty multiset stays empty", () => {
    const sm = SortedMultiset.empty(numCmp);
    const r = sm.remove_all(1);
    expect(r.min).toBeUndefined();
    expect(r.max).toBeUndefined();
    expect(drain(r)).toEqual([]);
});

Deno.test("of() creates a single-element multiset", () => {
    const sm = SortedMultiset.of(numCmp, 42);
    expect(sm.min).toBe(42);
    expect(sm.max).toBe(42);
    expect(drain(sm)).toEqual([42]);
});

Deno.test("from() with no values is empty", () => {
    const sm = SortedMultiset.from(numCmp, []);
    expect(sm.min).toBeUndefined();
    expect(sm.max).toBeUndefined();
});

Deno.test("from() sorts arbitrary input and preserves duplicates", () => {
    const sm = SortedMultiset.from(numCmp, [3, 1, 2, 3, 1, -4, 0, -4]);
    expect(drain(sm)).toEqual([-4, -4, 0, 1, 1, 2, 3, 3]);
});

Deno.test("from() accepts any iterable", () => {
    function* values(): Generator<number> {
        yield 5;
        yield 5;
        yield 1;
    }
    expect(drain(SortedMultiset.from(numCmp, values()))).toEqual([1, 5, 5]);
});

// ---------------------------------------------------------------------------
// add
// ---------------------------------------------------------------------------

Deno.test("add() inserts values in ascending order", () => {
    let sm = SortedMultiset.empty(numCmp);
    for (const v of [3, 1, 2, 0, -1]) sm = sm.add(v);
    expect(drain(sm)).toEqual([-1, 0, 1, 2, 3]);
});

Deno.test("add() keeps duplicates (count is preserved)", () => {
    let sm = SortedMultiset.empty(numCmp);
    sm = sm.add(2).add(2).add(1).add(2);
    expect(drain(sm)).toEqual([1, 2, 2, 2]);
});

Deno.test("add() builds the same multiset as from()", () => {
    const vals = [4, 1, 4, 3, 2, 1];
    let byAdd = SortedMultiset.empty(numCmp);
    for (const v of vals) byAdd = byAdd.add(v);
    expect(drain(byAdd)).toEqual(drain(SortedMultiset.from(numCmp, vals)));
});

Deno.test("add() returns a fresh instance and leaves the original unchanged", () => {
    const sm = SortedMultiset.of<number>(numCmp, 1);
    const next = sm.add(2);
    expect(next).not.toBe(sm);
    expect(drain(sm)).toEqual([1]);
    expect(drain(next)).toEqual([1, 2]);
});

// ---------------------------------------------------------------------------
// min / max
// ---------------------------------------------------------------------------

Deno.test("min and max track the extremes", () => {
    const sm = SortedMultiset.from(numCmp, [5, -3, 7, 1, 7, -3, 0]);
    expect(sm.min).toBe(-3);
    expect(sm.max).toBe(7);
});

Deno.test("min and max are non-destructive", () => {
    const sm = SortedMultiset.from(numCmp, [3, 1, 2]);
    expect(sm.min).toBe(1);
    expect(sm.min).toBe(1);
    expect(sm.max).toBe(3);
    expect(drain(sm)).toEqual([1, 2, 3]);
});

Deno.test("min and max with a single repeated value", () => {
    const sm = SortedMultiset.from(numCmp, [4, 4, 4]);
    expect(sm.min).toBe(4);
    expect(sm.max).toBe(4);
});

Deno.test("handles extreme integer values", () => {
    const big = 1_000_000_000_000;
    const sm = SortedMultiset.from(numCmp, [big, -big, 0, big]);
    expect(sm.min).toBe(-big);
    expect(sm.max).toBe(big);
    expect(drain(sm)).toEqual([-big, 0, big, big]);
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

Deno.test("remove() deletes exactly one occurrence", () => {
    const sm = SortedMultiset.from(numCmp, [1, 2, 2, 3]);
    expect(drain(sm.remove(2))).toEqual([1, 2, 3]);
});

Deno.test("remove() of the last remaining element empties the multiset", () => {
    const sm = SortedMultiset.of(numCmp, 5);
    const r = sm.remove(5);
    expect(r.min).toBeUndefined();
    expect(r.max).toBeUndefined();
    expect(drain(r)).toEqual([]);
});

Deno.test("remove() returns the same instance when the value is absent", () => {
    const sm = SortedMultiset.from(numCmp, [1, 2, 3]);
    expect(sm.remove(0)).toBe(sm);
    expect(sm.remove(4)).toBe(sm);
    expect(drain(sm)).toEqual([1, 2, 3]);
});

Deno.test("remove() returns a fresh instance when the value is present", () => {
    const sm = SortedMultiset.from(numCmp, [1, 2, 3]);
    expect(sm.remove(2)).not.toBe(sm);
});

Deno.test("remove() respects duplicate counts for the min", () => {
    const sm = SortedMultiset.from(numCmp, [1, 1, 2, 3]);
    expect(sm.remove(1).min).toBe(1); // one 1 remains
    expect(sm.remove(1).remove(1).min).toBe(2);
});

Deno.test("remove() of a middle value keeps min and max", () => {
    const sm = SortedMultiset.from(numCmp, [1, 2, 3]);
    const r = sm.remove(2);
    expect(r.min).toBe(1);
    expect(r.max).toBe(3);
    expect(drain(r)).toEqual([1, 3]);
});

// ---------------------------------------------------------------------------
// remove_all
// ---------------------------------------------------------------------------

Deno.test("remove_all() removes every occurrence", () => {
    const sm = SortedMultiset.from(numCmp, [1, 2, 2, 2, 3, 1]);
    expect(drain(sm.remove_all(2))).toEqual([1, 1, 3]);
    expect(drain(sm.remove_all(1))).toEqual([2, 2, 2, 3]);
});

Deno.test("remove_all() when absent leaves contents unchanged", () => {
    const sm = SortedMultiset.from(numCmp, [1, 2, 3]);
    expect(drain(sm.remove_all(9))).toEqual([1, 2, 3]);
});

Deno.test("remove_all() of the only distinct value empties the multiset", () => {
    const sm = SortedMultiset.from(numCmp, [7, 7, 7]);
    expect(drain(sm.remove_all(7))).toEqual([]);
});

// ---------------------------------------------------------------------------
// Persistence / immutability
// ---------------------------------------------------------------------------

Deno.test("operations never mutate the source multiset", () => {
    const base = SortedMultiset.from(numCmp, [1, 2, 3]);
    const a = base.add(4);
    const r = base.remove(1);
    const ra = base.remove_all(2);
    const missing = base.remove(9); // same instance
    expect(drain(base)).toEqual([1, 2, 3]);
    expect(drain(a)).toEqual([1, 2, 3, 4]);
    expect(drain(r)).toEqual([2, 3]);
    expect(drain(ra)).toEqual([1, 3]);
    expect(missing).toBe(base);
});

// ---------------------------------------------------------------------------
// Non-numeric element types
// ---------------------------------------------------------------------------

Deno.test("works with string values", () => {
    const sm = SortedMultiset.from(strCmp, [
        "pear",
        "apple",
        "banana",
        "apple",
    ]);
    expect(drain(sm)).toEqual(["apple", "apple", "banana", "pear"]);
    expect(sm.min).toBe("apple");
    expect(sm.max).toBe("pear");
    expect(sm.remove("pear").max).toBe("banana");
    expect(drain(sm.remove_all("apple"))).toEqual(["banana", "pear"]);
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

Deno.test("property: from() produces exactly the sorted multiset of its input", async () => {
    await fc.assert(
        fc.property(
            fc.array(fc.integer({ min: -1_000, max: 1_000 }), {
                maxLength: 200,
            }),
            (xs) => {
                const sm = SortedMultiset.from(numCmp, xs);
                expect(drain(sm)).toEqual(sorted(xs));
                if (xs.length === 0) {
                    expect(sm.min).toBeUndefined();
                    expect(sm.max).toBeUndefined();
                } else {
                    expect(sm.min).toBe(Math.min(...xs));
                    expect(sm.max).toBe(Math.max(...xs));
                }
            },
        ),
        { numRuns: 100 },
    );
});

Deno.test("property: from() and repeated add() agree", async () => {
    await fc.assert(
        fc.property(
            fc.array(fc.integer({ min: -100, max: 100 }), { maxLength: 100 }),
            (xs) => {
                let byAdd = SortedMultiset.empty(numCmp);
                for (const v of xs) byAdd = byAdd.add(v);
                const byFrom = SortedMultiset.from(numCmp, xs);
                expect(drain(byAdd)).toEqual(drain(byFrom));
            },
        ),
        { numRuns: 100 },
    );
});

Deno.test("property: add(v) then remove(v) restores the original contents", async () => {
    await fc.assert(
        fc.property(
            fc.array(fc.integer({ min: -100, max: 100 }), { maxLength: 100 }),
            fc.integer({ min: -10_000, max: 10_000 }),
            (xs, v) => {
                const sm = SortedMultiset.from(numCmp, xs);
                const roundTripped = sm.add(v).remove(v);
                expect(drain(roundTripped)).toEqual(sorted(xs));
            },
        ),
        { numRuns: 100 },
    );
});

Deno.test("property: removing a guaranteed-absent value is a no-op identity", async () => {
    await fc.assert(
        fc.property(
            fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: 100 }),
            fc.integer({ min: 1000, max: 2000 }),
            (xs, v) => {
                const sm = SortedMultiset.from(numCmp, xs);
                const next = sm.remove(v);
                expect(next).toBe(sm);
                expect(drain(next)).toEqual(sorted(xs));
            },
        ),
        { numRuns: 100 },
    );
});

Deno.test(
    "property: random add/remove/remove_all sequences stay consistent with a reference model",
    async () => {
        await fc.assert(
            fc.property(fc.array(cmdArb, { maxLength: 80 }), (cmds) => {
                let sm = SortedMultiset.empty(numCmp);
                let model: number[] = [];
                let step = 0;

                for (const c of cmds) {
                    if (c.op === "add") {
                        sm = sm.add(c.v);
                        model.push(c.v);
                    } else if (c.op === "remove") {
                        const next = sm.remove(c.v);
                        const idx = model.indexOf(c.v);
                        if (idx === -1) {
                            expect(next).toBe(sm); // absent ⇒ same instance
                        } else {
                            model.splice(idx, 1);
                            sm = next;
                        }
                    } else {
                        sm = sm.remove_all(c.v);
                        model = model.filter((x) => x !== c.v);
                    }

                    // The multiset must always mirror the model's min and max.
                    const ref = sorted(model);
                    expect(sm.min).toBe(ref[0] ?? undefined);
                    expect(sm.max).toBe(ref[ref.length - 1] ?? undefined);

                    // Periodically verify the full ordered contents too.
                    if (++step % 7 === 0) expect(drain(sm)).toEqual(ref);
                }

                // Finally, the fully drained contents must match the model.
                expect(drain(sm)).toEqual(sorted(model));
            }),
            { numRuns: 150 },
        );
    },
);
