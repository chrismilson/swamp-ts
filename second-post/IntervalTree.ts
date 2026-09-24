import { Measure, productMeasure } from "./measure.ts";
import {
    concat,
    EMPTY,
    insert_at,
    locate,
    measure_swamp,
    pop_l,
    push_l,
    push_r,
    split,
    Swamp,
} from "./swamp.ts";

export interface Interval {
    start: number;
    end: number;
}

// Both use the MAX monoid, but have a different measure
const START: Measure<Interval, number> = {
    // We have to be careful to use strict inequalities so that predicates don't eval to true on empty!
    // Otherwise the RIGHT measure from SortedMultiset will be better for us.
    // They will do the same thing, because we will try to insert Intervals in order by start.
    empty: () => -Infinity,
    combine: Math.max,
    measure: ({ start }) => start,
};
const END: Measure<Interval, number> = {
    empty: () => -Infinity,
    combine: Math.max,
    measure: ({ end }) => end,
};
const SIZE: Measure<Interval, number> = {
    empty: () => 0,
    combine: (a, b) => a + b,
    measure: (_) => 1,
};

// Our IntervalTree Measure
type IntervalMetric = [number, number, number];
const INTERVAL = productMeasure(START, END, SIZE);

export class IntervalTree {
    private constructor(
        private readonly _swamp: Swamp<Interval, IntervalMetric>,
    ) {}

    static empty(): IntervalTree {
        return new IntervalTree(EMPTY);
    }
    static of(interval: Interval): IntervalTree {
        return IntervalTree.empty().add(interval);
    }
    static from(intervals: Iterable<Interval>): IntervalTree {
        let acc: Swamp<Interval, IntervalMetric> = EMPTY;
        const by_start = (a: Interval, b: Interval) => a.start - b.start;
        for (const interval of [...intervals].sort(by_start)) {
            acc = push_r(INTERVAL, acc, interval);
        }
        return new IntervalTree(acc);
    }

    add(interval: Interval): IntervalTree {
        return new IntervalTree(
            insert_at(
                INTERVAL,
                ([start]) => start > interval.start,
                this._swamp,
                interval,
            ),
        );
    }

    // Returns an interval in the tree that overlaps with query, or undefined if there is no such interval
    search(query: Interval): Interval | undefined {
        // For two intervals, [s1, e1] and [s2, e2] to overlap, we need: s2 < e1 and s1 < e2
        const located = locate(
            INTERVAL,
            ([_s, end]) => end > query.start, // The first (earliest start) interval with end > query.start
            this._swamp,
        );
        if (located === undefined) return undefined;
        const [_left, candidate, _right] = located;
        if (candidate.start < query.end) return candidate; // The other required inequality
        return undefined;
    }

    // Returns an IntervalTree that is a subset of the current one, made of intervals that overlap with the query.
    match(query: Interval): IntervalTree {
        // Drop any intervals at the end that definitely won't overlap
        let x: Interval;
        let [remainder, _] = split(
            INTERVAL,
            ([start]) => start >= query.end, // leaves intervals with start < query.end
            this._swamp,
        );
        let result: Swamp<Interval, IntervalMetric> = EMPTY;
        while (true) {
            const located = locate(
                INTERVAL,
                ([_s, end]) => query.start < end,
                remainder,
            );
            if (located === undefined) return new IntervalTree(result);
            [_, x, remainder] = located; // x is the first with x.end < query.start - both inequalities.
            result = push_r(INTERVAL, result, x);
        }
    }

    // Merges two interval trees
    merge(other: IntervalTree): IntervalTree {
        let left: Swamp<Interval, IntervalMetric>;
        let x: Interval;
        let result: Swamp<Interval, IntervalMetric> = EMPTY;
        let xs = this._swamp;
        const viewed = pop_l(INTERVAL, other._swamp);
        if (viewed === undefined) return this;
        let [y, ys] = viewed;

        const pred = (y: Interval) => ([start]: IntervalMetric) => {
            return start > y.start;
        };

        while (true) {
            const located = locate(INTERVAL, pred(y), xs);
            if (located === undefined) {
                // Nothing in xs matched the predicate, so all xs < y
                result = concat(
                    INTERVAL,
                    result,
                    concat(INTERVAL, xs, push_l(INTERVAL, y, ys)),
                );
                return new IntervalTree(result);
            }
            // Left all has start <= y.start;
            // x is the first in xs (original) with x.start > y.start
            // All of xs has start > y.start
            [left, x, xs] = located;
            result = concat(INTERVAL, result, push_r(INTERVAL, left, y));

            // Swamp x and y to greedily take from both, alternating
            y = x;
            [xs, ys] = [ys, xs];
        }
    }

    // of course we can get you the ith element
    index(i: number): Interval | undefined {
        const located = locate(INTERVAL, ([_s, _e, k]) => k > i, this._swamp);
        if (i < 0 || located === undefined) return undefined;
        const [_left, x, _right] = located;
        return x;
    }

    get length(): number {
        return measure_swamp(INTERVAL, this._swamp)[2];
    }

    *[Symbol.iterator](): Iterator<Interval> {
        let t = this._swamp;
        let x: Interval;
        while (true) {
            const viewed = pop_l(INTERVAL, t);
            if (viewed === undefined) return;
            [x, t] = viewed;
            yield x;
        }
    }
}
