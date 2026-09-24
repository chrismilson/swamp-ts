// PriorityQueue.test.ts
//
// Behavioral test suite for PriorityQueue (backed by a Swamp / FingerTree).
//   - Deno's built-in test runner (Deno.test)
//   - jsr:@std/expect for assertions
//   - npm:fast-check for property-based / model-based testing
//
// Semantics under test:
//   - `peek()` returns the value with the highest numeric priority.
//   - Ties in priority are resolved in FIFO order: the element pushed
//     (added) first wins, so peek/pop are consistent and deterministic.
//   - All operations are persistent; they never mutate the source queue.
//
// Run with:
//   deno test PriorityQueue.test.ts

import { PriorityQueue } from "./PriorityQueue.ts";
import { expect } from "jsr:@std/expect@^1.0.0";
import * as fc from "npm:fast-check@3.21.0";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Drains a queue by repeatedly peeking the highest-priority element and
 * popping it. This independently verifies `peek` + `pop` + ordering in one
 * sweep. (Operations are persistent, so popping never mutates the source.)
 */
function drain<T>(pq: PriorityQueue<T>): T[] {
    const out: T[] = [];
    let cur = pq;
    let guard = 10_000;
    for (;;) {
        const v = cur.peek();
        if (v === undefined) return out;
        if (--guard <= 0) throw new Error("drain() did not terminate");
        out.push(v);
        cur = cur.pop();
    }
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

type Cmd =
    | { op: "add"; v: number; p: number }
    | { op: "pop" };

const cmdArb: fc.Arbitrary<Cmd> = fc.oneof(
    fc.record({
        op: fc.constant<"add">("add"),
        v: fc.integer({ min: -50, max: 50 }),
        p: fc.integer({ min: -100, max: 100 }),
    }),
    fc.record({ op: fc.constant<"pop">("pop") }),
);

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

Deno.test("empty() has no peak", () => {
    const pq = PriorityQueue.empty<number>();
    expect(pq.peek()).toBeUndefined();
    expect(drain(pq)).toEqual([]);
});

Deno.test("pop() on an empty queue returns the same instance", () => {
    const pq = PriorityQueue.empty<number>();
    expect(pq.pop()).toBe(pq);
});

Deno.test("of() creates a single-element queue", () => {
    const pq = PriorityQueue.of("only", 42);
    expect(pq.peek()).toBe("only");
    expect(drain(pq)).toEqual(["only"]);
});

Deno.test("from() with no entries is empty", () => {
    const pq = PriorityQueue.from<number>([]);
    expect(pq.peek()).toBeUndefined();
    expect(drain(pq)).toEqual([]);
});

Deno.test("from() accepts any iterable", () => {
    function* entries(): Generator<[string, number]> {
        yield ["b", 2];
        yield ["a", 3];
        yield ["a", 3];
    }
    const pq = PriorityQueue.from(entries());
    expect(pq.peek()).toBe("a");
    expect(drain(pq)).toEqual(["a", "a", "b"]);
});

// ---------------------------------------------------------------------------
// add
// ---------------------------------------------------------------------------

Deno.test("add() pops in decreasing priority order", () => {
    let pq = PriorityQueue.empty<string>();
    pq = pq.add("mid", 5);
    pq = pq.add("low", 1);
    pq = pq.add("high", 9);
    expect(drain(pq)).toEqual(["high", "mid", "low"]);
});

Deno.test("add() keeps equal priorities in FIFO order", () => {
    let pq = PriorityQueue.empty<string>();
    pq = pq.add("first", 7);
    pq = pq.add("second", 7);
    pq = pq.add("third", 7);
    expect(drain(pq)).toEqual(["first", "second", "third"]);
});

Deno.test("add() builds the same queue as from()", () => {
    const entries: Array<[string, number]> = [
        ["a", 5],
        ["b", 9],
        ["a", 5],
        ["c", 2],
    ];
    let byAdd = PriorityQueue.empty<string>();
    for (const [v, p] of entries) byAdd = byAdd.add(v, p);
    expect(drain(byAdd)).toEqual(drain(PriorityQueue.from(entries)));
});

Deno.test("add() returns a fresh instance and leaves the original unchanged", () => {
    const pq = PriorityQueue.of("a", 5);
    const next = pq.add("b", 9);
    expect(next).not.toBe(pq);
    expect(drain(pq)).toEqual(["a"]);
    expect(drain(next)).toEqual(["b", "a"]);
});

// ---------------------------------------------------------------------------
// peek
// ---------------------------------------------------------------------------

Deno.test("peek() returns the highest-priority value", () => {
    const pq = PriorityQueue.from([
        ["a", 3],
        ["b", 8],
        ["c", 5],
    ]);
    expect(pq.peek()).toBe("b");
});

Deno.test("peek() is non-destructive", () => {
    const pq = PriorityQueue.from([
        ["a", 3],
        ["b", 8],
    ]);
    expect(pq.peek()).toBe("b");
    expect(pq.peek()).toBe("b");
    expect(drain(pq)).toEqual(["b", "a"]);
});

Deno.test("peek() breaks ties toward the earliest-pushed element", () => {
    const pq = PriorityQueue.from([
        ["earlier", 5],
        ["later", 5],
    ]);
    expect(pq.peek()).toBe("earlier");
});

// ---------------------------------------------------------------------------
// pop
// ---------------------------------------------------------------------------

Deno.test("pop() removes exactly the peeked element", () => {
    const pq = PriorityQueue.from([
        ["a", 3],
        ["b", 8],
        ["c", 5],
    ]);
    expect(pq.peek()).toBe("b");
    expect(pq.pop().peek()).toBe("c");
});

Deno.test("pop() respects FIFO among equal priorities", () => {
    let pq = PriorityQueue.empty<string>();
    pq = pq.add("first", 4);
    pq = pq.add("second", 4);
    pq = pq.add("third", 4);
    expect(pq.pop().peek()).toBe("second");
    expect(pq.pop().pop().peek()).toBe("third");
    expect(pq.pop().pop().pop().peek()).toBeUndefined();
});

Deno.test("pop() of the last remaining element empties the queue", () => {
    const pq = PriorityQueue.of("only", 7);
    const r = pq.pop();
    expect(r.peek()).toBeUndefined();
    expect(drain(r)).toEqual([]);
});

Deno.test("pop() returns a fresh instance when the queue is non-empty", () => {
    const pq = PriorityQueue.of("a", 1);
    expect(pq.pop()).not.toBe(pq);
});

// ---------------------------------------------------------------------------
// Tie-breaking (FIFO among equal priorities)
// ---------------------------------------------------------------------------

Deno.test("ties are not reshuffled by later lower-priority inserts", () => {
    let pq = PriorityQueue.empty<string>();
    pq = pq.add("job-a", 5);
    pq = pq.add("job-b", 5);
    pq = pq.add("low", 1);
    pq = pq.add("job-c", 5);
    expect(drain(pq)).toEqual(["job-a", "job-b", "job-c", "low"]);
});

Deno.test("ties are resolved independently within each priority tier", () => {
    let pq = PriorityQueue.empty<string>();
    pq = pq.add("b1", 100);
    pq = pq.add("a1", 200);
    pq = pq.add("b2", 100);
    pq = pq.add("a2", 200);
    expect(drain(pq)).toEqual(["a1", "a2", "b1", "b2"]);
});

Deno.test("a tied element is not skipped when a higher priority arrives later", () => {
    let pq = PriorityQueue.empty<string>();
    pq = pq.add("tie-1", 5);
    pq = pq.add("tie-2", 5);
    pq = pq.add("urgent", 100);
    pq = pq.add("tie-3", 5);
    expect(drain(pq)).toEqual(["urgent", "tie-1", "tie-2", "tie-3"]);
});

// ---------------------------------------------------------------------------
// Persistence / immutability
// ---------------------------------------------------------------------------

Deno.test("operations never mutate the source queue", () => {
    const base = PriorityQueue.from([
        ["a", 1],
        ["b", 3],
        ["c", 2],
    ]);
    const added = base.add("d", 5);
    const popped = base.pop();
    expect(drain(base)).toEqual(["b", "c", "a"]);
    expect(drain(added)).toEqual(["d", "b", "c", "a"]);
    expect(drain(popped)).toEqual(["c", "a"]);
});

// ---------------------------------------------------------------------------
// Non-numeric value types & priority extremes
// ---------------------------------------------------------------------------

Deno.test("works with object values", () => {
    const a = { id: "a" };
    const b = { id: "b" };
    const c = { id: "c" };
    const pq = PriorityQueue.from([
        [b, 1],
        [a, 2],
        [c, 1],
    ]);
    expect(pq.peek()).toBe(a);
    expect(drain(pq)).toEqual([a, b, c]);
});

Deno.test("handles negative and zero priorities", () => {
    const pq = PriorityQueue.from([
        ["pos", 5],
        ["zero", 0],
        ["neg", -5],
    ]);
    expect(pq.peek()).toBe("pos");
    expect(drain(pq)).toEqual(["pos", "zero", "neg"]);
});

Deno.test("handles extreme priority values", () => {
    const big = 1_000_000_000_000;
    const pq = PriorityQueue.from([
        ["small", -big],
        ["big", big],
        ["zero", 0],
        ["also-big", big],
    ]);
    expect(pq.peek()).toBe("big");
    expect(drain(pq)).toEqual(["big", "also-big", "zero", "small"]);
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

Deno.test("property: from() pops exactly in (-priority, arrival) order", async () => {
    await fc.assert(
        fc.property(
            fc.array(fc.record({ p: fc.integer({ min: -100, max: 100 }) }), {
                maxLength: 200,
            }),
            (entries) => {
                const entries2 = entries.map(
                    (e, i) => [i, e.p] as [number, number],
                );
                const pq = PriorityQueue.from(entries2);
                const expected = entries2
                    .map(([v, p], i) => ({ v, p, i }))
                    .sort((a, b) => b.p - a.p || a.i - b.i)
                    .map((x) => x.v);
                expect(drain(pq)).toEqual(expected);
                expect(pq.peek()).toBe(expected[0] ?? undefined);
            },
        ),
        { numRuns: 100 },
    );
});

Deno.test("property: from() and repeated add() agree", async () => {
    await fc.assert(
        fc.property(
            fc.array(fc.record({ p: fc.integer({ min: -100, max: 100 }) }), {
                maxLength: 100,
            }),
            (entries) => {
                const entries2 = entries.map(
                    (e, i) => [i, e.p] as [number, number],
                );
                let byAdd = PriorityQueue.empty<number>();
                for (const [v, p] of entries2) byAdd = byAdd.add(v, p);
                const byFrom = PriorityQueue.from(entries2);
                expect(drain(byAdd)).toEqual(drain(byFrom));
                expect(byAdd.peek()).toBe(byFrom.peek());
            },
        ),
        { numRuns: 100 },
    );
});

Deno.test("property: popping a non-empty queue removes the peeked element", async () => {
    await fc.assert(
        fc.property(
            fc.array(fc.record({ p: fc.integer({ min: -100, max: 100 }) }), {
                maxLength: 100,
            }),
            (entries) => {
                const entries2 = entries.map(
                    (e, i) => [i, e.p] as [number, number],
                );
                const pq = PriorityQueue.from(entries2);
                if (entries2.length === 0) {
                    expect(pq.pop()).toBe(pq);
                    return;
                }
                const expected = entries2
                    .map(([v, p], i) => ({ v, p, i }))
                    .sort((a, b) => b.p - a.p || a.i - b.i)
                    .map((x) => x.v);
                expect(pq.peek()).toBe(expected[0]);
                const rest = pq.pop();
                const expectedRest = expected.slice(1);
                expect(rest.peek()).toBe(expectedRest[0] ?? undefined);
                expect(drain(rest)).toEqual(expectedRest);
            },
        ),
        { numRuns: 100 },
    );
});

Deno.test("property: heavy ties drain in strict FIFO within each priority", async () => {
    await fc.assert(
        fc.property(
            fc.array(fc.integer({ min: 0, max: 9 }), { maxLength: 150 }),
            (priorities) => {
                const entries2 = priorities.map(
                    (p, i) => [i, p] as [number, number],
                );
                const pq = PriorityQueue.from(entries2);
                const expected = entries2
                    .map(([v, p], i) => ({ v, p, i }))
                    .sort((a, b) => b.p - a.p || a.i - b.i)
                    .map((x) => x.v);
                expect(drain(pq)).toEqual(expected);
            },
        ),
        { numRuns: 100 },
    );
});

Deno.test(
    "property: random add/pop sequences stay consistent with a reference model",
    async () => {
        await fc.assert(
            fc.property(fc.array(cmdArb, { maxLength: 80 }), (cmds) => {
                let pq = PriorityQueue.empty<number>();
                let model: Array<{ v: number; p: number; seq: number }> = [];
                let seq = 0;
                let step = 0;

                const headOf = (m: typeof model) =>
                    m.reduce(
                        (best, e) =>
                            e.p > best.p ||
                                (e.p === best.p && e.seq < best.seq)
                                ? e
                                : best,
                        m[0],
                    );

                for (const c of cmds) {
                    if (c.op === "add") {
                        pq = pq.add(c.v, c.p);
                        model.push({ v: c.v, p: c.p, seq: seq++ });
                    } else {
                        if (model.length === 0) {
                            expect(pq.pop()).toBe(pq); // empty ⇒ same instance
                        } else {
                            const head = headOf(model);
                            pq = pq.pop();
                            model = model.filter((e) => e !== head);
                        }
                    }

                    // The queue must always mirror the model's head.
                    expect(pq.peek()).toBe(
                        model.length === 0 ? undefined : headOf(model).v,
                    );

                    // Periodically verify the full ordered contents too.
                    if (++step % 7 === 0) {
                        expect(drain(pq)).toEqual(
                            [...model]
                                .sort((a, b) => b.p - a.p || a.seq - b.seq)
                                .map((e) => e.v),
                        );
                    }
                }

                // Finally, the fully drained contents must match the model.
                expect(drain(pq)).toEqual(
                    [...model]
                        .sort((a, b) => b.p - a.p || a.seq - b.seq)
                        .map((e) => e.v),
                );
            }),
            { numRuns: 150 },
        );
    },
);
