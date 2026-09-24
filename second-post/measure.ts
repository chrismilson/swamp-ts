export type Measure<T, M> = {
    empty(): M;
    combine(a: M, b: M): M; // Should be associative
    measure(x: T): M;
};

// Takes a Measure<T, M> and returns T
type Subject<MM> = MM extends Measure<infer T, unknown> ? T : never;
// Takes a Measure<T, M> and returns M
type Metric<MM> = MM extends Measure<unknown, infer M> ? M : never;
// Takes a list of [Measure<T1, M1>, Measure<T2, M2>, ...] and returns [T1, T2, ...]
type UnwrapSubjects<Ms extends Measure<unknown, unknown>[]> = {
    [K in keyof Ms]: Subject<Ms[K]>;
};
// Takes a list of [Measure<T1, M1>, Measure<T2, M2>, ...] and returns [M1, M2, ...]
type UnwrapMetrics<Ms extends Measure<unknown, unknown>[]> = {
    [K in keyof Ms]: Metric<Ms[K]>;
};
// Takes a list of types [T1, T2, ...] and returns T1 | T2 | ...
// If they're all the same type, [T, T, T, ...] then just returns T.
type Disjunction<Ts extends unknown[]> = { [K in keyof Ts]: Ts[K] }[number];
// Memes
// Takes a list of types [T1, T2, ...] and returns T1 & T2 & ...
// If they're all the same type, [T, T, T, ...] then just returns T.
type Conjunction<Ts extends unknown[]> =
    { [K in keyof Ts]: (x: Ts[K]) => unknown }[number] extends
        (x: infer I) => unknown ? I : never;

// A more generic version for clicking through from the post
// The casts to Unwrap<Ms> are just because .map doesn't have a hard type for Tuples.
export function productMeasure<Ms extends Measure<unknown, unknown>[]>(
    ...Ms: Ms
): Measure<Conjunction<UnwrapSubjects<Ms>>, UnwrapMetrics<Ms>> {
    return {
        empty: () => Ms.map((M) => M.empty()) as UnwrapMetrics<Ms>,
        combine: (a, b) =>
            Ms.map((M, i) => M.combine(a[i], b[i])) as UnwrapMetrics<Ms>,
        measure: (x) => Ms.map((M) => M.measure(x)) as UnwrapMetrics<Ms>,
    };
}
