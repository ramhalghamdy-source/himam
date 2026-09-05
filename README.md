# HIMAM MVP v0.5 — Adaptive Training

**HIMAM — Adaptive Motor-to-Work Intelligence Platform**

A hackathon-ready prototype that turns three short assessments into a transparent four-domain functional profile, maps that profile to simulated work-task requirements, and closes the loop with an **interactive adaptive training session** followed by reassessment.

## v0.5 adds a real adaptive training loop

The previous Demo Edition identified what to train next. v0.5 now makes that recommendation actionable.

New in this version:

- Dedicated **Training** view in the top navigation
- Interactive **Precision Transfer** module using mouse, touch, or trackpad
- Personalized starting level derived from the current priority-domain score
- 4 difficulty levels
- 3 rounds × 3 transfers per session
- Live metrics for placement accuracy, path efficiency, pace and successful completion
- Explainable Training Performance Score
- Automatic target-size, travel-demand and pace adaptation after every round
- Two strong rounds at ≥85 advance the user to the next level
- 70–84 increases challenge within the same level
- 50–69 holds difficulty to reinforce control
- <50 reduces one level when possible
- Training-session history appears in the Coach Dashboard
- **Reassess Hand Control** action after training
- Training performance is deliberately kept separate from Functional Profile scores

This creates the full hackathon story:

`Assess → Understand → Map to Work → Train → Adapt → Reassess`

## Assessment engine

### Test 01 — Reach & Target
Camera + MediaPipe Pose Landmarker.

Measures:
- Completion
- Path efficiency
- Body stability
- Consistency
- Live elbow angle
- HIMAM Reach Score

### Test 02 — Pinch & Transfer
Camera + MediaPipe Hand Landmarker.

Measures:
- Transfer success
- Endpoint precision
- Pinch control
- Path efficiency
- HIMAM Hand Control Score

### Test 03 — Digital Work Simulation
Browser interaction; camera not required.

Tasks:
1. Click six highlighted targets.
2. Drag three files into matching folders.
3. Type `HIMAM 2026 READY` exactly.

Digital Control formula:

`0.40 × target accuracy + 0.25 × drag success + 0.20 × typing accuracy + 0.15 × pace`

### Derived Coordination

`0.40 × reach path efficiency + 0.30 × reach consistency + 0.30 × hand pinch control`

## Functional profile

HIMAM keeps four domains visible rather than hiding them inside one black-box score:

- Reach
- Hand Control
- Coordination
- Digital Control

A simple Functional Index is used only as a longitudinal summary in the results / coach views.

## Work Readiness Matrix

Prototype weights:

| Work task | Reach | Hand | Coordination | Digital |
|---|---:|---:|---:|---:|
| Office Computer Tasks | 10% | 15% | 25% | 50% |
| Document Handling | 30% | 30% | 30% | 10% |
| Sorting & Packaging | 35% | 25% | 35% | 5% |
| Fine Assembly | 10% | 45% | 40% | 5% |

Prototype labels:
- 80–100: Strong task readiness
- 65–79: Near-ready
- 45–64: Training recommended
- <45: Further practice needed

These are hackathon prototype assumptions, **not validated occupational or clinical thresholds**.

## Adaptive training score

Each 3-transfer round produces a Training Performance Score:

`0.45 × placement accuracy + 0.30 × path efficiency + 0.15 × pace + 0.10 × successful completion`

Accuracy deliberately has the highest weight. Speed contributes only 15% so slower controlled performance is not heavily penalized.

### Difficulty levels

| Level | Label | Target radius | Travel demand | Reference pace |
|---|---|---:|---:|---:|
| 1 | Foundation | 13.5% | 34 | 8.0 s |
| 2 | Controlled | 10.8% | 42 | 7.2 s |
| 3 | Precision | 8.6% | 50 | 6.5 s |
| 4 | Work-like | 6.9% | 57 | 5.8 s |

The engine can also make smaller in-level adjustments before changing levels.

## Why training does not automatically increase the assessment score

This is intentional.

Completing a training game is not the same as demonstrating a new functional capability. v0.5 stores the training session separately and asks the participant to **reassess** the relevant domain. This prevents the prototype from artificially inflating the Functional Profile.

## Judge-safe Demo Mode

From the welcome screen choose a goal and press **Launch judge-safe demo**. HIMAM loads a deterministic sample case and opens the complete results pathway immediately.

The sample case intentionally produces **Hand Precision** as the lowest domain, so pressing **Start adaptive training** opens the new Precision Transfer module without depending on camera permissions.

Recommended judging route:

1. Launch judge-safe demo.
2. Explain Functional Profile + Office Readiness.
3. Show that Hand Precision is the weakest domain.
4. Press **Start adaptive training**.
5. Complete one or two adaptive rounds and point to the rule explaining why difficulty changed.
6. Finish the session and show **Reassess Hand Control**.
7. Open Coach Dashboard to show the newly stored training session.

## Training input in v0.5

The adaptive training interaction uses **pointer / touch / trackpad** for reliability during judging. The adaptive engine is separated from the input method, so a future version can connect the same difficulty controller to camera-based pinch input after validation.

## Run locally

Requirements:
- Node.js 18+
- Chrome or Edge recommended
- Webcam for Tests 01 and 02

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

## Production build

```bash
npm run build
```

## Important boundary

HIMAM v0.5 produces **task-performance indicators and adaptive training-session metrics inside a hackathon prototype**. It does not diagnose a condition, measure disability, replace a therapist, certify return-to-work fitness, or prove clinical improvement. The Work Readiness Matrix, adaptive thresholds, and any future clinical deployment require validation with occupational therapists, vocational rehabilitation experts, employers, and real-user data.
