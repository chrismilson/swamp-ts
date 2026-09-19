import {
    concat,
    EMPTY,
    pop_l,
    pop_r,
    push_l,
    push_l_all,
    push_r,
    Swamp,
} from "./swamp.ts";

export class Deque<T> {
    private constructor(
        private readonly _swamp: Swamp<T>,
        readonly length: number,
    ) {}

    static from<T>(values: Iterable<T>): Deque<T> {
        const arr = [...values];
        return new Deque(push_l_all(arr, EMPTY), arr.length);
    }
    static of<T>(value: T): Deque<T> {
        return Deque.from([value]);
    }
    static empty<T>(): Deque<T> {
        return new Deque(EMPTY, 0);
    }

    push(value: T): Deque<T> {
        return new Deque(push_r(this._swamp, value), this.length + 1);
    }
    pushFront(value: T): Deque<T> {
        return new Deque(push_l(value, this._swamp), this.length + 1);
    }

    peek(): T | undefined {
        const popped = pop_r(this._swamp);
        if (popped === undefined) return undefined;
        return popped[1];
    }
    peekFront(): T | undefined {
        const popped = pop_l(this._swamp);
        if (popped === undefined) return undefined;
        return popped[0];
    }

    pop(): Deque<T> {
        const popped = pop_r(this._swamp);
        if (popped === undefined) return this;
        return new Deque(popped[0], this.length - 1);
    }
    popFront(): Deque<T> {
        const popped = pop_l(this._swamp);
        if (popped === undefined) return this;
        return new Deque(popped[1], this.length - 1);
    }

    concat(other: Deque<T>): Deque<T> {
        return new Deque(
            concat(this._swamp, other._swamp),
            this.length + other.length,
        );
    }
}
