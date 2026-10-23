# Designing processes, and putting them in the pane

[`BACKLOG.md` WF-1](../BACKLOG.md#e36--every-process-as-data-drawn-by-one-ui-and-read-by-the-assistant--no-futuremd-section-yet).
A research note, written 2026-10-22: how other fields design multi-step work
that people and software share, and what each idea means for this harness.
It argues for the shape E36 proposes and against two things it could have
been. The worked case is exam grading, written out in
[`EXAM-GRADING.md`](EXAM-GRADING.md).

Sources are listed at the end. Several are vendor blogs; where a claim rests
only on one, it says so.

---

## The problem, in one paragraph

The pane runs at least nine processes that take more than one step: grading
an exam, an oral defence, homework forks, roster and Canvas syncs,
publishing, term planning, materials, onboarding, course readiness. Only one
has a step strip, and it is a hardcoded array with a `switch` for its
headline. The others keep their state in a client variable, a checklist, or
nowhere. The assistant learns each order from prose in its skills. Every new
process costs a new strip, a new "what's next", a new paragraph of order, and
a new place for the three to disagree.

## 1 · A flowchart or a case

There are two standard ways to model a process, and they answer different
work.

**BPMN** draws a process as a flowchart: tasks, gateways, sequence flows. It
fits work that is predictable and repeated, where the people mostly carry out
the tasks the diagram hands them.

**CMMN** (Case Management Model and Notation) was written for the other kind:
knowledge work, where the person decides what to do next. It is built around
a **case file** — the information the case has gathered — and tasks that
become **available** when their conditions on the case file hold. Some tasks
are **discretionary**: the worker chooses whether and when to run them, and
applicability rules say when each one may be picked. The worker sees a list
of what is possible now, not a single next box. Stages can be entered and
re-entered; milestones mark that something was achieved, not that a line was
walked.

Vendors disagree on whether CMMN is needed as a notation (Camunda argues that
BPMN plus good tooling covers most case work); one academic study found the
full notation heavy for non-experts, and that letting the workers structure
their own work kept the flexibility while improving progress visibility.

**For this harness.** Teaching is case work. The professor grades question 3
before question 1, opens an integrity case in the middle of marking, changes
the rubric after seeing the answers, skips moderation on a 5% quiz. The
Scans strip already behaves like a case in one place — once a paper is
placed, Match stops blocking Read (`P/server/scans.js:232`) — which is a
flowchart being bent into one. So:

- the **case file** is the run's records and the private folder — it exists;
- a stage has `available_when` and `done_when` conditions over it, not a
  predecessor;
- side lanes (integrity) and discretionary stages (moderation, a curve) are
  first-class;
- the pane shows what is available and the one it suggests, never a locked
  "next".

No notation is adopted. The idea is.

## 2 · Where the state lives

**Statecharts** — Harel's extension of state machines with nesting,
parallel regions and history; XState is the usual JavaScript library — are
the clean way to drive a multi-step UI: one state per step, guarded
transitions, the machine readable at a glance. Teams that use them for UI
flows report that the machine's context can replace a separate state store.

The catch for us is the word *store*. A statechart holds "we are in Mark"
as its own value. Here that would be a second truth beside the records,
and the two would drift the first time a record is edited in chat or from
the CLI. This harness already decided the same question for drafts:
approval is a field on the record, not a folder or a flag kept elsewhere.

**For this harness.** The stage is **computed from the records** every time,
as `stagesOf` already does. A definition is a set of predicates; the engine
evaluates them; nothing stores "current". Statecharts stay useful inside a
view for transient UI state (a dialog, the defence desk's hands-free phase),
where nothing durable depends on it.

## 3 · Long waits on a person

**Durable execution** engines run a process as code that can pause for days
and survive crashes. LangGraph pauses a graph at `interrupt()`, keeps its
state in a checkpointer, and resumes when it is re-invoked with the human's
answer. Temporal runs workflows whose waits are durable by construction and
resumes them on a signal; its LangGraph plugin runs LangGraph graphs inside
Temporal for that reason (vendor source). Cloudflare's agent docs describe the
same pattern as Workflow approvals and MCP elicitation. The argument for an
engine, made by its users, is that a checkpoint saves *state* but not
*execution*: something still has to notice a dead process, find the
checkpoint and re-enter.

**For this harness.** The wait on the professor is already durable: it *is*
the files. A paper waiting to be placed, a rubric waiting to be chosen, a mark
waiting to be decided — each is a record in a state, and nothing has to be
re-entered after a restart, because the engine recomputes from the records.
What is not durable is the **long machine step** — reading 60 scans, or
transcribing recorded defences — which today holds an HTTP request open for
up to 30 minutes and is forgotten on reload. That is a job runner, specified
as E34 (JOB-2…5), not a workflow engine. **No engine is adopted**; adding one
would put a second store of "where we are" in front of the records, which
section 2 rules out.

## 4 · Where to put the person

The human-in-the-loop literature (mostly practitioners and vendors; no
standard exists) agrees on a short list:

1. **Checkpoint where an error costs more than a person.** Pause before an
   action that is outward, hard to undo, or consequential; let the rest run.
2. **A good checkpoint shows context, a diff, and one clear decision.** Not
   "approve?" alone.
3. **Route by confidence.** Send only the uncertain outputs to review.
4. **Review in groups, with bulk actions, filtering and sorting** — otherwise
   approval fatigue sets in and the review becomes a rubber stamp.
5. **Keep the audit.** What the AI proposed, what the person changed, who
   pressed, and why — because that is what is asked for when a decision is
   questioned. The EU AI Act's human-oversight article for high-risk systems
   (which lists education and the evaluation of learning outcomes) makes this
   expected rather than optional.

Gradescope's answer groups are the closest product to ours: the instructor
chooses "form answer groups first", the AI proposes the groups, the
instructor checks and corrects them, then grades each group once. Its stated
design goal is that the instructor can verify a group is fully correct and
fix a mistake cheaply (vendor framing).

**For this harness.** E28 already does 2–5 for marks: groups, bulk accept,
confidence on each card, `ai_suggestion` kept beside `professor_decision` with
how it was decided. Point 3 is missing for *reads* (EXAM-GRADING §5). The
definition makes each of these a property a stage declares — `gate`,
`outward`, a confidence route — so the next process gets them without being
re-designed.

## 5 · Automation bias in AI-assisted grading

The catch in point 4: review by a person is weaker than it looks.

- A study reported in PNAS Nexus (Megalokonomou, Monash) found that expert
  reviewers were **more likely to accept incorrectly harsh decisions when
  told an AI made them** than when told a colleague did.
- A 2025 conference study of GPT-4o found AI-written rubrics **stricter** than
  human ones and widely varying, and that the model detected a biased review
  when shown one answer at a time but **largely failed when shown several at
  once**.
- A field study of LLM grading in Canvas found about 30% of students upset by
  preliminary AI grades lower than their final ones — an argument for
  releasing only decided marks, which the harness already does.
- A randomised trial of teachers with no AI, an untrained chatbot, and a
  deliberately fair or harsh assistant is registered for January–July 2026;
  no results yet.

**For this harness.** "Accept all" stays — the decision of 2026-10-02 holds —
but a process that offers bulk acceptance owes a check that is not bulk. That
is the Moderate stage (EXM-3: a sample marked *before* the suggestion is
shown, then compared) and the harsh-mark list (EXM-4). Both are cheap because
the audit (point 5 above) already records which decisions were bulk.

## 6 · What universities already require

Marking and moderation policies (Keele, UCL, Imperial, Bristol, Loughborough,
York St John, BSMS) separate:

- **Double marking**, blind (neither marker sees the other's mark; the final
  mark agreed) or open (the second marker sees the first). Usually reserved
  for high-stakes work, dissertations, or inexperienced markers.
- **Check marking** — a second marker confirms or queries without giving a
  mark; UCL limits it to objectively scored work.
- **Moderation** — a sample across the mark range plus borderline cases,
  reviewed by a second internal examiner to confirm the criteria were applied
  consistently. Required for single-marked work; replaced by double marking
  where that is done.
- **A record** — a signed form or a short rationale for any mark changed.

**For this harness.** The assistant's suggestion is, structurally, a first
marker. Blind second marking is the right model for EXM-3's sample: mark
first, then see the suggestion. Moderation's sample rule — the range plus
the borderlines — is the sample EXM-3 draws. When a teaching team exists
(E20), the same stage takes a second human marker, and a course chooses blind
or open as a setting (WF-8).

## 7 · AI-drawn interfaces

**Generative UI** specs let an agent describe a view as data that the app
renders from its own components. Google's A2UI (v0.9, April 2026) is a
framework-agnostic JSON format for "UI intent"; AG-UI is an event protocol
that streams it, and tool calls and state deltas, to the frontend. The client
keeps a **catalog** of components and maps the agent's JSON onto them; a
validator rejects bad output before anything is drawn. Write-ups describe a
spectrum: pre-built components only, declarative specs like A2UI, and
open-ended sandboxed HTML (most of the detail is from secondary and
maintainer-affiliated sources).

**For this harness.** The safe end of that spectrum is the one that fits.
The assistant may *propose* a process (WF-9) or, later, a view, as data
against a schema, validated before it is shown, drawn by components the pane
already has. It never writes pane code or HTML for the professor's screen.
That keeps the line — the pane does deterministic work, judgement runs on the
session — and keeps a proposal reviewable as a draft like any other.

---

## What this note recommends

1. **A process is a case, not a flowchart** (§1): stages available on
   conditions over the records, side lanes and discretionary stages
   first-class, one suggested "now".
2. **State is computed, never stored** (§2): the engine evaluates predicates;
   `stagesOf` is its first instance.
3. **No workflow engine** (§3): the human waits are already durable; the
   machine waits are E34's job runner.
4. **Each stage declares its oversight** (§4): `actor`, `gate`, `outward`,
   confidence routing, and the audit is inherited from the records.
5. **Bulk acceptance owes a blind sample** (§5, §6): Moderate is part of the
   exam process, not an add-on.
6. **The assistant proposes processes as data** (§7), validated, never code.

Next: WF-2 (the schema), with exam grading as its first definition and
`stagesOf` on Quiz 1 of CSS-4007 as the golden test (WF-3).

---

## Sources

Process modelling
- Visual Paradigm, *What is CMMN* — https://visual-paradigm.com/guide/cmmn/what-is-cmmn (vendor)
- Camunda, *CMMN patterns in BPMN* — https://camunda.com/blog/2023/07/cmmn-patterns-bpmn/ (vendor)
- FHNW, paper on CMMN and knowledge work — https://irf.fhnw.ch/bitstreams/df9ae542-092f-42c3-966f-5155d8886164/download
- TUM sebis, end-user structuring of knowledge work — https://www.cs.cit.tum.de/fileadmin/w00cfj/sebis/publications/Ha15a.pdf

Statecharts
- Stately, *XState* docs — https://stately.ai/docs/xstate
- Bakkenbaeck, *Using XState for UI flows* — https://bakkenbaeck.com/tech/using-xstate-for-ui-flows
- Tim Deschryver, *My love letter to XState and statecharts* — https://timdeschryver.dev/blog/my-love-letter-to-xstate-and-statecharts

Durable execution and human waits
- LangChain, *LangGraph human-in-the-loop* — https://docs.langchain.com/oss/python/langgraph/human-in-the-loop
- LangChain, *Interrupts* — https://docs.langchain.com/oss/langgraph/interrupts
- Temporal, *LangGraph plugin* — https://temporal.io/blog/temporal-langgraph-plugin-durable-execution (vendor)

Human-in-the-loop review
- Velt, *Designing human-in-the-loop workflows* — https://velt.dev/blog/designing-human-in-the-loop-workflows-ai-products (vendor)
- Zartis, *Human-in-the-loop UI patterns* — https://www.zartis.com/human-in-the-loop-ui-patterns-designing-intentional-friction-for-safer-ai-products/
- Agentic Wire, *Agent UX design patterns, 2026* — https://www.agenticwire.news/article/agent-ux-design-patterns
- Gradescope, answer groups — https://guides.gradescope.com/hc/en-us/articles/24838908062093
- University of Miami, *AI-assisted grading with Gradescope* — https://lpt.it.miami.edu/resources/faculty-and-staff/leverage-ai-tools/ai-assisted-grading/index.html
- Turnitin, *Design principles of AI-assisted grading* — https://www.turnitin.com/blog/design-principles-of-ai-assisted-grading (vendor)

Automation bias and AI grading
- Report on the PNAS Nexus study of AI-attributed harsh decisions — https://nordot.app/1443968278997009130
- University of Turku, AI in rubric production and reviewer bias — https://research.utu.fi/converis/portal/detail/Publication/508251804?lang=en_GB
- *Impacts of histories and models on LLM grading* (arXiv 2606.08400) — https://arxiv.org/pdf/2606.08400
- AEA RCT registry, *Teacher biases and AI* — https://www.socialscienceregistry.org/trials/17679

Marking and moderation
- Keele, *Marking and Moderation Policy 2025* — https://www.keele.ac.uk/media/keeleuniversity/policyzone20/studentandacademicservices/Marking-and-Moderation-Policy-2025.pdf
- UCL Academic Manual, *Marking & moderation* — https://www.ucl.ac.uk/academic-manual/chapters/chapter-4-assessment-framework-taught-programmes/section-4-marking-moderation
- Bristol, *Marking, moderation and anonymity* — https://www.bristol.ac.uk/academic-quality/assessment/regulations-and-code-of-practice-for-taught-programmes/marking-and-moderation/
- Loughborough, Senate paper on moderation — https://www.lboro.ac.uk/admin/committees/senate/papers/2007/sen07-p85a.htm
- York St John, *Marking and Moderation* — https://www.yorksj.ac.uk/media/content-assets/registry/policies/code-of-practice-for-assessment/24.Marking-and-Moderation.pdf
- BSMS, *Moderation policy* — https://www.bsms.ac.uk/_pdf/undergraduate/bmbs-moderation-policy-revised-doc-final-april-2024.doc.pdf

Generative UI
- Google Developers, *A2UI v0.9* — https://developers.googleblog.com/en/a2ui-v0-9-generative-ui/
- CopilotKit, *What's new in A2UI* — https://copilotkit.ai/blog/a2ui-whats-new-in-google-generative-ui-spec (AG-UI maintainer)
- *Generative UI in 2026: controlled, A2UI declarative, and open-ended patterns on AG-UI* — https://mer.vin/2026/06/generative-ui-in-2026-controlled-a2ui-declarative-and-open-ended-patterns-on-ag-ui/
