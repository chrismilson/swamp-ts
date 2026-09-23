import { Measure } from "./measure.ts";
import {
    concat,
    EMPTY,
    excise,
    insert_at,
    locate,
    pop_l,
    pop_r,
    push_r,
    Swamp,
} from "./swamp.ts";

const NONE = Symbol();
type Maybe<T> = T | typeof NONE;
const RIGHT = <T>(): Measure<T, Maybe<T>> => ({
    empty: () => NONE,
    combine: (a, b) => b === NONE ? a : b,
    measure: (x) => x,
});

export class SortedMultiset<T> {
    constructor(
        private readonly _M: Measure<T, Maybe<T>>,
        private readonly _cmp: (a: T, b: T) => number,
        private readonly _swamp: Swamp<T, Maybe<T>>,
    ) {}

    static empty<T>(cmp: (a: T, b: T) => number): SortedMultiset<T> {
        return new SortedMultiset(RIGHT<T>(), cmp, EMPTY);
    }
    static of<T>(cmp: (a: T, b: T) => number, value: T): SortedMultiset<T> {
        return SortedMultiset.empty(cmp).add(value);
    }
    static from<T>(
        cmp: (a: T, b: T) => number,
        values: Iterable<T>,
    ): SortedMultiset<T> {
        let acc: Swamp<T, Maybe<T>> = EMPTY;
        const M = RIGHT<T>();
        for (const value of [...values].sort(cmp)) {
            acc = push_r(M, acc, value);
        }
        return new SortedMultiset(M, cmp, acc);
    }

    add(value: T): SortedMultiset<T> {
        return new SortedMultiset(
            this._M,
            this._cmp,
            insert_at(
                this._M,
                (m) => m !== NONE && this._cmp(m, value) > 0,
                this._swamp,
                value,
            ),
        );
    }
    remove(value: T): SortedMultiset<T> {
        const located = locate(
            this._M,
            (m) => m !== NONE && this._cmp(m, value) >= 0,
            this._swamp,
        );
        if (located === undefined) return this;
        const [left, x, right] = located;
        if (this._cmp(x, value) !== 0) return this;
        return new SortedMultiset(
            this._M,
            this._cmp,
            concat(this._M, left, right),
        );
    }
    remove_all(value: T): SortedMultiset<T> {
        const [left, _middle, right] = excise(
            this._M,
            (m) => m !== NONE && this._cmp(m, value) >= 0,
            (m) => m !== NONE && this._cmp(m, value) > 0,
            this._swamp,
        );
        return new SortedMultiset(
            this._M,
            this._cmp,
            concat(this._M, left, right),
        );
    }

    get min(): T | undefined {
        const popped = pop_l(this._M, this._swamp);
        if (popped === undefined) return undefined;
        const [min, _rest] = popped;
        return min;
    }

    get max(): T | undefined {
        const popped = pop_r(this._M, this._swamp);
        if (popped === undefined) return undefined;
        const [_rest, max] = popped;
        return max;
    }
}
