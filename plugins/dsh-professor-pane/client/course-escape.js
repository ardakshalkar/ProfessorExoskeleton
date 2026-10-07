/**
 * What Escape does in course mode, innermost first.
 *
 * A window opened on top of it — a deck, Publish, Grade, Scans, the defence
 * desk — owns the key and closes itself (`none` here); then an open drawer
 * closes; only then does course mode. Apart from the component so the order
 * can be tested without a DOM.
 */
export const courseModeEscape = ({ covered, drawer }) => (covered ? "none" : drawer ? "drawer" : "close");