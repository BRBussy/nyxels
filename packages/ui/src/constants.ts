// On-screen pixel size of one square. The stroke overlay uses a matching grid so
// pointer positions hit-test with a simple `floor(pos / SQUARE_SIZE)`, and stored
// local points map 1:1 onto the rendered surface.
export const SQUARE_SIZE = 120;
