// IntervalTree.test.ts
//
// Behavioral test suite for IntervalTree (backed by a Swamp).
//   - Deno's built-in test runner (Deno.test)
//   - jsr:@std/expect for assertions
//   - npm:fast-check for property-based / model-based testing
//
// Run with:
//   deno test IntervalTree.test.ts
//
// Assumptions encoded here (adjust if the implementation differs):
//   - Interval is { start: number; end: number } with start < end, i.e. the
//     half-open range [start, end).
//   - The tree is a multiset of intervals: identical intervals may appear more
//     than once, mirroring the SortedMultiset sibling.
//   - Overlap is half-open: a and b overlap iff a.start < b.end && b.start < a.end,
//     so [1,3) and [3,5) do NOT overlap; a point of contact is not an overlap.
//   - Iteration visits intervals sorted ONLY by start. The order of intervals
//     sharing the same start is unspecified. search() returns the first
//     overlapping interval in that iteration order, so it is deterministic in
//     start only (the returned interval always has the minimal start among the
//     overlapping intervals). match() returns the overlapping sub-multiset.

import { Interval, IntervalTree } from "./IntervalTree.ts";
import { expect } from "jsr:@std/expect@^1.0.0";
import * as fc from "npm:fast-check@3.21.0";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a half-open interval; start must be < end. */
const iv = (start: number, end: number): Interval => ({ start, end });

/** Half-open overlap: [a.start, a.end) ∩ [b.start, b.end) ≠ ∅. */
const overlaps = (a: Interval, b: Interval): boolean =>
    a.start < b.end && b.start < a.end;

/**
 * Canonical form (start, then end) used ONLY for multiset comparison.
 * The end tiebreak here is a convenience for comparing values; it does NOT
 * assert that the tree orders equal-start intervals by end.
 */
const canonical = (xs: Iterable<Interval>): Interval[] =>
    [...xs].map((x) => ({ ...x })).sort((a, b) =>
        a.start - b.start || a.end - b.end
    );

/** True iff iteration starts are non-decreasing (the only order the tree guarantees). */
const isStartAscending = (xs: Iterable<Interval>): boolean => {
    let prev = Number.NEGATIVE_INFINITY;
    for (const i of xs) {
        if (i.start < prev) return false;
        prev = i.start;
    }
    return true;
};

/** Raw iterator output of a tree. */
const contentsOf = (tree: IntervalTree): Interval[] => [...tree];

/**
 * Assert the tree's contents equal `expected` as a multiset, and that iteration
 * is sorted by start. Order within an equal-start group is intentionally not
 * asserted (it is unspecified).
 */
function expectTree(tree: IntervalTree, expected: Interval[]): void {
    const got = [...tree];
    expect(isStartAscending(got)).toBe(true);
    expect(canonical(got)).toEqual(canonical(expected));
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const ivArb: fc.Arbitrary<Interval> = fc
    .tuple(
        fc.integer({ min: -50, max: 50 }), // start
        fc.integer({ min: 1, max: 20 }), // length >= 1 keeps start < end
    )
    .map(([start, len]) => iv(start, start + len));

type Cmd =
    | { op: "add"; iv: Interval }
    | { op: "search"; q: Interval }
    | { op: "match"; q: Interval }
    | { op: "merge"; seed: Interval[] };

const cmdArb: fc.Arbitrary<Cmd> = fc.oneof(
    fc.record({ op: fc.constant<"add">("add"), iv: ivArb }),
    fc.record({ op: fc.constant<"search">("search"), q: ivArb }),
    fc.record({ op: fc.constant<"match">("match"), q: ivArb }),
    fc.record({
        op: fc.constant<"merge">("merge"),
        seed: fc.array(ivArb, { maxLength: 6 }),
    }),
);

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

Deno.test("empty() iterates nothing and is empty to every query", () => {
    const tree = IntervalTree.empty();
    expect(contentsOf(tree)).toEqual([]);
    expect(contentsOf(tree.match(iv(0, 1)))).toEqual([]);
    expect(tree.search(iv(0, 1))).toBeUndefined();
    expect(tree.search(iv(-10_000, 10_000))).toBeUndefined();
});

Deno.test("of() creates a single-interval tree", () => {
    const tree = IntervalTree.of(iv(2, 5));
    expectTree(tree, [iv(2, 5)]);
    expect(tree.search(iv(3, 4))).toEqual(iv(2, 5));
    expect(tree.search(iv(5, 6))).toBeUndefined(); // [5,6) touches but does not overlap
});

Deno.test("from() with no intervals is empty", () => {
    const tree = IntervalTree.from([]);
    expect(contentsOf(tree)).toEqual([]);
    expect(tree.search(iv(0, 1))).toBeUndefined();
});

Deno.test("from() sorts intervals by start and preserves duplicates", () => {
    const xs = [iv(3, 4), iv(1, 2), iv(3, 4), iv(0, 1), iv(1, 3), iv(1, 2)];
    const tree = IntervalTree.from(xs);
    // [1,2) and [1,3) share a start, so their relative order is not asserted;
    // only start-sortedness and the multiset contents are.
    expectTree(tree, xs);
    // Sanity: the distinct starts must come out in ascending order.
    expect([...tree].map((i) => i.start)).toEqual([0, 1, 1, 1, 3, 3]);
});

Deno.test("from() accepts any iterable", () => {
    function* gen(): Generator<Interval> {
        yield iv(5, 6);
        yield iv(1, 2);
        yield iv(5, 6);
        yield iv(3, 4);
    }
    // distinct starts (1, 3, 5): exact order is fully determined here
    expect(contentsOf(IntervalTree.from(gen()))).toEqual([
        iv(1, 2),
        iv(3, 4),
        iv(5, 6),
        iv(5, 6),
    ]);
});

// ---------------------------------------------------------------------------
// add
// ---------------------------------------------------------------------------

Deno.test("add() inserts intervals in ascending start order", () => {
    let tree = IntervalTree.empty();
    for (const i of [iv(3, 4), iv(1, 2), iv(2, 3), iv(0, 1), iv(-1, 0)]) {
        tree = tree.add(i);
    }
    // all starts distinct: exact order is fully determined
    expect(contentsOf(tree)).toEqual([
        iv(-1, 0),
        iv(0, 1),
        iv(1, 2),
        iv(2, 3),
        iv(3, 4),
    ]);
});

Deno.test("add() keeps duplicate intervals", () => {
    let tree = IntervalTree.empty();
    tree = tree.add(iv(2, 4)).add(iv(2, 4)).add(iv(1, 2)).add(iv(2, 4));
    expectTree(tree, [iv(1, 2), iv(2, 4), iv(2, 4), iv(2, 4)]);
});

Deno.test("add() builds the same tree as from()", () => {
    const vals = [iv(4, 5), iv(1, 2), iv(4, 5), iv(3, 4), iv(2, 3)];
    let byAdd = IntervalTree.empty();
    for (const i of vals) byAdd = byAdd.add(i);
    expectTree(byAdd, vals);
    expectTree(IntervalTree.from(vals), vals);
});

Deno.test("add() returns a fresh instance and leaves the original unchanged", () => {
    const base = IntervalTree.of(iv(1, 2));
    const next = base.add(iv(2, 3));
    expect(next).not.toBe(base);
    expect(contentsOf(base)).toEqual([iv(1, 2)]);
    expect(contentsOf(next)).toEqual([iv(1, 2), iv(2, 3)]);
});

// ---------------------------------------------------------------------------
// search
// ---------------------------------------------------------------------------

Deno.test("search() finds an overlapping interval", () => {
    const tree = IntervalTree.from([iv(1, 3), iv(5, 7), iv(10, 20)]);
    expect(tree.search(iv(0, 2))).toEqual(iv(1, 3));
    expect(tree.search(iv(6, 8))).toEqual(iv(5, 7));
    expect(tree.search(iv(15, 16))).toEqual(iv(10, 20));
});

Deno.test("search() returns the first (lowest-start) overlapping interval", () => {
    // sorted by start: starts are 1, 2, 3, 4. The start-1 group has [1,2) and
    // [1,5); [1,2) does not overlap these queries, so the answer is unambiguous.
    const tree = IntervalTree.from([
        iv(1, 2),
        iv(1, 5),
        iv(2, 3),
        iv(3, 4),
        iv(4, 5),
    ]);
    expect(tree.search(iv(2, 4))).toEqual(iv(1, 5)); // [1,5) is the only start-1 overlap
    expect(tree.search(iv(2, 3))).toEqual(iv(1, 5)); // same reasoning
    expect(tree.search(iv(5, 6))).toBeUndefined();
});

Deno.test("search() with same-start ties only guarantees start and overlap", () => {
    // All three intervals share start 1, so any of them could be "first".
    const tree = IntervalTree.from([iv(1, 2), iv(1, 9), iv(1, 4)]);
    const got = tree.search(iv(0, 5));
    expect(got).toBeDefined();
    if (got !== undefined) {
        expect(got.start).toBe(1); // minimal overlapping start is 1
        expect(overlaps(got, iv(0, 5))).toBe(true);
    }
});

Deno.test("search() matches a query against its own interval", () => {
    const tree = IntervalTree.of(iv(2, 5));
    expect(tree.search(iv(2, 5))).toEqual(iv(2, 5));
    expect(tree.search(iv(4, 5))).toEqual(iv(2, 5));
});

Deno.test("search() treats touching endpoints as non-overlapping (half-open)", () => {
    const tree = IntervalTree.from([iv(1, 3), iv(3, 5)]);
    expect(tree.search(iv(3, 4))).toEqual(iv(3, 5)); // [1,3) does not contain 3
    expect(tree.search(iv(1, 2))).toEqual(iv(1, 3));
});

Deno.test("search() handles containment in both directions", () => {
    const tree = IntervalTree.from([iv(1, 9), iv(4, 6)]);
    // distinct starts; [1,9) always overlaps and has the lower start
    expect(tree.search(iv(5, 7))).toEqual(iv(1, 9));
    expect(tree.search(iv(0, 2))).toEqual(iv(1, 9));
    expect(tree.search(iv(5, 6))).toEqual(iv(1, 9));
});

Deno.test("search() works when the tree holds duplicate intervals", () => {
    const tree = IntervalTree.from([iv(2, 4), iv(2, 4), iv(6, 8)]);
    expect(tree.search(iv(3, 5))).toEqual(iv(2, 4));
    expect(tree.search(iv(7, 9))).toEqual(iv(6, 8));
});

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

Deno.test("match() returns exactly the overlapping sub-multiset", () => {
    const tree = IntervalTree.from([iv(1, 5), iv(1, 5), iv(3, 4), iv(8, 9)]);
    expectTree(tree.match(iv(2, 6)), [iv(1, 5), iv(1, 5), iv(3, 4)]);
    expectTree(tree.match(iv(4, 5)), [iv(1, 5), iv(1, 5)]);
    expect(contentsOf(tree.match(iv(6, 8)))).toEqual([]); // [8,9) starts at the query end
});

Deno.test("match() preserves duplicates", () => {
    const tree = IntervalTree.from([iv(0, 4), iv(0, 4), iv(0, 4), iv(5, 6)]);
    expectTree(tree.match(iv(1, 3)), [iv(0, 4), iv(0, 4), iv(0, 4)]);
});

Deno.test("match() result is a fully usable IntervalTree", () => {
    // all starts distinct so contents order is fully determined
    const tree = IntervalTree.from([iv(1, 9), iv(2, 3), iv(4, 6), iv(8, 10)]);
    const sub = tree.match(iv(2, 7));
    expect(contentsOf(sub)).toEqual([iv(1, 9), iv(2, 3), iv(4, 6)]);
    for (const i of sub) expect(overlaps(i, iv(2, 7))).toBe(true);
    expect(sub.search(iv(5, 6))).toEqual(iv(1, 9));
    expect(contentsOf(sub.match(iv(4, 5)))).toEqual([iv(1, 9), iv(4, 6)]);
});

Deno.test("match() with a wide query returns the whole tree", () => {
    const tree = IntervalTree.from([iv(1, 2), iv(1, 5), iv(4, 6)]);
    expectTree(tree.match(iv(-1000, 1000)), [...tree]);
    // chained match()s narrow the result
    expectTree(tree.match(iv(-1000, 1000)).match(iv(4, 7)), [
        iv(1, 5),
        iv(4, 6),
    ]);
});

// ---------------------------------------------------------------------------
// merge
// ---------------------------------------------------------------------------

Deno.test("merge() unions the multisets (duplicate counts add)", () => {
    const a = IntervalTree.from([iv(1, 5), iv(1, 5), iv(7, 9)]);
    const b = IntervalTree.from([iv(1, 5), iv(0, 2)]);
    console.log(a.merge(b));
    expectTree(a.merge(b), [iv(0, 2), iv(1, 5), iv(1, 5), iv(1, 5), iv(7, 9)]);
});

Deno.test("merge() with an empty tree is a no-op by contents", () => {
    const a = IntervalTree.from([iv(1, 3), iv(4, 5)]);
    expectTree(a.merge(IntervalTree.empty()), [...a]);
    expectTree(IntervalTree.empty().merge(a), [...a]);
});

Deno.test("merge() is commutative (by contents)", () => {
    const a = IntervalTree.from([iv(1, 5), iv(7, 9)]);
    const b = IntervalTree.from([iv(0, 2), iv(1, 5)]);
    expect(canonical(a.merge(b))).toEqual(canonical(b.merge(a)));
});

Deno.test("merge() result supports search and match", () => {
    const merged = IntervalTree.of(iv(2, 4)).merge(IntervalTree.of(iv(8, 9)));
    expect(merged.search(iv(3, 5))).toEqual(iv(2, 4));
    expect(merged.search(iv(9, 10))).toBeUndefined();
    expectTree(merged.match(iv(8, 10)), [iv(8, 9)]);
});

// ---------------------------------------------------------------------------
// Persistence / immutability
// ---------------------------------------------------------------------------

Deno.test("operations never mutate the source tree", () => {
    const base = IntervalTree.from([iv(1, 2), iv(4, 5)]);
    const added = base.add(iv(7, 9));
    const merged = base.merge(IntervalTree.of(iv(0, 9)));
    expect(contentsOf(base)).toEqual([iv(1, 2), iv(4, 5)]);
    expect(contentsOf(added)).toEqual([iv(1, 2), iv(4, 5), iv(7, 9)]);
    console.log(merged);
    expectTree(merged, [iv(0, 9), iv(1, 2), iv(4, 5)]);
});

Deno.test("search() and match() are read-only", () => {
    const tree = IntervalTree.from([iv(1, 5), iv(3, 4), iv(8, 9)]);
    const before = contentsOf(tree);
    expect(tree.search(iv(0, 10))).toEqual(iv(1, 5));
    expect(tree.search(iv(0, 10))).toEqual(iv(1, 5));
    tree.match(iv(0, 9));
    expect(contentsOf(tree)).toEqual(before);
});

// ---------------------------------------------------------------------------
// Boundary conditions / extreme coordinates
// ---------------------------------------------------------------------------

Deno.test("handles extreme integer coordinates", () => {
    const big = 1_000_000_000_000;
    const tree = IntervalTree.from([
        iv(-big, -big + 10),
        iv(0, 10),
        iv(big - 10, big),
    ]);
    expect(tree.search(iv(-big, -big + 1))).toEqual(iv(-big, -big + 10));
    expect(tree.search(iv(0, 5))).toEqual(iv(0, 10));
    expect(tree.search(iv(big - 1, big))).toEqual(iv(big - 10, big));
    expect(tree.search(iv(-5, -1))).toBeUndefined(); // in the gap
});

Deno.test("half-open boundaries hold at scale", () => {
    const touching = IntervalTree.from([iv(-3, 0), iv(0, 3)]);
    expect(contentsOf(touching)).toEqual([iv(-3, 0), iv(0, 3)]);
    expect(touching.search(iv(0, 1))).toEqual(iv(0, 3)); // [-3,0) does NOT overlap [0,3)
    expect(touching.search(iv(-2, 1))).toEqual(iv(-3, 0)); // lowest-start overlap
    expectTree(touching.match(iv(0, 1)), [iv(0, 3)]);
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

Deno.test("property: from() is start-sorted with the right multiset", async () => {
    await fc.assert(
        fc.property(
            fc.array(ivArb, { maxLength: 200 }),
            (xs) => {
                expectTree(IntervalTree.from(xs), xs);
            },
        ),
        { numRuns: 100 },
    );
});

Deno.test("property: from() and repeated add() agree", async () => {
    await fc.assert(
        fc.property(
            fc.array(ivArb, { maxLength: 100 }),
            (xs) => {
                let byAdd = IntervalTree.empty();
                for (const i of xs) byAdd = byAdd.add(i);
                expectTree(byAdd, xs);
                expectTree(IntervalTree.from(xs), xs);
            },
        ),
        { numRuns: 100 },
    );
});

Deno.test("property: search() returns a lowest-start overlapping interval", async () => {
    await fc.assert(
        fc.property(fc.array(ivArb, { maxLength: 100 }), ivArb, (xs, q) => {
            const tree = IntervalTree.from(xs);
            const overlapping = xs.filter((i) => overlaps(i, q));
            const minStart = overlapping.length === 0
                ? undefined
                : Math.min(...overlapping.map((i) => i.start));
            const got = tree.search(q);
            if (minStart === undefined) {
                expect(got).toBeUndefined();
            } else {
                expect(got).toBeDefined();
                if (got !== undefined) {
                    expect(got.start).toBe(minStart);
                    expect(overlaps(got, q)).toBe(true);
                }
            }
        }),
        { numRuns: 150 },
    );
});

Deno.test("property: match() returns exactly the overlapping sub-multiset", async () => {
    await fc.assert(
        fc.property(fc.array(ivArb, { maxLength: 100 }), ivArb, (xs, q) => {
            const tree = IntervalTree.from(xs);
            expectTree(
                tree.match(q),
                xs.filter((i) => overlaps(i, q)),
            );
        }),
        { numRuns: 150 },
    );
});

Deno.test("property: every interval from match() overlaps and emptiness is exact", async () => {
    await fc.assert(
        fc.property(fc.array(ivArb, { maxLength: 100 }), ivArb, (xs, q) => {
            const sub = IntervalTree.from(xs).match(q);
            for (const i of sub) expect(overlaps(i, q)).toBe(true);
            const any = xs.some((i) => overlaps(i, q));
            if (any) expect(sub.search(q)).toBeDefined();
            else expect(sub.search(q)).toBeUndefined();
        }),
        { numRuns: 100 },
    );
});

Deno.test("property: merge() agrees with multiset union", async () => {
    await fc.assert(
        fc.property(
            fc.array(ivArb, { maxLength: 60 }),
            fc.array(ivArb, { maxLength: 60 }),
            (a, b) => {
                const merged = IntervalTree.from(a).merge(IntervalTree.from(b));
                expectTree(merged, [...a, ...b]);
            },
        ),
        { numRuns: 100 },
    );
});

// ---------------------------------------------------------------------------
// Model-based testing
// ---------------------------------------------------------------------------

/**
 * Reference multiset of intervals stored in a canonical (start, end) order.
 * The IntervalTree API has no removes, so the model only needs add/search/match/merge.
 * Because tie order is unspecified, comparisons with the tree go through
 * expectTree (multiset + start-sorted), and search is compared via its start.
 */
class IntervalModel {
    private xs: Interval[] = [];

    constructor(initial: Iterable<Interval> = []) {
        for (const i of initial) this.add(i);
    }

    add(i: Interval): void {
        let lo = 0;
        let hi = this.xs.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            const a = this.xs[mid];
            const byStart = a.start - i.start;
            const byEnd = byStart === 0 ? a.end - i.end : byStart;
            if (byEnd <= 0) lo = mid + 1;
            else hi = mid;
        }
        this.xs.splice(lo, 0, { ...i });
    }

    /** Minimal start among intervals overlapping q (undefined if none). */
    minOverlapStart(q: Interval): number | undefined {
        let m: number | undefined;
        for (const i of this.xs) {
            if (overlaps(i, q)) {
                m = m === undefined ? i.start : Math.min(m, i.start);
            }
        }
        return m;
    }

    match(q: Interval): Interval[] {
        return this.xs.filter((i) => overlaps(i, q)).map((i) => ({ ...i }));
    }

    merge(other: IntervalModel): void {
        for (const i of other.xs) this.add(i);
    }

    contents(): Interval[] {
        return this.xs.map((i) => ({ ...i }));
    }
}

Deno.test(
    "property: random add/search/match/merge sequences stay consistent with a reference model",
    async () => {
        await fc.assert(
            fc.property(fc.array(cmdArb, { maxLength: 80 }), (cmds) => {
                let tree = IntervalTree.empty();
                const model = new IntervalModel();
                let step = 0;

                for (const c of cmds) {
                    if (c.op === "add") {
                        tree = tree.add(c.iv);
                        model.add(c.iv);
                    } else if (c.op === "search") {
                        const minStart = model.minOverlapStart(c.q);
                        const got = tree.search(c.q);
                        if (minStart === undefined) {
                            expect(got).toBeUndefined();
                        } else {
                            expect(got).toBeDefined();
                            if (got !== undefined) {
                                expect(got.start).toBe(minStart);
                                expect(overlaps(got, c.q)).toBe(true);
                            }
                        }
                    } else if (c.op === "match") {
                        expectTree(tree.match(c.q), model.match(c.q));
                    } else {
                        tree = tree.merge(IntervalTree.from(c.seed));
                        model.merge(new IntervalModel(c.seed));
                    }

                    // Periodically verify the full contents too.
                    if (++step % 5 === 0) {
                        expectTree(tree, model.contents());
                    }
                }

                // Finally, the full contents must match the model.
                expectTree(tree, model.contents());
            }),
            { numRuns: 150 },
        );
    },
);
