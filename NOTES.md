https://fever-note-47775022.figma.site/

High-impact layout tweaks

Make Chart Configuration collapsible (accordion) with a small “Preview apply” toggle; default collapsed after first use.

Keep Labels as the right sidebar but split it into two tabs: “Labels” and “History”. History = past edits + versions (pairs naturally with Undo/Redo).

Keep Dataset Preview as a thin strip under the chart; add a hide/show chevron. It should mirror the current zoom region.

Consider a floating micro-toolbar anchored top-right of the chart (desktop only): Zoom in/out, Fit, Snap, and a label-type quick switcher. This reduces pointer travel during dense work.

Labeling interactions (the core of the experience)

Create/edit: click-drag to create region; draggable handles on edges; Alt/Option = move region; Shift = extend; Esc = cancel.

Keyboard: 1–9 to pick label types; Arrow keys nudge edges by 1 sample; Shift+Arrow by 10; Ctrl/Cmd+Arrow by 100.

Snapping: optional snap to peaks, troughs, zero-crossings, or detected phase boundaries; show a subtle “snapped” indicator.

Guides: show start/end cursors with timestamp/index, duration (Δt/Δθ), and area under curve; crosshair readout on hover.

Conflict model: decide early—are labels exclusive on one lane, or can you have multiple lanes/classes stacked? Represent conflicts with pattern overlays + warnings.

Visual encoding

Use colorblind-safe palette and keep shaded overlays at ~20–30% opacity with a distinct border stroke.

When many segments are close, outline on hover and show a compact inline tag (e.g., “Normal [48–183]”).

Allow patterns as an accessibility fallback (diagonal, dots) for users who can’t rely on color.

Information architecture

Right sidebar:

Labels tab: search + filter by type; sort by start time; batch delete/merge; “go to” icon to focus a label.

History tab: linear list of actions with timestamps; “Revert here” CTA; small diff summary (e.g., “+3 labels, −1”).

Chart Configuration groups: Axes, Rendering (smoothing/decimation), Snapping, Overlays, Appearance. Progressive disclosure: advanced options behind “Show advanced”.

Performance (crucial for long series)

Render the main plot on Canvas or WebGL, not SVG; decimate on the fly for large N; throttle mousemove.

Keep a decoupled interaction layer (hit-testing on simplified geometry).

Lazy-render labels list (virtualized rows).

State, safety, and collaboration

Autosave with “Saved · 2s ago” indicator; local draft cache for offline or unexpected reloads.

Versioning per dataset; export includes data + label schema + units + timezone.

Confirm destructive actions; provide Undo for at least 50 steps.

Empty states and guidance

First-time use: highlight Upload Data as the primary CTA and show a 3-step quick tour: Upload → Zoom/Select → Assign label (1–9).

Provide “?” help popover with keyboard cheatsheet.

Responsiveness

≥1200px: current grid works well.

900–1199px: collapse Chart Configuration by default.

≤680px: make Label Controls a sticky bottom sheet; labels list becomes a full-screen modal with a back button.

Accessibility

All controls ≥44×44 px; visible focus rings; full keyboard coverage for create/edit/zoom; tooltips with units; dark mode that respects system setting.

Micro-copy

Use verb-first buttons (“Upload data”, “Export labels”).

Inline feedback: “Segment snapped to local peak”; “3 labels updated”.

If you want, I can update the wireframe to add the floating micro-toolbar, the right-sidebar tabs (Labels/History), and the collapsible Chart Configuration—so your team has a clearer blueprint before wiring the real components.
