# Third Post

There was nothing really to implement for
[the third post](https://gist.github.com/chrismilson/e4121a8189eed45d696af6112149c363).

But I gave some exercises around Big O notation, so here are worked answers:

### Anything O(log n) is also O(n)

Let's pick some `f(n)` that is `O(log n)`. To show it's `O(n)`, we need to pick
constants. We already know it doesn't matter what the base is, so let's just
pick base 2. That means there are some `C` and `N_0` such that
`f(n) < C * log_2(n)` for all `n > N_0`.

Here's a fact: `n <= 2^n` for all `n >= 1`. Since `log_2` is an increasing
function, we're allowed to take `log_2` of both sides without breaking anything,
which gives us `log_2(n) <= log_2(2^n) = n` for all `n >= 1`.

So let's pick `N_0' = max(N_0, 1)` and keep the same `C`:

```
f(n) < C * log_2(n)
    <= C * n        // because log_2(n) <= n when n >= 1
```

### Anything O(n) is also O(n^2)

Let's pick some arbitrary `f(n)` that is `O(n)`. That gives us a `C` and `N_0`
with `f(n) < C * n` for all `n > N_0`. Pick `N_0' = max(N_0, 1)` and keep the
same `C`:

```
f(n) < C * n
    <= C * n * n // because n >= 1 and multiplying by something at least 1 only increases
     = C * n^2
```

### Anything O(n^k) is also O(2^n)

Before we get into it, just want to reiterate a couple of classics:

- `2^n` is the number of subsets on `n` elements. If you have `n` candies and
  you show them to someone on the street, asking them to take whichever ones
  they like will have `2^n` different possible ways they could do that. (for
  every item of the `n` there are two choices; take or not take. Multiply the
  two for every item; `2^n`)
- `Ch(n, k)` is the number of subsets on `n` elements with `k` elements exactly.
  (often pronounced "n choose k") It's equal to `n!/(k!(n-k)!)` (line them all
  up in some random permutation (of which there are `n!`) draw a line such that
  you have exactly `k` on the left. You could have had `k!` permutations that
  gave you the same `k` on the left, and `(n-k)!` permutations that gave you the
  same `n-k` on the right.)
- `2^n >= C(n, k)`, hopefully it doesn't take much convincing that "all subsets"
  contains "all subsets, with size `k`".

Ok. Remembering that `k` is a constant, notice that if `n > 2k`, then because
`n!/(n-k)!` is `n * (n-1) * ... * (n - k  + 1)` and all `k` of those terms are
more than `n/2`, we have `n!/(n-k)! >= (n/2)^k`. (you should double check that
there are indeed `k` terms in there, each more than `n/2`) That's really all we
needed. To show that some `f(n)` that is `O(n^k)` is also `O(2^n)`, assuming the
standard `N_0` and `C` as before, we'll pick (It seems like I'm picking now, but
I went through the inequalities below first to work out what they needed to be
and then put them here so that there is less clutter in there)
`C' = C * 2^k * k!` and `N_0' = max(N_0, 2k)`:

```
f(n) < C * n^k                             // Because f(n) is O(n^k)
     = C * ((2^k * k!) / (2^k * k!)) * n^k // Just multiplying by 1, nothing to see here
     = C' * (n^k / (2^k * k!))             // Changing brackets and substituting C'
     = C' * (n/2)^k / k!                   // Again, rearranging
    <= C' * (n! / (n-k)!) / k!             // What we found when n > 2k, and n > N_0 >= 2k
     = C' * Ch(n, k)                       // Just replacing factorials with Ch
    <= C' * 2^k
```

### Anything O(2^n) is also O(3^n)

Let's say `f(n)` is `O(2^n)`, so `f(n) < C * 2^n` for all `n > N_0`. Keep the
same `C` and the same `N_0`:

```
f(n) < C * 2^n // because n > N_0 <= C * 3^n // because 2^n <= 3^n, for every n,
easy, no exceptions.
```

Done. Easiest one of the lot. (The same trick shows anything `O(a^n)` is also
`O(b^n)` whenever `a <= b`.)

### There are some things which are O(3^n) but are NOT O(2^n)

Let's take `f(n) := 3^n`. It's obviously `O(3^n)` — pick `C = 1` and `N_0 = 0`.

Now let's assume (expecting a contradiction), that it's also `O(2^n)`. Then
there are some `C` and `N_0` such that `3^n < C * 2^n` for all `n > N_0`. Divide
both sides by `2^n`:

```
(3/2)^n < C for all n > N_0
```

But `(3/2)^n` just keeps growing forever. There's no constant that can sit above
something that grows without bound.

### Anything O(k^n) is also O(n!)

This one needs a sneaky trick with the factorial. Remember what `n!` actually
is:

```
n! = 1 * 2 * 3 * ... * n
```

Say `n >= 2k`. Then the last `n - k` factors (`(n - k)`, `(n-k)+1`, `(n-k)+2`,
..., `n`) are all at least `k`. (let that sink in as to why) So if we divide
`n!` by the small factors at the start, (the ones less than `n - k`) we decrease
it, and if we replace each of the `(n-k) + i` with just `k`, that decreases it
too. We get `n! > k^{n - k}`. Which we can rearrange to `n! > k^n / k^k`.

If we multiply both sides by `k^k`, we get `k^n <= k^k * n!` for all `n >= 2k`.
And `k^k` is just some constant, so we bake it straight into `C` like we always
do.

Let's say `f(n)` is `O(k^n)`, so `f(n) < C * k^n` for all `n > N_0`. Pick
`N_0' = max(N_0, 2k)` and `C' = C * k^k`:

```
f(n) < C * k^n // because n > N_0', and N_0' >= N_0 <= C * k^k * n! // because
k^n <= k^k * n! when n >= 2k = C' * n! // substitute C' = C * k^k
```

```
```
