/**
 * Test suite for the immutable `Deque<T>`.
 *
 * Run with:
 *   deno test deque.test.ts        (or just: deno test)
 *
 * Dependencies are resolved automatically from the URL specifiers:
 *   - jsr:@std/expect   -> assertions (expect(...))
 *   - npm:fast-check    -> property-based testing
 *
 * If `Deque` lives in a different file, update the import below.
 */
import { Deque } from "./Deque.ts";
import { expect } from "jsr:@std/expect@^1.0.0";
import * as fc from "npm:fast-check@^3.21.0";

/* ------------------------------------------------------------------ *
 * Helpers — built only on the public API, so they also guard against
 * broken internals (a correct `toArray` needs correct pop/popFront).
 * ------------------------------------------------------------------ */

/** Reconstruct the full sequence of a Deque using only its public API. */
function toArray<T>(deque: Deque<T>): T[] {
    const out: T[] = [];
    let d = deque;
    while (d.length > 0) {
        out.push(d.peekFront() as T);
        d = d.popFront();
    }
    return out;
}

/** Immutable snapshot of a deque, for persistence/immutability checks. */
function snapshot<T>(deque: Deque<T>): { length: number; values: T[] } {
    return { length: deque.length, values: toArray(deque) };
}

/* ------------------------------------------------------------------ *
 * Constructors
 * ------------------------------------------------------------------ */

Deno.test("Deque.empty() is empty and peeks return undefined", () => {
    const d = Deque.empty<number>();
    expect(d.length).toBe(0);
    expect(d.peek()).toBeUndefined();
    expect(d.peekFront()).toBeUndefined();
});

Deno.test("Deque.of(x) holds one element visible at both ends", () => {
    const d = Deque.of(7);
    expect(d.length).toBe(1);
    expect(d.peek()).toBe(7);
    expect(d.peekFront()).toBe(7);
});

Deno.test("Deque.from(array) preserves order", () => {
    const d = Deque.from([1, 2, 3]);
    expect(d.length).toBe(3);
    expect(toArray(d)).toEqual([1, 2, 3]);
    expect(d.peek()).toBe(3); // back / last
    expect(d.peekFront()).toBe(1); // front / first
});

Deno.test("Deque.from([]) is empty", () => {
    const d = Deque.from<number>([]);
    expect(d.length).toBe(0);
    expect(d.peek()).toBeUndefined();
    expect(d.peekFront()).toBeUndefined();
});

Deno.test("Deque.from accepts any iterable (Set, generator, string)", () => {
    expect(toArray(Deque.from(new Set([1, 2, 3])))).toEqual([1, 2, 3]);

    function* gen() {
        yield 10;
        yield 20;
        yield 30;
    }
    expect(toArray(Deque.from(gen()))).toEqual([10, 20, 30]);

    expect(toArray(Deque.from("abc"))).toEqual(["a", "b", "c"]);
});

/* ------------------------------------------------------------------ *
 * push / pushFront
 * ------------------------------------------------------------------ */

Deno.test("push appends to the back", () => {
    const d = Deque.from([1, 2]).push(3);
    expect(d.length).toBe(3);
    expect(d.peek()).toBe(3);
    expect(d.peekFront()).toBe(1);
    expect(toArray(d)).toEqual([1, 2, 3]);
});

Deno.test("pushFront prepends to the front", () => {
    const d = Deque.from([1, 2]).pushFront(0);
    expect(d.length).toBe(3);
    expect(d.peekFront()).toBe(0);
    expect(d.peek()).toBe(2);
    expect(toArray(d)).toEqual([0, 1, 2]);
});

Deno.test("repeated pushes accumulate like building an array", () => {
    let back = Deque.empty<number>();
    for (const x of [1, 2, 3]) back = back.push(x);
    expect(toArray(back)).toEqual([1, 2, 3]);

    let front = Deque.empty<number>();
    for (const x of [1, 2, 3]) front = front.pushFront(x);
    expect(toArray(front)).toEqual([3, 2, 1]); // each lands at the front
});

Deno.test("push/pushFront never mutate the original deque", () => {
    const orig = Deque.from([1, 2]);
    const before = snapshot(orig);

    const viaBack = orig.push(3);
    const viaFront = orig.pushFront(0);

    expect(snapshot(orig)).toEqual(before); // original is intact
    expect(toArray(viaBack)).toEqual([1, 2, 3]);
    expect(toArray(viaFront)).toEqual([0, 1, 2]);

    // Derived deques are also independent of each other.
    expect(toArray(viaBack.push(4))).toEqual([1, 2, 3, 4]);
    expect(toArray(viaBack)).toEqual([1, 2, 3]);
});

/* ------------------------------------------------------------------ *
 * peek / peekFront
 * ------------------------------------------------------------------ */

Deno.test("peek/peekFront read the correct ends", () => {
    const d = Deque.from([10, 20, 30]);
    expect(d.peek()).toBe(30);
    expect(d.peekFront()).toBe(10);
});

Deno.test("peek/peekFront do not modify the deque", () => {
    const d = Deque.from([1, 2, 3]);
    d.peek();
    d.peekFront();
    expect(toArray(d)).toEqual([1, 2, 3]);
    expect(d.length).toBe(3);
});

Deno.test("a stored `undefined` value is distinguishable from empty", () => {
    const d = Deque.of<undefined>(undefined);
    expect(d.length).toBe(1); // non-empty, even though peek() is undefined
    expect(d.peek()).toBeUndefined();
    expect(d.peekFront()).toBeUndefined();
    expect(d.pop().length).toBe(0);
});

/* ------------------------------------------------------------------ *
 * pop / popFront
 * ------------------------------------------------------------------ */

Deno.test("pop removes the back element", () => {
    const d = Deque.from([1, 2, 3]).pop();
    expect(d.length).toBe(2);
    expect(toArray(d)).toEqual([1, 2]);
    expect(d.peek()).toBe(2);
});

Deno.test("popFront removes the front element", () => {
    const d = Deque.from([1, 2, 3]).popFront();
    expect(d.length).toBe(2);
    expect(toArray(d)).toEqual([2, 3]);
    expect(d.peekFront()).toBe(2);
});

Deno.test("pop()/popFront() on an empty deque return the same instance", () => {
    const empty = Deque.empty<number>();
    expect(empty.pop()).toBe(empty);
    expect(empty.popFront()).toBe(empty);
    // ...and stay empty
    expect(empty.pop().length).toBe(0);
    expect(empty.popFront().length).toBe(0);
});

Deno.test("pop/popFront never mutate the original deque", () => {
    const orig = Deque.from([1, 2, 3]);
    const before = snapshot(orig);

    const withoutBack = orig.pop();
    const withoutFront = orig.popFront();

    expect(snapshot(orig)).toEqual(before);
    expect(toArray(withoutBack)).toEqual([1, 2]);
    expect(toArray(withoutFront)).toEqual([2, 3]);
});

Deno.test("chained pops drain the deque from the correct ends", () => {
    const fromBack = Deque.from([1, 2, 3]).pop().pop().pop();
    expect(fromBack.length).toBe(0);
    expect(fromBack.peek()).toBeUndefined();

    const fromFront = Deque.from([1, 2, 3]).popFront().popFront().popFront();
    expect(fromFront.length).toBe(0);

    const mixed = Deque.from([1, 2, 3, 4]).pop().popFront(); // [2, 3]
    expect(toArray(mixed)).toEqual([2, 3]);
});

Deno.test("objects are carried through by reference (no cloning)", () => {
    const front = { tag: "front" };
    const back = { tag: "back" };

    const d = Deque.of(front).push(back);
    expect(d.peekFront()).toBe(front);
    expect(d.peek()).toBe(back);
    expect(d.pop().peek()).toBe(front); // back removed, front reference intact
});

/* ------------------------------------------------------------------ *
 * concat
 * ------------------------------------------------------------------ */

Deno.test("concat joins two deques preserving order", () => {
    const a = Deque.from([1, 2]);
    const b = Deque.from([3, 4]);
    const c = a.concat(b);
    expect(c.length).toBe(4);
    expect(toArray(c)).toEqual([1, 2, 3, 4]);
});

Deno.test("concat with an empty deque (both sides)", () => {
    const empty = Deque.empty<number>();
    const d = Deque.from([1, 2]);

    expect(toArray(d.concat(empty))).toEqual([1, 2]);
    expect(toArray(empty.concat(d))).toEqual([1, 2]);
    expect(toArray(empty.concat(empty))).toEqual([]);
    expect(empty.concat(empty).length).toBe(0);
});

Deno.test("concat does not mutate its operands", () => {
    const a = Deque.from([1, 2]);
    const b = Deque.from([3]);
    const beforeA = snapshot(a);
    const beforeB = snapshot(b);

    const c = a.concat(b);
    expect(toArray(c)).toEqual([1, 2, 3]);

    expect(snapshot(a)).toEqual(beforeA);
    expect(snapshot(b)).toEqual(beforeB);
});

Deno.test("concat composes with push/pop", () => {
    const a = Deque.from([1]).push(2); // [1, 2]
    const b = Deque.from([4, 5]).pushFront(3); // [3, 4, 5]
    const c = a.concat(b); // [1, 2, 3, 4, 5]

    expect(toArray(c)).toEqual([1, 2, 3, 4, 5]);
    expect(toArray(c.pop().pop())).toEqual([1, 2, 3]);
    expect(c.popFront().peekFront()).toBe(2);
    expect(c.popFront().peek()).toBe(5);
});

/* ------------------------------------------------------------------ *
 * Larger / stress sanity
 * ------------------------------------------------------------------ */

Deno.test("a 10_000-element deque keeps the correct shape", () => {
    const n = 10_000;
    let d = Deque.empty<number>();
    for (let i = 0; i < n; i++) d = d.push(i);
    for (let i = 0; i < n; i++) d = d.pushFront(-i - 1);

    expect(d.length).toBe(2 * n);
    expect(d.peek()).toBe(n - 1);
    expect(d.peekFront()).toBe(-n);

    expect(d.popFront().peekFront()).toBe(-n + 1);
    expect(d.pop().peek()).toBe(n - 2);
});

/* ------------------------------------------------------------------ *
 * Property-based tests (fast-check)
 * ------------------------------------------------------------------ */

type Op =
    | { kind: "push"; value: number }
    | { kind: "pushFront"; value: number }
    | { kind: "pop" }
    | { kind: "popFront" };

/** Arbitrary single deque operation. */
const opArb: fc.Arbitrary<Op> = fc.oneof(
    fc.record({ kind: fc.constant<"push">("push"), value: fc.integer() }),
    fc.record({
        kind: fc.constant<"pushFront">("pushFront"),
        value: fc.integer(),
    }),
    fc.record({ kind: fc.constant<"pop">("pop") }),
    fc.record({ kind: fc.constant<"popFront">("popFront") }),
);

/** Model-based: thousands of random op sequences against an array model. */
Deno.test("property: deque always matches an array model under random ops", () => {
    fc.assert(
        fc.property(fc.array(opArb, { maxLength: 2000 }), (ops) => {
            let deque = Deque.empty<number>();
            const model: number[] = [];

            for (const op of ops) {
                switch (op.kind) {
                    case "push":
                        deque = deque.push(op.value);
                        model.push(op.value);
                        break;
                    case "pushFront":
                        deque = deque.pushFront(op.value);
                        model.unshift(op.value);
                        break;
                    case "pop":
                        deque = deque.pop();
                        model.pop();
                        break;
                    case "popFront":
                        deque = deque.popFront();
                        model.shift();
                        break;
                }

                // Invariants must hold after *every* single operation.
                expect(deque.length).toBe(model.length);
                expect(deque.peek()).toBe(model.at(-1));
                expect(deque.peekFront()).toBe(model[0]);
            }

            // And the full contents must match at the end.
            expect(toArray(deque)).toEqual(model);
        }),
        { numRuns: 5000 },
    );
});

/** concat must behave exactly like array concatenation. */
Deno.test("property: concat equals array concatenation", () => {
    fc.assert(
        fc.property(
            fc.array(fc.integer()),
            fc.array(fc.integer()),
            (xs, ys) => {
                const c = Deque.from(xs).concat(Deque.from(ys));
                expect(c.length).toBe(xs.length + ys.length);
                expect(toArray(c)).toEqual([...xs, ...ys]);
            },
        ),
        { numRuns: 3000 },
    );
});

/** Operations on a deque must never mutate the original (persistence). */
Deno.test("property: applying ops never mutates the base deque", () => {
    fc.assert(
        fc.property(
            fc.array(fc.integer(), { maxLength: 50 }),
            fc.array(opArb, { maxLength: 20 }),
            (init, ops) => {
                const base = Deque.from(init);
                const before = snapshot(base);

                let d = base;
                for (const op of ops) {
                    switch (op.kind) {
                        case "push":
                            d = d.push(op.value);
                            break;
                        case "pushFront":
                            d = d.pushFront(op.value);
                            break;
                        case "pop":
                            d = d.pop();
                            break;
                        case "popFront":
                            d = d.popFront();
                            break;
                    }
                }
                expect(snapshot(base)).toEqual(before);
            },
        ),
        { numRuns: 3000 },
    );
});

/** Pushing n elements and popping them again restores the original. */
Deno.test("property: push(n)+pop(n) round-trip restores the original", () => {
    fc.assert(
        fc.property(
            fc.array(fc.integer()),
            fc.integer({ min: 0, max: 400 }),
            (init, n) => {
                const base = Deque.from(init);
                const before = snapshot(base);

                let back = base;
                for (let i = 0; i < n; i++) back = back.push(i);
                for (let i = 0; i < n; i++) back = back.pop();
                expect(back.length).toBe(before.length);
                expect(toArray(back)).toEqual(before.values);

                let front = base;
                for (let i = 0; i < n; i++) front = front.pushFront(i);
                for (let i = 0; i < n; i++) front = front.popFront();
                expect(front.length).toBe(before.length);
                expect(toArray(front)).toEqual(before.values);
            },
        ),
        { numRuns: 3000 },
    );
});
