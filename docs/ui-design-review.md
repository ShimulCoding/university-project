# UI Design Review

## Scope and direction

The review covered all 39 page files, public and workspace layouts, shared controls, student participation forms, financial charts, PDF presentation, and loading/error/empty states. Existing event permissions and backend workflows remain the basis for every screen.

The design uses warm paper surfaces, deep ink navigation, jade accents, restrained borders, and a consistent spacing scale. Fraunces gives public headings an editorial identity; Public Sans supports forms and operational records; IBM Plex Mono identifies financial references. Event teams and System Admin have distinct entry points and clear workspace context.

The home page's ledger illustration uses actual published amounts. Event and summary metrics describe their current page or data source. Visual polish does not introduce invented totals, activity, health status, or cryptographic guarantees.

## Findings and permanent changes

| Finding | Root cause | Change |
| --- | --- | --- |
| Weak hierarchy and excessive scrolling | Repeated oversized hero panels, heavy type, decorative gradients and large gaps across operational pages | Compact workspace introductions, clearer record/detail hierarchy, quieter panels, and responsive spacing |
| Internal navigation consumed too much space | Descriptions repeated on every sidebar link; oversized context headers | A shared sidebar with concise labels, current-page indication, account context and a native mobile disclosure menu |
| Difficult mobile navigation | Public links were an overflowing horizontal strip | A labeled, keyboard-accessible menu that closes after navigation |
| Inconsistent, faint form boundaries | Inputs specified border colors without a border width | Explicit borders, consistent control sizing, visible focus and disabled states |
| Field help and errors were not associated with controls | Shared fields relied solely on nested labels; server-rendered select wrappers obscured the control boundary | Stable control IDs, explicit label associations, `aria-describedby`, invalid state and announced errors; client controls preserve their IDs across server/client rendering |
| Status colors were unreliable | The `info` token was absent; some pages referenced an undefined `danger` color; translucent text reduced contrast | Defined semantic colors, consistent destructive styling, and full-opacity status text |
| Report widened the mobile page | SVG minimum width propagated through an unconstrained grid child | Grid children can shrink; the chart scrolls inside its own keyboard-accessible panel |
| Audit details could not be scrolled by keyboard | Overflowing metadata had no focus target | A named, focusable metadata region with readable type |
| Incorrect registration metrics | Closed-window counts were based on completed event statuses | Counts use the actual registration-window state |
| Large category amounts could lose cents | Web/PDF charts independently added JavaScript floating-point values | Shared exact decimal aggregation and differences; floating-point geometry remains separate from displayed amounts |
| Small comparisons had misleading axes/bars | Fractional axis ticks were rounded and PDF bars imposed a minimum height | Distinct fractional ticks and proportional chart geometry, including very small amounts |
| Chart detail interaction and large totals were awkward | Hover state also acted as click selection; large amounts crowded the donut center | Independent persistent selection for touch/click, keyboard interaction and exact totals outside the chart graphic |
| PDF chart detail could become crowded | Budget, actual and difference shared one long line | Separate labeled lines with wrapping and page-space calculation |
| Forms hid or obscured recovery choices | Dense sign-in panels and password fields without visibility controls | Clear account modes, password visibility, accessible recovery links, and focused event/System Admin entry panels |
| Participation stages were difficult to follow | Registration and evidence pages lacked a shared progress model | A reusable account/registration/payment progress indicator, tied to actual state |
| Secondary complaint history competed with submission | Full history appeared before the complaint form | A collapsible previous-submissions section when history exists |
| Motion and focus were inconsistent | Several independent hover/loading effects and no skip target | A skip link, one primary content landmark, restrained entry transitions and reduced-motion support |
| System event creation was cramped | The creation form occupied a narrow detail column | Full-width creation area with a direct page action |
| Mobile account editing required excessive scrolling | Every account expanded ahead of the selected profile | A bounded, keyboard-accessible account list, visible pagination and direct links to profile details |
| Account type instructions were clipped on mobile | A long select option combined the account name and assignment instructions | A short account label with separately associated, wrapping help text |

## Page coverage

| Pages | Review and treatment |
| --- | --- |
| `/` | Data-based ledger hero, editorial hierarchy, truthful overview metrics, event discovery and privacy context |
| `/events`, `/events/[eventLookup]` | Search/status filters, usable event cards, registration availability, readable event details and team entry |
| `/events/[eventLookup]/register` | Account entry, progress, availability and registration form hierarchy |
| `/registrations/[registrationId]`, `/registrations/[registrationId]/payment-proof` | Ownership views, progress, payment history, evidence and upload instructions |
| `/complaints`, `/complaints/new` | Student session, private history, evidence and focused submission |
| `/financial-summaries`, `/financial-summaries/[eventLookup]` | Search, exact page totals, readable report cards, keyboard-accessible charts and coordinated PDF colors |
| `/reset-password` | Public shell, missing-token/form states, password visibility and recovery feedback |
| `/dashboard` | Dedicated System Admin sign-in and global overview with event handoff status |
| `/dashboard/events`, `/dashboard/users`, `/dashboard/audit`, `/dashboard/complaints` | Event/team setup, account administration, metadata review and platform complaint handling |
| `/dashboard/my-events` | Account context and concise assigned-event cards with readable role labels |
| `/dashboard/events/[slug]` | Event-specific sign-in, active-team overview, assignment context and module links |
| Event `/payments`, `/income-records`, `/expense-records` | Responsive records, evidence, status and financial actions |
| Event `/budgets`, `/budget-requests`, `/funding-requests`, `/expense-requests`, `/approvals` | Itemized budgets, monetary requests, revision/decision history, forms and action hierarchy |
| Event `/complaints`, `/reconciliation`, `/publications` | Review/history, report state, finalization/publication prerequisites and clear disclosure scope |
| Legacy global `/payments`, `/income-records`, `/expense-records`, `/budgets`, `/budget-requests`, `/expense-requests`, `/approvals`, `/reconciliation`, `/publications` | Matching presentation and preserved System Admin oversight restrictions |
| `/dashboard/controls` | Shared form/table/feedback examples, clearly labeled as examples |
| Loading, recovery, error and not-found states | Readable feedback, navigation/retry choices, main-content targets and motion preferences |

Operational record lists retain pagination, selection, revisions, protected attachments and event authorization. Wide tables and charts have local scrolling; they do not stretch the whole page.

## Verification tooling

`frontend/scripts/browser-design-checks.ts` checks page overflow, content landmarks, heading duplication, reduced-motion scrolling and axe WCAG 2 A/AA and 2.1 AA rules at 360, 768, 1440 and 1920 CSS pixels. It can save ignored local screenshots for review.

`verify:design` covers public routes, missing-page and password-reset states, keyboard skip navigation, the mobile menu, event search and password visibility. The workspace suite adds these checks to isolated authenticated fixtures and actual student/team/System Admin interactions, including the interface example tabs.

Readiness uses visible rendered content and page metadata in workspace checks, including the destination heading after registration. Next's background link prefetching can remain active after a successful session recovery or viewport change, so network inactivity is not a prerequisite for those assertions.

See `setup-notes.md` for commands. Verification results and material limits are recorded in `PROJECT_STATE.md`.

### Recorded results (2026-10-11)

| Check | Result |
| --- | --- |
| Frontend production build / type check / lint | Passed; all 40 generated Next routes, zero lint warnings |
| Backend build / Prisma schema validation | Passed |
| Public browser design verification | 301 checks passed, including fallback fonts, both published reports and their PDF downloads |
| Isolated workspace browser/design verification | 1,136 combined checks passed; 980 design assertions across 49 states and 56 actual browser assertions |
| Project audit regressions | 80 checks passed |
| Client / PDF / UI regressions | Passed, including large exact totals, small chart axes, Unicode output, explicit labels and datalists |
| Flow / finance / governance / event scope / demo runtime | Passed |
| Production dependency audit | Zero known advisories |
| Full dependency audit | Seven existing development entries remain; documented upstream finding |

Deliberate transaction-conflict, duplicate-input, SMTP-failure and denied-access cases produce diagnostic logs during the regression suites. Their assertions passed. Earlier UI checks exposed contrast, mobile overflow and label/focus issues; those were fixed and the affected suites were rerun successfully.

## Limits

Automated accessibility checks and screenshots provide evidence for the states and widths exercised. They do not certify every assistive technology, browser, device, dataset or human usability outcome. Local browser checks use Microsoft Edge; Firefox, Safari, physical mobile devices, production deployment and real SMTP delivery were not verified by this design review.

The existing full dependency audit still reports seven development dependency entries associated with the upstream `braces` advisory. The production dependency audit reports zero known advisories. The only new project dependency is the development-only accessibility checker.
