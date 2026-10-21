# CHM2045 study guide: accuracy review

Site reviewed: https://chm2045-guide-preview.netlify.app (the "CHM2045 Study Notes" site, 24 pages plus the element data behind the periodic-table views), as published on 20 October 2026.
Reviewed 20 October 2026, 21:02 to 23:45 UTC.

## Verdict

The guide is accurate where it matters most. Every worked problem on the site was recomputed from its own givens and every final answer and every multiple-choice key is right: Sample Problems 6.1 to 6.11, end-of-chapter 6.58, the ammonium nitrate lecture example, Worksheet 5 Q1 to Q15 and the lab walkthrough; Sample Problems 7.1 to 7.3, 7.6, 7.7 and Worksheet 7 Q1 to Q11; Sample Problems 8.1 and 8.3 to 8.8, Practice Problem 8.1 and the two lecture exercises; Sample Problems 9.1 to 9.5 and Practice Problems 9.1 to 9.14. The definitions, sign conventions, periodic trends, electron configurations, Born-Haber and bond-energy work, and the 118-row element data table all check out, with one exception.

That exception is substantive: the oxidation-number figure gives oxygen "+6/−2" and fluorine "+7/−1", both chemically impossible. It comes from one entry in the element data file and shows up in three places. Beyond that there are ten minor slips in notes, captions and cross-references (none changes an answer) and ten places where wording is loose enough to mislead.

## 1. Substantive: fix first

### 1.1 Oxygen and fluorine oxidation numbers

Where it shows: the Figure 8.22 reproduction on /ch08/lesson-23 (tiles "8 O +6/−2" and "9 F +7/−1"), the fluorine card in the Figure 9.21 table on /ch09/lesson-26 ("O.N. +7/−1 · nonmetal"), and the Oxidation numbers mode of /tools/periodic-table. The root cause is assets/js/elements.js, where every p-block element's highest oxidation number is the group number: oxygen is stored as high 6, fluorine as high 7.

What is wrong: fluorine never has a positive oxidation number. It is −1 in every compound and 0 only in F2. Oxygen never reaches +6; its only positive states are +2 in OF2 and +1 in O2F2, with −1 in peroxides and −2 otherwise. The lesson's own rules text says "Fluorine is −1 in all its compounds" and that oxygen is positive only when bonded to fluorine, so the figure contradicts the page it sits on. A student who copies the figure would answer that F can be +7 or O can be +6.

Fix: fluorine tile "−1"; oxygen tile "+2/−2" (or "−2" with a note about OF2). Add one line under the figure saying the highest-number-equals-group-number rule fails for O and F. Correct the two rows in elements.js and all three views follow.

Unverified: what Silberberg's printed Figure 8.22 lists for O and F could not be retrieved online. If the book prints the bare group pattern, the guide has copied it faithfully, but the values are still wrong chemistry and the page's own rules say so.

Related, lower priority: in the same figure's Period 7 row, Nh, Mc and Ts carry the "predicted" asterisk but Fl (+4/−4) and Lv (+6/−2) do not. No compound of either has been characterized, so all five should be marked the same way.

## 2. Minor slips: wrong number, label or pointer, answers unaffected

2.1 /ch06/calorimeter, "Play with the numbers" text at the Q8 preset: "Per mole: 4.872 kJ ÷ 2.50 mol = −1.95 kJ/mol". A positive dividend cannot give a negative quotient. The live template should divide qrxn = −4.872 kJ, not the heat absorbed.

2.2 /ch06/worksheet-5, Q7 note: "Choice D (79.2 °C) is the trap from swapping the two heat capacities." Swapping them gives 82.4 °C, which is choice E. Choice D is the mass-only average, (275 × 100.0 + 100.0 × 22.0)/375.

2.3 /ch06/worksheet-5, Q9 note: "using only 100 mL or 50 mL gives the distractor choices." Those give 38.4 °C and 52.3 °C, which are not among the choices. Choice C (15.3 °C) is the sign error (24.53 − 9.26) and choice D (43.1 °C) comes from counting both the acid and the base moles (0.2040 mol instead of 0.1020 mol water).

2.4 /ch06/worksheet-5, Q1 note: "3 sig figs from 0.800 atm." The volume change 10.0 − 15.0 = −5.0 L has two significant figures and limits the result; strictly w = +4.0 L·atm = 4.1 × 10² J. The key 405 J (choice D) is unaffected.

2.5 /ch06/lesson-12, Sample Problem 6.1 caption: "For the other sign combinations see Figure 6.6 above." Figure 6.6 is below the problem and shows path independence, not sign combinations. The sign combinations are Table 6.1 and the first-law figure, both above. Same sentence in the Formulas wording.

2.6 /ch07/lesson-19, energy-levels figure: "ΔE = +984 kJ" and "ΔE = −984 kJ" are per-mole values printed without "/mol" (the per-atom value beside them, 1.64 × 10⁻¹⁸ J, times Avogadro's number is 984 kJ/mol). The captions then attach the molar value to one photon ("Ephoton = hν = ΔE = +984 kJ") and say the photon "carries away −984 kJ". The photon carries |ΔE|; the negative sign belongs to the atom's energy change.

2.7 /ch07/worksheet-7, Q3: "Round to 2 significant figures (the 50 nanoseconds and 100 megawatts given have only 2)." Trailing zeros without a decimal point are ambiguous, strictly one significant figure each by the textbook's rule. Rounding to two is a reasonable choice, but the stated reason is not.

2.8 "7.4 The nuclear atom" appears on the home page, the /ch07/ topic list and as the first heading of /ch07/lesson-20. Section 7.4 of the textbook is "The Quantum-Mechanical Model of the Atom"; the cathode-ray, oil-drop and gold-foil experiments are Chapter 2 material. The /ch07/ page itself names 7.4 correctly elsewhere. Keep the nuclear-atom timeline as an unnumbered background topic.

2.9 /ch09/lesson-26, Figure 9.21 grid: nobelium is 1.5; Pauling-scale tables give 1.3, the same as its neighbours Np through Md. Not verified against the printed figure.

2.10 Mid-sweep captions in the periodic-table animations show interpolated numbers that belong to no element. On /ch09/lesson-26 the electronegativity sweep reads "Be → B 1.8" and "Br → I 2.6" (tiles: B 2.0, I 2.5). On /ch08/lesson-23 the ionic-radius sweep reads "Mg2+ → Al3+ atom 153 → ion 65 pm" and "K+ → Rb+ atom 244 → ion 150 pm" (Mg 160/72, Al 143/54, K 227/138, Rb 248/152). The Lecture 22 sweeps do the same ("K → Rb 244 pm", "K → Rb 406 kJ/mol"); one verifier accepted those as a transitional readout, so treat this as one pattern. Snap the readout to the tile reached, or hide the number between tiles, so a paused frame never shows a wrong value.

## 3. Loose wording: defensible, could mislead

3.1 Effective nuclear charge across a period is attributed to "incomplete screening by inner electrons" (/ch08/ key idea; /ch08/lesson-21 key idea and its Formulas line). The inner core is the same for every element in a period, so its shielding is constant. Zeff rises because the nuclear charge rises while the electrons added to the same outer level shield one another only slightly. The page's own Period 2 captions say this correctly.

3.2 /ch08/ key terms, pseudo-noble gas configuration: "empties its highest n energy level and maximum l level." Drop "maximum l level": the (n−1)d sublevel, which has the highest l among the valence sublevels, is exactly the one that stays filled, as the entry's own Sn4+ example shows.

3.3 /ch07/ overview: "section 7.3 was not covered", yet the uncertainty principle, a Section 7.3 topic, is listed as a key term and taught in Lecture 20. Say 7.3 was skipped except for the uncertainty principle.

3.4 /ch07/lesson-20, "Orbital energies": "1s < 2s < 2p < 3s < 3p < 3d … sublevels are always written in successively higher places." True for many-electron atoms. In the hydrogen atom, whose orbitals this section draws, the energy depends on n only, so 2s and 2p are degenerate. Add the qualifier.

3.5 /ch07/worksheet-7, Q11 solution: "the six-lobed fz³ with rings." The fz³ orbital has two lobes along z plus two ring-shaped regions. The six-lobed f orbitals are fxz² and fyz², which are not in the worksheet's cubic set.

3.6 /ch07/worksheet-7, Q3 figure label: "CO2 laser · 100 MW infrared, λ = 1.05 μm." Carbon dioxide lasers emit near 10.6 μm; 1.05 μm is a neodymium line. The mislabel is the worksheet's and the arithmetic is right for 1.05 μm, but the guide annotates the comparable slip in Q7 and not this one.

3.7 /tools/periodic-table, radius chart caption: "maxima at Group 1A(1), minima at 8A(18)." On the guide's own Figure 8.13 data, Period 6 breaks the rule: W 139, Re 137, Os 135, Ir 136 and Pt 138 pm are all smaller than Rn at 140 pm.

3.8 /ch08/lesson-22, electron-affinity sweep caption: the Period 3 exceptions are listed as "(Mg ≤0, Ar (+35))" but phosphorus (−72 kJ/mol) is less negative than silicon (−134), which the page's own text calls a dip.

3.9 /ch06/problems, Formulas wording for the Sample Problem 6.6 figure: "qsoln = 693 J is the heat released by the reaction." qsoln is the heat absorbed by the solution; the heat released by the reaction is qrxn = −693 J. The Plain wording has it right.

3.10 "ΔH is the change in heat for a system at constant pressure" (/ch06/, /ch06/lesson-12, /ch06/lesson-13, /ch06/problems). This is the lecture slide's own sentence and the equation beside it is correct, but heat is a transfer, not a property that changes. Verifiers split on it (confirmed once, refuted three times as accepted shorthand). Optional polish: "ΔH equals the heat gained or lost at constant pressure."

## 4. Claims raised and rejected

Listed so nobody re-litigates them.

- A "×½" badge on equation 3 of the Worksheet 5 Q11 Hess's-law figure: a hidden template element picked up by text extraction. The rendered figure (screenshot checked) shows no such badge.
- "Ions get smaller across a period" in Sample Problem 9.2: the textbook's own phrasing, applied by the page only to isoelectronic neighbours.
- The H–F "mostly ionic" caption: the band label for ΔEN 1.7 to 3.3 that the whole page uses; the page also says HF is below 50 percent ionic.
- The uncertainty principle stated without "exactly", and the four nuclear-atom experiments including Chadwick's: the lecture's wording, reproduced consistently.
- Sb2O5 labelled "weakly basic": the textbook figure's own label.
- "1370 J / 0.0537 mol = 25.5 kJ/mol" in the ammonium nitrate example: correct result, the lecture's own line.
- Worksheet 5 Q8 reporting the bomb-calorimeter result as ΔH: the worksheet asks for the molar heat of combustion, and ΔH ≈ ΔE at this level.
- Running-configuration captions in the fluorine and silver orbital animations lagging one electron: mid-animation snapshots of the electron in flight.
- "Steps of fixed height" for Figure 7.10, "nodal planes" in the Q11 summary line, "shielded by just the 2 inner electrons", and "the noble gas in its row" under Figure 8.25: acceptable in context.

## 5. Checked and found correct

- All numerical results listed in the verdict, recomputed in Python from each page's givens and the guide's constants (1 atm·L = 101.3 J, 4.184 J/g·K, h = 6.626 × 10⁻³⁴ J·s, c = 3.00 × 10⁸ m/s, 2.18 × 10⁻¹⁸ J, 8.314 J/mol·K), including every intermediate value, caption number, Formulas-wording restatement and multiple-choice key.
- The element data table: 118 configurations including the 20 irregular ones, atomic and ionic radii, first ionization energies, electron affinities, oxides, noble-gas ions and electronegativities. Only the oxygen and fluorine oxidation numbers are wrong.
- Physical constants are used consistently across all pages.
- All 303 in-site topic links resolve in the rendered pages, and the home page's problem counts match the pages.
- The browser console shows no errors on any page, only software-rendering warnings from the headless test environment.

## 6. Method and limits

Each page was rendered in headless Chromium with every worked-problem step revealed, every explanation opened, both the Plain and Formulas wordings captured, and each animation's caption sampled at five points of its timeline. The 77 figure scripts were downloaded and the element data exported from the running page.

The review ran as orchestrated agent workflows. The first attempt (two independent reviewers per page, a reviewer per figure-script group, two adversarial verifiers per finding, then a third pass) hit the account's session usage limit after 11 of about 80 reviewer agents had finished, at about 21:25 UTC. After the limit reset it was rerun at 22:56 UTC in a leaner form: one combined concept-and-numbers reviewer per page, one refuting verifier per finding with a tie-breaker on uncertainty, and the earlier findings verified in the same pass. The six overview pages and Worksheet 5 therefore had two reviewers; the other pages had one.

Not done: the separate review of the figure-script text (captions were covered only through the sampled rendering, so other mid-sweep interpolated values may exist); the planned third-lens pass; a second independent verifier per finding. The contents of the printed textbook figures (Figure 8.22 entries for O and F, Figure 9.21 for nobelium) could not be retrieved online, so those two comparisons rest on chemistry and on standard tables rather than on the book.

Agent cost: about 8.5 million subagent tokens across both rounds, of which the interrupted first round spent about 2.3 million.

Sources consulted beyond the site itself: Silberberg and Amateis, Chemistry: The Molecular Nature of Matter and Change, 8th ed. (from knowledge; the publisher's table of contents was not retrievable); NIST values for ionization energies; https://en.wikipedia.org/wiki/Fluorine_compounds and https://en.wikipedia.org/wiki/Oxidation_state for the oxygen and fluorine oxidation states; https://chem-textbook.ucalgary.ca/?p=8102 on effective nuclear charge; Slater's rules for the shielding arithmetic.

## Addendum, 21 October 2026: corrections after independent review

A second reviewer recalculated the disputed numbers and compared the report with the live site. I re-fetched the site on 21 October and rechecked. Changes to the conclusions above:

- **Verdict softened.** "Every final answer is right" should read: every answer matches the textbook's or the worksheet's answer, with one rounding exception. Sample Problem 6.6 gives −55.48 kJ/mol unrounded; the textbook's −55.4 comes from rounding q to 693 J first. The site now shows −55.5.
- **Worksheet 5 Q8, bomb calorimeter: rejection reversed.** A bomb measures constant-volume heat, qV = ΔE. For C6H6(l) + 7.5 O2 → 6 CO2 + 3 H2O(l), Δn_gas = −1.5, so ΔH − ΔE = Δn·RT = −3.7 kJ/mol at 298 K, larger than the worksheet's artificial −1.95 kJ/mol result. "Approximately equal at this level" does not justify the ΔH label for these data. The site now labels the result ΔE.
- **Inherited worksheet data now listed.** Worksheet 5 supplies ΔH = −92 kJ for ½N2 + 3/2 H2 → NH3 (−45.9 kJ per mole NH3 is the reference value; −92 belongs to the two-mole equation), 2 O3 → 3 O2 = −427 kJ (reference about −285 kJ), and fictional calorimetry data for benzene and magnesium. These are the course's numbers, but the guide should annotate them as it does elsewhere. The reviewer reports the ammonia line is now corrected; I could not locate it in the live page by search, so that one is on the reviewer's word.
- **Oxygen wording tightened.** Section 1.1 said "−1 in peroxides and −2 otherwise". Correct to: 0 as the element, −½ (average) in superoxides such as KO2, −1 in peroxides, and −2 in most other compounds.
- **Nobelium value qualified.** PubChem lists 1.3 on the Pauling scale; the Royal Society of Chemistry lists it as unknown. The guide should cite the table it adopts rather than present either value as measured.
- **Interpolated captions.** Agreed that interpolation itself is fine; the problem is only an intermediate value reading as an element's property. Any of: label it as a transition, hide the number during movement, or snap to the element reached.
- **"Copied from the lecture or textbook" rejections.** Those establish provenance, not correctness. Of the rejected items, Sb2O5 "weakly basic" deserves a second look regardless of source: antimony(V) oxide is usually described as acidic to amphoteric. The others remain acceptable at the course's level.

Confirmed fixed on the live site on 21 October: oxygen and fluorine oxidation numbers (element data now O +2/−2 with an OF2 note, F "never positive"); the Worksheet 5 Q7 and Q9 distractor notes; the Q8 ΔE label; Sample Problem 6.6 at −55.5 kJ/mol; the hydrogen-atom qualifier on the Lecture 20 orbital-energy ladder; the calorimeter widget now dividing qrxn. Not rechecked: the nobelium tile, the "7.4 The nuclear atom" headings, the Lecture 19 "984 kJ" labels, and the mid-sweep captions.

### Second recheck, 21 October 2026

Confirmed by the independent reviewer and, where marked, by me on the live site:

- Ammonia: Worksheet 5 Q3, solution B now explains that −92 kJ belongs to the doubled equation and gives −45.9 kJ for the equation shown (reviewer).
- "984 kJ" labels on Lecture 19: the served figure code now distinguishes J per atom from kJ/mol and separates the photon's positive energy from the atom's negative ΔE (reviewer).
- Nobelium: still 1.5 in the guide's table. PubChem lists 1.3 (Pauling); the Royal Society of Chemistry lists it as unknown. Cite the adopted table.
- "7.4 The nuclear atom": still on the home page, the Chapter 7 topic list and the Lecture 20 navigation, while the lecture title names §7.4 as the quantum-mechanical model. Still open.
- Sb2O5: the live element data still says "weakly basic" (checked). Antimony pentoxide is described as acidic in the federal toxicological profile for antimony and as acidic to amphoteric generally. Correct the label or add a source-backed qualification. My earlier acceptance of it on provenance grounds is withdrawn.
- Ozone, Worksheet 5 Q11: the worksheet gives 2 O3(g) → 3 O2(g), ΔH° = −427 kJ. With NIST's ΔH°f(O3) = +142.67 kJ/mol the decomposition is about −285.3 kJ. The −233 kJ answer follows correctly from the supplied numbers, so keep the exercise but add a note that the supplied ozone value conflicts with standard data. Missed in the first pass and in the reviewer's first pass.
- Mid-sweep captions, rendered check (headless Chromium, live /ch08/lesson-22, captions read every 0.25 s): between tiles the readout shows interpolated values with an arrow label, for example "Na → Mg 182 pm", "Na → Mg 176 pm", "Mg → Al 152 pm", "K → Rb 244 pm", "K → Rb 406 kJ/mol", "Si → P −103 kJ/mol". On a tile the caption shows the tile value ("Mg 160 pm", "Al 577 kJ/mol"). The arrow does mark the number as a transition, which is one of the three acceptable treatments, but a paused frame still displays a number that is no element's value. The same code drives the Lecture 23 and Lecture 26 sweeps. Hiding the number during movement or snapping to the next tile would remove the ambiguity entirely.

## Remaining work, agreed 21 October 2026

| Priority | Change |
|---|---|
| High | Correct or explicitly qualify the Sb2O5 "weakly basic" label in the element data (antimony pentoxide is acidic to amphoteric). |
| High | Add a data note beside Worksheet 5 Q11: the supplied −427 kJ for 2 O3 → 3 O2 conflicts with standard thermochemistry (about −285 kJ from NIST's ΔH°f(O3) = +142.67 kJ/mol). Keep the worksheet's inputs and its −233 kJ answer. |
| Lower | Cite the source adopted for nobelium's electronegativity (PubChem 1.3; RSC lists it as unknown) and note the uncertainty. |
| Lower | Make the §7.4 headings and navigation consistent: home page, Chapter 7 topic list, Lecture 20. |
| Presentation | Hide intermediate numbers during the periodic-table sweeps, or show a value only when an element is reached. A clarity issue, not a chemistry error: the arrow already marks transitions and tile values are correct on arrival. |

Everything else found in this review is confirmed fixed on the live site or accepted as is.
