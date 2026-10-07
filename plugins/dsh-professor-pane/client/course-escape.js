/**
 * What Escape does in course mode, innermost first.
 *
 * A window opened on top of it (a deck, Publish, Grade, Scans, the defence
 * desk) owns the key and closes itself (`none` here); only then does course
 * mode close. Students, Gradebook and Tasks are views chosen in its header
 * like the readings, not layers, so Escape does not step back through them.
 * Apart from the component so the order can be tested without a DOM.
 */
export const courseModeEscape = ({ covered }) => (covered ? "none" : "close");
