import { Measure } from "./measure.ts";
import {
    concat,
    EMPTY,
    measure_swamp,
    push_r,
    split_swamp,
    Swamp,
} from "./swamp.ts";

const NONE = Symbol();
type Maybe<T> = T | typeof NONE;
const MAX_PRIO = <T>(): Measure<[T, number], Maybe<[T, number]>> => ({
    empty: () => NONE,
    combine: (a, b) => {
        if (b === NONE) return a;
        if (a === NONE) return b;
        const [a_prio, b_prio] = [a[1], b[1]];
        if (a_prio < b_prio) return b; // Important to ensure we lean left for consistent pop & peek
        return a;
    },
    measure: (x) => x,
});

export class PriorityQueue<T> {
    constructor(
        private readonly _M: Measure<[T, number], Maybe<[T, number]>>,
        private readonly _swamp: Swamp<[T, number], Maybe<[T, number]>>,
    ) {}

    static empty<T>(): PriorityQueue<T> {
        return new PriorityQueue(MAX_PRIO(), EMPTY);
    }
    static of<T>(value: T, priority: number): PriorityQueue<T> {
        return PriorityQueue.empty<T>().add(value, priority);
    }
    static from<T>(
        values_with_priorities: Iterable<[T, number]>,
    ): PriorityQueue<T> {
        let acc = PriorityQueue.empty<T>();
        for (const value_with_priority of values_with_priorities) {
            acc = acc.add(...value_with_priority);
        }
        return acc;
    }

    add(value: T, priority: number): PriorityQueue<T> {
        return new PriorityQueue(
            this._M,
            push_r(this._M, this._swamp, [value, priority]),
        );
    }

    peek(): T | undefined {
        const m = measure_swamp(this._M, this._swamp);
        if (m === NONE) return undefined;
        return m[0];
    }

    pop(): PriorityQueue<T> {
        const target = measure_swamp(this._M, this._swamp);
        if (target === NONE) return this;
        const [left, _x, right] = split_swamp(
            this._M,
            (m) => m === target,
            this._M.empty(),
            this._swamp,
        );
        return new PriorityQueue(this._M, concat(this._M, left, right));
    }
}
