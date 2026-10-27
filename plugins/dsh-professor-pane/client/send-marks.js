/**
 * Publishing one assessment's marks, from the top of its window on the
 * Students page.
 *
 * *Publish* is the Canvas send the Sync page and Scans already use
 * (`CanvasMarks`): it checks what Canvas holds first, and only its own red
 * press sends. *Publish with 0 for missing* writes the missing-work rule
 * first — `/api/assessment/missing-work`, the column menu's press — so the
 * missing students' zeros are among the marks the check finds; a locked
 * policy refuses that, and the dialog says so with the way to unlock it
 * rather than sending without the zeros.
 */

import { CanvasMarks, useUnpublished } from "./marks.js";
import { h, React, ReactDOM } from "./react.js";
import { BASE, scoped } from "./tabs.js";

export function SendMarksModal(props) {
  const close = props.onClose;
  // With zeros: "setting" until the rule is written, then "ready"; without, ready at once.
  const [step, setStep] = React.useState(props.zeros ? "setting" : "ready");
  const [refused, setRefused] = React.useState(null);
  const [tick, setTick] = React.useState(0);
  const unpublished = useUnpublished(props.runId, props.sessionId, String(props.revision || 0) + "." + tick);

  React.useEffect(() => {
    if (!props.zeros) return;
    fetch(
      scoped(
        BASE + "/api/assessment/missing-work?run=" + encodeURIComponent(props.runId) + "&assessment=" + encodeURIComponent(props.assessment) +
          "&rule=" + encodeURIComponent(props.zeros),
        props.sessionId,
      ),
      { method: "POST" },
    )
      .then((response) => response.json())
      .then((result) => {
        if (!result.ok) {
          setRefused(String(result.error || "the rule was not changed"));
          setStep("refused");
          return;
        }
        props.onWrite(["grading", "assessments"]);
        // The marks to send are read again, now with the zeros among them.
        setTick((value) => value + 1);
        setStep("ready");
      })
      .catch((error) => {
        setRefused(String(error));
        setStep("refused");
      });
  }, []);

  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close]);

  const entry =
    unpublished.phase === "ready" && unpublished.value && Array.isArray(unpublished.value.assessments)
      ? unpublished.value.assessments.find((item) => item.id === props.assessment) || null
      : null;
  // Read once the rule is in: a read from before it would count the marks without the zeros.
  const counted = step === "ready" && entry && (!props.zeros || tick > 0);

  const body =
    step === "setting"
      ? h("p", { className: "pp-as" }, "Giving the missing students 0…")
      : step === "refused"
        ? h(
            React.Fragment,
            null,
            h("p", { className: "pp-saveerr" }, "Missing work was not given 0: " + refused),
            h("p", { className: "pp-as" }, "Nothing was sent. Unlock the policy, then publish again, or publish now without the zeros."),
            h(
              "div",
              { className: "pp-approverow" },
              h("button", { type: "button", className: "pp-segbtn", onClick: props.onPolicy }, "Open the policy"),
              h("button", { type: "button", className: "pp-segbtn", onClick: () => setStep("ready") }, "Publish without the zeros"),
            ),
          )
        : !counted
          ? h("p", { className: "pp-as" }, unpublished.value && unpublished.value.error ? unpublished.value.error : "Reading the marks…")
          : h(
              React.Fragment,
              null,
              props.zeros && tick > 0 ? h("p", { className: "pp-sxsent" }, "✓ Missing work on this now counts 0.") : null,
              h(CanvasMarks, {
                key: "send|" + tick,
                runId: props.runId,
                sessionId: props.sessionId,
                assessmentId: props.assessment,
                title: props.label,
                ask: props.ask,
                names: props.names,
                canvas: entry.canvas,
                autoPreview: true,
                onSent: () => props.onWrite(["grading", "canvas", "marks"]),
              }),
            );

  return ReactDOM.createPortal(
    h(
      "div",
      { className: "pp-veil", onMouseDown: (event) => event.target === event.currentTarget && close() },
      h(
        "div",
        { className: "pp-modal pp-deskmodal", role: "dialog", "aria-modal": "true", "aria-label": "Publish " + props.label, onMouseDown: (event) => event.stopPropagation() },
        h(
          "div",
          { className: "pp-modalhead" },
          h("div", { className: "pp-modaltitle" }, "Publish · " + props.label),
          h("button", { type: "button", className: "pp-close", "aria-label": "Close", onClick: close }, "×"),
        ),
        h("div", { className: "pp-publishbody" }, body),
      ),
    ),
    document.body,
  );
}
