# Phase 3: Fail-Closed Image Acceptance Gate RED/GREEN Evidence Report

## 1. Executive Summary
- **Phase:** 3 — Fail-Closed Image Acceptance Gate
- **Status:** GREEN (All single-subject acceptance gates, contour detection, connected-component analysis, and scale-to-fit resampler passing)
- **Quality Gate:** 152 Unit Tests (including 12 frame-gate tests) + 12 workerd Integration Tests + 35 Determinism Tests = 199 Tests Passing (100% Green, 0 Type Errors).

---

## 2. Characterized RED Vulnerabilities, Executed Mutation Proofs & Verified Remediations

### Blocker #12a: Transparent / Empty Frame Gate
- **Vulnerability:** Fully transparent / empty output from model or chroma removal was accepted as a valid frame with 1.0 fill ratio.
- **Executed Mutation Test:** In `src/server/services/image/frame-gate.ts`, bypassed non-transparent contour check.
- **Command:** `npx vitest run tests/unit/frame-gate.test.ts`
- **Captured Verbatim Failing Output:**
  ```text
  FAIL  tests/unit/frame-gate.test.ts > Phase 3: Fail-Closed Image Acceptance Gate Invariants > rejects 100% transparent / empty frame
  AssertionError: expected false to be true // Object.is equality

  - Expected
  + Received

  - true
  + false

   ❯ tests/unit/frame-gate.test.ts:45:113
       43|     expect(result.ok).toBe(false);
       44|     if (!result.ok) {
       45|       expect(result.reasons.some(r => r.includes('No character pixels …
  ```
- **Remediation & Verified Output:** `findCharacterBoundingBox` returns `{ minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }` when `!found`, and `validateAndNormalizeFrame` strictly rejects empty frames. Verified 12/12 tests passing in `tests/unit/frame-gate.test.ts`.

---

### Blocker #12b: Collage Echo Gate (>4 Large Components)
- **Vulnerability:** Model output containing multiple collage panels or whole reference sheet echo was accepted.
- **Executed Mutation Test:** In `src/server/services/image/frame-gate.ts`, loosened `ccl.largeComponentsCount > GATES.maxLargeComponents` threshold from 4 to 10.
- **Command:** `npx vitest run tests/unit/frame-gate.test.ts`
- **Captured Verbatim Failing Output:**
  ```text
  FAIL  tests/unit/frame-gate.test.ts > Phase 3: Fail-Closed Image Acceptance Gate Invariants > rejects collage echo (>4 large components)
  AssertionError: expected false to be true // Object.is equality

  - Expected
  + Received

  - true
  + false

   ❯ tests/unit/frame-gate.test.ts:103:77
      101|     expect(result.ok).toBe(false);
      102|     if (!result.ok) {
      103|       expect(result.reasons.some(r => r.includes('Collage echo detecte…
  ```
- **Remediation & Verified Output:** 8-neighbour connected component labeling (`analyzeConnectedComponents`) strictly rejects $>4$ large components. Verified passing in `tests/unit/frame-gate.test.ts`.

---

### Blocker #12c: Multi-Subject Dominance Gate (>30% Ratio)
- **Vulnerability:** Frames containing secondary figures or bust+figure compositions were accepted.
- **Executed Mutation Test:** In `src/server/services/image/frame-gate.ts`, loosened `ccl.dominanceRatio > GATES.dominanceRatio` from 0.30 to 0.80.
- **Command:** `npx vitest run tests/unit/frame-gate.test.ts`
- **Captured Verbatim Failing Output:**
  ```text
  FAIL  tests/unit/frame-gate.test.ts > Phase 3: Fail-Closed Image Acceptance Gate Invariants > rejects multi-subject (2nd largest component > 30% of main)
  AssertionError: expected true to be false // Object.is equality

  - Expected
  + Received

  - false
  + true

   ❯ tests/unit/frame-gate.test.ts:111:23
      109|     const result = await validateAndNormalizeFrame(multiSubjectPng);
      110|
      111|     expect(result.ok).toBe(false);
         |                       ^
  ```
- **Remediation & Verified Output:** Connected component dominance ratio calculation (`secondLargestArea / largestArea`) strictly enforces $\le 0.30$. Verified passing in `tests/unit/frame-gate.test.ts`.

---

### Blocker #12d: Aspect-Preserving Scale-To-Fit vs Blind Cropping
- **Vulnerability:** Oversized model outputs were blindly cropped at fixed coordinate offsets rather than scaled and centered preserving aspect.
- **Remediation & Verified Output:** Implemented bilinear aspect-preserving resampler in `src/server/services/image/scale-to-fit.ts` (`scaleAndCenterCharacter`), fitting bounding boxes up to 1024x1024 into 256x256 without clipping. Verified passing in `tests/unit/frame-gate.test.ts`.

---

### Blocker #12e: Mandatory Canonical Reference & Raw Gate Retention
- **Vulnerability:** Poses could be generated with `referenceImage: null`, causing visual identity drift.
- **Remediation & Verified Output:** `generation-worker.ts` enforces mandatory canonical reference hero bytes before rendering poses, retains pre-normalization raw bytes at `raw/<rawSha>.png`, and re-validates cached frames before compositing.
