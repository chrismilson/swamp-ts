import { Measure } from "./measure.ts";
import {
    concat,
    EMPTY,
    locate,
    measure_swamp,
    pop_l,
    pop_r,
    push_l,
    push_r,
    Swamp,
} from "./swamp.ts";

// Dumb type-fu so that we get inferred T on the SIZE Measure
const memo: Measure<unknown, number> = {
    empty: () => 0,
    combine: (a, b) => a + b,
    measure: (_) => 1,
};
const SIZE = <T>(): Measure<T, number> => memo;

export class Deque<T> {
    private constructor(
        private readonly _M: Measure<T, number>,
        private readonly _swamp: Swamp<T, number>,
    ) {}

    static empty<T>(): Deque<T> {
        return new Deque(SIZE<T>(), EMPTY);
    }
    static of<T>(value: T): Deque<T> {
        return Deque.empty<T>().push(value);
    }
    static from<T>(values: Iterable<T>): Deque<T> {
        let acc = Deque.empty<T>();
        for (const value of values) {
            acc = acc.push(value);
        }
        return acc;
    }

    push(value: T): Deque<T> {
        return new Deque(this._M, push_r(this._M, this._swamp, value));
    }
    pushFront(value: T): Deque<T> {
        return new Deque(this._M, push_l(this._M, value, this._swamp));
    }

    peek(): T | undefined {
        const popped = pop_r(this._M, this._swamp);
        if (popped === undefined) return undefined;
        return popped[1];
    }
    peekFront(): T | undefined {
        const popped = pop_l(this._M, this._swamp);
        if (popped === undefined) return undefined;
        return popped[0];
    }

    pop(): Deque<T> {
        const popped = pop_r(this._M, this._swamp);
        if (popped === undefined) return this;
        return new Deque(this._M, popped[0]);
    }
    popFront(): Deque<T> {
        const popped = pop_l(this._M, this._swamp);
        if (popped === undefined) return this;
        return new Deque(this._M, popped[1]);
    }

    concat(other: Deque<T>): Deque<T> {
        return new Deque(
            this._M,
            concat(this._M, this._swamp, other._swamp),
        );
    }

    get length(): number {
        return measure_swamp(this._M, this._swamp);
    }

    index(i: number): T {
        const located = locate(
            this._M,
            (k) => k > i,
            this._swamp,
        );
        if (i < 0 || located === undefined) {
            throw new Error(
                `Index ${i} out of bounds in length ${this.length} Deque.`,
            );
        }
        const [_left, x, _right] = located;
        return x;
    }

    update(i: number, value: T): Deque<T> {
        const located = locate(
            this._M,
            (k) => k > i,
            this._swamp,
        );
        if (i < 0 || located === undefined) {
            throw new Error(
                `Index ${i} out of bounds in length ${this.length} Deque.`,
            );
        }
        const [left, _x, right] = located;
        return new Deque(
            this._M,
            concat(this._M, left, push_l(this._M, value, right)),
        );
    }
}
