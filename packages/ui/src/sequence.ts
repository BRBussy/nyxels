// The canvas grows from one corner in repeating L-shaped shells. Numbering the
// squares in the order they may be added:
//
//   index: 0     1     2     3     4     5     6     7     8
//   coord: [0,0] [1,0] [1,1] [0,1] [2,0] [2,1] [2,2] [1,2] [0,2] …
//
// Shell n (n >= 1) completes an (n+1)×(n+1) grid by adding 2n+1 squares:
//   • up the new column x=n:   [n,0], [n,1], … [n,n]   (n+1 squares)
//   • then left along row y=n:  [n-1,n], … [0,n]        (n squares)
// Shell n therefore occupies indices [n², (n+1)²−1].

export type Coord = readonly [x: number, y: number];

/** The coordinate of the `index`-th square in L-shell order (0-based). */
export function coordAt(index: number): Coord {
  // Shell number = floor(sqrt(index)), made robust against float error at
  // perfect squares (e.g. Math.sqrt(25) might be 4.999999…).
  let n = Math.floor(Math.sqrt(index));
  if ((n + 1) * (n + 1) <= index) n++;
  if (n * n > index) n--;

  const offset = index - n * n; // 0 .. 2n, position within the shell
  if (offset <= n) return [n, offset]; // up the new column x=n
  return [n - (offset - n), n]; // left along the new row y=n
}

/**
 * Number of columns/rows needed to display `cellCount` cells (placed squares
 * plus, if you include it, the next "add" placeholder). Because the cell at the
 * highest index always sits in the outermost shell, its max coordinate bounds
 * the whole figure.
 */
export function gridExtent(cellCount: number): number {
  if (cellCount <= 0) return 1;
  const [x, y] = coordAt(cellCount - 1);
  return Math.max(x, y) + 1;
}
