type Wet2<T> = { kind: "Wet2"; a: T; b: T };
type Wet3<T> = { kind: "Wet3"; a: T; b: T; c: T };
type Wet<T> = Wet2<T> | Wet3<T>;
type Edge1<T> = { kind: "Edge1"; a: T };
type Edge2<T> = { kind: "Edge2"; a: T; b: T };
type Edge3<T> = { kind: "Edge3"; a: T; b: T; c: T };
type Edge4<T> = { kind: "Edge4"; a: T; b: T; c: T; d: T };
type Edge<T> = Edge1<T> | Edge2<T> | Edge3<T> | Edge4<T>;
type EdgePushable<T> = Edge1<T> | Edge2<T> | Edge3<T>;
type EdgePoppable<T> = Edge2<T> | Edge3<T> | Edge4<T>;

type Empty = { kind: "Empty" };
type Single<T> = { kind: "Single"; value: T };
type Deep<T> = {
    kind: "Deep";
    left: Edge<T>;
    middle: Swamp<Wet<T>>;
    right: Edge<T>;
};
export type Swamp<T> = Empty | Single<T> | Deep<T>;

function Edge<T>(a: T): Edge1<T>;
function Edge<T>(a: T, b: T): Edge2<T>;
function Edge<T>(a: T, b: T, c: T): Edge3<T>;
function Edge<T>(a: T, b: T, c: T, d: T): Edge4<T>;
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
function is_pushable<T>(edge: Edge<T>): edge is EdgePushable<T> {
    return edge.kind !== "Edge4";
}
function is_poppable<T>(edge: Edge<T>): edge is EdgePoppable<T> {
    return edge.kind !== "Edge1";
}
function edge_to_arr<T>(edge: Edge<T>): T[] {
    const result: T[] = [edge.a];
    if (edge.kind === "Edge1") return result;
    result.push(edge.b);
    if (edge.kind === "Edge2") return result;
    result.push(edge.c);
    if (edge.kind === "Edge3") return result;
    result.push(edge.d);
    // edge.kind === "Edge4"
    return result;
}

function dessicate<T>(wet: Wet2<T>): Edge2<T>;
function dessicate<T>(wet: Wet3<T>): Edge3<T>;
function dessicate<T>(wet: Wet<T>): Edge2<T> | Edge3<T>; // EdgePoppable<T> & EdgePushable<T>;
function dessicate<T>(wet: Wet<T>): Edge<T> {
    if (wet.kind === "Wet2") {
        return Edge(wet.a, wet.b);
    }
    // wet.kind === "Wet3"
    return Edge(wet.a, wet.b, wet.c);
}

function Wet<T>(a: T, b: T): Wet2<T>;
function Wet<T>(a: T, b: T, c: T): Wet3<T>;
function Wet<T>(...values: T[]): Wet<T> {
    if (values.length === 2) {
        return { kind: "Wet2", a: values[0], b: values[1] };
    }
    return { kind: "Wet3", a: values[0], b: values[1], c: values[2] };
}

export const EMPTY: Empty = { kind: "Empty" };
function is_empty(swamp: Swamp<unknown>): swamp is Empty {
    return swamp.kind === "Empty";
}
function Single<T>(value: T): Single<T> {
    return { kind: "Single", value };
}
function is_single<T>(swamp: Swamp<T>): swamp is Single<T> {
    return swamp.kind === "Single";
}
function make_deep<T>(
    left: Edge<T>,
    middle: Swamp<Wet<T>>,
    right: Edge<T>,
): Deep<T> {
    return { kind: "Deep", left, middle, right };
}

function push_r_edge<T>(edge: EdgePushable<T>, value: T): Edge<T> {
    if (edge.kind === "Edge1") return Edge(edge.a, value);
    if (edge.kind === "Edge2") return Edge(edge.a, edge.b, value);
    // edge.kind === "Edge3"
    return Edge(edge.a, edge.b, edge.c, value);
}
export function push_r<T>(swamp: Swamp<T>, value: T): Swamp<T> {
    if (is_empty(swamp)) return Single(value);
    if (is_single(swamp)) {
        return make_deep(Edge(swamp.value), EMPTY, Edge(value));
    }
    const { left, middle, right } = swamp;
    if (is_pushable(right)) {
        return make_deep(left, middle, push_r_edge(right, value));
    }
    return make_deep(
        left,
        push_r(middle, Wet(right.a, right.b, right.c)),
        Edge(right.d, value),
    );
}
export function push_r_all<T>(swamp: Swamp<T>, values: T[]): Swamp<T> {
    let acc = swamp;
    for (let i = 0; i < values.length; i++) {
        acc = push_r(acc, values[i]);
    }
    return acc;
}

function push_l_edge<T>(value: T, edge: EdgePushable<T>): Edge<T> {
    if (edge.kind === "Edge1") return Edge(value, edge.a);
    if (edge.kind === "Edge2") return Edge(value, edge.a, edge.b);
    // edge.kind === "Edge3"
    return Edge(value, edge.a, edge.b, edge.c);
}
export function push_l<T>(value: T, swamp: Swamp<T>): Swamp<T> {
    if (is_empty(swamp)) return Single(value);
    if (is_single(swamp)) {
        return make_deep(Edge(value), EMPTY, Edge(swamp.value));
    }
    const { left, middle, right } = swamp;
    if (is_pushable(left)) {
        return make_deep(push_l_edge(value, left), middle, right);
    }
    return make_deep(
        Edge(value, left.a),
        push_l(Wet(left.b, left.c, left.d), middle),
        right,
    );
}
export function push_l_all<T>(values: T[], swamp: Swamp<T>): Swamp<T> {
    let acc = swamp;
    for (let i = values.length - 1; i >= 0; i--) {
        acc = push_l(values[i], acc);
    }
    return acc;
}

function pop_r_edge<T>(edge: EdgePoppable<T>): [Edge<T>, T] {
    if (edge.kind === "Edge2") return [Edge(edge.a), edge.b];
    if (edge.kind === "Edge3") return [Edge(edge.a, edge.b), edge.c];
    // edge.kind === "Edge4"
    return [Edge(edge.a, edge.b, edge.c), edge.d];
}
export function pop_r<T>(swamp: Swamp<T>): [Swamp<T>, T] | undefined {
    if (is_empty(swamp)) return undefined;
    if (is_single(swamp)) return [EMPTY, swamp.value];
    const { left, middle, right } = swamp;
    if (is_poppable(right)) {
        const [r, value] = pop_r_edge(right);
        return [make_deep(left, middle, r), value];
    }
    const popped = pop_r(middle);
    if (popped !== undefined) {
        const [popped_middle, wet] = popped;
        return [make_deep(left, popped_middle, dessicate(wet)), right.a];
    }
    if (is_poppable(left)) {
        const [l, l_end] = pop_r_edge(left);
        return [make_deep(l, EMPTY, Edge(l_end)), right.a];
    }
    return [Single(left.a), right.a];
}
function pop_l_edge<T>(edge: EdgePoppable<T>): [T, Edge<T>] {
    if (edge.kind === "Edge2") return [edge.a, Edge(edge.b)];
    if (edge.kind === "Edge3") return [edge.a, Edge(edge.b, edge.c)];
    // edge.kind === "Edge4"
    return [edge.a, Edge(edge.b, edge.c, edge.d)];
}
export function pop_l<T>(swamp: Swamp<T>): [T, Swamp<T>] | undefined {
    if (is_empty(swamp)) return undefined;
    if (is_single(swamp)) return [swamp.value, EMPTY];
    const { left, middle, right } = swamp;
    if (is_poppable(left)) {
        const [value, l] = pop_l_edge(left);
        return [value, make_deep(l, middle, right)];
    }
    const popped = pop_l(middle);
    if (popped !== undefined) {
        const [wet, popped_middle] = popped;
        return [left.a, make_deep(dessicate(wet), popped_middle, right)];
    }
    if (is_poppable(right)) {
        const [r_start, r] = pop_l_edge(right);
        return [left.a, make_deep(Edge(r_start), EMPTY, r)];
    }
    return [left.a, Single(right.a)];
}

function moisten_all<T>(...values: T[]): Wet<T>[] {
    const result: Wet<T>[] = [];
    for (let i = 0; i < values.length - 4; i += 3) {
        result.push(Wet(...values.slice(i, i + 3) as [T, T, T]));
    }
    if (values.length % 3 === 0) { // Three left
        result.push(Wet(...values.slice(values.length - 3) as [T, T, T]));
    } else if (values.length % 3 === 1) { // Four left
        result.push(
            Wet(...values.slice(
                values.length - 4,
                values.length - 2,
            ) as [T, T]),
        );
        result.push(Wet(...values.slice(values.length - 2) as [T, T]));
    } else { // values.length % 3 === 2 - Two left
        result.push(Wet(...values.slice(values.length - 2) as [T, T]));
    }
    return result;
}
function app3<T>(left: Swamp<T>, middle: T[], right: Swamp<T>): Swamp<T> {
    if (is_empty(left)) return push_l_all(middle, right);
    if (is_empty(right)) return push_r_all(left, middle);
    if (is_single(left)) return push_l(left.value, push_l_all(middle, right));
    if (is_single(right)) return push_r(push_r_all(left, middle), right.value);
    const { left: ll, middle: lm, right: lr } = left;
    const { left: rl, middle: rm, right: rr } = right;
    return make_deep(
        ll,
        app3(
            lm,
            moisten_all(
                ...edge_to_arr(lr),
                ...middle,
                ...edge_to_arr(rl),
            ),
            rm,
        ),
        rr,
    );
}
export function concat<T>(left: Swamp<T>, right: Swamp<T>): Swamp<T> {
    return app3(left, [], right);
}
