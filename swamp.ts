import { Measure } from "./measure.ts";

type Wet2<T, M> = { kind: "Wet2"; measure: M; a: T; b: T };
type Wet3<T, M> = { kind: "Wet3"; measure: M; a: T; b: T; c: T };
type Wet<T, M> = Wet2<T, M> | Wet3<T, M>;
type Edge1<T> = { kind: "Edge1"; a: T };
type Edge2<T> = { kind: "Edge2"; a: T; b: T };
type Edge3<T> = { kind: "Edge3"; a: T; b: T; c: T };
type Edge4<T> = { kind: "Edge4"; a: T; b: T; c: T; d: T };
type Edge<T> = Edge1<T> | Edge2<T> | Edge3<T> | Edge4<T>;
type EdgePushable<T> = Edge1<T> | Edge2<T> | Edge3<T>;

type Empty = { kind: "Empty" };
type Single<T> = { kind: "Single"; value: T };
type Deep<T, M> = {
    kind: "Deep";
    measure: M;
    left: Edge<T>;
    middle: Swamp<Wet<T, M>, M>;
    right: Edge<T>;
};
export type Swamp<T, M> = Empty | Single<T> | Deep<T, M>;

function Edge<T>(a: T): Edge1<T>;
function Edge<T>(a: T, b: T): Edge2<T>;
function Edge<T>(a: T, b: T, c: T): Edge3<T>;
function Edge<T>(a: T, b: T, c: T, d: T): Edge4<T>;
function Edge<T>(...values: T[]): Edge<T>;
function Edge<T>(...values: T[]): Edge<T> {
    if (values.length === 1) {
        return { kind: "Edge1", a: values[0] };
    }
    if (values.length === 2) {
        return { kind: "Edge2", a: values[0], b: values[1] };
    }
    if (values.length === 3) {
        return { kind: "Edge3", a: values[0], b: values[1], c: values[2] };
    }
    return {
        kind: "Edge4",
        a: values[0],
        b: values[1],
        c: values[2],
        d: values[3],
    };
}
function edge_to_arr<T>(edge: Edge<T> | undefined): T[] {
    const result: T[] = [];
    if (edge === undefined) return result;
    result.push(edge.a);
    if (edge.kind === "Edge1") return result;
    result.push(edge.b);
    if (edge.kind === "Edge2") return result;
    result.push(edge.c);
    if (edge.kind === "Edge3") return result;
    result.push(edge.d);
    // edge.kind === "Edge4"
    return result;
}
function is_pushable<T>(edge: Edge<T>): edge is EdgePushable<T> {
    return edge.kind !== "Edge4";
}
function measure_edge<T, M>(M: Measure<T, M>, edge: Edge<T>): M {
    let acc = M.empty();
    for (const value of edge_to_arr(edge)) {
        acc = M.combine(acc, M.measure(value));
    }
    return acc;
}

function dessicate<T>(wet: Wet2<T, unknown>): Edge2<T>;
function dessicate<T>(wet: Wet3<T, unknown>): Edge3<T>;
function dessicate<T>(wet: Wet<T, unknown>): Edge2<T> | Edge3<T>; // EdgePoppable<T> & EdgePushable<T>;
function dessicate<T>(wet: Wet<T, unknown>): Edge<T> {
    if (wet.kind === "Wet2") {
        return Edge(wet.a, wet.b);
    }
    // wet.kind === "Wet3"
    return Edge(wet.a, wet.b, wet.c);
}

function Wet<T, M>(M: Measure<T, M>, a: T, b: T): Wet2<T, M>;
function Wet<T, M>(M: Measure<T, M>, a: T, b: T, c: T): Wet3<T, M>;
function Wet<T, M>(M: Measure<T, M>, ...values: T[]): Wet<T, M> {
    if (values.length === 2) {
        const [a, b] = values;
        const measure = M.combine(M.measure(a), M.measure(b));
        return { kind: "Wet2", measure, a, b };
    }
    const [a, b, c] = values;
    const measure = M.combine(
        M.measure(a),
        M.combine(M.measure(b), M.measure(c)),
    );
    return { kind: "Wet3", measure, a: values[0], b: values[1], c: values[2] };
}
function waterproof<T, M>(M: Measure<T, M>): Measure<Wet<T, M>, M> {
    return {
        empty: M.empty,
        combine: M.combine,
        measure: (wet) => wet.measure,
    };
}

export const EMPTY: Empty = { kind: "Empty" };
function is_empty(swamp: Swamp<unknown, unknown>): swamp is Empty {
    return swamp.kind === "Empty";
}
function Single<T>(value: T): Single<T> {
    return { kind: "Single", value };
}
function is_single<T>(swamp: Swamp<T, unknown>): swamp is Single<T> {
    return swamp.kind === "Single";
}
export function measure_swamp<T, M>(M: Measure<T, M>, swamp: Swamp<T, M>): M {
    if (is_empty(swamp)) return M.empty();
    if (is_single(swamp)) return M.measure(swamp.value);
    return swamp.measure; // cached!
}
function Deep<T, M>(
    M: Measure<T, M>,
    left: Edge<T>,
    middle: Swamp<Wet<T, M>, M>,
    right: Edge<T>,
): Deep<T, M> {
    const measure = M.combine(
        measure_edge(M, left),
        M.combine(
            measure_swamp(waterproof(M), middle),
            measure_edge(M, right),
        ),
    );
    return { kind: "Deep", measure, left, middle, right };
}
function DeepR<T, M>(
    M: Measure<T, M>,
    left: Edge<T>,
    middle: Swamp<Wet<T, M>, M>,
    right: Edge<T> | undefined, // undefined means empty right edge
): Swamp<T, M> {
    if (right !== undefined) return Deep(M, left, middle, right);
    const popped = pop_r(waterproof(M), middle);
    if (popped !== undefined) {
        const [popped_middle, wet] = popped;
        return Deep(M, left, popped_middle, dessicate(wet));
    }
    const [l, l_end] = pop_r_edge(left);
    if (l === undefined) return Single(l_end);
    return Deep(M, l, EMPTY, Edge(l_end));
}
function DeepL<T, M>(
    M: Measure<T, M>,
    left: Edge<T> | undefined, // undefined means empty left edge
    middle: Swamp<Wet<T, M>, M>,
    right: Edge<T>,
): Swamp<T, M> {
    if (left !== undefined) return Deep(M, left, middle, right);
    const popped = pop_l(waterproof(M), middle);
    if (popped !== undefined) {
        const [wet, popped_middle] = popped;
        return Deep(M, dessicate(wet), popped_middle, right);
    }
    const [r_end, r] = pop_l_edge(right);
    if (r === undefined) return Single(r_end);
    return Deep(M, Edge(r_end), EMPTY, r);
}

function push_r_edge<T>(
    edge: Edge<T> | undefined,
    value: T,
): Edge<T> {
    if (edge === undefined) return Edge(value);
    if (edge.kind === "Edge1") return Edge(edge.a, value);
    if (edge.kind === "Edge2") return Edge(edge.a, edge.b, value);
    // edge.kind === "Edge3"
    return Edge(edge.a, edge.b, edge.c, value);
}
export function push_r<T, M>(
    M: Measure<T, M>,
    swamp: Swamp<T, M>,
    value: T,
): Swamp<T, M> {
    if (is_empty(swamp)) return Single(value);
    if (is_single(swamp)) {
        return Deep(M, Edge(swamp.value), EMPTY, Edge(value));
    }
    const { left, middle, right } = swamp;
    if (is_pushable(right)) {
        return Deep(M, left, middle, push_r_edge(right, value));
    }
    return Deep(
        M,
        left,
        push_r(
            waterproof(M),
            middle,
            Wet(M, right.a, right.b, right.c),
        ),
        Edge(right.d, value),
    );
}
export function push_r_all<T, M>(
    M: Measure<T, M>,
    swamp: Swamp<T, M>,
    values: T[],
): Swamp<T, M> {
    let acc = swamp;
    for (let i = 0; i < values.length; i++) {
        acc = push_r(M, acc, values[i]);
    }
    return acc;
}

function push_l_edge<T>(value: T, edge: Edge<T> | undefined): Edge<T> {
    if (edge === undefined) return Edge(value);
    if (edge.kind === "Edge1") return Edge(value, edge.a);
    if (edge.kind === "Edge2") return Edge(value, edge.a, edge.b);
    // edge.kind === "Edge3"
    return Edge(value, edge.a, edge.b, edge.c);
}
export function push_l<T, M>(
    M: Measure<T, M>,
    value: T,
    swamp: Swamp<T, M>,
): Swamp<T, M> {
    if (is_empty(swamp)) return Single(value);
    if (is_single(swamp)) {
        return Deep(M, Edge(value), EMPTY, Edge(swamp.value));
    }
    const { left, middle, right } = swamp;
    if (is_pushable(left)) {
        return Deep(M, push_l_edge(value, left), middle, right);
    }
    return Deep(
        M,
        Edge(value, left.a),
        push_l(
            waterproof(M),
            Wet(M, left.b, left.c, left.d),
            middle,
        ),
        right,
    );
}
export function push_l_all<T, M>(
    M: Measure<T, M>,
    values: T[],
    swamp: Swamp<T, M>,
): Swamp<T, M> {
    let acc = swamp;
    for (let i = values.length - 1; i >= 0; i--) {
        acc = push_l(M, values[i], acc);
    }
    return acc;
}

function pop_r_edge<T>(edge: Edge<T>): [Edge<T> | undefined, T] {
    if (edge.kind === "Edge1") return [undefined, edge.a];
    if (edge.kind === "Edge2") return [Edge(edge.a), edge.b];
    if (edge.kind === "Edge3") return [Edge(edge.a, edge.b), edge.c];
    // edge.kind === "Edge4"
    return [Edge(edge.a, edge.b, edge.c), edge.d];
}
export function pop_r<T, M>(
    M: Measure<T, M>,
    swamp: Swamp<T, M>,
): [Swamp<T, M>, T] | undefined {
    if (is_empty(swamp)) return undefined;
    if (is_single(swamp)) return [EMPTY, swamp.value];
    const { left, middle, right } = swamp;
    const [popped_right, r] = pop_r_edge(right);
    return [DeepR(M, left, middle, popped_right), r];
}
function pop_l_edge<T>(edge: Edge<T>): [T, Edge<T> | undefined] {
    if (edge.kind === "Edge1") return [edge.a, undefined];
    if (edge.kind === "Edge2") return [edge.a, Edge(edge.b)];
    if (edge.kind === "Edge3") return [edge.a, Edge(edge.b, edge.c)];
    // edge.kind === "Edge4"
    return [edge.a, Edge(edge.b, edge.c, edge.d)];
}
export function pop_l<T, M>(
    M: Measure<T, M>,
    swamp: Swamp<T, M>,
): [T, Swamp<T, M>] | undefined {
    if (is_empty(swamp)) return undefined;
    if (is_single(swamp)) return [swamp.value, EMPTY];
    const { left, middle, right } = swamp;
    const [l, popped_left] = pop_l_edge(left);
    return [l, DeepL(M, popped_left, middle, right)];
}

function moisten_all<T, M>(M: Measure<T, M>, ...values: T[]): Wet<T, M>[] {
    const result: Wet<T, M>[] = [];
    for (let i = 0; i < values.length - 4; i += 3) {
        result.push(Wet(M, ...values.slice(i, i + 3) as [T, T, T]));
    }
    if (values.length % 3 === 0) { // Three left
        result.push(Wet(M, ...values.slice(values.length - 3) as [T, T, T]));
    } else if (values.length % 3 === 1) { // Four left
        result.push(
            Wet(
                M,
                ...values.slice(
                    values.length - 4,
                    values.length - 2,
                ) as [T, T],
            ),
        );
        result.push(Wet(M, ...values.slice(values.length - 2) as [T, T]));
    } else { // values.length % 3 === 2 - Two left
        result.push(Wet(M, ...values.slice(values.length - 2) as [T, T]));
    }
    return result;
}
function app3<T, M>(
    M: Measure<T, M>,
    left: Swamp<T, M>,
    middle: T[],
    right: Swamp<T, M>,
): Swamp<T, M> {
    if (is_empty(left)) return push_l_all(M, middle, right);
    if (is_empty(right)) return push_r_all(M, left, middle);
    if (is_single(left)) {
        return push_l(M, left.value, push_l_all(M, middle, right));
    }
    if (is_single(right)) {
        return push_r(M, push_r_all(M, left, middle), right.value);
    }
    const { left: ll, middle: lm, right: lr } = left;
    const { left: rl, middle: rm, right: rr } = right;
    return Deep(
        M,
        ll,
        app3(
            waterproof(M),
            lm,
            moisten_all(
                M,
                ...edge_to_arr(lr),
                ...middle,
                ...edge_to_arr(rl),
            ),
            rm,
        ),
        rr,
    );
}
export function concat<T, M>(
    M: Measure<T, M>,
    left: Swamp<T, M>,
    right: Swamp<T, M>,
): Swamp<T, M> {
    return app3(M, left, [], right);
}

/// Now the new stuff

function split_edge<T, M>(
    M: Measure<T, M>,
    predicate: (m: M) => boolean,
    init: M,
    edge: Edge<T>,
): [Edge<T> | undefined, T, Edge<T> | undefined] {
    let acc = init;
    let x: T;
    let left: Edge<T> | undefined = undefined;
    let right: Edge<T> | undefined = edge;
    while (right !== undefined) {
        [x, right] = pop_l_edge(right);
        acc = M.combine(acc, M.measure(x));
        if (predicate(acc)) {
            return [left, x, right];
        }
        left = push_r_edge(left, x);
    }
    throw new Error("Predicate failed to hold on edge.");
}
export function split_swamp<T, M>(
    M: Measure<T, M>,
    predicate: (m: M) => boolean,
    init: M,
    swamp: Swamp<T, M>,
): [Swamp<T, M>, T, Swamp<T, M>] {
    if (is_empty(swamp)) throw new Error("Cannot split empty swamp.");
    if (is_single(swamp)) return [EMPTY, swamp.value, EMPTY];
    const { left, middle, right } = swamp;
    const left_acc = M.combine(init, measure_edge(M, left));
    if (predicate(left_acc)) {
        const [ll, x, lr] = split_edge(M, predicate, init, left);
        return [
            push_l_all(M, edge_to_arr(ll), EMPTY),
            x,
            DeepL(M, lr, middle, right),
        ];
    }
    const WP_M = waterproof(M);
    const middle_acc = M.combine(left_acc, measure_swamp(WP_M, middle));
    if (predicate(middle_acc)) {
        const [middle_left, wet, middle_right] = split_swamp(
            WP_M,
            predicate,
            left_acc,
            middle,
        );
        const [wet_left, x, wet_right] = split_edge(
            M,
            predicate,
            M.combine(left_acc, measure_swamp(WP_M, middle_left)),
            dessicate(wet),
        );
        return [
            DeepR(M, left, middle_left, wet_left),
            x,
            DeepL(M, wet_right, middle_right, right),
        ];
    }
    const [rl, x, rr] = split_edge(M, predicate, middle_acc, right);
    return [
        DeepR(M, left, middle, rl),
        x,
        push_l_all(M, edge_to_arr(rr), EMPTY),
    ];
}
export function split<T, M>(
    M: Measure<T, M>,
    predicate: (m: M) => boolean,
    swamp: Swamp<T, M>,
): [Swamp<T, M>, Swamp<T, M>] {
    if (!predicate(measure_swamp(M, swamp))) return [swamp, EMPTY];
    const [l, x, r] = split_swamp(M, predicate, M.empty(), swamp);
    return [l, push_l(M, x, r)];
}

export function locate<T, M>(
    M: Measure<T, M>,
    predicate: (m: M) => boolean,
    swamp: Swamp<T, M>,
): [Swamp<T, M>, T, Swamp<T, M>] | undefined {
    if (!predicate(measure_swamp(M, swamp))) return undefined;
    return split_swamp(M, predicate, M.empty(), swamp);
}

export function insert_at<T, M>(
    M: Measure<T, M>,
    predicate: (m: M) => boolean,
    swamp: Swamp<T, M>,
    value: T,
): Swamp<T, M> {
    const [left, right] = split(M, predicate, swamp);
    return concat(M, left, push_l(M, value, right));
}

export function excise<T, M>(
    M: Measure<T, M>,
    predicateFrom: (m: M) => boolean,
    predicateTo: (m: M) => boolean,
    swamp: Swamp<T, M>,
): [Swamp<T, M>, Swamp<T, M>, Swamp<T, M>] {
    const [left, middle_right] = split(M, predicateFrom, swamp);
    const [middle, right] = split(M, predicateTo, middle_right);
    return [left, middle, right];
}
