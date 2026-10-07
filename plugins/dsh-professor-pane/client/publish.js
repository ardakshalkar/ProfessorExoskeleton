/**
 * The publish dialog.
 */

import { h, React, ReactDOM } from "./react.js";

/**
 * The four places a course reaches an audience, and one dialog for them.
 *
 * It began as the homework publish alone, over the whole page rather than
 * beside the list, and that shape was right for a reason that turns out to
 * be general: approval is a sentence and a button, while publishing is a
 * file list, a repository name, an announcement somebody types, a plan that
 * runs to twenty lines, and a decision that reaches people outside this
 * machine. In a pane four hundred pixels wide that was a sliver nobody
 * could read — which is exactly how it was reported: the button "doesn't do
 * anything".
 *
 * It borrows `MaterialModal`'s shell: the same veil, the same Escape, the
 * same rule that a drag started inside the dialog does not dismiss it. What
 * it does NOT borrow is the frame — the content here is this pane's own
 * text, so it is rendered rather than loaded, and no sandbox question
 * arises.
 *
 * **Two presses, per target, always.** The first reads and prints; the
 * second is the only one that writes anything, and it does not exist until
 * the first has come back. Changing the target, the assessment or the
 * message throws the plan away, so the red button can never send something
 * other than what was read — the rule `Send to Canvas` already holds.
 *
 * **Publishing approves nothing.** A record marked `approval: draft` is
 * left out, and the plan names it — *Not published — 1 draft(s)* — so a
 * deck the professor expected and did not see is one line from the reason.
 */
const PUBLISH_TARGETS = [
  {
    id: "page",
    label: "Course page",
    hint: "The week plan students read, with the approved materials beside it, written to dist/pages/",
  },
  {
    id: "telegram",
    label: "Telegram",
    hint: "One plain-text announcement to the run's channel. It cannot be recalled",
  },
  {
    id: "homework",
    label: "Homework repo",
    hint: "The starter repository on GitHub, for one assessment",
  },
  {
    id: "canvas",
    label: "Canvas brief",
    hint: "One assessment's definition — title, points, dates, the brief. Never the marks",
  },
  {
    id: "update",
    label: "Update everywhere",
    hint:
      "Every destination this run has already been published to, and no new ones. " +
      "An announcement is not among them: it cannot be re-derived, only corrected",
  },
];

/**
 * What the second press says it will do, per target.
 *
 * Named after the thing that happens rather than the button that happens
 * it. "Publish" twice in a row tells a professor nothing about whether the
 * next click writes a folder or posts to a channel of a hundred students.
 */
const CONFIRM_LABEL = {
  page: "Write the page",
  telegram: "Send to the channel",
  homework: "Publish to GitHub",
  canvas: "Send to Canvas",
  update: "Update every destination",
};

export function PublishModal(props) {
  const close = props.onClose;
  const state = props.state;
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

  const busy = state.phase === "running";
  const needsAssessment = state.target === "homework" || state.target === "canvas";
  return ReactDOM.createPortal(
    h(
      "div",
      {
        className: "pp-veil",
        onMouseDown: (event) => {
          if (event.target === event.currentTarget) close();
        },
      },
      h(
        "div",
        {
          className: "pp-modal",
          role: "dialog",
          "aria-modal": "true",
          "aria-label": "Publish " + state.label,
          onMouseDown: (event) => event.stopPropagation(),
        },
        h(
          "div",
          { className: "pp-modalhead" },
          h(
            "div",
            { className: "pp-modaltitle" },
            state.label ? "Publish " + state.label : "Publish",
          ),
          h(
            "button",
            {
              type: "button",
              className: "pp-close",
              "aria-label": "Close",
              onClick: close,
            },
            "×",
          ),
        ),
        h(
          "div",
          { className: "pp-publishbody" },
          // Which of the four. Radio-shaped rather than four dialogs,
          // because "put this in front of the class" is one intention and
          // the professor should not have to know which menu it is under.
          h(
            "div",
            { className: "pp-approverow" },
            PUBLISH_TARGETS.map((entry) =>
              h(
                "button",
                {
                  type: "button",
                  className: "pp-segbtn",
                  "aria-pressed": state.target === entry.id,
                  title: entry.hint,
                  disabled: busy,
                  onClick: () => props.setTarget(entry.id),
                  key: entry.id,
                },
                entry.label,
              ),
            ),
          ),
          needsAssessment
            ? h("input", {
                type: "text",
                className: "pp-input",
                placeholder: "ASSESSMENT-04",
                value: state.assessment,
                disabled: busy,
                "aria-label": "Assessment id",
                onChange: (event) => props.setField("assessment", event.target.value),
              })
            : null,
          state.target === "telegram"
            ? h(
                React.Fragment,
                null,
                h("textarea", {
                  className: "pp-publishtext",
                  placeholder:
                    "Homework 3 is open. It is due Friday at 18:00 and counts for 10%.",
                  value: state.message,
                  disabled: busy,
                  "aria-label": "The announcement, exactly as students will read it",
                  onChange: (event) => props.setField("message", event.target.value),
                }),
                h(
                  "p",
                  { className: "pp-publishcount" },
                  state.message.length +
                    " / 4096 characters. This is sent as typed — the command composes nothing.",
                ),
                // Off by default, and that is the safeguard rather than a
                // preference: a second announcement is the ordinary case,
                // and a press that silently rewrote the first would
                // destroy something students had already read.
                h(
                  "label",
                  { className: "pp-publishcount" },
                  h("input", {
                    type: "checkbox",
                    checked: state.edit === true,
                    disabled: busy,
                    onChange: (event) => props.setField("edit", event.target.checked),
                  }),
                  " correct the last announcement instead of posting a new one",
                ),
              )
            : null,
          h(
            "div",
            { className: "pp-approverow" },
            h(
              "button",
              {
                type: "button",
                className: "pp-segbtn",
                disabled: busy,
                title:
                  "Show what would be published, and which drafts would be left out. " +
                  "Writes nothing, here or anywhere else.",
                onClick: () => props.run(false),
              },
              busy ? "Working…" : "Check what would be published",
            ),
            state.phase === "preview"
              ? h(
                  "button",
                  {
                    type: "button",
                    className: "pp-segbtn pp-danger",
                    title:
                      "Publish what has been accepted. Records still marked approval: draft " +
                      "are left out.",
                    onClick: () => props.run(true),
                  },
                  state.target === "telegram" && state.edit
                ? "Correct the message in the channel"
                : CONFIRM_LABEL[state.target],
                )
              : null,
            state.target === "homework"
              ? h("input", {
                  type: "text",
                  className: "pp-input",
                  placeholder: "owner/name, if not recorded",
                  value: state.repo,
                  disabled: busy,
                  "aria-label": "Repository",
                  onChange: (event) => props.setField("repo", event.target.value),
                })
              : null,
            state.target === "canvas"
              ? h("input", {
                  type: "text",
                  className: "pp-input",
                  placeholder: "every subgroup",
                  value: state.group,
                  disabled: busy,
                  "aria-label": "Subgroup",
                  onChange: (event) => props.setField("group", event.target.value),
                })
              : null,
          ),
          state.phase === "idle"
            ? h(
                "p",
                { className: "pp-publishhint" },
                "Nothing has been read or written yet. Check first; publishing is the " +
                  "second press. Anything still marked approval: draft is left out.",
              )
            : h(
                "pre",
                {
                  className:
                    "pp-publishout" + (state.phase === "error" ? " pp-approveerr" : ""),
                },
                state.text,
              ),
        ),
      ),
    ),
    document.body,
  );
}
