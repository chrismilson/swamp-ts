> I wrote a little bit about this
> [here](https://gist.github.com/chrismilson/c53b9bcdcdbf27863beb2693670c9abc)

# `Swamp`

I really like learning about different data structures. Orchestrating simple
operations to make sophisticated objects is awesome.

[This paper](https://www.cs.ox.ac.uk/ralf.hinze/publications/FingerTrees.pdf)
defined Finger Trees in gory detail, but it's pretty dense. I wanted to learn
how they work a bit better, so decided to implement them myself in Typescript.

## Naming

I think the original "Finger" tree is pretty descriptive; the paper goes into
why they chose the name. To me it just felt a bit bland, and the naming of the
internal `Node` objects didn't make it immediately obvious that each level of
the tree would get recursively deeper `Nodes` as items.

Since items get more _"Node"_ (_adj. to have more recursive levels of Node_) as
they go down levels, it felt like the items were somehow getting denser, or
wetter, as they went down, so my `Swamp` naming all came out of that. The way
the items sink into the middle and get denser just felt right.
